/**
 * Pure prefix-attribution logic: no DSH imports, no React, no I/O.
 *
 * Keeping this file pure is what makes the diff rules testable without a host
 * and keeps the bundle free of runtime `@deepseek-ai` imports.
 */
import { type CacheUsage, type FirstDiff, type RequestRow, type SurfaceEntry, type Verdict } from './types';
/** FNV-1a over the serialized payload: stable, allocation-light, no crypto. */
export declare function hashPayload(value: unknown): string;
/**
 * Official DSH cache rate.
 *
 * DSH reports three disjoint buckets — uncached input, cache read, cache
 * write — so the input side of the request is their sum. This matches the
 * rate DSH's own status line reports; the two-bucket
 * `read / (read + uncached)` figure some plugins use is a miss threshold, not
 * a hit rate, and is deliberately not what this computes.
 */
export declare function hitRateOf(usage: CacheUsage | undefined): number | undefined;
/**
 * Locate the first position where two consecutive request surfaces diverge.
 *
 * DeepSeek's cache is prefix-matched, so this single index decides how much of
 * the prompt survives: an append leaves the prefix intact, a rewrite at index
 * `k` invalidates everything from `k` onward.
 */
export declare function diffSurfaces(previous: readonly SurfaceEntry[], next: readonly SurfaceEntry[]): FirstDiff;
/** Message-count change between two consecutive requests. */
export declare function messageDeltaOf(previous: readonly SurfaceEntry[], next: readonly SurfaceEntry[]): number;
/**
 * Name the cause when a request misses cache, using the prefix evidence.
 *
 * Ordering follows the diagnosticity of each signal: a rewritten head is the
 * most specific explanation, then tool churn, then system churn, and finally
 * the case where the prefix is provably intact — which can only mean the
 * server dropped the cache, and which no prompt edit will fix.
 */
export declare function verdictOf(row: {
    readonly hitRate: number | undefined;
    readonly firstDiff: FirstDiff;
    readonly toolsChanged: boolean;
    readonly systemChanged: boolean;
}): Verdict;
/** Short `首差` label, matching the vocabulary used by the AstrBot original. */
export declare function formatFirstDiff(diff: FirstDiff): string;
/** One-line `判定` text: what the diff means for the cache. */
export declare function formatVerdict(row: RequestRow): string;
/** Why a low-hit row happened, phrased as the next thing to look at. */
export declare function explainVerdict(verdict: Verdict): string | undefined;
/** Signed message-count change, e.g. `+5` / `-3` / `0`. */
export declare function formatDelta(delta: number): string;
/** Percent with one decimal, or `—` when the request reported no cache data. */
export declare function formatRate(rate: number | undefined): string;
