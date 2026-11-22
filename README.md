# 苍蓝棱镜 · Azure Prism (`antigravity-azure-prism`)

面向 **Google Antigravity** 的原生模型思维链（Chain of Thought / Thinking）实时观测、检索与多通道中文翻译面板（原生 MCP App 侧栏面板 + 按需本地独立 Web UI）。

100% 只读解析 Antigravity 本地会话日志（`transcript.jsonl`，遇截断字段时自动按行懒加载 `transcript_full.jsonl`），在不干扰主对话、不消耗主脑上下文窗口的前提下，实时呈现模型每一步的内部思考过程、上下文压缩分界线（`CHECKPOINT`）与用户提问节点，并提供**自选外部模型翻译**与**内置免密钥零 Token 机器翻译**。

---

## ✨ 功能全景

### 1. 零侵入实时思维链解析与懒加载补全
- **只读解析原生日志**：自动扫描 `~/.gemini/antigravity/brain/<conversation-id>/.system_generated/logs/transcript.jsonl`，精准提取：
  - `PLANNER_RESPONSE.thinking`（模型每一步的完整内部推理链与对应工具调用名）；
  - `CHECKPOINT`（原生 `/compact` 上下文压缩分界线与摘要）；
  - `USER_INPUT`（用户每轮提问节点，形成清晰的问答思考脉络）。
- **截断思考自动补全**：当紧凑日志中 `truncated_fields` 包含 `thinking` 时，自动按对应行号从 `transcript_full.jsonl` 懒加载完整未截断思考内容。
- **3.5 秒自适应轮询 + 滚动锚定保护**：对话进行时自动静默刷新最新思考步骤；当视口上方卡片展开或译文回填导致高度变化时，自动补偿滚动位移，绝不打断当前阅读位置。

### 2. 多通道中文翻译（协奏台外部模型 + 内置免密钥零 Token 机器翻译）
- **自选翻译模型下拉选择器（`#channel-select`）**：
  - **自动跟随协奏台**：自动按 `fast` → `default` → 首个已启用渠道顺序复用 **[苍蓝协奏台](https://github.com/A16Nights/antigravity-external-orchestrator)** 的模型配置；
  - **手动指定任意外部模型**：可从下拉列表中直接选用苍蓝协奏台已启用的任意提供商与模型；
  - **内置免密钥 · 零 Token 机器翻译（`mt:google`）**：
    - 无需配置任何 API Key、不消耗任何大模型 Token，开箱即用实时翻译英文思考过程（参考 DSH 思考过程机器翻译体验）；
    - 内置 **Markdown 代码块与行内代码占位符保护**（确保代码片段、路径与命令标识符 100% 原样保留）、长文本按自然段智能切分，并在 Google 翻译偶发限流时**自动无缝降级至 MyMemory 免费翻译接口兜底**。
- **自动翻译 / 单条按需重译 + 本地持久化缓存**：
  - 支持开启「自动翻译」实时翻译新增英文思考，或点击单张卡片右上角 `译` 按钮按需翻译 / 使用当前新选模型强制重译；
  - 译文自动持久化缓存在本地 `~/.gemini/azure-prism/translation-cache.json`（含中英文占比智能跳过判断，纯中文思考不重复发起翻译）。

### 3. 「双语对照 / 仅看译文」一键切换
- 状态栏提供 **`双语` / `仅译文`** 分段切换开关（自动持久化到配置）：
  - **双语模式**：上方保留完整原文，下方展示带模型/渠道标注的中文译文区块；
  - **仅译文模式**：已翻译的思考卡片自动隐藏英文原文、仅展示清爽的中文译文，同时在译文右上角提供单条临时的 **`查看原文` / `隐藏原文`** 快捷按钮；尚未翻译的卡片仍正常显示原文不留白。

### 4. 双行智能筛选与卡片折叠控制
- **会话切换与状态指示**：支持在最近活跃的多个会话之间自由切换，实时显示各会话的思考步数与最后活跃时间。
- **关键词检索 & 仅看含思考步**：支持按关键词实时高亮过滤思考内容、一键切换「仅含思考 / 全部节点」、一键「全部展开 / 全部折叠」。

### 5. 原生 MCP App + 按需独立 Web UI + 苍蓝统一视觉体系
- **原生 MCP App 架构**：基于 `_meta.ui.resourceUri`（`ui://azure-prism/viewer.html`）直接嵌入 Antigravity 侧栏或全局面板，常驻零端口占用；点击顶栏 `Web UI` 按钮时按需懒启动本地回环 HTTP 服务并在系统默认浏览器全屏打开。
- **Neko Glass 毛玻璃界面 & 苍蓝主题色调中心**：深色/浅色切换、全量统一毛玻璃下拉框（`AzureSelect`）、7px 细圆角滚动条、6 套官方主题预设 + 自定义双色 + 4 个自定义栏位跨插件同步、左侧栏快捷入口开关与 GitHub Release 在线更新检查。

---

## 🚀 安装方式

> 前置要求：**Node.js >= 20.0.0**（零第三方 npm 依赖，纯 Node.js 原生 ESM 实现）。

将本仓库克隆或复制到 Antigravity 全局插件目录（目录名固定为 `azure-prism`）：

```powershell
# Windows (PowerShell)
git clone https://github.com/A16Nights/antigravity-azure-prism.git "$env:USERPROFILE\.gemini\config\plugins\azure-prism"

# macOS / Linux
git clone https://github.com/A16Nights/antigravity-azure-prism.git ~/.gemini/config/plugins/azure-prism
```

重启或重载 Antigravity（`Ctrl+R`），在 **Plugins** 面板启用 **苍蓝棱镜**，即可从左侧栏快捷入口或通过 MCP 工具 `azure_prism_open` 打开面板。

---

## 🧰 MCP 工具一览

| 工具名 | 作用 |
| --- | --- |
| `azure_prism_open` | 在 Antigravity 侧边栏或全局面板中打开苍蓝棱镜思维链观测界面 |
| `azure_prism_api` | 面板内部数据与控制接口（拉取会话思考快照、触发翻译、切换翻译模型/显示模式、管理主题与左侧栏开关、启动独立 Web UI、检查更新） |

---

## 📂 数据与配置存储

- **棱镜偏好配置**：`~/.gemini/azure-prism/config.json`（自动兼容迁移旧版 `~/.gemini/thought-viewer/` 数据）
- **译文持久化缓存**：`~/.gemini/azure-prism/translation-cache.json`
- **苍蓝套件共享主题 / 左侧栏配置**：`~/.gemini/azure-theme.json`、`~/.gemini/azure-sidebar-nav.json`

---

## 📄 License

[MIT](./LICENSE)
