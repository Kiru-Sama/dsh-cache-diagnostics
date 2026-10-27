/**
 * Browser half of dsh-cache-diagnostics.
 *
 * Two registrations, both read-only:
 * - a rail icon in `sidebar.panellist` (the sidebar owns its button and opens
 *   the main panel whose key equals this entry's id);
 * - the diagnostics page in `main`.
 *
 * The data comes from the Host route `/cache-diagnostics/api`, which folds the
 * Session logs. Nothing here touches the conversation engine.
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const inject: string[];
export declare function apply(ctx: Context): void;
