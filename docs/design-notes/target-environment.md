# 目标环境连接与Pi宿主

生产 Gateway 使用 `src/target-environment/connection/assemble-environments.ts` 的
`createTargetEnvironments({resolve,onEvent?,onLog?})`。`resolve(instanceId)` 只返回
`{local:true}` 或 `{local:false,command}`，不是第二份实例配置模型。本机目标同样由 Gateway 按需拥有的 local pi-env daemon 执行；远程目标使用实例保存的连接命令。

**D3 已批准并实现 PRK process 消费窗口。** pi-env 1.6.0 自身仍无消费背压；
PRK 在自己的消息协议内限制在途请求数和未消费字节，满窗口立即以类型化 `BUSY` 拒绝，
不建立等待队列。`process-window/assemble-window.ts` 是 target runtime 与 kernel REPL
共用的唯一实现；没有修改 pi-env。此前 G2 的静态证据保留在当时的任务记录（未随仓库发布），当前方案由 D3 取代其阻塞结论。

## 登录命令与部署

`python` 显式配置时必须是目标机上可执行的 Python ≥3.9；不做覆盖或迁移。省略时按实例建立共享 venv，REPL 与模型终端使用该环境，不提供会话级覆盖。仅远程缺 `sshCommand` 时允许保存为待补；历史、归档和休眠设置仍可读，执行以 `submitted:false` 和结构化原因拒绝。

本机和远程目标的 Pi 原生七工具及 target 插件均运行在独立目标宿主；显式 `location:local` 插件与 provider 仍归 Gateway。目标连接失效时旧 handle、执行和 namespace 退休，未确认结果不重放；观察和监控不后台重连，下一次明确执行才可建立新代次。

