# 同进程多 cell：能取消受管操作，不能保证中断任意 Python

**建议不开放任意 cell 并发。** 如果接受“网络检查可重叠，任意 Python 仍独占”，选 **A 的受管子集**：只让有本地唤醒点、独占资源句柄和可判定写集的操作重叠。不按线程最后一次 syscall 猜资源归属，不给整个 kernel 发信号来取消一个 cell。

本文保留研究结论；完整原始记录未随仓库发布。公开的探针与记录见 [probes](probes/results.md)。

## 读表与复现

除特别标明外，数字均为 **CPython 3.12.13 / 3.9.25**，单位 ms，单机观测值而非延迟上限。拒绝连接、代码自然返回、外部清场、注入 API 返回 1 都不算目标成功取消。健康指同一原型接受下一次计算，不是当前 PRK 产品端到端验收。
Linux x86-64/glibc 2.44；独立 uv venv、解释器和库版本见 `packages-*.txt`。scope `MemoryMax=512M`；`AllowedCPUs=0` 单独设置不足，内层再 `taskset -c 0` 验证实际 CPU 集合 `{0}`（`environment.txt`）。每个试验 kernel 只有一个执行进程；外侧监督器/假服务器用于构造阻塞与回收，不是多进程执行方案。

## A：线程及实际退出条件

|本地场景|取消手段|是否停；耗时 3.12 / 3.9|兄弟 cell、健康、取消后残留|
|---|---|---|---|
|`time.sleep(600)` 原样|SetAsyncExc|否，均 >250|心跳继续，新 cell=42；目标线程仍等，直至原型退出|
|显式可唤醒 sleep|每 cell `Event.set`|是，0.039 / 0.030|兄弟正常，42；无残留|
|`subprocess.run(['sleep','600'])`、`os.system('sleep 600')` 原样|SetAsyncExc|均否，>250|兄弟正常，42；各剩一个 sleep 及等待线程；外部清场后才返回|
|受管启动同一条 sleep 命令|独立 PGID、杀组并由 owner wait|是，0.299 / 0.263|兄弟正常，42；直系子进程已回收，未测主动脱组后代|
|纯 Python `while True`|SetAsyncExc|是，0.061 / 0.051|兄弟正常，42；无残留。只说明该循环未吞异常|
|NumPy `3000² @ 3000²`、BLAS 单线程|SetAsyncExc|否，250 内未停；963 / 991 才观察到异常|兄弟正常，42；计算中线程仍在、占一核，返回 Python 后退出|
|原生 C 持 GIL 350ms（负对照）|独立 Python 协议线程读取消管道|发出后 300.04 / 307.48 才有机会处理，不能抢占|C 等待期间兄弟无心跳；返回后新 cell=43（`held_gil.jsonl`）|

`local_raw.jsonl` 含逐次 syscall、子 PID、fd 目标、心跳、时间戳与健康结果；`local_costs.tsv` 给出逐场景 CPU/RSS。原生 sleep 等待期 CPU 约 0.6%，Python 死循环约 99.6%，NumPy 约 99%，峰值 RSS 179.8 / 178.4 MiB。CPU 为原型进程 CPU 时间/墙钟，含控制和心跳；RSS 含解释器、数据与库，非每 cell 私有内存。

**A 网络：以下是 fd 操作使目标以 I/O 异常退出的实测，不代表能对任意共享 socket 安全操作。** 私有 namespace 对指定黑洞 IP 丢包；本地 DNS、TCP 与假 PG 均观测客户端确已进入目标阶段。单 cell 取消时另有心跳 cell；两版所有单样本心跳存活、新 cell 都成功；退出样本的原客户端 socket inode 从 fd 表消失。

