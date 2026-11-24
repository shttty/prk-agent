# Native actions 与 capability catalog

## Methods: exact parameters and results

规则：[WEB-5](../contract.md)、[WEB-6](../contract.md)、[WEB-7](../contract.md)、[模块约定](native.md#约定)。
- `nativeCapabilities {sessionId}` → versioned command/action/resource/prefix/reference/attachment metadata。
- `nativeAction {sessionId,requestId,action,args}` → transient native result，`status:completed|running|cancelled|failed|unavailable|unknown`。

`new` 返回独立新会话的 `session`、`snapshot` 与 `selected:true`；来源会话保留，项目归属沿用。准入与发送规则见 [WEB-48](../contract.md)。
关闭会话保留可用的只读动作；休眠会话另可修改模型、思考档、工具档、委派、本机工具、capabilities 和 scoped models。disabled controls 附 `reason`。
Gateway 不发布 `resume` 动作，已有会话直接通过其路由选择。

`cancel-native` 使用 `args.requestId` 指原操作；ack data 为 `{acknowledged:true,outcomePending:true}`。
tree 的原控制调用返回实际结果。手动压缩结构化调用立即返回 `status:"running",data:{operationId}`，斜线输入返回普通 `send` 接纳回执；两者均以匹配 `operation_completed` 为终态，可用普通 `cancel` 或 `cancel-native` 请求取消。`args.instructions` 和 `/compact` 后缀都是给模型的可选摘要指令。

## Provider ownership diagnostics

`nativeCapabilities.resources[]` 的 extension 条目可附 `providers:string[]`，值来自 Gateway 识别结果。策略错误条目附 `code:"PROVIDER_POLICY"`、`providerId`、`operation:"register"|"unregister"` 与 `reason`；`loaded` 仍反映插件实际加载状态，策略拒绝不等于插件被禁用。网页在会话详情的资源列表显示 provider ID 与原因。

全局、实例及会话 `CapabilityCatalog` 可附 `providerErrors:ProviderPolicyError[]`，不把这类错误变成整个目录加载失败；既有真实加载错误语义不变。结构为：

```ts
type ProviderPolicyError = {
  code: "PROVIDER_POLICY"; providerId: string;
  operation: "register" | "unregister";
  path: string; error: string; source?: string;
};
```

识别、手写 ID 优先及首包所有权规则见 [模型配置](../configuration.md)；传输义务见 [GEN-10](../contract.md)、[GEN-11](../contract.md)、[GEN-12](../contract.md)、[WEB-58](../contract.md)。

## Session name

`action:"name",args:{name}` → `data:{name}`，返回 trim 后的名称；HTTP 与 socket 入站各校验非空、长度及控制字符，并拒绝额外参数。执行复用 Gateway `renameSession`；忙碌与无活动运行时的受管会话均可改名，集合事件与结果顺序见 [WEB-46](../contract.md)。

`send` 的 HTTP／wire 入站只收到 `message`，尚没有 label。Gateway 按自身 `defaultSendMode` 经现有 slash parser 和真实 SDK 命令归属分派；只有确认内建 `/name` 后，才在文本转 label 的输入解析边界校验一次。扩展覆盖 `/name` 与 plain 文本不受 label 规则约束；结构化附件／引用仍先按控制输入规则拒绝。非法内建名称保留 `status:"failed",data:{executed:false}`；直接 nativeAction 的非法参数在进程入口拒绝。见 [WEB-47](../contract.md)。

## Model and thinking

规则：[模块约定](native.md#约定)。
- `action:"model",args:{model:"PROVIDER/MODEL"}` → `data:{model,thinkingLevel}`，包含切换模型后 SDK 实际采用的思考级别。
- `action:"thinking",args:{level}` → `data:{thinkingLevel}`。

Catalog 中的 SDK `thinkingLevels` 是当前模型支持值。
醒着时四项轻量设置（model / thinking / tool-mode / delegation）只乐观更新会话快照的同名字段（网页的唯一来源，[WEB-54](../contract.md)），不占用 nativeActionPending；以 POST completed data 确认，失败或非 completed 回滚对应字段。休眠时不写乐观值或 POST 完成值，只接收服务端推送快照。
设置类操作（四项轻量设置与 local-tools / capabilities / dequeue / tree / reload）完成后，网页不串行 GET 完整会话或目录：开关与能力由 Gateway 推送的会话快照和 `session_capabilities_changed` 触发的一次目录刷新更新；dequeue 的队列由 `queue_update` 更新；tree 完成后与 reload 后 Gateway 各推送一次轻量 `snapshot` host event，reload 换流时即新流快照；网页切换流，历史锚点变更时主动读取对应历史页。

休眠设置保存后不创建 SDK 会话或 kernel；Gateway 推送的新会话快照提供当前 model、thinkingLevel、toolMode、delegation、localTools、scopedModels。模型与范围必须来自当前可用模型清单，思考档必须由所选模型支持；非法值不追加条目。compact、reload、export、tree-label 仍需先唤醒。

休眠时只换模型且未另选思考档，保留已保存的 thinkingLevel，并用公开 `clampThinkingLevel` 按新模型能力裁剪；不连接目标机读取偏好。醒着时仍由 Pi `setModel` 选择目标模型偏好、SDK 全局默认或当前值；两条路径不强求相同偏好选择。

内建斜线设置与结构化 nativeAction 共用 Gateway 原生准入；休眠时 `/model`、`/thinking`、`/scoped-models` 不走 SDK 输入唤醒，`/compact`、`/reload`、`/export` 仍拒绝。未知命令及扩展、技能、模板保留原 SDK 输入准入与覆盖优先级。

### 保存的模型不可用

唤醒时原模型已不在共享 ModelRuntime 的可用快照中，Gateway 显式选用 PRK 配置的默认模型，先通过会话管理器追加原生 `model_change`，思考档沿用公开 SDK clamp，再创建原 SDK runtime；不选择目录里其它模型，默认模型也不可用则启动失败。Gateway 仅在实际回退时记录一条含原模型与默认模型的日志。原生文件、会话快照和首个真实模型请求使用同一默认模型，下次唤醒不再重复回退。

会话快照可选 `modelFallback:{previousModel:string,model:string,reason:string}`：两个模型均为 provider/id，reason 明确说明原模型不可用且已改用默认模型。未执行回退的休眠记录仍显示原模型；用户可先用休眠设置换掉它。发送保持正常，不要求先确认或选模型。

网页在会话顶部显示提示与模型选择／确认入口。`action:"acknowledge-model-fallback",args:{}` 只清除当前 Gateway 进程中的展示通知，返回 completed 并推送不含 modelFallback 的完整快照；不写文件、不唤醒。显式有效模型选择也清除提示，失败选择保留提示。通知在同一 Gateway 进程跨 sleep/wake 保留，Gateway 重启后不恢复展示通知；持久模型已写回，因此不重复回退。无提示时完整快照省略 modelFallback 字段。

## Tool mode and local tools

规则：[模块约定](native.md#约定)。
- `action:"tool-mode",args:{mode:"code"|"direct"}` → `data:{toolMode}`。
- `action:"local-tools",args:{enabled:boolean}` → `data:{localTools}`。
- `action:"delegation",args:{level:"gated"|"restrained"|"eager"}` → `data:{delegation}`。网页只在快照带 `delegation` 时显示该控件。

Native current fields：`nativeCapabilities.target.current.toolMode`、`.localTools`、`.delegation`（网页不读，以快照为准）；instance marker 为 `.target.local`。
Catalog 的 `target.streamId` 标识所观察的宿主流；插件界面操作的 `data.streamId` 归属见 [ORD-15](../contract.md)。
Persisted custom type：`gateway-native-session-state`。
Local tool names：`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`。
Remote native names：同样七个工具，在目标宿主执行；使用同一 `local-tools` action 和 localTools 字段。七工具在会话创建时注册；远程默认关闭。开关立即切权限、下一请求切声明，原生开时拒绝 PRK files 的调用而不卸载模块，关时恢复。不开新 SDK 会话、不重启 kernel，Python 变量保留；无 target 插件／项目扩展时，第一次真正调用原生工具才启动宿主。有插件时为注册插件而启动的宿主与原生工具共享。网页远程标签仍为「原生工具」，本机为「本机工具」。

### Kernel language

`action:"kernel-language",args:{language:"python"|"bun"}` 接受醒着且空闲的会话；执行位、启动、维护、换代或待落账占用时返回 `BUSY`。完成时 `data:{status:"changed"|"unchanged",language,variablesLost}`。改选先核验目标运行时，再确认关闭旧代并追加 `gateway-native-session-state`；若旧代已作废但切换失败，失败回执会说明。改选不启动新代，下次执行从空 namespace 开始，旧结果不改。休眠、已关闭或归档会话只显示保存值，不为切换而唤醒。

会话快照的 `kernelLanguage` 是权威设置，缺省 `python`；派生会话初始继承父会话所选语言，不继承变量。`nativeCapabilities.target.current.kernelLanguage` 和同名 action 可用性供原生目录使用。

## Capability catalog

规则：[模块约定](../configuration.md#约定)、[模块约定](native.md#约定) / [模块约定](native.md#约定)。
| Wire / HTTP | Parameters / body | Result |
| --- | --- | --- |
| `capabilitiesList` / `GET /api/capabilities` | `{}` | `{catalog,defaults:{capabilities,localTools},terminal}` |
| `capabilitiesList` / `GET /api/capabilities?instance=<name>` | `{instance}` | instance-layer settings |
| `capabilitiesRefresh` / `POST /api/capabilities/refresh` | `{}` / `{instance}` | refreshed settings |
| `capabilitiesChange` / `POST /api/capabilities` | `{changes:[{id,enabled:boolean|null},...]}` | global settings |
| same | `{instance,changes:[{id,enabled:boolean|null},...]}` | instance settings |
| same | `{terminal:Partial<TerminalOptions>}` | tool configuration |
| `nativeAction action:"capabilities"` | `args?:{changes:[{id,enabled:boolean|null},...]}`；省略 args / `{}` 只读 | session catalog |

`changes` 必须非空且 ID 不重复；旧单值写入形状一律拒绝。先校验整批结构、目录归属、锁定状态及最终有效状态，再一次性保存：全局一个 config.toml 写入，实例一个 instances.toml 写入，会话一个 gateway-native-session-state custom entry。任意条目无效时整批拒绝，文件、会话覆盖与生效状态均不变；成功只刷新一次 loadout 并返回一次原有 settings/catalog。`null` 删除该层显式键（全局也可重置为默认），不会写入 TOML；实例不支持本机工具总开关。终端配置仍单独使用 `{terminal}`，不得混入批量能力写入。
Entries：`configured,enabled,loaded,overridden,defaultEnabled,groupEnabled,locked?,available?`。`loaded` 表示已注册／已发现，关闭项仍可为 true，不等同于可声明或可执行。
Catalog / native current / live snapshot：`requiresReload`，字段形状不变；只反映资源注册变化（装卸插件、插件／skill 文件及远程包变化），启用、分组、原生和懒加载开关均不置 true。
`session.noSkills:true` 时，全局目录保留的技能可以是 `loaded:false`；这是主动禁用加载，不构成待重载资源。新建、普通唤醒和模型回退均不应仅因此置 `requiresReload:true`。
Instance discovery failure 可附 `instanceError:string`；defaults 始终是 global-default table。
注册文件版本来自公开 SDK 入口／skill 路径与注册 settings 字段。Gateway 文件用 mtime/size 比较；远程在创建基线及显式 `action:"capabilities",args:{}` 时经已有 `skills.registration {paths,settings}` 查询，最多 4096 项、请求／结果各 256 KiB，返回 `versions:[[path,version],...]`。目标只返回 stat 版本与 settings 的 packages/extensions/skills 投影，不传正文。同步快照报告最近观测值；写开关不等待远程查询，不因目标暂不可达阻止关闭权限。

Tool entries 可附 `exposure`（SDK `ToolExposure`）与 `lazy:{id,enabled,defaultEnabled,overridden,available}`；支持懒加载的 tool groups 可附同形 `lazy`。`lazy.id` 是 `lazy:tool:<name>`、`lazy:group:tools:library` 或插件组 `lazy:group:tools:<package|mcp|remote>:...`，提交时使用这个 ID，而不是原启用 ID。`enabled` 保留有效懒加载设置，即使 `available:false`；`defaultEnabled` 是移除当前层后的继承值（全局层为组默认），`overridden` 只表示当前层自身 `lazy.id` 有值。分组设置仍影响成员的有效值，但只把分组标为覆盖，不把成员标为覆盖；启用开关的条目与分组也采用自身键语义。
懒加载按 session > instance > global，层内工具值优先于组值；global/instance settings 与 merged live session catalog 都返回该状态。只有沉淀工具组默认 lazy=true，所有插件组默认 false，不按单个工具名特判。内置组只剩 `group:tools:local`、`group:tools:kernel`、`group:tools:library`。model-only 工具的 `lazy.available` 为 false；组内至少有一个有效启用、可调用成员时组懒加载可改。kernel 函数、skills、Pi 原生七工具无 `lazy`；`tool_search` / `tool_call` 不进入目录。批量写入以整批最终启用状态校验 lazy 可用性，因此同时启用工具并设置 lazy 不受旧关闭状态影响。
保存沿用上述接口与三个已有 capabilities map；各层的 `null` 删除该层 override。懒加载变更刷新原会话 loadout，下一次请求前生效，不改变原工具的权限、active 状态或 `requiresReload`，不经 `excludeTools`。两个元工具仅在 direct 档存在隐藏项时激活并声明。
九个内部工厂及工具／提示词归属见 [配置布局](../configuration.md#tool-declaration-lazy-loading)。`kernel_code` 属于 `group:tools:package:<inline:kernel>`，code 档锁定规则不变。`prk_saved_*` 仍归 `group:tools:library`；四个 `prk_library_*` 内部回调不进入普通目录，`<inline:tool-library>` 没有普通管理成员或目录组行。其全局 `lazy:group:tools:package:<inline:tool-library>=true` 是存储策略，目前不影响普通工具声明。没有新增 `tool_save` / `tool_remove` API。

Kernel entries 另含 `module,source,overridesBuiltin,dependencies,error?,moduleOnly?,pending?`。
Function IDs：`kernel:<function>`；module-only/pending/error IDs：`kernel:module:<module>`。
Catalog module `files` 是文件工具；`hashline` 是 standalone module-only library。
Sources / inspect / dependencies 见 [kernel-tools](../kernel-tools.md)；skill groups 见 [skills](skills.md#discovery-shadowing-and-read)。
同一绝对路径经目标项目与 Gateway 全局重复发现时，只保留目标项目候选；显式本机实例的 Gateway home 技能仍归全局来源。目录、SDK 加载与技能读取共用去重后的候选，避免同一 `skill:<path>` 自遮蔽而使 `requiresReload` 永远为 true。

Remote package entries/groups 另含 `instance` 与 selected `location:"local"|"target"`。
Group ID 为 `group:tools:remote:<instance>:<package-name>`，工具仍使用 `tool:<name>`；本机插件与实例远程包分组展示。
Inline factory group IDs retain `group:tools:package:<inline:NAME>` for capability keys; published group names and display sources strip the `<inline:...>` wrapper (for example `sessions`, `kernel`, `skill-tools`). SDK `sourceInfo.path` remains unchanged; this is display metadata, not a routing or permission identity.
启用开关按 session > instance > global、同层单工具优先分组实时解析。会话始终注册全部工具；停用项只进入 `hiddenDeclarations`，保留 active 与原 exposure，下一请求不声明、`tool_search` 不返回，`gateway.describe` 不列。统一 `tool_call` 钩子立即返回 `{block:true,reason:"<工具名> 在本会话已关闭"}`，覆盖模型、code、元工具和远程插件嵌套调用。code 档 `kernel_code` 仍锁定。技能每请求按当前开关选胜者，`skill_read` 拒绝关闭或被覆盖项。资源重载不用于切开关。
实例目录发现使用可释放的公开 SDK 会话，释放其远程进程与租约，不分配 kernel、不请求模型；所有会话休眠时也可发现。
安装及观测结果见 [remote package routes](plugin-config.md#remote-extension-packages)。

## Derived-session settings

| Wire / HTTP | Parameters / body | Result |
| --- | --- | --- |
| `derivationGet` / `GET /api/derivation` | `{}` / no body | `{derivation:DerivationConfig,defaults:{defaultToolMode,defaultIsolated,maxDepth,defaultInstructions,roles}}` |
| `derivationSet` / `POST /api/derivation` | `{derivation:DerivationConfig}` | same latest settings |

`DerivationConfig` and role fields are listed in [configuration](../configuration/session.md#derivation). POST requires the normal Host/Origin/Fetch-Metadata checks. Both boundaries reject unknown fields, invalid role names/model formats/thinking levels, non-`code|direct` modes, nonboolean isolation/capability values, and noninteger/out-of-range `maxDepth` with `400 INVALID_REQUEST` before changing disk. POST replaces the entire `derivation` group, preserves all unrelated raw `config.toml` values, and hot-updates Gateway spawn settings; it neither reloads nor changes existing children.

Global and instance saves regenerate TOML with a first-line PRK settings comment and do not preserve handwritten comments. If disk content changes after the server's mutation read, the pre-replacement hash check returns `CONFLICT` without publishing the candidate. Request and response shapes are unchanged; clients do not send a configuration hash.

GET returns the configured group with merged built-in `task` / `small` roles, separately from fallback `defaults`: the host's `session.workerTools`, `false`, `3`, `DEFAULT_DERIVED_INSTRUCTIONS`, and `DEFAULT_DERIVATION_ROLES` respectively. `defaults.roles` is the canonical built-in baseline; the Web uses its keys to protect built-in role deletion/renaming while allowing edits. User fields override built-in role fields, and omitted built-ins return to baseline rather than disappearing. Global `derivation.defaultModel` / `defaultThinkingLevel` are rejected. The [field definitions](../configuration/session.md#derivation) include role descriptions and defaults. `space_status.roles[]` always includes both built-ins, with optional `description`, `toolMode`, and `isolated`; `derivationDefaults` reports effective `toolMode`, `isolated`, and `maxDepth`, without model/thinking fields.

## Clone, reply fork and authority

规则：[模块约定](native.md#约定)、[模块约定](targets.md#约定)、[模块约定](native.md#约定)。
`action:"fork-reply",args:{entryId}` 选择 persisted assistant SDK entry。
Clone 使用 active SDK branch；reply fork 包含所选 reply，不含后续 turns。
Native cloned session 的 target/cwd 见 [sessions](sessions.md)；Python 来自实例。
受管创建绑定 `gateway-session-binding` 的 subject 为 native `sessionId`；分支只读取自身 subject 的权威元数据。
Managed fork 的 authority 细节见 [design notes](../design-notes.md#会话分支与元数据归属)。

`space_status({target?})` 提供 sanitized targets/sessions、roles、models/thinking、defaults/inheritance。`targets[].id` 是实例路由标识，`targets[].label` 是显示名；入参 `target` 仍引用该 ID。`sessions[]` 沿用 [会话列表](sessions.md#session-tools-and-inbox-delivery) 的控制角色字段：只有指定的 root 行有 `root: true`，只有各项目监工行有 `supervisor: true`；未指定 root 时所有行省略 `root`。
显式 target 返回实例 Python 与待补 configurationIssue，不查询内核目录。

### Session tools and control

工具参数、应答与信封的唯一字段定义见 [session tools and inbox delivery](sessions.md#session-tools-and-inbox-delivery)；包括 `session_send` 的 `delivery/replyTo/expectReply`、派生运行失败通知、结果 receipt 与 `phase:"delivered"`、`session_manage` 的 action 联合。`owner` 是当前父会话，`createdBy` 是最初派出者，转交不改后者；root / supervisor 的查询、设置与持久字段见 [session control roles](sessions.md#session-control-roles)。

`session_spawn({context:string,tasks:[{label,task,role?,model?,thinkingLevel?,target?,cwd?,isolated?,outputSchema?,lifecycle?}]})` starts independent tasks with shared context. Every label is a required nonempty string; omitted role selects task for every role-driven setting and saves that role on the new child. toolMode is not a task parameter: role > derivation default > host session default selects it. Each task may select its own absolute cwd; selection is defined in [模块约定](native.md#约定). Model/thinking select request > role > creator current value for every lifecycle. Child depth is parent depth + 1 (top-level 0) and must not exceed maxDepth. The result is `{children:[{index,sessionId,sessionName,taskId}],errors:[{index,error}]}`; sessionName is the label and sessionId the sole routing identity. Retain admitted children on partial failure rather than replaying the batch. `session_result({summary,artifacts?,output?})` validates output against the task schema before submitting it.

`session_list({})` returns compact reachable-session rows, including the caller marked `self: true`; `session_list({sessionId,limit?})` returns one controlled session's status, result and recent output. The exact fields and limits are defined in [session tools and inbox delivery](sessions.md#session-tools-and-inbox-delivery). Inspection permits self, current owner-chain ancestors, the target project's supervisor and global root; it does not wake the target or invoke a model. The Gateway accepts only native session IDs.

### Worktree isolation and patch results

`isolated` selects request > role > derivation default > false. When enabled, repository discovery and `HEAD` resolution run on the task's execution target. A non-git cwd fails explicitly (use `isolated:false` to opt out). The target creates detached `~/.cache/prk-worktrees/<sessionId>` at that commit, preserving the base cwd's repository-relative subdirectory. `gateway-derived-session` metadata stores flat `{isolated:true,repoRoot,worktreeRoot,baseCommit}` fields. The child prompt identifies the worktree and parent checkout and forbids parent-tree writes. `GIT_CEILING_DIRECTORIES` is set to the worktree container for native Bash, remote execution, kernel processes and model terminal commands; before result submission, a target-side fingerprint must still match the captured parent checkout HEAD and tracked/untracked state. Any change rejects submission, including legitimate concurrent parent edits.

Before an isolated `session_result` is delivered, the target uses a temporary `GIT_INDEX_FILE`: read baseCommit, stage the current whole worktree with `git add -A`, and produce `git diff --cached --binary <baseCommit>` plus its `--stat`. This includes committed, uncommitted, and untracked changes without modifying the child's own index. A nonempty patch is saved at `<PRK_HOME>/artifacts/patches/<sessionId>-<taskId>.patch`. The result and the parent's delivered inbox message include `patch:{path,bytes,stats}`, and the absolute patch path is appended to `artifacts` if absent. No file changes means no patch file or patch field. Applying the patch to the parent is explicit.

Patch content is capped at 16 MiB and stats at 64 KiB; exceeding either limit fails submission rather than truncating the result. Repository operations and patch generation stay target-side. The complete generated patch crosses the existing target channel only to publish the Gateway artifact, in base64-encoded chunks of at most 192 KiB raw bytes. The target also retains the patch at that same absolute artifact path for the parent's `git apply`; remote targets therefore require that path to be writable.

Persistent children keep their worktree for later steering; upgrading to an independent user session also keeps it. Archive/destroy removes the worktree on its target with `git worktree remove --force`; cleanup failures are logged without blocking archive.

## Queue and presentation

规则：[模块约定](native.md#约定)。
`action:"dequeue"` 返回 whole pending queue text；snapshot shape 为 `queuedMessages:{steering,followUp}`。
`session_event.details.sdkType:"queue_update"` 附 `steering` / `followUp`。

`tree-read` / `tree-filter` / `tree-fold` / `tree-copy` 的 data 是 `scope:"web-presentation"` metadata。
`tree-label` / `tree` / compaction 使用 SDK entry IDs 与 native effects。
Native export formats 为 HTML / JSONL；copy data 为 `{text}`。
Unsupported capability limits 见 [design notes](../design-notes.md#未开放的能力与接入边界)。


## 约定

- 模型目录与 `SDK` 思考级别必须来自网关共享 `ModelRuntime` 的公开可用快照。
- 模型发现不得创建代理会话、内核、探测外部连通性或暴露凭据。
- 原生动作不得隐式关闭来源会话。
- 分派单个原生命令只解析该命令（扩展同名命令优先于内建，内建优先于同名 skill/template），不构造模型、会话树等参数候选；完整目录只在显式目录请求时构造。
- 原生动作与目录解析目标时只读宿主的 `streamId` / `state` 标量（无活动宿主时读归档流身份的唯一分配点 `archivedStream`），不得为此克隆或投影整份会话快照。
- 当前活动会话的模型和思考级别必须用公开 `setModel`、`setThinkingLevel` 修改，不得重建运行时或重排记录。
- 休眠时只有 Gateway history manager 写会话；活动时沿用原 SDK/runtime manager。设置准入复用 transitions，与 sleep/wake/close 交接串行，不按瞬间 sleeping 标记在过渡窗口选写入方。
- 两种状态共用模型可用性、思考档与能力批次校验。休眠的模型与思考档使用公开 appendModelChange / appendThinkingLevelChange；其它设置使用同一 gateway-native-session-state 形状，唤醒仍走原读回路径。
- 会话模型变更不得改变全局默认。
- 模型、思考级别与 code/direct 设置变更必须保留执行中提供方请求的旧值，并让后续助手请求使用新值。
- `localTools` 必须保存为会话设置，立即切互斥工具权限并在下一请求更新声明；不得为开关重建 SDK、启动冷 kernel、重启已有 kernel 或删除变量。
- 网关本机原生工具必须仅在显式本机实例启用。
- 工具模式不得改变内核执行位置或将 `local` 当作第三种模式。
- 克隆和回复分支必须由独立公开 `SessionManager` 接收者的 `createBranchedSession` 创建，不得手抄记录或伪造助手回退。
- 回复分支必须校验已持久化助手回复并保留来源叶节点。
- 克隆和回复分支不得继承任务责任或 `Python` 内存。
- 取出排队内容必须用 `SDK.clearQueue` 返回整个待处理队列的引导及后续文本。
- 取出队列不得由序号、文本或时序重建附件和请求来源。
- 队列状态必须以 `SDK` 为准，不得按文本猜请求或来源身份、模拟逐项删除、重排后重新入队或按文本匹配复原状态。
- 取出的排队文本必须追加到最新草稿。
- 取出队列不得取消当前执行。
- 附件不得承诺与 `SDK` 会话记录永久关联来源。
- 会话树读取、复制、筛选、折叠和浏览器展示状态不得写会话或追加命令及输入回执。
- 实际会话树、标签和压缩操作必须保留 `SDK` 效果。
- 已有自身主体绑定的管理器必须仅以原生会话自身的任务、绑定、回执、归档及结束元数据授予管理权。
- 复制或不匹配条目不得继承所有者或任务结果权限；root/supervisor 角色由独立唯一原生身份记录授予。
- 复制或不匹配条目不得抑制新结果投递。
- 派生会话默认必须继承创建者目标而不继承内核规格。
- `session_spawn.tasks[].cwd` 显式值必须为绝对路径并优先；省略时，同实例继承创建者保留的 `cwd`，跨实例使用所选实例默认 `cwd`。直接工具、命名 Gateway 回调和 `gateway.call` 必须共用 `createSession` 的绝对路径校验，拒绝时不得创建该子会话。
- 结果交付 receipt 必须精确匹配接收者、子会话、任务和结果；写入即 delivered，不得再要求确认工具。
- 不得用派生管理收编普通会话。
- 完整复制、导出、重跑和分支内容必须来自公开 `SDK` 消息、管理器、条目标识及原生导出接口。
- 延迟投影不得当作完整来源，也不得按消息索引伪造条目。
- 导出不可用时不得另建会话序列化实现。
- 用户消息必须来自 `SDK` 会话记录。
- 工具结果必须按 `toolCallId` 匹配。
- 工具结果必须保留工具文本原义。
- `Markdown` 链接必须限于受支持协议，不得加载远程 `Markdown` 图片或执行原始脚本。
- 能力、参数和可用原因必须来自目标会话真实 `SDK` 及资源目录，不得用浏览器白名单或旧候选状态代替。
- 能力执行时必须按当前状态重验。
- 已识别内建控制命令必须经原生分发器执行。
- 未知斜线命令或禁用的 `shell` 前缀必须拒绝并标为未执行。
- 普通文本必须经明确纯文本通道交给 `SDK`，不得因透传字符串而声称控制命令已执行。
- 聊天中的 `shell`、`trust`、`login`、`logout` 不得产生敏感宿主或外部副作用。
- 聊天中的 `share`、`debug`、`import`、`llama` 不得产生敏感宿主或外部副作用。
- 敏感命令不可用时必须返回原因，不得伪造执行成功。
- 输入法组字期间不得用回车提交消息或命令。
- 命令及引用候选确认必须与发送分离。
- 引用菜单打开时回车或制表键必须仅选择候选或不动作。
- 网页端新建、克隆和回复分支必须创建独立会话身份，不得替换来源身份、记录或内核。
- 网页端新建、克隆和回复分支不得复制 `Python` 内存或来源会话内核权限。
- 不得添加永久命令或输入回执。
- 全局能力目录必须仅保留在网关内存。
- 网关模型服务、历史管理与全局／实例能力发现辅助会话的 `cwd` 必须为中立的 PRK home，不得使用 Gateway 启动目录或实例默认项目目录；辅助 SDK loader 关闭项目准入与上下文扫描，避免 PRK home 的祖先项目资源进入全局目录。
- 完整能力发现必须用可释放的内存 `SDK` 会话，不得创建工作进程、会话 `JSONL`、内核或模型请求，也不得依赖已有唤醒会话。
- 全局能力目录只能在完整发现、诊断检查及 `SDK` 清理成功后替换，发现、警告或错误通知失败必须保留上次目录。
- 项目准入、`requestId` 去重、操作结果和输入来源展示必须仅保留为有界进程内或草稿状态。
- 项目准入及输入展示不得另写永久控制回执或承诺跨重启精确重建。
- `SDK` 原生消息与会话记录必须保持权威。
- 调用单元的截止时间必须仅在提问等待用户期间暂停。
- 远程工具目录键必须包含实例归属，同名工具不得串入其他实例目录。
- 远程工具来源必须保留实例、包与执行位置，并沿用原有三层开关，不得另建开关注册表。
