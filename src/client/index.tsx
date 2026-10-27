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
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { CacheDiagnosticsIcon } from './icon'
import { CacheDiagnosticsPage } from './page'

export const inject = ['slots']

/** Rail entry id: it is also the main-panel key the sidebar dispatches. */
const PANEL_ID = 'dsh-cache-diagnostics'

export function apply(ctx: Context): void {
  // A registration failure must never take the shell down: log and stay absent.
  try {
    ctx.slots.inject('sidebar.panellist', () =>
      ctx.slots.register(
        { name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: () => '缓存诊断' },
        CacheDiagnosticsIcon,
      ))

    ctx.slots.inject('main', () =>
      ctx.slots.register({ name: 'main', key: PANEL_ID }, CacheDiagnosticsPage))
  } catch (error) {
    console.error('[dsh-cache-diagnostics] apply failed; diagnostics disabled for this page.', error)
  }
}
