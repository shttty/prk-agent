# Bun 多 cell：能中断哪些等待，能否保住同伴？

**建议加 Bun，但不承诺「同一 JS 堆内任意 cell 都可确定中断」。** 黑洞 TCP、无响应 HTTP、私有 DNS Resolver 和登记的 timer 可以收回；放弃普通 Promise 只结束等待者。连 `finally` 对 `globalThis` 的写入都可能晚于取消回执。任意 JS + 共享对象身份 + 强制单 cell 抢占，这三个要求不能据此同时交付。

本文保留研究结论；原始数据与夹具未随仓库发布。

## 实测：回执、用户代码、系统资源是三件事

Bun 1.4.4，Linux x86_64，每个探针 CPU 0、512 MiB user scope。网络在私有 user/mount/net namespace：将指定 IP 路由到 lo，仅丢 `10.255.255.1:22` 的 SYN；DNS 仅 bind-mount 测试用 resolv.conf（1s/2 attempts）和 `hosts: files dns`；UDP 只收不发，HTTP 只读请求不回字节。没有探测外部 SSH。
`外/内` = runner 收到 cancel 起至外层 race 结算 / 原 cell 函数实际结算，单位 ms，不含 Gateway 往返；未观察到结算保留下界。fd 为 REPL 的 `/proc/PID/fd`，顺序为空闲→阻塞→取消后约 0.2s。CPU 是阻塞期进程 CPU 时间/墙钟（含同伴）；RSS 是阻塞时的进程值，非每 cell 增量。单例为一次观测，不是 SLA。

|场景|取消外 / 内 ms|其他 cell|fd、socket、进程或晚到执行|RSS MiB / 单核 CPU %|
|---|---:|---|---|---:|
|`net.connect` 黑洞，`socket.destroy(error)`|0.751 / 0.972|心跳继续|6→7→6；SYN-SENT 消失|43.62 / 0.33|
|`dns.lookup`（IPv4）|0.121 / 1417|心跳继续|6→7→7；继续重发，最终 EAI_AGAIN，fd 回 6、finally 写入|44.34 / 0.33|
|默认 `dns.promises.resolve`|0.121 / >12000|心跳继续|6→7→7；12s 后 UDP 仍在，已有 4 次查询|43.76 / 0.34|
|每 cell 一个 `dns.promises.Resolver`，取消该实例|0.165 / 0.309|心跳继续|6→7→6；真实 ECANCELLED；勿取消共享 resolver|43.86 / 0.28|
|静默 HTTP，`fetch({signal,keepalive:false})`|0.124 / 0.318|心跳继续|6→9→8；对端读到关闭，剩余两个是 epoll/eventfd，不是连接|44.16 / 0.29|
|`Bun.spawn(['sleep','600'],{signal})`|0.099 / 1.209（3 次中位）|兄弟 sleep、心跳继续|fd 取消前 10→取消后 7；直属退出回调 1.211ms，pipes EOF|45.65 / 0.49|
|同上只放弃等待，不杀|0.026 / >200|兄弟正常|10→10，sleep 存活；外部回收后 7|46.73 / 0.35|
|原生 ``Bun.$`sleep 600` ``|0.032 / >200（4 次中位）|兄弟正常|12→12，sleep 存活；ShellPromise 没有公开 kill/abort/pid；实际清理后才结束，fd 回 7|47.48 / 0.45|
|`setTimeout(600000)`，clear **并 reject 等待者**|0.161 / 0.172|心跳继续|6→6→6；不靠 fd 数判断 timer 已清|43.41 / 0.32|
|原生 `await Bun.sleep(600000)`|0.111 / 退休时仍 pending|心跳继续|6→6→6；没有可清的 timer handle。1100ms 同型对照：回执后 516.5ms 实际续跑并写共享变量|43.25 / 0.31|
|50 个同时 pending，逐 ID 取消|外 p50 0.011、p95 0.123、max 0.733；整批 11.96|未取消数 49→24→0；10ms 心跳最大间隔 15.80ms|6→36→11；13 SYN、12 HTTP 都收回；12s 后仍有 13 个内层等待、2 个 DNS fd|46.62 / 0.33|

子进程行的 fd 从取消前起算，CPU 取取消观测窗。18 组均未误杀兄弟，但直属 shell 退出不代表后代或其输出管道已退出；自有 PGID 可清同组，`setsid` 后代仍活。忽略 TERM 的直属进程补发 KILL 后 inner 1.317ms 才结算。受管接口要等 `exited` 和 stdout/stderr EOF，有界升级/整代清理；普通 `$` 不提供同等保证。

