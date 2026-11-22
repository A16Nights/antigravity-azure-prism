#!/usr/bin/env node
/**
 * thought-viewer / mcp-server.mjs
 * stdio JSON-RPC 2.0 MCP 服务端，零外部依赖。
 *
 * 工具：
 *   thought_viewer_open — 打开 UI 面板（_meta.ui.resourceUri + Antigravity entrypoints）
 *   thought_viewer_api  — UI 专用数据接口（visibility: ["app"]）
 */
import http from "node:http";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isLeftSidebarEnabled,
  setLeftSidebarEnabled,
  refreshAntigravityMcpServers,
} from "./lib/sidebar-nav.mjs";
import {
  OFFICIAL_THEME_PRESETS,
  readAzureThemeConfig,
  writeAzureThemeConfig,
  openLocalUrlInBrowser,
} from "./lib/azure-theme.mjs";
import { checkGithubUpdate } from "./lib/update-checker.mjs";

import {
  defaultBrainDir,
  listRecentSessions,
  readSessionThoughts,
} from "./lib/reader.mjs";
import {
  loadViewerConfig,
  saveViewerConfig,
  loadTranslationCache,
  saveTranslationCache,
  attachCachedTranslations,
  resolveTranslatorChannel,
  translateText,
  needsTranslation,
  translationCacheKey,
} from "./lib/translator.mjs";
import { buildViewerHtml } from "./lib/ui-html.mjs";

const SERVER_NAME = "thought-viewer";
const SERVER_VERSION = "1.0.0";
const VIEWER_URI = "ui://thought-viewer/viewer.html";
const VIEWER_MIME = "text/html;profile=mcp-app";
const PROTOCOL_VERSION = "2024-11-05";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function log(...args) {
  try {
    process.stderr.write(`[thought-viewer] ${args.map(String).join(" ")}\n`);
  } catch {
    /* ignore */
  }
}

function publicChannel(resolved) {
  if (!resolved || !resolved.ok || !resolved.channel) {
    return {
      ok: false,
      reason: resolved?.reason || "未找到可用翻译渠道",
      label: null,
      providerId: null,
      modelId: null,
      protocol: null,
      source: resolved?.source || null,
    };
  }
  return {
    ok: true,
    label: resolved.channel.label,
    providerId: resolved.channel.providerId,
    modelId: resolved.channel.modelId,
    protocol: resolved.channel.protocol,
    source: resolved.source || null,
  };
}

function textResult(payload) {
  const structured =
    payload && typeof payload === "object" && !Array.isArray(payload) ? payload : { value: payload };
  return {
    content: [{ type: "text", text: JSON.stringify(structured, null, 2) }],
    structuredContent: structured,
    isError: false,
  };
}

function errorResult(message) {
  const payload = { ok: false, error: String(message || "未知错误") };
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    isError: true,
  };
}

async function buildSnapshot(options = {}) {
  const viewerConfig = loadViewerConfig();
  const brainDir = options.brainDir || defaultBrainDir();
  const limit = Number.isFinite(options.sessionLimit)
    ? Math.trunc(options.sessionLimit)
    : viewerConfig.lastSessionLimit || 30;

  const sessions = listRecentSessions(brainDir, limit);
  const channel = publicChannel(resolveTranslatorChannel());

  let activeConversationId = options.conversationId || viewerConfig.lastConversationId || null;
  if (!activeConversationId || !sessions.some((s) => s.conversationId === activeConversationId)) {
    activeConversationId = sessions[0]?.conversationId ?? null;
  }

  let entries = [];
  let sessionInfo = null;
  if (activeConversationId) {
    try {
      const result = await readSessionThoughts(brainDir, activeConversationId, {
        onlyWithThinking: viewerConfig.onlyWithThinking !== false,
        limit: Number(viewerConfig.entryLimit) || 120,
      });
      entries = attachCachedTranslations(result.entries);
      sessionInfo = {
        exists: result.exists,
        updatedAt: result.updatedAt,
        entryCount: result.entryCount,
        matchedCount: result.matchedCount,
        truncatedCount: result.truncatedCount,
        hydratedCount: result.hydratedCount,
        logPath: result.logPath,
      };
    } catch (error) {
      log("snapshot read failed:", error?.message || error);
    }
  }

  return {
    brainDir,
    sessions,
    activeConversationId,
    entries,
    sessionInfo,
    channel,
    config: viewerConfig,
    generatedAt: new Date().toISOString(),
  };
}

