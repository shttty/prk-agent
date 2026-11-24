# 会话快照与读取错误

## Published shapes and identities

```ts
type PublicExecutionTarget = {
  id: string;       // immutable internal instance routing identity
  label: string;      // required unique user-facing instance name
  local: boolean;    // explicit Gateway-machine marker; false when omitted in config
  tags: string[];     // trimmed and deduplicated classification tags
  python?: string; // configured instance interpreter
  configurationIssue?: {code:"SSH_COMMAND_REQUIRED";message:string};
};

type KernelSnapshot = {
  state: "not_started" | "starting" | "idle" | "busy" |
         "unavailable" | "closing" | "closed" | "failed";
  kernelId?: string;
  connectionStatus?: string;
  lastOutcome?: "ok" | "error" | "aborted" | "unknown";
  memory?: KernelMemory; // shape: kernel.md, Memory and kernel actions
  namespace?: NamespaceSummary; // shape: kernel.md, Namespace and variable actions
};
type ManagedSessionSnapshot = {
  sessionId: string; // Pi SDK session identity and sole routing key
  target: string;    // explicitly selected configured instance
  configurationIssue?: {code:"SSH_COMMAND_REQUIRED";message:string};
  cwd: string;       // effective absolute execution directory
  model?: string;    // persisted effective model
  thinkingLevel?: string; // persisted effective thinking level
  label: string;      // display only; never a routing key
  projectId?: string; // optional project membership identity
  projectName?: string;
  projectCreated?: string; // project.json created timestamp, when available
  state: "idle" | "starting" | "running" | "sleeping" | "unavailable" | "closing" | "closed";
  history?: true;     // retained history is available; state may still be active
  kernel?: KernelSnapshot;
  recovery?: {        // execution recovery reason when state is "unavailable"
    status: "available" | "unavailable" | "new";
    message: string;
    code?: "TARGET_UNREACHABLE";
  };
  derivation?: DerivedSessionInfo;
  startedAt?: number;  // epoch ms the session started its current task
  finishedAt?: number; // epoch ms a child submitted its result (phase submitted/delivered)
};

type HostOperationSnapshot = {
  operationId: string;
  state: "accepted" | "running" | "cancel_requested";
  requestIds: string[];
};

type OperationCompletion = {
  operationId: string;
  status: "completed" | "failed" | "cancelled" | "unknown";
  requestIds: string[];
  error?: string;
};

type SessionHostSnapshot = {
  sessionId: string;
  streamId: string; // process/host incarnation, distinct from the persisted session identity
  model?: string;          // effective session model
  thinkingLevel?: string;  // effective session thinking level
  sequence: number;
  state: "idle" | "running" | "cancel_requested" | "sleeping" | "unavailable" | "closing" | "closed";
  operation?: HostOperationSnapshot;
  kernel?: KernelSnapshot;
  messages: PiSdkMessages;
  recentOperations: OperationCompletion[]; // last 64 outcomes
};

type WorkbenchSnapshot = {
  targets: PublicExecutionTarget[];
  sessions: ManagedSessionSnapshot[];
  archive: ArchiveGroup[]; // 见 sessions.md#archive
  unreadableSessions: SessionReadIssue[]; // 总是存在；健康时为空
  sessionControl: {rootSessionId:string|null;supervisors:Record<string,string>}; // 见 sessions.md#session-control-roles
};

type SessionReadIssue = {
  sessionId?: string; // 仅输出有效的原生身份；缺失时按文件定位，不合成 ID
  sessionFile: string;
  reason: string; // schema 错误包含 JSON pointer，例如 /phase
  location: "active" | "archived" | "unknown";
  label?: string;
  target?: string;
  archived?: {group:string;at:string;kernelOrphan?:boolean};
};

type CreatedSession = {
  session: ManagedSessionSnapshot;
  snapshot: SessionHostSnapshot;
};

type SessionHostEvent = {
  streamId: string;
  sequence: number;
  timestamp: string;
  type: "request_accepted" | "request_rejected" | "operation_started" |
        "operation_cancel_requested" | "operation_completed" | "message" |
        "session_event" | "reload_started" | "reload_completed" |
        "state_changed" | "host_closed"; // host_closed.details.failureCount > 0: cleanup unconfirmed
  sessionId: string;
  requestId?: string;
  operationId?: string;
  text?: string;
  details?: Record<string, unknown>;
};

type SessionLifecycleEvent = {
  type: string;
  sessionId: string;
  timestamp: string;
  details?: Record<string, unknown>;
};
```

