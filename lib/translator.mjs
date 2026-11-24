/**
 * azure-prism / lib/translator.mjs
 * 复用 ~/.gemini/external-orchestrator/config.json 中的 provider 配置或内置机器翻译完成英文思考中文翻译。
 * 纯 Node.js ESM，零外部依赖（使用内置 fetch）。
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const LEGACY_VIEWER_DIR = path.join(os.homedir(), ".gemini", "thought-viewer");
export const VIEWER_DIR = path.join(os.homedir(), ".gemini", "azure-prism");
export const VIEWER_CONFIG_PATH = path.join(VIEWER_DIR, "config.json");
export const TRANSLATION_CACHE_PATH = path.join(VIEWER_DIR, "translation-cache.json");

// 自动兼容旧版 ~/.gemini/thought-viewer 数据目录，避免升级丢配置和缓存
try {
  if (!fs.existsSync(VIEWER_DIR) && fs.existsSync(LEGACY_VIEWER_DIR)) {
    fs.mkdirSync(VIEWER_DIR, { recursive: true });
    for (const fname of ["config.json", "translation-cache.json"]) {
      const src = path.join(LEGACY_VIEWER_DIR, fname);
      const dst = path.join(VIEWER_DIR, fname);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        fs.copyFileSync(src, dst);
      }
    }
  }
} catch {
  // 忽略迁移异常，后续按默认空配置运行
}
export const ORCHESTRATOR_CONFIG_PATH = path.join(
  os.homedir(),
  ".gemini",
  "external-orchestrator",
  "config.json",
);

export const CACHE_LIMIT = 1000;
export const CJK_MIN_RATIO = 0.25;
export const MIN_TRANSLATE_LENGTH = 20;

const DEFAULT_VIEWER_CONFIG = {
  autoTranslate: false,
  pollIntervalMs: 3500,
  translationEnabled: true,
  translationChannel: "",
  displayMode: "bilingual",
  targetLanguage: "zh-CN",
  lastConversationId: null,
  lastSessionLimit: 30,
  onlyWithThinking: true,
  entryLimit: 120,
};

const BUILTIN_MT_CHANNELS = [
  {
    value: "mt:google",
    providerId: "mt",
    providerName: "机器翻译",
    modelId: "google",
    label: "机器翻译 / Google 翻译（免密钥 · 零Token）",
    shortLabel: "机器翻译:Google",
    protocol: "google-mt",
    baseUrl: "https://translate.googleapis.com/translate_a/single",
  },
];

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore */
  }
}

function readJsonSafe(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
    return fallback;
  } catch {
    return fallback;
  }
}

/** 原子写：先写临时文件再 rename，避免半截 JSON。 */
export function atomicWriteJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const body = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmp, body, "utf8");
  try {
    fs.renameSync(tmp, filePath);
  } catch {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
    fs.writeFileSync(filePath, body, "utf8");
  }
  return filePath;
}

export function loadViewerConfig() {
  const stored = readJsonSafe(VIEWER_CONFIG_PATH, {});
  return { ...DEFAULT_VIEWER_CONFIG, ...stored };
}

export function saveViewerConfig(patch = {}) {
  const merged = { ...loadViewerConfig(), ...(patch && typeof patch === "object" ? patch : {}) };
  atomicWriteJson(VIEWER_CONFIG_PATH, merged);
  return merged;
}

function cacheKey(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex").slice(0, 16);
}

export function loadTranslationCache() {
  const data = readJsonSafe(TRANSLATION_CACHE_PATH, {});
  const entries =
    data && typeof data.entries === "object" && data.entries !== null ? data.entries : {};
  return { version: 1, entries };
}

export function saveTranslationCache(cache) {
  const entries =
    cache && typeof cache.entries === "object" && cache.entries !== null ? cache.entries : {};
  const keys = Object.keys(entries);
  let trimmed = entries;
  if (keys.length > CACHE_LIMIT) {
    const ordered = keys
      .map((key) => ({ key, at: Number(entries[key]?.at) || 0 }))
      .sort((a, b) => b.at - a.at)
      .slice(0, CACHE_LIMIT);
    trimmed = {};
    for (const { key } of ordered) trimmed[key] = entries[key];
  }
  atomicWriteJson(TRANSLATION_CACHE_PATH, {
    version: 1,
    updatedAt: new Date().toISOString(),
    count: Object.keys(trimmed).length,
    entries: trimmed,
  });
  return { version: 1, entries: trimmed };
}