|场景|SetAsyncExc|直接 syscall fd `shutdown`|`connect(AF_UNSPEC)`|poll/epoll 内 socket `shutdown`|
|---|---|---|---|---|
|TCP 黑洞 :22|未停 ≥650|0.15 / 0.06|0.09 / 0.09|—|
|requests HTTP 等响应|未停 ≥650|0.15 / 0.19|—|—|
|glibc DNS；requests 域名解析|均未停 ≥650|—|—|poll：均未停 ≥650；shutdown 返回 0，DNS 仍活，CPU 升高|
|dnspython|1701.14 / 1700.76，自身 epoll 超时后才交付异常|—|—|实际为 epoll，不是 poll/select；ENOTCONN 后重试新 socket，仍未停 ≥3200|
|SSL / requests HTTPS 握手|均未停 ≥650|SSL 0.16 / 0.13；HTTPS 0.66 / 0.34|—|—|
|libpq 黑洞 connect|未停 ≥650|—|3.65 / 3.24|0.07 / 0.07|
|libpq 已 accept 未认证；已认证且服务端收到 SELECT|均未停 ≥650|—|—|认证前 0.11 / 0.22；查询中 0.15 / 0.32；本地连接断开，不证明远端撤销|
|Paramiko :22 黑洞|未停 ≥650|1.42 / 0.09|0.09 / 0.11|—|

`—` 表示不在相应系统调用/状态，没对无关 fd 试操作；本机 glibc 未走 select，不能外推。poll 的首参是数组指针，epoll 还须取所等的目标 fd；libpq 的 AF_UNSPEC 补测另证实 socket 处于 SYN_SENT。失败样本在观察点仍有线程/socket，最终随夹具退出释放。
**20 cell（7 connect + 7 HTTP + 6 glibc DNS）**：两版 SetAsyncExc 均 **0/20**，逐一观察共 13s；fd 手段均 **14/20**，退出耗时 0.06–8.55 / 0.08–12.17ms，无其他独立目标同期误退出。余下 6 个 DNS 活着；进程总 fd 18 / 19、RSS 56764 / 53280 KiB，取消窗口消耗 CPU 3.928/3.944s 与 3.930/3.946s，几乎占满单核；新 cell 仍在 0.10 / 2.96ms 完成。
首轮短 DNS 窗有自然超时、3.9 首轮有监督器超时，均保留、未计入成功；上表采用长 DNS 窗。上述 20 个独立 socket 未误伤，不能推翻后述共享 socket 双 EOF 反例。

## B：调用者能退出，不一定是底层操作停止

**原样 B（`monkey.patch_all()`）全部 BLOCKED：项目禁止猴子补丁，隔离任务亦然。** B0 让 greenlet 跑原样库，B1 对有公开对应物的调用显式用 gevent API。下列是 B0/B1 的实测，不能用来填写原样 B 的延迟。私有 user/net/mount namespace 内构造黑洞与 DNS，只收不回。

|场景|B0|B1 取消→观察终态 ms（3.12 / 3.9）|误伤、健康与残留|
|---|---|---|---|
|黑洞 TCP :22|未停|绿 socket 0.484 / 0.589|兄弟正常；42；fd Δ0，解析池有空闲线程|
|HTTP 不响应；TLS 不握手|未停|显式绿 socket HTTP 0.594 / 0.778；绿 SSL 0.684 / 0.797|兄弟正常；42；fd Δ0。**不是 requests 成绩**；原样 requests HTTPS 未停|
|DNS 黑洞：getaddrinfo|未停|默认绿 resolver 1.733 / 0.691；显式 c-ares 0.486 / 0.635|均能再跑 42；前者留一个 DNS fd 和原生查询；后者 close 后 fd Δ0，但语义不同于系统 resolver|
|域名 requests；dnspython；Paramiko 黑洞|未停|原样库未停|兄弟冻结，健康未能执行，网络 fd 由整进程清场|
|psycopg2 黑洞 connect、accept 后不握手、认证后查询无回复|未停|原样库均未停|同上；假 PG 确实收到 SELECT，未用握手阻塞冒充查询|
|sleep；subprocess.run；os.system|未停|绿 sleep 0.526 / 0.707；绿 subprocess 1.073 / 1.024；os.system 未停|前二者兄弟正常、42，无遗留 sleep；os.system 留子进程至清场|
|Python 死循环；NumPy 1800² SVD；默认 asyncio.run|未停|均未停|hub 与兄弟冻结；外部 reader 能收消息不等于能运行 kill|
|20 cell：7 connect、7 HTTP、6 DNS|仅启动 1/20|20/20；中位 0.436 / 0.495，最大 2.023 / 1.985|未提前结束其他 cell；42；**两个版本都余 6 个 DNS fd，共 12 原生线程**|

