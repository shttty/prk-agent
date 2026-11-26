# Independent Web workbench HTTP/SSE

规则：[GEN-1](../contract.md)、[WEB-4](../contract.md)、[GEN-7](../contract.md)、[模块约定](native.md#约定)、[LIFE-1](../contract.md)。
Backend 只发布 `/api` JSON / SSE、工作区二进制传输与 terminal WebSocket。
UI 属于独立 `web/` npm package；同源 Vite proxy 的运行方式见 [design notes](../design-notes.md#运行与验收证据)。
`API_ROOT` 为 same-origin `/api`。

## Independent Web workbench

| Route | Body / query | Gateway method / result |
| --- | --- | --- |
| `GET /api/workbench` | none | `workbench` |
| `GET /api/models` | none | `modelCatalog` |
| `POST /api/session-control/root` | exactly `{sessionId}`; no query | `setSessionRoot` |
| `POST /api/session-control/supervisor` | exactly `{sessionId}`; no query | `setProjectSupervisor` |
| `GET /api/ui` | none | `{extensionUiRenderIntervalMs,gatewayRestartUnit}`（Web-local config；`gatewayRestartUnit` 为 `null` 表示未配置） |
| `GET /api/settings/kernel-execution` | none | `kernelExecutionGet` → `{asyncExecution:boolean}` |
| `POST /api/settings/kernel-execution` | exactly `{asyncExecution:boolean}`; no query | `kernelExecutionSet` → `{asyncExecution:boolean}` |
| `GET /api/settings/tool-title` | none | `toolTitleGet` → `{enabled:boolean}` |
| `POST /api/settings/tool-title` | exactly `{enabled:boolean}`; no query | `toolTitleSet` → `{enabled:boolean}` |
| `GET /api/settings/soul` | none | `soulGet` → `SoulView` |
| `POST /api/settings/soul` | exactly `{content:string,revision:string}`; no query | `soulSave` → `SoulView`; `CONFLICT` (409) when the file changed since `revision`, `INVALID_REQUEST` when unconfigured or over `limits.contextFileBytes` |
| `POST /api/gateway/restart` | `{}` | 不转发 Gateway；Web 进程执行 `systemctl --user restart -- <gateway.systemdUnit>`，见下 |
| `GET /api/sessions/events` | none | `subscribeSessions`；SSE 工作台集合事件 |
| `POST /api/sessions` | `{target,cwd?,label?,project?:{id,name}|{name}}`；未归类省略 project | `createSession` |
| `GET /api/sessions/:sessionId` | none | `state` |
| `GET /api/sessions/:sessionId/history` | none; no query | `history` |
| `GET /api/sessions/:sessionId/history-page` | exactly `?before=ENTRY_ID` or `?through=ENTRY_ID` (`?through=` for empty) | `historyPage`；只读，含归档 |
| `GET /api/sessions/:sessionId/native` | none; no query | `nativeCapabilities` |
| `POST /api/sessions/:sessionId/native` | `{requestId,action,args?}` | `nativeAction` |
| `GET /api/sessions/:sessionId/tool-content` | `?toolCallId=ID` | `toolContent` |
| `POST /api/sessions/:sessionId/recover` | `{mode:"auto"}` / `{mode:"new",target,cwd?}` | `recoverSession` |
| `POST /api/sessions/:sessionId/rename` | `{label}` | `renameSession` |
| `POST /api/sessions/:sessionId/archive` | `{confirm:true}` | `archiveSession` |
| `GET /api/sessions/:sessionId/archive-preview` | none | `archivePreview` |
| `POST /api/projects/:projectId/archive` | `{confirm:true}` | `archiveProject`；部分失败仍为 200，结果含 `error` 与已／未归档清单 |
| `GET /api/projects/:projectId/archive-preview` | none | `archiveProjectPreview` |
| `POST /api/projects/:projectId/rename` | `{name}` | `renameProject` |
| `POST /api/archive/:group/unarchive` | `{}` | `unarchive` |
| `POST /api/archive/:group/purge` | `{confirm:true}` | `purgeArchive` |
| `GET /api/sessions/:sessionId/events` | none | `subscribe`；SSE `snapshot` / `host` |
| `POST /api/sessions/:sessionId/send` | `{requestId,message,queue?,mode?,attachments?,references?}` | `send` |
| `PATCH /api/sessions/:sessionId/project` | `{project:{id,name}|null}` | `assignProject` |
| `POST /api/sessions/:sessionId/cancel` | `{operationId,cell?:{kernelId,cellId}}` | `cancel`；省略 `cell` 只停当前匹配轮次，不代选后台项 |
| `POST /api/sessions/:sessionId/kernel/interrupt` | `{kernelId,cellId,cellOnly?}` | [`kernelInterrupt`](sessions.md#methods)；浮条与 ask 用 `cellOnly:true`，省略可附带停止原生轮并返回排队输入；不唤醒休眠会话 |
| `GET /api/sessions/:sessionId/kernel/result` | query `cellId`, optional `imageIndex` | `kernelResult`；只读、不唤醒 |
| `POST /api/sessions/:sessionId/manage` | `{action:"transfer",owner}` / `{action:"upgrade"}` | `manageSession` |

Browser selection fragment：`/#sessionId=SESSION_ID`。
路由中的 `sessionId` 是 Pi 原生会话身份，不提供额外视图 selector。
未声明或重复 query 参数与未知 body 字段返回 400。

`kernel-execution` 由 Gateway 读写；POST 使用同源校验，只有 `kernel.asyncExecution` 的配置值可变。原子保存后下次 cell 准入和模型请求生效；不重载或唤醒会话。

`tool-title` 由 Gateway 读写；POST 使用同源校验并原子保存 `session.toolTitle`，下次模型请求生效，不重载或唤醒会话。

两个 SSE（`/api/sessions/events`、`/api/sessions/:sessionId/events`）的首帧是 `snapshot`，客户端以它为唯一底稿，不先 GET `workbench` 或会话快照。单会话首帧是主动 `subscribe` 响应的转发；后续的轻量 `snapshot` 作为普通 SSE `host` 事件转发，历史由浏览器按锚点主动读取（[WEB-49](../contract.md)）。Gateway 在首帧前拒绝订阅时，响应仍为 200 `text/event-stream`，只发一个 `event: error`，data 为 JSON 错误形状 `{error,code?,details?}`（与 JSON 路由相同，`code` 如 `NOT_FOUND`、`BUSY`），随即结束流（[WEB-50](../contract.md)）；客户端收到后关闭 EventSource，不自动重连。

工作台 SSE 的 `collection` 事件以 `sessionId` 和类型更新非选中会话的行状态：`session_starting` → `starting`、`session_running` → `running`、`session_idle`／`session_awake` → `idle`、`session_sleeping` → `sleeping`、`session_closed` → `closed`。这些事件不携带完整会话行或消息，客户端不另开该会话的 SSE，也不重取工作台（[WEB-51](../contract.md)）。

所选及非选中行均通过 `session_attention_changed` 更新关注状态：`details:{blocked:boolean,asking:boolean,stopped:boolean,retryPending:boolean}`。首帧会话快照和工作台行省略为假的标记。`blocked` 表示[等待用户操作](extension-ui.md#waiting-for-user-input)，不改变执行 `state`。模型轮次失败时，`retryPending` 表示可重试的错误正在等待重试宽限；宽限结束仍未恢复即换成 `stopped`。不可重试错误直接 `stopped`，取消及已知继续不进入 `stopped`；下次接受用户输入或 SDK 开始运行清除。宽限只改变展示，不延迟完成应答或拦截新输入。

`session_idle.details.completed:true` 只标识一次正常完成的运行。浏览器为非当前会话显示「有新结果」，选中后清除；未读只在本页面保存，不随页面刷新恢复。侧栏按等待操作、出错停止、运行（含宽限）、有新结果、空闲或休眠排序显示关注状态；折叠父行和分组保留最高的提示。

列表行为 closed 的会话只读一次 `GET /api/sessions/:sessionId/history`：其 `session` 是该会话当前的行，仍 closed 则显示只读历史、不订阅；已被其他观察端恢复则用这一行更新列表并改为订阅，不再先 GET 整份 `workbench` 确认状态。

`POST /api/sessions` 的 `CreatedSession` 就是新会话的列表行与底稿：网页用它选中新会话后只开该会话的 SSE 和读取 native 目录，不再 GET 快照、`workbench` 或角色；创建失败时也不重取列表，Gateway 若实际建成会话，其 `session_derivation_changed` 行事件会带来该行。

Roles are read only from `WorkbenchSnapshot.sessionControl` and `session_control_changed` (no separate HTTP read). Role setters take the native `sessionId` and return the authoritative root/supervisor IDs. Root is local-only. These are trusted user/IM-gateway operations, not model tools; they keep the existing Host/Origin/Fetch-Metadata boundary. Exact role semantics: [session control roles](sessions.md#session-control-roles).

## Gateway restart

规则：[WEB-21](../contract.md)、[LIFE-23](../contract.md)。

`POST /api/gateway/restart` 要求 `{}`，沿用其他变更接口的 Origin / `Sec-Fetch-Site` 校验，无额外鉴权。Web 进程自己 `execFile("systemctl", ["--user","restart","--",unit])`（不经 shell），超时为 `gateway.restartTimeoutMs`。`restart` 在 systemd 作业结束后返回，不等待 Gateway 重新接受连接。

| 结果 | Status | Body |
| --- | --- | --- |
| systemctl 退出码 0 | 200 | `{unit,restarted:true,output}` |
| `gateway.systemdUnit` 为空 | 409 | `{error,code:"NOT_CONFIGURED"}` |
| systemctl 非零退出 | 502 | `{error,code:"SYSTEMCTL_FAILED",details:{unit,exitCode,output}}`；`exitCode` 为 `null` 表示未能运行（如缺少 systemctl） |
| 超过 `gateway.restartTimeoutMs` | 504 | `{error,code:"SYSTEMCTL_TIMEOUT",details:{unit,output}}`；结果未知，客户端不得重放 |

`output` 为 systemctl 的 stdout+stderr，截断至 4000 字符。超时只终止 systemctl 客户端进程，systemd 的作业可能仍在继续。

重启使 Gateway 进程换代：所有会话进行中的回复中断、结果未知且不重放。`restart` 先发 SIGTERM，Gateway 正常关闭时按 [LIFE-3](../contract.md)、[LIFE-12](../contract.md) 关闭 kernel 与模型终端、保留人工终端；卡死而被 systemd 强杀时按 [LIFE-5](../contract.md) 遗留 kernel。文件不受影响。浏览器沿用既有断线重连和新 `streamId` 规则（[ORD-3](../contract.md)、[ORD-10](../contract.md)），没有重启专用的重连通道。

## Topical endpoints

- [Targets / discovery / browse](targets.md#http-routes)
- [Native capability / settings routes](native.md#capability-catalog)
- [Hosted extension UI](extension-ui.md)
- [Workspace file / terminal routes](workspace.md#private-workspace-http-routes)
- [Kernel / monitor routes](kernel.md#http-routes-and-events)
- [Tool library](tools.md#methods-and-http)
- [Skill library](skills.md#methods-and-http)
- [Gateway memory](memory.md#operator-routes)
- [Plugin config](plugin-config.md#operator-routes)
- [Artifacts](artifacts.md)

## Browser request boundary

Specific bind 的 Host 为 exact listener authority；`0.0.0.0` 接受 syntactically valid Host，并以其构造本次 expected origin。
JSON error shape / status mapping 见 [workspace](workspace.md#private-workspace-http-routes)。
界面 presentation、可信网络及非认证边界见 [design notes](../design-notes.md#可信单用户与传输边界)。

## 约定

- Web 监听 host 不做 IP 范围或 DNS 名称限制，由 Node 解析并绑定；port 必须是 0–65535 的整数，0 表示临时端口。
- `src/http/application/start-application.ts` 先建立 Gateway 控制连接再启动 `listener/start-listener.ts`；应用关闭依次释放 HTTP listener 和 Web 拥有的 Gateway 客户端。
- `gateway-connection/client-state.ts` 持有原控制连接和共享流额度；路由直接调用 Gateway，同一 ctx 不另建会话、连接池或 SDK 状态。
- HTTP 路由表位于 `listener/requests/handle-request.ts`，业务入口位于各 `*-routes` 的公开层；请求体、响应编码、SSE 与终端 WebSocket 分别归 `request`、`responses`、`observations` 和 `terminal-sockets`。
- 每个 SSE、观察连接和终端连接各持有自己的 ctx；结束与关闭只清理原先归其所有的订阅、定时器和连接，不停止 Gateway 会话。
