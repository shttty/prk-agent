# Pi SDK 本地参考文档

这组文件从 Pi 官方文档和官方示例下载，用于项目开发时查 SDK、Extensions、TUI 组件和工具 renderer 的语义。

## 来源

- [SDK](https://pi.dev/docs/latest/sdk)
- [Extensions](https://pi.dev/docs/latest/extensions)
- [TUI Components](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/tui.md)
- [Built-in tool renderer example](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/examples/extensions/built-in-tool-renderer.ts)

本目录转载的文档及示例来自 [Pi（pi-mono）](https://github.com/earendil-works/pi)，Copyright (c) 2025 Mario Zechner，按 [MIT License](LICENSE) 授权；本目录的 PRK 核对与补丁说明同样按 MIT 授权。

## 使用边界

1. 实现新功能时，如果不清楚 Pi SDK 的函数、方法、事件、组件或 renderer 规则，先查这里。
2. 再用当前安装版本的 `.d.ts`、源码和真实 probe 核对；本地文档不是脱离版本的契约。
3. 文档、类型声明和运行行为冲突时，先报告具体差异，不凭印象猜接口。
4. 不要因为文档没有描述某个内部方法，就自行复制运行时、添加影子状态或修改上游实现。

## 文件

- `sdk.md`：内嵌 SDK、`AgentSession`、session lifecycle、prompt、事件、配置和资源加载。
- `extensions.md`：Extension API、工具、事件、renderer、UI、状态和模式边界。
- `tui.md`：`Component`、`custom()`、overlay、内置组件、输入、主题和生命周期。
- `examples-built-in-tool-renderer.md`：`renderCall`、`renderResult`、`renderShell` 的完整工具 renderer 示例。
- [Pi SDK 补丁](patches.md)：现有改动、原因、启动检查与适用版本。

下载时间：2026-10-12。

## Pi 1.6.0 核对（2026-11-23）

来源：[v1.6.0 发布说明](https://github.com/earendil-works/pi/releases/tag/v1.6.0)及同版 npm 包的 changelog、声明和 JS。根锁内 Pi／Chord 各包同版。

- Pi 的破坏性变更是组件 `render()` 返回 `readonly string[]`，`Container` 可复用同一数组。PRK 的 Web 投影只读 SDK 行；工具 render 的前后快照仍各自复制，避免比较受后续渲染影响。Pi TUI 新增进程挂起处理接口；Web 宿主不拥有终端，沿用 `unsupportedTui` 明确拒绝。
- 已批准的 keybindings、远程 `tools/index`、`event-bus` 的 JS 和声明未变；工具工厂和总线仍由 Pi 包根原样导出。版本闸门更新至 1.6.0，未新增内部导入。UI probe 的导出组件仍为 pi-tui 16 项、coding-agent 26 项。
- `AgentSession`／`SessionManager` 没有 PRK 所用公开签名或历史格式改动。SDK 修正空绑定 reload 后 `session_start`、已恢复 MCP 工具、未开始的取消工具结果与模型重试等行为；不增加 PRK 会话／插件生命周期逻辑。
- `find` 含 `/` 的 glob 改为相对搜索目录匹配；原生工具调用直接继承，以 `**/src/*.ts` 搜任意层级的 `src`。GPT-6.2 Sol 默认模型、Qwen 退休模型及官方 Anthropic 域上的 threads 默认范围由 SDK 管理，不改 PRK 模型配置。
- Chord 的 breaking 项为 `createWorkers` 要求传 `store`、`telemetryIngestFacet` 要求 `admit`、`HostError.query_failed.table` 改为 `.query`；PRK 不使用这些接口。1.6.0 将 `ws` 的精确 peer 约束改为 `^8.21.0`。pi-env 的 Connection／Terminal／Process 声明及 wire protocol 保持，更新精确 daemon 版本和缓存目录；原版 daemon 修复背压时进程退出丢尾输出。
- 保留 rebrand、provider policy、Google `xhigh` 和五个未映射的 Google finish reason；仅 `CONTINUATION` 交还上游。接缝及启动校验见[补丁记录](patches.md)。

## Pi 1.5.2 核对（2026-11-16，PRK-PI15）

- 当时只承载 **1.5.2**：三个直接依赖精确锁定，lock 内八个 Pi 包同版；根目录与 Web 依赖均在本 worktree 实际安装，不链接 daily 的依赖。以下使用旧 1.4.0 安装产物与实际 1.5.2 的声明、JS、隔离 probe 比较，不以 latest 文档代替版本核对。
- 原 `piConfig` 补丁范围不变，脚本与启动检查无需修改；实测重复执行不改变内容或 mtime，`.prk` 与 `PRK_CODING_AGENT_DIR` 生效，无 rebrand 的自有 manifest 经公开 `PI_PACKAGE_DIR` 载入后被启动检查拒绝，见 [补丁记录](patches.md)。

### 已批准接缝与公开契约

| 接缝／契约 | 1.4.0 → 1.5.2 核对及 PRK 处理 |
| --- | --- |
| 内部 keybindings 与独立目录 | `KeybindingsManager.create(agentDir)`／reload／getEffectiveConfig 契约保留；只有 Windows paste 默认新增 ctrl+v。精确闸门改为 1.5.2，不扩展内部导入。 |
| `SelectList.filteredItems/selectedIndex`、选择 callbacks／methods | 仍为运行时普通字段；setFilter 重置选择，setSelectedIndex 不发 callback，PRK 显式转发保持。新增 viewport／PageUp／PageDown，不新增 PRK raw input 支持。 |
| `SettingsList.items/selectedIndex/onChange/onCancel`、updateValue／selectItem | 字段与方法／callback 语义保留，setter 不通知；只新增 viewport capture 与 page navigation。 |
| `Text.text`、Input、Editor、Container children／focus | Text 声明相同、相同文本更新复用缓存；Input JS／声明相同；Editor 新增 viewport／page keys 与 paste-marker 修复，既有文本／焦点接口保留；Container children／Focusable 契约及公开组件集合不变。 |
| 内部 tools index／event-bus | JS 与声明相同，根 JS 的七工厂与总线直接重导出不变；运行 probe 验证函数身份、总线 emit／unsubscribe／clear、原生及自定义流式 read 与 Buffer 回退。远程 tools-only 精确闸门改为 1.5.2，仍不执行或回退根入口；错误版本 fixture 改为 1.5.3。 |
| `ExtensionUIContext`、renderer、事件 | `custom({blocked})` 新增可选终端状态，PRK 不新增 OSC 状态实现；renderer 的 `ToolRenderContext`、`MessageRenderOptions`、`EntryRenderOptions` 新增必需 `keyText/keyHint`，由现有会话独立 keybindings 与 theme 注入，不使用全局绑定。 |
| 扩展 loader／Markdown | loader 将扩展里的 pi-ai root 映射到含 TypeBox 的 extension view；隔离真实 loader 已验证旧 `Type/StringEnum` import。symlink 入口按 realpath 加载。runner 继续返回可调用 transformer，并自行筛选 messageTypes；PRK 保留 user／assistant 表面，不新增 summary／custom／changelog 表面或推测保存条目身份来填可选 messageId／timestamp。 |
| session／JSONL | 仍为 version 3，无迁移；声明仅增加 `projectContextEntry`。失败持久化回滚内存 leaf／entry、fork 用一个 fd、缺 cwd 的 import 清理失败副本；仍由 SDK 持有历史、队列与身份。 |
| 下一次模型请求刷新 | `_installAgentNextTurnRefresh` 与 1.4.0 相同，继续读取 SDK model／thinking／tools，不建立影子状态。 |
| compaction／生命周期 | compaction 实现相同；SDK summarization 修复 OAuth 参数路径，branch summary 尊重 context edits／thinking。reload 在 streaming／compacting 时拒绝，runtime dispose 先 abort 再清理扩展并等待凭据写入；PRK 沿用公开 API，不复制这些实现。 |
| theme／严格校验 | 新增 `CodeHighlighter`、语法种类与缓存，既有 Theme 接口保留。隔离 loader 仍接受额外顶层 metadata，根导出仍无 `setThemeJsonValidator`；严格主题校验公开接缝继续 BLOCKED，不新增内部导入或 validator。 |
| 工具调用标题（2026-11-22） | agent-core `prepareToolCall` 先 `prepareArguments` 再 `validateToolArguments`，之后才调 `beforeToolCall`（`tool_call` 事件），所以 `tool_call` 改 `event.input` 晚于校验，严格 schema（`additionalProperties:false`）会先拒绝多出的字段。公开 `message_end` 替换在 agent-session 中原地写回 agent-core 持有的同一条消息，早于持久化和工具执行，因此注入的 `title` 在此从 `arguments` 移到 toolcall 块的同名字段（自带 `title` 的 `kernel_code` 不剥）。声明注入用 `context_with_system` 改请求内系统消息的 `toolsAdded`（provider 经 `getCurrentTools` 取声明），不改已注册定义或已持久化的系统消息。已核对 anthropic-messages 与 openai-responses 序列化 toolcall 时逐字段取 `id/name/arguments`，块上的 `title` 不进这些请求。 |

### 上游变更与 PRK 影响

来源：[v1.5.0 release](https://github.com/earendil-works/pi/releases/tag/v1.5.0)、[v1.5.1 release](https://github.com/earendil-works/pi/releases/tag/v1.5.1)、[v1.5.2 coding-agent](https://github.com/earendil-works/pi/blob/v1.5.2/packages/coding-agent/CHANGELOG.md)、[pi-ai](https://github.com/earendil-works/pi/blob/v1.5.2/packages/ai/CHANGELOG.md)、[agent-core](https://github.com/earendil-works/pi/blob/v1.5.2/packages/agent/CHANGELOG.md)。

| 版本／变化 | PRK 影响与取舍 |
| --- | --- |
| 1.5.0 breaking：pi-ai root 移除 TypeBox；AgentTool 参数改 JSON Schema／pi-schema 验证与推导 | PRK 已从独立 `typebox` 导入；未使用 Tuple／Intersect／Enum／Refine／Codec／Format.Set 等受影响工具 schema。保留现有 JSON Schema，不为升级重写所有 schema。验证错误文案和强制转换语义来自 SDK，不加 any 或旧行为垫片。1.5.1 恢复 BigInt／Undefined 转换，但 PRK 未使用。 |
| 1.5.1 breaking：grep 不再调用 `GrepOperations.readFile`；read 新增可选 `createReadStream` | PRK 无自定义 grep Operations；目标七工具仍直接在目标宿主执行，context 来自目标 rg。skill reader 的自定义 `readFile` Buffer 路径仍受支持；不会因 SDK 升级自动变流式，也未增加整文件往返。 |
| 1.5.1 breaking：OpenAI-compatible 无工具时省略 tools 而非 [] | 沿用 SDK；需要空数组的旧代理可显式配置 `compat.requiresToolsWithToolHistory`，不为未配置代理加默认兼容层。 |
| 1.5.0／1.5.1 流式参数增量解析、faux 逐步参数；codemode 输出／搜索与 Unicode／$ref 修复 | PRK 继续用 SDK 的最终参数和事件；Python kernel_code 不是原生 JS codemode worker，不新增 worker 池或队列。 |
| 1.5.0／1.5.1 工具、session、compaction、UI 修复 | 原生 read 流式读取、edit 保留未修改混合行尾、grep glob/context、find/ls limits、工具顺序稳定、image-only 队列和 reload/dispose 修复由 SDK 提供；PRK 不重做。 |
| 1.5.1 cacheWarming 默认 streaming → idle；Anthropic message threads | 保留项目既有「Pi settings 为权威」契约，不擅改用户设置；未配置时继承 idle（最多 30 分钟、满足 SDK 经济性条件），可能产生后台费用。threads 仅默认官方 Anthropic；session.dispose 仍调用 SDK cleanupSessionResources。faux 验收不证明真实缓存计费或 provider 兼容性。 |
| 1.5.2 缺 cwd 可 fork／import 副本修复；Anthropic OAuth UA | 缺 cwd 的交互 Continue／Fork／Cancel 是原生 TUI 能力，不扩展 PRK 恢复语义；SDK import 修复自然继承。OAuth UA 与模型目录变化交给 SDK。 |

没有新增 Pi 补丁。

## Pi 1.4.0 核对（2026-10-29，PRK-PI14）

- 当时只承载 1.4.0：`pi-agent-core`、`pi-ai`、`pi-coding-agent` 三个直接依赖精确锁定，传递 Pi 包同版；托管 UI 与组件 probe 的版本闸门同步，不留 1.3.0 兼容分支。以下对照使用 npm 发布的 1.3.0 tarball 与实际安装的 1.4.0，而非未固定的 latest 文档。
- `scripts/patch-pi.mjs` 无需修改：1.4.0 `config.js` 仍读取包内 `piConfig.name/configDir`，生成 `.prk` 与 `PRK_CODING_AGENT_DIR`。授权范围仍只是原有 rebrand metadata，不修改 SDK 源码、实例或原型；postinstall 后再执行一次无变化，隔离 runtime probe 验证了配置目录与 agentDir。

### 已批准接缝与公开契约

| 接缝／契约 | 1.3.0 → 1.4.0 核对 |
| --- | --- |
| 内部 `dist/core/keybindings.js` 与 `.d.ts` | 两者分别逐字节相同；`KeybindingsManager.create(agentDir)`、隔离 keybindings 文件及 ctrl+g 匹配已实际运行。JS SHA256 `0b66630b3aff6497ae0066feed179a9cff554d4a245c91629e55bc911fcf2db6`；声明 SHA256 `fc8dfd4fcbdb7c5bdb17c5b5eccc22555ef089365358e25b89c02ba6c3a74e82`。 |
| 内部 `dist/core/tools/index.js`、`dist/core/event-bus.js` 与各自 `.d.ts`（2026-10-31，PRK-HOSTSLIM） | 用户批准仅无 target 插件的远程原生宿主使用；精确闸门 **Pi 1.4.0**，不匹配即明确失败，无根入口回退。只读核对当前安装产物：root `dist/index.js` 将七个 `create*ToolDefinition` 原样从 tools index 重导出，`createEventBus` 原样从 event-bus 重导出；声明与实现均已核对，执行与事件总线仍完全使用上游实现。 |
| `SelectList.filteredItems/selectedIndex` 与选择 callbacks／methods | 实现与声明逐字节相同；仍是 TypeScript private、运行时普通字段，只读投影，不回写。过滤后选择已 probe。 |
| `SettingsList.items/selectedIndex/onChange/onCancel`、`updateValue/selectItem` | 实现与声明逐字节相同；字段读取、公开更新及 callback 已 probe，不接管上游状态。 |
| `Text.text`、`Input`、`Editor`、container children／focus | Text/Input/Editor 实现与声明相同；Text 普通字段读取已 probe，children/focused 的组件声明未变。 |
| `ExtensionUIContext`、工具 renderer、事件和工具定义 | `core/extensions/types.d.ts` 与 runner JS／声明相同；公开 SDK options 与 read/bash/edit/write/grep/find/ls Operations 声明相同。 |
| session／JSONL | `session-manager.js/.d.ts` 相同；无文件格式迁移。AgentSession 的恢复与工具 loadout 行为有修复，见下表；仍由 SDK 管理历史与队列。 |
| 下一次模型请求刷新 | `_installAgentNextTurnRefresh` 实现未变；继续走 SDK 读取 model/thinking/tool 状态，不建立第二套状态。 |
| theme 与严格校验边界 | theme JS／声明相同；隔离 SDK loader 仍接受额外顶层 metadata，根导出仍无 `setThemeJsonValidator`。严格校验公开接缝仍 BLOCKED；不新增内部导入或全局 validator。 |

PRK-HOSTSLIM 的 `src/remote-extensions/host/extension-loading/load.mjs` 在 load 时才选择导入：无插件时通过 `import.meta.resolve` 只解析根入口位置，不执行它；读取同包 `package.json` 的精确版本后，以绝对 file URL 导入上述 tools／event-bus。存在插件仍导入完整包根入口，并仅在该路径初始化 jiti。两条路径的七工具都从所选 namespace 取同一组原装工厂，不包装 execute。`bundle/build-native-tool-host.ts` 的递归包复制包含整个 Pi `dist` 及 npm 解析出的依赖闭包，因此保留这些内部文件与 renderer／config 等实际依赖，不另裁剪上游。

当时的隔离验证使用 Linux、systemd user manager、cgroup-v2 memory controller 和 Bun。Node／Bun 均通过真实 Unix socket load 和原生 read/bash，检查自有 fixture 包根执行信号；无插件不执行入口，插件对照写信号且真实加载插件／事件总线，版本 1.4.1 明确拒绝且不回退。fixture 仅重导出只读安装的 Pi 内部实现，不修改上游、不注入 loader、不猴子补丁。

`pi-tui/dist` **不是零差异**：184 个旧文件中 21 个改变（含 source maps），无新增文件。变化是 Markdown 的 CJK emphasis／未闭合公式与表格、autocomplete 对 regex 字符转义、Rex 能力及终端退出恢复；TUI 新增退出恢复内部成员，PRK 不启动终端 TUI。组件公开导出集合未变，原有 UI 能力边界不扩大。

### 对 PRK 的版本影响

来源：[coding-agent changelog](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/CHANGELOG.md)、[pi-ai changelog](https://github.com/earendil-works/pi/blob/v1.4.0/packages/ai/CHANGELOG.md)、[agent-core changelog](https://github.com/earendil-works/pi/blob/v1.4.0/packages/agent/CHANGELOG.md)。

| 变化 | PRK 影响与取舍 |
| --- | --- |
| pi-ai 破坏性变更：`telemetryContext` → `telemetry`；移除 `getPiUserAgent()`；`resolveTranscriptTools()` 改 support union、`anchorsAdditions` 改 `foldedSystemMessages` | PRK 源码不直接使用这些接口；不加适配别名或遥测。agent-core 新增 identity 是可选能力。 |
| provider attribution 改由 pi-ai identity 生成；部分头不再出现在 `before_provider_headers` | PRK 无此 hook，沿用 SDK provider。真实外部插件若观察这些头需自行核对；本任务不修改外部插件。 |
| `generateSummary*` 不再按 `reserveTokens` 限制输出；split-turn compact 传入自定义说明 | PRK 原生 compact／自动压缩继承修复。probe 传 128 验证没有 summary maxTokens 覆盖，输出上限由 provider/model 默认值决定；不承诺 faux 能验证真实长 reasoning。 |
| resume/tree 激活分支从未提过的新 extension tools，保留明确移除／defaultActive:false | PRK-SWITCH4 后所有会话工具始终注册；启用开关改为公开 `prepareLoadout.hiddenDeclarations` 与 `tool_call` 权限钩子，不再用 `excludeTools` 重建会话。JSONL 与执行状态仍由 SDK 管理。 |
| 截断工具调用恢复时同时省略对应 tool results | 修复后续 provider 拒绝孤立结果；不改 PRK JSONL，也不复制恢复逻辑。 |
| 扩展 loader 支持 `pi-ai/models` alias；交互终端并发 dialog/custom 栈修复 | 隔离真实 loader 已验证该 import；PRK 托管 dialogs/overlays 不调用 interactive-mode 栈，不移植其实现。 |
| 原生 JS codemode 等待空闲 worker，默认 2 个、最多等 60 秒，可用 `PI_CODEMODE_MAX_WORKERS` 调整；classifier images | PRK 的 Python `kernel_code` 不是该 worker 池；插件加载的原生 codemode 继承变化，不另做排队层或 classifier 接入。 |
| 更精确／更广的 retry、HTTP 413 overflow、空白工具结果、模型目录及默认值更新 | 交给 SDK；PRK 不解析错误重试或增加 fallback。内置 grep 加 `rg --no-config` 不等于 PRK kernel grep 改动；本任务不顺手改 kernel helper。 |

faux 只证明已执行的 SDK／Gateway／Jupyter／浏览器机制，不代表真实 provider 验收。

## Pi 1.3.0 核对（2026-10-16）

- 只承载 1.3.0（三个包精确锁定 `1.3.0`，与上游 #10865 的做法一致），不保留 1.2.0 兼容路径。
- 已批准的内部接缝复核：`dist/core/keybindings.js` 与其 `.d.ts` 与 1.2.0 逐字节相同；`@earendil-works/pi-tui` 的 `dist` 零差异；`ExtensionUIContext`、renderer、扩展相关 `.d.ts` 无变化。版本闸门与 UI probe 断言改为 1.3.0。
- 与 PRK 相关的行为变化（[发布说明](https://github.com/earendil-works/pi/releases/tag/v1.3.0)）：跨模型切换丢弃旧模型 thinking 块；`Unable to forward upstream stream` / `service is temporarily unavailable` 纳入自动重试；工具参数 JSON 不完整时校验失败并回传原文（`argumentsError`）；resume 在初始工具来自 `defaultTools` 时改用会话记录的工具集（PRK 显式指定工具时不受影响）；Haiku 5.5 / Opus 5 支持 `off`。
- 已移除的 `AssistantMessageFrame*`、`findExactModelReferenceMatch` PRK 均未使用。
- 上游修的 `ctx.ui.custom({ overlay: true })` 的 `done()` 关错浮层问题，PRK 托管实现每个 custom 有独立 overlays map，本来就只清理自己的，不受影响。

## Pi 1.2.0 核对（2026-10-13）

- PRK 当前候选只承载 1.2.0，不保留 1.1.0 兼容路径。原下载时间记录不改；以下变化通过官方 tag 文档、npm 包声明／源码和隔离运行重新核对。
- [官方发布说明](https://github.com/earendil-works/pi/releases/tag/v1.2.0)、[Extensions](https://github.com/earendil-works/pi/blob/v1.2.0/packages/coding-agent/docs/extensions.md)、[SDK](https://github.com/earendil-works/pi/blob/v1.2.0/packages/coding-agent/docs/sdk.md)。`before_agent_start` 按 `messageType` 区分 user/custom，custom 没有 `prompt`；启动阶段已 busy，`sendUserMessage` 必须显式选择 `deliverAs`。PRK worker 的 callable-name system prompt 对两种起始消息都适用，不把 custom 改写成 user。
- `reachesTools(input)` 只声明可能触及的工具／namespace，供 MCP 等延迟注册扩展等待资源，不是执行授权。PRK 没有加载原生 MCP extension，`kernel_code → gateway.call → ctx.executeTool` 仍按 SDK callable 集合和现有角色过滤执行，本轮不新增 metadata 或 MCP 接入。
- [Themes](https://github.com/earendil-works/pi/blob/v1.2.0/packages/coding-agent/docs/themes.md)：`$schema` 使用 `https://pi.dev/schemas/theme.schema.json`，复用颜色放在 `vars`。官方严格 schema 拒绝未声明的顶层／colors／export 字段，但 npm 1.2.0 的 SDK 路径与 CLI 不同：只有 CLI `main.js` 安装 `setThemeJsonValidator(validateThemeJson)`；公开 SDK resource loader 的隔离 probe 接受了额外顶层 metadata，拒绝断言失败。该 setter／validator 不在 root exports 中；PRK 不扩大内部导入、不改全局 validator，严格主题校验的公开接缝保持 BLOCKED。PRK 原有 dark/light 与插件主题承载仍经公开 resource loader 工作，不初始化全局 theme。
- [Keybindings](https://github.com/earendil-works/pi/blob/v1.2.0/packages/coding-agent/docs/keybindings.md)：新 schema 和键值校验不改变已批准的 `KeybindingsManager.create(agentDir)` 接缝。集中内部导入仍只有 `dist/core/keybindings.js`，版本锁改为 1.2.0；已实测隔离 keybindings 文件、`$schema` 忽略及 ctrl+g 匹配。
- 1.1.0/1.2.0 的 `ExtensionUIContext` 与 renderer 声明未变化；Text、Markdown、SelectList、SettingsList 相关运行时实现相同。已验证集中只读字段、filtered selection、SettingsList callbacks，以及真实 Gateway/HTTP/Vite/Chromium main/worker UI。全局 theme、raw terminal/input/mouse、图片像素等既有边界未因此闭合。
- 网页语义色（2026-10-13）：托管 UI 的 theme 是经 `additionalThemePaths` 加载的 `shared/pi-web-theme.json`（`prk-web`），前景 token 用 0–255 整数索引；`colorAnsi` 对 indexed 颜色在 truecolor／256color 两种模式下都输出 `38;5;N`，所以标记与 Gateway 的终端能力检测无关。`setTheme` 按 Pi RPC 模式的先例返回 `{ success: false }`。`Theme.bold/italic/underline/strikethrough/inverse` 用 chalk 6，chalk 依据标准输出是否为 TTY 定级；systemd 与测试中的 Gateway 为 0 级，这些方法原样返回文本；`Theme.style()`（pi-tui `styleTextWithAnsi`）与 `fg()` 不经 chalk。PRK 不改 chalk 级别或 `FORCE_COLOR`。
