# MCELL 实施切片｜基线 99845685

规格以 [design.md](design.md) 为准；[open.md](open.md) 的推荐已计入规格。每行独立派给一个 agent，以一至两小时内完成一个可观察行为为界；编号是拓扑序，依赖列给直接前置。中间片进同一候选分支，不部署半套 wire/仅一端的行为。`sol` = `clp/gpt-6.2-sol`；`Opus` = `clp/claude-opus-5-5`。现有目录下未存在的对象/测试标为“新增”，不是要求另建框架。

## 一、共享执行路径（先用受控 runner 验证 Gateway）

|片|目标与改动落点|一个聚焦验收（从调用者观察）|依赖|模型 / effort|
|---|---|---|---|---|
|01 策略|`src/config/kernel/{kernel-options,parse-global-kernel-options,parse-kernel-options}.ts`、`src/kernel/kernel-options.ts`、实例 validator。全局 `defaultCellMode` 枚举 thread/async/isolated，默认 thread；模型 mode 选填、枚举严格，废弃布尔参数不设别名；预占位时快照默认值|一个表驱动用例：三种全局值与缺省/三个显式值组合；显式值原样透传，省略不提前补 mode（给 runner 判 CO_COROUTINE）；实例覆写/旧布尔字段被拒，4/10000/auto、timer 上限和预载配置仍有效|—|sol / high|
|02 消费窗口|`src/target-environment/process-window/`、`src/kernel/protocol/send.ts`；同一窗口区分准入和已接受的控制，保留条数及字节，不另开传输、不提前 confirm execute|新增窗口单例：两大 execute 使第三次提交 BUSY，而 cancel 和一块 callback reply 仍可送并获 ack；cancel 不使原 execute 的额度复活|01|sol / high|
|03 活表与准入|`src/kernel/{kernel-state,kernel-types,assemble-kernel}.ts`、`cell/{execute,run,read-cell,preview-cell}.ts`、`lifecycle/{ensure,maintain}.ts`。预占、单次启动、逐项冻结释放；`protocol/receive.ts` 按 id 分配 cell_end/rejected|扩 `tests/kernel/check-cell-wait-policy.mjs`：冷启动多个提交只 initialize 一次；4 项 yield 后第 5 项 BUSY；完成 B 并冻结才可补一项，A 仍可读|01,02|sol / high|
|04 帧路由|`src/kernel/protocol/{event-schema,receive}.ts`、`callback/{answer,record-callback}.ts`、`output/`、`telemetry/`：typed ready 的语言版本、cell_state、无主 diagnostic；分隔两项的回调块、图片、权限、错误，落实总图预算|扩 `tests/kernel/check-admission-callbacks.mjs`：两项交错 chunk、图片和 ask，拒一项/迟答不伤另一项；无身份 bytes 只有诊断里有|03|sol / high|
|05 时钟与快照|`cell/{set-budget,publish-finished}.ts`、`telemetry/`、快照类型与 `src/gateway/session-hosts/subscription/`。activeCells 按身份替换单值；发布每项 mode、deadline、ask 状态、blockedAt 和 taskName|在 `check-cell-wait-policy.mjs` 加一组假钟：A ask，B 到 1/5/15/30 分钟及末阶重复；A 恢复时从原余量继续，B 结束不清空 A 的投影|03,04|sol / high|
|06 落账与结算窗|`src/plugins/kernel/{bind-cell-events,cell-event-types}.ts`、`src/sessions/history/kernel-cells/`、`kernel/cell/publish-finished.ts`；每项 open/result，复用每轮一个 settlement fence，逐项撤未发提醒|扩 `tests/kernel/check-yielded-sdk-cell.mjs`：同一结算窗暂扣 A/B；用户停 A，A finished 仅记历史、B 唤醒一次；从同一分支读两结果，去掉一 open 对应的 result 时只该项为 unknown|05|sol / high|
|07 主动退休与丢失分流|`kernel/process/{stop,retire,start}.ts`、`lifecycle/{prepare-handoff,replace,close}.ts`；fence → 已发未终清单 → 目标 scope/PGID 清理和退出证据 → 逐项结算，单次释放 lease。保证意外断链走原 unknown 路径|扩 `tests/kernel/check-lifecycle.mjs`：同一组 A/B/C，C 已 cell_end 未冻；受命 stop 后 A/B 均 aborted+同一清单、C 原结果；对照 lease 丢失无退出凭据，未终项 unknown|03,06|sol / high|
|08 策略和忙代 reset|`kernel/process/{interrupt,interrupt-cell}.ts`、`kernel/lifecycle/{restart,replace}.ts`、`kernel/cell/execute.ts`、`plugins/kernel/register-cell-tools.ts`。Gateway 计时、never 诊断、now/reset 优先、权限撤销；thread 超期引发退休时在发起项冻结结果加 `suggestedMode:isolated` 及模型正文提示|扩 `tests/kernel/check-multicell-escalation.mjs`：never 到期不换代，thread auto 超期只退休该代一次；前台/read/finished 都可见适用建议，连带项及显式 reset 不带该建议|04,07|sol / high|
|09 会话级停止/交接|`src/sessions/host/operations/{interrupt-cell,request-cancel}.ts`、`src/gateway/session-hosts/input/`、`src/http/session-routes/{cancel-operation,interrupt-kernel}.ts`、`src/gateway/session-lifecycle/`。cellOnly 精确停止，交接/休眠查全表和 receipt，用户引发退休抑制全清单唤醒|扩 `check-yielded-sdk-cell.mjs` 的宿主用例：按 A 的 ask 停止只关 A；若超期退休，A/B 原父行各有结果且均无新轮；普通未升级时 B 的 ask/唤醒保留|06,08|sol / high|

