# 会话与公开形状

规则：[GEN-1](../contract.md)、[REQ-1](../contract.md)、[REQ-2](../contract.md)、[REQ-3](../contract.md)、[REQ-11](../contract.md)、[REQ-13](../contract.md)、[模块约定](sessions.md#约定)、[模块约定](../kernel-recovery.md#约定)、[REQ-9](../contract.md)、[REQ-8](../contract.md)、[REQ-10](../contract.md)。
## Published shapes and identities

见 [会话快照与读取错误](session-snapshots.md)，包含 `WorkbenchSnapshot`、`SessionReadIssue` 和单会话快照。

## 旧会话身份迁移

停止 Gateway 和 QQ 并备份数据后，运行 `node scripts/migrate-session-id.mjs --home /绝对路径/PRK-home --qq-state /绝对路径/QQ-state`；两条路径均须显式指定。脚本使用配置的 `session.historyDir`，把受管会话及其引用、终端绑定和 QQ 选择迁为原生 ID；QQ 的 TOML 配置须另行改为 `prk.session`。旧引用无法对应唯一 ID 时会列出记录并在写入前退出；写入阶段发生 IO 错误时从备份恢复后再试。

## Methods

Target configuration methods 见 [targets](targets.md#target-methods)；native actions 见 [native](native.md#methods-exact-parameters-and-results)。
Tool / skill / kernel / workspace 方法按 [HTTP topic index](http.md#topical-endpoints) 分组。

| Method | Parameters | Result |
| --- | --- | --- |
| `workbench` | `{}` | `WorkbenchSnapshot` |
| `modelCatalog` | `{}` | `{models,defaultModel,defaultThinkingLevel}` |
| `kernelExecutionGet` | `{}` | `{asyncExecution:boolean}` |
| `kernelExecutionSet` | exactly `{asyncExecution:boolean}` | `{asyncExecution:boolean}` |
| `toolTitleGet` | `{}` | `{enabled:boolean}` |
| `toolTitleSet` | exactly `{enabled:boolean}` | `{enabled:boolean}` |
| `createSession` | `{target,cwd?,label?,project?:{id,name}|{name}}` | `CreatedSession` |
| `state` | `{sessionId}` | `SessionHostSnapshot` |
| `messages` | `{sessionId}` | `{sessionId,streamId,sequence,messages}` |
| `history` | `{sessionId}` | `{session,snapshot,readOnly:true}`；该会话的已保存记录 |
| `send` | `{sessionId,requestId,message,queue?,mode?,attachments?,references?}` | admission / native result |
| `cancel` | `{sessionId,operationId,cell?:{kernelId,cellId}}` | `{operationId,status:"requested"\|"already_complete"\|"not_found",returnedMessages}` |
| `kernelInterrupt` | `{sessionId,kernelId,cellId,cellOnly?}` | `{kernelId,cellId,status:"requested"\|"not_found",returnedMessages}`；`cellOnly:true` 不停止模型轮次或清除输入队列 |
| `kernelResult` | `{sessionId,cellId,imageIndex?}` | `{sessionId,...cellDelivery,result?}`，[字段与对账](kernel.md#execution-and-callbacks) |
| `renameSession` | `{sessionId,label}` | `ManagedSessionSnapshot` |
| `assignProject` | `{sessionId,project:{id,name}|null}` | `ManagedSessionSnapshot` |
| `renameProject` | `{projectId,name}` | `{ok:true}` |
| `reload` | `{sessionId}` | `{reloaded:true}` |
| `closeSession` | `{sessionId}` | `{closed:true}` |
| `shutdown` | `{}` | `{closed:true}` |

规则：[模块约定](native.md#约定)、[WEB-5](../contract.md)、[WEB-6](../contract.md)、[WEB-7](../contract.md)、[模块约定](native.md#约定)、[WEB-9](../contract.md)、[WEB-8](../contract.md)、[模块约定](native.md#约定)、[模块约定](../configuration.md#约定)。
Model entries：`{value,label,provider,thinkingLevels,contextWindow}`，`value` 为 `provider/id`。
`createSession.label` 会 trim；省略或空白使用默认名称。
`createSession.project` 省略为未归类；`{id,name}` 选择项目，`{name}` 由 Gateway 分配项目 id。名称 trim 后复用 `assignProject` 的唯一性校验，包含仅有归档成员的项目；非法项目在创建 SDK 文件前拒绝（[WEB-57](../contract.md)）。同次请求先写项目归属，再启动运行时并返回带项目的会话行与快照。
`renameSession.label` 是 1–200 字符、无 control characters 的非空文本，保存前 trim；请求边界见 [WEB-47](../contract.md)。忙碌／休眠／关闭但未归档的受管会话均可重命名；返回 `ManagedSessionSnapshot`，集合事件先于结果，见 [WEB-46](../contract.md)。
`renameProject`（`POST /api/projects/:projectId/rename`，body `{name}`）保留项目 id，名称 trim 后与创建项目共用校验（含仅有归档成员的同名项目）。更新 `project.json`，为各未归档和已归档成员追加项目条目；不改写既有 JSONL 行。
Web 的新建会话与所属项目对话框共用不可输入的项目下拉；空选择表示未归类。通过独立模态框确认的新项目先选入下拉，随会话提交保存；提交参数不变。
Gateway 在新项目首次提交归属时保存 `project.json.created`；启动时仅补写缺失的记录，时间取项目最早会话（含归档成员）的 SDK header `timestamp`。侧栏使用会话行的 `projectCreated`，不从成员推算。

活动会话的 `requiresReload` 也比较启动时与当前的项目 `{id,name}`。项目变更通过集合行更新该标志，不自动重载，也不插入消息。重载后项目与记忆层一起生效。
普通 send admission：`{accepted:true,requestId,operationId,sessionId}`。
拒绝：`{accepted:false,requestId,error}`。
`cancel` 只接受仍为当前的 `operationId`；省略 `cell` 则只取消该轮，不代选后台 cell。指定 `cell` 时，仅在代次和 ID 均匹配的情况下定向停止该项。后台 cell 的 ask 不随 SDK 整轮取消一起关闭。
`kernelInterrupt` 要求显式的代次与 cell ID，不匹配返回 `not_found`。`cellOnly:true` 不动 SDK 轮次或输入队列。省略或设为 `false` 时，可停止受理时同一宿主操作；无宿主操作时也可按所选 cell 停止原生 SDK 轮，并通过 `returnedMessages` 返回清出的用户排队文本，不生成操作 ID 或操作事件。已结算的 cell 若还有其他活项，只标记该 cell 的停止，不附带停原生轮；重入后的替代操作或 cell 不继承旧停止。两种停止入口都不唤醒休眠会话，`requested` 不代表退出已确认。
`mode:"auto"` 经 native slash dispatch；`mode:"plain"` 作为普通文本。
运行时启动拒绝包含 `UNAVAILABLE` 与 `details:{submitted:false,stage:"runtime"|"kernel"|"wake",reason}`。

Attachments：`{name,type,size,data,source}`。
References：`{type,source,target,sessionId,path,...}`。
Python MIME 为 `text/x-python`，JavaScript MIME 为 `application/javascript`。
Decoded limits 为单附件 384 KiB、总计 640 KiB；encoded request/framing 仍受 1 MiB 限制。
Catalog 还给出 `maxEncodedRequestBytes` 和组合文本/reference expansion 的 `maxAugmentedMessageBytes`（320 KiB）。

## Recovery and runtime

规则：[KER-8](../contract.md)、[KER-9](../contract.md)、[KER-11](../contract.md)、[REQ-13](../contract.md)、[LIFE-5](../contract.md)、[LIFE-7](../contract.md)、[REQ-14](../contract.md)、[REQ-15](../contract.md)。
`recoverSession {sessionId,mode:"auto"|"new",target?,cwd?}` → `CreatedSession`；new 必填 target，auto 不得更换执行选择。
`recovery.status` 为 available|unavailable|new，附 message；目标连接失败附 code:"TARGET_UNREACHABLE"。
Collection events：`session_recovered`、`session_recovery_failed`。
Close cleanup 无法确认的错误为 `UNAVAILABLE`，附 `details:{closed:true}` 与可能残留 kernel binding。

详见 [kernel recovery](../kernel-recovery.md) 与 [kernel death](../kernel-death.md)。

## Archive

规则：[模块约定](sessions.md#约定)。
| Method | Parameters | Result |
| --- | --- | --- |
| `archivePreview` | `{sessionId}` | `{root,sessions,retained}` |
| `archiveSession` | `{sessionId,confirm:true}` | `{ok:true}` |
| `archiveProjectPreview` | `{projectId}` | `{projectId,sessions,retained}` |
| `archiveProject` | `{projectId,confirm:true}` | `{projectId,archived,unarchived,error?}` |
| `unarchive` | `{group}` | `{ok:true}` |
| `purgeArchive` | `{group,confirm:true}` | `{ok:true}` |
| `manageSession` | `{sessionId,action:"transfer",owner}` / `{sessionId,action:"upgrade"}` | `{ok:true}` |

项目批量归档见 [WEB-56](../contract.md)：从该项目全部未归档会话合并现有派生计划，按原生 sessionId 去重；`sessions` 条目为 `{sessionId,label,state,owner,lifecycle?,phase?}`，保留当前 owner（可指向集合外）；`retained` 同形且附 `createdBy`，排除已在 `sessions` 内的条目。未归档成员为空时返回空集合。
执行仍调用单会话归档及其级联；首个错误后停止。`archived` / `unarchived` 按最终持久归档状态划分此次集合，即使单次级联部分完成后报错也如实返回；`error` 为 `{code,message}`。批量执行结果不返回工作台，归档变化仍走原集合事件。项目目录与项目元数据保留。


`WorkbenchSnapshot.archive` newest-first entries：

```ts
{group,label,at,sessions:[{
  label,sessionId,owner,lifecycle?,kernelOrphan?,
  target?,cwd?,projectId?,projectName?
}]}
```

Collection events：`session_archived`、`session_unarchived`、`session_purged`。

集合事件只携带变化的那一行（[WEB-51](../contract.md)），客户端按行 upsert / delete，不重取 `workbench`：
- `session_derivation_changed`、`session_renamed`、`session_unarchived`、`session_recovered`、`session_recovery_failed`、`session_project_assigned`：`details.session` 为该会话当前的 `ManagedSessionSnapshot`（无法读取时省略）。
- `session_project_renamed`：`details.session` 为改名后的未归档会话行；`archive_group_updated`：`details.archiveGroup` 为变化的归档组行，不移除当前会话。
- `session_archived`：`details.group` 与 `details.archiveGroup`（该归档组当前整行，形状同上）；客户端删除会话行、替换该组。
- `session_unarchived`、`session_purged`：`details.group`；Gateway 先处理完整组再逐成员发事件，客户端收到即删除该组；unarchive 另带各成员的 `details.session`。
- 变更请求只确认结果：`renameSession`、`assignProject` 返回单行，`archiveSession`、`unarchive`、`purgeArchive`、`manageSession` 不返回工作台；HTTP `archive` 返回 `{ok:true}`。其他页与发起页都从集合事件更新。
恢复组中的 missing/archived owner 对应 `gateway-derived-detached`。

## Session tools and inbox delivery

Rules: [REQ-22](../contract.md), [REQ-23](../contract.md), [REQ-24](../contract.md), [REQ-25](../contract.md), [REQ-26](../contract.md), [REQ-27](../contract.md), [REQ-28](../contract.md), [REQ-38](../contract.md), [REQ-39](../contract.md), [REQ-40](../contract.md), [REQ-41](../contract.md), [LIFE-26](../contract.md).

The only session tools are `session_spawn`, `session_send`, `session_result`, `session_list`, and `session_manage`; code mode exposes the same names through `gateway.*`. They belong to the internal `sessions` plugin (`group:tools:package:<inline:sessions>`), whose tools follow normal plugin lazy defaults. To keep spawn/send/result resident and list/manage hidden but discoverable in direct mode, set the two [global lazy switches](../configuration.md#tool-declaration-lazy-loading).

- `session_spawn({context,tasks:[{task,label,target?,cwd?,lifecycle?,...}]})` returns `{children:[{index,sessionId,sessionName,taskId}],errors:[{index,error}]}`. Admission is not completion. sessionId is the only routing identity; sessionName is display text; taskId identifies the submitted task. Retain admitted children after partial failure and never replay the batch. Children use the selected instance's Python; no per-session interpreter selection exists.
- `session_send({to,message,delivery?,replyTo?,expectReply?})`: `to` is a native `sessionId`. `delivery` is `steer` (default), `followUp`, or `abort`. Admission returns `{id,to,accepted:true,pending,delivery:"delivered"|"queued",expectReply}` without waiting for execution or a reply. This return `delivery` is admission status, not the requested scheduling mode.
- Busy `steer` enters at `turn_end`; `followUp` uses the SDK whole-run boundary; `abort` cancels the current operation/tool, preserves the kernel, and admits the message plus accumulated peers as a new run. Idle recipients start a new run in all modes. Only abort requires control.
- `session_list({})` returns reachable sessions, including the caller, with exactly `{sessionId,sessionName,state,parentSessionId,pendingParentSessionId?,self?:true,root?:true,supervisor?:true}`. Only the caller has `self: true`. The parent is the current owner's native ID, or null for top-level sessions; the pending parent is omitted when absent. In both list mode and `space_status().sessions[]`, only the designated root has `root: true` and only a session designated supervisor of its own project has `supervisor: true`; other rows omit those fields. If no root is designated, all rows omit `root`. The compact list does not include a worker routing name, capability, creator, project or derivation object.
- `session_list({sessionId,limit?})` returns `{sessionId,sessionName,state,parentSessionId,phase?,role?,result?,recent}` for one existing session. Inspection requires self or the same control check as management: owner-chain ancestor, target-project supervisor or global root; peers and descendants cannot inspect an ancestor or unrelated session. `phase` is `working|submitted|delivered`; a submitted `result` includes summary, artifacts and optional patch/output. `recent` contains the last `limit` observable entries (default 6, integer 1–20) in chronological order, each `{role:"user"|"assistant"|"toolResult",text,toolName?,isError?}`. Text is capped at 600 characters and includes assistant text, tool name/argument summaries and tool result summaries. Active SDK/client views include in-progress assistant/tool activity; sleeping targets use retained native history without waking or creating a kernel/model request. Unknown targets and missing control authority are errors. `limit` without `sessionId` does not change list mode.
- `session_result({summary,artifacts?,output?})` validates assigned outputSchema before saving. The current parent's `gateway-derived-receipt` records `{child,taskId,result,sessionId}`; `result.id` identifies the result and `sessionId` identifies that receipt's recipient. Receipt recording makes the child `phase:"delivered"`. The result enters the same steer inbox as ordinary messages. A temporary child is stopped and archived; persistent/user lifecycles are retained. No confirmation tool or automatic replay exists.
  Receipt delivery does not interrupt the submitting run. A temporary child waits for the host's operation_completed boundary, after Pi agent_settled and waitForIdle, before stopping and archiving. Successful result submissions finish as completed without hosted-handler AbortError; persistent/user lifecycle handling is unchanged.
- For an unfinished child, a Gateway-admitted operation ending as `failed`, `cancelled` or `unknown` emits one no-reply steer message to its current owner. Body: `[派生会话运行失败 / child=<sessionId>]` followed by a newline and `{sessionId,sessionName,operationId,type,summary}` (`type` is the terminal status; `summary` is bounded to 500 characters). Automatic provider retries do not produce notices. The owner’s own abort, deliberate archiving and Gateway shutdown are excluded. The normal inbox wakes idle/sleeping owners; refusals are logged without replay. A lost Gateway cannot deliver or replay its in-memory notices. The child remains unfinished and can still be steered, inspected, destroyed or finish with `session_result`.
- `session_manage` inputs are a strict union: `{action:"destroy",child}`, `{action:"transfer",child,to}`, `{action:"accept",child}`, `{action:"project",session,project:string|null}`, or `{action:"supervisor",session}`. `child`, `to` and `session` are native `sessionId` values; a project string names the project using existing membership semantics. Destroy follows the current owned subtree. Transfer only sets pendingOwner and sends an inbox offer; accept changes owner, preserving createdBy/task/history. PendingOwner may accept only its addressed offer and gains no other control. The supervisor action is root-only for model callers.
  Gateway、持久派生关系及模型调用均只使用原生 `sessionId`；旧槽位名由一次性迁移脚本处理，不提供双键解析。

All managed actions other than directed acceptance require ancestor/root/same-project-supervisor control; errors explain the refusal. User APIs bypass model authorization: `manageSession` directly transfers ownership or upgrades lifecycle, while `assignProject` sets membership. No legacy tool aliases or grant-destroy action remain.

Ordinary messages, results and transfer offers merge chronologically in one `session-messages` envelope. Each peer has a host/stream-local `arrival` ordinal assigned by receivePeer; it is not a cross-stream clock or a persistent ID. Inbox/SDK pending transport state is not durable and is never replayed. User cancellation retains its existing discard behavior; a session_send abort preserves pending peers instead.

Spawn accepts only `lifecycle:"temporary"|"persistent"`; omission uses `session.defaultDerivedLifecycle`. Temporary is for one-off work: after delivering its result it stops and archives, so no later steer or follow-up work can reach it. Persistent remains until its parent destroys it and can receive later additions or questions. Only the user can upgrade a derived session to independent long-lived `lifecycle:"user"`; models may suggest that upgrade but cannot perform it. Persisted `gateway-derived-session` metadata and published `DerivedSessionInfo.lifecycle` accept exactly `"temporary"|"persistent"|"user"`, with no legacy values.

Archive dialogs label only temporary sessions as 「临时」; persistent and user sessions have no lifecycle tag. The sidebar keeps the plain 「子会话」 badge for every derived lifecycle, including temporary.

## Session control roles

| Wire method | Parameters | Result |
| --- | --- | --- |
| `sessionControl` | `{}` | `{rootSessionId:string|null,supervisors:Record<projectId,sessionId>}` |
| `setSessionRoot` | `{sessionId}` | same authoritative role snapshot |
| `setProjectSupervisor` | `{sessionId}` | same authoritative role snapshot |

Setters take native `sessionId` values and return the authoritative role snapshot. Root must be a local non-archived session; a supervisor must belong to a project. The external IM gateway uses `setSessionRoot` when it changes session. User/IM API setters are unrestricted; model callers use the root-only supervisor action. The first project session is elected automatically. On move/archive/destruction the earliest surviving project member succeeds a departed supervisor; manual choices persist until departure. Archiving/destroying root clears its designation. Role state is persisted in `<PRK home>/session-control.json`; SDK history remains authoritative for membership and ownership.

`WorkbenchSnapshot.sessionControl` carries the designations, and every `session_control_changed` carries the new ones in `details.sessionControl` ([WEB-52](../contract.md)). Manual designation publishes it; a membership change, archive or destruction that re-elects roles publishes it right after its own lifecycle event. Observers apply these values and never infer succession from sidebar ordering; the socket `sessionControl` read stays for wire clients.

## Gateway, CLI, and persistence lifecycle

规则：[GEN-1](../contract.md)、[LIFE-1](../contract.md)、[LIFE-3](../contract.md)、[LIFE-4](../contract.md)、[ORD-6](../contract.md)、[LIFE-18](../contract.md)、[模块约定](native.md#约定)、[模块约定](../configuration.md#约定)、[模块约定](targets.md#约定)、[模块约定](../configuration.md#约定)。
```sh
npm run gateway -- --model PROVIDER/MODEL [--socket PATH]
npm run web -- [--socket PATH] [--host HOST] [--port PORT]
```

Gateway flags：`--home`、repeatable `--extension`、`--no-skills`。
`--model` 是新建会话的默认模型。
Web / attach 也接受 `--home`，共用默认 socket path。
Web address 的显式覆盖项是 `--host` / `--port`。

`attach` actions：`workbench`、`create --target INSTANCE_ID`、`reload-targets`、`watch-sessions`、`state`、`messages`、`watch`、`send`、`cancel`、`reload`、`close-session`；会话选择参数为 `--session SESSION_ID`。
`reload-targets` 使用 `{}`，没有会话 selector。

SDK custom records 承载 target、cwd、model、thinking、project、toolMode、derivation 元数据；执行 handle 不持久化。
配置及会话目录见 [configuration](../configuration.md)。

## Operational configuration and acceptance entrypoints

配置形状见 [configuration](../configuration.md)；运行说明与验收证据边界见 [design notes](../design-notes.md#运行与验收证据)。


## 约定

- Gateway 从 src/gateway/host/start-host.ts:createGatewayHost 启动；所有会话与工作区消费者共用目标连接 owner，REPL/PTY/宿主仅持有自己的租约，不读取或认领旧执行绑定。
- `gateway/session-lifecycle` 负责配置／运行时／输入准入、休眠与 kernel 恢复；`session-hosts` 保持稳定路由和每路由的原宿主订阅；`session-views` 只读投影 SDK 历史和当前流。跨 await 的请求局部值仍留在该次调用，不读取后继代次替代旧捕获。
- `gateway/instances`、`models`、`capabilities`、`remote-packages` 与各资源接线对象共享原来的唯一存储／通道／库。方法视图只是原闭包协作接线，不登记第二套 SDK 队列、历史或恢复状态。
- `src/sessions/` 按对象划分：`host` 关联单个 SDK 会话的请求与终态，`native-interaction` 分派原生命令和输入，`extension-ui` 投影同一宿主流的界面，`extension-invocation` 管理一次扩展调用的取消作用域。
- `history` 管理 SDK 历史文件及 PRK 元数据；`peer-messaging`、`ask`、`memory`／`memory-review`、`plugin-config`、`skill-library` 分别拥有其业务适配。`global-catalog`／`resource-catalog`、`session-settings`、`native-coding`、`target-files`／`target-resources`／`target-skills` 提供资源、设置与目标机能力接入。
- 跨对象只引用对象目录直接公开的文件；对象内部按稳定职责引用具名实现，显式上下文只持有原来的存储与注入能力。装配保留原有急切初始化、订阅顺序与清理归属，不另建 SDK 历史或执行队列。
- 会话上下文只持有 SDK `AgentSession` 和运行时销毁操作，不暴露可替换会话身份的 `AgentSessionRuntime`。
- 保留现有空文件创建接线：公开 `SessionManager.open` 在 Pi 1.4.0 的实现中初始化空文件并生成原生 sessionId；文件名只用于存储，不作为路由身份。隔离运行已验证 header.id、`getSessionId()` 与重新打开的 ID 一致，且自定义元数据持久化；声明只描述打开文件，不保证此空文件细节跨版本不变。
- 同对象的方法以 `fn(ctx, ...)` 直接协作；装配仅为当前外部调用者绑定公开方法。会话插件通过 Gateway 注入的会话绑定接口调用同一派生／消息实例，不另建上下文登记表。
- 原生 `name` 仅适配名称参数和结果，调用注入的 Gateway `renameSession`；不直接修改 SDK 名称或追加原生设置记录，不要求 idle。直接原生动作不经过输入唤醒准入；auto send 保留原来的运行时恢复与输入准入次序，两者均不增加空闲条件。
- 每个对象自身的具名类型集中定义在唯一的领域 `*-types.ts` 中，方法文件一次导入所需的对象类型；类型文件不作再导出壳。运行类保留在实现入口，实例接口在类型文件定义。
- 200 行上限按有效行计算，不计空行、注释与 import；依赖仍通过普通 import 明示，不为缩行隐藏到上下文中。
- 系统提示词主题各有自己的渲染目录：运行时主题在 `src/sessions/runtime/prompt/<topic>/`，`sessions` 在 `src/plugins/sessions/prompt/`；各自的公开 `context_with_system` 钩子只把非空内容写入同名 `sections`，内容以同名 XML 标签包裹，不保留总括能力节。
- `src/plugins/sessions/assemble-sessions-plugin.ts` 是进程内 Pi 扩展工厂，由 `extensionFactories` 对所有顶层、派生及远程目标会话加载，公开 `registerTool` 注册五工具并在 `turn_end` flush 所属收件箱；其他运行时钩子留在独立 runtime 工厂，不留 peer-inbox 空壳。
- `SessionsGateway` 只暴露 schemas／消息参数配置及绑定调用：`spawn`、`submit`、`destroy`、`transfer`、`accept`、`setProject`、`setSupervisor`、`list`、`send`、`identity`；Gateway 在 `create-sessions-plugin-gateway.ts` 注入，插件不 import 其他对象内部。运行时闭包提供 `enabled`、`callableTools`、`delegation`、`flushInbox`，只投影当前状态，不另存身份、控制权或队列。
- 会话工具的声明与隐藏摘要块放在 `space_status` 之后，保持既有模型输入顺序；仅按插件来源重排 SDK 公开 inventory 的展示副本，不修改注册或 exposure。插件的 sessions 节在 runtime 主题之后写入，正文不变；严格 HTTP 捕获回归为 `tests/sessions/check-sessions-plugin.mjs`。
- `sessions` 的 spawn 机制按可调用 `session_spawn` 开关输出；原 delegation 档位只附于无 owner 的顶层会话。子会话保留机制与身份，不输出档位或替代的派活倾向；特殊多层派活由 role／skill 配置。子身份独立于单工具 spawn 开关，即使没有 spawn 能力也保留；关闭整个会话插件组则省略整节。
- 子身份深度沿当前 `owner` 链计算（顶层为 0），父名称取当前 owner 的 label，缺失时用原生 sessionId；不另存深度、父名称或第二套会话状态。
- 终端完整用法只放在 `terminal_*` 工具的 description，经 `tool_search`／`gateway.describe` 发现；工具隐藏时只有摘要与既有 guidelines 进入 `tool_catalog`，完整 description 不进入系统提示词节，不另建 terminal 节或重复参数说明。

- 归档所属关系的级联范围必须由网关计算，不得由客户端推算。
- 归档级联必须获显式确认。
- 归档必须保留升级或转交的子会话及 `SDK` 文件。
- 取消归档不得重建缺失所有者。
- 会话记录必须仅通过 `purgeArchive` 删除。
- 同伴消息必须经接收方收件箱非阻塞投递，不得等待其执行或回答。
- 同伴消息必须按接收顺序合并；steer 在回合边界、followUp 在 SDK 整轮边界投递，可唤醒空闲或休眠接收方。
- 投递回执不得冒充已读或已处理。
- 保留的回复关联内不得回复 `no-reply`、已回答或正在回答的消息。
- 投递失败必须释放进行中的回答关联。
- 进程内回复防重不得视为持久已读回执。
- 接收方关闭、取消尚未结算或收件箱数量及字符上限耗尽时必须拒绝新同伴消息。
- 用户取消必须丢弃未处理同伴消息；session_send 的 abort 必须保留积压，任何路径不得自动重放。
- 取消丢弃同伴消息后必须保留丢弃提示。
- 保存的会话记录必须只读打开。
- 会话历史目录和新文件按进程 umask 创建，不改写已有权限；只在 purge 删除前检查会话文件路径位于 sessions 目录内，不跟踪 dev／inode 或 realpath。
- 项目归属作为 `SDK` 会话元数据保存；分配项目不改变身份、kernel、`cwd` 或路由，但更新项目 supervisor 的控制范围。
- 启动 SDK 会话时一并捕获项目名和记忆层；系统提示词的 `<project>` 节只使用这次捕获的项目名，无项目则省略该节。
