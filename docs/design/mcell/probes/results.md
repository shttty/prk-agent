# R2｜原样 CPython 停止阶梯（Linux x86_64）

CPU 0、512 MiB scope；数值为单次探针观测，不是延迟上限。列顺序均为 **3.9.25 / 3.12.13**。读取 syscall 和操作返回成功都不算 cell 已停。

|socket 场景|目标 syscall|3.9 / 3.12 ms：shutdown(D) 前至观测 TID 消失|对端证据|
|---|---|---:|---|
|阻塞 recv|recvfrom|1.22 / 1.21|EOF|
|黑洞 connect|connect|1.23 / 1.23|私有 namespace DROP，SYN_SENT|
|requests HTTP 无响应|recvfrom|1.35 / 1.34|收到 GET，后 EOF|
|原版 SSL；requests HTTPS 握手|read|1.30 / 1.31；1.92 / 1.96|收到 ClientHello，后 EOF|
|Paramiko 黑洞 connect|connect|1.25 / 1.24|DROP，SYN_SENT|
|libpq 黑洞；静默启动；已认证后静默查询|poll|9.71 / 10.34；1.79 / 2.13；1.35 / 1.34|分别见 SYN_SENT、StartupMessage 后 EOF、SELECT 后 EOF|
|Paramiko 已连接等 banner|futex|未 shutdown|注入后约 50ms 目标返回，之后观察 100ms 对端仍未关闭；不能报资源已排空|

每版 10 个阶梯样本和 10 个单次注入对照。九种可定位等待两版均经 dup/复核后 shutdown；对应仅注入对照在 650ms 时目标均仍活。两种 libpq 建连试验先报 OperationalError，退出期间再收 KeyboardInterrupt，Python outcome 未成功记录，按独立 native TID/对端证据计。实测覆盖 poll，不把它当 select 的测量。`bash net_replay.sh /path/to/python /path/to/scenarios ladder` 需要 Python 3.9 或 3.12；最后一个参数也可用 `async`。场景目录须含 `a_net_endpoints.py` 与 `a_net_scenarios.py`，两者未随仓库发布，不能仅凭 checkout 重放。探针与原始记录见同目录 `net*`，日志中的本机路径已替换为占位符。

下表是 R2 探针的原始动作与结果（当时未对独立组发信号，也把跨线程创建视为拒绝）；本次验收规则以 [21:27 后的设计 §4](../design.md) 为准，不把当时的策略当产品限制。

|子进程场景|3.9 ms|3.12 ms|观测与裁决|
|---|---:|---:|---|
|`Popen.wait()`，继承 PGID|0.822|0.747|只对验证过的直接子进程发 pidfd SIGKILL；本表时间从发信号前到 worker 结束，包含 wait 清理|
|`subprocess.run()`，无 capture|0.720|0.691|默认与兄弟同组，未给组发信号；兄弟仍活|
|`Popen.wait()`，独立 session|0.830|0.675|仍只操作已验证的 PID，不凭 PGID 推断树|
|`communicate()`，两个子进程持同一 stdout 写端|拒绝|拒绝|回收首个 writer 后仍 poll；最后写端关闭至 HUP 0.007 / 0.044ms，此时主子进程仍活并继续等 stderr|
|`wait4(0)` / 跨创建线程等待 / 已回收 PID|拒绝|拒绝|不发信号；创建线程退出后实见 child 重新列到主线程，children 不是永久来源记录|

[原始子进程 3.9](child_3.9.jsonl)、[3.12](child_3.12.jsonl)、[探针](child_ladder.py) 和 [夹具](child_fixture.py)。两版均核对子进程已被回收、只余主线程。

**FD 复用：** [探针](fd_lifetime.py) / [双版本原始记录](fd_lifetime.jsonl)。目标已阻塞 recv 后用另一自有 socket 替换 N；三种情况均观察到两次 syscall 字段未变，替换连接仍可双向收发。
1. 首次 fstat 后、dup 前换号：`fstat(N)==fstat(D)` 成立，但不等于首次身份，两版均拒绝。
2. dup 后、复核前换号：N 与 D 身份不同，两版均拒绝。
3. 复核后换号：只 shutdown 旧 D；原阻塞 recv 收 EOF，新 N 不受影响。此前若已在首次 fstat 前换号，快照无原子证明；共享旧连接仍会被关闭。

**forkserver：** [探针](fork_gate.py) / [原始记录](fork_gate.jsonl)。干净 exec、BLAS=1、预导入 NumPy，两版实际 `Threads=1` 才 fork，pickle 输入计算返回 42；定向 killpg 至 wait 确认 0.547 / 0.499ms；显式创建后台线程后各因 `Threads=2` 拒绝下一次 fork。
**定时等待：** 采用当时任务提供的 `sleep-syscall-probe.py`（未随仓库发布）实测：3.9 pselect6 零 fd（相对时间上界），3.12 单调 clock_nanosleep ABSTIME（可算剩余），sleep 返回后才抛挂起异常；不是在注入时唤醒。