## 二、Python：线程执行和资源归属

|片|目标与改动落点|一个聚焦验收|依赖|模型 / effort|
|---|---|---|---|---|
|10 thread 与编译选路|`src/kernel/runner/{assemble-runner.py,protocol/read_input.py,cell/evaluate.py,cell/execute.py}`。先整段编译看模块 CO_COROUTINE，再作末表达式拆分；显式 mode ＞ 顶层 await 自动 async ＞ 全局默认；`cell_admitted` 回实际模式。显式 thread 在 worker 私有 loop 执行顶层 await|双版本 `check-execution.mjs` 模式矩阵：顶层赋值/末表达式 await 自动 async，字符串/嵌套 async def 不误选，默认 isolated 的普通 return 可用；显式 thread + await 不进入共享 loop|01,03,04|sol / high|
|11 Python 输出与 prelude|`runner/output/{capture,display}.py`、`runner/protocol/{emit,callback,receive_reply}.py`、`codemode/kernel-prelude/{assemble-prelude.py,bridge,operation-trace,namespace,memory-telemetry}`。上下文分离，raw fd 诊断，跨 cell figure 不全局扫关|新增 `tests/kernel/check-thread-owned-output.mjs`：真实 A/B 交替 print/显式 display/回调，raw fd 单写一行；原工具行无串流、诊断只收该行，B 完成不关闭 A 的 figure|04,10|sol / high|
|11a 常驻 async loop|`kernel/runner/{assemble-runner.py,cell,protocol}`：一代一个专用线程/loop、每 async cell 一项 Task；ContextVar 输出/回调；单项结束保留用户连接，代关才关 loop|新增双版本 `check-shared-loop-cells.mjs`：A 创建 pending Future/等待锁并存入 globals，B 在同一 loop 完成它；显式 thread 的私有 loop 不同，async cell 可以跨前一项 cell_end 复用对象|10,11|sol / high|
|12a 注入与 syscall 观测|`kernel/runner/{cell,protocol}/`：登记/撤销 TID 身份，限用户执行区注入一次，安全读取 x86_64 `/proc/self/task/TID/syscall` 和长度有界的参数块；逐步 `blockedAt`|双版本同一用例：线程循环在注入后真实退出；另一个在 C 中返回 1 但未退仍为 stopping，重复请求不打到新线程|08,10,11|sol / high|
|12b 定时例外|`runner/cell/` 解码 timespec/timeval/poll；`kernel/process/interrupt*.ts` 根据确认的剩余时长与上限设置一次 Gateway 截止|一个真实短 sleep + 可控时钟用例：3.9 上界、3.12 绝对截止；N 先到不误杀同伴；吞异常逾期/超上限不续时，never 保位、now 直退|12a|sol / high|
|13a socket|`runner/cell/` 从直接 syscall 或 poll/select 单一候选取首次身份、dup、二次 syscall/集合/fstat，唯在固定的 D 上 shutdown/close，留诊断|一个 socketpair 生命周期用例：分三处替换 N，见 `probes/fd_lifetime.py`；读出批准/拒绝，替换连接均完整；共享旧连接时允许 EOF 连带|12a|sol / high|
|13b 子进程|`runner/cell/` 以已取消 worker 当前的正 PID wait4/等价 waitid 或读管道等待选目标，不按创建线程。管道须在 runner 子进程范围核实唯一写者及无歧义集合；pidfd 固定并复核同一等待，只对独立组长且不在 kernel 组的目标停组，否则停单进程；确认真实回收。不 hook subprocess，不扫描全机，不接外部 PID/PGID；不确定则沿原宽限|双版本原样 run/wait/communicate、独立组与非组：核验仅停等待目标或所在独立组并真实回收；共享使用者可受影响，无关兄弟和 runner 存活；管道/集合歧义、任意/组等待及不属于本次等待的项不发信号|13a|sol / high|
|13b2 async 定向停止|`kernel/runner/cell/`、`runner/protocol/read_input.py`、`kernel/process/interrupt*.ts`。按 task 投递 cancel，按 resume 段登记/撤销 loop 的执行者；仅当目标正占线程时复用停止阶梯。暴露阻塞者 ID，跨段动作失效|一个双版本三项场景：停在 await 的 A 可独立取消；若 B 同步阻塞 loop，取消 A 不注入 B；显式停 B 后阶梯令 B 退出，接着 C 正常；切换 resume 段的迟到操作不得打到 C，超期只退休本代|11a,12b,13a,13b|sol / high|
|13c forkserver|`kernel/process/{bootstrap.py,start.ts}`、`kernel/runner/` 新增独立 exec 的 forkserver。代内预导入、BLAS 单线程环境、每 fork 紧邻 Threads 检查、子进程私有组握手、父代关闭/reap；不从主 runner fork|一个真实 forkserver 用例：预导入后第一次 Threads=1 能生子，随后受控加载启动后台线程，第二次 fork 被拒且与原 thread cell 可用性无关|01,07,10|sol / high|
|13d isolated 数据路径|`kernel/declaration/`、`cell/{execute,read-cell}.ts`、runner 的本机 IPC/执行；同一活表、inputs 序列化成功才启动，支持 return、结果读与可选 outputs，pickle 不出目标机|同一混合路径：用 inputs 求值并 return，read 读结果且可选绑定；异步输出名只成功提交一次；传不能 pickle 的值即报错，既不 fork 也不 yield|03,04,13c|sol / high|
|13e isolated 停止|`kernel/process/{interrupt,retire,stop}.ts` 和 forkserver 控制入口；以 generation/cellId 调已确认 PGID 的 killpg，排空、wait、settle 接入既有事件；握手前取消绝不放行用户代码|一个实进程场景：thread + 两 isolated 占三位，外部停其中一个在 C 等待的子组，wait/EOF 后仅该项 aborted；另一子组和主变量保留，后续位可用|06,08,13d|sol / high|

