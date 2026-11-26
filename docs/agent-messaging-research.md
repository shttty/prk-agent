# Agent 间通信调查：OMP hub、Prime Agent 与本项目第一版

日期：2026-09-28
状态：2026-09-28 的调查与候选验证记录；当时为未提交、未做真实模型验收的第一版。“建议”保留当时讨论口径。当前项目规则以 [接口与生命周期约定](contract.md) 为准。

## 结论

- 当前项目的同伴投递、回执和 turn 边界：[模块约定](wire/sessions.md#约定)；回复刹车：[模块约定](wire/sessions.md#约定)；inbox 限额与取消丢弃：[模块约定](wire/sessions.md#约定)。
- 原生 Pi 的队列读取位置见下方当时 SDK 源码调查；它不是实时全双工，消息不会插入正在生成的单次模型响应或正在执行的工具调用。
- 本项目不以同伴消息默认中止接收方正在执行的工作；当前调用路径和边界见 [模块约定](wire/sessions.md#约定)。
- Prime Agent 的核心投递语义和我们一样：都是 steer，都要等到一轮之间才能被读到。它确实多了跨进程转发、唤醒已保存会话、关系范围限制和限流；但它的文档把投递模式写得比代码更强。
- OMP hub 的消息总线只在单个进程内工作。它值得借鉴的是“消息怎样按接收方状态进入执行循环”，不是把它当成分布式消息系统。

## 调查对象与版本

| 对象 | 版本 / 位置 | 方式 |
|---|---|---|
| Pi SDK | `@earendil-works/pi-coding-agent` / `pi-agent-core` 0.85.1（本项目 `node_modules`） | 读安装产物源码 |
| OMP | 上游 main `465093c9ec6e6cd9d19af02140333b2a409e3546`（包版本 18.4.1）；本机安装 18.3.2 | 读上游源码，未做运行时互发 |
| Prime Agent | `~/tmp/prime-agent`，提交 `f585916`（2026-09-14）；其 coding-agent 是 Pi 分叉，包版本 0.9.4 | 读源码，未运行 |
| 本项目 | `main` `b47fb57` 加未提交改动 | 实现，并用受控模型跑了测试 |

## Pi 底层：消息什么时候能被看到

`pi-agent-core/dist/agent-loop.js` 的 `runLoop` 只在三个位置读取 steering 队列：

- 开始运行时（第 83 行）；
- 准备下一轮之后，而且只在还没有待处理消息时读取（第 107 行）；
- 每轮 `turn_end` 之后，也就是模型输出和整批工具调用都结束之后（第 158 行）。

读到的消息会作为新消息，放在下一次模型响应之前。`executeToolCalls`（第 285 行起）内部不读 steering，所以**同一批里剩下的工具调用不会被跳过**。

这批工作都做完后，再处理 followUp 队列（第 161 行）。

`pi-coding-agent/dist/core/agent-session.js` 的 `_runAgentPrompt`（第 772 行）在 `agent.prompt()` 返回后，会检查 `agent.hasQueuedMessages()`；如果还有排队消息，就调用 `continue()` 接着跑（第 787–811 行）。

`sendCustomMessage`（第 1099 行）有这几种路径：

- 正在运行，且没有传 `triggerTurn: false`：默认进入 steer 队列；传 `deliverAs: "followUp"` 时进入 followUp 队列；
- 空闲，且 `triggerTurn: true`：直接开始一轮新的执行；
- 其他情况只追加消息，不唤醒模型。

**这决定了所有基于 Pi 的实现上限：接收方只会在执行空档里看到消息。** OMP 和 Prime 都在这层之上运行，同样绕不过去。

## OMP hub

`hub` 工具合并了三组能力：同伴通信（`send/inbox/list/wait`）、后台任务、长期进程管理。三者底层是不同子系统。

**通信部分：**

- `IrcBus`（`packages/coding-agent/src/irc/bus.ts`）是**进程级单例**。每个 agent 有一个内存 mailbox，上限为 `MAILBOX_CAP = 100`（第 25 行）。
- 注册表是平的：`AgentRegistry.listVisibleTo`（`agent-registry.ts` 第 335 行）返回除自己和 advisor 外，所有处于 running 或 idle 状态的 agent。同伴之间可以直接联系。
- `#deliver`（`bus.ts` 第 97 行）按接收方状态处理：
  - 找不到接收方、已被硬终止，或者是 advisor：直接失败；
  - `parked`：先由 `AgentLifecycleManager.ensureLive` 从会话文件恢复；
  - 接收方正在 `wait`：消息直接交给等待中的工具调用；
  - 其他情况：调用 `session.deliverIrcMessage`。
  
  只有实时交接抛出异常时，消息才会暂存进 mailbox，同时返回 failed。
- 接收端 `IrcBridge.deliver`（`session/irc-bridge.ts`）会继续区分：
  - 正在运行，发送方是接收方的父 agent：走 `agent.steer`；
  - 正在运行，发送方是普通同伴：进入中断队列，在执行循环的接收点注入为 `irc:incoming` 自定义消息；
  - 空闲，且处于 plan mode：只追加消息，不唤醒；
  - 其他空闲情况：唤醒一轮。空闲子 agent 被唤醒后，这一轮的输出会转回给发送方。
- `send` 立即返回回执：`injected`、`woken`、`revived` 或 `failed`。回执只说明消息怎么交出去，**不代表对方已经处理**。`await: true` 只是语法糖，表示等待对方的下一条消息，默认超时 120 秒。
- agent 之间的消息会以只显示的卡片形式出现在 main 界面。

**不要混淆：** 进程管理有一个跨 OMP 实例共享的 broker，位于 `~/.omp/run/daemons/`；消息总线没有这种跨实例能力。

## Prime Agent

**入口：** agent 在 Python kernel 里调用 `agent_message.send`，再通过 `host_request("agent_message.send")` 交给 daemon；人可以用 CLI `prime-agent send <agent> <message>`。

**路由：** `sendAgentSessionMessage`（`modes/daemon/daemon-mode.ts` 第 6224 行）依次尝试：

- 解析已经在当前进程内的目标；
- 从会话记录恢复不在内存里的会话（`getOrHydrateBoundSessionState`）；
- 恢复被动 RLM 子 agent（`hydratePassiveRlmSubagent`）；
- 目标不在当前 worker 进程时，经 supervisor 转发（`sendRemoteAgentSessionMessage`）。

**这是跨进程通信，本项目目前没有。**

**限制：**

- 只能联系父级、同级和直接子级（`core/agent-messages.ts` 第 30 行，`assertAgentFamilyReach`）；
- 单条消息最多 16384 字符；每对“发送方 → 接收方”使用令牌桶，容量 3，每秒补 1；每个会话最多 20 条待处理消息（第 18–21 行）；
- 可以整体暂停通信；
- 可以向同一关系范围内的成员群发 `"all"`。

**投递：** `acceptAgentSessionMessage`（`daemon-mode.ts` 第 6359 行）调用 `session.acceptAgentMessagePrompt(..., { streamingBehavior: "steer", queueIfBusy: true, customMessage })`。

- 消息作为自定义类型 `agent_message` 进入会话，开头是 `[agent-message from <relationship>:<name>]`。
- 准入前会确认目标会话没有更换，也没有关闭。
- `acceptAgentMessagePrompt` 是 Prime 在自己分叉的 AgentSession 里加的方法（`core/agent-session.ts` 第 5264 行）。上游 Pi 0.85.1 没有这个方法。

**回执：** 只有 `delivered` 和 `queued`，而且 `deliveryMode` 固定为 `"steer"`（`agent-messages.ts` 第 445–460 行）。

**文档与代码不一致：**

- `docs/long-running-agents.md` 写着有 `auto / steer / follow_up` 三种投递方式，示例还传了 `mode="auto"`。
- 源码把 mode 标成“兼容旧版，接收后忽略”（`agent-messages.ts` 第 23–24 行）。
- Python 的 `send(message, broadcast_message=None, *, receiver_role=None, receiver_name=None)` 根本没有 `mode` 参数，照文档示例调用会抛 `TypeError`。
- 它自己的 `skills/agent-message/SKILL.md` 反而写得准确：消息始终走 steering。

## 本项目第一版

本节保留 2026-09 第一版的形状与验收证据；当前五工具、投递模式、结果与控制权以 [会话协议](wire/sessions.md#session-tools-and-inbox-delivery) 为准。

第一版工具形状为 `agent_list {}` 与 `agent_send {to,message,replyTo?,expectReply?}`；当前协议及身份字段以会话协议为准。

当前规则：[模块约定](wire/sessions.md#约定)。消息长度由 `session.maxMessageChars` 控制，默认 16384；inbox 数量／字符上限与回复记忆窗口见 [配置参考](configuration.md#session)。

当前实现入口为 `src/sessions/peer-messaging/assemble-peer-messaging.ts`；Gateway 绑定在 `src/gateway/peer-messages/open-peer-messages.ts`，接收方 inbox 与 `admit` 分别在 `src/sessions/host/inbox/receive-peer.ts`、`src/sessions/host/input/admit-input.ts`，`turn_end` 接入点在 `src/sessions/runtime/conversation/bind-session-hooks.ts`。原 2026-09-28 调查记录的是当时 Gateway 第 802 行、SessionHost 第 341 行，不是当前源码坐标。

第一版接收方输入是带来源 envelope 的用户消息，忙碌积压以 `[agent-messages]` 合并。当前使用 `[session-messages]`，格式与解析分别位于 `shared/session-messages/format-peer-messages.ts`、`parse-peer-messages.ts`；Web 同伴卡片与 Gateway 共用解析器，不改变 SDK 投递语义。原第一版的普通用户气泡是当时呈现；2026-09-29 补充记录见下方。

**已验证（2026-09-28）：**

- 已运行 `tsc --noEmit`，通过；
- 当时的同伴消息集成用例退出码为 0。环境是真实 Pi SDK 执行循环、真实 Jupyter fixture kernel，以及受控 faux provider。

测试确认了这些行为：

- `agent_list` 列出其他会话，不包括调用方自己。
- A 正在执行一个 2 秒的 Python 调用时，B 发来的问题返回 `queued`，并被并入 A 当前的操作。
- 问题出现在 Python 工具结果之后，Python 调用没有被中止。
- 消息头里的发送方身份正确。
- A 用 `agent_send` 回答；空闲的 B 被唤醒，回执为 `delivered`，并在自己的会话里处理答案。
- main 给空闲 worker 补充要求后，worker 被唤醒并处理。
- 发给不存在的 ID 或自己时，工具明确报错。

**受控 provider 只证明消息链路和执行循环的行为，不证明真实模型会正确使用这两个工具。**

## 2026-09-28 候选对比

| | 本项目第一版（历史候选，非当前合同） | OMP hub | Prime Agent |
|---|---|---|---|
| 忙碌时投递 | steer，一轮之间读取 | 普通同伴进入中断队列；父发子走 steer | steer |
| 空闲时投递 | 唤醒一轮 | 唤醒一轮；plan mode 只追加 | 唤醒一轮 |
| 能否实时插入正在生成的内容 | 否 | 否 | 否 |
| 可联系范围 | 同一 Gateway 内所有会话 | 同一进程内所有 agent | 父级、同级、直接子级 |
| 跨进程 | 否，所有会话在同一个 Gateway 进程 | 否 | 是，经 daemon 或 supervisor |
| 唤醒已停止或已保存的会话 | 否，返回错误 | 是，恢复 parked | 是，从会话记录恢复 |
| 回执含义 | 已唤醒 / 正在排队 | 已注入 / 已唤醒 / 已恢复 / 失败 | 已送达 / 正在排队 |
| “已读”或真正被处理的通知 | 无 | 无 | 本次未查到 |
| 限流和待处理上限 | 仅限制消息长度 | mailbox 上限 100 | 长度、频率和待处理数量 |
| 群发 | 无（按设计只发明确接收者） | 有 | 在关系范围内有 |
| 消息在会话里的形式 | 带消息头的用户消息 | `irc:incoming` 自定义消息 | `agent_message` 自定义消息 |
| 是否改动底座 | 否，只用公开 API | OMP 自有实现 | 是，在 Pi 分叉里增加方法 |

## 第一版未验证项与已知缺口（历史记录）

- **两边同时互发没有单独测过。** 按实现看，两个方向相互独立，应当可行。
- **当时没有“已读”。** 当前回执边界见 [模块约定](wire/sessions.md#约定)。
- **当时不能唤醒不在运行的会话。** 当前休眠接收方的路径见 [模块约定](wire/sessions.md#约定)；closed / closing / unavailable 不在可联系列表内。
- **单 Gateway 范围。** 当前 `agent_list` 来自同一个 Gateway 的 managed sessions；调查没有跨 Gateway 或跨机器转发实现。
- **网页没有同伴消息卡片。**（2026-09-29：已补，见 PLAN.md 同日一节。）
- **模型只能按 UUID 指定接收方。** 名称可以从 `agent_list` 读取。
- **第一版没有来回互发的硬性刹车。** 2026-09-29 真实模型实测后加了 `expectReply`；当前有界进程内关联规则见 [模块约定](wire/sessions.md#约定)。Prime 的短时间限流仍不足以排除慢速互发。
- **原调查推断的窄时间窗口没有复现证据。** 该推断针对旧 `steer` 路径；当前接收方 inbox／`turn_end`／SDK admission 入口见 [模块约定](wire/sessions.md#约定)，此处不把旧推断升格成已确认故障。

## 当时可讨论的下一步（历史提案）

1. **“已读”回执。** Pi 注入排队消息时，会通过公开事件发出 `message_start` 和 `message_end`，可以借此回告发送方。难点是怎样把事件对应到原消息：现在的消息是纯文本，只能按消息头里的 ID 匹配。项目约束不允许根据文本推测上游状态。另一条路是改用带 `details` 的自定义消息，但这需要 SessionHost 支持相应的提交方式。**需要先决定对应方式。**
2. **网页同伴消息卡片。** 在前端识别消息头，并把它显示成 `A → B` 卡片。这只影响显示，不改变投递。
3. **唤醒不在运行的会话。** 这依赖休眠与恢复的实现。目前相关工作在候选目录里，还没进入 main。
4. **用真实模型跑一次双 worker 对话。** 检验模型是否真的会按工具说明回复、带上 `replyTo`，以及不陷入来回互发。