`ManagedSessionSnapshot.sessionId` 是会话作用域请求唯一接受的身份。
`label` 是显示名称；project 字段是分组元数据。
主动快照请求及 `subscribe` 响应的 `messages` 是当前原生分支最近的有界网页页，与模型上下文无关（[WEB-7](../contract.md)）。每轮从一条用户消息起，到下一条用户消息前结束；第一轮之前的内容随最早一页返回。最多 50 轮，同时按投影后的 JSON UTF-8 字节数从新到旧装入完整轮次；预算默认 3 MiB，由 `limits.historyPageBytes` 配置，且不超过 Unix/HTTP 两侧输出上限较小者的一半。一轮装不下时返回 `TOO_LARGE`，`details` 带 `{entryId,bytes,budgetBytes}`。大工具内容见 [tool-content](tool-content.md)。

`historyPage {sessionId,before}` 返回 `messages` 和下方五个历史字段，不含 `before` 条目；游标不在当前分支或不是用户条目时返回 `NOT_FOUND`。`historyPage {sessionId,through}` 则返回截至该原生条目（含）的最新一页；锚点离开当前分支返回 `NOT_FOUND`，`through:null` 表示空分支。分隔线按 `firstKeptEntryId` 定位；`beforeEntryId` 是该位置起的第一条投影消息，无后续消息时为 `null`。仅分隔线或压缩条目落在本页时附摘要，在树导航后按 `compactionEntryIds` 清除已离开分支的分隔线。

补充 snapshot 字段：

```ts
type SessionPresentation = {
  historyThrough: string | null; // 快照所观察到的原生 leaf；纯历史页不重复返回
  messageEntryIds: string[]; // 与 messages 对齐的原生条目身份
  historyBefore: string | null; // 最早一轮的条目 ID；没有更早一页时为 null
  historyForkBefore: string | null; // 本页前最后一个可分叉的助手消息 ID
  compactions: {entryId:string;firstKeptEntryId:string;beforeEntryId:string|null;summary:string}[];
  compactionEntryIds: string[]; // 当前分支所有压缩条目的身份，不含页外摘要
  contextUsage?: {tokens:number;contextWindow:number;percent:number} | null;
  queuedMessages?: {steering:string[];followUp:string[]};
  requiresReload?: boolean;
  extensionUi?: unknown; // extension-ui.md
  toolMode?: "code" | "direct";                 // 有效工具档位（活动会话取运行时，否则取原生会话状态或宿主默认）
  delegation?: "gated" | "restrained" | "eager"; // 有效子会话档位，取值来源同上
};
```

`contextUsage:null` 表示 SDK estimate 不可用，不是零用量或账单。
快照里的 `model`、`thinkingLevel`、`toolMode`、`delegation` 是网页轻量设置的唯一来源：网页只读、只乐观写快照，native 目录 `target.current` 与工作台行的同名字段不再被网页读写（[WEB-54](../contract.md)）。

前端已支持、后端待实现的可选字段（不发送时网页什么都不显示，不出现占位）：
- `ManagedSessionSnapshot.startedAt` / `finishedAt`：子会话卡片与监控「子会话」列表显示已运行时长；交付后有 `finishedAt` 才显示总用时。

`recentOperations` 是进程内最近 64 个结果。
`sequence` 与休眠视图零序号的身份规则见 [ORD-9](../contract.md)、[ORD-10](../contract.md)、[ORD-11](../contract.md)、[ORD-14](../contract.md)。
`state_changed.details` 的执行状态变化包含 `{state,operation:HostOperationSnapshot|null}`；仅内核观测变化仍为 `{kernel}`，不替换执行状态。
额外 host event types：`snapshot`（`details.snapshot`）、`extension_ui`（`details.extensionUi`）；SDK `queue_update` 位于 `session_event.details.sdkType`。
`message` 是 SDK 流式增量，仅供展示，`message_end` 与快照里的消息为准（[REQ-12](../contract.md)）：正文增量 `{text}`；思考增量 `{text, details:{part:"thinking", contentIndex}}`，`contentIndex` 是该 assistant 消息内的块序号，同一消息内序号变化即新的思考块。其余流式更新为 `session_event.details` `{sdkType:"message_update", assistantEvent}`（SDK `assistantMessageEvent.type`，如 `toolcall_delta`），不带内容。自动重试为 `session_event.details` `{sdkType:"auto_retry_start", attempt, maxAttempts}`。
`snapshot` 由 Gateway 在每次 `operation_completed` 之后紧接着推送一次（同流、同 sequence），绑定换代、tree 完成与 reload 后也推（[ORD-23](../contract.md)）。`details.snapshot` 带 `sessionId/streamId/sequence/state/operation?`、当前显示及运行状态（包括 `recentOperations[].returnedMessages`）和 `historyThrough`，**没有** `messages/messageEntryIds/historyBefore/historyForkBefore/compactions/compactionEntryIds`。浏览器收到变更的锚点，主动读取 `historyPage`；`messageEntryIds` 和对应的持久消息一起返回。手动压缩沿用 operation 协议，活动快照及终态带 `kind:"compact"`；工作台的 `compacting:true` 随运行行与 `session_running` 事件发布。`message_end` 等单消息增量不传图片正文；输入图片随主动读取的历史页显示，工具图片通过 `toolContent` 拉取。Web 服务不代客户端取历史（[WEB-53](../contract.md)）。更新前打开的旧页面仍按旧快照格式读取；更新 Web 后硬刷新页面，加载使用新协议的 bundle。
`shutdown` 的 close acknowledgement 与后续 listener draining / endpoint removal 分属不同 completion boundary。

