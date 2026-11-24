/**
 * azure-prism / lib/reader.mjs
 * 读取 Antigravity brain 目录下的会话 transcript，抽取思考轨迹。
 * 纯 Node.js ESM，零外部依赖。
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";

export const SYSTEM_DIR = ".system_generated";
export const LOGS_DIR = "logs";
export const TRANSCRIPT_FILE = "transcript.jsonl";
export const TRANSCRIPT_FULL_FILE = "transcript_full.jsonl";

export function defaultBrainDir() {
  return path.join(os.homedir(), ".gemini", "antigravity", "brain");
}

export function logsDir(brainDir, conversationId) {
  return path.join(path.resolve(brainDir), conversationId, SYSTEM_DIR, LOGS_DIR);
}

export function transcriptPath(brainDir, conversationId, which = "main") {
  const name = which === "full" ? TRANSCRIPT_FULL_FILE : TRANSCRIPT_FILE;
  return path.join(logsDir(brainDir, conversationId), name);
}

/** 按行号懒加载的回读者：只扫描到目标行为止，不整体读取大文件。 */
class LazyLineReader {
  constructor(filePath, chunkSize = 256 * 1024) {
    this.filePath = filePath;
    this.chunkSize = chunkSize;
    this.fd = null;
    this.readAt = 0; // 下一个待读字节的绝对偏移
    this.carryStart = 0; // carry[0] 的绝对偏移
    this.carry = Buffer.alloc(0); // 尚未遇到换行的尾部数据
    this.lineStarts = [0]; // 已知行的起始绝对偏移
    this.eof = false;
  }

  _fd() {
    if (this.fd === null) this.fd = fs.openSync(this.filePath, "r");
    return this.fd;
  }

  close() {
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd);
      } catch {
        /* ignore */
      }
      this.fd = null;
    }
  }

  _scanChunk() {
    const fd = this._fd();
    const chunk = Buffer.allocUnsafe(this.chunkSize);
    const n = fs.readSync(fd, chunk, 0, this.chunkSize, this.readAt);
    if (n <= 0) {
      this.eof = true;
      return;
    }
    this.readAt += n;
    const incoming = Buffer.from(chunk.subarray(0, n));
    const data = this.carry.length ? Buffer.concat([this.carry, incoming]) : incoming;
    const dataStart = this.carryStart;
    let searchFrom = 0;
    let idx;
    while ((idx = data.indexOf(0x0a, searchFrom)) !== -1) {
      this.lineStarts.push(dataStart + idx + 1);
      searchFrom = idx + 1;
    }
    this.carry = Buffer.from(data.subarray(searchFrom));
    this.carryStart = dataStart + searchFrom;
  }

  _read(offset, length) {
    if (length <= 0) return "";
    const buf = Buffer.allocUnsafe(length);
    const fd = this._fd();
    let read = 0;
    while (read < length) {
      let n = 0;
      try {
        n = fs.readSync(fd, buf, read, length - read, offset + read);
      } catch {
        break;
      }
      if (n <= 0) break;
      read += n;
    }
    return buf
      .subarray(0, read)
      .toString("utf8")
      .replace(/\r$/, "");
  }

  /** 0 基行号取文本；越界或空行返回 null / ''。 */
  get(index) {
    if (!Number.isInteger(index) || index < 0) return null;
    while (this.lineStarts.length <= index + 1 && !this.eof) this._scanChunk();
    if (index + 1 < this.lineStarts.length) {
      const start = this.lineStarts[index];
      const end = this.lineStarts[index + 1]; // 含换行符
      return this._read(start, end - start - 1);
    }
    if (this.eof && this.carry.length > 0 && index === this.lineStarts.length - 1) {
      return this._read(this.lineStarts[index], this.readAt - this.lineStarts[index]);
    }
    return null;
  }
}

