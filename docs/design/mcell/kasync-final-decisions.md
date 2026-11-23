# KASYNC 用户最终决定（2026-11-20 15:24）
- D1 = A：已保存的结果不丢，同一通知最多发一次；崩溃窗口报"执行结果未知"或"结果已保存，通知未确认"，不重跑、不重发唤醒。允许在所属 SDK 会话写 kernel-cell-open / kernel-cell-result 两种 custom entry。
- D2 = A：独立 model-only 工具 `kernel_interrupt {cell_id}`；`kernel_read` 永远只读。
- D3 = A：用户亲手停止后，取消终态照发 kernel-event、进历史和 Web，但不触发新轮；已到期未派发的提醒撤销。
- 提醒台阶默认 `kernel.reminderLadderMs = [60000, 300000, 900000, 1800000]`：即 1 分钟、5 分钟、15 分钟、30 分钟，之后每 30 分钟重复一次（末项即重复间隔）。不再用 design.md 里的 10s 首阶（会和 yield 撞车）。
- 其余全部按 design.md。
- S2 结算窗 = A（2026-11-20 15:51）：规则适用于这一类情况——任何在 Pi 结算窗（会话已报 idle、但上一轮尚未实际结算）里产生的 kernel 唤醒（checkpoint 和 finished 都算），PRK 先扣在自己手里，不交给 SDK；等上一轮实际结算后，复核 cell 身份和用户停止标记，逐条提交没被撤销的。用户停止后的终态只记历史、不唤醒。这个窗口里不保证到阶立刻提交。不改上游，不接管 Pi 队列。
