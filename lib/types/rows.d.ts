/**
 * Pure request-level diagnostics over one Session's raw event log.
 *
 * No imports and no I/O: the Host reads the log, this module folds it into the
 * rows the page renders. DeepSeek cache is prefix-matched, so the interesting
 * number is not the hit rate but WHERE the first difference sits.
 */
/** One model request as the page shows it. */
export interface CacheRow {
    readonly sessionId: string;
    readonly title?: string;
    readonly time: number;
    readonly turn: number;
    readonly step: number;
    readonly purpose: 'assistant' | 'compaction';
    readonly input: number;
    readonly cacheRead: number;
    readonly cacheWrite: number;
    readonly output: number;
    readonly hitRate?: number;
    readonly changeKind?: 'initial' | 'system' | 'tools' | 'system-and-tools';
    readonly systemChanged: boolean;
    readonly toolsChanged: boolean;
    readonly firstDiff: {
        readonly kind: 'first';
    } | {
        readonly kind: 'same';
    } | {
        readonly kind: 'append';
        readonly added: number;
    } | {
        readonly kind: 'rewrite';
        readonly index: number;
    } | {
        readonly kind: 'trim';
        readonly index: number;
        readonly removed: number;
    };
    readonly messageDelta: number;
    readonly verdict: string;
    readonly explanation?: string;
    readonly provider?: string;
    readonly model?: string;
    readonly retry?: number;
    readonly error?: string;
}
/**
 * Fold one Session's events into request rows, oldest first.
 *
 * @param sessionId - owning Session.
 * @param title - folded Session title, when the query could read one.
 * @param events - the raw log in ascending sequence order.
 */
export declare function rowsFromEvents(sessionId: string, initialTitle: string | undefined, events: readonly unknown[]): CacheRow[];