async function handleOpen(args = {}) {
  const snapshot = await buildSnapshot({
    conversationId: args.conversationId,
    sessionLimit: args.sessionLimit,
  });
  const html = buildViewerHtml(snapshot);
  return {
    content: [
      {
        type: "text",
        text: `苍蓝棱镜已打开（会话 ${snapshot.activeConversationId || "无"}，条目 ${snapshot.entries.length}）。`,
      },
      { type: "text", text: `资源：${VIEWER_URI}` },
    ],
    structuredContent: {
      ok: true,
      uri: VIEWER_URI,
      mimeType: VIEWER_MIME,
      conversationId: snapshot.activeConversationId,
      sessionCount: snapshot.sessions.length,
      entryCount: snapshot.entries.length,
      channel: snapshot.channel,
      htmlLength: html.length,
    },
    _meta: {
      ui: { resourceUri: VIEWER_URI },
    },
  };
}

async function actionSessions(args) {
  const brainDir = args.brainDir || defaultBrainDir();
  const viewerConfig = loadViewerConfig();
  const limit = Number.isFinite(Number(args.limit)) ? Math.trunc(Number(args.limit)) : viewerConfig.lastSessionLimit || 30;
  const sessions = listRecentSessions(brainDir, limit);
  const channel = publicChannel(resolveTranslatorChannel());
  const active =
    args.conversationId ||
    viewerConfig.lastConversationId ||
    sessions[0]?.conversationId ||
    null;
  return {
    ok: true,
    brainDir,
    activeConversationId: active,
    sessions,
    channel,
    config: viewerConfig,
    generatedAt: new Date().toISOString(),
  };
}

async function actionRead(args) {
  const brainDir = args.brainDir || defaultBrainDir();
  const viewerConfig = loadViewerConfig();
  const sessions = listRecentSessions(brainDir, viewerConfig.lastSessionLimit || 30);
  let conversationId = args.conversationId || viewerConfig.lastConversationId || sessions[0]?.conversationId || null;
  if (!conversationId) {
    return {
      ok: false,
      error: "没有可读取的会话（brain 目录下未找到 transcript.jsonl）",
      brainDir,
      conversationId: null,
      entries: [],
      channel: publicChannel(resolveTranslatorChannel()),
      config: viewerConfig,
    };
  }
  const onlyWithThinking =
    typeof args.onlyWithThinking === "boolean" ? args.onlyWithThinking : viewerConfig.onlyWithThinking !== false;
  const limit = Number.isFinite(Number(args.limit)) && Number(args.limit) > 0 ? Math.trunc(Number(args.limit)) : Number(viewerConfig.entryLimit) || 120;

  const result = await readSessionThoughts(brainDir, conversationId, {
    onlyWithThinking,
    limit,
    hydrate: args.hydrate !== false,
  });
  const entries = attachCachedTranslations(result.entries);

  if (viewerConfig.lastConversationId !== conversationId) {
    saveViewerConfig({ lastConversationId: conversationId });
  }

  return {
    ok: true,
    brainDir,
    conversationId,
    exists: result.exists,
    updatedAt: result.updatedAt,
    logPath: result.logPath,
    fullLogPath: result.fullLogPath,
    totalLines: result.totalLines,
    matchedCount: result.matchedCount,
    entryCount: entries.length,
    truncatedCount: result.truncatedCount,
    hydratedCount: result.hydratedCount,
    onlyWithThinking,
    limit,
    entries,
    sessions,
    channel: publicChannel(resolveTranslatorChannel()),
    config: loadViewerConfig(),
    generatedAt: result.generatedAt,
  };
}

function actionConfig(args) {
  const current = loadViewerConfig();
  const patch = args.patch && typeof args.patch === "object" ? args.patch : null;
  const config = patch ? saveViewerConfig(patch) : current;
  const cache = loadTranslationCache();
  return {
    ok: true,
    config,
    configPath: "~/.gemini/thought-viewer/config.json",
    cachePath: "~/.gemini/thought-viewer/translation-cache.json",
    cacheCount: Object.keys(cache.entries).length,
    channel: publicChannel(resolveTranslatorChannel()),
  };
}

async function actionTranslateOne(args) {
  const text = typeof args.text === "string" ? args.text : "";
  if (!text.trim()) return { ok: false, reason: "未提供 text" };
  const result = await translateText(text, { force: args.force === true });
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason || "翻译失败",
      channel: result.channel || null,
      key: translationCacheKey(text),
    };
  }
  return {
    ok: true,
    translation: result.translation,
    cached: !!result.cached,
    skipped: !!result.skipped,
    channel: result.channel || null,
    key: translationCacheKey(text),
  };
}