旧数据使用 [离线迁移](../configuration.md#operator-migration-manual-not-automatic)：Gateway 停止后运行 `scripts/migrate-pienv.mjs`，从旧本机 spec 读取实际绝对解释器；spec 缺失或权限不可读则不写解释器，后续须显式下发托管环境。不从旧地址推断远程命令。

[TGT-57](../contract.md) 的 `command` 原文由本机 `/bin/sh -c` 执行；允许环境变量、
管道、重定向和用户包装程序。PRK 不做 argv 拆词，不增加 SSH 参数，不把 daemon command 拼到用户命令。
用户命令须最终提供一个读 stdin 的 POSIX 兼容非交互 shell；交互密码、OTP、MFA 菜单和手动登录接管不支持。
profile 不得吞 stdin 或在 daemon token 后异步写 stdout。

原版 Connection 启动项目自有 `daemon/run-wrapper.mjs`，它只消费 Connection 追加的
`serve --token <hex>`。握手 token 只在内存/运行 argv 中，不持久化或写诊断事件。
wrapper 从启动起暂存 hello/ping，最多 1 MiB；目标 stdout 原样 pipe 给 Connection，
只读副本解析随机 BEGIN/END 与真实 `PI-ENV <token>\n`，不删除 profile 前缀或伪造 daemon 回应。
确认真实 token 后依序释放原版字节，直通阶段遵循 Node pipe/write 的背压。
Gateway 拒绝 daemon 版本非 1.6.0、protocol 非 1 或未声明 `process` 能力的 hello。
这只覆盖 wrapper 自己的 pipe，不修补上游 Connection 或 daemon 内部队列。

目标探测 uname、HOME、UID、shell 和所需工具；平台制品位置调用上游 `packagedDaemon`，
本机调用 `localDaemon`。远程目标需要 base64 -d、sha256sum、mkdir、mv、chmod、rm、tar、gzip、getconf、mktemp 及 uname/id。
部署目录为 `<targetCacheRoot>/pi-env/1.6.0/<完整SHA-256>/pi-env`；完整摘要匹配才复用。
冷部署发送 quoted heredoc + Base64，随机结束符含 `_`，解码到随机暂存路径，完整 SHA-256
比较后才 chmod/rename 并确认。失败 trap 删除暂存；不下载目标文件到 Gateway。
唯一整文件传输为包内 daemon 制品（本次 Linux x64 2503488 bytes），Base64 用于一次冷部署；
不以这条路径搬运业务文件。成功缓存保留供后续明确连接复用。

wrapper 的探测/缓存检查各 10 s、上传 30 s、exec-token 8 s，总启动预算 50 s；目标 process runtime 的启动另受 `targetConnection.startTimeoutMs` 约束（默认 15000 ms），请求期限 `targetConnection.requestTimeoutMs` 默认 10000 ms。
原版 Connection 的 60 s hello、5 s ping、30 s silence 保留且可能更早结束连接。
阶段观察副本上限 1 MiB，stderr 尾部 8192 字符，控制 socket 帧缓冲 64 KiB。
超时关闭自己创建的登录进程组，1 s 后仍未退则 SIGKILL；不重试上传或后台重连。
诊断包含阶段、退出码/信号与 stderr；连接错误沿现有 `TargetUnreachableError.cause` 保留原因。

## Process 目标 runtime 与消费窗口

`target-channel/process-transport/open.ts` 的 `openProcessTransport(lease,python,cwd,signal,startTimeoutMs?,processWindow?)`
接收已共享的环境 lease、显式解释器和绝对 cwd。它在真实 pi-env process pipe 中执行
由 `createProcessBootstrap(processWindow)` 生成启动代码，先 READY，再读取有界 Base64 源码并在内存启动全部原模块；
源码不写目标文件，不进入 kernel REPL；生产装配使用该 process transport。

原版 openProcess 没有启动 signal；adapter 对外等待有界，取消后仍保留 late handle 的所有权，
返回时立即关闭。每 Connection 的未完成 open 也复用同一窗口实现限流；取消/启动超时不退款，
只有原生 open Promise 完成才释放启动额度。已有其他 lease 时不关闭共享 Connection。
监听安装前 stdout 最多 `processWindow.maxFrameBytes`，UTF-8 使用 StringDecoder；stderr只保留64 KiB尾部。
启动失败先保存原始错误，再清理自己的 lease，避免最后释放的正常 abort 遮盖 spawn_error。

全局 `[processWindow]` 使用 `maxRequests=32`、`maxBytes=2097152`、`maxFrameBytes=1048576` 默认值，唯一默认仍位于 `target-environment/process-window/window-limits.json`。
公开 `process-window/parse-limits.ts` 的 `parseProcessWindowLimits(value?)` 拒绝未知字段、非正 safe integer 与 `maxFrameBytes > maxBytes`，返回只读 `ProcessWindowLimits`。
`PrkConfig.processWindow`、`TargetChannelOptions.processWindow` 与 process transport 使用同一有效值；runtime源码、bootstrap、接收分帧、sender及启动窗口均注入该值，S4 runner也消费同一类型/parser，不复制默认。
请求按序列化后的 UTF-8 字节（含换行）预留额度，满窗口返回 `code:"BUSY",transient:true`；超帧返回 `FRAME_TOO_LARGE`，均不发送、不入队。
目标模块处理完成或拒绝本条请求后才发 `re` 应答；这个应答才释放额度，SDK processWrite 的入队应答不释放。
取消/超时只结算调用者并清理等待 Promise，不清消费额度；迟到 `re` 只归还原额度，不恢复已结束调用。
断链清空并永久退休本窗口，旧 handle 不可复用；后继进程创建独立窗口，不重放。

目标模块队列最多 `maxRequests` 项；输出队列最多8帧，双方拒绝超过 `maxFrameBytes` 的帧或未结束行。
启动源码也限 `maxFrameBytes`，在 runtime hello 前一次发送，不与请求窗口重叠；配置不足以容纳源码时明确失败。
文件/图片不作为无界 stdin 载荷；现有制品分块、文件API和既有有界块预算保留。
这些限制约束 PRK 消息生产者，不宣称上游 Connection/daemon 变成了通用有界队列。

宿主逻辑帧与process帧预算独立：`remoteExtensions.frameChunk`双向拆分／重组已有16MiB逻辑帧，保持原宿主Unix socket和回调数据结构；每块按本代有效窗口与实际封套计算，逐块等待消费应答，不建立新请求队列。制品部署同样使用有效原始块预算，参见[宿主协议](../wire/plugin-config.md)。

文件消费者预算由 `PrkConfig.workspace` 提供：`fileReadBytes=524288`、`fileChunkBytes=262144`、`directoryEntries=1000`、`directoryBytes=262144`、`directoryPageEntries=32`、`fileRequestsMax=16`；`references` 提供 `maxBytes=262144`、`maxEntries=1000`、`listingBytes=262144`、`timeoutMs=10000`。唯一文件操作期限为 `targetConnection.requestTimeoutMs=10000`。`fileChunkBytes` 最大16711680（16MiB帧预留64KiB）；消费者仍按实际JSON字节、9字节帧头及payload校验单帧，不因预留而忽略长路径。
终端消费者使用 `workspace.terminalInputBytes=1048576`、`terminalStartTimeoutMs=10000`、`terminalCloseTimeoutMs=3000`；开关/协议不由这些数值派生。以上预算均拒绝未知字段，字节/数量为正safe整数，期限为1..2147483647毫秒。

kernel 的 `memoryMax`、`memorySwapMax` 与 `telemetryIntervalMs` 仍由全局配置及实例覆盖解析；运行中的 cell 和 cell 结束时采样，空闲时保留末样本。目标连接预算不替代 kernel 内存限制或遥测。


## 约定

- 连接表按显式实例 ID 共享，最多 16 条活动记录；每实例最多 64 个消费者，不按 hostname 合并身份。
- 同实例并发 acquire 共享一个 Connection、hello、UUID generation；每消费者 release 幂等。
- 一个消费者释放只减自己的租约；最后释放关闭原版 Connection，并等待自有 wrapper 控制 socket 结束，3 s 内未确认则报错。
- 项目控制 socket 位于短 mkdtemp 目录，仅用于 wrapper 的启动/退出诊断；不承载业务协议或远程状态权威，结束清目录。
- 观测失败先退休记录、abort 租约 signal、永久 close 旧 Connection；旧 Connection 的 command 回调也拒绝再次启动。
- `TargetEnvironmentLease.retire(reason: Error): Promise<void>` 将操作期限失败交回唯一连接所有者，立即使该代全部消费者失效并关闭其连接；绑定实际记录，迟到旧 lease 不会退休新记录，不新增重连或重放。
- 下一次明确 acquire 可以建新代次，观察订阅/监控 tick 不会调用新连接准入；不恢复旧 handle 或重放 unknown 请求。
- socket close 和 SDK close/aborted 不替代目标进程死亡证据；验收通过独立连接观察记录的 PID/PGID。
- daemon 被 SIGKILL 本身无法执行清理，不能与 transport EOF/SSH 断开混为一谈。D7 让现有每次启动的 Python launcher 保留为短命根、fork Node/Bun；根不加载插件，Linux 父死信号触发其停止已验证的本次 scope，或无 scope 时清本 PGID，覆盖 Pi 同步卡死。rootPid 与实际 Pi pid 分开；根清理时自杀不冒充 Pi OOM/退出码。
- 本次只实测 Linux x64、本机 /bin/sh 与 office /bin/bash；不外推 dash/busybox、跨 UID、macOS/Windows、静默黑洞或真实 sudo 密码失败。

## 可重复验收入口

设置 `PI_TEST_PYTHON` 后运行 `node tests/target-environment/check-connection.mjs local`、
`... shell`、`check-command.mjs`、`check-failures.mjs` 和 `check-disconnect.mjs local`。
office 模式另设置完整原始 `PI_TEST_SSH`，运行 `check-connection.mjs office` 与
`check-disconnect.mjs office`。fixture 只在自有临时 HOME/PRK_HOME/目标路径创建资源，
不读写实例配置或启动现有服务；认证用例的 fake-auth 是显式标记的受控环境变量程序，不是真实 sshpass/密码认证证据。

连接 harness 保留其原始证明范围；新增 `check-runtime-channel.mjs local` / `office` 走完整
process 目标 runtime、消费窗口和断链路径，不代替 S3/S4 或 scope 清理验收。

`node tests/target-environment/check-host-cleanup.mjs local` / `office` 使用独立 observer，覆盖 scoped/unscoped 的正常末租约关闭、wrapper 断链、独立自有 Gateway 子进程 SIGKILL；检查根、宿主、普通/nohup 后代以及 scope 内 setsid 后代退出，并以真实 SDK kernel 变量和另一宿主证明归属隔离。无 scope 仅保证本 PGID，不声称清理主动脱组进程。断链后的 Gateway 可能以真实 exit 1 报 kernel `UNAVAILABLE/details.closed=true`：它不能跨失效连接自证清理，与 observer 已证物理退出分别记录；正常关闭仍要求 exit 0。
