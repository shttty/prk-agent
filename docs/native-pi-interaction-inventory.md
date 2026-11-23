# 原生 Pi 0.85.1 交互能力历史盘点与 Web 接入映射

当前规则见 [接口与生命周期约定](contract.md)；[wire 文档](wire/transport.md) 给出精确协议。较早后端交接见当时的 design-simplify verification-results 与 assembly receipt；2026-09-22 隔离 UI 与真实 Jupyter 补充证据为当时的任务产物（均未随仓库发布），不更改原全量 RUN_COMPLETE、独立验收或部署状态。
2026-10-26 cutover 的执行绑定和工具模式规则见 [模块约定](kernel-recovery.md#约定)、[模块约定](wire/native.md#约定)、[模块约定](configuration.md#约定)。下方带日期的角色比较与多种会话验证记录描述原候选，不是当前 API 或本次 cutover 的验收证据。

## 当前边界与历史证据

- SDK 状态所有权沿仓库 `AGENTS.md`；项目准入／展示的持久化边界见 [模块约定](wire/native.md#约定)。F4 精确附件取回在当时简化方案中明确未实施；普通 SDK 文本 dequeue 的接口见 [REQ-1](contract.md)、[模块约定](wire/native.md#约定)。
- R08/R19 原过滤式 fork、R21 严格非修复 parser 等旧要求已由简化合同取代，不把历史失败改记 PASS。fork 的 sessionId subject 映射复用受管绑定，不要求 SDK filter、不改写历史。2026-09-22 已按明确要求接入回复图标分叉，见 PLAN 最新章节；普通派生仍默认 task-only。
- 初始 TypeScript/resource-export 失败、后来有界修复、native browser 失败及后续未运行条款、clipboard/F4 失败都记录在当时的 central-verification 结果与 verification-entrypoint ledger 中（未随仓库发布）。正常集成与先前候选／探针自行引入的问题修复分开记录。旧上游对象改写证据不能用来验收。
- 真实保留限制：local-sdk RPC 在 application 装配后才进入公开 `runRpcMode`，初始化 stdout 隔离仍有空窗。官方 CLI 先隔离，但公开 MainOptions/extension context 没有项目所需父 ModelRuntime（ToolInfo 只是元数据），未证明等价公开接入或实际污染；不是 Gateway/Web 故障。公开 Python ROUTER smoke 不证明 deterministic private wedge 或 IOPub idle，不能替代原私有回归。不得导入私有 guard、改写全局输出或重新运行私有注入制造 PASS。

## 1. 结论与口径

### 1.1 权威基线

- 本盘点记录的历史项目基线为 `@earendil-works/pi-coding-agent` 0.85.1；直接导入的 `@earendil-works/pi-ai`、`@earendil-works/pi-agent-core` 当时也以精确 0.85.1 声明。这里的版本、声明与 CLI/TUI 行为只描述本盘点时的依赖快照，不是当前 cutover 的 SDK 版本或现状断言。
- 本文所称“原生 Pi”只指盘点时上述包的 CLI/TUI/SDK；**不包含 OMP、Smart Cascade、Herdr 或其他 harness 的命令**。
- 0.85.1 不是永久冻结的 patch。升级后须重新核对命令注册表、实际 dispatch、SDK、快捷键和资源发现；本历史盘点不替代该复核。

### 1.2 状态标签

| 标签 | 含义 |
|---|---|
| **R 直接复用** | 原生 SDK 或现有项目已有可调用语义；仍需薄的 Gateway 路由和 Web 交互，但不应重写业务逻辑。 |
| **A 需适配** | 原生行为依赖 TUI、进程、本机文件系统或选择器；Web/Gateway 必须保留语义而替换界面/执行位置。 |
| **D 既定延期** | 已在 `PLAN.md` 明确延期；不是本盘点新造的“暂不支持”。 |
| **P 权限边界** | 会改凭据/信任/文件、执行任意命令、发布到外部、下载模型或终止进程；没有相应授权不得执行。 |

“全量纳入”是本盘点的覆盖口径。能力与不可用原因的当前合同见 [模块约定](wire/native.md#约定)。

### 1.3 关键纠偏

1. 原生静态注册表有 **23 条**内建 slash 命令；真实 TUI dispatch 还接受 **3 条未注册隐藏命令**。原生 CLI 又通过内置 extension 增加 `/llama`。因此既不能只看注册表，也不能只看官方用户表格。
2. `AgentSession.prompt()`只直接处理 extension command、skill 与 prompt template；`/model`、`/thinking`、`/new`、`/resume`、`/compact` 等内建 TUI 命令不会因字符串透传而执行（`dist/core/agent-session.js:813-949`；官方 RPC 文档 `docs/rpc.md:816-853`）。
3. 交互式 TUI 的 `@path` 是**路径候选与文字插入**，提交后仍是普通 prompt 文本；只有 CLI 启动参数 `@file` 会预读文件/构造真实图片附件。SDK/RPC 的 `images` 才是结构化模型输入（详见第 6 节）。
4. 原生 `!` 使用 Pi 进程 cwd 的本地 shell；项目执行位置和本机工具开关见 [模块约定](wire/native.md#约定)、[模块约定](configuration.md#约定)，聊天 shell 边界见 [模块约定](wire/native.md#约定)。
5. `new/resume/tree/fork/clone/compact` 的原生效果见第 5 节；项目身份与 Python 内存边界见 [模块约定](wire/native.md#约定)。

## 2. 证据索引

下列均为当前安装包或当前项目源码中的一手证据；行号针对 0.85.1 安装内容。

| 编号 | 证据 |
|---|---|
| **S1** | 静态内建目录 `BUILTIN_SLASH_COMMANDS`：`node_modules/@earendil-works/pi-coding-agent/dist/core/slash-commands.js:2-26`。 |
| **S2** | `InteractiveMode.setupEditorSubmitHandler()` 的真实 TUI dispatch：`node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js:2361-2538`。 |
| **S3** | `InteractiveMode.createBaseAutocompleteProvider()`：`node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js:396-487`；`CombinedAutocompleteProvider` 的 `@`/path/slash 实现：`node_modules/@earendil-works/pi-tui/dist/autocomplete.js:181-345,417-653`。 |
| **S4** | `AgentSession` 公共接口：`node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.d.ts:343-674`；`AgentSession.prompt()`管线：`node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js:813-1013`。 |
| **S5** | `AgentSessionRuntime`接口：`node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session-runtime.d.ts:44-118`；替换实现：`node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session-runtime.js:78-303`。 |
| **S6** | 官方 session 说明：`node_modules/@earendil-works/pi-coding-agent/docs/sessions.md:22-139`；格式与身份：`node_modules/@earendil-works/pi-coding-agent/docs/session-format.md:1-35,174-299`。 |
| **S7** | 官方 compaction 语义：`node_modules/@earendil-works/pi-coding-agent/docs/compaction.md:14-148`；`AgentSession.compact()`：`node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js:1469-1548`。 |
| **S8** | `DefaultResourceLoader.reload()`与资源更新：`node_modules/@earendil-works/pi-coding-agent/dist/core/resource-loader.js:263-400,500-565`；官方说明：`node_modules/@earendil-works/pi-coding-agent/docs/extensions.md:109-137,273-300`、`node_modules/@earendil-works/pi-coding-agent/docs/skills.md:20-91`、`node_modules/@earendil-works/pi-coding-agent/docs/prompt-templates.md:3-96`。 |
| **S9** | `KEYBINDINGS`：`node_modules/@earendil-works/pi-coding-agent/dist/core/keybindings.js:10-173`；完整官方动作表：`node_modules/@earendil-works/pi-coding-agent/docs/keybindings.md:25-194`。 |
| **S10** | `AgentSession.executeBash()/recordBashResult()`：`node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js:2352-2444`；`convertToLlm()`的 `!!` 过滤：`node_modules/@earendil-works/pi-coding-agent/dist/core/messages.js:67-122`；TUI 入口：`node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js:2501-2515,5453-5517`。 |
| **S11** | CLI `processFileArguments()`：`node_modules/@earendil-works/pi-coding-agent/dist/cli/file-processor.js:1-70`；交互式提交循环：`node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js:834-843`。 |
| **S12** | 当前会话资源装配：`src/sessions/runtime/conversation/create-sdk-session.ts`、`src/sessions/runtime/resources/create-resource-options.ts`；Gateway wire：`src/gateway/wire/wire-types.ts`、`src/gateway/wire/message-parameters/validate-message-params.ts`；输入提交及 admission：`src/sessions/host/input/submit-input.ts`、`src/sessions/host/input/admit-input.ts`。 |
| **S13** | 当前 Web composer/IME/忙时 queue：`web/chat/composer/handle-input-key-down.js`、`web/chat/composer/submit-draft.js`；复制、纯文本引用及尚未接入的 edit/branch：`web/chat/transcript/messages/MessageActions.jsx`。 |
| **S14** | 官方安全模型：`node_modules/@earendil-works/pi-coding-agent/docs/security.md:1-51`；`shareSession()`：`node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/session-share.js:13-183`。 |

官方入口：包 manifest 的仓库为 <https://github.com/earendil-works/pi/tree/main/packages/coding-agent>；安装包自带文档位于 `node_modules/@earendil-works/pi-coding-agent/docs/`。GitHub 另明确说明 secret gist **不是私有存储**：<https://docs.github.com/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists>。

## 3. slash 命令：目录、dispatch 与差异

### 3.1 三层命令面

1. **静态内建目录（23）**：`BUILTIN_SLASH_COMMANDS` 为 TUI 补全提供名称、说明，只有 `/model`、`/thinking`、`/login` 声明了参数 hint（S1）。
2. **真实 TUI dispatch（26）**：提交 handler 对 23 条目录命令逐一分派，另接受 `/debug`、`/arminsayshi`、`/dementedelves`；三者不出现在普通补全（S2）。
3. **动态命令**：native CLI 总是注入隐藏的内置 `llama.cpp` extension（`dist/extensions/index.js:1-2`），注册 `/llama`（`dist/extensions/llama/index.js:163-216`）。其他 extension、skill、template 由资源加载结果决定。

`/daxnuts` **不是命令**；当选中的 provider 为 `opencode` 且 model id 包含 `kimi-k2.5` 时触发展示彩蛋（`interactive-mode.js:5443-5451`）。

### 3.2 完整命令覆盖表

“适用状态”描述原生 0.85.1；当前 Web 能力与状态规则见 [模块约定](wire/native.md#约定)。

| 命令 | 原生含义、参数/选择与状态 | SDK/headless 复用点 | Gateway/Web 去向 | 归类与证据 |
|---|---|---|---|---|
| `/settings` | 打开 TUI 设置选择器；可改自动 compact、默认/当前模型、图片、skill 命令、steer/follow-up、transport、thinking、主题、IME 光标、TUI 模式等，并写 settings。 | 部分为 `AgentSession` setter；其余是 `SettingsManager` 或纯终端显示设置。 | [模块约定](wire/native.md#约定)、[模块约定](configuration.md#约定)；Web 设置项与 TUI 显示设置分列。 | **A**；`interactive-mode.js:3765-3994`。 |
| `/model [provider/model]` | 无参数打开 selector；精确参数直接选模型，否则以参数作为 selector 搜索。可能刷新 catalog；选择器 `Ctrl+S` 可持久化默认。 | `modelRuntime` catalog + `session.setModel(model,{persist})`。 | [模块约定](wire/native.md#约定)；动作 `model`。 | **R**；`:4034-4087,4169-4194`，S4。 |
| `/tree` | 在**同一 JSONL/session id** 的树上选节点。选 user/custom 时 leaf 移到其 parent 并把原文放回编辑器；选其他节点直接停在该点；可选择是否用模型总结离开分支。busy 时实际流程可先 abort。 | `session.navigateTree(targetId, options)`、`SessionManager.getTree()`。 | [模块约定](wire/native.md#约定)、[WEB-5](contract.md)、[WEB-6](contract.md)、[WEB-7](contract.md)；动作 `tree`。 | **R**；`:4357-4474`，S4/S6。 |
| `/thinking [level]` | 无参数打开 selector；有参数要求精确匹配当前模型允许的 level；选择器 `Ctrl+S` 可保存默认。 | `getAvailableThinkingLevels()`、`setThinkingLevel()`。 | [模块约定](wire/native.md#约定)；动作 `thinking`。 | **R**；`:3996-4032`，S4。 |
| `/scoped-models` | 打开多选/排序 UI，决定 `Ctrl+P` 循环范围；可刷新 catalog、全选/清空/provider 切换和持久化。 | `session.scopedModels`、`setScopedModels()`，settings enabled models。 | [模块约定](wire/native.md#约定)；动作 `scoped-models`。 | **R**；`:4196-4307`。 |
| `/export [path]` | `.jsonl` 导出当前分支；否则导出 HTML。原生写 Pi 进程本机文件。 | 公开 `AgentSession.exportToJsonl()`、`AgentSession.exportToHtml()`。 | [WEB-16](contract.md)；返回下载 payload。 | **A**；S4。 |
| `/import <path.jsonl>` | 先确认；复制外部 JSONL 到 session dir（处理重名），解析 cwd，替换当前 runtime/session；可因 extension 拒绝。 | `runtime.importFromJsonl(path,cwdOverride)`。 | [模块约定](wire/native.md#约定)。 | **P**；`:5093-5133`，`agent-session-runtime.js:251-294`。 |
| `/share` | 先尝试用 Radius credential 上传 organization artifact；否则检查 `gh` 登录并创建 `--public=false` secret gist。发布内容包含当前 branch，并附当前 system prompt 与 tool 描述/参数。 | 不是普通 SDK session 方法；TUI helper 组合 export、凭据、HTTP/`gh` 子进程。 | [模块约定](wire/native.md#约定)；secret gist 不是 private。 | **P**；S14。 |
| `/copy` | 复制最后 assistant 文本或选区。 | `getLastAssistantText()` 或已呈现文本。 | Web Clipboard API；结果反馈位于浏览器。 | **R**；S13。 |
| `/name [name]` | 无参数显示当前名称或 usage；有参数写 session info，可能被规范化。 | `session.setSessionName()`；RPC `set_session_name`。 | 动作 `name` 对应 SDK `setSessionName()`。 | **R**；`:5171-5192`，S4。 |
| `/session` | 显示 name、session file/id、消息/工具、token/cache/cost；统计包含已 compact 的完整账单历史。 | `getSessionStats()`、`getContextUsage()`。 | 结构化 session stats/context usage；[REQ-13](contract.md)、[模块约定](wire/sessions.md#约定)。 | **R**；`:5194-5250`，S4。 |
| `/changelog` | 读取安装包 changelog 并在 TUI 展示。 | 无会话 SDK 语义。 | 已安装版本 release notes。 | **A**；`:5251-5279`。 |
| `/hotkeys` | 根据**有效** keybindings 动态生成帮助，并追加已加载 extension shortcuts。 | `KeybindingsManager` 与 extension metadata。 | Web 动作/手势帮助；[模块约定](wire/native.md#约定)。 | **A**；`:5280-5390`，S9。 |
| `/fork` | 让用户选以前的 user message；创建**新 session file/id**，复制到该消息之前，把所选 user 原文放入编辑器等待修改/重发。 | `getUserMessagesForForking()` + `runtime.fork(entryId,{position:"before"})`。 | [模块约定](wire/native.md#约定)；Web 动作为 `fork-reply`，不列 `/fork`。 | **R**；`:4309-4336`，S5/S6；[wire](wire/transport.md)。 |
| `/clone` | 当前 active branch 到新 file/id；不是整个文件的所有分支。 | 单独 `SessionManager.open(...)` 后 `createBranchedSession(sourceLeaf)`。 | [模块约定](wire/native.md#约定)；动作 `clone`。 | **R**；S5/S6。 |
| `/trust` | 选择并写当前/父目录的 trust decision；提示重启后生效。trust 允许项目 settings、资源、package/extension 代码加载，但不是 sandbox。 | `ProjectTrustStore`；无通用 session setter。 | [模块约定](wire/native.md#约定)。 | **P**；`:4147-4167`，`dist/core/trust-manager.js:143-202`，S14。 |
| `/login [provider]` | 无参数选认证类型/provider；有精确 provider 可直接进入 OAuth/API key/ambient 流程；凭据写 `auth.json`，可能刷新 catalog/选择默认模型。 | `modelRuntime.login()`、provider metadata。 | [模块约定](wire/native.md#约定)。 | **P**；`:4585-4969`；`dist/config.js:436-438`。 |
| `/logout` | 列举 Pi 自己保存的 credential，选择删除；不删除 env 与 `models.json` 中的配置。 | `modelRuntime.listCredentials()`、`logout()`。 | [模块约定](wire/native.md#约定)。 | **P**；`:4694-4739`。 |
| `/new` | 原生 TUI 先 teardown，再创建新 runtime/file/id。 | `runtime.newSession()`。 | [模块约定](wire/native.md#约定)；动作 `new`。 | **R**；S5。 |
| `/compact [instructions]` | 先 abort 当前 agent 操作，调用模型生成 summary，追加 compaction entry，重建当前上下文；不删除完整 JSONL 历史，并产生 token/cost。 | `session.compact()`、`abortCompaction()`。 | [模块约定](wire/native.md#约定)；动作 `compact`，SDK 模型调用和费用语义见原生列。 | **R**；`:5518-5525`，S7。 |
| `/resume` | 原生 TUI picker 选择后切换 runtime/file/id。 | 仅原生 TUI；Gateway 不提供该动作。 | 已有受管会话直接通过路由选择，见 [WEB-5](contract.md)、[WEB-6](contract.md)。 | **P**；S5/S6。 |
| `/reload` | idle 且非 compact 才执行；重载 settings、keybindings、extensions、skills、prompts、themes、context，重建 runtime 资源和 autocomplete。 | `session.reload()`；项目现有 host `reload()` 只在 idle 执行。 | [模块约定](kernel-tools.md#约定)；动作 `reload`。 | **A**；`:4974-5048`；`src/sessions/session-host.ts:523-530`。 |
| `/quit` | 停 TUI、触发 extension shutdown、dispose runtime、打印 resume 命令并 `process.exit(0)`。 | `runtime.dispose()`，但进程退出属于 CLI 宿主。 | [LIFE-1](contract.md)；`quit` 是 Web 展示动作。 | **P**；`:2496-2499,3214-3254`。 |
| `/llama` | native CLI 内置 extension 的 TUI 模型管理器，可连接 llama.cpp router、下载/load/unload 模型；非 TUI 仅警告。 | extension command，无通用内建命令方法。 | [模块约定](wire/native.md#约定)。 | **P**；`dist/extensions/index.js:1-2`；`dist/extensions/llama/index.js:163-216`。 |
| `/debug`（隐藏） | 将所有已渲染终端行及**完整 Agent messages JSONL**写入 `~/.pi/agent/pi-debug.log`。不在补全/普通文档命令表。 | 无公共 SDK 方法。 | [模块约定](wire/native.md#约定)。 | **P**；`:2476-2479,5406-5431`；`dist/config.js:460-462`。 |
| `/arminsayshi`（隐藏） | 纯 TUI 彩蛋组件，无会话副作用。 | 无。 | 只读展示动作。 | **A**；`:2481-2484,5433-5437`。 |
### 3.3 dispatch 与目录逐项核对结果

- S1 的 23 项均在 S2 中有明确 handler；没有“目录中有但 TUI 完全不处理”的静态命令。
- 三条隐藏 dispatch 不在 `BUILTIN_SLASH_COMMANDS`，所以普通 `/` 补全不会显示。
- `/llama` 不在静态目录和硬编码 dispatch；它由 native CLI 的内置 extension 注册，进入 extension command 补全/执行路径。
- 原生未知 `/xxx` 的 TUI 行为是普通 prompt；项目的 control/plain 区分见 [模块约定](wire/native.md#约定)。

## 2026-10-26 Worker tool modes

- 模式与开关合同：[模块约定](wire/native.md#约定)、[模块约定](configuration.md#约定)。字段为 `toolMode:"code"|"direct"` 和独立 `localTools:boolean`，存于原生 SDK custom records；默认值见 [配置参考](configuration.md#session)。
- 两种模式共用 `kernel_code {code,title?,reset?}`、target helpers、Gateway callbacks、shared tool library 和 `tool_bin`。本机开关对应七个 SDK-native coding tools。
- 扩展选择实现在 `selectExtensionToolNames` 与 `kernel_code.prepareLoadout`，nested calls 使用公开 `ctx.executeTool`。按注册 exposure 判定的可调用性见 [模块约定](wire/native.md#约定)。
- Native action 形状为 `tool-mode {mode:"code"|"direct"}`、`local-tools {enabled:boolean}`；生效与重载边界见 [模块约定](wire/native.md#约定)。
- 2026-10-09 role-filtering 测试和当时 SDK/Jupyter smoke 仅为历史证据。2026-10-14 prompt correction 删除固定的 web-search 断言；函数说明来自每轮动态目录与 `gateway.describe()`。
- See [configuration](configuration.md#session) and [wire](wire/transport.md) for the public contracts; older role-based tool defaults and their verification remain historical only.

## 4. 动态资源：extension、skill、prompt template

| 类型 | 原生发现/展示 | 执行/展开路径 | 当前项目事实 | Web 映射 |
|---|---|---|---|---|
| Extension commands | trusted global/project/package/显式路径加载；`registerCommand()`；名称冲突时 builtin 占用原名，extension 可有 invocation alias；可提供参数补全。 | `AgentSession.prompt()`最先尝试 `_tryExecuteExtensionCommand()`，即使 streaming 也立即执行；handler 自己决定是否发模型消息。 | loader 的实际 metadata；[模块约定](wire/native.md#约定)。 | [模块约定](wire/native.md#约定)。 |
| Skills | global/project/package/settings/CLI 路径发现；若 setting `enableSkillCommands` 开启，显示 `/skill:name`。 | 读取 SKILL.md，去 frontmatter，包装成 `<skill ...>`；参数追加在 skill block 后，然后作为 prompt 发送。 | loader 的实际 metadata；[模块约定](wire/native.md#约定)。 | [模块约定](wire/native.md#约定)。 |
| Prompt templates | global/project/package/settings/CLI `.md` 发现。 | 原生 template 展开后 prompt/queue。 | loader 的实际 metadata；[模块约定](wire/native.md#约定)。 | [模块约定](wire/native.md#约定)。 |
| Extension shortcuts/UI | extension 可 `registerShortcut()`、替换 editor、注册自定义 selector/overlay；冲突有 diagnostics。 | TUI 先尝试 extension shortcut，再处理 app/editor keybindings。 | loader 的实际 metadata；[模块约定](wire/native.md#约定)。 | 历史 2026-10-12 UI 候选：[PLAN 2026-10-12](../PLAN.md) 候选接入数据 UI、widget/header/footer、原生定义／resolver renderer；G1 集中只读组件字段，已授权 Pi 1.1.0 原生 KeybindingsManager 单一内部接缝，可解析 custom/editor 不整体禁用。依赖上游全局 theme 的特定 Pi 组件 BLOCKED；opaque 只读＋取消，raw terminal／快捷键／图片语义仍待定。 |

证据：S3/S4/S8；extension shortcut dispatch 位于 `interactive-mode.js:1555-1608`、`components/custom-editor.js:62-112`。原生 RPC `get_commands` 只返回 extension/prompt/skill，不含内建 TUI 命令（官方 `docs/rpc.md:816-853`）；项目能力目录规则见 [模块约定](wire/native.md#约定)。

`AgentSession.prompt()`的顺序是：extension command → extension `input` 拦截/变换 → skill/template 展开 → streaming queue 或普通模型 prompt（`agent-session.js:821-949`）。`steer()`/`followUp()`会展开 skill/template，但拒绝 extension command；TUI 为此统一走 `prompt(...,{streamingBehavior})`。

## 5. 会话身份、上下文与历史副作用

| 操作 | session file / session id | leaf、上下文和历史 | Python/kernel 含义 | 项目约束 |
|---|---|---|---|---|
| `new` | 新 file/id。 | 独立创建／选择见 [模块约定](wire/native.md#约定)。 | [REQ-13](contract.md)、[模块约定](wire/sessions.md#约定)、[模块约定](wire/native.md#约定)。 | [WEB-5](contract.md)、[WEB-6](contract.md)、[WEB-7](contract.md)、[模块约定](wire/native.md#约定)。 |
| `tree` | **同 file/id**。 | 改 active leaf；user/custom 节点可回填编辑器以新建分支；可追加 branch summary 和 label。完整树仍在 JSONL。 | [REQ-13](contract.md)、[模块约定](wire/sessions.md#约定)、[模块约定](wire/native.md#约定)。 | [WEB-5](contract.md)、[WEB-6](contract.md)、[WEB-7](contract.md)、[模块约定](wire/native.md#约定)。 |
| `fork` | 新 file/id，header 可带 parentSession。 | 原生截断所选 branch；Web 回复图标包含所选 assistant 回复。 | [REQ-13](contract.md)、[模块约定](wire/sessions.md#约定)、[模块约定](wire/native.md#约定)。 | [WEB-5](contract.md)、[WEB-6](contract.md)、[WEB-7](contract.md)、[模块约定](wire/native.md#约定)。 |
| `clone` | 新 file/id，native active branch。 | SDK 原样复制 active branch；authority subject 读取见 `src/sessions/history/format-authority-entries.ts`。 | [REQ-13](contract.md)、[模块约定](wire/sessions.md#约定)、[模块约定](wire/native.md#约定)。 | [WEB-5](contract.md)、[WEB-6](contract.md)、[WEB-7](contract.md)、[模块约定](wire/native.md#约定)。 |
| `compact` | 同 file/id；在当前 branch 追加 compaction entry。 | 旧记录不删除；模型只看到 summary + retained tail；session 统计仍汇总完整历史。manual compact 先 abort 当前 agent turn，且不会自动继续被中断 turn。 | [REQ-13](contract.md)、[模块约定](wire/sessions.md#约定)、[模块约定](wire/native.md#约定)。 | [WEB-5](contract.md)、[WEB-6](contract.md)、[WEB-7](contract.md)、[模块约定](wire/native.md#约定)。 |

原生 TUI runtime replacement 按 S5 teardown/rebind。Web new、clone 和回复 fork 创建独立身份；路由身份与只读规则见 [模块约定](wire/native.md#约定)、[WEB-5](contract.md)、[WEB-6](contract.md)、[WEB-7](contract.md)、[REQ-13](contract.md)。

## 6. `@`、文件、图片与附件

### 6.1 四种容易混淆的原生路径

| 入口 | 原生真实行为 | 模型上下文 | Web 结论 |
|---|---|---|---|
| 交互式编辑器输入 `@` | 从 session cwd 进行文件/目录 fuzzy 候选；优先用 `fd`，遵守 `.gitignore`、排除 `.git`；选择后仅把 `@path` 或 `@"path with spaces"` 插入编辑器。 | 提交循环直接 `session.prompt(userInput)`，没有预读文件；模型收到文字路径，通常需要再调用 `read`。 | [WEB-8](contract.md)、[模块约定](wire/targets.md#约定)、[模块约定](wire/native.md#约定)；浏览器附件与 target-file 引用为不同输入形状。 |
| CLI 启动参数 `pi @file ...` | 参数解析先剥 `@`，`processFileArguments()`从 `process.cwd()`读文件。文本包成 `<file name="absolute">...</file>`；支持图片时构造 base64 `ImageContent`。 | 内容/图片随**初始 prompt**直接进入模型。 | [WEB-8](contract.md)、[模块约定](wire/targets.md#约定)、[模块约定](wire/native.md#约定)；浏览器附件与 target-file 引用为不同输入形状。 |
| SDK/RPC `PromptOptions.images` | 调用方传 `{type:"image",data,mimeType}`。 | 真实 user content 与持久化由 SDK 决定。 | [WEB-8](contract.md)、[模块约定](wire/targets.md#约定)、[模块约定](wire/native.md#约定)；浏览器附件与 target-file 引用为不同输入形状。 |
| TUI clipboard/drag | `Ctrl+V` 读图片后写临时 `pi-clipboard-*.ext`，把**路径**插入编辑器；文本 clipboard 直接插入。终端拖放通常也是粘贴路径。 | 仍需模型/工具读取该路径，不等同 `PromptOptions.images`。 | [WEB-8](contract.md)、[模块约定](wire/targets.md#约定)、[模块约定](wire/native.md#约定)；浏览器附件与 target-file 引用为不同输入形状。 |

证据：S3/S11；clipboard 实现 `interactive-mode.js:2311-2355`；SDK images `agent-session.d.ts:148-160`；官方 `docs/usage.md:18-31,258-266`。

### 6.2 候选的 Web 引用对象

- 引用对象包含 target-file、浏览器图片/文本附件、文本引用；target-file 使用 target、原生sessionId、目标绝对path及source:"session-target"，浏览器来源为source:"browser"。
- 草稿badge、候选、读取与发送边界见 [native](wire/native.md#约定)；target/session/path 校验见 [WEB-8](contract.md) 与 [targets](wire/targets.md#约定)。
- 附件参考限额为每项 384 KiB、总计 640 KiB；图片使用 SDK `ImageContent`，文本／文件内容使用包围格式进入 SDK message。字段与输入限制以 wire/config 参考为准。
- @ 输入可写会话cwd相对路径或目标绝对路径；后端只解析一次，引用保存目标绝对路径。使用同一目标daemon文件模块，不再推导Contents根或调用resolvePath；错误原因和限额见 [targets](wire/targets.md)。
- Browser 验证需实际 candidate、inspect、remove/replace、file upload 与 SDK message 展示；不要求永久 source 回执重建。旧 browser child 在后续条款前失败，保留其未运行事实；当前前端集成由 Root 按最终 ledger 验证。

## 7. `!` / `!!`：执行位置、上下文、历史与取消

### 7.1 原生语义

- TUI 对 `trim()` 后以 `!` 开头的输入进行 shell dispatch；`!!` 表示 `excludeFromContext:true`（S2）。因此 `!important` 也会被当成命令；仅在句中出现 `!` 不会。
- 执行前发 extension `user_bash` 事件，extension 可直接返回结果或替换 `BashOperations`；否则 `AgentSession.executeBash()`使用 Pi 进程 session cwd 与本地 shell（S10）。
- 普通 `!` 的结果作为 `BashExecutionMessage`持久化，并在**下一次模型调用**转换为 user context。`!!` 同样持久化和展示，但 `convertToLlm()`过滤，不发送给模型（`dist/core/messages.js:75-88`）。
- streaming 时 shell 可并行显示，消息为保持 tool call/result 顺序而延后写入 agent state/session；结束后 flush（`agent-session.js:2402-2443`）。
- `Escape` 在 agent streaming 时恢复 queued messages 并 abort；否则若 shell 正在跑则 `abortBash()`；再否则可清空 shell mode（`interactive-mode.js:2253-2264`）。

### 7.2 项目边界与已实现逃逸

| 目标 | 当前映射 |
|---|---|
| 会话目标机 | `kernel_code`、`code`／`direct`、独立 `localTools` 的执行位置见 [模块约定](wire/native.md#约定)、[模块约定](configuration.md#约定)。 |
| Gateway 主机 | 聊天 `!`／`!!` 与敏感操作边界见 [模块约定](wire/native.md#约定)。 |

原预检、catalog、普通文本逃逸和拒绝结果的证据保留在对应 ledger；当前控制输入合同为 [模块约定](wire/native.md#约定)。

## 8. 输入、补全和普通文本规则

### 8.1 原生补全事实

- `/`：仅在当前行光标前文本以 `/` 开头时列候选。候选合并 23 条 builtin、prompt templates、非冲突 extension commands、可选 skill commands（S3）。
- 原生 builtin 的真实参数候选只有：
  - `/model`：当前 scoped models 或 model runtime snapshot；
  - `/thinking`：当前模型允许的 levels；
  - `/login`：provider/auth type；
  - extension command 可提供自己的 `getArgumentCompletions`。
- prompt template 只有 `argument-hint` 与展开语法，并不自动生成语义候选；`/export`、`/import`、`/name`、`/compact` 等也没有专门 builtin argument provider。
- `@`：只在 token 起点（开头或空格/tab/引号/`=`之后）触发；`foo@bar` 不触发。普通 path completion 可用 Tab 强制触发（S3）。
- 选中 slash 命令只填入 `/<name> `；**候选确认和提交是两个动作**（`pi-tui/dist/autocomplete.js:265-303`）。

### 8.2 候选 Web 规则（Root 初始浏览器运行未完成，后续条款仍未运行）

本小节保留原候选与当时未运行事实；当前S6文件引用使用目标绝对路径与pi-env文件模块，取代下列旧Contents/根相对路径说明。

1. 能力目录及执行前复核：[模块约定](wire/native.md#约定)；参考字段包含来源、参数、availability/reason、state 和 read-only。
2. 命令/引用选择、IME 与发送：[模块约定](wire/native.md#约定)。已有会话由路由选择，不提供 `/resume` 或额外历史视图 selector。
3. 未知 slash／禁用 `!` 的 plain escape：[模块约定](wire/native.md#约定)。请求结果与草稿边界：[模块约定](wire/native.md#约定)、[REQ-9](contract.md)、[REQ-8](contract.md)。
4. desktop keyboard 与 390px touch 的原验收目标包括 steer/follow-up/dequeue、ordinary/native cancel、disconnect/reconnect、草稿切换和 restart/history；Root 初始 browser child 在后续条款前失败，不能记为 PASS。
5. Web `/` 补全来自 `CombinedAutocompleteProvider` 的命令部分；目标文件候选来自 PRK 的 Jupyter Contents 路径（[WEB-8](contract.md)、[模块约定](wire/targets.md#约定)）。Pi 1.3.0 构造参数只有 commands/basePath/fdPath；项目组合点为 `src/sessions/extension-ui/assemble-extension-ui.ts`，插件 `addAutocompleteProvider` 位于外层。裁剪原生本机文件补全的原因是它读取 Gateway cwd，而非会话目标目录。
6. 目标文件菜单的数据转换：目录候选插入 `@<目录>/`，文件候选插入 `@<文件> ` 并登记 badge；插入文字保留用户相对／绝对写法，引用对象保存根相对路径。键盘/IME 规则见 [模块约定](wire/native.md#约定)。高亮 hook 为 `aria-activedescendant`；查找失败原因取 Gateway `details.reason`，显示位置为菜单。

## 9. 全部快捷动作与默认物理键

以下表格覆盖 0.85.1 `KEYBINDINGS` 与展开的 `TUI_KEYBINDINGS`。用户配置可替换默认键并在原生 `/reload` 后生效；当前 Web 输入规则见 [模块约定](wire/native.md#约定)。

### 9.1 编辑、历史、提交、剪贴板

| Action id | 默认键 | 语义 |
|---|---|---|
| `tui.editor.cursorUp` / `tui.editor.cursorDown` | `up` / `down` | 光标移动；在首/末视觉行浏览旧/新 prompt history。 |
| `tui.editor.historyPrevious` / `tui.editor.historyNext` | 无默认 | 无视多行光标位置，显式切 prompt history。 |
| `tui.editor.cursorLeft` / `tui.editor.cursorRight` | `left, ctrl+b` / `right, ctrl+f` | 字符移动。 |
| `tui.editor.cursorWordLeft` / `tui.editor.cursorWordRight` | `alt+left, ctrl+left, alt+b` / `alt+right, ctrl+right, alt+f` | 按词移动。 |
| `tui.editor.cursorLineStart` / `tui.editor.cursorLineEnd` | `home, ctrl+home, ctrl+a` / `end, ctrl+end, ctrl+e` | 行首/行尾。 |
| `tui.editor.jumpForward` / `tui.editor.jumpBackward` | `ctrl+]` / `ctrl+alt+]` | 跳到字符。 |
| `tui.editor.pageUp` / `tui.editor.pageDown` | `pageUp, ctrl+pageUp` / `pageDown, ctrl+pageDown` | 编辑器翻页。 |
| `tui.editor.deleteCharBackward` / `tui.editor.deleteCharForward` | `backspace` / `delete, ctrl+d` | 删字符。 |
| `tui.editor.deleteWordBackward` / `tui.editor.deleteWordForward` | `ctrl+w, alt+backspace` / `alt+d, alt+delete` | 删词。 |
| `tui.editor.deleteToLineStart` / `tui.editor.deleteToLineEnd` | `ctrl+u` / `ctrl+k` | 删除到行首/行尾。 |
| `tui.editor.yank` / `tui.editor.yankPop` | `ctrl+y` / `alt+y` | kill ring 粘贴/轮换。 |
| `tui.editor.undo` | Linux/macOS `ctrl+-`；Windows `ctrl+z`；WSL `alt+z` | 撤销编辑。 |
| `tui.input.newLine` | `shift+enter, ctrl+j` | 换行。 |
| `tui.input.submit` | `enter` | 提交；候选打开时由 autocomplete/selector 优先处理。 |
| `tui.input.tab` | `tab` | 路径补全/接受 autocomplete。 |
| `tui.input.copy` | `ctrl+c` | 有选择时复制。 |
| `tui.select.up` / `tui.select.down` | `up/down` | selector 移动。 |
| `tui.select.pageUp` / `tui.select.pageDown` | `pageUp/pageDown` | selector 翻页。 |
| `tui.select.confirm` / `tui.select.cancel` | `enter` / `escape, ctrl+c` | 确认/取消选择。 |

Web 输入操作对应 [模块约定](wire/native.md#约定)；默认终端键保留在上表供原生行为查阅。

### 9.2 全屏 transcript

| Action id | 默认键 | 语义 |
|---|---|---|
| `tui.altScreen.pageUp` / `tui.altScreen.pageDown` | `pageUp/pageDown` | transcript 整页滚动。 |
| `tui.altScreen.halfPageUp` / `tui.altScreen.halfPageDown` | 无默认 | 半页滚动。 |
| `tui.altScreen.lineUp` / `tui.altScreen.lineDown` | 无默认 | 单行滚动。 |
| `tui.altScreen.previousPrompt` / `tui.altScreen.nextPrompt` | `ctrl+shift+up/down`，Windows/WSL 仅 `ctrl+up/down` | 跳到上/下一条标记消息。 |
| `tui.altScreen.search` | `ctrl+shift+f`，Windows/WSL `ctrl+f` | 搜索**已渲染 transcript**。 |
| `tui.altScreen.searchNext` / `tui.altScreen.searchPrevious` | `enter, ctrl+g` / `shift+enter, ctrl+shift+g` | 搜索下一/上一匹配。 |
| `tui.altScreen.searchClose` | `escape` | 关闭搜索。 |
| `tui.altScreen.top` / `tui.altScreen.bottom` | `home/end` | transcript 顶部/底部。 |

这类 TUI transcript 搜索不是已延期的 **Session Search**：前者只搜当前渲染视图，后者要求跨持久消息并定位来源。Web 可保留当前页查找/跳转，但不得借此宣称 Session Search 已实现。

### 9.3 应用、队列、模型、显示与 session

| Action id | 默认键 | 语义 |
|---|---|---|
| `app.interrupt` | `escape` | 取消 autocomplete；否则按状态 abort agent、abort shell、abort compact/retry/branch summary 或清 shell mode；editor 为空时在 500ms 内双击 Escape 可按 setting 打开 tree、fork 或不动作。 |
| `app.clear` | `ctrl+c` | 第一次清 editor，500ms 内第二次退出。 |
| `app.exit` | `ctrl+d` | editor 为空时退出；不为空时仍是 delete-char-forward。 |
| `app.suspend` | 非 Windows `ctrl+z`；Windows 无默认 | SIGTSTP 后可 `fg` 恢复。 |
| `app.editor.external` | `ctrl+g` | 用配置/$VISUAL/$EDITOR/Notepad/nano 编辑当前草稿。 |
| `app.clipboard.pasteImage` | `ctrl+v`；Windows/WSL `alt+v` | 读图片并插入临时路径，否则粘贴文字。 |
| `app.thinking.cycle` | `shift+tab` | 循环 thinking。 |
| `app.thinking.save` | selector 内 `ctrl+s` | 保存默认 thinking。 |
| `app.thinking.toggle` | `ctrl+t` | 折叠/展开 thinking blocks；只影响显示。 |
| `app.model.cycleForward` / `app.model.cycleBackward` | `ctrl+p` / `shift+ctrl+p`；Windows/WSL backward 为 `alt+p` | 循环 scoped/可用模型。 |
| `app.model.select` | `ctrl+l` | 打开 model selector。 |
| `app.models.save` | selector 内 `ctrl+s` | 保存默认/范围配置。 |
| `app.models.enableAll` / `app.models.clearAll` | selector 内 `ctrl+a/ctrl+x` | 全选/清空模型。 |
| `app.models.toggleProvider` | selector 内 `ctrl+p` | 切换当前 provider 全部模型。 |
| `app.models.reorderUp` / `app.models.reorderDown` | selector 内 `alt+up/down` | 调整循环顺序。 |
| `app.tools.expand` | `ctrl+o` | 折叠/展开工具输出。 |
| `app.message.copy` | `ctrl+x` | `/tree` 复制选中消息；否则复制最后 assistant 或 fullscreen 选择。 |
| `app.message.followUp` | `alt+enter`；Windows/WSL `ctrl+q` | streaming 时排队 follow-up；idle 时等同普通提交。 |
| `app.message.dequeue` | `alt+up`；Windows/WSL `alt+q` | 将所有 queued messages 恢复到 editor。 |
| `app.session.new` / `app.session.tree` / `app.session.fork` / `app.session.resume` | 无默认 | 对应 slash session 操作，可由用户配置。 |
| `app.session.togglePath` | session picker `ctrl+p` | 切换路径显示。 |
| `app.session.toggleSort` | session picker `ctrl+s` | 切换排序。 |
| `app.session.toggleNamedFilter` | session picker `ctrl+n` | 仅显示命名 session。 |
| `app.session.rename` | session picker `ctrl+r` | 改名。 |
| `app.session.delete` | session picker `ctrl+d` | 确认后删除/移入 trash。 |
| `app.session.deleteNoninvasive` | query 为空时 `ctrl+backspace` | 不侵入输入地删除所选 session。 |

Web 动作入口包括 steer/follow-up、取消、queue 取回、复制、显示折叠、模型/thinking 和 session 管理；输入与非聊天副作用边界见 [模块约定](wire/native.md#约定)。

### 9.4 tree 专用动作

| Action id | 默认键 | 语义 |
|---|---|---|
| `app.tree.foldOrUp` / `app.tree.unfoldOrDown` | `ctrl+left, alt+left` / `ctrl+right, alt+right`（macOS 优先 Alt） | 折叠/展开分支段或跳到段边界。 |
| `app.tree.editLabel` | `shift+l` | 设置/清除 node label。 |
| `app.tree.toggleLabelTimestamp` | `shift+t` | label 时间显示。 |
| `app.tree.filter.default` | `ctrl+d` | 默认过滤。 |
| `app.tree.filter.noTools` | `ctrl+t` | 隐藏工具结果。 |
| `app.tree.filter.userOnly` | `ctrl+u` | 仅 user message。 |
| `app.tree.filter.labeledOnly` | `ctrl+l` | 仅有 label。 |
| `app.tree.filter.all` | `ctrl+a` | 全部 entry。 |
| `app.tree.filter.cycleForward` / `app.tree.filter.cycleBackward` | `ctrl+o` / `shift+ctrl+o` | 循环过滤。 |

手机 tree 已有展开、读取、筛选、折叠、复制、label/选择与 native summary-cancel 的菜单／结果面板入口；助手回复下另有可触控分叉图标，不要求硬件键盘。不提供原地编辑旧消息。

### 9.5 extension shortcuts

extension 可注册任意 `KeyId`。原生会诊断与 builtin/其他 extension 冲突，并在 `/hotkeys`追加有效项（`dist/core/extensions/runner.js:5-48,363-394`；`interactive-mode.js:5368-5381`）。因为当前 worker 没有 extension，当前候选为空。未来 Web 若启用某个 extension，必须由该 extension 或适配层声明 Web action；不能盲目把终端键发送到服务器。

## 10. queue、取消、历史、编辑与复制

### 10.1 原生 queue

- working 时 Enter 走 `streamingBehavior:"steer"`：当前 assistant turn 完成工具调用后、下一次模型调用前送达。
- Alt+Enter 走 `followUp`：agent 所有当前工作结束后送达。
- Escape 清 queue、把文本恢复到 editor，再 abort；Alt+Up 仅取回 queue（官方 `docs/usage.md:63-74`；`interactive-mode.js:3377-3415`）。
- SDK 提供 `clearQueue()`，返回 steering/followUp 文本；项目 host 已使用它处理取消，并明确未知远端 Python 副作用（`src/sessions/session-host.ts:322-364,407-490`）。这是可直接复用的可靠边界。

### 10.2 history/edit/copy

- 原生 editor 的 Up/Down 结合光标位置浏览 prompt history；也有无默认键的专用 history actions（S9）。
- `/tree` 对 user/custom message 的“编辑”本质是移动 leaf 到 parent，把原文放回 editor，然后重发形成分支；不是原地篡改旧 JSONL。
- `/copy`只取最后 assistant 文本或当前 selection，不复制整个工具历史。
- 当前 Web 保留普通消息／正文代码复制；工具调用不再提供输入、输出或整条复制按钮。历史工具统一折叠，最新工具只显示紧凑摘要，点击展开详情；正常用户消息与助手结论保持顺序。Gateway tree/read/presentation controls 展示会话树；回复图标创建包含该回复的独立 SDK 分支，不原地篡改旧 JSONL。
- 当前草稿与准入持久化：[模块约定](wire/native.md#约定)；SDK dequeue/cancel：[REQ-1](contract.md)、[模块约定](wire/native.md#约定)；来源视图选择：[WEB-5](contract.md)、[WEB-6](contract.md)、[WEB-7](contract.md)；无运行时读取：[REQ-13](contract.md)、[模块约定](wire/sessions.md#约定)。F4 精确附件取回是原简化方案中的明确非实现项。

## 11. 副作用与确认边界

| 能力 | 原生副作用 | Web/Gateway 边界 |
|---|---|---|
| login/logout | 写/删 `auth.json` 中 Pi 保存的 credential，OAuth/API key 流程可能联网/打开 URL；env/models config 不随 logout 删除。 | [模块约定](wire/native.md#约定)。 |
| share | 上传 Radius organization artifact，或用 `gh gist create --public=false`发布 secret gist。 | [模块约定](wire/native.md#约定)。 |
| export | 写 HTML/JSONL 到 Pi 进程文件系统。 | [WEB-16](contract.md)。 |
| import | 原生可复制 JSONL 并替换 runtime/cwd。 | [模块约定](wire/native.md#约定)。 |
| trust | 写 `trust.json`；下一启动可加载/执行项目资源。 | [模块约定](wire/native.md#约定)。 |
| reload | 可重新执行已批准 extension 代码并刷新资源/settings。 | [模块约定](kernel-tools.md#约定)、[模块约定](configuration.md#约定)。 |
| `!`/`!!` | 任意本机 shell、文件/网络/进程副作用；`!!`只是不进模型上下文。 | [模块约定](wire/native.md#约定)、[模块约定](configuration.md#约定)。 |
| `/llama` | 连接 router、下载/load/unload 模型。 | [模块约定](wire/native.md#约定)。 |
| `/debug` | 写含完整 messages 的本机日志。 | [模块约定](wire/native.md#约定)。 |
| `/quit`、Ctrl+C/Ctrl+D、signal | 终止原生 Pi 进程并触发 shutdown。 | [LIFE-1](contract.md)。 |
| settings/default model/keybindings | 写用户 settings/keybindings。 | [模块约定](wire/native.md#约定)、[模块约定](configuration.md#约定)。 |
| session picker delete | 删除/移入 trash session JSONL。 | 归档／永久删除端点见 [wire](wire/transport.md)。 |
| 外部编辑器 / suspend | TUI 可启动本机 `$VISUAL`/`$EDITOR` 等进程，或向进程组发送 `SIGTSTP`。 | [模块约定](wire/native.md#约定)。 |

## 12. 桌面、手机、中文 IME 与状态验收矩阵

| 场景 | 对应规则与原验收观察项 |
|---|---|
| 中文 IME | [模块约定](wire/native.md#约定)；`isComposing` / `nativeEvent.isComposing` / keyCode 229；idle 与 busy。 |
| 桌面键盘 | [模块约定](wire/native.md#约定)；`/`、`@`、方向键、Enter、Tab、Escape、Shift+Enter。 |
| 手机触屏 | [模块约定](wire/native.md#约定)；候选、引用移除、busy queue、发送／取消的触摸入口。 |
| 普通文字 | [模块约定](wire/native.md#约定)；路径、URL、邮箱、Markdown、代码及 plain send。 |
| session idle/busy | [模块约定](wire/native.md#约定)、[模块约定](configuration.md#约定)。 |
| read-only/closed history | [REQ-13](contract.md)、[模块约定](wire/sessions.md#约定)、[WEB-16](contract.md)、[LIFE-7](contract.md)、[LIFE-8](contract.md)。 |
| offline/disconnected | [REQ-9](contract.md)、[REQ-8](contract.md)、[模块约定](wire/native.md#约定)。 |
| 能力失效 race | [模块约定](wire/native.md#约定)；reload / target close 后的执行前复核。 |

## 13. 现有项目能力与当前边界

### 13.1 可直接沿用

- SDK Session/JSONL、事件流、model/thinking、queue、abort、compact、tree、session stats、runtime replacement（S4/S5）。
- 现有 Gateway 的显式 sessionId 路由、requestId admission、steer/followUp、cancel、completion/unknown side-effect 证据（S12）。
- 现有 Web 的连接/忙碌/只读状态、中文 IME guard、发送/取消/queue 选择、复制和展示折叠（S13）。
- 现有会话派生、确认、转交、升级、销毁规则；Pi history parent/branch 不能替代这些业务规则。

### 13.2 当前真实边界（非编译缺口）

- Gateway 输入与 native results 的持久化边界：[模块约定](wire/native.md#约定)；实际资源目录：[模块约定](wire/native.md#约定)。
- 历史候选曾禁用 dynamic extensions/skills/prompt templates；该记录不是当前资源策略，当前字段仍由实际 loader/catalog 提供。
- 原方案的 Session Search/OpenViking 延期记录保留；任意会话通信后来有单独实现，见 [Agent 通信调查](agent-messaging-research.md)。手动回复 fork 的当前身份效果见 [模块约定](wire/native.md#约定)，敏感聊天动作见 [模块约定](wire/native.md#约定)。

## 14. 实现与证据映射

### V1. 统一能力目录与控制命令入口 — 已实现

- Gateway 目录形状包括 builtin/hidden/dynamic resource metadata、参数、来源、availability/reason、prefix/reference/attachment limits；其当前生成／分派规则见 [模块约定](wire/native.md#约定)。
- 最终 `check:native:web` 受控浏览器运行通过其实际 catalog/selection/availability 断言；初始 browser child 失败保留在历史 ledger，不覆盖最终运行结果，也不把目录中的每项能力等同于已执行的外部副作用。

### V2. session controls — 历史受控集成证据

- Gateway dispatcher 的动作包括 `/model`、`/thinking`、`/scoped-models`、`/name`、`/session`、`/compact`、`/new`、`/clone`、`/tree` 和 settings；每个路由只有一个会话，不提供 `/resume`，见 [WEB-5](contract.md)、[WEB-6](contract.md)。
- Web new、clone 和回复 fork 的身份／kernel 规则为 [模块约定](wire/native.md#约定)，只读查询为 [REQ-13](contract.md)、[模块约定](wire/sessions.md#约定)、[WEB-7](contract.md)。
- tree read/filter/fold/copy 是展示入口；navigation/summary/label/compact 仍具有各自 SDK 写入与费用语义（原生表）。准入／控制回执边界见 [模块约定](wire/native.md#约定)。
- 最终 SDK、storage、responsibility 与 native-browser 运行覆盖了当时 sessionId subject 的 authority 映射；复制 metadata 仍保留在原生记录，目前的 authority 筛选见 `src/sessions/history/format-authority-entries.ts`。该受控运行不代表外部模型验证。

### V3. composer queue、历史与 IME — 受控浏览器验证通过

- 最终 `tests/web/check-native-web-interactions.mjs` 运行通过实际覆盖的 command selection/send、steer/follow-up、一般队列取回、取消、草稿、tree/copy、desktop/mobile、CDP IME、断连与不重放断言；正常复制另由最终 workbench 运行覆盖。完整输出见当前 verification ledger，初始失败不改记 PASS。
- Terminal synchronization awaits HTTP observation and actual conditions, not Promise truthiness. Closed/history selection reads read-only snapshots without requiring runtime `/state`. Chromium CDP IME coverage does not prove real OS IME compatibility. SDK branch-summary cancellation retains native cancelled/details semantics; incurred work/cost is not undone.
- requestId、取消／dequeue 与瞬态控制结果规则见 [模块约定](wire/native.md#约定)、[REQ-1](contract.md)、[模块约定](wire/native.md#约定)。原简化方案明确不实现 F4 的精确附件取回。
- session/changelog/hotkeys/settings 使用有界 payload；tree filter/fold/copy 是展示动作。历史候选的 Clipboard 证据限标准 API；该结论不是当前所有浏览器辅助复制路径的清单。

### V4. 结构化引用与图片端到端 — 受控浏览器验证通过

- 有界浏览器附件与 worker target-file 引用通过真实 Gateway/SDK 输入路径；每个 worker 都有 target namespace。当前 source inspection/remove/replace/upload 属 UI 验证范围，不以静态映射宣称通过，也不要求旧 source metadata 回执的 restart 重建。
- 输入来源／准入／native result 的持久化边界为 [模块约定](wire/native.md#约定)。参考数值为附件 384 KiB/item、640 KiB decoded total、1 MiB encoded envelope、320 KiB 文本／引用展开；Python/JavaScript MIME 形状见 catalog/wire/decoder。

### V5. 动态 resources 的真实可用性 — 部分映射

- 当时验证的 worker policy 使用 `noExtensions/noSkills/noPromptTemplates`，因此目录显示 disabled/empty；这属于历史候选证据而非当前配置默认值。当前实际目录规则见 [模块约定](wire/native.md#约定)。

### V6. 本机/外部副作用管理面 — 真实 permission boundary

- export/download、reload、quit/view leave、changelog/hotkeys/help 对应 Gateway action/control；当前敏感聊天副作用边界见 [模块约定](wire/native.md#约定)。原验收只覆盖实际已授权的调用与拒绝路径。

### V7. 帮助、快捷动作与隐藏展示 — 已实现的 Web 子集

- Web action help、触屏等价入口、terminal-only/permission 说明、`/changelog`、`/hotkeys`、hidden presentation metadata 均在 catalog/inventory 中；浏览器保留键不被抢占。动态 extension shortcuts 仅在资源与 Web contract 同时存在时出现。

验证必须分开记录：

- **受控模型/fixture 证据**：当前 design-simplify verification ledger 保留初始失败及最终通过。最终 `check:native:web` 与 `check:web` 已通过；结论限于实际断言覆盖的 SDK/Gateway/浏览器机制，不构成独立接受或外部模型能力证明。
- **外部 provider 证据**：真实 model catalog/auth、compact/token/cost、图片 provider 兼容；必须单独授权，controlled PASS 不替代。
- **未授权外部副作用**：只验证 capability preflight/confirmation/rejection，不执行认证、发布、shell、import、download 或 trust 变更。

受控模型通过不能冒充外部 provider 已验证；同样，真实 provider 一次成功也不能替代移动端/IME/state-race 验收。

## 15. 当前决策记录

1. **能力与忙碌状态**：[模块约定](wire/native.md#约定)。原候选的全部 mutation idle-only 限制已不适用于 model/thinking/tool-mode/local-tools。
2. **文件来源与范围**：[WEB-8](contract.md)、[模块约定](wire/targets.md#约定)；附件字段与数值限额留在第 6 节和 wire/config 参考。
3. **普通文本与输入**：[模块约定](wire/native.md#约定)。
4. **extension UI**：原未声明 Web contract 的 custom selector/UI 禁止策略已由 [PLAN 2026-10-12](../PLAN.md) 的有界网页候选取代；原覆盖、BLOCKED 与待定记录不是完整 TUI parity 证明。
5. **会话设置和瞬态输入**：[模块约定](configuration.md#约定)、[模块约定](wire/native.md#约定)。
6. **敏感聊天能力**：[模块约定](wire/native.md#约定)；历史验收授权不转化为新副作用授权。


## 16. 既定延期与非目标

下列边界保持不变：

- **Session Search**：后续实现；当前 transcript 搜索/history picker 不等价。
- **任意会话通信**：`@`不能扩展成 `@agent`/`@session`消息路由。
- **OpenViking 迁移**：仍是后续候选，不是本批存储前置。
- **UI 手动回复 fork**：已按 2026-09-22 的明确要求实现并在隔离浏览器／真实 Jupyter 中验证；普通派生仍 task-only，不因此追加完整历史派生要求。原 `/clone` 的历史副本／显式恢复语义不变。
- 本文记录当前 runtime/Gateway/Web/PLAN 实现与受控证据映射；它不授权提交、推送、部署、生产服务、凭据或任何未授权外部副作用。