## 三、Bun：准备与执行分离

|片|目标与改动落点|一个聚焦验收|依赖|模型 / effort|
|---|---|---|---|---|
|14 Bun 启动载荷|`src/kernel/process/{start.ts,bootstrap.py}`、`src/kernel/` 下新增 `bun-runner/`、复用目标制品/部署入口。内存 bundle、scope 内 exec、CLOEXEC 控制 fd，ready/EOF/diagnostic；不共用插件宿主|扩 `tests/kernel/check-stdin-isolation.mjs` 的 Bun 行：通过真实 openProcess/自有目标 fixture 收 ready；用户与继承 stdin 的子进程均 EOF，fd1 日志不进 JSONL，关闭后已退|04,07|sol / high|
|15 JS/TS REPL|新增 `kernel/bun-runner/` 的执行、输出、display/回调动作；`src/codemode/kernel-protocol/` 用同一 schema。每项 async 函数、持久 globalThis、词法 console、原函数 finally 和真实 cell_end|新增 `tests/kernel/check-bun-cells.mjs`：TS cell 在 await 前导出对象，JS cell 改它再唤醒；两边结果、console、显式图和 gateway 分块回复各回原 ID|14|sol / high|
|16 Bun 网络和等待|`bun-runner/` 新增 cell 持有的定时器、socket、fetch body、Resolver；共用逐项取消和 drain 入口，不钩原生 DNS、定时器或 Bun.$|新增 `tests/kernel/check-bun-owned-waits.mjs`：两个 cell 同时连本地不回应 fixture；按 ID 取消 timer/TCP/fetch/双私有 DNS 的参数化样本，验 close/EOF/ECANCELLED，兄弟继续；默认 lookup 的未完成 inner 不能发 aborted|08,15|sol / high|
|17 Bun 进程|`bun-runner/` 新增 spawn/pipe 收集、退出与登记；接整代清理；区别直接的 Bun.$、spawnSync 与专属 spawn|新增 `tests/kernel/check-bun-process-stop.mjs`：A、B 各起 sleep，取消只回收 A 并等 EOF；改为原生同步阻塞则由**外部**宽限退休，B 的结局列清单|07,16|sol / high|
|18 锁定 npm 包|`src/config/execution-target/`、`gateway/wire/instance-parameters/`、实例现有维护/制品发布路径、`kernel/process/`、`bun-runner/` 的 import。加入 registry/锁定包集和显式维护入口；新代只读已发布版本|新增 `tests/kernel/check-bun-maintenance-packages.mjs`：自有内网 registry fixture 准备并发布 lock，关 registry 后新代可 import；缺平台工件不发布、旧代仍用原集、运行时源请求数为零|14,15|sol / high|