50 个 cell 分别为 connect/lookup/resolve/fetch = 13/13/12/12。JS pending 不等于各有一条 OS socket；默认 resolve 共用通道，lookup 还会排队。[Bun DNS 文档](https://bun.com/docs/runtime/networking/dns) 区分 Linux 上 `node:dns.lookup` 的系统解析线程池与 `resolve*` 的 c-ares；“网络 IO 不占线程”不是通用前提。
延长观察的独立复测中，单次默认 resolve 自行 ETIMEOUT 于取消后 11394ms；混合批中最后一个 lookup 于 13413ms 得 EAI_AGAIN，最后一个 resolve 于 15403ms 得 ETIMEOUT；最终 50 个 finally 全执行，剩 8 fd、无 Bun 网络 socket。**11.96ms 是首批回执，不是全批停止。**
双私有 Resolver 对照：先取消 A，80ms 后 A=ECANCELLED、B 仍 pending；再取消 B，两个查询 fd 全回收（8→6）。这项接口可提供定向取消，但不能冒充遵循 NSS 的 `lookup`。探针分别记录 race 与真实完成，前者不能当成生产 `cell_end`。
另测 TS cell → JS cell：`const n: number = await Promise.resolve(41)` 导出到 `globalThis` 后，下一 cell 读到 42（`n+1`）。

**同步恢复边界。** 同一事件循环里连 cancel reader 和 Abort 定时器也会被同步代码饿死。`vm` 的 100ms timeout 只能覆盖调用当下的 JS：`await Bun.sleep(20)` 后再进入 `while(true)`，VM 已返回 pending Promise，死循环仍要外部退休。Worker 可保主线程心跳，但看不到主线程的 `globalThis` 哨兵；`terminate()` 对同步子进程等待不是有完成保证的抢占。普通进程 SIGINT 不能定向到 cell；退休需确认 scope（含子孙）退出，仅杀父 PID 不够。

|同步场景（各 3 次）|实际中断或恢复时间|其他 cell / 残留|峰值 RSS MiB / 进程树 CPU %|
|---|---|---|---:|
|直接 `while(true){}`|发 cancel 后又等 420–466ms 仍无终态，外部杀 REPL|peer echo 停，fd 8→8→0，namespace 丢失|48.16–48.57 / 41.1–92.8|
|直接 `Bun.spawnSync` / `execSync`|同观察窗内 cancel 不执行，外部退休|peer 停；均 8→13→0；杀父后 sleep 仍活，须另杀并 waitpid|43.14–43.27 / 0；43.63–44.01 / 0–1.5|
|`vm timeout:100` + 同步 JS 死循环|100.258–100.285ms 抛错并保留原堆|peer 停顿 118–122ms；fd 回 8|48.70–49.09 / 9.2–16.7|
|同一 vm + `spawnSync` / `execSync`|外部杀 sleep 后，调用总计 619–685ms 才抛 timeout|救援前 peer 停；fd 8→13→10，留下运行时 epoll/eventfd|46.64–47.25 / 1.5–3.1|
|上述同步 API **自带** 100ms timeout|102.561–114.179ms，sleep 已回收|保堆，peer 仍停顿 106–131ms；不是事后定向抢占|46.21–47.21 / 1.4–3.1|
|Worker 中纯 JS 循环|terminate→close 2.037–4.351ms；线程退出|主线程继续，fd 回 8；不共享普通变量|50.95–51.45 / 9.2–18.1|
|Worker 中两种同步子进程|terminate 后再等 441–466ms 仍活，外杀 sleep 后才 close|主线程继续，fd 8→15→8|48.71–49.58 / 3.3–4.6|

控制器发出 cancel 不等于冻结的 runner 收到它。该表 CPU 含 sleep，不含外部控制器，CPU0 非独占。

## yaegi 对照：context 返回后，阻塞的 Dial 仍能建连

Go 1.27.4、yaegi v0.16.3、`GOMAXPROCS=1`。3 次解释态 `for {}`：cancel→`EvalWithContext` 返回 0.0051–0.0068ms；19.67–28.24ms 才进入退出 defer，之后同解释器均算出 42。3 次真实黑洞 `net.Dial`：API 在 0.0055–0.0058ms 返回，2.08–2.14s 后仍见阻塞栈、fd、SYN-SENT，随进程退出回收。
决定性反例：解除本地对端 backlog 堵塞后，在 cancel 后 **1693.68ms** 对端实际接受连接，两端 ESTAB，后续解释语句 `c.Close()` 未执行。解释器能在解释步骤间停下，但不会自动给标准库 Dial 注入 context；受管连接应走 `DialContext` 并登记已连 socket。宿主 ticker 继续，不代表同一 Interpreter 的并行 Eval 可独立取消。峰值 RSS 26548–28904 KiB；取消前循环 CPU 21.3–59.9%、黑洞 0–3.7%。

## 设计提纲（建议，不是已实现的 PRK 功能）

**语言归会话，固定到当前 kernel 的整个生命周期。** 实例只声明可用 runtime/绝对路径及资源上限；会话保存 `language: python|bun`；每代 `kernelId` 只对应一种语言。切换只能空闲时显式重启、提示变量丢失；旧分支结果仍按原 ID/语言读。实例固定太粗，具名多 kernel 默认常驻会叠加内存，也让模型猜 namespace。先不引入第二个活进程。
沿用 `kernel_code {code,title?,reset?,yield_s?}`、`kernel_read`、`kernel_interrupt`，**不让每条 code 切语言**。工具 label、description、promptSnippet 和 `<kernel>` 声明明确当前 Python 或 Bun JS/TS、持久变量写法及中断边界；比两套可误选的执行工具清楚。原型用 AsyncFunction 测 JS 顶层 await；`let/const` 只在该函数内，跨 cell 显式 `globalThis.x`。TS 用 Bun Transpiler 去类型，不承诺类型检查或 ipynb 式任意声明持久化。

|接缝|沿用及必须改变的语义|
|---|---|
|启动与传输|保留 `openProcess`、有界 bootstrap、独立非继承控制 fd、唯一 reader/串行 writer、执行 fd0=EOF。`ready` 的 strict schema 现在要求 `python:int[]`，改语言+版本+cancel 能力，仍报真实 PID/PGID/scoped。原型 stdin/stdout JSONL 仅是测量接口，不是生产协议。|
|准入与命令|保留 generation/cellId/id/re、execute、维护命令与 typed `rejected`。同代 `Map<cellId,KernelCell>` 同步占位，串行 initialize；Bun 建议 `maxActiveCells=4` 可配，Python=1。已满、换代、维护中立即 transient BUSY，不排队；clear/delete/reset/library 安装须整代空闲；yield/read 不放位。结果冻结/取消排水期间仍占位。|
|窗口|沿用块大小、累计字节、实际消费才 ack、取消不退款；execute 到 cell_end 才确认。现默认 32 requests/2MiB、1MiB 单帧，50-cell 原型不是现有 wire 的容量证明。为 cancel/回调回复保留额度，额度不足提前 BUSY；不可让执行帧占满窗口后再等待 cancel。普通 BUSY 只结算所属提交，不走现在的全代 retire。|
|`gateway.*` 与 ask|逐 cell 持有原 SDK context/signal；`await gateway.foo(args)` 经 `callback_chunk`/`callback_reply_chunk`、`(generation,cellId,requestId)` 回配；保留 capability 4KiB、structuredContent 优先（含 null/false/0）、失败 throw，不猜 JSON。每 cell 同时仅一个请求或明确 BUSY，不静默吞 Promise.all；不同 cell 可交错。ask 对话框带 cell 身份，只暂停本 cell active 时钟，不停 yield，不阻塞同伴；迟答不续钟。|
|输出与图片|保持 stream/display/image/error/omitted 形状及每 cell 图预算（8 张/20 MiB），Gateway 转 BMP、缩图、ImageContent、按张读；另设 kernel 合计预算。词法绑定 console 与开管道时捕获 owner；只在该 cell 的 stream 上排水，输出限额不停止排水。两个并发 cell 实测交叉读取共享变量，stdout/stderr 各得 `a/A` 与 `b/B`，无串行假象。原始 fd1/2、库内部 global console、inherit/C 输出没有 cell 身份：只入有界 kernel 诊断，绝不猜“当前 cell”。不猴补运行时。|
|取消与 `cell_end`|定向 typed cancel→撤本 cell 权限/ask→触发 controller、关闭登记 handle、等待用户函数、socket close、child exited 和 pipe drain→仅一次 cell_end。`requested` 不是 aborted；不能证明已停不放位、不报 aborted。普通可见 stop 不向整个 PGID 发 SIGINT；超期由 Gateway（不能依赖同一 JS loop 的 timer）限时退休整代，未确认者 unknown、提示同伴受损；失联不证明进程已死。不重放/预启动。|
|内存与 namespace|保留 cgroup current/workingSet/baseline/extra/OOM、私有 display MIME、`prk_memory_cell_end:true`，按 cell 结尾取整代样本，无 scope 不捏造；并发不能归因给 cell。共享变量只列用户显式导出名/安全描述符，不访问 getter；交错快照不是该 cell 的独占 diff，不宣称能归因或回滚。|
|yield 与落账|复用 `cell.done` 与 yield 竞速、ask 暂停、台阶、冻结、规范化图片、原分支 open/result/通知历史确认、读取、撤回唤醒等四片逻辑；每 cell 单独拥有一次结算和 timer，不再持有全局 execution。`snapshot.kernel.activeCell`/后台浮条改 `activeCells[]`；按 session/kernel/cell/toolCall 关联，停止只作用于选中的身份，不因普通 SDK abort 扫全表。交接、休眠、重启要查所有在途及落账。|

**最小 prelude。** `gateway.call/describe` 与属性代理、按调用校验权限、`tool_bin` 固定 SHA/offset 分块和目标 hash 缓存、显式 `display`、有界输出、`cell` 的定时器/连接/解析/fetch/spawn。目标内本地数据可用原生 Bun.file/Bun.write；产品标成 PRK 的 read/write/edit 必须复用本 cell 的真实文件钩子/开关、结果上限与目标本地读写，不将整文件拉回 Gateway，不用原生 IO 冒充受管工具。没有等价钩子的能力先不声明。Python inspect/catalog、`prk_tools` 源码、IPython 魔法、matplotlib 自动收图、pip/wheel、不带 owner 的 shell helper 都不移植。
**实现落点。** `src/kernel/process/{start,interrupt,retire}.ts` 分语言装配；`kernel-state.ts:80–101` 与 `cell/{execute,run,read-cell}.ts` 的 `inflight/admission/execution/cell` 从单槽改为进程级闸门+逐 ID 持有。`protocol/receive.ts:39–53` 与 `callback/answer.ts:75–82` 按代和表项路由；`set-budget`/`publish-finished` 用原对象，SDK `executionMode:sequential` 与 yield 后并发并不矛盾，不必让所有工具同时提交。协议基线见仓库 `docs/wire/kernel.md:8–44,69–87,99–110`、`docs/contract.md:72–93`；实施须同步调整 KER-5，保留 KER-2/4/8/9/11/19。
**离线包与导入基址。** 纯 JS runner 经 `bun build --target=bun --format=esm` 成一个 bundle，复用实例下发的 Bun；bundle 随有界 bootstrap 进内存执行，不把 runner 源码写到目标（KER-19）。npm 用户包独立放目标项目的 `node_modules` 或锁定包集目录；registry 是实例配置，准备期生成项目 `bunfig.toml` 的 `[install] registry` / `[install.scopes]`，token 只从安装环境注入，私有 CA 用 cafile。目标缓存键含 lock、registry 映射、Bun 版本、OS/arch/libc；显式维护时准备、校验、原子发布，运行用 `--no-install`，不回退公网。`AsyncFunction` 的 import 基址不是 cwd；提供 `cell.import(spec)` 用 `Bun.resolveSync(spec,目标项目目录)` 再导入，未支持的静态 import 明确报错。
包实测：纯 JS 搬走单个 1054B bundle 可运行；native CRC32 还要 551432B `.node`。暖缓存 `--offline --frozen-lockfile` 成功、冷缓存失败，离线阶段 registry 零请求。x64 缓存装 arm64 即使退出 0 也会漏 optional native 包；应按目标构建完整闭包、执行真实导入，不以 exit 0 验收。


## 风险与范围

- 托管 API 不是 JS 沙箱。用户能 catch abort、在 finally 继续、启动未登记 Promise 或把 handle 存入共享变量；封住后续 PRK 输出/回调也撤不回磁盘、网络和全局写入。禁止靠正则扫描或全局猴补承诺确定中断。
- 一核上心跳不断只证明这些 IO 样本没有饿死同伴；忙循环、同步 native、GC、图片解码、回调争用另论。50 个空等 cell 不代表 50 路图像/大结果的 512MiB 容量。