function asText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join("\n");
  if (typeof value === "object") {
    const direct = value.text ?? value.content ?? value.message ?? value.value;
    if (typeof direct === "string") return direct;
    if (direct !== undefined && direct !== null) return asText(direct);
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

function classify(obj) {
  const rawType = String(obj.type ?? obj.kind ?? obj.event ?? "").toUpperCase();
  const thinking = asText(obj.thinking ?? obj.reasoning ?? "");
  const toolCalls = Array.isArray(obj.tool_calls)
    ? obj.tool_calls
    : Array.isArray(obj.toolCalls)
      ? obj.toolCalls
      : [];

  if (rawType.includes("CHECKPOINT")) {
    const cp = obj.checkpoint ?? obj.content ?? obj.result ?? "";
    return {
      kind: "checkpoint",
      type: rawType || "CHECKPOINT",
      text: asText(cp),
      thinking,
      toolCalls,
    };
  }
  if (rawType.includes("USER_INPUT") || rawType.includes("USER_REQUEST")) {
    return {
      kind: "user",
      type: rawType || "USER_INPUT",
      text: asText(obj.content ?? obj.text ?? ""),
      thinking,
      toolCalls,
    };
  }
  if (rawType.includes("PLANNER_RESPONSE") || thinking) {
    return {
      kind: "thinking",
      type: rawType || "PLANNER_RESPONSE",
      text: thinking || asText(obj.content ?? ""),
      thinking,
      toolCalls,
    };
  }
  return null;
}

function summarizeToolCalls(toolCalls) {
  const names = [];
  for (const tc of toolCalls) {
    if (tc === null || tc === undefined) continue;
    const name =
      typeof tc === "string"
        ? tc
        : tc.name ?? tc.tool ?? tc.tool_name ?? tc.toolName ?? tc.function?.name ?? null;
    if (name && !names.includes(String(name))) names.push(String(name));
  }
  return names;
}

function isThinkingTruncated(obj) {
  return (
    Array.isArray(obj.truncated_fields) &&
    obj.truncated_fields.map((f) => String(f).toLowerCase()).includes("thinking")
  );
}

function extractEntry(obj, lineNumber) {
  if (!obj || typeof obj !== "object") return null;
  const cls = classify(obj);
  if (!cls) return null;
  const truncated = isThinkingTruncated(obj);
  const timestamp =
    obj.created_at ?? obj.createdAt ?? obj.timestamp ?? obj.time ?? obj.ts ?? null;
  return {
    lineNumber,
    kind: cls.kind,
    type: cls.type,
    source: obj.source ?? obj.role ?? null,
    status: obj.status ?? null,
    stepIndex:
      typeof obj.step_index === "number"
        ? obj.step_index
        : typeof obj.stepIndex === "number"
          ? obj.stepIndex
          : null,
    timestamp: timestamp === null ? null : String(timestamp),
    text: cls.text,
    truncated,
    truncatedFields: Array.isArray(obj.truncated_fields)
      ? obj.truncated_fields.map(String)
      : [],
    resolvedFrom: null,
    toolCalls: summarizeToolCalls(cls.toolCalls),
  };
}

function readHeadTitle(logPath) {
  try {
    const fd = fs.openSync(logPath, "r");
    const buf = Buffer.allocUnsafe(16384);
    const n = fs.readSync(fd, buf, 0, 16384, 0);
    fs.closeSync(fd);
    const head = buf.subarray(0, n).toString("utf8");
    for (const line of head.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{")) continue;
      let obj;
      try {
        obj = JSON.parse(trimmed);
      } catch {
        continue;
      }
      const raw = asText(obj?.content ?? obj?.text ?? "");
      if (!raw) continue;
      const cleaned = raw
        .replace(/<\/?USER_REQUEST>/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (cleaned) return cleaned.slice(0, 80);
    }
  } catch {
    /* ignore */
  }
  return "";
}

/**
 * 列出最近会话（按 transcript mtime 降序）。
 * 自动跳过没有 .system_generated/logs/transcript.jsonl 的目录（如 tempmediaStorage）。
 */
export function listRecentSessions(brainDir = defaultBrainDir(), limit = 30) {
  const root = path.resolve(brainDir);
  const max = Math.max(1, Number.isFinite(limit) ? Math.trunc(limit) : 30);
  let dirents = [];
  try {
    dirents = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const sessions = [];
  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;
    const conversationId = dirent.name;
    const logPath = transcriptPath(root, conversationId, "main");
    let stat;
    try {
      stat = fs.statSync(logPath);
    } catch {
      continue; // 没有 transcript 的目录（tempmediaStorage 等）直接跳过
    }
    if (!stat.isFile() || stat.size === 0) continue;

    const fullPath = transcriptPath(root, conversationId, "full");
    let fullStat = null;
    try {
      fullStat = fs.statSync(fullPath);
    } catch {
      fullStat = null;
    }

    sessions.push({
      conversationId,
      logPath,
      sizeBytes: stat.size,
      mtimeMs: stat.mtimeMs,
      updatedAt: new Date(stat.mtimeMs).toISOString(),
      hasFullLog: Boolean(fullStat && fullStat.isFile() && fullStat.size > 0),
      fullSizeBytes: fullStat && fullStat.isFile() ? fullStat.size : 0,
      title: readHeadTitle(logPath) || conversationId,
    });
  }

  sessions.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return sessions.slice(0, max);
}

/** 按 1 基行号从 transcript_full.jsonl 回读原始记录。 */
export function readFullRecord(brainDir, conversationId, lineNumber) {
  const fullPath = transcriptPath(brainDir, conversationId, "full");
  const reader = new LazyLineReader(fullPath);
  try {
    const line = reader.get(Math.trunc(lineNumber) - 1);
    if (!line) return null;
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    reader.close();
  }
}

/**
 * 读取某会话的思考轨迹。
 * @param {string} brainDir brain 根目录
 * @param {string} conversationId 会话 id
 * @param {{ onlyWithThinking?: boolean, limit?: number, hydrate?: boolean }} options
 */
const _thoughtReadCache = new Map();
const MAX_THOUGHT_CACHE = 8;

export async function readSessionThoughts(brainDir, conversationId, options = {}) {
  const {
    onlyWithThinking = true,
    limit = 120,
    hydrate = true,
  } = options;

  if (!conversationId) throw new Error("conversationId is required");
  const root = path.resolve(brainDir || defaultBrainDir());
  const logPath = transcriptPath(root, conversationId, "main");
  const fullLogPath = transcriptPath(root, conversationId, "full");

  let stat;
  try {
    stat = fs.statSync(logPath);
  } catch {
    return {
      conversationId,
      brainDir: root,
      logPath,
      fullLogPath,
      exists: false,
      updatedAt: null,
      totalLines: 0,
      matchedCount: 0,
      entryCount: 0,
      truncatedCount: 0,
      hydratedCount: 0,
      onlyWithThinking,
      limit,
      entries: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const fullStat = fs.existsSync(fullLogPath) ? (() => { try { return fs.statSync(fullLogPath); } catch { return null; } })() : null;
  const cacheKey = `${logPath}|${limit}|${onlyWithThinking}|${hydrate}`;
  const cachedEntry = _thoughtReadCache.get(cacheKey);
  if (
    cachedEntry &&
    cachedEntry.mtimeMs === stat.mtimeMs &&
    cachedEntry.size === stat.size &&
    cachedEntry.fullMtimeMs === (fullStat ? fullStat.mtimeMs : 0)
  ) {
    return {
      ...cachedEntry.result,
      entries: cachedEntry.result.entries.map((e) => ({ ...e })),
      generatedAt: new Date().toISOString(),
    };
  }

  const collected = [];
  let lineNumber = 0;
  let parseErrors = 0;
  const rl = readline.createInterface({
    input: fs.createReadStream(logPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    lineNumber += 1;
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      parseErrors += 1;
      continue;
    }
    // transcript.jsonl 已按会话目录隔离，带 conversation_id 的记录一律保留
    const entry = extractEntry(obj, lineNumber);
    if (!entry) continue;
    if (onlyWithThinking && entry.kind === "thinking" && !String(entry.text || "").trim()) continue;
    if (onlyWithThinking && entry.kind === "checkpoint" && !String(entry.text || "").trim()) continue;
    if (onlyWithThinking && entry.kind === "user" && !String(entry.text || "").trim()) continue;
    collected.push(entry);
  }

  const matchedCount = collected.length;
  const max = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 120;
  let entries = collected.slice(-max);

  const truncated = entries.filter((e) => e.truncated);
  let hydratedCount = 0;
  if (hydrate && truncated.length > 0 && fs.existsSync(fullLogPath)) {
    const reader = new LazyLineReader(fullLogPath);
    try {
      for (const entry of truncated) {
        try {
          const raw = reader.get(entry.lineNumber - 1);
          if (!raw) continue;
          const obj = JSON.parse(raw);
          const fullText = asText(obj?.thinking ?? obj?.reasoning ?? obj?.content ?? "");
          if (fullText && fullText.length > String(entry.text || "").length) {
            entry.text = fullText;
            entry.resolvedFrom = TRANSCRIPT_FULL_FILE;
            entry.truncated = false;
            hydratedCount += 1;
          }
        } catch {
          /* 单条回读失败不影响整体 */
        }
      }
    } finally {
      reader.close();
    }
  }

  const resultObj = {
    conversationId,
    brainDir: root,
    logPath,
    fullLogPath: fs.existsSync(fullLogPath) ? fullLogPath : null,
    exists: true,
    updatedAt: new Date(stat.mtimeMs).toISOString(),
    sizeBytes: stat.size,
    totalLines: lineNumber,
    parseErrors,
    matchedCount,
    entryCount: entries.length,
    truncatedCount: truncated.length,
    hydratedCount,
    onlyWithThinking,
    limit: max,
    entries,
    generatedAt: new Date().toISOString(),
  };
  if (_thoughtReadCache.size >= MAX_THOUGHT_CACHE) {
    const firstKey = _thoughtReadCache.keys().next().value;
    if (firstKey !== undefined) _thoughtReadCache.delete(firstKey);
  }
  _thoughtReadCache.set(cacheKey, {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    fullMtimeMs: fullStat ? fullStat.mtimeMs : 0,
    result: { ...resultObj, entries: entries.map((e) => ({ ...e })) },
  });
  return resultObj;
}

export default {
  defaultBrainDir,
  listRecentSessions,
  readSessionThoughts,
  readFullRecord,
  transcriptPath,
  logsDir,
};
