/**
 * azure-prism / lib/ui-html.mjs
 * 生成单文件内联 UI（HTML + CSS + JS，无外部 CDN）。
 * 通过 window.parent.postMessage 以 JSON-RPC 2.0 调用 azure_prism_api。
 */

const SNAPSHOT_TOKEN = "__AZURE_PRISM_SNAPSHOT__";

const PAGE_TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>苍蓝棱镜 · Azure Prism</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #121826;
    --bg-grad-a: rgba(59, 130, 246, 0.16);
    --bg-grad-b: rgba(124, 58, 237, 0.09);
    --bg-grad-c: rgba(16, 185, 129, 0.06);
    --panel: rgba(21, 28, 45, 0.90);
    --panel-elev: rgba(255, 255, 255, 0.07);
    --panel-solid: #172033;
    --border: rgba(96, 165, 250, 0.24);
    --border-strong: rgba(59, 130, 246, 0.68);
    --text: #f1f5f9;
    --text-dim: #cbd5e1;
    --text-faint: #94a3b8;
    --accent: #3b82f6;
    --accent-2: #8b5cf6;
    --accent-soft: rgba(59, 130, 246, 0.18);
    --accent-strong: #bfdbfe;
    --thinking: #3b82f6;
    --checkpoint: #10b981;
    --user: #38bdf8;
    --prism-line: linear-gradient(90deg, transparent 0%, rgba(37,99,235,.78) 25%, rgba(59,130,246,.82) 55%, rgba(124,58,237,.65) 82%, transparent 100%);
    --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
    --shadow: 0 10px 28px rgba(0, 0, 0, 0.36);
    --mono: ui-monospace, SFMono-Regular, "JetBrains Mono", Consolas, "Liberation Mono", monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  html[data-theme="light"] {
    color-scheme: light;
    --bg: #f4f7fc;
    --bg-grad-a: rgba(59, 130, 246, 0.13);
    --bg-grad-b: rgba(124, 58, 237, 0.08);
    --bg-grad-c: rgba(16, 185, 129, 0.06);
    --panel: rgba(255, 255, 255, 0.94);
    --panel-elev: rgba(15, 23, 42, 0.045);
    --panel-solid: #ffffff;
    --border: rgba(59, 130, 246, 0.22);
    --border-strong: rgba(37, 99, 235, 0.56);
    --text: #0f172a;
    --text-dim: #334155;
    --text-faint: #64748b;
    --accent: #2563eb;
    --accent-2: #7c3aed;
    --accent-soft: rgba(59, 130, 246, 0.12);
    --accent-strong: #1d4ed8;
    --thinking: #2563eb;
    --checkpoint: #059669;
    --user: #0284c7;
    --prism-line: linear-gradient(90deg, transparent 0%, rgba(37,99,235,.65) 25%, rgba(59,130,246,.68) 55%, rgba(124,58,237,.52) 82%, transparent 100%);
    --shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0;
    font-family: var(--sans);
    color: var(--text);
    background:
      radial-gradient(980px 460px at 86% -14%, var(--bg-grad-a), transparent 62%),
      radial-gradient(760px 460px at 10% -8%, var(--bg-grad-b), transparent 58%),
      radial-gradient(640px 420px at 50% 108%, var(--bg-grad-c), transparent 62%),
      var(--bg);
    font-size: 13px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  .shell { display: flex; flex-direction: column; height: 100%; position: relative; }
  .shell::before {
    content: ""; position: fixed; top: 0; left: 0; right: 0; height: 2px; z-index: 20;
    background: var(--prism-line); pointer-events: none;
  }

  header.topbar {
    position: sticky; top: 0; z-index: 8;
    display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
    padding: 10px 14px;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
    backdrop-filter: blur(18px) saturate(185%);
    -webkit-backdrop-filter: blur(18px) saturate(185%);
  }
  .brand { display: flex; align-items: center; gap: 9px; margin-right: 4px; }
  .brand-mark {
    width: 26px; height: 26px; border-radius: 8px;
    display: grid; place-items: center;
    background: linear-gradient(145deg, rgba(56,189,248,.24), rgba(129,140,248,.22));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 0 0 1px var(--border-strong), 0 4px 14px rgba(56, 189, 248, 0.25);
    flex: 0 0 auto;
  }
  .brand-mark svg { width: 16px; height: 16px; display: block; }
  .brand-title {
    font-size: 13.5px; font-weight: 700; letter-spacing: 0.03em; white-space: nowrap;
    background: linear-gradient(95deg, var(--text) 15%, var(--accent-strong) 85%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  html[data-theme="light"] .brand-title {
    background: linear-gradient(95deg, #0f2438 10%, #0284c7 85%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .brand-sub { font-size: 10.5px; color: var(--text-faint); letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }

  .spacer { flex: 1 1 auto; }
  .controls { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }

  button, select, input.search-input {
    font-family: inherit; font-size: 12px; color: var(--text);
    background: var(--panel-elev);
    border: 1px solid rgba(255, 255, 255, 0.17);
    border-radius: 10px;
    padding: 6px 11px;
    transition: border-color .16s var(--ease), background .16s var(--ease), color .16s var(--ease), transform .13s var(--ease), box-shadow .16s var(--ease);
  }
  html[data-theme="light"] button, html[data-theme="light"] select, html[data-theme="light"] input.search-input {
    border-color: rgba(15, 23, 42, 0.15);
  }
  button, select { cursor: pointer; }
  button:hover, select:hover, input.search-input:hover {
    border-color: var(--border-strong);
    background: var(--accent-soft);
  }
  button:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.20); }
  .card:hover { border-color: var(--border-strong); transform: translateY(-1px); }
  .card-head:hover { background: linear-gradient(180deg, rgba(59,130,246,.14), rgba(59,130,246,.03)); }
  input.search-input:focus, select:focus {
    outline: none; border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft);
  }
  button:active { transform: translateY(1px); }
  button:disabled { opacity: .48; cursor: not-allowed; transform: none; }
  button.primary {
    background: linear-gradient(135deg, #2563eb 0%, #3b82f6 58%, #7c3aed 100%);
    border-color: transparent; color: #ffffff; font-weight: 600;
    box-shadow: 0 2px 10px rgba(37, 99, 235, 0.30);
  }
  button.primary:hover {
    filter: brightness(1.08);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.44);
  }
  button.on {
    background: var(--accent-soft); border-color: var(--border-strong); color: var(--accent-strong);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.12);
  }
  select { max-width: 280px; min-width: 140px; }
  select option { background: var(--panel-solid); color: var(--text); }

  .filter-bar {
    display: flex; flex-wrap: wrap; gap: 7px; align-items: center;
    padding: 8px 14px;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
    backdrop-filter: blur(12px) saturate(150%);
  }
  .filter-bar select { flex: 1 1 200px; max-width: 340px; }
  .search-wrap { position: relative; flex: 1 1 150px; min-width: 130px; max-width: 260px; }
  .search-input { width: 100%; padding: 5px 24px 5px 10px; }
  .search-clear {
    position: absolute; right: 5px; top: 50%; transform: translateY(-50%);
    border: none; background: transparent; color: var(--text-faint);
    padding: 1px 5px; font-size: 13px; border-radius: 6px; display: none;
  }
  .search-clear.visible { display: inline-block; }
  .search-clear:hover { color: var(--text); background: var(--accent-soft); }

  .seg-group {
    display: inline-flex; align-items: center; gap: 2px;
    padding: 2px; border-radius: 9px;
    background: var(--panel-solid); border: 1px solid var(--border);
  }
  .seg-btn {
    border: none; background: transparent; color: var(--text-dim);
    padding: 3px 8px; font-size: 11.5px; border-radius: 7px;
  }
  .seg-btn:hover { color: var(--text); }
  .seg-btn.active {
    background: var(--accent-soft); color: var(--accent-strong);
    box-shadow: inset 0 0 0 1px var(--border-strong);
  }

  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 11px; font-family: var(--mono);
    padding: 3px 9px; border-radius: 999px;
    border: 1px solid var(--border); background: var(--accent-soft);
    color: var(--accent-strong); max-width: 100%;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .chip.dim { background: transparent; color: var(--text-faint); border-color: var(--border); }
  .chip .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: 0 0 auto; }
  .chip.bad { color: #fca5a5; border-color: rgba(248, 113, 113, .38); background: rgba(248, 113, 113, .10); }
  html[data-theme="light"] .chip.bad { color: #b91c1c; }

  .meta-bar {
    display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
    padding: 6px 14px; border-bottom: 1px solid var(--border);
    background: linear-gradient(180deg, rgba(13, 22, 38, 0.35), transparent);
    font-size: 11px; color: var(--text-faint);
  }
  html[data-theme="light"] .meta-bar { background: linear-gradient(180deg, rgba(255,255,255,.55), transparent); }
  .meta-bar b { color: var(--text-dim); font-weight: 600; font-family: var(--mono); }

  main.scroll { flex: 1 1 auto; overflow-y: auto; overflow-x: hidden; padding: 12px 14px 44px; }
  :root { color-scheme: dark; }
  html[data-theme="light"] { color-scheme: light; }
  ::-webkit-scrollbar { width: 7px; height: 7px; }
  ::-webkit-scrollbar-track, ::-webkit-scrollbar-corner { background: transparent; }
  ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
  ::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.24); border-radius: 999px; border: 2px solid transparent; background-clip: content-box;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(59, 130, 246, 0.60); border: 1px solid transparent; background-clip: content-box;
  }
  ::-webkit-scrollbar-thumb:active {
    background: rgba(59, 130, 246, 0.85); border: 1px solid transparent; background-clip: content-box;
  }
  html[data-theme="light"] ::-webkit-scrollbar-thumb {
    background: rgba(100, 116, 139, 0.26); border: 2px solid transparent; background-clip: content-box;
  }
  html[data-theme="light"] ::-webkit-scrollbar-thumb:hover {
    background: rgba(37, 99, 235, 0.52); border: 1px solid transparent; background-clip: content-box;
  }

  .empty {
    margin: 42px auto; max-width: 460px; text-align: center;
    color: var(--text-faint); font-size: 12px; line-height: 1.8;
    padding: 26px 22px; border: 1px dashed var(--border-strong); border-radius: 16px;
    background: var(--panel); box-shadow: var(--shadow);
  }
  .empty strong { color: var(--text); display: block; margin-bottom: 6px; font-size: 13.5px; }

  .card {
    position: relative;
    margin: 0 0 10px 0;
    border: 1px solid var(--border);
    border-radius: 13px;
    background: var(--panel);
    box-shadow: var(--shadow);
    overflow: hidden;
    transition: border-color .18s var(--ease), transform .18s var(--ease), box-shadow .18s var(--ease);
  }
  .card:hover { border-color: var(--border-strong); }
  .card::before {
    content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: linear-gradient(180deg, var(--thinking), var(--accent-2)); opacity: .88;
  }
  .card.user::before { background: linear-gradient(180deg, var(--user), rgba(167,139,250,.45)); opacity: .82; }
  .card.checkpoint::before { background: linear-gradient(180deg, var(--checkpoint), rgba(52,211,153,.45)); }

  .card-head {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    padding: 9px 12px 9px 15px; cursor: pointer; user-select: none;
    background: linear-gradient(180deg, rgba(56,189,248,.07), transparent 92%);
    border-bottom: 1px solid transparent;
    transition: background .16s var(--ease);
  }
  .card.user .card-head { background: linear-gradient(180deg, rgba(167,139,250,.08), transparent 92%); }
  .card.checkpoint .card-head { background: linear-gradient(180deg, rgba(52,211,153,.08), transparent 92%); }
  .card.open .card-head { border-bottom-color: var(--border); }
  .tag {
    font-family: var(--mono); font-size: 10px; font-weight: 600; letter-spacing: .05em;
    padding: 2px 7px; border-radius: 6px;
    border: 1px solid var(--border-strong); color: var(--accent-strong);
    background: var(--accent-soft); white-space: nowrap;
  }
  .card.user .tag { color: var(--user); border-color: rgba(167, 139, 250, .42); background: rgba(167, 139, 250, .12); }
  .card.checkpoint .tag { color: var(--checkpoint); border-color: rgba(52, 211, 153, .45); background: rgba(52, 211, 153, .12); }
  html[data-theme="light"] .card.checkpoint .tag { background: rgba(5, 150, 105, .10); }
  html[data-theme="light"] .card.user .tag { background: rgba(124, 58, 237, .09); }

  .head-index { font-family: var(--mono); font-size: 10.5px; color: var(--text-faint); }
  .head-preview {
    flex: 1 1 160px; min-width: 0; color: var(--text-dim); font-size: 11.5px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .card.open .head-preview { display: none; }
  .head-tools { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; margin-left: auto; }
  .badge-mini {
    font-family: var(--mono); font-size: 10px; padding: 2px 7px; border-radius: 999px;
    border: 1px solid var(--border); color: var(--text-dim); background: var(--panel-solid); cursor: pointer;
  }
  .badge-mini:hover { color: var(--accent-strong); border-color: var(--border-strong); }
  .badge-mini.done { color: var(--checkpoint); border-color: rgba(52, 211, 153, .45); background: rgba(52, 211, 153, .10); }
  .chev { width: 8px; height: 8px; border-right: 1.6px solid var(--text-faint); border-bottom: 1.6px solid var(--text-faint); transform: rotate(45deg); transition: transform .18s var(--ease); margin-left: 3px; }
  .card.open .chev { transform: rotate(-135deg); }

  .card-body { padding: 11px 15px 13px 15px; }
  .card:not(.open) .card-body { display: none; }
  .thinking-text {
    margin: 0; white-space: pre-wrap; word-break: break-word;
    font-family: var(--mono); font-size: 12px; line-height: 1.7;
    color: var(--text); max-height: 380px; overflow-y: auto;
  }
  .thinking-text.clamped {
    display: -webkit-box;
    -webkit-line-clamp: 6;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .more-btn { margin-top: 8px; font-size: 11px; padding: 3px 10px; }

  .translation {
    margin: 10px 0 0 0; padding: 10px 12px;
    border-left: 2.5px solid var(--checkpoint);
    border-radius: 0 10px 10px 0;
    background: linear-gradient(135deg, rgba(52, 211, 153, .09), rgba(56, 189, 248, .05));
    white-space: pre-wrap; word-break: break-word;
    font-size: 12.2px; line-height: 1.68; color: var(--text);
  }
  .translation .tr-label { display: block; font-size: 10px; font-family: var(--mono); color: var(--checkpoint); margin-bottom: 4px; letter-spacing: .04em; }
  .tr-pending { color: var(--text-faint); font-style: italic; }

  .foot-row { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; margin-top: 10px; font-size: 10.5px; color: var(--text-faint); font-family: var(--mono); }
  .foot-row .toolpill { padding: 1px 7px; border: 1px solid var(--border); border-radius: 999px; background: var(--panel-solid); }

  .divider {
    display: flex; align-items: center; gap: 10px;
    margin: 15px 0 12px 0; padding: 0 2px;
  }
  .divider .line { flex: 1 1 auto; height: 1px; background: linear-gradient(90deg, transparent, var(--checkpoint), transparent); opacity: .68; }
  .divider .label {
    font-family: var(--mono); font-size: 10px; letter-spacing: .16em;
    color: var(--checkpoint); text-transform: uppercase; white-space: nowrap;
    padding: 2px 10px; border: 1px solid rgba(52, 211, 153, .42); border-radius: 999px;
    background: rgba(52, 211, 153, .10);
  }

  .toast {
    position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%) translateY(14px);
    background: var(--panel-elev); color: var(--text);
    border: 1px solid var(--border-strong); border-radius: 10px;
    padding: 7px 14px; font-size: 12px; box-shadow: var(--shadow);
    backdrop-filter: blur(12px);
    opacity: 0; pointer-events: none; transition: opacity .2s var(--ease), transform .2s var(--ease); z-index: 30;
    max-width: 82vw; text-align: center;
  }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  @media (max-width: 560px) {
    .brand-sub { display: none; }
    .filter-bar select { max-width: 100%; }
    .search-wrap { max-width: 100%; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition-duration: 0.01ms !important; }
  }

  /* 统一 Neko Glass 自定义下拉菜单 */
  select.azure-select-native { display: none !important; }
  .azure-select-trigger {
    display: inline-flex; align-items: center; justify-content: space-between; gap: 8px;
    flex: 1 1 200px; min-width: 150px; max-width: 320px; height: 32px;
    padding: 0 10px 0 11px; border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.06);
    color: var(--text); font-family: inherit; font-size: 12px; font-weight: 500;
    text-align: left; cursor: pointer; box-sizing: border-box;
    transition: border-color .16s var(--ease), background .16s var(--ease), box-shadow .16s var(--ease);
  }
  html[data-theme="light"] .azure-select-trigger {
    border-color: rgba(15, 23, 42, 0.12);
    background: rgba(15, 23, 42, 0.04);
  }
  .azure-select-trigger:hover:not(:disabled) {
    border-color: rgba(59, 130, 246, 0.62);
    background: rgba(59, 130, 246, 0.12);
  }
  html[data-theme="light"] .azure-select-trigger:hover:not(:disabled) {
    background: rgba(37, 99, 235, 0.06);
  }
  .azure-select-trigger.open, .azure-select-trigger:focus-visible {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.28);
    outline: none;
  }
  .meta-seg {
    display: inline-flex; align-items: center; padding: 2px; border-radius: 999px;
    border: 1px solid var(--border); background: var(--chip-bg, rgba(255, 255, 255, 0.04)); gap: 2px;
  }
  .meta-seg button {
    height: 22px; padding: 0 9px; border-radius: 999px; border: none;
    background: transparent; color: var(--text-dim); font-size: 11px; line-height: 1; cursor: pointer;
  }
  .meta-seg button.active {
    background: rgba(59, 130, 246, 0.22); color: var(--text); font-weight: 600;
  }
  .tr-head {
    display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;
  }
  .tr-origin-btn {
    height: 20px; padding: 0 7px; border-radius: 999px; font-size: 10.5px; line-height: 1;
    border: 1px solid var(--border); background: transparent; color: var(--text-dim); cursor: pointer;
  }
  .tr-origin-btn:hover { border-color: var(--accent, #3b82f6); color: var(--text); }
  .azure-select-trigger.compact {
    flex: 0 1 auto; min-width: 165px; max-width: 280px; height: 24px;
    padding: 0 8px 0 10px; border-radius: 999px; font-size: 11.5px; line-height: 1;
  }
  .azure-select-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.25; }
  .azure-select-caret { flex: 0 0 auto; width: 14px; height: 14px; color: var(--text-dim); transition: transform .18s var(--ease), color .18s var(--ease); }
  .azure-select-trigger.open .azure-select-caret { transform: rotate(180deg); color: #3b82f6; }
  .azure-select-menu {
    position: fixed; z-index: 100020; box-sizing: border-box; padding: 5px;
    border-radius: 12px; border: 1px solid rgba(96, 165, 250, 0.34);
    background: rgba(18, 25, 42, 0.96); backdrop-filter: blur(18px) saturate(165%);
    box-shadow: 0 16px 40px rgba(4, 8, 22, 0.64), 0 0 0 1px rgba(59, 130, 246, 0.14);
    overflow-y: auto; overflow-x: hidden;
    animation: azureDropIn .14s var(--ease);
  }
  html[data-theme="light"] .azure-select-menu {
    background: rgba(255, 255, 255, 0.97);
    border-color: rgba(37, 99, 235, 0.24);
    box-shadow: 0 14px 34px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(37, 99, 235, 0.08);
  }
  @keyframes azureDropIn { from { opacity: 0; transform: translateY(-4px) scale(0.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .azure-select-opt {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    width: 100%; padding: 7px 10px; margin: 1px 0;
    border: 1px solid transparent; border-radius: 8px; background: transparent;
    color: var(--text); font-family: inherit; font-size: 12px; font-weight: 400;
    text-align: left; cursor: pointer; box-sizing: border-box;
    transition: background .12s var(--ease), border-color .12s var(--ease), color .12s var(--ease);
  }
  .azure-select-opt-txt { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .azure-select-opt-check { flex: 0 0 auto; font-size: 11px; font-weight: 700; opacity: 0; }
  .azure-select-opt:hover:not(:disabled), .azure-select-opt.focused:not(:disabled) {
    background: rgba(59, 130, 246, 0.16); border-color: rgba(96, 165, 250, 0.30);
  }
  html[data-theme="light"] .azure-select-opt:hover:not(:disabled),
  html[data-theme="light"] .azure-select-opt.focused:not(:disabled) {
    background: rgba(37, 99, 235, 0.10); border-color: rgba(37, 99, 235, 0.24);
  }
  .azure-select-opt.selected {
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.92) 0%, rgba(59, 130, 246, 0.90) 60%, rgba(124, 58, 237, 0.88) 100%);
    border-color: transparent; color: #ffffff; font-weight: 600;
    box-shadow: 0 2px 10px rgba(37, 99, 235, 0.30);
  }
  .azure-select-opt.selected .azure-select-opt-check { opacity: 1; }
  @media (max-width: 560px) { .azure-select-trigger { max-width: 100%; } }

  /* 独立主题色调中心 */
  .azure-theme-btn { display: inline-flex; align-items: center; gap: 6px; }
  .azure-theme-dot {
    width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
    box-shadow: 0 0 0 1px rgba(255,255,255,.28), 0 0 8px var(--accent);
  }
  .azure-theme-mask {
    position: fixed; inset: 0; z-index: 100040;
    background: rgba(6, 10, 22, 0.56); backdrop-filter: blur(10px) saturate(145%);
    display: flex; align-items: center; justify-content: center; padding: 14px;
  }
  .azure-theme-panel {
    width: min(490px, 100%); max-height: 88vh; overflow-y: auto;
    border-radius: 16px; border: 1px solid var(--border-strong);
    background: var(--panel-solid); color: var(--text); box-shadow: var(--shadow);
    padding: 16px 18px 18px;
  }
  .azure-theme-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
  .azure-theme-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; }
  .azure-theme-sub { font-size: 11px; color: var(--text-faint); margin-top: 2px; }
  .azure-theme-sec { margin-top: 12px; padding-top: 11px; border-top: 1px solid var(--border); }
  .azure-theme-sec:first-of-type { margin-top: 0; padding-top: 0; border-top: none; }
  .azure-theme-sec-hd { display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; font-weight: 600; color: var(--text-faint); margin-bottom: 8px; }
  .azure-theme-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .azure-theme-card {
    display: flex; flex-direction: column; gap: 5px; width: 100%; padding: 9px 10px;
    border-radius: 12px; border: 1px solid var(--border); background: var(--panel-elev);
    color: var(--text); text-align: left; cursor: pointer;
    transition: border-color .14s ease, background .14s ease, transform .14s ease;
  }
  .azure-theme-card:hover { border-color: var(--border-strong); background: var(--accent-soft); transform: translateY(-1px); }
  .azure-theme-card.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); background: var(--accent-soft); }
  .azure-theme-card.empty { border-style: dashed; align-items: center; justify-content: center; min-height: 70px; color: var(--text-faint); font-size: 11.5px; text-align: center; }
  .azure-theme-bar { height: 20px; border-radius: 6px; width: 100%; }
  .azure-theme-card-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .azure-theme-card-name { font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .azure-theme-card-desc { font-size: 10.5px; color: var(--text-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .azure-theme-pill { font-size: 10px; padding: 1px 6px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-strong); border: 1px solid var(--border-strong); flex: 0 0 auto; }
  .azure-custom-box { border-radius: 12px; border: 1px solid var(--border); background: var(--panel-elev); padding: 10px 11px; display: flex; flex-direction: column; gap: 9px; }
  .azure-color-row { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: start; }
  .azure-color-col { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .azure-color-lbl { font-size: 11px; font-weight: 600; }
  .azure-color-input-wrap { display: flex; align-items: center; gap: 5px; }
  .azure-color-picker { width: 30px; height: 28px; padding: 2px; border-radius: 7px; border: 1px solid var(--border); background: transparent; cursor: pointer; flex: 0 0 auto; }
  .azure-color-hex { width: 100%; min-width: 0; height: 28px; padding: 0 7px; border-radius: 8px; border: 1px solid var(--border); background: var(--panel-solid); color: var(--text); font-family: var(--mono); font-size: 11.5px; }
  .azure-swatches { display: flex; flex-wrap: wrap; gap: 4px; }
  .azure-swatch { width: 16px; height: 16px; border-radius: 999px; border: 1.5px solid rgba(255,255,255,.28); padding: 0; cursor: pointer; }
  .azure-swatch:hover { transform: scale(1.16); }
  .azure-slot-actions { display: flex; gap: 4px; margin-top: 2px; }
  .azure-slot-act { padding: 2px 6px; border-radius: 6px; font-size: 10px; }
  .controls button { height: 30px; display: inline-flex; align-items: center; justify-content: center; }
  #agy-upd-btn { font-family: var(--mono); font-size: 11px; padding: 0 9px; border-radius: 999px; }
  #agy-upd-btn.has-update {
    border-color: rgba(245, 158, 11, 0.65); color: #fbbf24;
    background: rgba(245, 158, 11, 0.14); font-weight: 600;
  }
</style>
</head>
<body>
<div class="shell">
  <header class="topbar">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 3 21 19 3 19" stroke="#38bdf8" fill="rgba(56,189,248,0.16)"></polygon>
          <path d="M12 3L15.5 19" stroke="#818cf8" opacity="0.85"></path>
          <path d="M2 13L8.2 11.2" stroke="#bae6fd"></path>
          <path d="M16.2 12.2L22 10" stroke="#34d399"></path>
          <path d="M17.2 14.5L22 14.5" stroke="#818cf8"></path>
        </svg>
      </div>
      <div>
        <div class="brand-title">苍蓝棱镜</div>
        <div class="brand-sub">Azure Prism</div>
      </div>
    </div>
    <div class="spacer"></div>
    <div class="controls">
      <button id="btn-refresh" title="立即刷新" style="width:30px;padding:0;font-size:14px;line-height:1;">↻</button>
      <button id="btn-poll" class="on" title="每 3.5 秒自动轮询">自动 3.5s</button>
      <button id="btn-translate-latest" class="primary" title="翻译最近 5 条需要翻译的思考">译近 5 条</button>
      <button id="btn-open-web" title="在系统默认浏览器中打开独立 Web UI">Web UI</button>
      <button id="btn-sidebar-nav" title="控制是否在 Antigravity 左侧栏显示苍蓝棱镜按钮">左侧栏: ...</button>
      <button id="btn-theme-studio" class="azure-theme-btn" title="打开主题色调中心（官方预设 / 自定义双色 / 预设栏位）"><span class="azure-theme-dot"></span><span>主题</span></button>
      <button id="btn-theme" title="切换暗色 / 浅色" style="padding:0 8px;font-size:13px;line-height:1;">☀️</button>
      <button id="agy-upd-btn" title="点击检查插件更新">v1.2.2</button>
    </div>
  </header>

  <div class="filter-bar">
    <select id="session-select" title="切换会话"></select>
    <div class="search-wrap">
      <input id="search-input" class="search-input" type="text" placeholder="搜索思考、提问或工具..." />
      <button id="btn-search-clear" class="search-clear" title="清空搜索">×</button>
    </div>
    <div class="seg-group" id="kind-filter">
      <button class="seg-btn active" data-kind="all">全部</button>
      <button class="seg-btn" data-kind="thinking">思考</button>
      <button class="seg-btn" data-kind="user">提问</button>
      <button class="seg-btn" data-kind="checkpoint">分界</button>
    </div>
    <button id="btn-toggle-all" title="一键展开或折叠当前列表中的全部卡片">全部展开</button>
  </div>

  <div class="meta-bar">
    <span id="channel-chip" class="chip dim" style="gap:6px;padding:2px 4px 2px 9px;">
      <span class="dot"></span>
      <span id="channel-text" style="white-space:nowrap;">翻译模型</span>
      <select id="channel-select" title="切换翻译渠道与模型"></select>
    </span>
    <span class="meta-seg" id="display-mode-toggle" title="切换译文显示方式：双语对照 或 仅看译文">
      <button type="button" data-mode="bilingual" class="active">双语</button>
      <button type="button" data-mode="translation_only">仅译文</button>
    </span>
    <span id="stat-chip" class="chip dim">—</span>
    <span id="poll-chip" class="chip dim">轮询 3.5s</span>
  </div>

  <main class="scroll">
    <div id="list"></div>
  </main>
</div>
<div id="toast" class="toast"></div>

<script>
(function () {
  "use strict";
  var SNAPSHOT = __AZURE_PRISM_SNAPSHOT__;

  var state = {
    sessions: [],
    activeConversationId: null,
    entries: [],
    channel: null,
    availableChannels: [],
    config: {},
    openSet: {},
    expandedText: {},
    showOriginSet: {},
    displayMode: "bilingual",
    translating: {},
    polling: true,
    pollTimer: null,
    pollIntervalMs: 3500,
    busy: false,
    filterKind: "all",
    searchQuery: ""
  };

  var rpcSeq = 0;
  var pending = {};

  function nextId() {
    rpcSeq += 1;
    return "tv-" + rpcSeq + "-" + Date.now().toString(36);
  }

  function rpc(action, payload) {
    var args = { action: action };
    if (payload) {
      for (var k in payload) {
        if (Object.prototype.hasOwnProperty.call(payload, k)) args[k] = payload[k];
      }
    }
    // 独立浏览器模式：直接请求本地 /api 接口
    if (!window.parent || window.parent === window) {
      return fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args)
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) return { result: { structuredContent: j.data } };
        return { error: { message: (j && j.error) || "请求失败" } };
      }).catch(function (err) {
        return { error: { message: String(err && err.message || err) } };
      });
    }
    return new Promise(function (resolve) {
      var id = nextId();
      var timer = setTimeout(function () {
        if (pending[id]) {
          delete pending[id];
          resolve({ error: { message: "宿主未在 20 秒内响应" } });
        }
      }, 20000);
      pending[id] = { resolve: resolve, timer: timer };
      var message = {
        jsonrpc: "2.0",
        id: id,
        method: "tools/call",
        params: { name: "azure_prism_api", arguments: args }
      };
      try {
        window.parent.postMessage(message, "*");
      } catch (err) {
        clearTimeout(timer);
        delete pending[id];
        resolve({ error: { message: "postMessage 失败：" + String(err && err.message || err) } });
      }
    });
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (err) { return; }
    }
    if (!data || typeof data !== "object") return;
    var id = data.id;
    if (id === undefined || id === null) return;
    var slot = pending[id];
    if (!slot) return;
    clearTimeout(slot.timer);
    delete pending[id];
    slot.resolve(data);
  });

  function extractPayload(response) {
    if (!response) return null;
    if (response.error) {
      return { __error: String(response.error.message || "未知错误") };
    }
    var result = response.result;
    if (result && Array.isArray(result.structuredContent)) return result.structuredContent;
    if (result && result.structuredContent && typeof result.structuredContent === "object") {
      return result.structuredContent;
    }
    if (result && Array.isArray(result.content)) {
      for (var i = 0; i < result.content.length; i += 1) {
        var part = result.content[i];
        if (part && part.type === "text" && typeof part.text === "string") {
          try { return JSON.parse(part.text); } catch (err) { return { __raw: part.text }; }
        }
      }
    }
    if (result && typeof result === "object") return result;
    return null;
  }

  function toast(msg) {
    var node = document.getElementById("toast");
    if (!node) return;
    node.textContent = String(msg || "");
    node.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { node.classList.remove("show"); }, 2600);
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function fmtTime(value) {
    if (!value) return "—";
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    var pad = function (n) { return n < 10 ? "0" + n : String(n); };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " +
      pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }

  function kindLabel(entry) {
    if (!entry) return "UNKNOWN";
    if (entry.kind === "checkpoint") return "CHECKPOINT";
    if (entry.kind === "user") return "USER_INPUT";
    return "THINKING";
  }

  function entryKey(entry) {
    return String(entry && entry.lineNumber) + ":" + kindLabel(entry);
  }

  function renderChannel() {
    var chip = document.getElementById("channel-chip");
    var text = document.getElementById("channel-text");
    var sel = document.getElementById("channel-select");
    if (!chip || !text) return;
    var channel = state.channel;
    var list = Array.isArray(state.availableChannels) ? state.availableChannels : [];
    var savedVal = String((state.config && state.config.translationChannel) || "").trim();

    chip.className = "chip";
    if (!channel) {
      chip.classList.add("dim");
      text.textContent = "翻译渠道";
      chip.title = "点击选择翻译渠道与模型";
    } else if (channel.ok === false) {
      chip.classList.add("bad");
      text.textContent = "翻译不可用";
      chip.title = channel.reason || "未配置可用翻译渠道";
    } else {
      text.textContent = "翻译模型";
      var srcText = channel.source === "viewer-config" ? "棱镜自选" : (channel.source || "自动");
      chip.title = "当前生效：" + (channel.label || "-") + " · 来源：" + srcText + " · 协议：" + (channel.protocol || "-");
    }

    if (!sel) return;
    var curLabel = (channel && channel.ok !== false && channel.label) ? channel.label : "无可用渠道";
    var opts = [{ value: "", label: "自动跟随协奏台（" + (savedVal ? "恢复自动" : "当前：" + curLabel) + "）" }];
    var hasSaved = !savedVal;
    for (var i = 0; i < list.length; i += 1) {
      var item = list[i];
      if (!item || !item.value) continue;
      if (item.value === savedVal) hasSaved = true;
      opts.push({ value: item.value, label: item.label || item.value });
    }
    if (!hasSaved && savedVal) {
      opts.push({ value: savedVal, label: savedVal + "（自定义）" });
    }

    var sig = opts.map(function (o) { return o.value + "|" + o.label; }).join(";;");
    if (sel.dataset.optSig !== sig) {
      sel.dataset.optSig = sig;
      sel.textContent = "";
      for (var j = 0; j < opts.length; j += 1) {
        var optEl = document.createElement("option");
        optEl.value = opts[j].value;
        optEl.textContent = opts[j].label;
        sel.appendChild(optEl);
      }
    }
    if (sel.value !== savedVal) sel.value = savedVal;
  }

  function renderStats() {
    var chip = document.getElementById("stat-chip");
    if (!chip) return;
    var entries = state.entries || [];
    var checkpoints = 0;
    var truncated = 0;
    for (var i = 0; i < entries.length; i += 1) {
      if (entries[i].kind === "checkpoint") checkpoints += 1;
      if (entries[i].truncated) truncated += 1;
    }
    chip.textContent = "条目 " + entries.length + " · 分界 " + checkpoints + (truncated ? " · 截断 " + truncated : "");
    chip.title = state.activeConversationId ? "会话 " + state.activeConversationId : "";
  }

  function renderSessions() {
    var select = document.getElementById("session-select");
    if (!select) return;
    select.textContent = "";
    var sessions = state.sessions || [];
    if (sessions.length === 0) {
      var opt = el("option", null, "无可用会话");
      opt.value = "";
      select.appendChild(opt);
      select.disabled = true;
      return;
    }
    select.disabled = false;
    for (var i = 0; i < sessions.length; i += 1) {
      var s = sessions[i];
      var option = el("option", null, (s.title || s.conversationId) + " · " + fmtTime(s.updatedAt));
      option.value = s.conversationId;
      if (s.conversationId === state.activeConversationId) option.selected = true;
      select.appendChild(option);
    }
  }

  function buildCard(entry, index) {
    var key = entryKey(entry);
    var isOpen = !!state.openSet[key];
    var card = el("div", "card " + (entry.kind || "thinking") + (isOpen ? " open" : ""));
    card.setAttribute("data-key", key);

    var head = el("div", "card-head");
    head.appendChild(el("span", "tag", kindLabel(entry)));
    head.appendChild(el("span", "head-index", "#" + (entry.lineNumber || index + 1)));
    var preview = String(entry.text || "").replace(/\\s+/g, " ").slice(0, 220) || "（空）";
    head.appendChild(el("span", "head-preview", preview));

    var tools = el("div", "head-tools");
    if (entry.truncated) {
      tools.appendChild(el("span", "badge-mini", "截断"));
    }
    if (entry.resolvedFrom) {
      var badge = el("span", "badge-mini", "全文");
      badge.title = "已从 " + entry.resolvedFrom + " 回读补全";
      tools.appendChild(badge);
    }
    var needs = entry.needsTranslation !== undefined ? entry.needsTranslation : true;
    if (entry.translation) {
      var doneBtn = el("button", "badge-mini done", "译");
      doneBtn.title = "已翻译，点击重新翻译";
      doneBtn.addEventListener("click", function (ev) { ev.stopPropagation(); doTranslate(entry, true); });
      tools.appendChild(doneBtn);
    } else if (needs) {
      var trBtn = el("button", "badge-mini", "译");
      trBtn.title = "翻译此条思考";
      trBtn.addEventListener("click", function (ev) { ev.stopPropagation(); doTranslate(entry, false); });
      tools.appendChild(trBtn);
    }
    tools.appendChild(el("span", "chev"));
    head.appendChild(tools);

    head.addEventListener("click", function () {
      if (state.openSet[key]) delete state.openSet[key];
      else state.openSet[key] = true;
      render();
    });
    card.appendChild(head);

    var body = el("div", "card-body");
    var rawText = String(entry.text || "");
    var isTranslationOnly = state.displayMode === "translation_only" && !!entry.translation;
    var showOrigin = !isTranslationOnly || !!state.showOriginSet[key];
    if (showOrigin) {
      var isLong = rawText.length > 320 || rawText.split(/\\r?\\n/).length > 6;
      var expanded = !!state.expandedText[key];
      var textNode = el("pre", "thinking-text" + (isLong && !expanded ? " clamped" : ""), rawText || "（无内容）");
      body.appendChild(textNode);
      if (isLong && !expanded) {
        var moreBtn = el("button", "more-btn", "展开全文");
        moreBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          state.expandedText[key] = true;
          render();
        });
        body.appendChild(moreBtn);
      } else if (isLong && expanded) {
        var lessBtn = el("button", "more-btn", "收起");
        lessBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          delete state.expandedText[key];
          render();
        });
        body.appendChild(lessBtn);
      }
    }

    if (entry.translation) {
      var trBox = el("div", "translation");
      var trHead = el("div", "tr-head");
      trHead.appendChild(el("span", "tr-label", (entry.translationChannel ? "译文 · " + entry.translationChannel : "译文")));
      if (isTranslationOnly) {
        var originBtn = el("button", "tr-origin-btn", state.showOriginSet[key] ? "隐藏原文" : "查看原文");
        originBtn.type = "button";
        originBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          if (state.showOriginSet[key]) delete state.showOriginSet[key];
          else state.showOriginSet[key] = true;
          render();
        });
        trHead.appendChild(originBtn);
      }
      trBox.appendChild(trHead);
      trBox.appendChild(document.createTextNode(entry.translation));
      body.appendChild(trBox);
    } else if (state.translating[key]) {
      var pend = el("div", "translation");
      pend.appendChild(el("span", "tr-label", "译文"));
      pend.appendChild(el("span", "tr-pending", "翻译中…"));
      body.appendChild(pend);
    }

    var foot = el("div", "foot-row");
    if (entry.timestamp) foot.appendChild(el("span", null, fmtTime(entry.timestamp)));
    if (entry.status) foot.appendChild(el("span", null, "status=" + entry.status));
    if (Array.isArray(entry.truncatedFields) && entry.truncatedFields.length) {
      foot.appendChild(el("span", null, "truncated_fields=" + entry.truncatedFields.join(",")));
    }
    if (Array.isArray(entry.toolCalls)) {
      for (var t = 0; t < entry.toolCalls.length && t < 6; t += 1) {
        foot.appendChild(el("span", "toolpill", entry.toolCalls[t]));
      }
    }
    if (foot.childNodes.length) body.appendChild(foot);
    card.appendChild(body);
    return card;
  }

  function getFilteredEntries() {
    var entries = state.entries || [];
    var kind = state.filterKind || "all";
    var q = String(state.searchQuery || "").trim().toLowerCase();
    if (kind === "all" && !q) return entries;
    var out = [];
    for (var i = 0; i < entries.length; i += 1) {
      var e = entries[i];
      var eKind = e.kind || "thinking";
      if (kind !== "all" && eKind !== kind) continue;
      if (q) {
        var hay = (String(e.text || "") + " " + String(e.translation || "") + " " +
          (Array.isArray(e.toolCalls) ? e.toolCalls.join(" ") : "")).toLowerCase();
        if (hay.indexOf(q) === -1) continue;
      }
      out.push(e);
    }
    return out;
  }

  function renderList() {
    var list = document.getElementById("list");
    if (!list) return;
    list.textContent = "";
    var allEntries = state.entries || [];
    var entries = getFilteredEntries();
    if (entries.length === 0) {
      var empty = el("div", "empty");
      if (allEntries.length > 0) {
        empty.appendChild(el("strong", null, "没有匹配的条目"));
        empty.appendChild(document.createTextNode("试试清空搜索关键词或切换筛选类型。"));
      } else {
        empty.appendChild(el("strong", null, "暂无思考轨迹"));
        empty.appendChild(document.createTextNode(
          state.activeConversationId
            ? "该会话的 transcript.jsonl 中没有可展示的 PLANNER_RESPONSE.thinking / CHECKPOINT / USER_INPUT 记录。"
            : "未找到任何包含 .system_generated/logs/transcript.jsonl 的会话目录。"
        ));
      }
      list.appendChild(empty);
      return;
    }
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (entry.kind === "checkpoint") {
        var divider = el("div", "divider");
        divider.appendChild(el("span", "line"));
        divider.appendChild(el("span", "label", "checkpoint · #" + (entry.lineNumber || "")));
        divider.appendChild(el("span", "line"));
        list.appendChild(divider);
      }
      list.appendChild(buildCard(entry, i));
    }
    var toggleAllBtn = document.getElementById("btn-toggle-all");
    if (toggleAllBtn) {
      var openCount = 0;
      for (var k = 0; k < entries.length; k += 1) {
        if (state.openSet[entryKey(entries[k])]) openCount += 1;
      }
      toggleAllBtn.textContent = (openCount > 0 && openCount >= entries.length) ? "全部折叠" : "全部展开";
    }
  }

  function render() {
    renderSessions();
    renderChannel();
    renderStats();
    renderList();
    var pollBtn = document.getElementById("btn-poll");
    if (pollBtn) {
      pollBtn.className = state.polling ? "on" : "";
      pollBtn.textContent = state.polling ? "自动 3.5s" : "已暂停";
    }
  }

  function applyRead(data) {
    if (!data || data.__error) {
      toast("读取失败：" + (data && data.__error || "无响应"));
      return;
    }
    var prevConv = state.activeConversationId;
    var nextConv = data.conversationId || state.activeConversationId;
    var prevTransMap = {};
    if (prevConv && prevConv === nextConv && Array.isArray(state.entries)) {
      for (var pi = 0; pi < state.entries.length; pi += 1) {
        var pe = state.entries[pi];
        if (pe && pe.translation && pe.stepIndex !== undefined) {
          prevTransMap[String(pe.stepIndex) + ":" + String(pe.kind || "")] = pe.translation;
        }
      }
    }
    state.activeConversationId = nextConv;
    var incoming = Array.isArray(data.entries) ? data.entries : [];
    for (var ni = 0; ni < incoming.length; ni += 1) {
      var ne = incoming[ni];
      if (ne && !ne.translation && ne.stepIndex !== undefined) {
        var k = String(ne.stepIndex) + ":" + String(ne.kind || "");
        if (prevTransMap[k]) ne.translation = prevTransMap[k];
      }
    }
    state.entries = incoming;
    if (data.channel) state.channel = data.channel;
    if (Array.isArray(data.availableChannels)) state.availableChannels = data.availableChannels;
    if (data.config) {
      state.config = data.config;
      if (data.config.displayMode === "translation_only" || data.config.displayMode === "bilingual") {
        state.displayMode = data.config.displayMode;
      }
    }
    render();
  }

  function applySessions(data) {
    if (!data || data.__error) {
      toast("会话列表获取失败");
      return;
    }
    state.sessions = Array.isArray(data.sessions) ? data.sessions : [];
    if (!state.activeConversationId) {
      state.activeConversationId = data.activeConversationId ||
        (state.sessions[0] && state.sessions[0].conversationId) || null;
    }
    if (data.channel) state.channel = data.channel;
    if (Array.isArray(data.availableChannels)) state.availableChannels = data.availableChannels;
    if (data.config) {
      state.config = data.config;
      if (data.config.displayMode === "translation_only" || data.config.displayMode === "bilingual") {
        state.displayMode = data.config.displayMode;
      }
    }
    render();
  }

  var _refreshInFlight = false;
  function refresh(options) {
    var silent = options && options.silent;
    if (_refreshInFlight && silent) return Promise.resolve();
    _refreshInFlight = true;
    if (!silent) setBusy(true);
    return rpc("read", {
      conversationId: state.activeConversationId,
      onlyWithThinking: true,
      limit: 120
    }).then(function (response) {
      _refreshInFlight = false;
      if (!silent) setBusy(false);
      var data = extractPayload(response);
      if (data && data.__error) {
        if (!silent) toast("刷新失败：" + data.__error);
        return;
      }
      applyRead(data);
    }).catch(function () {
      _refreshInFlight = false;
      if (!silent) setBusy(false);
    });
  }

  function setBusy(value) {
    state.busy = !!value;
    var ids = ["btn-refresh", "btn-translate-latest"];
    for (var i = 0; i < ids.length; i += 1) {
      var node = document.getElementById(ids[i]);
      if (node) node.disabled = state.busy;
    }
  }

  function doTranslate(entry, force) {
    var key = entryKey(entry);
    if (state.translating[key]) return;
    state.translating[key] = true;
    state.openSet[key] = true;
    render();
    rpc("translate_one", { text: entry.text, force: !!force }).then(function (response) {
      delete state.translating[key];
      var data = extractPayload(response);
      if (data && data.__error) {
        render();
        toast("翻译失败：" + data.__error);
        return;
      }
      if (!data || !data.translation) {
        render();
        toast("翻译失败：" + ((data && data.reason) || "模型未返回译文"));
        return;
      }
      for (var i = 0; i < state.entries.length; i += 1) {
        if (entryKey(state.entries[i]) === key) {
          state.entries[i].translation = data.translation;
          state.entries[i].translationChannel = data.channel || null;
        }
      }
      if (data.channel) {
        state.channel = state.channel || {};
        if (!state.channel.label) state.channel.label = data.channel;
      }
      render();
      toast("已翻译");
    });
  }

  function translateLatest() {
    setBusy(true);
    rpc("translate_latest", { count: 5 }).then(function (response) {
      setBusy(false);
      var data = extractPayload(response);
      if (data && data.__error) {
        toast("翻译失败：" + data.__error);
        return;
      }
      var items = data && Array.isArray(data.translations) ? data.translations : [];
      if (items.length === 0) {
        toast((data && data.reason) || "最近 5 条无需翻译");
        return;
      }
      for (var i = 0; i < items.length; i += 1) {
        var item = items[i];
        for (var j = 0; j < state.entries.length; j += 1) {
          if (entryKey(state.entries[j]) === item.key || state.entries[j].lineNumber === item.lineNumber) {
            state.entries[j].translation = item.translation;
            state.entries[j].translationChannel = item.channel || null;
            state.openSet[entryKey(state.entries[j])] = true;
          }
        }
      }
      if (data && data.channel) {
        state.channel = state.channel || {};
        state.channel.label = state.channel.label || data.channel;
      }
      render();
      toast("已翻译 " + items.length + " 条");
    });
  }

  function startPolling() {
    stopPolling();
    if (!state.polling) return;
    state.pollTimer = setInterval(function () {
      if (!state.polling || document.hidden || state.busy) return;
      refresh({ silent: true });
    }, state.pollIntervalMs);
  }

  function stopPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function wire() {
    var select = document.getElementById("session-select");
    if (select) {
      select.addEventListener("change", function () {
        state.activeConversationId = select.value || null;
        state.entries = [];
        state.openSet = {};
        refresh({});
      });
    }
    var refreshBtn = document.getElementById("btn-refresh");
    if (refreshBtn) refreshBtn.addEventListener("click", function () { refresh({}); });

    var pollBtn = document.getElementById("btn-poll");
    if (pollBtn) {
      pollBtn.addEventListener("click", function () {
        state.polling = !state.polling;
        if (state.polling) {
          startPolling();
          toast("已开启 3.5 秒自动轮询");
        } else {
          stopPolling();
          toast("已暂停自动轮询");
        }
        render();
      });
    }

    var latestBtn = document.getElementById("btn-translate-latest");
    if (latestBtn) latestBtn.addEventListener("click", translateLatest);

    var sbNavBtn = document.getElementById("btn-sidebar-nav");
    var sbNavOn = true;
    function syncSbNavBtn() {
      if (!sbNavBtn) return;
      sbNavBtn.textContent = sbNavOn ? "左侧栏: 开" : "左侧栏: 关";
      sbNavBtn.classList.toggle("on", sbNavOn);
    }
    if (sbNavBtn) {
      syncSbNavBtn();
      rpc("sidebar_nav", {}).then(function (resp) {
        var r = extractPayload(resp);
        if (r && typeof r.showInLeftSidebar === "boolean") {
          sbNavOn = r.showInLeftSidebar;
          syncSbNavBtn();
        }
      }).catch(function () {});
      sbNavBtn.addEventListener("click", function () {
        var next = !sbNavOn;
        sbNavBtn.disabled = true;
        rpc("sidebar_nav", { showInLeftSidebar: next }).then(function (resp) {
          var r = extractPayload(resp);
          if (r && r.ok) {
            sbNavOn = !!r.showInLeftSidebar;
            syncSbNavBtn();
            toast((sbNavOn ? "已开启" : "已隐藏") + "左侧栏按钮" + (r.refreshed ? "（已通知刷新，未变化时按 Ctrl+R）" : "（按 Ctrl+R 生效）"));
          } else {
            toast("切换失败");
          }
        }).catch(function () {
          toast("切换失败");
        }).finally(function () {
          sbNavBtn.disabled = false;
        });
      });
    }

    var searchInput = document.getElementById("search-input");
    var searchClear = document.getElementById("btn-search-clear");
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        state.searchQuery = searchInput.value || "";
        if (searchClear) searchClear.classList.toggle("visible", !!state.searchQuery);
        renderList();
      });
    }
    if (searchClear) {
      searchClear.addEventListener("click", function () {
        state.searchQuery = "";
        if (searchInput) searchInput.value = "";
        searchClear.classList.remove("visible");
        renderList();
      });
    }

    var kindGroup = document.getElementById("kind-filter");
    if (kindGroup) {
      kindGroup.addEventListener("click", function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest(".seg-btn") : null;
        if (!btn) return;
        var k = btn.getAttribute("data-kind") || "all";
        state.filterKind = k;
        var allBtns = kindGroup.querySelectorAll(".seg-btn");
        for (var i = 0; i < allBtns.length; i += 1) {
          allBtns[i].classList.toggle("active", allBtns[i] === btn);
        }
        renderList();
      });
    }

    var toggleAllBtn = document.getElementById("btn-toggle-all");
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener("click", function () {
        var entries = getFilteredEntries();
        var openCount = 0;
        for (var i = 0; i < entries.length; i += 1) {
          if (state.openSet[entryKey(entries[i])]) openCount += 1;
        }
        var shouldOpen = !(openCount > 0 && openCount >= entries.length);
        for (var j = 0; j < entries.length; j += 1) {
          var key = entryKey(entries[j]);
          if (shouldOpen) state.openSet[key] = true;
          else delete state.openSet[key];
        }
        renderList();
      });
    }

    var themeBtn = document.getElementById("btn-theme");
    if (themeBtn) {
      themeBtn.addEventListener("click", function () {
        var root = document.documentElement;
        var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
        root.setAttribute("data-theme", next);
        themeBtn.textContent = next === "light" ? "🌙" : "☀️";
        try { localStorage.setItem("azure-prism-theme", next); } catch (err) { /* ignore */ }
      });
    }

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && state.polling) refresh({ silent: true });
    });
  }

  function bootstrap() {
    try {
      var saved = localStorage.getItem("azure-prism-theme") || localStorage.getItem("thought-viewer-theme");
      if (saved === "light" || saved === "dark") {
        document.documentElement.setAttribute("data-theme", saved);
        var themeBtn = document.getElementById("btn-theme");
        if (themeBtn) themeBtn.textContent = saved === "light" ? "🌙" : "☀️";
      }
    } catch (err) { /* ignore */ }

    wire();

    // 滚动锚定修正：当视口上方思考卡片展开或翻译回填变高时，自动补偿 .scroll 位移防止画面跳动
    try {
      var scrollBox = document.querySelector("main.scroll");
      var listBox = document.getElementById("list");
      if (scrollBox && listBox && typeof ResizeObserver !== "undefined") {
        var hMap = new WeakMap();
        var ro = new ResizeObserver(function (entries) {
          var boxTop = scrollBox.getBoundingClientRect().top;
          var deltaSum = 0;
          for (var i = 0; i < entries.length; i++) {
            var elNode = entries[i].target;
            var nextH = entries[i].contentRect.height;
            var prevH = hMap.get(elNode);
            hMap.set(elNode, nextH);
            if (prevH === undefined || Math.abs(nextH - prevH) < 0.5) continue;
            if (elNode.getBoundingClientRect().bottom < boxTop + 4) deltaSum += (nextH - prevH);
          }
          if (Math.abs(deltaSum) >= 1) scrollBox.scrollBy(0, deltaSum);
        });
        var bindKids = function () {
          var kids = listBox.children;
          for (var j = 0; j < kids.length; j++) {
            if (!hMap.has(kids[j])) {
              hMap.set(kids[j], kids[j].getBoundingClientRect().height);
              ro.observe(kids[j]);
            }
          }
        };
        new MutationObserver(bindKids).observe(listBox, { childList: true });
        bindKids();
      }
    } catch (err) { /* ignore */ }

    try {
      // 自定义 Neko Glass 下拉菜单：统一接管 #session-select 与 #channel-select
      if (typeof HTMLSelectElement !== "undefined" && !window.__tvSelectProtoPatched) {
        window.__tvSelectProtoPatched = true;
        ["value", "selectedIndex"].forEach(function (prop) {
          var desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, prop);
          if (!desc || !desc.set || !desc.get) return;
          Object.defineProperty(HTMLSelectElement.prototype, prop, {
            configurable: true,
            enumerable: desc.enumerable,
            get: function () { return desc.get.call(this); },
            set: function (v) {
              desc.set.call(this, v);
              if (this && typeof this.__azureSyncLabel === "function") this.__azureSyncLabel();
            }
          });
        });
      }

      var openSelectMenu = null;
      var openSelectTrig = null;
      var closeAnySelectMenu = function () {
        if (openSelectMenu) { openSelectMenu.remove(); openSelectMenu = null; }
        if (openSelectTrig) {
          openSelectTrig.classList.remove("open");
          openSelectTrig.setAttribute("aria-expanded", "false");
          openSelectTrig = null;
        }
      };

      var enhanceTvSelect = function (sel, fallbackText, compact) {
        if (!sel || sel.dataset.azureSelectReady === "1") return;
        sel.dataset.azureSelectReady = "1";
        var trig = document.createElement("button");
        trig.type = "button";
        trig.className = "azure-select-trigger" + (compact ? " compact" : "");
        trig.setAttribute("aria-haspopup", "listbox");
        trig.setAttribute("aria-expanded", "false");
        trig.innerHTML = '<span class="azure-select-label">' + fallbackText + '</span><svg class="azure-select-caret" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        sel.classList.add("azure-select-native");
        sel.insertAdjacentElement("afterend", trig);

        var syncSelLabel = function () {
          var opt = sel.options[sel.selectedIndex] || sel.options[0];
          var txt = opt ? (opt.textContent || "").trim() : fallbackText;
          var lbl = trig.querySelector(".azure-select-label");
          if (lbl) lbl.textContent = txt;
          trig.title = txt;
        };
        sel.__azureSyncLabel = syncSelLabel;

        trig.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          var wasThis = openSelectTrig === trig;
          closeAnySelectMenu();
          if (wasThis) return;
          var menu = document.createElement("div");
          menu.className = "azure-select-menu";
          menu.setAttribute("role", "listbox");
          for (var oi = 0; oi < sel.options.length; oi++) {
            (function (opt) {
              var b = document.createElement("button");
              b.type = "button";
              b.className = "azure-select-opt" + (opt.index === sel.selectedIndex ? " selected" : "");
              var t = (opt.textContent || "").trim();
              b.title = t;
              var sp1 = document.createElement("span");
              sp1.className = "azure-select-opt-txt";
              sp1.textContent = t;
              var sp2 = document.createElement("span");
              sp2.className = "azure-select-opt-check";
              sp2.textContent = "✓";
              b.appendChild(sp1);
              b.appendChild(sp2);
              b.addEventListener("click", function (e2) {
                e2.preventDefault();
                e2.stopPropagation();
                var oldV = sel.value;
                sel.selectedIndex = opt.index;
                syncSelLabel();
                closeAnySelectMenu();
                if (sel.value !== oldV) sel.dispatchEvent(new Event("change", { bubbles: true }));
              });
              menu.appendChild(b);
            })(sel.options[oi]);
          }
          document.body.appendChild(menu);
          var rect = trig.getBoundingClientRect();
          menu.style.minWidth = Math.max(rect.width, 220) + "px";
          menu.style.maxWidth = Math.min(window.innerWidth - 16, Math.max(rect.width, 380)) + "px";
          menu.style.maxHeight = Math.max(140, Math.min(320, window.innerHeight - rect.bottom - 14)) + "px";
          var mr = menu.getBoundingClientRect();
          var left = Math.min(rect.left, Math.max(8, window.innerWidth - mr.width - 8));
          menu.style.left = left + "px";
          menu.style.top = (rect.bottom + 4) + "px";
          openSelectMenu = menu;
          openSelectTrig = trig;
          trig.classList.add("open");
          trig.setAttribute("aria-expanded", "true");
        });

        sel.addEventListener("change", syncSelLabel);
        if (typeof MutationObserver !== "undefined") {
          new MutationObserver(syncSelLabel).observe(sel, { childList: true, subtree: true, characterData: true });
        }
        syncSelLabel();
      };

      document.addEventListener("mousedown", function (ev) {
        if (!openSelectMenu) return;
        if (openSelectMenu.contains(ev.target) || (openSelectTrig && openSelectTrig.contains(ev.target))) return;
        closeAnySelectMenu();
      }, true);
      document.addEventListener("keydown", function (ev) {
        if (openSelectMenu && ev.key === "Escape") closeAnySelectMenu();
      });
      window.addEventListener("resize", closeAnySelectMenu);

      enhanceTvSelect(document.getElementById("session-select"), "切换会话", false);
      enhanceTvSelect(document.getElementById("channel-select"), "翻译模型", true);
    } catch (err) { /* ignore */ }

    try {
      // 独立主题色调中心（与其余 7 个插件共享 ~/.gemini/azure-theme.json）
      var TV_SWATCHES = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#ec4899", "#f59e0b", "#f43f5e", "#6366f1"];
      var TV_OFFICIAL = [
        { id: "official-azure", name: "苍蓝星辉", desc: "默认官方 · 苍蓝主体 + 柔紫尾韵", primary: "#3b82f6", secondary: "#7c3aed", badge: "默认" },
        { id: "official-violet", name: "星雾黑紫", desc: "官方经典 · 星紫主体 + 苍蓝尾韵", primary: "#8b5cf6", secondary: "#3b82f6", badge: "官方" }
      ];
      var tvThemeCfg = { version: 1, activeId: "official-azure", customDraft: { primary: "#3b82f6", secondary: "#7c3aed" }, slots: [null, null, null, null] };
      var tvThemeMask = null;
      var tvHexToRgb = function (hex) {
        var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
        if (!m) return [59, 130, 246];
        var n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      };
      var tvRgbToHex = function (r, g, b) {
        var c = function (v) { return Math.max(0, Math.min(255, Math.round(v))); };
        return "#" + [c(r), c(g), c(b)].map(function (x) { return x.toString(16).padStart(2, "0"); }).join("");
      };
      var tvMix = function (h1, h2, w2) {
        var a = tvHexToRgb(h1), b = tvHexToRgb(h2), w1 = 1 - w2;
        return tvRgbToHex(a[0] * w1 + b[0] * w2, a[1] * w1 + b[1] * w2, a[2] * w1 + b[2] * w2);
      };
      var tvRgba = function (hex, a) {
        var c = tvHexToRgb(hex);
        return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
      };
      var tvNormHex = function (v, fb) {
        var s = String(v || "").trim();
        if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
        if (/^[0-9a-fA-F]{6}$/.test(s)) return ("#" + s).toLowerCase();
        return fb;
      };
      var tvResolveTheme = function (cfg) {
        var id = (cfg && cfg.activeId) || "official-azure";
        for (var i = 0; i < TV_OFFICIAL.length; i++) if (TV_OFFICIAL[i].id === id) return TV_OFFICIAL[i];
        var sm = /^slot-([0-3])$/.exec(id);
        if (sm && cfg && Array.isArray(cfg.slots) && cfg.slots[Number(sm[1])]) return cfg.slots[Number(sm[1])];
        var d = (cfg && cfg.customDraft) || { primary: "#3b82f6", secondary: "#7c3aed" };
        return { id: "custom", name: "自定义", primary: tvNormHex(d.primary, "#3b82f6"), secondary: tvNormHex(d.secondary, "#7c3aed") };
      };
      var tvApplyPalette = function (pHex, sHex) {
        var p = tvNormHex(pHex, "#3b82f6"), s = tvNormHex(sHex, "#7c3aed");
        var pDark = tvMix(p, "#0f172a", 0.18), pLight = tvMix(p, "#ffffff", 0.68), pBorder = tvMix(p, "#ffffff", 0.32), pDeep = tvMix(p, "#0f172a", 0.28);
        var darkBg = tvMix("#101420", p, 0.06), darkPanel = tvMix("#141928", p, 0.07), darkSolid = tvMix("#161c2c", p, 0.08);
        var lightBg = tvMix("#f6f7fb", p, 0.04);
        var grad = "linear-gradient(135deg," + pDark + " 0%," + p + " 58%," + s + " 100%)";
        var st = document.getElementById("azure-theme-vars");
        if (!st) { st = document.createElement("style"); st.id = "azure-theme-vars"; document.head.appendChild(st); }
        st.textContent =
          ":root{--bg:" + darkBg + ";--bg-grad-a:" + tvRgba(p, 0.16) + ";--bg-grad-b:" + tvRgba(s, 0.09) + ";--panel:" + tvRgba(darkPanel, 0.90) + ";--panel-solid:" + darkSolid + ";--border:" + tvRgba(pBorder, 0.24) + ";--border-strong:" + tvRgba(p, 0.68) + ";--accent:" + p + ";--accent-2:" + s + ";--accent-soft:" + tvRgba(p, 0.18) + ";--accent-strong:" + pLight + ";--thinking:" + p + ";--prism-line:linear-gradient(90deg,transparent 0%," + tvRgba(pDark, 0.78) + " 25%," + tvRgba(p, 0.82) + " 55%," + tvRgba(s, 0.65) + " 82%,transparent 100%);}" +
          'html[data-theme="light"]{--bg:' + lightBg + ";--bg-grad-a:" + tvRgba(p, 0.13) + ";--bg-grad-b:" + tvRgba(s, 0.08) + ";--border:" + tvRgba(p, 0.22) + ";--border-strong:" + tvRgba(pDark, 0.56) + ";--accent:" + pDark + ";--accent-2:" + s + ";--accent-soft:" + tvRgba(p, 0.12) + ";--accent-strong:" + pDeep + ";--thinking:" + pDark + ";}" +
          "button.primary{background:" + grad + ";box-shadow:0 2px 10px " + tvRgba(pDark, 0.30) + ";}" +
          "button.primary:hover{box-shadow:0 6px 20px " + tvRgba(p, 0.44) + ";}" +
          "button:hover{box-shadow:0 4px 12px " + tvRgba(p, 0.20) + ";}" +
          ".card-head:hover{background:linear-gradient(180deg," + tvRgba(p, 0.14) + "," + tvRgba(p, 0.03) + ");}" +
          ".azure-select-trigger.open,.azure-select-trigger:focus-visible{border-color:" + p + ";box-shadow:0 0 0 2px " + tvRgba(p, 0.28) + ";}" +
          ".azure-select-trigger.open .azure-select-caret{color:" + p + ";}" +
          ".azure-select-menu{border-color:" + tvRgba(pBorder, 0.34) + ";background:" + tvRgba(darkSolid, 0.96) + ";}" +
          ".azure-select-opt:hover:not(:disabled),.azure-select-opt.focused:not(:disabled){background:" + tvRgba(p, 0.16) + ";border-color:" + tvRgba(pBorder, 0.30) + ";}" +
          ".azure-select-opt.selected{background:" + grad + ";box-shadow:0 2px 10px " + tvRgba(pDark, 0.30) + ";}" +
          "::-webkit-scrollbar-thumb:hover{background:" + tvRgba(p, 0.60) + ";}" +
          "::-webkit-scrollbar-thumb:active{background:" + tvRgba(p, 0.85) + ";}";
      };
      var tvApplyCurrent = function () {
        var c = tvResolveTheme(tvThemeCfg);
        tvApplyPalette(c.primary, c.secondary);
        try { localStorage.setItem("azure_theme_cache_v1", JSON.stringify(tvThemeCfg)); } catch (e) {}
      };
      var tvSaveTheme = function (next) {
        tvThemeCfg = next;
        tvApplyCurrent();
        return rpc("theme", { themeConfig: next }).then(function (r) {
          var d = extractPayload(r);
          if (d && d.config) { tvThemeCfg = d.config; tvApplyCurrent(); }
        });
      };
      var tvCloseTheme = function () {
        if (tvThemeMask) { tvThemeMask.remove(); tvThemeMask = null; }
        tvApplyCurrent();
      };
      var tvRenderThemeModal = function () {
        if (!tvThemeMask) return;
        var panel = tvThemeMask.querySelector(".azure-theme-panel");
        var dp = tvNormHex(tvThemeCfg.customDraft && tvThemeCfg.customDraft.primary, "#3b82f6");
        var ds = tvNormHex(tvThemeCfg.customDraft && tvThemeCfg.customDraft.secondary, "#7c3aed");
        var cur = tvResolveTheme(tvThemeCfg);
        var offHtml = TV_OFFICIAL.map(function (o) {
          var act = tvThemeCfg.activeId === o.id;
          var g = "linear-gradient(135deg," + tvMix(o.primary, "#0f172a", 0.18) + " 0%," + o.primary + " 58%," + o.secondary + " 100%)";
          return '<button type="button" class="azure-theme-card' + (act ? " active" : "") + '" data-off="' + o.id + '">' +
            '<div class="azure-theme-bar" style="background:' + g + '"></div>' +
            '<div class="azure-theme-card-top"><span class="azure-theme-card-name">' + o.name + '</span><span class="azure-theme-pill">' + (act ? "✓ 当前" : o.badge) + '</span></div>' +
            '<div class="azure-theme-card-desc">' + o.desc + '</div></button>';
        }).join("");
        var mkSw = function (role) {
          return TV_SWATCHES.map(function (h) {
            return '<button type="button" class="azure-swatch" data-sr="' + role + '" data-sh="' + h + '" style="background:' + h + '" title="' + h + '"></button>';
          }).join("");
        };
        var slots = Array.isArray(tvThemeCfg.slots) ? tvThemeCfg.slots : [null, null, null, null];
        var slHtml = [0, 1, 2, 3].map(function (i) {
          var sl = slots[i];
          if (!sl) return '<button type="button" class="azure-theme-card empty" data-sv="' + i + '"><span>＋ 保存当前搭配到栏位 ' + (i + 1) + '</span></button>';
          var act = tvThemeCfg.activeId === ("slot-" + i);
          var g = "linear-gradient(135deg," + tvMix(sl.primary, "#0f172a", 0.18) + " 0%," + sl.primary + " 58%," + sl.secondary + " 100%)";
          return '<div class="azure-theme-card' + (act ? " active" : "") + '" data-us="' + i + '">' +
            '<div class="azure-theme-bar" style="background:' + g + '"></div>' +
            '<div class="azure-theme-card-top"><span class="azure-theme-card-name">' + String(sl.name || "").replace(/</g, "&lt;") + '</span>' + (act ? '<span class="azure-theme-pill">✓ 当前</span>' : '') + '</div>' +
            '<div class="azure-theme-card-desc">' + sl.primary + ' → ' + sl.secondary + '</div>' +
            '<div class="azure-slot-actions"><button type="button" class="azure-slot-act" data-ov="' + i + '">覆盖</button><button type="button" class="azure-slot-act" data-cl="' + i + '">清空</button></div></div>';
        }).join("");
        panel.innerHTML =
          '<div class="azure-theme-head"><div><div class="azure-theme-title"><span class="azure-theme-dot"></span><span>主题色调中心</span></div>' +
          '<div class="azure-theme-sub">当前生效：' + cur.name + ' · 全 8 个苍蓝插件实时共享</div></div><button type="button" id="tv-th-close">×</button></div>' +
          '<div class="azure-theme-sec"><div class="azure-theme-sec-hd"><span>官方预设主题</span><span>2 套内置</span></div><div class="azure-theme-grid-2">' + offHtml + '</div></div>' +
          '<div class="azure-theme-sec"><div class="azure-theme-sec-hd"><span>自定义双色搭配</span><span>A 主体（60%）→ B 辅助（40%）</span></div><div class="azure-custom-box">' +
            '<div class="azure-color-row">' +
              '<div class="azure-color-col"><span class="azure-color-lbl">A 主体色</span><div class="azure-color-input-wrap"><input type="color" class="azure-color-picker" id="tv-pp" value="' + dp + '"><input type="text" class="azure-color-hex" id="tv-hp" value="' + dp + '" maxlength="7"></div><div class="azure-swatches">' + mkSw("p") + '</div></div>' +
              '<button type="button" id="tv-swab" style="margin-top:16px;padding:4px 7px;" title="对调 A 与 B">⇄</button>' +
              '<div class="azure-color-col"><span class="azure-color-lbl">B 辅助色</span><div class="azure-color-input-wrap"><input type="color" class="azure-color-picker" id="tv-ps" value="' + ds + '"><input type="text" class="azure-color-hex" id="tv-hs" value="' + ds + '" maxlength="7"></div><div class="azure-swatches">' + mkSw("s") + '</div></div>' +
            '</div>' +
            '<div style="display:flex;gap:8px;align-items:center;"><input type="text" id="tv-sname" class="azure-color-hex" placeholder="自定义预设名称（选填）" maxlength="18" style="flex:1;"><button type="button" class="primary" id="tv-apply">应用当前自定义</button></div>' +
          '</div></div>' +
          '<div class="azure-theme-sec"><div class="azure-theme-sec-hd"><span>自定义预设栏位</span><span>4 个可存槽位</span></div><div class="azure-theme-grid-2">' + slHtml + '</div></div>';
        var pp = panel.querySelector("#tv-pp"), ps = panel.querySelector("#tv-ps"), hp = panel.querySelector("#tv-hp"), hs = panel.querySelector("#tv-hs"), sn = panel.querySelector("#tv-sname");
        var upd = function (a, b) {
          var na = tvNormHex(a, dp), nb = tvNormHex(b, ds);
          tvThemeCfg.customDraft = { primary: na, secondary: nb };
          pp.value = na; hp.value = na; ps.value = nb; hs.value = nb;
          tvApplyPalette(na, nb);
        };
        panel.querySelector("#tv-th-close").addEventListener("click", tvCloseTheme);
        pp.addEventListener("input", function () { upd(pp.value, ps.value); });
        ps.addEventListener("input", function () { upd(pp.value, ps.value); });
        hp.addEventListener("change", function () { upd(hp.value, ps.value); });
        hs.addEventListener("change", function () { upd(pp.value, hs.value); });
        panel.querySelector("#tv-swab").addEventListener("click", function () { upd(ps.value, pp.value); });
        panel.querySelectorAll("[data-sr]").forEach(function (b) {
          b.addEventListener("click", function () {
            if (b.getAttribute("data-sr") === "p") upd(b.getAttribute("data-sh"), ps.value);
            else upd(pp.value, b.getAttribute("data-sh"));
          });
        });
        panel.querySelector("#tv-apply").addEventListener("click", function () {
          tvSaveTheme({ version: 1, activeId: "custom", customDraft: { primary: pp.value, secondary: ps.value }, slots: slots }).then(tvRenderThemeModal);
        });
        panel.querySelectorAll("[data-off]").forEach(function (b) {
          b.addEventListener("click", function () {
            var oid = b.getAttribute("data-off");
            var o = TV_OFFICIAL.filter(function (x) { return x.id === oid; })[0];
            tvSaveTheme({ version: 1, activeId: oid, customDraft: o ? { primary: o.primary, secondary: o.secondary } : tvThemeCfg.customDraft, slots: slots }).then(tvRenderThemeModal);
          });
        });
        panel.querySelectorAll("[data-sv]").forEach(function (b) {
          b.addEventListener("click", function () {
            var idx = Number(b.getAttribute("data-sv"));
            var ns = [slots[0] || null, slots[1] || null, slots[2] || null, slots[3] || null];
            ns[idx] = { id: "slot-" + idx, name: (sn.value || "").trim() || ("自定义 " + (idx + 1)), primary: pp.value, secondary: ps.value };
            tvSaveTheme({ version: 1, activeId: "slot-" + idx, customDraft: { primary: pp.value, secondary: ps.value }, slots: ns }).then(tvRenderThemeModal);
          });
        });
        panel.querySelectorAll("[data-us]").forEach(function (card) {
          card.addEventListener("click", function (ev) {
            if (ev.target && ev.target.closest(".azure-slot-act")) return;
            var idx = Number(card.getAttribute("data-us"));
            var sl = slots[idx];
            if (!sl) return;
            tvSaveTheme({ version: 1, activeId: "slot-" + idx, customDraft: { primary: sl.primary, secondary: sl.secondary }, slots: slots }).then(tvRenderThemeModal);
          });
        });
        panel.querySelectorAll("[data-ov]").forEach(function (b) {
          b.addEventListener("click", function (ev) {
            ev.stopPropagation();
            var idx = Number(b.getAttribute("data-ov"));
            var ns = [slots[0] || null, slots[1] || null, slots[2] || null, slots[3] || null];
            ns[idx] = { id: "slot-" + idx, name: (sn.value || "").trim() || (ns[idx] && ns[idx].name) || ("自定义 " + (idx + 1)), primary: pp.value, secondary: ps.value };
            tvSaveTheme({ version: 1, activeId: "slot-" + idx, customDraft: { primary: pp.value, secondary: ps.value }, slots: ns }).then(tvRenderThemeModal);
          });
        });
        panel.querySelectorAll("[data-cl]").forEach(function (b) {
          b.addEventListener("click", function (ev) {
            ev.stopPropagation();
            var idx = Number(b.getAttribute("data-cl"));
            var ns = [slots[0] || null, slots[1] || null, slots[2] || null, slots[3] || null];
            ns[idx] = null;
            var na = tvThemeCfg.activeId === ("slot-" + idx) ? "official-azure" : tvThemeCfg.activeId;
            tvSaveTheme({ version: 1, activeId: na, customDraft: tvThemeCfg.customDraft, slots: ns }).then(tvRenderThemeModal);
          });
        });
      };
      var btnTh = document.getElementById("btn-theme-studio");
      if (btnTh) {
        btnTh.addEventListener("click", function () {
          if (tvThemeMask) { tvCloseTheme(); return; }
          tvThemeMask = document.createElement("div");
          tvThemeMask.className = "azure-theme-mask";
          tvThemeMask.innerHTML = '<div class="azure-theme-panel"></div>';
          tvThemeMask.addEventListener("mousedown", function (ev) { if (ev.target === tvThemeMask) tvCloseTheme(); });
          document.body.appendChild(tvThemeMask);
          tvRenderThemeModal();
        });
      }
      try {
        var cachedT = JSON.parse(localStorage.getItem("azure_theme_cache_v1") || "null");
        if (cachedT && typeof cachedT === "object") tvThemeCfg = cachedT;
      } catch (e) {}
      tvApplyCurrent();
      rpc("theme", {}).then(function (r) {
        var d = extractPayload(r);
        if (d && d.config) { tvThemeCfg = d.config; tvApplyCurrent(); }
      });

      // Web UI 按钮：按需启动本地回环服务并在默认浏览器中打开
      var webBtn = document.getElementById("btn-open-web");
      if (webBtn) {
        webBtn.addEventListener("click", function () {
          if (!window.parent || window.parent === window) {
            toast("当前已在独立浏览器窗口中");
            return;
          }
          if (webBtn.disabled) return;
          var prev = webBtn.textContent;
          webBtn.disabled = true;
          webBtn.textContent = "打开中...";
          rpc("open_web", {}).then(function (r) {
            var d = extractPayload(r);
            if (d && d.ok) {
              webBtn.textContent = "已打开 ✓";
              toast("已在默认浏览器打开：" + (d.url || ""));
              setTimeout(function () { webBtn.textContent = prev; webBtn.disabled = false; }, 1200);
            } else {
              webBtn.textContent = prev;
              webBtn.disabled = false;
              toast("打开失败：" + ((d && (d.error || d.__error)) || "未知错误"));
            }
          }).catch(function () {
            webBtn.textContent = prev;
            webBtn.disabled = false;
          });
        });
      }

      // 版本号与点击检查更新
      var updBtn = document.getElementById("agy-upd-btn");
      var lastUpdInfo = null;
      var runUpdateCheck = function (force) {
        return rpc("check_update", { force: Boolean(force) }).then(function (r) {
          var data = extractPayload(r);
          if (!data || data.__error) return null;
          lastUpdInfo = data;
          if (updBtn) {
            if (data.hasUpdate) {
              updBtn.classList.add("has-update");
              updBtn.textContent = "⬆ v" + data.latestVersion;
              updBtn.title = "发现新版本 v" + data.latestVersion + "（当前 v" + data.currentVersion + "），点击打开/复制下载页";
            } else {
              updBtn.classList.remove("has-update");
              updBtn.textContent = "v" + (data.currentVersion || "1.0.0");
              updBtn.title = data.ok
                ? ("已是最新版本 v" + data.currentVersion + "（点击重新检查）")
                : ("当前 v" + (data.currentVersion || "1.0.0") + "（点击检查更新）");
            }
          }
          return data;
        });
      };
      if (updBtn) {
        updBtn.addEventListener("click", function () {
          if (lastUpdInfo && lastUpdInfo.hasUpdate && lastUpdInfo.releaseUrl) {
            try { window.open(lastUpdInfo.releaseUrl, "_blank"); } catch (e) {}
            try { navigator.clipboard.writeText(lastUpdInfo.releaseUrl); } catch (e) {}
            toast("已打开/复制新版本发布页：" + lastUpdInfo.releaseUrl);
            return;
          }
          updBtn.textContent = "检查中...";
          runUpdateCheck(true).then(function (info) {
            if (!info || !info.ok) {
              toast("检查更新失败：" + ((info && info.error) || "暂无公开发布或网络异常"));
            } else if (info.hasUpdate) {
              toast("发现新版本 v" + info.latestVersion + "（当前 v" + info.currentVersion + "），再次点击打开下载页");
            } else {
              toast("已是最新版本 v" + info.currentVersion);
            }
          });
        });
        setTimeout(function () { runUpdateCheck(false); }, 600);
      }
    } catch (err) { /* ignore */ }

    var snap = SNAPSHOT || {};
    state.sessions = Array.isArray(snap.sessions) ? snap.sessions : [];
    state.activeConversationId = snap.activeConversationId || null;
    state.entries = Array.isArray(snap.entries) ? snap.entries : [];
    state.channel = snap.channel || null;
    state.availableChannels = Array.isArray(snap.availableChannels) ? snap.availableChannels : [];
    state.config = snap.config || {};
    state.pollIntervalMs = Number(snap.config && snap.config.pollIntervalMs) || 3500;
    if (snap.config && snap.config.autoPoll === false) state.polling = false;

    if (snap.config && (snap.config.displayMode === "translation_only" || snap.config.displayMode === "bilingual")) {
      state.displayMode = snap.config.displayMode;
    }

    var modeToggle = document.getElementById("display-mode-toggle");
    var syncDisplayModeButtons = function () {
      if (!modeToggle) return;
      var btns = modeToggle.querySelectorAll("button[data-mode]");
      for (var i = 0; i < btns.length; i += 1) {
        btns[i].classList.toggle("active", btns[i].getAttribute("data-mode") === state.displayMode);
      }
    };
    if (modeToggle) {
      modeToggle.addEventListener("click", function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest("button[data-mode]") : null;
        if (!btn) return;
        var nextMode = btn.getAttribute("data-mode");
        if (nextMode !== "bilingual" && nextMode !== "translation_only") return;
        if (state.displayMode === nextMode) return;
        state.displayMode = nextMode;
        state.showOriginSet = {};
        syncDisplayModeButtons();
        render();
        rpc("config", { patch: { displayMode: nextMode } }).then(function (response) {
          var data = extractPayload(response);
          if (data && data.config) state.config = data.config;
        });
        toast(nextMode === "translation_only" ? "已切换为：仅看译文（可单条点「查看原文」）" : "已切换为：双语对照");
      });
    }
    syncDisplayModeButtons();

    var channelSel = document.getElementById("channel-select");
    if (channelSel) {
      channelSel.addEventListener("change", function () {
        var nextVal = String(channelSel.value || "").trim();
        rpc("config", { patch: { translationChannel: nextVal } }).then(function (response) {
          var data = extractPayload(response);
          if (!data || data.__error || data.ok === false) {
            toast("切换翻译模型失败：" + ((data && (data.__error || data.error || data.reason)) || "无响应"));
            renderChannel();
            return;
          }
          if (data.config) state.config = data.config;
          if (data.channel) state.channel = data.channel;
          if (Array.isArray(data.availableChannels)) state.availableChannels = data.availableChannels;
          renderChannel();
          var activeLbl = (state.channel && state.channel.label) ? state.channel.label : (nextVal || "自动");
          toast(nextVal ? ("已切换翻译模型：" + activeLbl) : ("已恢复自动跟随协奏台（当前：" + activeLbl + "）"));
        });
      });
    }

    render();
    startPolling();

    rpc("sessions", {}).then(function (response) {
      var data = extractPayload(response);
      if (!data || data.__error) {
        if (state.entries.length === 0 && state.sessions.length === 0) {
          toast("无法获取会话列表：" + (data && data.__error || "无响应"));
        }
        return;
      }
      applySessions(data);
      if (state.activeConversationId) refresh({ silent: true });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
</script>
</body>
</html>`;

function escapeForScript(json) {
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function buildViewerHtml(initialSnapshot = {}) {
  let json;
  try {
    json = escapeForScript(JSON.stringify(initialSnapshot ?? {}));
  } catch {
    json = "{}";
  }
  return PAGE_TEMPLATE.replace(SNAPSHOT_TOKEN, json);
}

export default { buildViewerHtml };
