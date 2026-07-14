import { EventBus } from '../shared/events/EventBus';
import {
    createDecisionMemoryDocument,
    createJournalMemoryDocument,
    createMemoryIndexDocument,
    createStaticMemoryDocument,
    createWorkingMemoryDocument,
    MEMORY_FILE_NAMES
} from './defaults';
import { MemoryFileStore } from './MemoryFileStore';
import { MemoryIndexManager } from './MemoryIndexManager';
import {
    normalizeDecisionMemoryDocument,
    normalizeJournalMemoryDocument,
    normalizeMemoryIndexDocument,
    normalizeStaticMemoryDocument,
    normalizeWorkingMemoryDocument
} from './MemoryNormalizers';
import { DecisionMemoryLayer } from './layers/DecisionMemoryLayer';
import { JournalMemoryLayer } from './layers/JournalMemoryLayer';
import { LongTermMemoryLayer } from './layers/LongTermMemoryLayer';
import { StaticMemoryLayer } from './layers/StaticMemoryLayer';
import { WorkingMemoryLayer } from './layers/WorkingMemoryLayer';
import {
    AddDecisionInput,
    AddJournalEntryInput,
    DecisionRecord,
    JournalEntry,
    MemorySearchResult,
    MemorySnapshot,
    SearchMemoryOptions,
    UpdateStaticMemoryInput,
    UpdateWorkingMemoryInput
} from './types';

export class MemoryEngine {
    private readonly store: MemoryFileStore;
    private readonly indexManager = new MemoryIndexManager();
    private readonly staticLayer = new StaticMemoryLayer();
    private readonly workingLayer = new WorkingMemoryLayer();
    private readonly decisionLayer = new DecisionMemoryLayer();
    private readonly journalLayer = new JournalMemoryLayer();
    private readonly longTermLayer = new LongTermMemoryLayer();
    private snapshot: MemorySnapshot | undefined;

    constructor(
        private readonly workspaceRoot: string,
        private readonly eventBus = EventBus.getInstance()
    ) {
        this.store = new MemoryFileStore(workspaceRoot);
    }

    public async loadMemory(): Promise<MemorySnapshot> {
        const staticResult = await this.store.readDocument(
            MEMORY_FILE_NAMES.static,
            createStaticMemoryDocument,
            normalizeStaticMemoryDocument
        );
        const workingResult = await this.store.readDocument(
            MEMORY_FILE_NAMES.working,
            createWorkingMemoryDocument,
            normalizeWorkingMemoryDocument
        );
        const decisionResult = await this.store.readDocument(
            MEMORY_FILE_NAMES.decision,
            createDecisionMemoryDocument,
            normalizeDecisionMemoryDocument
        );
        const journalResult = await this.store.readDocument(
            MEMORY_FILE_NAMES.journal,
            createJournalMemoryDocument,
            normalizeJournalMemoryDocument
        );
        const indexResult = await this.store.readDocument(
            MEMORY_FILE_NAMES.index,
            createMemoryIndexDocument,
            normalizeMemoryIndexDocument
        );

        const snapshotWithoutIndex = {
            static: staticResult.document,
            working: workingResult.document,
            decisions: decisionResult.document,
            journal: journalResult.document
        };

        const rebuiltIndex = this.indexManager.build(snapshotWithoutIndex);
        this.snapshot = {
            ...snapshotWithoutIndex,
            index: rebuiltIndex
        };

        if (
            staticResult.healed ||
            workingResult.healed ||
            decisionResult.healed ||
            journalResult.healed ||
            indexResult.healed
        ) {
            await this.saveMemory(this.snapshot);
        } else {
            await this.store.writeDocument(MEMORY_FILE_NAMES.index, rebuiltIndex);
        }

        this.eventBus.emit('MemoryLoaded', {
            workspaceRoot: this.workspaceRoot,
            index: rebuiltIndex
        });

        return this.clone(this.snapshot);
    }

