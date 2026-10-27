/**
 * The diagnostics page, shown in the main column when the rail entry is picked.
 *
 * Rows come from the Host (`/cache-diagnostics/v2`), which folds each Session's
 * raw log: hit rate, whether system/tools changed, the first differing message
 * position, the message delta and a verdict. The page polls, so new requests
 * appear within seconds without touching the conversation.
 */
import { type ReactElement } from 'react';
export declare function CacheDiagnosticsPage(): ReactElement;
