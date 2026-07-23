import { EventBus } from '../shared/events/EventBus';
import { AgentRegistry } from '../agents/core/AgentRegistry';
import { AgentManager } from '../agents/core/AgentManager';
import { AgentRouter } from '../agents/core/AgentRouter';
import { ExecutionGraph } from './core/ExecutionGraph';
import { ExecutionScheduler } from './core/ExecutionScheduler';
import { ExecutionQueue } from './core/ExecutionQueue';
import { RetryPolicy } from './core/RetryPolicy';
import { TimeoutManager } from './core/TimeoutManager';
import { ExecutionMetricsManager } from './core/ExecutionMetrics';
import { ExecutionNode, ExecutionResult } from './shared/executionTypes';
import { AgentRunInput } from '../agents/core/IAgent';

export class ExecutionEngine {
    private readonly agentManager: AgentManager;
    private readonly scheduler = new ExecutionScheduler();
    private readonly metricsManager: ExecutionMetricsManager;
    private readonly eventBus = EventBus.getInstance();
    
    private readonly activeGraphs = new Map<string, ExecutionGraph>();
    private readonly cancelledExecutions = new Set<string>();

    constructor(private readonly workspaceRoot: string) {
        this.agentManager = new AgentManager(workspaceRoot); // default ajanları kaydeder
        this.metricsManager = new ExecutionMetricsManager(workspaceRoot);
    }

    /**
     * Verilen bir DAG grafını paralel ve bağımlılıklara duyarlı şekilde yürütür.
     */
    public async executeGraph(
        graph: ExecutionGraph,
        options: { maxConcurrency?: number; timeoutMs?: number; maxRetries?: number } = {}
    ): Promise<ExecutionResult> {
        const executionId = `exec_${Date.now()}`;
        this.activeGraphs.set(executionId, graph);

        // Graf doğrulaması
        const validation = graph.validate();
        if (!validation.valid) {
            return {
                executionId,
                success: false,
                nodes: graph.getNodes(),
                metrics: { totalDurationMs: 0, successRate: 0, parallelismFactor: 0, stepDurations: {} },
                errors: validation.errors
            };
        }

        const startTime = Date.now();
        this.eventBus.emit('ExecutionStarted', { executionId, graph: graph.getNodes() });

        const queue = new ExecutionQueue(options.maxConcurrency || 3);
        const retryPolicy = new RetryPolicy({ maxRetries: options.maxRetries ?? 2, backoffMs: 100 });
        const timeoutManager = new TimeoutManager({ timeoutMs: options.timeoutMs ?? 15000 });

        // Yürütücü döngüsü yardımcı fonksiyonu
        const runSchedulerLoop = async (): Promise<void> => {
            if (this.cancelledExecutions.has(executionId)) {
                graph.getNodes().forEach(n => {
                    if (n.status === 'pending') {
                        n.status = 'cancelled';
                        n.error = 'Yürütme kullanıcı tarafından iptal edildi.';
                    }
                });
                return;
            }

            const readyNodes = this.scheduler.getReadyNodes(graph);
            if (readyNodes.length === 0) {
                return;
            }

            const promises = readyNodes.map(async (node) => {
                node.status = 'running';
                this.eventBus.emit('ExecutionStepStarted', { executionId, nodeId: node.id });
                const nodeStartTime = Date.now();

                try {
                    const agent = AgentRegistry.getInstance().getAgent(node.agentId);
                    if (!agent) {
                        throw new Error(`Ajan kaydı bulunamadı: ${node.agentId}`);
                    }

                    // Bağımlı olunan düğümlerin çıktılarını girdi olarak birleştir
                    const mergedInputs: Record<string, any> = { ...node.inputs };
                    node.dependencies.forEach(depId => {
                        const depNode = graph.getNode(depId);
                        if (depNode && depNode.output) {
                            if (typeof depNode.output === 'object') {
                                Object.assign(mergedInputs, depNode.output);
                            } else {
                                mergedInputs[`${depId}_output`] = depNode.output;
                            }
                        }
                    });

                    node.inputs = mergedInputs; // Persist evaluated inputs in the node

                    const runInput: AgentRunInput = {
                        taskDescription: node.taskDescription,
                        inputs: mergedInputs
                    };

                    // Retry ve Timeout politikaları ile çalıştır
                    const result = await retryPolicy.execute(
                        () => timeoutManager.execute(() => agent.run(runInput)),
                        (attempt, err) => {
                            node.attempts = attempt;
                            this.eventBus.emit('ExecutionStepFailed', {
                                executionId,
                                nodeId: node.id,
                                error: `Deneme ${attempt} başarısız: ${err.message}`
                            });
                        }
                    );

                    if (!result.success) {
                        throw new Error(result.errors?.join(', ') || 'Ajan çalışması başarısız oldu.');
                    }

                    node.status = 'completed';
                    node.output = result.data || result.output;
                    node.durationMs = Date.now() - nodeStartTime;
                    this.eventBus.emit('ExecutionStepCompleted', { executionId, nodeId: node.id, result: node.output });

                } catch (err: any) {
                    node.status = 'failed';
                    node.error = err?.message || String(err);
                    node.durationMs = Date.now() - nodeStartTime;
                    this.eventBus.emit('ExecutionStepFailed', { executionId, nodeId: node.id, error: node.error! });
                    
                    // Başarısızlığı alt düğümlere yay (iptal et)
                    this.scheduler.propagateFailure(graph, node.id);
                }

                // Kuyruğu tekrar kontrol et ve yeni hazır düğümleri sür
                await runSchedulerLoop();
            });

            // Hazır düğümleri paralel işleme kuyruğuna sür
            readyNodes.forEach((node, index) => {
                queue.push(node.id, () => promises[index]);
            });
        };

        // İlk tetiklemeyi yap
        await runSchedulerLoop();

        // Tüm adımlar bitene dek bekle
        while (!this.scheduler.isFinished(graph)) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        const totalDurationMs = Date.now() - startTime;
        const success = this.scheduler.isSuccessful(graph);
        const finalMetrics = this.metricsManager.calculateMetrics(graph.getNodes(), totalDurationMs);

        const executionResult: ExecutionResult = {
            executionId,
            success,
            nodes: graph.getNodes(),
            metrics: finalMetrics
        };

        // Sonuçları kaydet ve olay yayınla
        this.metricsManager.saveExecution(executionResult);
        this.eventBus.emit('ExecutionCompleted', { executionId, success, metrics: finalMetrics });
        this.activeGraphs.delete(executionId);

        return executionResult;
    }

