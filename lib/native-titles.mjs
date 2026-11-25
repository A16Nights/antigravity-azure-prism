import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import https from "node:https";

const DAEMON_DIR = path.join(os.homedir(), ".gemini", "antigravity", "daemon");
const CACHE_TTL_MS = 6000;

let cachedMap = null;
let cachedAt = 0;

function isPidAlive(pid) {
  const n = Number(pid);
  if (!Number.isInteger(n) || n <= 0) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch (err) {
    return err && err.code === "EPERM";
  }
}

function discoverHub() {
  const addr = String(process.env.ANTIGRAVITY_LS_ADDRESS || "").trim();
  const csrf = String(process.env.ANTIGRAVITY_CSRF_TOKEN || "").trim();
  if (addr && csrf) {
    const idx = addr.lastIndexOf(":");
    if (idx > 0) {
      const host = addr.slice(0, idx).replace(/^\[|\]$/g, "") || "127.0.0.1";
      const port = Number(addr.slice(idx + 1));
      if (Number.isInteger(port) && port > 0) {
        return { host, httpPort: port, httpsPort: 0, csrfToken: csrf };
      }
    }
  }
  try {
    if (!fs.existsSync(DAEMON_DIR)) return null;
    const files = fs
      .readdirSync(DAEMON_DIR)
      .filter((f) => /^hub_.*\.json$/i.test(f))
      .map((f) => {
        const full = path.join(DAEMON_DIR, f);
        try {
          return { full, mtimeMs: fs.statSync(full).mtimeMs };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    for (const item of files) {
      try {
        const j = JSON.parse(fs.readFileSync(item.full, "utf8"));
        const httpPort = Number(j.httpPort || 0);
        const httpsPort = Number(j.httpsPort || 0);
        if ((httpPort > 0 || httpsPort > 0) && j.csrfToken && isPidAlive(j.pid)) {
          return { host: "127.0.0.1", httpPort, httpsPort, csrfToken: String(j.csrfToken) };
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function postConnect({ proto, host, port, csrfToken, payload }) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload || {});
    const mod = proto === "https" ? https : http;
    const req = mod.request(
      {
        hostname: host || "127.0.0.1",
        port,
        path: "/product.v1.ConversationService/ListConversations",
        method: "POST",
        rejectUnauthorized: false,
        timeout: 2500,
        headers: {
          "Content-Type": "application/json",
          "Connect-Protocol-Version": "1",
          "Content-Length": Buffer.byteLength(body),
          "x-antigravity-csrf-token": csrfToken,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, data });
          } catch {
            resolve({ ok: false });
          }
        });
      }
    );
    req.on("timeout", () => {
      try { req.destroy(); } catch {}
      resolve({ ok: false });
    });
    req.on("error", () => resolve({ ok: false }));
    req.write(body);
    req.end();
  });
}

/**
 * 通过 Antigravity 2.35+ ConversationService 获取原生会话标题与运行态映射。
 * 失败时静默返回空 Map，不影响离线解析 transcript.jsonl。
 */
export async function fetchNativeSessionMap({ force = false, maxPages = 15 } = {}) {
  const now = Date.now();
  if (!force && cachedMap && now - cachedAt < CACHE_TTL_MS) {
    return cachedMap;
  }

  const hub = discoverHub();
  if (!hub) return new Map();

  const map = new Map();
  let pageToken = "";
  let pages = 0;

  while (pages < maxPages) {
    pages += 1;
    const payload = { pageSize: 100, includeArchived: true };
    if (pageToken) payload.pageToken = pageToken;

    let res = null;
    if (hub.httpPort > 0) {
      res = await postConnect({ proto: "http", host: hub.host, port: hub.httpPort, csrfToken: hub.csrfToken, payload });
    }
    if ((!res || !res.ok) && hub.httpsPort > 0) {
      res = await postConnect({ proto: "https", host: hub.host, port: hub.httpsPort, csrfToken: hub.csrfToken, payload });
    }
    if (!res || !res.ok) break;

    const list = Array.isArray(res.data?.conversations) ? res.data.conversations : [];
    for (const c of list) {
      if (!c || !c.id) continue;
      const title = String(c.annotations?.title || c.state?.summary || "").trim();
      const runState = String(c.state?.runState || "");
      map.set(String(c.id), {
        title,
        summary: String(c.state?.summary || "").trim(),
        runState,
        isRunning: runState === "RUN_STATE_RUNNING" || runState === "RUN_STATE_CANCELLING",
        archived: Boolean(c.annotations?.archived),
        pinned: Boolean(c.annotations?.pinned),
        starred: Boolean(c.annotations?.starred),
        updateTime: String(c.state?.updateTime || ""),
      });
    }

    pageToken = String(res.data?.nextPageToken || "").trim();
    if (!pageToken) break;
  }

  cachedMap = map;
  cachedAt = now;
  return map;
}
