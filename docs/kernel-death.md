# Kernel death and state loss

The Gateway owns each Python REPL through the target daemon's process handle.
Process exit or target connection loss invalidates that handle; neither observation nor
reconnection adopts a replacement process. See [kernel recovery](kernel-recovery.md)
and [the lifetime contract](contract.md).

## Outcomes and recovery

- A confirmed cell result retains its outcome even if the idle process later exits.
- Loss during submitted execution is an unknown outcome, not proof of rollback.
- No previous input or reverse callback is replayed. The next explicit input may create
  a fresh namespace using the instance's Python interpreter and saved session cwd.
- SIGINT interrupts execution without discarding an otherwise healthy namespace.
- Closing one session stops only its owned REPL resources; sibling sessions remain usable.
- Browser disconnection retains Gateway-owned execution. Gateway loss does not retain
  reusable process handles or namespaces.

There is no server-side polling cadence or automatic kernel replacement policy to configure.
`kernel.startTimeoutMs` bounds REPL startup; `targetConnection.startTimeoutMs` bounds
target-host startup, and `targetConnection.requestTimeoutMs` bounds file/probe operations.

## Testing

The [integration layer](kernel-recovery.md#test-environment) runs and interrupts a real Python cell, then verifies that its namespace still works.

## 约定

- REPL与目标宿主使用独立进程句柄，共享实例daemon连接；关闭单个进程不得误停共享连接。
- 作用域可用时使用实例内存/交换限额；不可用时记录明确回退，不伪造scope或内存快照。
- 当前内存快照必须含非空scope且oomKill为正，才能报告作用域内存耗尽。
- 作用域OOM计数不能证明受害者是REPL而不是其子进程。