    public async saveMemory(snapshot: MemorySnapshot): Promise<MemorySnapshot> {
        const rebuiltIndex = this.indexManager.build({
            static: snapshot.static,
            working: snapshot.working,
            decisions: snapshot.decisions,
            journal: snapshot.journal
        });

        this.snapshot = {
            ...snapshot,
            index: rebuiltIndex
        };

        await this.store.writeDocument(MEMORY_FILE_NAMES.static, this.snapshot.static);
        await this.store.writeDocument(MEMORY_FILE_NAMES.working, this.snapshot.working);
        await this.store.writeDocument(MEMORY_FILE_NAMES.decision, this.snapshot.decisions);
        await this.store.writeDocument(MEMORY_FILE_NAMES.journal, this.snapshot.journal);
        await this.store.writeDocument(MEMORY_FILE_NAMES.index, this.snapshot.index);

        this.eventBus.emit('MemoryUpdated', {
            key: 'memory',
            value: this.snapshot.index,
            layer: 'static',
            file: MEMORY_FILE_NAMES.index
        });

        return this.clone(this.snapshot);
    }

    public async updateStaticMemory(updates: UpdateStaticMemoryInput): Promise<MemorySnapshot> {
        const snapshot = await this.getSnapshot();
        let staticDocument = this.staticLayer.update(snapshot.static, updates);

        if (updates.longTermMemory) {
            staticDocument = this.longTermLayer.merge(staticDocument, updates.longTermMemory);
        }

        return this.saveMemory({
            ...snapshot,
            static: staticDocument
        });
    }

    public async updateWorkingMemory(updates: UpdateWorkingMemoryInput): Promise<MemorySnapshot> {
        const snapshot = await this.getSnapshot();
        const working = this.workingLayer.update(snapshot.working, updates);
        const saved = await this.saveMemory({
            ...snapshot,
            working
        });

        this.eventBus.emit('WorkingMemoryUpdated', {
            workspaceRoot: this.workspaceRoot,
            workingMemory: saved.working.workingMemory
        });

        return saved;
    }

    public async addDecision(input: AddDecisionInput): Promise<DecisionRecord> {
        if (!input.title.trim() || !input.reason.trim()) {
            throw new Error('Decision title and reason are required.');
        }

        const snapshot = await this.getSnapshot();
        const result = this.decisionLayer.addDecision(snapshot.decisions, input);
        await this.saveMemory({
            ...snapshot,
            decisions: result.document
        });

        this.eventBus.emit('DecisionAdded', {
            workspaceRoot: this.workspaceRoot,
            decision: result.decision
        });

        return this.clone(result.decision);
    }

    public async addJournalEntry(input: AddJournalEntryInput): Promise<JournalEntry> {
        if (!input.summary.trim() || !input.why.trim()) {
            throw new Error('Journal summary and why are required.');
        }

        const snapshot = await this.getSnapshot();
        const result = this.journalLayer.addEntry(snapshot.journal, input);
        await this.saveMemory({
            ...snapshot,
            journal: result.document
        });

        this.eventBus.emit('JournalAdded', {
            workspaceRoot: this.workspaceRoot,
            entry: result.entry
        });

        return this.clone(result.entry);
    }

    public async searchMemory(query: string, options: SearchMemoryOptions = {}): Promise<MemorySearchResult[]> {
        const snapshot = await this.getSnapshot();
        return this.indexManager.search(snapshot.index, query, options);
    }

    public async clearMemory(): Promise<MemorySnapshot> {
        const now = Date.now();
        const snapshot: MemorySnapshot = {
            static: createStaticMemoryDocument(now),
            working: createWorkingMemoryDocument(now),
            decisions: createDecisionMemoryDocument(now),
            journal: createJournalMemoryDocument(now),
            index: createMemoryIndexDocument(now)
        };

        const saved = await this.saveMemory(snapshot);
        this.eventBus.emit('MemoryCleared', {
            workspaceRoot: this.workspaceRoot
        });
        return saved;
    }

    private async getSnapshot(): Promise<MemorySnapshot> {
        if (!this.snapshot) {
            return this.loadMemory();
        }
        return this.clone(this.snapshot);
    }

    private clone<T>(value: T): T {
        return JSON.parse(JSON.stringify(value)) as T;
    }
}