export function cacheTranslation(text, translation, channel = null) {
  if (!text || !translation) return null;
  const cache = loadTranslationCache();
  cache.entries[cacheKey(text)] = {
    text: String(text).slice(0, 200),
    translation: String(translation),
    channel: channel || null,
    at: Date.now(),
  };
  return saveTranslationCache(cache);
}

/** 中文（CJK 字符）占比；用于判断是否需要翻译。 */
export function cjkRatio(text) {
  const raw = String(text ?? "");
  const chars = Array.from(raw.replace(/\s+/g, ""));
  if (chars.length === 0) return 0;
  let cjk = 0;
  for (const ch of chars) {
    const code = ch.codePointAt(0);
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0xff00 && code <= 0xffef)
    ) {
      cjk += 1;
    }
  }
  return cjk / chars.length;
}

export function needsTranslation(text) {
  const raw = String(text ?? "").trim();
  if (raw.length < MIN_TRANSLATE_LENGTH) return false;
  return cjkRatio(raw) < CJK_MIN_RATIO;
}

function normalizeBaseUrl(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

function pickModel(provider) {
  const candidates = [
    provider?.modelId,
    provider?.model_id,
    provider?.model,
    provider?.defaultModel,
    provider?.default_model,
    Array.isArray(provider?.models) ? provider.models[0] : undefined,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (c && typeof c === "object" && typeof c.id === "string") return c.id.trim();
  }
  return null;
}

function detectProtocol(provider, modelId) {
  const declared = String(
    provider?.protocol ?? provider?.apiType ?? provider?.api_type ?? provider?.type ?? "",
  ).toLowerCase();
  if (declared.includes("anthropic") || declared.includes("claude") || declared === "messages") {
    return "anthropic";
  }
  if (declared.includes("openai") || declared.includes("chat") || declared.includes("completions")) {
    return "openai";
  }
  const base = String(provider?.baseUrl ?? provider?.base_url ?? provider?.endpoint ?? "").toLowerCase();
  if (base.includes("anthropic")) return "anthropic";
  if (/claude/i.test(String(modelId || ""))) return "anthropic";
  return "openai";
}

function normalizeProviders(config) {
  const list = [];
  const raw = config?.providers ?? config?.provider ?? config?.api?.providers;
  if (Array.isArray(raw)) {
    raw.forEach((p, i) => {
      if (p && typeof p === "object") {
        list.push({ id: String(p.id ?? p.name ?? p.providerId ?? `provider-${i + 1}`), provider: p });
      }
    });
  } else if (raw && typeof raw === "object") {
    for (const [id, p] of Object.entries(raw)) {
      if (p && typeof p === "object") list.push({ id: String(p.id ?? id), provider: p });
    }
  } else if (config && typeof config === "object") {
    // 兜底：顶层形如 { openai: {...}, anthropic: {...} } 的写法
    for (const [id, p] of Object.entries(config)) {
      if (p && typeof p === "object" && (p.baseUrl || p.base_url || p.apiKey || p.api_key || p.model)) {
        list.push({ id, provider: p });
      }
    }
  }
  return list;
}

function isProviderEnabled(provider) {
  if (!provider || typeof provider !== "object") return false;
  for (const key of ["enabled", "enable", "active"]) {
    if (typeof provider[key] === "boolean") return provider[key];
  }
  const status = String(provider.status ?? "").toLowerCase();
  if (status) return status !== "disabled" && status !== "off" && status !== "inactive";
  return true;
}

function buildChannel(providerId, provider) {
  if (!provider || typeof provider !== "object") return null;
  const modelId = pickModel(provider);
  if (!modelId) return null;
  const baseUrl = normalizeBaseUrl(
    provider.baseUrl ?? provider.base_url ?? provider.endpoint ?? provider.apiBase ?? provider.api_base,
  );
  if (!baseUrl) return null;
  let apiKey = provider.apiKey ?? provider.api_key ?? provider.key ?? provider.token ?? "";
  if (!apiKey && typeof provider.apiKeyEnv === "string" && process.env[provider.apiKeyEnv]) {
    apiKey = process.env[provider.apiKeyEnv];
  }
  const protocol = detectProtocol(provider, modelId);
  return {
    providerId: String(providerId),
    modelId,
    protocol,
    baseUrl,
    apiKey: String(apiKey || ""),
    label: `${providerId}:${modelId}`,
    maxTokens: Number(provider.maxTokens ?? provider.max_tokens) || 2048,
    headers: provider.headers && typeof provider.headers === "object" ? provider.headers : {},
  };
}

function resolveFromRoutingId(id, providers) {
  const raw = String(id || "").trim();
  if (!raw) return null;
  const byColon = raw.split(":");
  const wantProvider = byColon.length > 1 ? byColon[0].trim() : null;
  const wantModel = byColon.length > 1 ? byColon.slice(1).join(":").trim() : null;
  for (const { id: pid, provider } of providers) {
    if (wantProvider && pid !== wantProvider) continue;
    if (!isProviderEnabled(provider)) continue;
    const channel = buildChannel(pid, provider);
    if (!channel) continue;
    if (wantModel) {
      channel.modelId = wantModel;
      channel.label = `${channel.providerId}:${wantModel}`;
    }
    return channel;
  }
  return null;
}

/**
 * 列出 external-orchestrator 中所有已启用渠道的全部可选模型，供 UI 自由切换翻译模型。
 */
export function listAvailableTranslatorChannels(orchestratorConfig = null) {
  const out = [];
  const seen = new Set();

  for (const mt of BUILTIN_MT_CHANNELS) {
    seen.add(mt.value);
    out.push({
      value: mt.value,
      providerId: mt.providerId,
      providerName: mt.providerName,
      modelId: mt.modelId,
      label: mt.label,
      protocol: mt.protocol,
    });
  }

  const config =
    orchestratorConfig && typeof orchestratorConfig === "object"
      ? orchestratorConfig
      : readJsonSafe(ORCHESTRATOR_CONFIG_PATH, null);
  if (!config) return out;

  const providers = normalizeProviders(config);

  for (const { id: pid, provider } of providers) {
    if (!isProviderEnabled(provider)) continue;
    const baseUrl = normalizeBaseUrl(
      provider.baseUrl ?? provider.base_url ?? provider.endpoint ?? provider.apiBase ?? provider.api_base,
    );
    if (!baseUrl) continue;

    const providerName = String(provider.name || pid).trim() || pid;
    const modelIds = [];
    const pushModel = (m) => {
      if (typeof m === "string" && m.trim()) modelIds.push(m.trim());
      else if (m && typeof m === "object" && typeof m.id === "string" && m.id.trim()) modelIds.push(m.id.trim());
    };
    pushModel(provider.defaultModel);
    pushModel(provider.default_model);
    pushModel(provider.model);
    pushModel(provider.modelId);
    pushModel(provider.model_id);
    if (Array.isArray(provider.models)) {
      for (const m of provider.models) pushModel(m);
    }

    for (const modelId of modelIds) {
      const value = `${pid}:${modelId}`;
      if (seen.has(value)) continue;
      seen.add(value);
      out.push({
        value,
        providerId: pid,
        providerName,
        modelId,
        label: `${providerName} / ${modelId}`,
        protocol: detectProtocol(provider, modelId),
      });
    }
  }
  return out;
}

/**
 * 解析翻译渠道：viewerConfig.translationChannel（用户自选）→ routing.profiles.fast.primary → routing.profiles.default.primary → 首个已启用 provider。
 */
export function resolveTranslatorChannel(orchestratorConfig = null, preferredChannel = undefined) {
  const preferred =
    typeof preferredChannel === "string"
      ? preferredChannel.trim()
      : String(loadViewerConfig().translationChannel || "").trim();

  if (preferred) {
    const mtHit = BUILTIN_MT_CHANNELS.find((m) => m.value === preferred);
    if (mtHit) {
      return {
        ok: true,
        source: "builtin-mt",
        channel: {
          providerId: mtHit.providerId,
          modelId: mtHit.modelId,
          protocol: mtHit.protocol,
          baseUrl: mtHit.baseUrl,
          apiKey: "",
          label: mtHit.shortLabel,
          maxTokens: 0,
          headers: {},
        },
        configPath: VIEWER_CONFIG_PATH,
      };
    }
  }

  const config =
    orchestratorConfig && typeof orchestratorConfig === "object"
      ? orchestratorConfig
      : readJsonSafe(ORCHESTRATOR_CONFIG_PATH, null);

  if (!config) {
    return {
      ok: false,
      reason: `未找到 ${ORCHESTRATOR_CONFIG_PATH}`,
      configPath: ORCHESTRATOR_CONFIG_PATH,
      channel: null,
    };
  }

  const providers = normalizeProviders(config);
  if (preferred) {
    const customChannel = resolveFromRoutingId(preferred, providers);
    if (customChannel) {
      return {
        ok: true,
        source: "viewer-config",
        channel: customChannel,
        configPath: ORCHESTRATOR_CONFIG_PATH,
      };
    }
  }

  const profiles = config?.routing?.profiles ?? config?.profiles ?? {};
  const candidates = [
    ["routing.profiles.fast.primary", profiles?.fast?.primary],
    ["routing.profiles.default.primary", profiles?.default?.primary],
  ];

  for (const [source, id] of candidates) {
    const channel = resolveFromRoutingId(id, providers);
    if (channel) return { ok: true, source, channel, configPath: ORCHESTRATOR_CONFIG_PATH };
  }

  for (const { id, provider } of providers) {
    if (!isProviderEnabled(provider)) continue;
    const channel = buildChannel(id, provider);
    if (channel) {
      return {
        ok: true,
        source: "first-enabled-provider",
        channel,
        configPath: ORCHESTRATOR_CONFIG_PATH,
      };
    }
  }

  return {
    ok: false,
    reason: "external-orchestrator 配置中未找到可用的翻译 provider",
    configPath: ORCHESTRATOR_CONFIG_PATH,
    channel: null,
  };
}

const SYSTEM_PROMPT =
  "你是技术翻译。把用户给出的模型思考片段翻译成简体中文，保留代码、命令、变量名、专有名词原样。" +
  "只输出译文，不要解释，不要添加前后缀。";

async function callOpenAi(channel, text, timeoutMs) {
  const url = /\/chat\/completions$/.test(channel.baseUrl)
    ? channel.baseUrl
    : `${channel.baseUrl}/chat/completions`;
  const headers = {
    "content-type": "application/json",
    ...channel.headers,
  };
  if (channel.apiKey) headers.authorization = `Bearer ${channel.apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: channel.modelId,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        temperature: 0.2,
        max_tokens: channel.maxTokens,
      }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
    const json = JSON.parse(body);
    const content = json?.choices?.[0]?.message?.content;
    return asString(content);
  } finally {
    clearTimeout(timer);
  }
}

async function callAnthropic(channel, text, timeoutMs) {
  const url = /\/messages$/.test(channel.baseUrl)
    ? channel.baseUrl
    : `${channel.baseUrl}/messages`;
  const headers = {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
    ...channel.headers,
  };
  if (channel.apiKey) {
    headers["x-api-key"] = channel.apiKey;
    if (!headers.authorization) headers.authorization = `Bearer ${channel.apiKey}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: channel.modelId,
        system: SYSTEM_PROMPT,
        max_tokens: channel.maxTokens,
        temperature: 0.2,
        messages: [{ role: "user", content: text }],
      }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
    const json = JSON.parse(body);
    if (Array.isArray(json?.content)) {
      return json.content
        .map((part) => (typeof part === "string" ? part : asString(part?.text ?? "")))
        .join("\n")
        .trim();
    }
    return asString(json?.completion ?? json?.content);
  } finally {
    clearTimeout(timer);
  }
}

