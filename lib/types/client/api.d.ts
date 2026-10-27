/**
 * Client data source: the Host's `/cache-diagnostics/api` rows.
 *
 * One poller feeds every consumer (rail icon and page), so opening both never
 * doubles the work. Rows are computed on the Host from session logs; this half
 * only renders them, which is why it cannot disturb the conversation.
 */
/** Mirror of the Host's `CacheRow`. */
export interface Row {
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
export interface RowsState {
    readonly rows: readonly Row[];
    readonly error?: string;
    readonly pending?: boolean;
    readonly phase?: string;
    readonly updatedAt?: number;
}
/** Rows for every consumer; polls while the page is visible. */
export declare function useRows(): RowsState;
