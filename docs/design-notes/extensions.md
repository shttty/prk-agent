## 插件配置与宿主限制

关联 [模块约定](../wire/plugin-config.md#约定)、[WEB-12](../contract.md)、[ORD-7](../contract.md)、[WEB-13](../contract.md)、[WEB-12](../contract.md)、[ORD-8](../contract.md)、[LIFE-17](../contract.md)、[WEB-15](../contract.md)、[REQ-4](../contract.md)、[模块约定](../wire/native.md#约定)、[模块约定](../wire/extension-ui.md#约定)、[LIFE-17](../contract.md)、[模块约定](../wire/extension-ui.md#约定)、[ORD-1](../contract.md)、[ORD-2](../contract.md)、[ORD-3](../contract.md)、[ORD-4](../contract.md)。
来源：原 `gateway-wire.md:288,388-401,457-463`。

- 配置描述（`description`）只校验结构，不验证插件是否实际读取某个键；插件更新不修改描述。模型只登记说明或读取，操作者写值；插件在会话重载或网关重启后读取值，没有自动重启。`pluginConfig*` 只登记 Gateway-host 文件，不是目标机插件配置编辑接口；远程安装列表使用独立的包管理路由。
- 嵌套工具调用不产生独立工具结果消息；依赖自身结果消息恢复的插件，需要其公开的嵌套调用持久化契约。
`prk-todolist` 的 `todo_list` 用 `pi.appendEntry()` 快照保留列表，嵌套调用后原生资源重载仍可恢复。项目没有补建影子存储，也不读取或迁移老插件快照。
- 原文第 `290` 行说父项不渲染 `nestedCalls`；源码 `web/chat/tool-text/nested-summary.js`、`web/chat/transcript/tool-calls/body/NestedCalls.jsx` 已有父项摘要。实时嵌套事件仍不建独立行，不能把前一句当作禁止父项摘要。
- 托管模式的 `tui` 是 `Pi 1.1.0` 的兼容标签，不代表终端能力对等；深浅色主题资源使用 `additionalThemePaths`。
已批准且带版本检查的 `coding-agent` 快捷键内部导入集中在 `extension-ui.ts`，并传入会话的 `agentDir`；没有全局 `initTheme` 或上游原型覆盖。
- 旧文第 `458` 行对替换编辑器提交的说明，与 `setEditorComponent:()=>{}`（`src/sessions/extension-ui.ts:563-565`）不符：网页保留项目自己的输入框。
可解析的自定义节点有原生控件；不透明组件只读并提供取消。原始终端输入输出、原始快捷键桥接、依赖上游全局终端主题的组件仍受公开接入能力限制。
- 渲染器的 `default`、`self` 遵循实际注册工具定义的公开渲染接口；浏览器只抑制终端颜色，不启动 `ToolExecutionComponent` 或 `InteractiveMode`，也不托管 `CC` 原型覆盖。
- `ask` 答案走文本通道，不是图片附件；需要模型看图时由输入框发送附件。直接模式和代码模式都有工作单元自有的 `ask`，原文第 `461` 行的第三种 `local` 模式已失效。非法答案保留对话框，超时选择推荐项或首项；优先聊天、取消工具和停止回合的结果不同，结构见协议参考。

### 远程扩展宿主正式接入

关联 [远程包配置](../configuration.md#package-location-and-per-instance-installation)、[包管理协议](../wire/plugin-config.md#remote-extension-packages)、[远程 UI](../wire/extension-ui.md#remote-extension-ui)、[TGT-17](../contract.md)、[TGT-18](../contract.md)、[REQ-16](../contract.md)、[LIFE-19](../contract.md) 至 [LIFE-21](../contract.md)。

- 正式接入只代理工具、已声明事件和 Pi RPC UI 子集；会话身份、历史、注册、事件链与执行队列仍由 Gateway 的原生 SDK 持有。同步 getter 只读显式传入的上下文快照，不宣传透明或完整 `ExtensionAPI`。远程 slash command 只列声明，provider 注册及通用 TUI 组件不在本次范围。
- Gateway 在构建侧解析精确 npm 版本或上传 tarball，保存原包、锁文件及完整依赖树，随 host/codec 打成不可变 bundle；Node 也发布为制品。目标机复用既有通道收制品，不访问 registry，不执行 npm install，也不另建插件数据库。本机 target 包同样经本机daemon启动独立宿主；只有 `location:"local"` 包在Gateway加载。
- Linux aarch64 只定义分发合同，未做实机验证。构建使用 `--ignore-scripts`，不执行依赖安装脚本或 native addon 编译；需要这些步骤、特定 libc 或其他未验证二进制依赖的插件不能据此宣称兼容，加载失败明确报告，不在目标临时安装补救。HTTP 安装入口使用 Gateway 架构；显式交叉平台构建属于 builder 的平台参数，不是 HTTP 自动平台选择。
- 远端 context 的 `mode:"rpc",hasUI:true` 允许既有数据对话框与标量界面通道透传，不等于完整 TUI。`ui.theme` 缺少公开的活动主题导出接缝，按已确认边界明确报错并记日志；不调用上游全局 `initTheme`、复制主题实现或用近似颜色伪装支持。其他 TUI-only 接口保持 RPC 的不支持语义与日志，具体能力表见协议参考。
- kernel 文件模块 read/edit/write 已经公开 `ctx.executeTool` 产生真实嵌套原生事件；文件插件在 target 上作用于目标文件。本地 open/bash/子进程写入仍不产生文件工具事件，没有合成写后事件。
- 远程执行 `generation` 只区分目标进程和回调，便于拒绝失效进程的帧。共享通道的恢复不复活旧进程、不重放请求；正式重载经既有会话宿主重建获得新的 `streamId`，网页直接沿用日常流契约，不增加独立界面代次或时间戳计数器。

#### 约定

- `npm test` 的单元层使用 Node 原生 `node:test`，不依赖 Python、浏览器或模型。
- 单元测试只直接调用 codec、包合并／位置解析／指纹、注册元数据校验和 catalog 聚合等纯函数；不造 `ctx`、mock 或 IO。catalog 聚合保留扩展入口与注册顺序，后续空入口不得清空先前命令；真实加载、发布与跨进程生命周期继续由既有集成测试覆盖。
- remote-extensions 的对象上下文与领域类型集中在各对象已有 `*-types.ts`；host/memory 的 JSDoc 形状改为 `host-types.ts`／`memory-types.ts`，不再部署空类型模块。方法从同一对象的唯一类型文件导入一次；跨对象与 SDK 类型仍直接指向定义方，不建类型转发壳。codec 的 `.mjs` 实现保留配套 `.d.mts` 声明。
- 源码注释只说明隐含约束、接入偏离或反直觉行为；不再复述文件名、装配动作或迁移前闭包。
- 对象内部直接调用 `fn(ctx, …)`，装配只保留跨对象消费者与 Promise／socket 等外部回调需要的稳定绑定。host 与 memory 的代次、状态身份、初始化、错误、取消和释放顺序保持不变；资源发现与 worker-runtime 不在此次结构削减范围。

### 网页会话流身份

原 `gateway-wire.md:459` 的界面代次方案已移除；当前唯一契约见 [ORD-9](../contract.md) 至 [ORD-19](../contract.md)。宿主流身份覆盖完整快照、增量与界面响应；对话框使用独立 UUID，不再带界面代次前缀。没有兼容身份、第二套会话存储或重放机制。

## 已实施设计：Pi 原生工具装在远程宿主

状态：PRK-NATIVEREMOTE，2026-10-30；此阶段验证插件兼容机制，hash read/edit 行为不改。跨边界规则见 [KER-17、TGT-23～26](../contract.md)。

### 互斥与执行位置

- 沿用唯一 `localTools` 开关及原持久化、UI。七个同版Pi公开definition在会话创建时始终注册；本机与远程均经所属目标独立宿主执行。无target插件／项目扩展时，首次真正原生调用才启动宿主；已有插件宿主仍共享同一代次及原装事件总线。
- kernel bootstrap 始终加载 `prk_tools.files`；原生开启时不列其提示／可调用目录，并在函数执行前拒绝。模块和 hashline 展示表留在同一 Python kernel，关闭原生后恢复使用，不做导入卸载或变量清空。
- PRK 文件出口只给专用 kernel 文件回调使用，沿用 [PRK 文件模式](files.md#已实施设计kernel-文件写入对插件可见) 的 hashline、元数据 read、写后 hash 与插件契约。同名工具的声明及普通调用权限属于原生组，不因 PRK 出口而放行。
- 其他 kernel helper（bash、glob、ls、memory 等）不变。不会根据名字或调用来源增加第二套 read 规则：原生开时，模型、`gateway.read()` 和插件 `ctx.executeTool("read")` 都真正读目标文件，返回 Pi 正文或图片。

### 公开定义与插件事件

- 目标宿主保存 Pi 原始定义，execute 不包裹、不加前置检查，不传远程 Operations。模糊匹配、文件队列／realpath、BOM／换行、图片与 diff 均由安装的 Pi 实现。
- **STEER1（2026-10-30）更正原设计**：Pi 原生 edit/write 不做 Vim/Emacs 检测；[PRK 文件模式](files.md#匹配写后格式化与状态) 原有检测不变。
- 工具声明、参数及结果复用既有扩展协议。JSON 无法携带 edit 的同步 `prepareArguments` 与 renderer 函数，原生声明以显式 Pi 身份标记，由 Gateway 从同版公开工厂恢复这些函数；Gateway 不调用其 execute。插件仍经过 Gateway SDK 的同一 tool_call/tool_result 与公开嵌套 executeTool 链。
- 工具执行与事件钩子都不设固定期限；Pi bash 的自身 timeout 和 abort 原样传到目标宿主。启动、注册、快照与关闭保留控制期限；连接存活沿用目标通道心跳／状态。断线失败不重放，见 [REQ-17](../contract.md)、[LIFE-19](../contract.md)。

### 制品与离线运行

- Bun／Node、宿主 bundle、rg/fd 沿用已有制品清单、SHA-256 分块分发与目标缓存；Bun 来自 `tools.bun` 的目标架构条目，Node 仍取 Gateway 版本的不可变制品。无插件的核心 bundle 从 Gateway 已安装的依赖构建，不在目标运行 npm。
- 原生宿主启动前将分发后的 tool_bin 所在目录加入 PATH，强制 `PI_OFFLINE=1`；Pi `ensureTool` 使用缓存或 PATH，不允许目标自行下载。缺少制品明确报错，不切到 Gateway 或系统二进制伪装成功。fd 与 rg 均使用既有通用制品导入，不另建接口。
- 无 target 插件的宿主只加载 Pi 1.4.0 的内部 tools 与 event-bus 模块；版本不符明确失败，不回退包根。含 target 插件时仍加载整包。此内部布局接缝登记在 [Pi SDK](../pi-sdk/README.md)，bundle 保留完整锁定依赖及所需内部文件。
- 宿主里的 Pi 原生工具不加任何包装或前置检查（用户定：只要在远端完全真实地使用 Pi 原生文件工具）。vim/emacs 活锁拒写只属于 PRK 自己的文件工具那一侧。

### 切换生效与代价

- 开关立即更新调用权限、下一请求更新声明，不再置重载标记、不经 `excludeTools`。已注册工具保留 active 和原 exposure，统一 `tool_call` 钩子拦截关闭项；kernel 函数通过所属 cell 的 stdin 查询当前开关。切换不重建 SDK、不重启 kernel，Python 变量和文件展示表保留；冷 kernel 不为切换而创建。只有注册资源／文件或包配置变化需要重载。
- 原生 read/edit 的整文件内存读写都在目标机；Gateway 只接收所需页、图片或差异，不来回搬整文件。Pi 自身输出限制和既有扩展帧限制生效，不套用 PRK hashline 的 200 MiB 文件限制。
- Linux aarch64 仅承载既有平台合同，本轮不做实机验证。faux 验收只证明真实调用路径机制，不代表付费模型能力。



## 已实施设计：远程宿主按会话合并、独立 scope 与钩子停止

状态：PRK-HOSTSTOP，2026-10-30。跨边界规则见 [TGT-27/28、REQ-17/18、LIFE-24/25](../contract.md)；协议字段见 [远程扩展](../wire/plugin-config.md#remote-extension-packages)。

### 宿主形态（对齐本机 Pi）

- 每会话每目标机一个宿主：Pi 原生七工具与该会话所有 target 包一起加载，各包保留独立声明、来源与错误投影。运行时由 `remoteHost.runtime` 选 Bun（默认）或 Node；参数分别是 `bunArgs`／`nodeArgs`。`pi.events` 直接使用 Pi 原装 `createEventBus()` 的同一实例，不转发或复刻事件总线。
- 目标通道Python在scope可用时以`systemd-run --user --scope`启动短命根，stdin为`/dev/null`；Pi通过公开Unix socket连接。在`$XDG_RUNTIME_DIR`（未设置则`/tmp`）以mkdtemp原生权限创建短前缀`prk-<random>/s`，遵守107字节路径上限；只accept一次后unlink并关闭listener，宿主退出／启动失败时rmtree，不加权限／属主／残留扫描检查。Bun 1.4.3的`new Socket({fd})`不接管已连接socket（[上游说明](https://github.com/oven-sh/bun/pull/35341)）；使用公开`net.connect({path})`，不继承socket。scope内核对实际归属、MemoryMax/MemorySwapMax与记账文件，保持调用者mount/network namespace。scope不可用时明确`scoped:false`并回退本PGID，不伪造内存硬上限；选定scope后的归属或上限校验失败仍拒绝启动。
- 宿主独立 `prk-remote-host-<uuid>.scope`，`remoteHost.memoryMax` 默认 1 GiB、`memorySwapMax` 默认 0；配置见 [configuration](../configuration.md)。原生 bash、LSP 和 detached 子进程均受该上限约束，不在 kernel scope 内。OOM 可能只杀 allocator，也可能杀宿主，不据此替换 kernel。
- D7保留每次启动的Python launcher为短命根并fork Pi；Linux父死信号、Pi退出或显式关闭都触发根清理所属scope／无scope时本PGID，覆盖Pi同步卡死。TERM后1秒KILL，按cgroup消失或populated=0确认；无法确认仍报错。根不加载插件，无常驻守护或残留扫描；pid仍为执行Pi的进程，rootPid独立标识清理根。旧pi-env断链SIGKILL runtime导致独立宿主残留的失败证据保留在S5报告，不再沿用旧exec结构。
- STEER1：宿主按根 kernel.telemetryIntervalMs 自采样，memory 字段与 kernel 完全同形，通过既有 socket／目标通道上报 monitor.remoteHost，网页另做。scope 显式 OOMPolicy=continue，避免子进程 OOM 后 systemd 连带停止存活的宿主；内存硬上限不变。宿主自身被杀时只保留最后实测样本与 failed 状态，不推算已经消失 scope 的终值，详见 [监控字段](../wire/kernel.md#monitor)。

### 钩子与停止

- 远程事件钩子与 execute 无固定期限；启动握手、load、snapshot、shutdown 保留控制期限。异步 handler 的执行寿命由其自身及调用取消决定。
- 停止时 Gateway 删除钩子的 pending 关联并发送按请求 id 的 abort；宿主触发 ctx.signal、作废其反向回调并回 `abort_ack`。Gateway 与目标 handler 都与 abort 赛跑，迟到回复直接丢弃；tool_call 抛错不执行本次工具，tool_result 抛错沿用原结果，其他事件按 Pi handler 错误处理。
- `remoteHost.abortTimeoutMs` 默认 5000；回执逾期停掉旧 scope，经 Gateway 既有运行时切换／空闲重载替换 SDK `SessionHost`、streamId 和远程代次，重新发送 session_start。保留同一 SessionManager／JSONL 和 kernel；全会话 target 包与原生工具一起换代，在途结果未知且不重放，其他会话／目标通道不换代。断线本身不触发此恢复路径。
- Gateway的 `location:"local"` handler使用公开resource loader `extensionsOverride`返回PRK自有handler投影；不修改SDK Extension／Map／原型。AsyncLocalStorage只携带当前PRK SDK调用的取消信号，与ctx/event/lifetime信号合并；投影在调用时与abort赛跑，Pi保持唯一排序、事件错误、队列及历史权威。动态pi.on/unsubscribe仍以原注册表为准。
- 会话关闭／重载／Gateway 关停先取消已经在途的钩子。随后新发出的 session_shutdown 是独立控制事件，沿原生 SDK 等待其正常清理，不继承已退休回合的取消；若该控制 handler 已挂起，再次取消会与其结果赛跑。远程 shutdown 保留控制期限并在 SDK runtime.dispose 之前完成；不保存失效 ctx 来绕过上游守卫。Gateway 目录探测绑定其 lifetime signal。

历史验收覆盖共享进程／总线、独立内存上限、真实 OOM、setsid 清理与 kernel 连续性；也覆盖本机／远程停止、迟到结果、同步死循环换代、6 秒钩子、公开 loader 接缝及动态注册。均为隔离真实路径＋faux，不代表付费模型能力；累计证据见任务报告。

`check-host-cleanup.mjs local`／`office`另外覆盖D7正常close、wrapper断链、独立Gateway SIGKILL及同步卡死的scope／PGID清理，并保留独立kernel变量和其他宿主。物理退出由独立observer证明；Gateway断链后无法自证kernel清理的结构化UNAVAILABLE另行记录，不吞错误。非Linux父死清理未保证。

### 不做

- `location:"local"` 插件、provider及renderer仍在Gateway进程；本机target插件已独立宿主化，不把前者机械迁到目标进程。
- 大图片、大 diff 端到端尺寸上限另议。

## 插件按会话加载的隔离边界

状态：plugin-load-switch。开关语义与 capability id 见 [配置：加载开关](../configuration.md#plugin-load-switches)。关心的问题是：多个会话在同一个 Gateway Node 进程里，跳过一个会话的包会不会影响别的会话。结论由 `test/integration/session/package-load.test.mjs` 的真实 Gateway 用例核对（本机 Gateway 包、本机会话宿主包、远程会话宿主包各一条）。

- **每会话独立的加载对象。** 每次 `createSDKSession`（新建、唤醒、重载）调用一次 `createAgentSessionServices`（`create-sdk-session.ts` 48 行），得到自己的 `DefaultResourceLoader`（SDK `agent-session-services.js` 63 行）。loader 自带 `eventBus`（`resource-loader.js` 262 行）和 `createExtensionRuntime()`（533、555 行），每个扩展在 `extensions/loader.js` 的 `initializeExtension`（564–577 行）里得到自己的 `Extension` 对象；会话的 `ExtensionRunner` 由 `agent-session.js` 3089 行按该结果新建。钩子、工具、命令只存在于这些每会话对象里，所以某会话把包从自己的 settings 去掉后（`create-settings.ts` 24 行的 `filterPackageEntries`），别的会话的 loader、runner 与事件总线不受影响。
- **模块级状态进程内共享，但进不了跳过的会话。** Pi 的扩展入口缓存只缓存默认导出的 factory 函数（`extensions/loader.js` 91–105、516–541 行，`reload` 时清空）。实测把同一个包依次交给全局目录、会话 A、会话 B 加载（`.js` 与 `.ts` 入口各试一次）：模块顶层在整个进程里只求值 1 次，factory 每次加载调用 1 次；B 关闭加载并重载后 factory 调用次数不变。所以加载它的会话共享该包的模块级变量（这是插件作者本来要面对的），而不加载的会话从不调用 factory，没有 `pi.on`、工具或命令注册，模块里的状态无法通过任何入口作用到它；别的会话已导入过模块，也不改变这一点。
- **provider 是进程级共享状态，带 provider 的包不能按层关。** 会话内的 `registerProvider` 被 `providerPolicy` 拒绝或忽略（`create-session-provider-policy.ts` 4–13 行，`assert-provider-policy.ts` 13–28 行的启动探针验证这一点）；注册只发生在 Gateway 启动的 provider-only 加载（`load-model-runtime.ts` 25–39 行，`create-provider-bootstrap.ts` 8–24 行），写入所有会话共用的 `ModelRuntime`（`create-sdk-session.ts` 的 `modelRuntime` 依赖）。技术上让某会话不加载这类包并不会改 provider，但“关闭”会让人以为 provider 也关了，所以所有层都拒绝：写入时 `PROVIDER_POLICY`（`validate-package-load-change.ts`，角色保存在 `reject-provider-role-unload.ts`），存量配置里已有这样的值时会话创建同样失败（`read-unloaded-packages.ts`），都不静默忽略。要停用这类包只能用插件设置的 `enabled`，重启 Gateway 后生效。
- **远程宿主每会话一个，按会话跳过即不加载其入口。** 每次 `createSDKSession` 为该会话调用一次 `prepareRemoteExtensions`（`create-sdk-session.ts` 38–47 行），产生一个宿主 factory（`prepare.ts` 67–85 行）；`assembleGeneration` 给它新的 `generation: randomUUID()`（`assemble-generation.ts` 10 行），`start` 在目标机起一个独立宿主进程，并把本会话的 `packages` 发给它（`generation/lifecycle/start.ts` 19–25、46–50 行）。连接由实例内所有会话共用（TGT-17），宿主进程不共用（TGT-27）。跳过因此只需把该包从传给 `prepareRemoteExtensions` 的 `packages` 去掉（`create-sdk-session.ts` 40 行）：宿主 `load` 请求里没有它，不加载入口、不注册钩子，也没有可转发的事件。Pi 原生七工具的宿主不受影响，包全部被跳过时照常启动。
- **全局目录不受影响。** `create-discovery-runtime.ts` 18 行用不带会话层的 `createSessionSettings` 加载全部已启用包，设置页的工具和插件列表照旧；会话目录对被跳过包的条目只显示 `loaded:false`，且不会因此置 `requiresReload`（`format-catalog.ts` 47–48 行）。
