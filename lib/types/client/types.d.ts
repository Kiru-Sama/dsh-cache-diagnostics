/**
 * Structural types for the prefix-attribution cache diagnostics surface.
 *
 * These mirror the shapes DSH actually publishes instead of importing them:
 * the conversation event union is narrowed per core version, and the provider
 * usage object carries pass-through fields whose names no published type owns.
 * Reading structurally at this one boundary keeps the plugin working across
 * cores and lets the raw provider fields survive for cross-checking.
 */
/** Cache-relevant usage as DSH reports it: three disjoint buckets. */
export interface CacheUsage {
    /** Input tokens that were NOT served from cache (re-billed / recomputed). */
    readonly inputTokens?: number;
    /** Input tokens served from the prompt cache (a hit). */
    readonly cacheReadTokens?: number;
    /** Input tokens written into the prompt cache by this request. */
    readonly cacheWriteTokens?: number;
    readonly outputTokens?: number;
    readonly totalTokens?: number;
    /** Pass-through: raw provider fields such as `prompt_cache_hit_tokens`. */
    readonly [field: string]: unknown;
}
/** The event fields this plugin reads, structurally. */
export interface StreamEvent {
    readonly type: string;
    readonly seq?: number;
    readonly time: number;
    readonly data: {
        readonly turn?: number;
        readonly step?: number;
        /** `request/header` payload. */
        readonly header?: unknown;
        readonly chunk?: {
            readonly type: string;
            readonly text?: string;
            readonly usage?: CacheUsage;
        };
        readonly usage?: CacheUsage;
        readonly message?: {
            readonly source?: {
                readonly provider?: string;
                readonly model?: string;
            };
            readonly provenance?: {
                readonly provider?: string;
            };
        };
        /** Surface operation marker: append, or a positional replacement. */
        readonly surfaceOp?: unknown;
    };
}
/**
 * One model-visible message on the session surface.
 *
 * DSH guarantees surface content is immutable and unchanged content retains
 * its durable identity, so `seq` alone identifies a message across requests;
 * `hash` guards the case where a caller re-emits the same position with
 * rewritten content.
 */
export interface SurfaceEntry {
    readonly seq: number;
    readonly hash: string;
}
/**
 * Where two consecutive requests' surfaces first differ.
 *
 * DeepSeek caching is prefix-matched: everything after the first difference is
 * invalidated. This is the same vocabulary Kiru-Sama's AstrBot monitor uses.
 */
export type FirstDiff = 
/** No previous request in this session to compare against. */
{
    readonly kind: 'first';
}
/** Surfaces are identical. */
 | {
    readonly kind: 'same';
}
/** Only appended at the tail: the prefix is intact, cache unaffected. */
 | {
    readonly kind: 'append';
    readonly added: number;
}
/** Message at `index` differs (rewritten in place, or head/middle edited). */
 | {
    readonly kind: 'rewrite';
    readonly index: number;
}
/** Surface got shorter: the head was trimmed/compacted away. */
 | {
    readonly kind: 'trim';
    readonly index: number;
    readonly removed: number;
};
/** What the row concludes, combining hit rate with the prefix evidence. */
export type Verdict = 
/** Healthy — cache did its job. */
'ok'
/** Low hit + head/middle rewritten: something edited early history. */
 | 'head-rewrite'
/** Low hit + tail-only append: prefix intact, server-side eviction. */
 | 'evicted'
/** Low hit + tool catalog changed between requests. */
 | 'tools-churn'
/** Low hit + system prompt changed between requests. */
 | 'system-churn'
/** Low hit, but no prefix evidence explains it. */
 | 'unexplained'
/** The request reported no cache accounting at all. */
 | 'no-data';
/** One row of the diagnostics table: a single provider request. */
export interface RequestRow {
    readonly seq: number;
    readonly time: number;
    readonly turn: number;
    readonly step: number;
    /** Ordinary generation, or a compaction summary call. */
    readonly purpose: 'assistant' | 'compaction';
    /** Official DSH rate: cacheRead / (input + cacheRead + cacheWrite). */
    readonly hitRate: number | undefined;
    readonly input: number;
    readonly cacheRead: number;
    readonly cacheWrite: number;
    readonly output: number;
    /** DSH's own classification of the model-visible prompt change. */
    readonly changeKind: 'initial' | 'system' | 'tools' | 'system-and-tools' | undefined;
    readonly systemChanged: boolean;
    readonly toolsChanged: boolean;
    /** DSH-specific: an in-history system update, presented at its own position. */
    readonly systemUpdate: boolean;
    readonly firstDiff: FirstDiff;
    /** Change in surface message count versus the previous request. */
    readonly messageDelta: number;
    readonly verdict: Verdict;
    readonly provider: string | undefined;
    readonly model: string | undefined;
    readonly retry: number | undefined;
    readonly error: string | undefined;
}
/** Aggregated picture for one session. */
export interface CacheAggregate {
    readonly rows: readonly RequestRow[];
    readonly totalInput: number;
    readonly totalCacheRead: number;
    readonly totalCacheWrite: number;
    readonly hitRate: number | undefined;
    /** Rows at or above the healthy threshold. */
    readonly healthyCount: number;
    /** Rows below it that carry cache data. */
    readonly lowCount: number;
    /** Rows whose verdict names a concrete cause. */
    readonly explainedCount: number;
}
export declare const EMPTY_AGGREGATE: CacheAggregate;
/** Below this rate a row counts as a cache miss worth explaining. */
export declare const HEALTHY_HIT_RATE = 0.5;