「未停」的失败样本观察下界 1128 / 1129ms，之后看门狗清场不计成功。B1 20 cell 峰值 RSS 30112 / 27764 KiB，累计进程 CPU 0.084 / 0.108s（含初始化）。
真实 3.12 runner 单槽验证：第二 execute 得 BUSY，cancel 帧得 ack，当前 cell 并未因此退出；所属 PGID SIGINT 后才见 aborted，再执行 42 正常。3.9 runner 明确拒绝启动。绿线程上默认 asyncio loop 串行；换 GeventSelector 后，共用或另起 loop 的第二个嵌套 run_until_complete 均报 loop 已在运行；不能直接搬现有顶层 await。

## C：一个 asyncio loop 不能抢占同步代码

`c_loop.py` 是同调度模型的对照，不是运行上游 OMP。外部协议线程在 cell 进入后 50ms 投递取消：`await asyncio.sleep(600)` 于 0.130 / 0.107ms 收到 CancelledError；同步 `time.sleep(.35)` 令调度延后 300.05 / 300.36ms，兄弟 task 同时停顿，回调执行时目标已自然结束。两组下一 cell 都返回 42。

实际 [OMP POSIX runner（GitHub API 固定版本）](https://api.github.com/repos/can1357/oh-my-pi/contents/packages/coding-agent/src/eval/py/runner.py?ref=3967d6bcc63b5a12d7ea6b80f44fbda60fb4042f) **还按 rid 从 reader 向主线程发 SIGINT**，可中断当前同步目标，停放的目标用 Task.cancel；所以上述 300ms 是 loop 调度对照，不是 OMP 实际 SIGINT 延迟。同步兄弟不让出 loop 时，停放目标仍不能执行清理。它将 fd 输出归给最近启动者，不沿用。

## 能借鉴实现，不能直接借到「确定中断」契约

|实现|源码核对结果|
|---|---|
|[ipykernel 7.4 / JEP 91](https://jupyter.org/enhancement-proposals/91-kernel-subshells/kernel-subshells.html#behavior)|一个 subshell 一条真线程，共享 namespace；interrupt 是进程级，删除为 loop.stop + 无界 join，不是阻塞 worker 的退出证明。|
|xeus-python 0.19.1；akernel|前者配套 shell 的 asyncio.Lock 串行，message interrupt 只回执；后者等前 cell done，interrupt 遍历已排执行，没有目标线程阻塞 IO 的强停。|
|stopit；func_timeout；AnyIO.to_thread|前二者用 SetAsyncExc；func_timeout 先向调用方抛错，worker 可仍活；AnyIO abandon 明说线程继续。|
|python-interruptible-threads；psycogreen|前者靠 self-pipe、检查点与全局替换；后者用官方 psycopg2 wait callback 使特定 libpq 等待合作，不保证共享连接、COPY 或任意 C 扩展。|
|gevent|kill 需 hub 获得调度；默认 resolver 调原生线程池的 getaddrinfo；patch_all 也不替换 os.system。26.9.0 与 3.9 用的 26.7.0 分列，不能把依赖版本差异当 CPython 效应。|

## 评分：先过确定性门槛，再选可用范围

工程适用等级 0–3：0＝在现约束下不可接入；1＝只在合作让出时并行；2＝即使普通阻塞 IO 未返回，兄弟仍可推进，但取消须限制操作；3＝任意现有 cell 均可确定停且无误伤。**没有 3 分方案。**

|方案|分|决定取舍的证据|
|---|---:|---|
|A 真线程|2|无回包时兄弟仍有执行位；sleep、DNS 与持 GIL 反例排除通用强停。推荐只给显式受管操作并发资格。|
|B 原样 / B1 显式 gevent|0 / 1|原样触及项目禁区，0 是准入分而非实测失败率；显式合作 IO 快，但绿 caller 已停时 DNS 仍活，CPU 可冻住兄弟。|
|C asyncio|1|顶层 await 可重叠，同步 cell 占住唯一 loop。A+B 仍未消除 C 扩展和共享资源问题，不推荐叠加。|

## 推荐方案如何接现有协议（设计，不是仓库改动）

- **准入。** `src/kernel/kernel-state.ts` 的 `ctx.cell/execution/inflight` 与 runner 的 `ctx.command/cell_id/cancelled` 不再代表全局唯一 cell。一个按 `(generation,cellId)` 索引的活表，每项拥有执行、输出、requestId、回调、计时器及终态；在首个 await 前原子占位，满额回 BUSY，不增加队列。initialize/reset/clear/delete/library、一般 Python 与副作用未知的代码保持独占。有界 cell 数加总窗口、图/输出总预算，不能只设每 cell 上限。
- **协议。** 保留一个 stdin reader、一个串行写锁及不继承的协议 fd。`execute` 消费额度仍以本 id 的 `cell_end` 确认；控制帧/取消与回调回复应有预留额度，不能被多个未完成 execute 占满。按 generation/cellId/requestId 分发；重复取消共享同一结算，迟到回复丢弃。回调绑定原 SDK/分支，ask 只暂停本 cell 的钟。
- **取消。** 多执行位不走 `src/kernel/process/interrupt.ts` 的 PGID SIGINT。先标记 requested，锁内取本 cell 已登记的 Event/专属连接/子进程组，唤醒或终止，等执行退出、关闭/回收有证据后才 `aborted`。自然结束竞态记录真实结局；外部服务是否撤销另证。超期待停仍占位，展示阻塞阶段、最后已证资源与原因，禁新准入；重启整代列明受影响 cell；断链未收终态记 `unknown`，不重放。
- **提醒与落账。** 每 cell 独立 yield、checkpoint、ask、取消与结果冻结。沿用同分支一次 `kernel-cell-open`、一次 `kernel-cell-result` 后才尝试 finished；不批处理、不造第二条父结果。快照从 `activeCell` 变为按身份列举；Web 停止携所选 ID，休眠/换代门槛检查全部活项。当前 KER-5/协议只承诺单执行位，实施前须改契约。
- **输出。** runner 自有 `print` 入口按 cell 上下文路由（线程上下文或显式传播的 ContextVar），不是全局回写 `builtins.print`；无 owner 的子线程、库直写 `sys.stdout`、`os.write(1/2)`、C 与继承 fd 全送有界 kernel 公共流。管道延迟跨 cell 边界，即使读到时只剩一个 cell 也不猜。显式 display 带 cellId；matplotlib 全局收尾、全局 trace/变量/内存基线不得套用到重叠 cell，不能归属就独占或标进程级。
- **名字冲突。** 当前 identity/type 前后差异不足：两线程先赋值再 `globals()['x']=原对象`，最终 identity 不变，两次真实写均无法从快照归属；原地 list 修改不算重绑定（`shared.jsonl`）。提议对受管语法在准入锁内预留已知写名；第二次准入在执行前返回 `WRITE_CONFLICT{name,owner,rejected}`；成功完成时锁内提交，取消不发布。禁止并行动态写、删名、导入副作用、未知函数/可变对象别名；不能证明时明确 `EXCLUSIVE_REQUIRED`，不拿 AST 粗扫当完整 Python 证明。
  [CPython 字典 watcher](https://docs.python.org/3.12/c-api/dict.html#c.PyDict_AddWatcher) 从 3.12 才有，回调报告字典事件，不提供 cell 身份；不能充当 3.9 的冲突契约。
- **最小正例。** `managed.py` 的语法仅 `name = read_owned()`，共享 `seed`，每 cell 只等自己的 data/wake socket。撤 A 到清理完成 0.122 / 0.097ms，B 此后收到数据并提交 43；同名 C 被拒，动态写 D 要求独占，公共流没有伪 cellId，fd 净增 0（`managed.jsonl`）。这给出了可验收的语义，不等价于透明接管原样 requests、glibc 或 libpq。

## 风险与决策

- **fd 号、线程号不是资源所有权。** 查看 syscall 与实际操作不原子；fd 可关闭复用，dup 不隔离 socket 状态。实测两个线程读同一 socket 的不同 fd，对其中一个 shutdown 后两边都读到 EOF（0.143 / 0.114ms，`shared.jsonl`）。没有资源独占凭据就只作诊断，不能尝试破坏性唤醒。
- **取消不是撤销。** 自有资源也须区分「本地 cell 停止」「子进程已回收」「远端查询已停」；异步异常可被捕获、落在持锁/更新中或迟到。没有合作点的 C 段与持 GIL 段不承诺 Python 控制路径按时运行。探针短样本不构成实时 SLA。
- **版本门槛不同。** 当时的 runner 拒绝 <3.11，文件库依赖 `hashlib.file_digest`。3.9 成绩是机制对照，不是可部署结论。
- **清场证据。** 表中的残留均指取消后、夹具退出前；不能用最终清场来提升取消成功率。