## 四、对外入口与浏览器（不增加第二条任务流）

|片|目标与改动落点|一个聚焦验收|依赖|模型 / effort|
|---|---|---|---|---|
|19 会话语言与工具描述|`src/sessions/{runtime/kernel,session-settings,history,tool-declarations,native-interaction}`、`src/plugins/kernel/{create-kernel-tool-definition,register-cell-tools,prompt}`、`src/kernel/declaration/`。Python 声明 mode/inputs/outputs、三种适用场景、顶层 await 自动选路和共享 socket／子进程影响；Bun 只声明自己的接口|扩 `tests/kernel/check-session-kernel-language.mjs`：三种 mode 进入同一会话准入路径，inputs/outputs 只在实际 isolated 时合法；空闲切 Bun 后不暴露 Python 字段，旧分支结果仍可读|09,13b2,13e,17,18|sol / high|
|20 Web 消费者|`web/workbench/store/{session-stream,messages}`、`web/chat/transcript/tool-calls/kernel-cell/`、`web/chat/background-tasks/`、ask/监控停止入口。共用 activeCells；展开显示 mode、分步 blockedAt、timer 剩余上界和操作，停止精确到行|扩 `tests/web/check-background-tasks.mjs`：thread A 等 sleep、isolated B 在跑，展开分别显示模式/等待阶段，按 B 停不误关 A，重连无重复行；用 data-id/status/count 判|05,09,19|Opus / high|
|21 Web 会话语言|`web/management/` 会话详情、`web/workbench/store/` 的 native action；语言选择提示变量丢失，忙时不可切，提交以服务器答复为准，不在顶部/斜杠菜单加入口|新增 Web 会话详情聚焦用例：A 在跑时禁切；空闲确认后切 Bun，重开详情仍是 Bun，旧结果行仍是 Python、活动时工具说明为 Bun|19|Opus / high|

**交接规则。** 每片读 `AGENTS.md`、`docs/contract.md`；前端再读项目 Web skill。接口片同改对应 contract 条款、wire 与配置文档；不保留 `activeCell` 或旧 ready 的双写兼容。一个聚焦测试可对多个版本/状态参数化；实现中只跑本行相关测试，不反复跑整层。测试必须用明确的自有 `PRK_HOME`、短 TMPDIR、可回收目标 fixture；不碰 daily、真实 home 或公网包源。交付候选时一次 `check:unit`，跨进程/HTTP/SSE/浏览器一次 `check:quick`，按最终 diff 选 integration（含真实 3.9、Bun、浏览器），核对被替换断言覆盖；不跑 `check:full`。