window.__ModuleLoader__.load({
  id: "dsh-cache-diagnostics",
  factory(require) {
    const module = { exports: {} }
    const exports = module.exports
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/icon.tsx
var import_react2 = require("react");

// src/client/api.ts
var import_react = require("react");
var ENDPOINT = "/cache-diagnostics/v2";
var POLL_MS = 4e3;
var PENDING_MS = 8e3;
var HIDDEN_MS = 3e4;
var EMPTY = { rows: [] };
var state = EMPTY;
var listeners = /* @__PURE__ */ new Set();
var started = false;
function publish(next) {
  state = next;
  for (const listener of listeners) listener();
}
async function tick(signal) {
  try {
    const response = await fetch(ENDPOINT, { signal, headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.ok !== true || !Array.isArray(payload.rows)) {
      throw new Error(payload.error ?? "bad payload");
    }
    publish({
      rows: payload.rows,
      pending: payload.pending === true,
      phase: payload.phase,
      error: payload.error,
      updatedAt: Date.now()
    });
  } catch (error) {
    if (signal.aborted) return;
    publish({ rows: state.rows, error: String(error?.message ?? error), updatedAt: Date.now() });
  }
}
function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  const controller = new AbortController();
  const loop = async () => {
    if (document.hidden) {
      window.setTimeout(() => void loop(), HIDDEN_MS);
      return;
    }
    await tick(controller.signal);
    const delay = state.pending === true ? PENDING_MS : POLL_MS;
    window.setTimeout(() => void loop(), delay);
  };
  void loop();
}
function refreshRows() {
  void tick(new AbortController().signal);
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function useRows() {
  (0, import_react.useEffect)(start, []);
  return (0, import_react.useSyncExternalStore)(subscribe, () => state, () => EMPTY);
}

// src/client/icon.tsx
function CacheDiagnosticsIcon({
  size = 20,
  active
}) {
  const { rows } = useRows();
  const latest = rows[0];
  const rate = latest?.hitRate;
  const known = rate !== void 0;
  const low = known && rate < 0.5;
  const dot = !known ? "var(--dsw-alias-border-l2)" : low ? "var(--dsw-alias-state-warn-label)" : "var(--dsw-alias-state-success-primary)";
  const color = active === true ? "var(--dsw-alias-label-primary)" : "var(--dsw-alias-label-secondary)";
  const title = latest === void 0 ? "\u7F13\u5B58\u8BCA\u65AD" : `\u7F13\u5B58\u8BCA\u65AD \xB7 \u6700\u8FD1\u4E00\u6B21\u547D\u4E2D ${rate === void 0 ? "\u672A\u77E5" : `${(rate * 1e3).toFixed(1)}\u2030`}`;
  return (0, import_react2.createElement)(
    "span",
    {
      title,
      style: { position: "relative", display: "inline-flex", width: size, height: size, color }
    },
    (0, import_react2.createElement)(
      "svg",
      {
        viewBox: "0 0 24 24",
        width: size,
        height: size,
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.7,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true,
        focusable: false
      },
      (0, import_react2.createElement)("path", { d: "M12 3.2 3.8 7.4 12 11.6l8.2-4.2L12 3.2Z" }),
      (0, import_react2.createElement)("path", { d: "M3.8 12 12 16.2 20.2 12" }),
      (0, import_react2.createElement)("path", { d: "M3.8 16.5 12 20.7l8.2-4.2" })
    ),
    (0, import_react2.createElement)("i", {
      style: {
        position: "absolute",
        right: -1,
        bottom: -1,
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: dot,
        boxShadow: "0 0 0 2px var(--dsw-alias-bg-layer-1)"
      }
    })
  );
}

// src/client/page.tsx
var import_react3 = require("react");
var STYLE_ID = "dsh-cache-diagnostics-page";
var CSS = `
.cdx-page {
  height: 100%; min-height: 0; overflow: auto;
  padding: 28px 32px 40px; color: var(--dsw-alias-label-primary);
  font-size: 13px; line-height: 1.6;
}
.cdx-inner { max-width: 1360px; margin: 0 auto; }
.cdx-table-wrap { overflow-x: auto; }
.cdx-title { margin: 0; font-size: 18px; line-height: 26px; font-weight: 600; }
.cdx-sub { margin: 4px 0 0; color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.cdx-card {
  margin-top: 18px; padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
}
.cdx-card-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 12px; margin-bottom: 4px;
  font-size: 11px; color: var(--dsw-alias-label-tertiary);
}
.cdx-rate { font-size: 28px; line-height: 32px; font-weight: 600; font-variant-numeric: tabular-nums; }
.cdx-rate.is-low { color: var(--dsw-alias-state-warn-label); }
.cdx-verdict { margin-left: 10px; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.cdx-meta {
  margin-top: 4px; font-size: 12px; color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
}
.cdx-explain {
  margin-top: 8px; padding: 8px 10px; border-radius: 8px;
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-state-warn-label); font-size: 12px;
}
.cdx-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin: 22px 0 4px;
}
.cdx-count {
  margin: 0 0 10px; font-size: 12px; line-height: 1.6;
  color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums;
}
.cdx-units {
  display: inline-flex; align-items: center; gap: 1px; padding: 1px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px;
}
.cdx-unit {
  border: none; background: transparent; cursor: pointer;
  padding: 2px 9px; border-radius: 999px;
  font: inherit; font-size: 11px; line-height: 15px;
  color: var(--dsw-alias-label-tertiary);
  transition: background .12s ease, color .12s ease;
}
.cdx-unit:hover { color: var(--dsw-alias-label-primary); }
.cdx-unit.is-active {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary); font-weight: 500;
}
.cdx-select {
  max-width: 260px; padding: 2px 6px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 11px; line-height: 18px;
}
.cdx-select:hover { color: var(--dsw-alias-label-primary); }
.cdx-refresh {
  padding: 2px 10px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l1); background: transparent;
  color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11px; line-height: 18px;
}
.cdx-refresh:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.cdx-table { width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
.cdx-table th {
  position: sticky; top: 0; z-index: 1;
  padding: 6px 8px; text-align: left; white-space: nowrap;
  font-weight: 500; font-size: 11px; color: var(--dsw-alias-label-tertiary);
  background: var(--dsw-alias-bg-layer-1);
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.cdx-table td { padding: 6px 8px; white-space: nowrap; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.cdx-table tbody tr:hover { background: var(--dsw-alias-interactive-bg-hover); }
.cdx-num { text-align: right; }
.cdx-table th.cdx-num { text-align: right; }
.cdx-session { max-width: 190px; overflow: hidden; text-overflow: ellipsis; }
.cdx-low { color: var(--dsw-alias-state-warn-label); font-weight: 600; }
.cdx-mark { color: var(--dsw-alias-label-tertiary); }
.cdx-mark.is-changed { color: var(--dsw-alias-state-warn-label); font-weight: 600; }
.cdx-verdict-cell { color: var(--dsw-alias-label-secondary); }
.cdx-empty {
  margin-top: 36px; padding: 28px; text-align: center;
  border: 1px dashed var(--dsw-alias-border-l2); border-radius: 12px;
  color: var(--dsw-alias-label-tertiary); font-size: 13px;
}
.cdx-legend { margin-top: 18px; font-size: 11px; line-height: 1.7; color: var(--dsw-alias-label-tertiary); }
.cdx-hint { margin-top: 8px; font-size: 11px; color: var(--dsw-alias-label-tertiary); opacity: .75; }
`;
function ensureStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
function clockOf(time) {
  if (time <= 0) return "\u2014";
  const date = new Date(time);
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function tokens(value) {
  if (value === 0) return "0";
  if (value < 1e3) return String(value);
  if (value < 1e6) return `${(value / 1e3).toFixed(value < 1e4 ? 1 : 0)}k`;
  return `${(value / 1e6).toFixed(1)}M`;
}
var UNIT_KEY = "dsh-cache-diagnostics:unit";
function readUnit() {
  try {
    return globalThis.localStorage?.getItem(UNIT_KEY) === "permille" ? "permille" : "percent";
  } catch {
    return "percent";
  }
}
function formatRate(rate, unit) {
  if (rate === void 0) return "\u2014";
  return unit === "permille" ? `${(rate * 1e3).toFixed(1)}\u2030` : `${(rate * 100).toFixed(1)}%`;
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
function mark(changed) {
  return (0, import_react3.createElement)("span", { className: `cdx-mark${changed ? " is-changed" : ""}` }, changed ? "\u53D8" : "\u540C");
}
function sessionOf(row) {
  if (typeof row.title === "string" && row.title.length > 0) return row.title;
  return row.sessionId.length > 12 ? `${row.sessionId.slice(0, 10)}\u2026` : row.sessionId;
}
function CacheDiagnosticsPage() {
  ensureStyles();
  const { rows, error, pending, phase, updatedAt } = useRows();
  const [unit, setUnit] = (0, import_react3.useState)(readUnit);
  (0, import_react3.useEffect)(() => {
    try {
      globalThis.localStorage?.setItem(UNIT_KEY, unit);
    } catch {
    }
  }, [unit]);
  const latest = rows.length === 0 ? void 0 : rows[0];
  const totals = (0, import_react3.useMemo)(() => {
    let input = 0;
    let cacheRead = 0;
    let cacheWrite = 0;
    for (const row of rows) {
      input += row.input;
      cacheRead += row.cacheRead;
      cacheWrite += row.cacheWrite;
    }
    const total = input + cacheRead + cacheWrite;
    return { input, cacheRead, cacheWrite, hitRate: total > 0 ? cacheRead / total : void 0 };
  }, [rows]);
  const sessions = (0, import_react3.useMemo)(() => {
    const byId = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const entry = byId.get(row.sessionId);
      if (entry === void 0) {
        byId.set(row.sessionId, { id: row.sessionId, title: sessionOf(row), count: 1, latest: row.time });
      } else {
        entry.count += 1;
        if (row.time > entry.latest) entry.latest = row.time;
      }
    }
    return [...byId.values()].sort((left, right) => right.latest - left.latest);
  }, [rows]);
  const [scope, setScope] = (0, import_react3.useState)("all");
  const visible = (0, import_react3.useMemo)(() => {
    if (scope !== "all") {
      return rows.filter((row) => row.sessionId === scope).slice(0, 300);
    }
    const seen = /* @__PURE__ */ new Map();
    const merged = [];
    for (const row of rows) {
      const count = seen.get(row.sessionId) ?? 0;
      if (count >= 40) continue;
      seen.set(row.sessionId, count + 1);
      merged.push(row);
      if (merged.length >= 600) break;
    }
    return merged;
  }, [rows, scope]);
  return (0, import_react3.createElement)(
    "div",
    { className: "cdx-page" },
    (0, import_react3.createElement)(
      "div",
      { className: "cdx-inner" },
      (0, import_react3.createElement)("h1", { className: "cdx-title" }, "\u7F13\u5B58\u8BCA\u65AD"),
      (0, import_react3.createElement)(
        "p",
        { className: "cdx-sub" },
        "\u6BCF\u6B21\u6A21\u578B\u8BF7\u6C42\u4E00\u884C\uFF1A\u547D\u4E2D\u7387\uFF08\u5343\u5206\u6BD4\uFF09\u3001\u7CFB\u7EDF/\u5DE5\u5177\u662F\u5426\u53D8\u5316\u3001\u7F13\u5B58\u524D\u7F00\u5728\u54EA\u4E00\u6761\u6D88\u606F\u65AD\u5F00\u3002\u53EA\u8BFB Host \u4FA7\u4F1A\u8BDD\u65E5\u5FD7\uFF0C\u81EA\u52A8\u5237\u65B0\u3002"
      ),
      latest === void 0 ? (0, import_react3.createElement)(
        "div",
        { className: "cdx-empty" },
        error === void 0 ? pending === true ? `\u6B63\u5728\u8BFB\u53D6\u4F1A\u8BDD\u65E5\u5FD7\uFF08${phase ?? "\u2026"}\uFF09\u2026` : "\u8FD8\u6CA1\u6709\u8BB0\u5F55\u5230\u8BF7\u6C42\u3002\u53D1\u51FA\u4E0B\u4E00\u6761\u6D88\u606F\u540E\uFF0C\u8FD9\u91CC\u4F1A\u81EA\u52A8\u51FA\u73B0\u3002" : `\u8BFB\u53D6\u5931\u8D25\uFF1A${error}`,
        error === void 0 ? null : (0, import_react3.createElement)("div", { className: "cdx-hint" }, "\u63A5\u53E3\uFF1A/cache-diagnostics/v2")
      ) : (0, import_react3.createElement)(LatestCard, { row: latest, unit }),
      latest === void 0 ? null : (0, import_react3.createElement)(
        "div",
        { className: "cdx-toolbar" },
        (0, import_react3.createElement)(
          "span",
          { style: { display: "inline-flex", alignItems: "center", gap: 8 } },
          (0, import_react3.createElement)("strong", { style: { fontSize: 13, fontWeight: 600 } }, "\u5168\u90E8\u8BF7\u6C42"),
          (0, import_react3.createElement)(
            "select",
            {
              className: "cdx-select",
              value: scope,
              title: "\u6309\u4F1A\u8BDD\u7B5B\u9009",
              onChange: (event) => setScope(event.target.value)
            },
            (0, import_react3.createElement)("option", { value: "all" }, `\u5168\u90E8\u4F1A\u8BDD\uFF08${sessions.length}\uFF09`),
            ...sessions.map(
              (session) => (0, import_react3.createElement)("option", { value: session.id }, `${session.title}\uFF08${session.count}\uFF09`)
            )
          ),
          (0, import_react3.createElement)(
            "button",
            { type: "button", className: "cdx-refresh", onClick: refreshRows, title: "\u7ACB\u5373\u5237\u65B0" },
            "\u5237\u65B0"
          )
        ),
        (0, import_react3.createElement)(
          "span",
          { className: "cdx-units", title: "\u547D\u4E2D\u7387\u663E\u793A\u5355\u4F4D" },
          (0, import_react3.createElement)("button", {
            type: "button",
            className: `cdx-unit${unit === "percent" ? " is-active" : ""}`,
            onClick: () => setUnit("percent")
          }, "\u767E\u5206"),
          (0, import_react3.createElement)("button", {
            type: "button",
            className: `cdx-unit${unit === "permille" ? " is-active" : ""}`,
            onClick: () => setUnit("permille")
          }, "\u5343\u5206")
        )
      ),
      latest === void 0 ? null : (0, import_react3.createElement)(
        "p",
        { className: "cdx-count" },
        `${rows.length} \u6B21\u8BF7\u6C42${rows.length > visible.length ? `\uFF08\u663E\u793A ${visible.length}\uFF09` : ""} \xB7 \u5408\u8BA1\u547D\u4E2D ${formatRate(totals.hitRate, unit)} \xB7 \u672A\u7F13\u5B58 ${tokens(totals.input)} / \u7F13\u5B58\u8BFB ${tokens(totals.cacheRead)} / \u7F13\u5B58\u5199 ${tokens(totals.cacheWrite)}` + (updatedAt === void 0 ? "" : ` \xB7 \u66F4\u65B0\u4E8E ${clockOf(updatedAt)}`) + (pending === true ? " \xB7 \u540E\u53F0\u8BA1\u7B97\u4E2D" : "")
      ),
      latest === void 0 ? null : (0, import_react3.createElement)(
        "div",
        { className: "cdx-table-wrap" },
        (0, import_react3.createElement)(
          "table",
          { className: "cdx-table" },
          (0, import_react3.createElement)(
            "thead",
            null,
            (0, import_react3.createElement)(
              "tr",
              null,
              (0, import_react3.createElement)("th", null, "\u65F6\u95F4"),
              (0, import_react3.createElement)("th", null, "\u4F1A\u8BDD"),
              (0, import_react3.createElement)("th", null, "\u8F6E\xB7\u6B65"),
              (0, import_react3.createElement)("th", { className: "cdx-num" }, "\u547D\u4E2D"),
              (0, import_react3.createElement)("th", { className: "cdx-num" }, "\u672A\u7F13\u5B58"),
              (0, import_react3.createElement)("th", { className: "cdx-num" }, "\u7F13\u5B58\u8BFB"),
              (0, import_react3.createElement)("th", { className: "cdx-num" }, "\u7F13\u5B58\u5199"),
              (0, import_react3.createElement)("th", { className: "cdx-num" }, "\u8F93\u51FA"),
              (0, import_react3.createElement)("th", null, "\u7CFB\u7EDF"),
              (0, import_react3.createElement)("th", null, "\u9996\u6761"),
              (0, import_react3.createElement)("th", null, "\u5DE5\u5177"),
              (0, import_react3.createElement)("th", null, "\u9996\u5DEE"),
              (0, import_react3.createElement)("th", { className: "cdx-num" }, "\u0394"),
              (0, import_react3.createElement)("th", null, "\u5224\u5B9A")
            )
          ),
          (0, import_react3.createElement)(
            "tbody",
            null,
            ...visible.map((row) => (0, import_react3.createElement)(Row, { key: `${row.sessionId}:${row.time}:${row.turn}:${row.step}`, row, unit }))
          )
        )
      ),
      (0, import_react3.createElement)(
        "p",
        { className: "cdx-legend" },
        "\u547D\u4E2D\u7387\u6309 DSH \u53E3\u5F84\uFF1A\u7F13\u5B58\u8BFB \xF7\uFF08\u672A\u7F13\u5B58\u8F93\u5165\uFF0B\u7F13\u5B58\u8BFB\uFF0B\u7F13\u5B58\u5199\uFF09\uFF0C\u4EE5\u5343\u5206\u6BD4\u663E\u793A\u3002\u300C\u9996\u5DEE\u300D\uFF1D\u4E0E\u540C\u4F1A\u8BDD\u4E0A\u4E00\u6761\u8BF7\u6C42\u76F8\u6BD4\u7B2C\u4E00\u5904\u4E0D\u540C\u7684\u6D88\u606F\u4F4D\u7F6E\uFF1A\u5C3E+N \u53EA\u5728\u5C3E\u90E8\u8FFD\u52A0\uFF08\u524D\u7F00\u6CA1\u53D8\uFF09\uFF1B#k \u8868\u793A\u4ECE\u7B2C k \u6761\u8D77\u65AD\u5F00\uFF1B#k\u2212N \u8868\u793A\u540C\u65F6\u53D8\u77ED\u3002\u300C\u9996\u6761\u300D\u6307\u4E0A\u4E0B\u6587\u7B2C\u4E00\u6761\u6D88\u606F\u672C\u8EAB\u53D8\u4E86\u3002\u60AC\u505C\u4EFB\u610F\u4E00\u884C\u53EF\u770B\u6A21\u578B\u4E0E\u91CD\u8BD5\u3002"
      )
    )
  );
}
function LatestCard({ row, unit }) {
  const low = row.hitRate !== void 0 && row.hitRate < 0.5;
  const route = row.provider !== void 0 || row.model !== void 0 ? `${row.provider ?? "?"} / ${row.model ?? "?"}` : "";
  return (0, import_react3.createElement)(
    "section",
    { className: "cdx-card" },
    (0, import_react3.createElement)(
      "div",
      { className: "cdx-card-head" },
      (0, import_react3.createElement)("span", null, "\u6700\u8FD1\u4E00\u6761"),
      (0, import_react3.createElement)("span", null, `${clockOf(row.time)} \xB7 ${sessionOf(row)} \xB7 \u8F6E${row.turn} \u6B65${row.step}`)
    ),
    (0, import_react3.createElement)(
      "div",
      null,
      (0, import_react3.createElement)("span", { className: `cdx-rate${low ? " is-low" : ""}` }, formatRate(row.hitRate, unit)),
      (0, import_react3.createElement)("span", { className: "cdx-verdict" }, row.verdict)
    ),
    (0, import_react3.createElement)(
      "div",
      { className: "cdx-meta" },
      `\u672A\u7F13\u5B58 ${tokens(row.input)} \xB7 \u7F13\u5B58\u8BFB ${tokens(row.cacheRead)} \xB7 \u7F13\u5B58\u5199 ${tokens(row.cacheWrite)} \xB7 \u8F93\u51FA ${tokens(row.output)} \xB7 \u9996\u5DEE ${firstDiffText(row.firstDiff)} \xB7 \u0394 ${row.messageDelta >= 0 ? `+${row.messageDelta}` : row.messageDelta}` + (route === "" ? "" : ` \xB7 ${route}`)
    ),
    low && row.explanation !== void 0 ? (0, import_react3.createElement)("div", { className: "cdx-explain" }, row.explanation) : null
  );
}
function Row({ row, unit }) {
  const low = row.hitRate !== void 0 && row.hitRate < 0.5;
  const tooltip = [
    `${sessionOf(row)} \xB7 \u8F6E${row.turn} \u6B65${row.step}`,
    `\u672A\u7F13\u5B58 ${row.input} \xB7 \u7F13\u5B58\u8BFB ${row.cacheRead} \xB7 \u7F13\u5B58\u5199 ${row.cacheWrite} \xB7 \u8F93\u51FA ${row.output}`,
    row.provider !== void 0 || row.model !== void 0 ? `${row.provider ?? "?"} / ${row.model ?? "?"}` : "",
    row.changeKind === void 0 ? "" : `\u63D0\u793A\u8BCD\u53D8\u5316 ${row.changeKind}`,
    row.retry === void 0 ? "" : `\u91CD\u8BD5 #${row.retry}`,
    row.error === void 0 ? "" : `\u9519\u8BEF ${row.error}`,
    row.explanation ?? ""
  ].filter((line) => line !== "").join("\n");
  const firstMessageChanged = row.firstDiff.kind === "rewrite" && row.firstDiff.index === 0;
  return (0, import_react3.createElement)(
    "tr",
    { title: tooltip },
    (0, import_react3.createElement)("td", null, clockOf(row.time)),
    (0, import_react3.createElement)("td", { className: "cdx-session" }, sessionOf(row)),
    (0, import_react3.createElement)("td", null, `${row.turn}\xB7${row.step}`),
    (0, import_react3.createElement)("td", { className: `cdx-num${low ? " cdx-low" : ""}` }, formatRate(row.hitRate, unit)),
    (0, import_react3.createElement)("td", { className: "cdx-num" }, tokens(row.input)),
    (0, import_react3.createElement)("td", { className: "cdx-num" }, tokens(row.cacheRead)),
    (0, import_react3.createElement)("td", { className: "cdx-num" }, tokens(row.cacheWrite)),
    (0, import_react3.createElement)("td", { className: "cdx-num" }, tokens(row.output)),
    (0, import_react3.createElement)("td", null, mark(row.systemChanged)),
    (0, import_react3.createElement)("td", null, mark(firstMessageChanged)),
    (0, import_react3.createElement)("td", null, mark(row.toolsChanged)),
    (0, import_react3.createElement)("td", null, firstDiffText(row.firstDiff)),
    (0, import_react3.createElement)("td", { className: "cdx-num" }, row.messageDelta > 0 ? `+${row.messageDelta}` : String(row.messageDelta)),
    (0, import_react3.createElement)("td", { className: `cdx-verdict-cell${low ? " cdx-low" : ""}` }, row.verdict)
  );
}

// src/client/index.tsx
var inject = ["slots"];
var PANEL_ID = "dsh-cache-diagnostics";
function apply(ctx) {
  try {
    ctx.slots.inject("sidebar.panellist", () => ctx.slots.register(
      { name: "sidebar.panellist", id: PANEL_ID, order: 20, label: () => "\u7F13\u5B58\u8BCA\u65AD" },
      CacheDiagnosticsIcon
    ));
    ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: PANEL_ID }, CacheDiagnosticsPage));
  } catch (error) {
    console.error("[dsh-cache-diagnostics] apply failed; diagnostics disabled for this page.", error);
  }
}
    return module.exports
  },
})