## 工具调用标题

开关：`session.toolTitle`（默认开，[配置](../configuration/session.md#session)，[HTTP](http.md)）。开着时 Gateway 在每次模型请求里给声明的每个工具参数 schema 加必填字符串 `title`（排第一；普通 object schema，或每个分支都是 object 的根 `anyOf`/`oneOf`）；说明是一句很短的现在进行时描述、用用户的语言、作为这次调用的标题显示。自带 `title` 参数的工具不加也不剥：`kernel_code` 由 kernel 插件把自己的 `title` 改成必填并换成同一段说明，去掉工具说明里的可选标题提示，提示词签名写成 `{code,title,...}`；其他自带 `title` 的工具（目前没有）保持原样。关掉只影响下一次请求，`kernel_code` 恢复可选 `title`，已记录的标题照常显示。

assistant 消息结束（SDK `message_end`）时，Gateway 把其余工具 toolcall 的 `arguments.title` 移到同一块的 `title: string`（去首尾空白，空串不写），`arguments` 里不再有它；Pi 参数校验、`tool_call` 钩子、工具执行、`tool_execution_*` 事件的 `args` 都看不到它。之后发布的 `message_end`、`messages`、`state`、history 页与 toolContent 预览里的 toolcall 块都带 `title`。客户端的工具行标题取块上的 `title`，`kernel_code` 取 `arguments.title`（它同时是 cell 标题与后台任务名）；都没有时沿用原有标题。

### 约定

标题只存在于 SDK 持久化的 toolcall 块或 `kernel_code` 自己的参数上，不另建存储；Web 不读取开关来隐藏已记录的标题。


## 无法读取的会话

规则：[WEB-29](../contract.md)、[WEB-30](../contract.md)、[WEB-31](../contract.md)。

`workbench`、`subscribeSessions` 及其他返回工作台快照的请求始终携带 `unreadableSessions`。`sessions` 与 `archive[].sessions` 只包含可读会话；不可读项保留文件定位、可用的原生身份和原因，不伪造正常会话快照。一个坏会话不会使其余会话列表变成 HTTP 503。

`location` 表示成功校验出的原位置：`active` 使用已有实例列表，`archived` 使用 `archived.group` 对应的归档列表；不能确认位置时为 `unknown`，网页单列「无法读取」分组。`label` 与 `target` 只是可用展示信息；身份损坏时省略 `sessionId`，文件名不得冒充原生身份或请求路由。

网页行使用 `data-status="unreadable"`，警告图标区别运行失败的红点。hover 或点击可查看原因；点击只打开原因视图，不进入聊天、读取历史或唤醒。健康会话保持可用，不再增加同一问题的顶部 banner。

历史、唤醒等可路由的定向操作以 `HOST_ERROR` 拒绝不可读会话；wire error 的 `message` 保留原因，`details.session` 是同型 `SessionReadIssue`，不把任意程序异常的内容透传为诊断。schema 诊断包含 JSON pointer（如 `/phase`、`/destroyDelegates`），不自动修复、兼容或重写旧字段；文件定位诊断不增加按文件操作会话的 API。

### 约定

Gateway warning 为一行，包含可用原生 ID、文件和原因；同一进程按原生 ID 去重，无原生 ID 时按文件去重。失败的会话记录不丢弃，也不加入第二套 SDK 权威状态。初始读取失败保留到重新加载历史，后续只读投影失败随再次投影刷新。

目录身份被替换等整体存储故障仍然拒绝请求。Pi 1.4.0 的公开发现若在返回条目前已经略过无法解析的文件或吞掉目录枚举错误，PRK 无法取得其身份与原因；此边界不另建扫描器、JSONL parser 或替代身份来补齐。
