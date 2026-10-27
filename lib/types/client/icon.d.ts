/**
 * The rail icon for the diagnostics page.
 *
 * The sidebar owns the button (it selects the matching main panel by this
 * entry's id), so the plugin supplies only the glyph plus a status dot: green
 * when the newest request reused the cache, amber when it missed, grey before
 * there is any data. The tooltip carries the number.
 */
import { type ReactElement } from 'react';
export declare function CacheDiagnosticsIcon({ size, active, }: {
    readonly size?: number;
    readonly active?: boolean;
}): ReactElement;
