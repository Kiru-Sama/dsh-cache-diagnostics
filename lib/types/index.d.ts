/**
 * Host half of dsh-cache-diagnostics.
 *
 * Serves one JSON route computed from the Session logs: per model request, the
 * cache buckets, whether the system prompt or tool catalog changed, where the
 * model-visible surface first diverged, and a verdict. It registers no
 * conversation Definition and writes nothing into a Session, so it cannot
 * disturb the Chat.
 *
 * A plugin installed through the profile cannot resolve `@deepseek-ai/*` bare
 * modules at mount, so this half imports nothing but its own pure module:
 * services are read through `ctx.get`.
 */
export declare const name = "dsh-cache-diagnostics";
interface CtxLike {
    get(name: string): unknown;
    inject(names: readonly string[], callback: (ctx: CtxLike) => unknown): unknown;
    effect(setup: () => unknown): unknown;
}
export declare function apply(ctx: CtxLike): void;
export {};
