# 会话 code-mode 与 kernel 数据

## 会话 code-mode contracts

规则：[KER-1](../contract.md)、[KER-2](../contract.md)、[模块约定](kernel.md#约定)、[REQ-12](../contract.md)、[模块约定](kernel.md#约定)、[模块约定](native.md#约定)、[KER-4](../contract.md)、[KER-5](../contract.md)。
### Execution and callbacks

Python 执行工具 `kernel_code {code,title?,reset?,yield_s?,mode?,inputs?,outputs?}` 在 `code` / `direct` 两个工具档共用实现。`mode` 如提供，只接受 `thread`、`async`、`isolated` 字符串；`null`、布尔值和旧布尔字段均拒绝。`inputs` 是主 namespace 中要复制的变量名列表，`outputs` 是成功后可选的单个绑定名，工具入口将 `inputs:[]`、`outputs:""` 视为未提供（Bun 同样接受这两个空值）；非空值仅在实际选中 `isolated` 时接受，不改变选路。是否 yield 由全局 `kernel.asyncExecution` 独立决定；关闭时忽略 `yield_s`。
Bun 的 `kernel_code` 只接受 `{code,title?,reset?,yield_s?}`。切换语言用独立的 model-only 工具 `kernel_language {language:"python"|"bun"}`，不能经 `gateway.*` 调用；它与 [native action](native.md#kernel-language) 共用内核准入和持久化。下一次模型请求使用所选语言的 schema、说明和提示词。
异步前台等待先到期时，模型正文为 JSON `{status:"running",cell_id,output,truncated,image_count,note}`，`details` 为 `{toolCallId,kernelId,startedAt,language}`（时间为 epoch ms）。预览只含有界普通输出；不占用变量摘要，不附图块。`cell_end` 先到则仍等图片规范化并返回原终态形状。yield、read、ask 和停止中均不释放执行位；该项结果冻结后才可补位，无需等待通知送达。
`reset:true` 可在满位时请求：先退休旧代并等待清理确认与结果冻结、落账，再重载当前语言的 prelude / library；`code:""` 只重启，否则只在新代执行一次。成功工具结果的 `details.reset`（若有旧代）给出旧 `kernelId`、`reason`、`cause` 及 `affectedCells`；若新代码 yield，首个 running 结果也携带该回执。清理未确认时不执行代码。
Mode 与独立 `localTools` switch 的 action / catalog 字段见 [native](native.md#tool-mode-and-local-tools)。

`kernel_read {cell_id,yield_s?,image_index?}` 与 `kernel_interrupt {cell_id,restart?:"auto"|"never"|"now"}` 为异步模式的 model-only 工具，不能由 `gateway.*` 调用。read 省略 `yield_s` 立即看有界快照；等待不暂停通知。`image_index` 从 1 开始，仅取一张已保留的图。终态读取所属 SDK 分支的冻结结果。中断只接受本会话当前代已 yield 的活项；旧 ID 不能停止新代。

中断省略 `restart` 时沿用首次请求的策略；首次省略取全局配置。`auto` 回 `{status:"requested",cell_id,restart:"auto",grace_ms,peers}`，宽限从 Gateway 首次受理的单调钟开始，超期仍无终帧即退休本代。`never` 最多等剩余宽限，能确认完成即返回该项结果，否则返回 `{status:"stopping",cell_id,restart,blockedAt,observedAt,peers}`，后续 `never` 立即回同一投影；read 的正文和 `details.stopping` 也携带该快照（无观测时 `[]` / `null`）。`peers` 每项 `{cell_id,title,state}`。重复请求只允许在退休前改变策略，不会重复发取消或重计宽限。`now` 不等定向取消，直接退休同代，清理确认后回 `{status:"retired",cell_id,restart:"now",kernelId,reason,cause,initiatorCellId?,affectedCells}`。这不会后台创建新代。

Python `isolated` 定向停止不因主解释器未回应或排空未证实而连带退休。宽限后仍无匹配终帧时，停止快照带 `cleanup:"unconfirmed"`，保留该位和最后证据；可另行显式 `now`／`reset`。已回收子组不等于输出已排空。会话控制及 `cellOnly` 的权限不变。

全局关闭异步后，醒着的会话从下一模型请求起不再声明两个工具；已经 yield 的活 cell 仍可按 ID 读取和中断，原提醒与完成消息继续。Web 结果读取不受开关限制。

`kernel-event` 是原生 custom message，`details` 含 `eventId,kind,sessionId,kernelId,cellId,toolCallId,startedAt,elapsedMs,activeMs,status,truncated,imageCount`；事件 ID 用 `cellId:checkpoint:n` 或 `cellId:finished`。checkpoint 含 `step,nextInMs` 及有界预览；finished 含 `outcome,finishedAt,reason?,lateCallbacks,callbacksTruncated`，正文含终态和最终工具结果，图片只放 `content` 的 `ImageContent`。不批处理、不发第二个父工具结果。

唤醒通过 `pi.sendMessage` 提交 `steer`。若 Pi 已报 idle 但上轮实际未结算，未提交的 checkpoint 和 finished 共用本轮已捕获的 `waitForIdle` fence，结算后按产生顺序逐项复核。checkpoint 要求当前 SDK 分支仍含原生 open，且本项仍在运行、未被用户停止。finished 要求当前分支仍含原生结果回执，不要求 cell 仍在活表；正常追加条目、推进 leaf 不妨碍派发。若用户在派发前停止该项，即使结果已落账，也只追加原生终态消息，不触发模型新轮。见 [REQ-4](../contract.md)、[ORD-6](../contract.md)。

`snapshot.kernel.language` 表示内核语言。`snapshot.kernel.activeCells` 只投影已 yield 且未完成冻结结算的 cell；空时为 `[]`，无图块。每项 `{kernelId,cellId,toolCallId,startedAt,language,status,output,truncated,imageCount,elapsedMs,activeMs,waitingForAsk,taskName?,mode?,deadlineRemainingMs?,blockedAt?,observedAt?}`。`status` 为 `running`、`stopping` 或 `freezing`。`taskName` 为 `title` 或代码首个非空行的有界文本。`waitingForAsk` 只标记本项 ask，该 ask 的 `extensionUi.prompts` 项携带 `kernelId`、`cellId`。`deadlineRemainingMs` 为发布时本项执行硬限的剩余活动毫秒，ask 期间保持余量，无硬限或已进入停止/冻结时省略；不是停止宽限或目标机的绝对时戳。`blockedAt`、`observedAt` 来自本项最近收到的 `cell_state`。`mode` 仅在 runner 报告实际模式后存在，终态工具结果也携带该值；未报告时不猜测。增量沿所属会话流判序并整体替换数组，不清除仍在运行的同伴。

后台化前向所属 SDK 分支追加 `kernel-cell-open`；写失败不返回 `running`。终态在同分支按 `cellId` 追加一次 `kernel-cell-result`，包含有界工具结果及保留图块；落账后才尝试一次通知。原生 `custom_message` 已出现在该分支、且 `eventId` 匹配，才算送达；不以 API 返回、回调或界面显示来判断。断链与换代不自动补发或重跑。

会话快照的 `kernelCells` 为无图的 `{kernelId,cellId,toolCallId,startedAt,language?,delivery,imageCount,outcome?,finishedAt?,truncated?,reason?,cause?,initiatorCellId?,affectedCells?,notice?}[]`。`language` 取该 cell 准入时的语言，不用会话当前语言填补缺值。每项独立对账：`delivery` 可为 `running`、`unknown`（本项仅有 open，且已无本代执行）、`unconfirmed`（已保存，通知未确认）、`delivered` 或 `unsaved`（落账失败，活 Gateway 仍可读）。`kernel_read` 可读当前分支的已落账结果及图块，包括换语言或重启后。
`kernelCells[].lastCheckpoint`（若有）从同分支原生提醒取 `{sessionId,kernelId,cellId,toolCallId,startedAt,eventId,step,elapsedMs,activeMs,nextInMs}`，不重复携带输出。终态元数据也可随同流的 kernel 状态或 SDK 结算事件推送；送达仍以 SDK 分支为准。

Web 按 `(sessionId,kernelId,cellId,toolCallId)` 将运行快照、提醒及终态归入原 `kernel_code` 行；原生 `kernel-event` 不生成第二条工具结果。整轮停止携 `operationId` 和可选的所选 cell；无宿主操作时可用 `kernelInterrupt {kernelId,cellId}` 停所选 cell 及原生 SDK 轮。只有一个活项时可沿用该项身份；多项且未选时不代选，有 `operationId` 则只停该轮。浮条与 ask 停止用 `kernelInterrupt {kernelId,cellId,cellOnly:true}`，不停轮、不清队列。普通定向停止只撤所选项的 ask 与未发提醒；用户引发整代退休时，清单中每项的未派发提醒都作废，终态只写历史及投影，不触发模型新轮。

自动休眠检查全表，跳过未结算的 cell（包括预占、等待 `ask`、停止、冻结与落账）。空闲 kernel 的所有权交接保留 namespace；需要退休的交接按 [Generation retirement](#generation-retirement) 处理。正常关机／归档与强制换代逐项等在途结果落账，不为通知送达延迟交接。人工换代／分支切换在 cell 未结算时拒绝。

PIENV runner 的最低 Python 为 **3.9**。解释器来自实例级绝对路径，不提供会话级覆盖；S6 负责公开实例 schema 与全部生产装配切换。`src/kernel/assemble-kernel.ts` 是可独立调用的新模块，受控 Gateway fixture 通过 `runtimeDependencies.createKernel` 注入，不存在公开双 runtime 配置。

runner 只支持普通 Python、末表达式、顶层 await 与持久 namespace；不支持 IPython、`%`、`!`、`obj?`。显式 `display(value)`、`_repr_png_` 及未与其他 cell 重叠时的 matplotlib 自动收图走同一图片出口；重叠的 cell 不遍历或关闭全局 figures，用户应显式 display 并自行管理 figure 生命周期。matplotlib 启动环境固定 Agg；业务包需目标解释器已有安装。

`thread` 由非主线程运行，多个 thread cell 可重叠；若需运行顶层 await，在该 worker 上使用随 cell 关闭的私有事件循环。`async` cell 在同代常驻的专用事件循环上协作执行，共用本代执行位；同步阻塞会卡住该 loop 上的其他 cell。

### Generation retirement

规则：[KER-8](../contract.md)、[KER-9](../contract.md)、[KER-11](../contract.md)、[KER-12](../contract.md)、[LIFE-10](../contract.md)。

- **主动整代停止**（关闭、需要停止的交接、替换、`reset`、`now` 或 `auto` 超期）：先封住本代的新准入和迟到帧，再一次性截取已提交但尚无终态的 cell 身份，并撤销旧代回调和 ask。未发 execute 的项以 `submitted:false` 拒绝，不进清单；已收到终帧的项即使还在冻结（如缩图），也保留原结果。
- **确认退出后才结算为中止**：只清理本代拥有的目标机 scope 或进程组，并在有界期限内核实退出；发送停止命令、关闭 handle 或仅观测到 runner 退出，不等于所属进程均已退出。清理确认后，清单中每项的最终结果 `details` 均含 `{outcome:"aborted",reason:"kernel 重启",cause,initiatorCellId?,affectedCells}`。`cause` 为 `close`、`handoff`、`replace`、`reset`、`interrupt-now` 或 `interrupt-timeout`；中断退休以 `initiatorCellId` 区分发起与连带。`affectedCells` 是同一份清单，每项 `{kernelId,cellId,taskName}`，包含结果所属 cell。
- **无法确认清理**：清单中的项结算为 `unknown`。生命周期操作返回 `UNAVAILABLE`，`details` 含 `{closed:true,cleanup:"unconfirmed",kernelId}`、已有的退休清单和已知的所属 scope／进程身份（如 `scope`、`pid`、`pgid`）。`closed:true` 只表示旧代逻辑上不可再用，不证明物理退出。
- **意外退出或断链**：作废旧 namespace；已收到终帧的结果保持不变，其余已提交项结算为 `unknown`，不合成主动停止的 `aborted` 结果。断链本身不是退出证明。

同代停止共用一次清理及其结果；等旧代结果冻结及在途结算完成后，只释放一次目标租约。没有旧代退出凭据不得开启新代。退休或失效本身不启动替代 REPL，也不重放输入；只有明确的新请求才可在满足退出条件后初始化空 namespace。

主动停止确认后，若发布该项的 `kernel-event` finished 消息，`details` 带与冻结结果相同的 `reason`、`cause`、`affectedCells`。前台工具结果、同分支 `kernel-cell-result`、`kernel_read` 和 `kernelResult` 都沿用该冻结结果，不按当前活表重算清单。
只有 runner 已报告实际 `mode:"thread"`、且发起本次定向停止超期退休的 cell，冻结结果才在模型正文中建议下次使用 `mode:"isolated"`，`details.suggestedMode` 为 `"isolated"`；该项 finished 也携带相同字段和冻结正文。连带项、显式 `now` / reset、意外失联不产生此建议。

### Typed process frames

#### Bun startup

启动只读取既有制品清单和该目标的已部署缓存；未发布、未下发或不可执行时明确拒绝，不下载、不回退到其他运行时或 PATH 上的 Bun，不启动插件宿主。部署仍走原有实例环境入口。

Bun 经同一目标 `openProcess`、cwd、启动预算和 scope 限额启动。固定 runner 随有界启动帧经 process stdin 送达，在目标内存运行，不随 `openProcess` 的 argv 运送。短命 Python 3.9+ 启动器只读取这一帧，不预读后续控制输入，在选定的 scope 或既有无 scope 回退路径中 `exec` Bun 并将控制输入交给唯一 reader。不读取目标项目的启动配置，不安装包，不接收额外代码载荷。Bun 在 `ready` 前将控制 fd 标为不跨 exec 继承；fd0 为 `/dev/null`，fd1/2 各自成为诊断管道。关闭沿用 [代次退休](#generation-retirement) 的 scope／进程组退出验证。

Bun 的 JS/TS cell 在各自的 async 函数内执行，顶层 `await`、`return` 可用；`display(value)` 输出文本，`display({mimeType,data:Uint8Array})` 输出图片。跨 cell 用 `globalThis` 显式共享，局部声明不持久。词法 `console`、`gateway.call/describe`（或 `gateway.<tool>(args)`）归创建 cell；全局 console 与 raw fd 归诊断。`clear/delete` 仅操作用户新增的全局属性；Bun 不加载 Python library 或 prelude。

`cell.sleep(ms)`、`cell.connect({host,port})`、`cell.fetch(url,init?)` 和 `cell.resolve(name,rrtype="A")` 持有调用项的资源。取消并等待 timer reject、TCP close、fetch body 结束、私有 Resolver 查询 settle；退出时也关闭本项仍持有的资源。fetch 禁用 keepalive，调用方 signal 仍有效。只有原 cell 函数（含 finally）及受管资源结束后才发 `cell_end`。未受管的 `dns.lookup`、`Bun.sleep` 和 `Bun.$` 不修改；仍卡住时由 Gateway 宽限决定是否退休。

`cell.spawn(argv,{cwd?,env?,stdin?})` 返回 `{pid,exited,stdin,stdout,stderr}`。stdout/stderr 固定为本项私有 pipes；排水同时进入本项输出，返回流缓冲超限会报错但不停止排水。取消回收直属子进程并等待其退出、两个 pipes EOF 和原函数结束。scope 中可在仍确认专属组长身份时清理其组；无 scope 时子进程保留在本代 PGID，定向停止不猜测后代归属。后代继续持管时，本项继续占位，按 Gateway 宽限或整代清理处理。原生 `Bun.spawnSync` 不走定向子进程入口，冻结的事件循环由 Gateway 外部宽限处理。

`await cell.import("package[/subpath]")` 从本代固定的已发布包集解析；无包集或缺工件明确报错，不回退项目 `node_modules` 或公共 registry。内置模块仍用 `await import("node:…")`。cell 内不支持静态 import 声明。

#### Python forkserver startup

按 [KER-19](../contract.md)，有界 Python 启动帧携内存源码 `launcher`、`forkserverSource` 与 `configuration.forkserverPreload`。bootstrap 只读一帧；经 `systemd-run --scope` 时用匿名内存 fd 交接此帧，进入 scope 后在启动 launcher 前关闭该 fd，不占用或预读后续控制输入。预载列表在建代时固定，只在独立解释器内按配置顺序加载；BLAS/OpenMP 单线程环境仅适用于该解释器。预载出错记入本代诊断，不使 runner 的 `ready` 或共享执行失败。

目标机代内 socketpair 每个请求一条有界数据报（最多 4096 字节）：`{kind:"fork",generation,cellId}` 随帧传递该项的私有状态与数据 socket fd。实际 OS 线程数须为 1 才能 fork；子进程关闭无关 fd 并完成 `setsid()` 后，服务才在状态 socket 返回绑定身份的 `forked`（含 `pid/pgid/threads`）。检查或握手失败回 `rejected`，含 `ISOLATION_UNAVAILABLE`、`reason`、`threads`（未取得时为 null）与 `preload`（失败模块名；否则为 null）。服务仅在实际 `waitpid` 后回同身份的 `exited` 及退出码；不解析或转发用户 pickle。Gateway 不发送 fork 请求，也不持有这些 socket。

数据 socket 仅连接本代 runner 和该项私有子进程。执行源码为有界 UTF-8；输入映射和返回值为各自带长度的完整 pickle，单向各限 `processWindow.maxBytes`，不借用 Gateway 窗口、不落盘或跨机器。子进程解码及编译成功才准入。拒绝、异常退出、返回超限或解码失败均不写输出名。合法 Gateway 调用／描述仍经所属 cell 的现有 SDK 回调；不开放专用文件、库管理或其他内部回调通道。此模式不是安全沙箱：pickle 的自定义还原可在可信目标解释器运行。

定向停止复用所属租约的目标 `exec`，用本代 Unix 控制入口发有界 `{kind:"cancel",generation,cellId}`，拒绝未知字段及调用者提供的 PID/PGID。forkserver 按自身登记匹配；握手前收到停止则不放行正文。外部回执回显身份，并区分 `pending`（已记录取消）、`reaped`（领导进程已回收且组退出）、`finished`（已接受自然结果提交）和 `unconfirmed`。runner 的常规取消仍撤本项回调等待；仅在 forkserver 退出证据及所属输出 socket EOF 后按原通道发 `aborted`。停止先于提交授权时不绑定返回值。脱组进程不在定向组清理保证内；仍持有输出端时不冒充排空。

无 scope 整代退休先通过同一目标控制入口发 `{kind:"retire",generation}`，封闭新的 fork 并确认本代已登记组的退出，再给 Python 启动器有界 EOF 回收窗口并核验主进程组。使用 scope 时由现有 scope 清理核验。服务连接关闭也清理自建子项，不能把断链或信号送达当作完成证明。

#### Runner frames

Python 的唯一控制 reader 接受 `initialize/execute/clear/delete/library/cancel/callback_reply_chunk`；Bun 不接 `initialize`，以 `UNSUPPORTED` 拒绝 Python library。每帧带 `generation/cellId/id`，回调另外带 `requestId`；两者共用 runner 事件 schema。协议使用不继承的独立 fd，原始 fd 字节不作为协议帧解析。

[KER-2](../contract.md)、[KER-3](../contract.md) 的 runner 输出帧：

- `ready: {kind:"ready",generation,cellId:null,language:"python"|"bun",version,pid,pgid,scoped}`。严格校验形状，并绑定本代和所选语言；`version` 是运行时的实际版本字符串，`pid/pgid/scoped` 报实值，不接受旧形状或兼容字段。
- `cell_admitted: {kind:"cell_admitted",generation,cellId,re,mode?}`。Python 必须报告实际 `thread|async|isolated`，Bun 不带 mode。首个匹配 execute 的帧启动前台等待和执行计时，不释放窗口额度。准入前只占位，不 yield、不写 open；先收到拒绝或终帧则直接结算。
- `cell_state: {kind:"cell_state",generation,cellId,state:"running"|"stopping",blockedAt?,observedAt?}`。状态与有主输出只按 `generation/cellId` 路由到所属 cell，不猜测归属；仅下述确证的纯定时等待可改变停止截止，不改变执行时钟。
- `diagnostic: {kind:"diagnostic",generation,stream:"stdout"|"stderr",text}`，无 `cellId`。无主诊断不归给任何 cell，只进入内核详情的代级 `diagnostics:{stdout,stderr,truncated}`。每个流独立受 `maxOutputChars` 限额，任一流发生省略即 `truncated:true`。进程物理 stderr 也进入同代同一诊断缓冲，退休代的迟到字节被丢弃。诊断正文不混入错误、cell 输出、预览或结果。
Python cell 自带的 `print`、显式 display 和回调由当前执行上下文持有。库直接写标准流、裸 fd 1/2、直接继承它们的子进程，以及无执行上下文的线程写入仅进诊断，不按最近活项猜测。

Gateway 在建代时固定 `kernel.maxActiveCells`（默认 4）与所选 runner 容量两者中的较小值，并在启动配置中把实际值 `maxActiveCells` 传给 runner。满位、维护中或消费窗口不足返回 transient `BUSY`，不排队、不退休。`rejected` 回显被拒请求的 `cellId` 与 `re`；`cell_end` 与 `rejected` 都按 `generation/cellId/re` 结算单条命令，维护命令的结果不作为 execute 结果返回。
匹配到 execute 的 `rejected` 若为 `BUSY`，只确认该请求的消费并拒绝所属 cell，不影响同代其他 cell 或使本代退休。
`execute` 携 `code`、`title`、必填 `defaultCellMode` 和可选 `mode/inputs/outputs`；数据字段只传名字，不传值。Gateway 在预占位时、任何 await 前快照全局默认模式；运行配置更新只影响后续准入。未传 `mode` 则保持缺省，Gateway 不分析源码。目标 Python 按显式值、整段模块编译所得 `CO_COROUTINE`（选 `async`）、默认值的顺序选路；末表达式拆分不参与选路。默认 `isolated` 的模块级 `return` 允许参与选路探测；该探测不执行代码。`inputs`、`outputs` 须为有效用户标识符；模式不符、非法或缺失输入名、输入序列化失败均在准入前拒绝（`submitted:false`，可带 `rejected.reason`），不 yield 或写 open；主 kernel 的输入检查与序列化失败不 fork。共享模式的编译错误直接返回错误终态，不先准入。
Bun execute 只带 `code`、`title`，不使用 Python 模式字段或返回虚构的实际模式。
控制输入由 runner 的唯一 reader 持有；执行环境 fd0 固定 `/dev/null`，默认继承 stdin 的子进程也得到 EOF，不得竞争控制帧。Python 导入模块的普通 `input()` 得到 EOF；Python cell 自带 `input()` 仍明确拒绝并提示 Gateway ask。
单帧`callback`与`callback_reply`不是协议成员，也不存在按大小选择的旧入口；所有请求和回复统一经过chunk路径。
回调请求与回复按 `generation/cellId/requestId` 路由；每个 cell 至多有一个活跃请求，不使用代级全局回调槽。丢弃过期或已撤销请求的回复，不得交给其它 cell 或请求。

Gateway、bootstrap 与 runner 沿用同一份 `processWindow` 限额；默认值和通用校验仍由 `parseProcessWindowLimits` 定义。

Kernel 在 `processWindow` 的总请求数和总字节额度内，分别为 `cancel` 和 `callback_reply_chunk` 保留一个在途位及最大编码帧所需的字节。额度按本代 `generation`、UUID `cellId`、正安全整数请求 ID 和完整 UTF-8 JSONL（含换行及 base64）计算；单帧上限不变。普通命令不可借用预留额度，满时返回 transient `BUSY`，不排队；配置无法容纳两份预留及普通容量时，启动 runner 前明确拒绝。非 kernel 窗口不启用预留。

两种控制帧可同时在途，但与普通命令在同一控制流上串行写入，不另开传输。同类预留在途时，已接纳 cell 的发送方等待前一帧消费确认后再写，不返回 `BUSY`；回复块在目标处理后 `ack`，同一回复的下一块也必须等待。撤销回调只结束 Gateway 的发送等待，已写帧仍占位直至确认；`execute` 仅由 `cell_end` 或 `rejected` 确认消费，取消的 `ack` 不退执行额度。代次退休解除全部在途及发送等待，不重放。

callback 请求与回复按有界 UTF-8/base64 块传输，每块至多 `min(chunkBytes, floor(maxFrameBytes / 8))` 原始字节，重组上限为同一 `processWindow.maxBytes`；普通回复超限返回明确 Python 异常，不能重试潜在副作用。tool_bin 的固定 hash、offset 与完整 raw block 不变，1 MiB raw 回复不会塞进1 MiB单帧。文件及权限请求另有下表更低业务上限。只有 ask 等待暂停单调执行时钟上的硬限和提醒台阶；前台等待的时钟不暂停。

定向停止受理时立即作废本项 ask 和回调，不等 `ack`。Gateway 宽限从此刻开始，等待取消预留槽也不续期；若先收到 `cell_end`，丢弃未写的取消并保留自然终态。Python 对匹配本代活项的第一次取消发 `cell_state`（`state:"stopping"`）和消费 `ack`；重复或已结束的身份只回 `ack`。`blockedAt` 记录本次投递、self syscall 与有界参数块的观测，不含原始地址、参数或内存正文。`queued` 不是退出证明；本项仍占执行位，直至收到执行与收尾都已结束的匹配 `cell_end` 或既有退休流程完成。见 [KER-4](../contract.md) / [KER-5](../contract.md)。

Python `async` 的定向停止把取消请求排入目标根 Task，待该 Task 及其收尾（包括可继续 await 的 `finally`）完成才结算。共享 loop 若正被另一个已确认的根 Task 同步阻塞，目标的 `blockedAt` 在 `{step:"task",status:"queued",observedAt,evidence}` 上成对附 `targetCellId` 与 `blockingCellId`。前者等于本 `cell_state.cellId`，后者属于同代的另一项；该观测不对阻塞者注入异常或执行 socket／子进程唤醒。不能确认占用者（如普通 loop callback）时省略两字段。显式停占用者时才可复用同步停止阶梯，动作须仍匹配其当前执行段；成功结束的是该项根 Task，不是共享 loop。取消帧、Gateway 宽限和退休策略不变。见 [KER-4](../contract.md) / [KER-5](../contract.md)。

共享 loop 不接收跨线程 CPython 异常。目标根 Task 的当前段可报告 `trace/armed`：仅目标在 loop 线程经过自有检查点且身份仍匹配时才抛出一次，已投递后同一停止不再打断后续 `finally`。已有用户／调试器 tracing 不替换；不可确认当前根 Task 时（包括其 eager 子 Task 正执行）不使用该段的同步阶梯。

Linux x86_64 的 Python 同步 worker 或被取消的 async 根 Task 当前同步执行段中，确认无有效 fd 的有限定时等待才报告 `blockedAt` 中的 `{step:"timer",status:"bounded",remainingMs,evidence,observedAt}`。另一个根 Task 的阻塞证据不授予目标延时。相对参数仅给上界；单调绝对等待以目标机同钟换算，只传毫秒时长。`auto` 在原宽限内收到本项正数且不超过 `maxTimerWaitMs` 时，以 Gateway 接收时刻加该时长计算一次截止（不缩短原宽限）。`remainingMs` 表示观测时预计最多等待多久，逾期升级，不保证线程或根 Task 退出。不因重复样本、第二次睡眠或吞异常续时。截止先保留已收 `cell_end`；仍活则按原退休路径升级，不附加新的宽限。`never` 保持原等待回执与占位规则，`now` 直接退休，见 [KER-4](../contract.md)。

同平台上，已登记且收到取消的 worker 或 async 根 Task 当前同步段若停在可核验的 socket 等待，`blockedAt` 会记录 `step:"socket"` 及动作或拒绝依据。`status:"applied"` 仅表示固定副本上的 `shutdown(SHUT_RDWR)` 成功，不表示执行已退出，也不延长停止宽限。共享旧连接的其他使用者可能看见 EOF 或错误，但不会因此被标为已取消。

定向 Python 子进程停止仍只发送当前代的 `{kind:"cancel",generation,cellId,id}`，不接受外部 PID/PGID。`blockedAt` 的 `step:"child"` 记录选中当前等待对象后的信号动作或拒绝依据。`applied` 只表示信号已发给固定的进程/独立组；runner 须等目标被真实回收、worker 或根 Task 退出并收尾才发 `cell_end`。拒绝或收尾未确认均走既有 Gateway 宽限策略，不授予定时等待延时。共享同一子进程的其他使用者也会受影响，但不被标为已取消。见 [KER-19](../contract.md)。

Private MIME：

- `application/x-prk-trace+json`
- `application/x-prk-phase+json`
- `application/x-prk-progress+json`，payload `{stream,text}`
- `application/x-prk-memory+json`
- `application/x-prk-namespace+json`

含PRK私有MIME的display整包仅承载元数据，同包text/plain不得泄漏到模型或Web正文。非ask回调耗时计入cell期限；期限触发的SIGINT结果须保留配置毫秒数的timeout诊断，不能只显示KeyboardInterrupt。

`kernel_code.content` 是 compact ANSI-free cell text，随后是 variable summary、error location、memory line。
isolated 正文在子进程内以一次性 async 函数运行，显式 `return` 传值，无 `return` 得 `None`。返回值的有界展示含类型与省略标记，经原 cell 结果文本冻结；`kernel_read` 和历史只读展示。主 kernel 仅在完整解码、子进程正常退出、未取消且本代仍有效时一次性写可选 `outputs`；不传则不建立隐式绑定，重复读取不赋值。
`maxOutputChars`（默认 32768 UTF-16 units）限制每个 cell 的原始文本 capture，也独立限制每代诊断的每个流；模型文本的 compact head/tail / long-line budgets 来自 `terminal` 配置。旧全局选项的最终重命名归 S6。
`details.truncated` 标记 capture / compact omissions。
不同于 compact text 时，`details.rawOutput` 给出 bounded ANSI-bearing text 与同一 metadata suffix，供 Web 展示。
typed `image` 支持 `image/{png,jpeg,gif,webp,bmp}`（[KER-23](../contract.md)）。每代只有一个 `maxImageBytes` 原始字节预算（默认 20971520，即 20 MiB），由所有活跃及冻结中的 cell 共享，未完成图片的原始块也计入。超限仍排水，不保留超限图片并计为省略；冻结完成释放该 cell 占用的原始字节。`maxImages` 仍按 cell 限制（默认 8）。Gateway 将 BMP 转 PNG 并经 `resizeImage` 缩放后追加 ImageContent。PRK read 通过 runner 公开显示接缝发布图片，不依赖 IPython。

Target Python `bash(command, timeout=None)` → `{exit_code,stdout,stderr,duration_ms,timed_out,truncated}`。
`stdout` / `stderr` 是 separate untrimmed UTF-8 strings，`truncated:false`。
Timeout 单位为 positive finite seconds；默认无 timeout。
stdin 为 `/dev/null`；shell exit 后 drain 至 EOF 或 100ms silence。
Subprocess environment：`DEBIAN_FRONTEND=noninteractive`、`PIP_NO_INPUT=1`、`PYTHONUNBUFFERED=1`、`GIT_TERMINAL_PROMPT=0`。
SDK-native Gateway-host `bash` 是另一工具。

| callback channel | Payload / reply |
| --- | --- |
| `gateway` | `{name,args,result?:"file"}` → `{ok,value?,error?}` |
| `describe` | `{name?}` → callable declarations |
| `binary` | `{name,system,machine,sha256?,offset?,length?}` → `{sha256,size}` 或 base64 `{data}` |
| `library` | `{name,args}` → `{ok,value?,error?}` |
| `capability` | `{name}`，每调用校验，限4KiB |

binary `name` pattern 是 `^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$`；`system` / `machine` 来自 target 的 `platform`。
Chunk reply 最多含请求的 `length` raw bytes；EOF 为 empty data；错误为 `{ok:false,error}`。
Chunk requests 携带 metadata 返回的 `sha256`；asset source 为 manifest/store。
Asset store 见 [configuration](../configuration.md#gateway-distributed-clis-tool_bin)。

Model callable API：`gateway.<tool_name>(**args)`、`gateway.call(tool_name,args)`。
返回值直接是 Python 对象：优先取 `structuredContent`（含 `None`、`False`、`0`），否则原样合并文本为 `str`；不按文本猜测 JSON。PRK 结构化工具必须声明 `outputSchema` 并返回 `structuredContent`，调用方不再对返回值 `json.loads`；失败经 `{ok:false,error}` 抛 Python 异常。
子任务提交的结果以原生消息自动送回所有者；父会话在后续回合读取结果并显式确认，不轮询等待。
Task / messaging 参数见 [derived session tools](../kernel-tools.md)。
Internal callbacks：`prk_library_save/access/used/available`。
Nested call live details 含 `parentToolCallId`，`toolCallId` 为 `<parent>/<n>`；outer result 可含 bounded `nestedCalls`。

### Operation trace

```ts
type KernelTraceDetails = {
  traces:{event:string,operation?:string,args:string[],phase?:string,time?:string}[];
  phases:{title:string,time?:string}[];
  callbacks:{name:string,status:"ok"|"error"|"discarded"}[];
};
```

### Memory and kernel actions

规则：[模块约定](kernel.md#约定)、[模块约定](../kernel-death.md#约定)、[KER-7](../contract.md)、[模块约定](kernel.md#约定)、[REQ-13](../contract.md)、[模块约定](kernel.md#约定)、[KER-8](../contract.md)、[KER-11](../contract.md)、[模块约定](../kernel-death.md#约定)、[KER-12](../contract.md)、[模块约定](../kernel-death.md#约定)。
```ts
type KernelMemory = {
  current:number;workingSet:number;baseline:number;extra:number;
  scope:string;memoryMax:string;memorySwapMax:string;oomKill:number;
};
```

`workingSet = max(0,current - memory.stat.inactive_file)`，`extra = current - baseline`。
Model suffix 格式：`[kernel memory 0.2/4.0 GiB]`；positive observed kill count 附 ` · OOM N`。
后台采样的 `cellId` 为 `null`，只更新代级内存。Cell-final sample 的 display metadata 是 `prk_memory_cell_end:true`，须携所属 cell 身份；仍采样整个 cgroup，不表示该项独占用量。

| Method | Parameters | Result |
| --- | --- | --- |
| `kernelClear` | `{sessionId}` | `KernelSnapshot` |
| `kernelRestart` | `{sessionId}` | `KernelSnapshot` |

### Namespace and variable actions

规则：[模块约定](kernel.md#约定)。
```ts
type KernelVariable = {
  name:string;type:string;signature?:string;docstring?:string;
  origin?:{title:string;phase?:string;time:string};
};
type NamespaceSummary = {
  variables:KernelVariable[];added:KernelVariable[];modified:KernelVariable[];
  deleted:string[];truncated:boolean;
};
```

Namespace 出现在 `KernelSnapshot.namespace?` / `kernel_code.details.namespace?`。
函数/方法含 inspected signature / first docstring line。
Change detection 比较 object identity 与 type；in-place mutation 不标 modified。
时间重叠的 cell 只发布共享 `variables` 快照和空 diff；无法归因的新增／变化变量省略 `origin`，不借其他项的 title 或 phase 补值。
Compaction 后的第一结果还含一份 bounded full list。

| Method | Parameters | Result |
| --- | --- | --- |
| `kernelVariables` | `{sessionId}` | `{variables:KernelVariable[],truncated:boolean}` |
| `kernelDeleteVariable` | `{sessionId,name}` | `KernelSnapshot` |

## Monitor

规则：[WEB-51](../contract.md)、[TGT-17](../contract.md)、[REQ-13](../contract.md)、[模块约定](kernel.md#约定)、[模块约定](../kernel-death.md#约定)、[KER-12](../contract.md)、[模块约定](../kernel-death.md#约定)。
- `monitorFocus {sessionId,open:boolean}` → `{focused,leaseMs}`；`leaseMs = monitor.focusLeaseMs`。
- `monitorHistory {sessionId}` → `{instance,windowMs,machine:[{at,value}],customMetrics:[{name,unit?,chart:"line",samples:[{at,value:{value:number|null,error:string|null}}]}]}`。
- `monitorDiff {sessionId,path}` → `{kind:"git",text,truncated}` 或 `{kind:"agent",text}`。

Git text 为单文件 `git diff HEAD`（untracked 为 all-added）；agent text 为该会话 write/edit rows 的拼接。
`at` / `sampledAt` 是 Gateway epoch-ms；series oldest-first。

Workbench rows 的 optional `monitor`：

```ts
{
  state:"starting"|"ok"|"error"|"stopped",error?,intervalMs?,
  alerts:{kernel,oom,memory},
  machine?:{cpu:{pct,cores},load,mem:{total,available},disk,gpus,ageMs,sampledAt},
  customMetrics:[{name,unit?,chart:"line",sample?:{at,value:{value:number|null,error:string|null}}}],
  processesTruncated:boolean,
  processes:[{pid,command,cpuPercent:number|null,rssBytes,depth,kind:"kernel"|"terminal",
    ownership:"root"|"infrastructure"|"managed"|"unknown"|"detached"}],
  remoteHost:null|{state:"running"|"replacing"|"failed",generation:string,pid?:number,scoped?:boolean,
    memory?:KernelMemory,error?:string,sampledAt?:number,ageMs?:number},
  changes?:{source:"git"|"agent",added,removed,files:[{path,status,added,removed,binary}],
    truncated,error?,gitReason?,gitUnavailable?,ageMs}
}
```

`session_monitor` 的 `details:{monitor}` 替换 row monitor。
Sleeping row 清空进程树并保留末次主机读数，`state:"stopped"`。
工作台行的 `background:true` 表示存在已 yield 的 kernel cell、运行中的模型终端命令或最近样本中的脱管进程；沿 `session_attention_changed.details.background` 更新原行，无新订阅。网页只在会话空闲时显示后台标记。
`gitReason` 是首行 stderr，`gitUnavailable` 区分无法判断与普通 non-repository。
Alerts 对应 failed/unavailable kernel、positive `memory.oomKill`、`workingSet/memoryMax*100 >= monitor.memoryAlertPercent`。

### 后台进程

Gateway 在已有 `monitor/watch` 请求中附带 `processes`（会话 ID 到根 PID 列表）；目标采样器在同一 tick 产生 `processes` 帧，以 `sessionId` 路由，不混入实例历史。根为当前 kernel runner 和已握手的模型终端 shell。无新循环、租约或接口，也不为采样启动 kernel/终端。

每会话每次最多 128 行，超限置 `processesTruncated:true`，计数只表示已采到的部分。每条命令行最多读取 2048 字节。内存为 RSS；CPU 为最近两次同一进程（PID 与启动 tick）的 CPU 时间差除以采样间隔，首样本为空，多线程可超过 100%。僵尸进程不计。

- Kernel runner 和 forkserver 分别是根与项目基础设施。无运行 cell 时，其他活后代显示「脱管」。有运行 cell 时，共享 runner 的 /proc 父子关系不能证明子进程属于哪个 cell，显示「归属未定」，不猜归属。
- 模型终端正在执行模型命令时，用终端前台进程组识别该命令的进程；其他后代为脱管。人在模型终端手工执行的命令不属于模型命令。
- `systemd-run` 转交服务管理器、双 fork 后被 init 收养等会脱离所观察的进程树，监控扫不到。采样不是任务管理：即便看见脱管进程，Gateway 也不会等待、终止它或在它退出时唤醒模型。

### Remote host scope telemetry（STEER1）

对接字段固定为 `WorkbenchSnapshot.sessions[].monitor.remoteHost`；Gateway `workbench {}`、HTTP `GET /api/workbench` 使用同一快照。实时更新沿现有 collection `session_monitor` 的 `details.monitor.remoteHost`，不是新的 SSE route，也不放进模型工具结果。

- `remoteHost:null`：该会话没有远程 Node 宿主，例如本机插件或未启用 native／target 包的远程会话。已有宿主正常释放后回到 null。只产生本机监控投影，不为查询启动宿主／kernel／通道；即使 `monitor.enabled=false`，已运行宿主仍可报告本字段。
- `state:"running"`：已收到当前宿主的样本／注册；`pid` 是注册回执中的 Node PID。`replacing` 是 abort 无回执触发的自动换代，保留旧代次最后样本直到新代次上线；`failed` 是启动、连接或进程失败，`error` 给出原因，最后实测样本可保留。
- `generation` 标识远程传输代次；不同于会话的 streamId。新代次整体替换字段，不合并 baseline、memory 或 OOM 计数；旧代次迟到帧不能更新它。
- `memory` 完整复用上方 `KernelMemory`：current／workingSet／baseline／extra 均为 bytes；scope 为宿主自己解析的绝对 `/sys/fs/cgroup/...scope`；memoryMax／memorySwapMax 为 cgroup 文件中的十进制字符串；oomKill 为该 scope 的 oom_kill 非负次数。首次样本 baseline=current、extra=0，后续 extra=current-baseline。
- 宿主按根 `kernel.telemetryIntervalMs`（默认 1000 ms）读取自身 `/proc/self/cgroup` 和 memory.current、memory.stat、memory.max、memory.swap.max、memory.events，空闲也采样；初始样本在 load 回执前，正常 shutdown 尝试末次采样。workingSet=max(0,current-inactive_file)，与 kernel 一致。通过宿主既有 socket→目标通道 remoteExtensions frame→Gateway 上报。
- `sampledAt` 是 Gateway 收到样本的 epoch-ms；`ageMs=max(0,now-sampledAt)` 是读取快照时计算的样本年龄。无样本时两者和 memory 均省略，不填零。Node 同步卡死或被杀后不会再产生样本；不能保证读取到已经消失 scope 的最终 OOM 次数，只保留最后实测值。显式 `OOMPolicy=continue` 让子进程 OOM 后存活的 Node 能报告计数，不改变内存硬上限。
- 现有 `alerts` 仍表示 kernel 的告警；本字段不把宿主 OOM 混入 kernel 的计数或告警。网页宿主行另行实现，本次不改 Web。


## HTTP routes and events

沉淀工具与 Skills 的 routes 分别见 [tools](tools.md#methods-and-http) 和 [skills](skills.md#methods-and-http)。

规则：[WEB-4](../contract.md)、[GEN-7](../contract.md)、[ORD-1](../contract.md)、[ORD-2](../contract.md)、[ORD-3](../contract.md)、[ORD-4](../contract.md)。
| Method | Path | JSON body | Wire |
| --- | --- | --- | --- |
| POST | `/api/sessions/:sessionId/kernel/clear` | `{}` | `kernelClear` |
| POST | `/api/sessions/:sessionId/kernel/restart` | `{}` | `kernelRestart` |
| GET | `/api/sessions/:sessionId/kernel/variables` | none | `kernelVariables` |
| GET | `/api/sessions/:sessionId/kernel/result?cellId=…&imageIndex=…` | none | `kernelResult` |
| POST | `/api/sessions/:sessionId/kernel/variables/delete` | `{name}` | `kernelDeleteVariable` |
| GET | `/api/sessions/:sessionId/monitor/history` | none | `monitorHistory` |
| POST | `/api/sessions/:sessionId/monitor/focus` | `{open}` | `monitorFocus` |
| POST | `/api/sessions/:sessionId/monitor/diff` | `{path}` | `monitorDiff` |

`kernelResult {sessionId,cellId,imageIndex?}` 返回 `{sessionId,...cellDelivery,result?}`。默认返回最终文本和详情（不返回图块）；指定从 1 开始的 `imageIndex` 时返回一张已保留的图。浏览器仅在已完成 cell 报告保留图片且启用图片显示时请求；按会话、kernel、cell 和工具调用身份验证应答，工具行展开和原图预览不重复请求（`WEB-11`）。未 yield 的 cell 没有这条结果记录，图片按工具输出预览声明的 `imageCount` 走既有 `toolContent`，匹配会话、工具调用与版本后显示。没有终态时只返回投影状态；未知 cell 或图号为 `NOT_FOUND`。只读、不唤醒、不移动分支 leaf。

Session SSE `snapshot.kernel` 是 full object；`host` event `type:"state_changed"` 使用 `details.kernel`。
Live kernel frame 可省略 unchanged namespace。
Collection `session_kernel.details.kernel` 只有 `{state,kernelId?,connectionStatus?,lastOutcome?}`。
Full snapshot 与 namespace delta 的身份边界见规则。


## 约定

- 同步 `thread` 只在本 runner 已登记的 worker 求值用户代码时接受一次 CPython 异常投递；编译、协议写入、回调等待、结果整理不在可投递区。回调响应取消标记；显式 `thread` 的私有 loop 按根 Task 定向取消。主线程串行入口、reader、无主线程和外部进程均不作为投递对象。
- 同代 Python `async` cell 共用一条专用线程和常驻 asyncio loop。编译 worker 退出后由 finisher 把代码交给该 loop，每项在同一活项表登记一个根 Task；根 Task 与执行作用域均结束后才发 `cell_end`。执行上下文按 cell 归属，作用域退出即撤销，空闲期间 loop 仍运行；用户有意保留的连接不会随 cell 关闭，用毕应显式关闭。控制流 EOF 时取消该 loop 上的活任务并等待 loop 清理、关闭及线程退出；不合作的阻塞仍由既有代次退休期限处理。
- 共享 namespace 的 Python prelude 提供 `await gateway.call_async(name, args)`，可在 async cell 等待 Gateway（ask 用 `name="ask"`）而不阻塞共享 loop；同步 `gateway.call`、`gateway.ask` 等接口保留原阻塞语义。两条路径共用同一 cell 的请求槽、分块和校验；reader 将回复投递给对应 Future，被撤销时仅唤醒该回调等待，不向共享根 Task 投递取消。isolated 正文可在子进程中 await，但它的 Gateway bridge 只提供同步调用／描述；不占共享 loop 的 Task。
- 停止观测只在已取消的 worker 登记仍有效时读取 Linux x86_64 `/proc/self/task/<native_id>/syscall`。固定长度的定时参数最多只读 16 字节；poll/select 仅有界读取至多 1024 个描述符范围内的等待集合。未知 ABI、读失败或证据变化仅报告状态。
- 直接 socket 等待或可唯一确定描述符的 poll/select 等待，先记录 socket 的 dev/inode，再 dup，并复查同一 syscall、集合及原描述符与副本身份。只 shutdown/close 自有副本；非流式 socket、已识别的 resolver、监听项、epoll 和多义集合不尝试。首次 syscall 采样与首次 fstat 并非原子，不能证明在首次取身份前已经被并发替换的历史等待对象。不 hook 用户或库方法。
- 子进程定位不依赖创建线程。对正 PID 的阻塞退出等待，或可唯一对应本 runner 某个子进程的读管道等待，先固定 pidfd，复核 worker、syscall 和等待对象，再定向停止。仅确认目标为独立组长且不在 kernel 组时停组，否则只停目标进程。管道等待只在 runner 子进程集合核对同一管道的写端；集合歧义、多个写者、无法完整核对以及任意/组等待均不发信号。不 hook subprocess、不扫描全机，也不代原 waiter 消费退出状态。

- `src/monitor/` 分为 `telemetry`、`collector`、`sample-history`、`custom-metrics`、`agent-edits`、`session-monitor`；装配入口复用各对象唯一 ctx、历史环和租约。collector 按路径发现完整 Python 定义，根层 `assemble-monitor.py` 最后加载；Machine／Monitor 类和构造转发已移除，内部动作直接传同一 ctx，不增加 loader。
- 目标自定义指标由 `target-metrics/assemble-metrics.py` 直接创建唯一 ctx；handle／tick／shutdown 为顶层函数，内部清理直接调用 `close(ctx)`，不经构造转发或实例方法反跳。
- 嵌套 `SDK` 调用必须向调用者返回结果。
- 原生 `nestedCalls` 在父工具返回时截止，不回填。跨越或晚于该边界的回调另在终态汇总有界的 `{name,status}`，不保留参数、子结果或问答正文。
- 带 `parentToolCallId` 的事件不得另建对话工具行、结果消息或影子存储。
- 变量投影只能读取受限用户命名空间的名称、类型和函数签名，不得计算表示值或大小、暴露前导库内部名称。
- 变量删除必须按精确用户名称执行，不得执行删除表达式。
- 原地修改不得标为重绑定。
- 快速监控必须由聚焦租约驱动。
- 监控历史和差异必须仅只读返回留存实例样本。
- 指标错误必须彼此隔离。
- 代理改动量不得当作净差异。
- 清理必须保留内核。
- 内核重启必须丢弃变量并重装前导库。
- 机器和自定义指标曲线必须仅保留在网关内存时间窗内。
- 指标曲线读取必须清除过期样本。
- 网关重启不得恢复指标曲线。
- 内核和模型终端展示文本必须按配置压缩，保留完整省略标记并报告截断。
- 传输投影不得改写保留的命令原文。
- 分页不得伪造无法映射的偏移。
- 模型内存行只能来自当前 cell 显式结束钩子的最终样本，缺失不得复用快照、启动、定时或上一cell样本；无scope不伪造样本。
- `kernel_code` 的重置失败后不得继续执行代码。