async function actionTranslateLatest(args) {
  const brainDir = args.brainDir || defaultBrainDir();
  const viewerConfig = loadViewerConfig();
  const count = Number.isFinite(Number(args.count)) && Number(args.count) > 0 ? Math.trunc(Number(args.count)) : 5;
  const conversations = args.conversationId
    ? [{ conversationId: args.conversationId }]
    : listRecentSessions(brainDir, 1);

  if (conversations.length === 0) {
    return { ok: false, reason: "没有可读取的会话", translations: [] };
  }
  const conversationId = conversations[0].conversationId;
  const result = await readSessionThoughts(brainDir, conversationId, {
    onlyWithThinking: true,
    limit: Number(viewerConfig.entryLimit) || 120,
  });

  const cachedEntries = attachCachedTranslations(result.entries);
  const candidates = cachedEntries
    .filter((entry) => !entry.translation && needsTranslation(entry.text))
    .slice(-count);

  if (candidates.length === 0) {
    return {
      ok: true,
      conversationId,
      count: 0,
      translations: [],
      reason: "最近条目均已翻译或无需翻译",
      channel: publicChannel(resolveTranslatorChannel()).label,
    };
  }

  const translations = [];
  let lastChannel = null;
  for (const entry of candidates) {
    const outcome = await translateText(entry.text, {});
    if (outcome.ok && outcome.translation) {
      lastChannel = outcome.channel || lastChannel;
      translations.push({
        key: `${entry.lineNumber}:${entry.kind === "checkpoint" ? "CHECKPOINT" : entry.kind === "user" ? "USER_INPUT" : "THINKING"}`,
        lineNumber: entry.lineNumber,
        kind: entry.kind,
        channel: outcome.channel || null,
        cached: !!outcome.cached,
        translation: outcome.translation,
      });
    } else if (!outcome.ok) {
      log("translate_latest item failed:", outcome.reason || "unknown");
    }
  }

  return {
    ok: translations.length > 0,
    conversationId,
    count: translations.length,
    requested: candidates.length,
    translations,
    channel: lastChannel || publicChannel(resolveTranslatorChannel()).label || null,
    reason: translations.length === 0 ? "所有条目翻译失败，请检查翻译渠道配置" : undefined,
  };
}

let webServerPromise = null;

function ensureWebServer() {
  if (webServerPromise) return webServerPromise;
  webServerPromise = new Promise((resolve, reject) => {
    const srv = http.createServer(async (req, res) => {
      const urlPath = (req.url || "/").split("?")[0];
      if (req.method === "GET" && (urlPath === "/" || urlPath === "/index.html")) {
        try {
          const snap = await actionSessions({ limit: 30 });
          let entries = [];
          if (snap.activeConversationId) {
            const readRes = await actionRead({
              conversationId: snap.activeConversationId,
              onlyWithThinking: true,
              hydrate: true,
            });
            entries = readRes.entries || [];
          }
          const html = buildViewerHtml({
            sessions: snap.sessions || [],
            activeConversationId: snap.activeConversationId || null,
            entries,
            channel: snap.channel || null,
            config: snap.config || {},
          });
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
          res.end(html);
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(String(err?.message || err));
        }
        return;
      }
      if (req.method === "POST" && urlPath === "/api") {
        let raw = "";
        req.on("data", (c) => { raw += c; if (raw.length > 262144) raw = raw.slice(0, 262144); });
        req.on("end", async () => {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          try {
            const body = raw ? JSON.parse(raw) : {};
            const data = await handleApi(body);
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, data }));
          } catch (err) {
            res.writeHead(400);
            res.end(JSON.stringify({ ok: false, error: String(err?.message || err) }));
          }
        });
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
    });
    srv.on("error", (err) => {
      webServerPromise = null;
      reject(err);
    });
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server: srv, url: `http://127.0.0.1:${port}/` });
    });
    srv.unref();
  });
  return webServerPromise;
}

