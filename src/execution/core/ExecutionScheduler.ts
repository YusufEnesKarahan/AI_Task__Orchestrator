import { ExecutionGraph } from './ExecutionGraph';
import { ExecutionNode } from '../shared/executionTypes';

export class ExecutionScheduler {
    /**
     * Çalışmaya hazır düğümleri döner (status 'pending' ve tüm bağımlılıkları 'completed').
     */
    public getReadyNodes(graph: ExecutionGraph): ExecutionNode[] {
        const nodes = graph.getNodes();
        const ready: ExecutionNode[] = [];

        for (const node of nodes) {
            if (node.status !== 'pending') continue;

            // Tüm bağımlılıkları 'completed' olanları bul
            const allDepsCompleted = node.dependencies.every(depId => {
                const depNode = graph.getNode(depId);
                return depNode && depNode.status === 'completed';
            });

            if (allDepsCompleted) {
                ready.push(node);
            }
        }

        return ready;
    }

    /**
     * Başarısız olan bir adımın alt bağımlılıklarını iptal ('cancelled') olarak işaretler.
     */
    public propagateFailure(graph: ExecutionGraph, failedNodeId: string): void {
        const queue = [failedNodeId];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            // Bu düğüme doğrudan bağımlı olanları bul ve iptal et
            for (const node of graph.getNodes()) {
                if (node.dependencies.includes(currentId) && node.status === 'pending') {
                    node.status = 'cancelled';
                    node.error = `Upstream dependency "${currentId}" failed.`;
                    queue.push(node.id);
                }
            }
        }
    }

    /**
     * Tüm grafın yürütmesinin bittiğini (success or failure) denetler.
     */
    public isFinished(graph: ExecutionGraph): boolean {
        return graph.getNodes().every(node => 
            node.status === 'completed' || 
            node.status === 'failed' || 
            node.status === 'cancelled'
        );
    }

    /**
     * Grafın başarılı bir şekilde tamamlanıp tamamlanmadığını kontrol eder.
     */
    public isSuccessful(graph: ExecutionGraph): boolean {
        return graph.getNodes().every(node => 
            node.status === 'completed' || 
            node.status === 'cancelled' // or only completed nodes? usually if some were cancelled due to failure it is not successful
        ) && !graph.getNodes().some(node => node.status === 'failed');
    }
}
