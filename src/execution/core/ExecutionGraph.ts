import { ExecutionNode } from '../shared/executionTypes';

export class ExecutionGraph {
    private readonly nodes = new Map<string, ExecutionNode>();

    /**
     * Düğüm ekler.
     */
    public addNode(node: ExecutionNode): this {
        this.nodes.set(node.id, {
            ...node,
            dependencies: node.dependencies || [],
            status: node.status || 'pending',
            attempts: 0
        });
        return this;
    }

    /**
     * Düğümü ID ile çeker.
     */
    public getNode(id: string): ExecutionNode | undefined {
        return this.nodes.get(id);
    }

    /**
     * Tüm düğümleri dizi olarak döndürür.
     */
    public getNodes(): ExecutionNode[] {
        return Array.from(this.nodes.values());
    }

    /**
     * Grafın geçerli ve devirsiz (Directed Acyclic Graph) olduğunu doğrular.
     */
    public validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        // 1. Tanımlanmamış bağımlılık referansları kontrolü
        for (const node of this.nodes.values()) {
            for (const depId of node.dependencies) {
                if (!this.nodes.has(depId)) {
                    errors.push(`Düğüm "${node.id}", tanımlanmamış bir bağımlılığa referans veriyor: "${depId}".`);
                }
            }
        }

        // 2. Döngüsel bağımlılık (Cycle) kontrolü (DFS)
        const visited = new Set<string>();
        const recStack = new Set<string>();

        const hasCycle = (nodeId: string): boolean => {
            if (recStack.has(nodeId)) return true;
            if (visited.has(nodeId)) return false;

            visited.add(nodeId);
            recStack.add(nodeId);

            const node = this.nodes.get(nodeId);
            if (node) {
                for (const depId of node.dependencies) {
                    if (hasCycle(depId)) return true;
                }
            }

            recStack.delete(nodeId);
            return false;
        };

        for (const nodeId of this.nodes.keys()) {
            if (hasCycle(nodeId)) {
                errors.push('Graf içinde döngüsel bağımlılık (circular dependency / cycle) tespit edildi.');
                break; // Bir tane bulmak yeterli
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}