async function handleApi(args = {}) {
  const action = String(args.action || "read");
  switch (action) {
    case "sessions":
      return actionSessions(args);
    case "read":
      return actionRead(args);
    case "config":
      return actionConfig(args);
    case "translate_one":
      return actionTranslateOne(args);
    case "translate_latest":
      return actionTranslateLatest(args);
    case "sidebar_nav": {
      if (typeof args.showInLeftSidebar === "boolean") {
        setLeftSidebarEnabled("thought-viewer", args.showInLeftSidebar);
        const rf = await refreshAntigravityMcpServers();
        return {
          ok: true,
          pluginId: "thought-viewer",
          showInLeftSidebar: args.showInLeftSidebar,
          refreshed: Boolean(rf?.ok),
        };
      }
      return {
        ok: true,
        pluginId: "thought-viewer",
        showInLeftSidebar: isLeftSidebarEnabled("thought-viewer"),
      };
    }
    case "theme": {
      if (args.themeConfig && typeof args.themeConfig === "object") {
        const saved = writeAzureThemeConfig(args.themeConfig);
        return { ok: true, official: OFFICIAL_THEME_PRESETS, config: saved };
      }
      return { ok: true, official: OFFICIAL_THEME_PRESETS, config: readAzureThemeConfig() };
    }
    case "check_update": {
      const pluginRoot = path.dirname(fileURLToPath(import.meta.url));
      return checkGithubUpdate({
        pluginRoot,
        repo: "A16Nights/antigravity-azure-prism",
        force: Boolean(args.force),
      });
    }
    case "open_web": {
      const info = await ensureWebServer();
      const opened = openLocalUrlInBrowser(info.url);
      return { ok: opened.ok, url: info.url, error: opened.error || null };
    }
    default:
      throw new Error(`未知 action: ${action}`);
  }
}

const TOOLS = [
  {
    name: "thought_viewer_open",
    title: "打开苍蓝棱镜",
    description:
      "在 Antigravity 辅助面板或全局面板中打开苍蓝棱镜（Azure Prism）界面，展示会话的 PLANNER_RESPONSE.thinking、CHECKPOINT 与 USER_INPUT 记录。",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: {
          type: ["string", "null"],
          description: "要查看的会话 id，省略则使用最近更新的会话",
        },
        sessionLimit: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "会话下拉列表最多返回的会话数量，默认 30",
        },
      },
      additionalProperties: false,
    },
    _meta: {
      ui: { resourceUri: VIEWER_URI },
      "com.google.antigravity/ui": {
        entrypoints: [
          { type: "aux_pane", title: "苍蓝棱镜" },
          { type: "global", title: "苍蓝棱镜" },
        ],
      },
    },
  },
  {
    name: "thought_viewer_api",
    title: "苍蓝棱镜数据接口",
    description:
      "由查看器界面调用的数据接口。action 支持 sessions（会话列表）、read（读取思考轨迹）、config（读/写插件配置）、translate_one（翻译单条）、translate_latest（翻译最近若干条）。",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["sessions", "read", "config", "translate_one", "translate_latest", "sidebar_nav", "theme", "check_update", "open_web"],
          description: "要执行的操作",
        },
        force: {
          type: "boolean",
          description: "check_update 时是否跳过缓存强制重新检查",
        },
        themeConfig: {
          type: "object",
          description: "theme 时保存跨插件共享的主题色调配置",
        },
        showInLeftSidebar: {
          type: "boolean",
          description: "sidebar_nav 时设置是否在左侧栏显示入口按钮",
        },
        conversationId: {
          type: ["string", "null"],
          description: "目标会话 id",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 500,
          description: "sessions 时的会话数量上限；read 时的条目数量上限",
        },
        onlyWithThinking: {
          type: "boolean",
          description: "read 时是否只保留有内容的思考/分界/用户输入",
        },
        hydrate: {
          type: "boolean",
          description: "read 时是否对 truncated thinking 走 transcript_full.jsonl 回读补全",
        },
        text: {
          type: "string",
          description: "translate_one 时要翻译的原文",
        },
        force: {
          type: "boolean",
          description: "translate_one 时忽略缓存强制重新翻译",
        },
        count: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          description: "translate_latest 时要翻译的条目数量，默认 5",
        },
        patch: {
          type: "object",
          description: "config 时要写入的配置补丁",
          additionalProperties: true,
        },
        brainDir: {
          type: "string",
          description: "可选：覆盖 brain 根目录（默认 ~/.gemini/antigravity/brain）",
        },
      },
      required: ["action"],
      additionalProperties: false,
    },
    _meta: {
      ui: { visibility: ["app"] },
    },
  },
];

