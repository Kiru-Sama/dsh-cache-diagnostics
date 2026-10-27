// src/rows.ts
var SURFACE_TYPES = /* @__PURE__ */ new Set([
  "system/message",
  "developer/message",
  "user/message",
  "assistant/message",
  "tool/result"
]);
var HEALTHY_HIT_RATE = 0.5;
function hashOf(value) {
  let text;
  try {
    text = JSON.stringify(value) ?? "null";
  } catch {
    text = String(value);
  }
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function applySurface(surface, event) {
  const seq = typeof event.seq === "number" ? event.seq : surface.length;
  const op = event.surfaceOp;
  if (op !== null && typeof op === "object") {
    const range = op;
    if (range.op === "replace" && typeof range.startSeq === "number" && typeof range.endSeq === "number") {
      const from = surface.indexOf(range.startSeq);
      const to = surface.indexOf(range.endSeq);
      if (from >= 0 && to >= from) surface.splice(from, to - from + 1, seq);
      else surface.push(seq);
      return;
    }
  }
  surface.push(seq);
}
function diffOf(previous, next) {
  if (previous.length === 0) return { kind: "first" };
  let common = 0;
  while (common < previous.length && common < next.length && previous[common] === next[common]) {
    common += 1;
  }
  if (common === previous.length && common === next.length) return { kind: "same" };
  if (common === previous.length) return { kind: "append", added: next.length - previous.length };
  if (common === next.length) return { kind: "trim", index: common, removed: previous.length - next.length };
  return { kind: "rewrite", index: common };
}
function firstDiffText(diff) {
  switch (diff.kind) {
    case "first":
      return "\u2014";
    case "same":
      return "\u540C";
    case "append":
      return `\u5C3E+${diff.added}`;
    case "rewrite":
      return `#${diff.index}`;
    case "trim":
      return `#${diff.index}\u2212${diff.removed}`;
  }
}
function verdictOf(row) {
  if (row.hitRate === void 0) return { verdict: "\u65E0\u7528\u91CF" };
  if (row.hitRate >= HEALTHY_HIT_RATE) return { verdict: "\u524D\u7F00\u5EF6\u7EED" };
  if (row.firstDiff.kind === "rewrite" || row.firstDiff.kind === "trim") {
    return {
      verdict: `\u524D\u7F00\u81EA ${firstDiffText(row.firstDiff)} \u65AD\u5F00`,
      explanation: "\u5386\u53F2\u5F00\u5934\u88AB\u6539\u5199\u6216\u88C1\u526A\uFF1A\u5F80\u4E0A\u67E5\u662F\u8C01\u5220\u6539\u4E86\u65E9\u671F\u6D88\u606F\uFF08\u538B\u7F29\u3001\u6309\u8F6E\u622A\u65AD\u3001\u56FE\u7247\u7701\u7565\uFF09\u3002"
    };
  }
  if (row.toolsChanged) return { verdict: "\u5DE5\u5177\u96C6\u53D8\u5316", explanation: "\u5DE5\u5177\u76EE\u5F55\u5728\u8F6E\u6B21\u95F4\u4F38\u7F29\uFF0C\u6BCF\u6B21\u53D8\u5316\u90FD\u4F1A\u65AD\u5F00\u524D\u7F00\u3002" };
  if (row.systemChanged) return { verdict: "\u7CFB\u7EDF\u63D0\u793A\u53D8\u5316", explanation: "\u7CFB\u7EDF\u63D0\u793A\u5728\u8F6E\u6B21\u95F4\u53D8\u5316\uFF0C\u6BCF\u6B21\u53D8\u5316\u90FD\u4F1A\u65AD\u5F00\u524D\u7F00\u3002" };
  if (row.firstDiff.kind === "append" || row.firstDiff.kind === "same") {
    return { verdict: "\u670D\u52A1\u7AEF\u672A\u547D\u4E2D", explanation: "\u524D\u7F00\u6CA1\u53D8\uFF0C\u662F\u670D\u52A1\u7AEF\u7F13\u5B58\u88AB\u6324\u6389\u6216\u6CA1\u547D\u4E2D\uFF1A\u6539 prompt \u6CA1\u7528\u3002" };
  }
  return { verdict: "\u4F4E\u547D\u4E2D \xB7 \u65E0\u524D\u7F00\u8BC1\u636E" };
}
function rowsFromEvents(sessionId, initialTitle, events) {
  const rows = [];
  let title = initialTitle;
  const surface = [];
  let lastRequestSurface = [];
  let open;
  let lastTools;
  let currentSystem;
  let lastHeaderSystem;
  let headerSeen = false;
  let pendingChange;
  let pendingSystemChanged = false;
  let pendingToolsChanged = false;
  let lastProvider;
  let lastModel;
  const finalize = (request, usage) => {
    const input = usage?.input ?? 0;
    const read = usage?.read ?? 0;
    const write = usage?.write ?? 0;
    const total = input + read + write;
    const hitRate = total > 0 ? read / total : void 0;
    const firstDiff = diffOf(lastRequestSurface, request.surface);
    const messageDelta = lastRequestSurface.length === 0 ? 0 : request.surface.length - lastRequestSurface.length;
    const { verdict, explanation } = verdictOf({
      hitRate,
      firstDiff,
      toolsChanged: request.toolsChanged,
      systemChanged: request.systemChanged
    });
    rows.push({
      sessionId,
      title,
      time: request.time,
      turn: request.turn,
      step: request.step,
      purpose: request.purpose,
      input,
      cacheRead: read,
      cacheWrite: write,
      output: usage?.output ?? 0,
      hitRate,
      changeKind: request.changeKind,
      systemChanged: request.systemChanged,
      toolsChanged: request.toolsChanged,
      firstDiff,
      messageDelta,
      verdict,
      explanation,
      provider: request.provider ?? lastProvider,
      model: request.model ?? lastModel,
      retry: request.retry,
      error: request.error
    });
    if (request.purpose === "assistant") lastRequestSurface = request.surface.slice();
  };
  const numberAt = (value) => typeof value === "number" && Number.isFinite(value) ? value : void 0;
  for (const raw of events) {
    const event = raw;
    const type = typeof event?.type === "string" ? event.type : "";
    const data = event.data ?? {};
    if (SURFACE_TYPES.has(type)) applySurface(surface, event);
    if (type === "session/title") {
      const next = data["title"];
      if (typeof next === "string" && next.length > 0) title = next;
    }
    if (type === "system/message") {
      currentSystem = typeof event.seq === "number" ? event.seq : currentSystem;
    }
    if (type === "request/header") {
      const header = data["header"] ?? {};
      const provider = header.config?.provider;
      const model = header.config?.model;
      if (typeof provider === "string") lastProvider = provider;
      if (typeof model === "string") lastModel = model;
      const tools = hashOf(header.tools ?? null);
      const toolsChanged = lastTools !== void 0 && tools !== lastTools;
      const systemChanged = headerSeen && currentSystem !== lastHeaderSystem;
      const changeKind = lastTools === void 0 ? "initial" : toolsChanged && systemChanged ? "system-and-tools" : toolsChanged ? "tools" : systemChanged ? "system" : void 0;
      lastTools = tools;
      lastHeaderSystem = currentSystem;
      headerSeen = true;
      if (open !== void 0) {
        open.provider = provider ?? open.provider;
        open.model = model ?? open.model;
        open.changeKind = changeKind;
        open.toolsChanged = toolsChanged;
        open.systemChanged = systemChanged;
      } else {
        pendingChange = changeKind;
        pendingToolsChanged = toolsChanged;
        pendingSystemChanged = systemChanged;
      }
      continue;
    }
    if (type === "step/start" || type === "compaction/start") {
      const request = {
        seq: typeof event.seq === "number" ? event.seq : 0,
        time: typeof event.time === "number" ? event.time : 0,
        turn: numberAt(data["turn"]) ?? 0,
        step: numberAt(data["step"]) ?? 0,
        purpose: type === "compaction/start" ? "compaction" : "assistant",
        surface: surface.slice(),
        systemChanged: pendingSystemChanged,
        toolsChanged: pendingToolsChanged,
        changeKind: pendingChange
      };
      pendingChange = void 0;
      pendingToolsChanged = false;
      pendingSystemChanged = false;
      open = request;
      continue;
    }
    if (type === "assistant/attempt" && open !== void 0) {
      open.retry = (open.retry ?? 0) + 1;
      continue;
    }
    if (type === "assistant/message" || type === "compaction/summary") {
      if (open === void 0) continue;
      const usage = data["usage"];
      const message = data["message"];
      if (message?.source !== void 0) {
        open.provider = message.source.provider ?? open.provider;
        open.model = message.source.model ?? open.model;
      }
      const error = data["error"];
      if (error?.message !== void 0) open.error = error.message;
      finalize(open, usage === void 0 ? void 0 : {
        input: usage.inputTokens,
        read: usage.cacheReadTokens,
        write: usage.cacheWriteTokens,
        output: usage.outputTokens
      });
      open = void 0;
    }
  }
  return rows;
}

// src/index.ts
var name = "dsh-cache-diagnostics";
var PATH = "/cache-diagnostics/v2";
var MAX_SESSIONS = 12;
var cache = /* @__PURE__ */ new Map();
var lastPayload;
var computing = false;
var phase = "idle";
var lastError;
function withTimeout(work, ms, label) {
  return Promise.race([
    work,
    new Promise((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
      const unrefable = timer;
      if (typeof unrefable.unref === "function") unrefable.unref();
    })
  ]);
}
function json(res, status, body) {
  const response = res;
  if (typeof response.statusCode === "number") response.statusCode = status;
  response.setHeader?.("content-type", "application/json; charset=utf-8");
  response.setHeader?.("cache-control", "no-store");
  response.end?.(JSON.stringify(body));
}
function crossSite(req) {
  const site = req.headers?.["sec-fetch-site"];
  if (typeof site === "string" && site !== "same-origin" && site !== "none") return true;
  const origin = req.headers?.["origin"];
  if (typeof origin !== "string" || origin === "") return false;
  const host = req.headers?.["host"];
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}
async function compute(query, limit) {
  const timings = {};
  const errors = [];
  let started = Date.now();
  phase = "listSessions";
  const records = await withTimeout(query.listSessions(), 4e3, "listSessions");
  timings.listSessions = Date.now() - started;
  const chosen = records.slice(0, Math.max(1, limit)).map((record) => record.header.id);
  const rows = [];
  started = Date.now();
  for (const id of chosen) {
    phase = `session ${id.slice(0, 8)}`;
    try {
      const events = await withTimeout(query.listEvents(id), 3e3, "listEvents");
      const lastSeq = events.reduce((max, event) => Math.max(max, event.seq ?? 0), 0);
      const cached = cache.get(id);
      if (cached !== void 0 && cached.lastSeq === lastSeq) {
        rows.push(...cached.rows);
        continue;
      }
      const log = await withTimeout(query.readSession(id), 5e3, "readSession");
      const computed = rowsFromEvents(id, void 0, log.events);
      const title = computed.find((row) => row.title !== void 0)?.title;
      cache.set(id, { lastSeq, title, rows: computed });
      rows.push(...computed);
    } catch (error) {
      errors.push(`${id}: ${String(error?.message ?? error)}`);
    }
  }
  timings.sessions = Date.now() - started;
  rows.sort((left, right) => right.time - left.time);
  return { rows, sessions: chosen.length, errors, timings };
}
function apply(ctx) {
  ctx.inject(["webServer"], (webCtx) => {
    const server = webCtx.get("webServer");
    if (server === void 0 || typeof server.register !== "function") {
      console.warn("[dsh-cache-diagnostics] webServer unavailable; diagnostics route not registered.");
      return;
    }
    ctx.effect(() => server.register({
      path: "/cache-diagnostics/ping",
      handler: (_req, res) => {
        json(res, 200, { ok: true, ping: true });
      }
    }));
    ctx.effect(() => server.register({
      path: PATH,
      handler: (rawReq, res) => {
        void (async () => {
          const req = rawReq;
          if (crossSite(req)) {
            json(res, 403, { ok: false, error: "cross-site" });
            return;
          }
          if ((req.method ?? "GET").toUpperCase() !== "GET") {
            json(res, 405, { ok: false, error: "get-only" });
            return;
          }
          const url = new URL(req.url ?? PATH, "http://localhost");
          const query = ctx.get("sessionQuery");
          if (url.searchParams.get("probe") !== null) {
            json(res, 200, {
              ok: true,
              probe: true,
              sessionQuery: query !== void 0,
              webServer: true
            });
            return;
          }
          if (query === void 0 || typeof query.listSessions !== "function") {
            json(res, 503, { ok: false, error: "sessionQuery unavailable" });
            return;
          }
          const limitParam = Number(url.searchParams.get("limit"));
          const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_SESSIONS) : MAX_SESSIONS;
          if (!computing) {
            computing = true;
            phase = "starting";
            void (async () => {
              try {
                const computed = await compute(query, limit);
                lastPayload = {
                  ok: true,
                  rows: computed.rows,
                  sessions: computed.sessions,
                  errors: computed.errors,
                  timings: computed.timings
                };
                lastError = void 0;
                phase = "done";
              } catch (error) {
                lastError = String(error?.message ?? error);
                phase = "error";
              } finally {
                computing = false;
              }
            })();
          }
          json(res, 200, {
            ok: true,
            rows: lastPayload?.rows ?? [],
            sessions: lastPayload?.sessions ?? 0,
            timings: lastPayload?.timings,
            pending: computing,
            phase,
            error: lastError
          });
        })();
      }
    }));
  });
}
export {
  apply,
  name
};