function protectCodeSegments(text) {
  const tokens = [];
  const stash = (match) => {
    const idx = tokens.length;
    tokens.push(match);
    return `ZZCODE${idx}ZZ`;
  };
  let masked = String(text || "");
  masked = masked.replace(/```[\s\S]*?```/g, stash);
  masked = masked.replace(/`[^`\r\n]+`/g, stash);
  return { masked, tokens };
}

function restoreCodeSegments(text, tokens) {
  let out = String(text || "");
  for (let i = 0; i < tokens.length; i += 1) {
    out = out.replace(new RegExp(`ZZCODE\\s*${i}\\s*ZZ`, "gi"), () => tokens[i]);
  }
  return out;
}

function splitIntoMtChunks(text, maxLen = 1400) {
  const raw = String(text || "");
  if (raw.length <= maxLen) return [raw];
  const paras = raw.split(/(\n{2,})/);
  const chunks = [];
  let cur = "";
  for (const part of paras) {
    if ((cur + part).length <= maxLen) {
      cur += part;
    } else {
      if (cur) chunks.push(cur);
      if (part.length <= maxLen) {
        cur = part;
      } else {
        for (let i = 0; i < part.length; i += maxLen) {
          chunks.push(part.slice(i, i + maxLen));
        }
        cur = "";
      }
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

async function callGoogleMtChunk(chunk, timeoutMs) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=" +
    encodeURIComponent(chunk);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`Google MT HTTP ${res.status}`);
    const json = JSON.parse(body);
    if (!Array.isArray(json?.[0])) throw new Error("Google MT 返回格式异常");
    return json[0].map((seg) => (Array.isArray(seg) ? String(seg[0] ?? "") : "")).join("");
  } finally {
    clearTimeout(timer);
  }
}

async function callMyMemoryMtChunk(chunk, timeoutMs) {
  const url =
    "https://api.mymemory.translated.net/get?langpair=en|zh-CN&q=" +
    encodeURIComponent(chunk);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    const body = await res.text();
    if (!res.ok) throw new Error(`MyMemory MT HTTP ${res.status}`);
    const json = JSON.parse(body);
    const txt = json?.responseData?.translatedText;
    if (typeof txt !== "string" || !txt.trim()) throw new Error("MyMemory 返回空译文");
    return txt;
  } finally {
    clearTimeout(timer);
  }
}

async function callGoogleMt(text, timeoutMs) {
  const { masked, tokens } = protectCodeSegments(text);
  const chunks = splitIntoMtChunks(masked, 1200);
  const parts = [];
  for (const ch of chunks) {
    if (!ch.trim()) {
      parts.push(ch);
      continue;
    }
    try {
      parts.push(await callGoogleMtChunk(ch, timeoutMs));
    } catch (err) {
      // Google 偶发限流时自动降级到 MyMemory 免费翻译（按 <=450 字再切分）
      try {
        const subChunks = splitIntoMtChunks(ch, 450);
        const subParts = [];
        for (const sc of subChunks) {
          if (!sc.trim()) { subParts.push(sc); continue; }
          subParts.push(await callMyMemoryMtChunk(sc, timeoutMs));
        }
        parts.push(subParts.join(""));
      } catch (fallbackErr) {
        throw new Error(`Google 翻译失败(${err?.message || err})，MyMemory 降级亦失败(${fallbackErr?.message || fallbackErr})`);
      }
    }
  }
  return restoreCodeSegments(parts.join(""), tokens).trim();
}

function asString(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : asString(v?.text ?? v?.content ?? "")))
      .join("\n")
      .trim();
  }
  if (typeof value === "object") return asString(value.text ?? value.content ?? "");
  return String(value);
}

/**
 * 翻译单段文本，带缓存。
 * @returns {Promise<{ok:boolean, translation?:string, cached?:boolean, channel?:string, reason?:string}>}
 */
export async function translateText(text, options = {}) {
  const source = String(text ?? "").trim();
  if (!source) return { ok: false, reason: "空文本" };
  if (!options.force && !needsTranslation(source)) {
    return { ok: true, translation: source, cached: true, skipped: true, channel: null };
  }

  const key = cacheKey(source);
  if (!options.force) {
    const cache = loadTranslationCache();
    const hit = cache.entries[key];
    if (hit && typeof hit.translation === "string" && hit.translation) {
      return {
        ok: true,
        translation: hit.translation,
        cached: true,
        channel: hit.channel ?? null,
      };
    }
  }

  const viewerConfig = loadViewerConfig();
  if (viewerConfig.translationEnabled === false) {
    return { ok: false, reason: "翻译已在插件配置中关闭" };
  }

  const resolved =
    options.channel && options.channel.baseUrl
      ? { ok: true, source: "explicit", channel: options.channel }
      : resolveTranslatorChannel();
  if (!resolved.ok || !resolved.channel) {
    return { ok: false, reason: resolved.reason || "未找到可用翻译渠道" };
  }

  const channel = resolved.channel;
  const timeoutMs = Math.max(5000, Number(options.timeoutMs) || 45000);
  try {
    const translation =
      channel.protocol === "google-mt"
        ? await callGoogleMt(source, timeoutMs)
        : channel.protocol === "anthropic"
          ? await callAnthropic(channel, source, timeoutMs)
          : await callOpenAi(channel, source, timeoutMs);
    if (!translation) return { ok: false, reason: "模型返回空译文", channel: channel.label };
    cacheTranslation(source, translation, channel.label);
    return {
      ok: true,
      translation,
      cached: false,
      channel: channel.label,
      source: resolved.source,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error?.name === "AbortError" ? "翻译请求超时" : String(error?.message || error),
      channel: channel.label,
    };
  }
}

/**
 * 给条目批量附加缓存译文（不发网络请求）。
 */
export function attachCachedTranslations(entries, cacheInput = null) {
  const list = Array.isArray(entries) ? entries : [];
  const cache = cacheInput && cacheInput.entries ? cacheInput : loadTranslationCache();
  return list.map((entry) => {
    const text = String(entry?.text ?? "");
    const key = cacheKey(text);
    const hit = cache.entries[key];
    return {
      ...entry,
      translation: hit && typeof hit.translation === "string" ? hit.translation : null,
      translationChannel: hit?.channel ?? null,
      needsTranslation: needsTranslation(text),
      translationKey: key,
    };
  });
}

export function translationCacheKey(text) {
  return cacheKey(text);
}

export default {
  loadViewerConfig,
  saveViewerConfig,
  loadTranslationCache,
  saveTranslationCache,
  attachCachedTranslations,
  resolveTranslatorChannel,
  translateText,
  needsTranslation,
  cjkRatio,
  translationCacheKey,
};