    /**
     * Sıralı boru hattı (Pipeline) yürütür.
     */
    public async executePipeline(
        steps: Array<{ agentId: string; taskDescription: string; inputs?: Record<string, any> }>,
        options?: { maxConcurrency?: number; timeoutMs?: number; maxRetries?: number }
    ): Promise<ExecutionResult> {
        const graph = new ExecutionGraph();
        
        steps.forEach((step, index) => {
            const id = `step_${index}_${step.agentId}`;
            const dependencies = index > 0 ? [`step_${index - 1}_${steps[index - 1].agentId}`] : [];
            graph.addNode({
                id,
                agentId: step.agentId,
                taskDescription: step.taskDescription,
                dependencies,
                status: 'pending',
                inputs: step.inputs
            });
        });

        return this.executeGraph(graph, options);
    }

    /**
     * Tekil bir görevi yönlendirip yürütür.
     */
    public async execute(taskDescription: string, inputs?: Record<string, any>): Promise<ExecutionResult> {
        const graph = new ExecutionGraph();
        const bestAgent = new AgentRouter(this.workspaceRoot).route(taskDescription);
        
        graph.addNode({
            id: 'standalone_step',
            agentId: bestAgent.id,
            taskDescription,
            dependencies: [],
            status: 'pending',
            inputs
        });

        return this.executeGraph(graph);
    }

    /**
     * Aktif yürütmeyi iptal eder.
     */
    public cancel(executionId: string): void {
        this.cancelledExecutions.add(executionId);
    }

    /**
     * Başarısız veya iptal olmuş düğümleri sıfırlayarak graf yürütmesini yeniden başlatır.
     */
    public async retry(
        executionId: string, 
        options: { maxConcurrency?: number; timeoutMs?: number; maxRetries?: number } = {}
    ): Promise<ExecutionResult> {
        const graph = this.activeGraphs.get(executionId);
        if (!graph) {
            throw new Error(`Yürütme bulunamadı: ${executionId}`);
        }

        graph.getNodes().forEach(node => {
            if (node.status === 'failed' || node.status === 'cancelled') {
                node.status = 'pending';
                node.error = undefined;
                node.attempts = 0;
            }
        });

        this.cancelledExecutions.delete(executionId);
        return this.executeGraph(graph, options);
    }

    /**
     * Yürütme durumunu sorgular.
     */
    public getStatus(executionId: string): 'running' | 'completed' | 'failed' | 'cancelled' | undefined {
        const graph = this.activeGraphs.get(executionId);
        if (!graph) return undefined;

        if (this.cancelledExecutions.has(executionId)) return 'cancelled';
        if (this.scheduler.isFinished(graph)) {
            return this.scheduler.isSuccessful(graph) ? 'completed' : 'failed';
        }
        return 'running';
    }
}