function listToolsResult() {
  const showGlobal = isLeftSidebarEnabled("thought-viewer");
  const dynamicTools = TOOLS.map((t) => {
    if (t.name !== "thought_viewer_open") return t;
    const entrypoints = showGlobal
      ? [
          { type: "aux_pane", title: "苍蓝棱镜" },
          { type: "global", title: "苍蓝棱镜" },
        ]
      : [{ type: "aux_pane", title: "苍蓝棱镜" }];
    return {
      ...t,
      _meta: {
        ...t._meta,
        "com.google.antigravity/ui": { entrypoints },
      },
    };
  });
  return { tools: dynamicTools };
}

function listResourcesResult() {
  return {
    resources: [
      {
        uri: VIEWER_URI,
        name: "苍蓝棱镜",
        title: "苍蓝棱镜",
        description:
          "单文件内联的思考轨迹查看界面：会话切换、3.5 秒自动轮询、折叠卡片、CHECKPOINT 分界线、单条翻译与批量翻译。",
        mimeType: VIEWER_MIME,
        _meta: {
          ui: { prefersBorder: false },
        },
      },
    ],
  };
}

async function readResourceResult(uri) {
  if (uri !== VIEWER_URI) {
    throw new Error(`未知资源: ${uri}`);
  }
  const snapshot = await buildSnapshot({});
  const html = buildViewerHtml(snapshot);
  return {
    contents: [
      {
        uri: VIEWER_URI,
        mimeType: VIEWER_MIME,
        text: html,
      },
    ],
  };
}

async function callTool(name, args = {}) {
  switch (name) {
    case "thought_viewer_open":
      return handleOpen(args);
    case "thought_viewer_api":
      return textResult(await handleApi(args));
    default:
      throw new Error(`未知工具: ${name}`);
  }
}

async function dispatch(method, params = {}) {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
        capabilities: {
          tools: {},
          resources: {},
        },
        serverInfo: {
          name: SERVER_NAME,
          title: "苍蓝棱镜",
          version: SERVER_VERSION,
        },
        instructions:
          "调用 thought_viewer_open 打开苍蓝棱镜；界面通过 thought_viewer_api 拉取数据。",
      };
    case "notifications/initialized":
      return null;
    case "ping":
      return {};
    case "tools/list":
      return listToolsResult();
    case "tools/call": {
      const name = params?.name;
      if (!name) throw new Error("tools/call 缺少 name");
      try {
        return await callTool(name, params?.arguments || {});
      } catch (error) {
        log("tool error:", error?.message || error);
        return errorResult(error?.message || String(error));
      }
    }
    case "resources/list":
      return listResourcesResult();
    case "resources/read": {
      const uri = params?.uri;
      if (!uri) throw new Error("resources/read 缺少 uri");
      try {
        return await readResourceResult(uri);
      } catch (error) {
        log("resource error:", error?.message || error);
        throw error;
      }
    }
    case "resources/templates/list":
      return { resourceTemplates: [] };
    case "prompts/list":
      return { prompts: [] };
    default:
      throw Object.assign(new Error(`不支持的方法: ${method}`), { code: -32601 });
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handleMessage(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON 解析失败" } });
    return;
  }
  if (Array.isArray(message)) {
    for (const item of message) await handleMessage(JSON.stringify(item));
    return;
  }
  if (!message || typeof message !== "object") return;

  const isNotification = message.id === undefined || message.id === null;
  const method = message.method;

  if (!method) {
    // 客户端对服务端请求的响应，忽略
    return;
  }
  if (isNotification) {
    if (method === "notifications/initialized" || method === "initialized") return;
    return;
  }

  try {
    const result = await dispatch(method, message.params || {});
    if (result === null) {
      send({ jsonrpc: "2.0", id: message.id, result: {} });
    } else {
      send({ jsonrpc: "2.0", id: message.id, result });
    }
  } catch (error) {
    const code = typeof error?.code === "number" ? error.code : -32603;
    send({
      jsonrpc: "2.0",
      id: message.id,
      error: { code, message: String(error?.message || error) },
    });
  }
}

function main() {
  log(`starting ${SERVER_NAME}@${SERVER_VERSION} (cwd=${process.cwd()})`);
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  let queue = Promise.resolve();
  rl.on("line", (line) => {
    queue = queue.then(() => handleMessage(line)).catch((error) => {
      log("handler crash:", error?.message || error);
    });
  });
  rl.on("close", () => {
    queue.finally(() => process.exit(0));
  });
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
}

main();
