## 会话通信：一个收件箱，固定控制权

跨边界义务见 [通信契约](../contract.md#请求与结果)，工具参数、交付字段与角色接口见 [会话线协议](../wire/sessions.md#session-tools-and-inbox-delivery) 和 [原生接口入口](../wire/native.md#session-tools-and-control)。

### 五个工具按使用频率分工

原来的十个工具收为 `session_spawn`、`session_send`、`session_result`、`session_list`、`session_manage`，统一使用 `session_*` 前缀，不留旧别名。派活、消息和交付各自常用且参数差异大，合并容易让模型填串；低频的 destroy / transfer / accept / project / supervisor 合并到 `session_manage`，list 合并原来的同伴与子会话查询。前三个常驻、后两个默认懒加载是可改的部署设置，不是硬编码权限。

### 交付不再要求 acknowledge

普通消息、转交提议与任务结果走同一收件箱，按接收顺序合并。结果先写当前父会话的原生 receipt，作为唯一持久交付凭据，再入箱；receipt 不代表模型已读。删除 acknowledge，是为了不让父会话用额外工具确认一次已经完成的交付；receipt 只把 temporary 子会话标为 delivered，当前 SDK 运行自然收束并完成宿主操作后才停止归档，不中断正在提交结果的一轮。内存消息不重放，不增加恢复队列或重试调度。

steer 在 turn_end 插入；followUp 使用 SDK 的公开整轮边界；abort 沿宿主取消链中断当前工具后重新准入，保留 kernel 与积压消息。SDK 始终拥有执行与消息队列状态，项目只保留已批准的有界传输收件箱。

子会话交付结论附 `file:line`，执行证据附命令与退出码，让父会话可以低成本抽查。只读调研默认信任，只抽查下一步依赖的一两条结论；代码结果看 diff、跑相关测试，不重做排查。仅在结论矛盾、与已知事实冲突或下一步不可逆时深挖。

### 固定控制权而非可配置权限系统

控制权只有祖先、全局 root、同项目 supervisor 三条规则，对应可信单用户的树状委派与跨项目操作，不增加可配置权限系统。转交接受是定向 pendingOwner 的窄例外，不授予其他控制权；模型指定 supervisor 仅限 root。用户 API 不受模型规则限制。root 与 supervisor 的唯一身份单独持久化，成员、父子关系和创建时间仍以 SDK 记录为准。

父会话是当前 owner，负责整棵子树；creator（createdBy）是最初派出者，转交不变。顶层会话没有父会话，一个项目可以有多个顶层会话，supervisor 不等于顶层；不再用 main 指代角色。项目 supervisor 取代旧的「项目不授予管理权」决定。

root 是唯一 local 会话身份；PRK 不实现 IM，外部 IM 网关切换会话时调用同一个设置接口，无 IM 时由用户指定。销毁／归档清空 root 且不自动接任，休眠保留。项目首个会话自动成为 supervisor，离开后按最早存活成员接任，避免引入可配置选举机制。

派生生命周期统一为 `temporary`（交付后停止归档）、`persistent`（保留到销毁）与仅用户可升级的 `user`。旧值不兼容读取；部署前使用一次性迁移脚本（未随仓库发布）在停机副本上迁移会话 JSONL 与配置，脚本不进入运行时。

## 会话分支与元数据归属

关联 [WEB-5](../contract.md)、[WEB-6](../contract.md)、[WEB-7](../contract.md)、[模块约定](../wire/native.md#约定)、[模块约定](../wire/targets.md#约定)、[模块约定](../wire/native.md#约定)。
来源：原 `gateway-wire.md:438,464-467,470-472,479,696`。

- 新建与恢复分别打开独立或已有的受管路由，不提供源身份替换、跨文件事务或回滚。独立的 `SessionManager` 接收实例使原管理器、文件和叶节点不受分支复制影响。
- 开发套件中不含助手消息的克隆可能无法原生落盘；项目没有伪造助手消息或自定义序列化兜底。已列出的开发套件、存储、职责与原生浏览器检查只覆盖真实执行过的映射，不证明真实外部模型质量。
- 管理器具有自身主体绑定时，才按该主体筛选网关权威记录；原生设置、项目、上下文和 SDK 历史仍不被过滤。分支头若无自身绑定则不受管；格式错误的受管绑定仍报错。
- 输入回执不是结果交付账本。派生结果先写当前父会话原生 receipt，再作为同伴消息进入同一收件箱；不再生成单独的结果或转交通知，不要求确认，不自动重放。
- 原生自定义通知仍用于其他已存在的宿主反馈。SDK 可将 custom 消息转成 provider 用户内容；这不赋予系统角色，也不建立恰好一次保证。公开 clearQueue 返回的未消费同伴信封可用于 abort 保留积压，不依据文本相等猜消费状态。
- `Pi SDK 1.0` 中 `steer` 与 `followUp` 返回的 `queued`、`handled` 只是开发套件处置结果，不证明完整回合或模型可见的用户消息；`SessionHost` 等待调用结算与公开的 `waitForIdle`，不重建队列处置状态。
- 旧文第 `682` 行声称编辑、重新生成与分支切换仍被禁用；源码已有原生重跑、树选择与派生分支（`web/workbench/store/native-actions/rerun-message.js`、`web/chat/transcript/messages/MessageActions.jsx`）。该段是旧界面状态，不再作为有效能力说明。草稿、对话记录位置、工具展开状态与输出位置的浏览器会话存储边界保留。

### 同伴消息与取消限制

关联 [模块约定](../wire/sessions.md#约定)、[REQ-1](../contract.md)、[模块约定](../wire/native.md#约定)。原 163、167、169、171、173、175。

- 每个 `SessionHost` 的 `inbox` 是有界进程内传输状态；steer 在等待完成的内联 turn_end 中合并，followUp 交给 SDK 整轮边界，abort 经公开取消完成后重新准入并保留积压与 kernel。接收端 arrival 仅在同一宿主流内排序。
用户的引导与后续消息保持独立。
合并信封的批次 `id` 由消息标识以 `+` 连接，`index` 从零起，单条时省略 `batch`；界面的批次外框与协议数据不是一回事。
- 用户取消区分未投递收件箱/队列残留与已入权威记录但尚未处理的同伴信封；下一次显式运行或恢复记录隐藏丢弃反馈，不重放。session_send abort 改为保留待投递同伴信封，已消费的消息不重放。网页按操作已应用的后缀把累计 returnedMessages 还回原会话草稿；重复文本不去重，已应用数量随原有草稿窗口保存。
- 输入改写扩展可能抹掉同伴信封，未消费的改写后文本会作为用户文本回到输入框；返回 `handled` 的扩展会使整批成为丢弃通知的拒绝记录。原段特别指出，取消 `Python` 后结果可能仍为 `unknown`，因为停止代理不建立目标副作用回滚。
- `no-reply` 与 `already-answered` 记忆都是有界进程内状态，重启清空、淘汰后不再约束；接纳失败会释放临时预留，不消耗成功回复的记忆容量。报错可提示用新的消息补充信息，而非重复 `replyTo`。

## 会话 cwd 资源

项目资源只属于会话的 cwd 及会话所在机器；本机实例保留原 SDK 路径。远程创建／空闲重载时，既有目标通道 `skills.resources` 一次返回整个资源快照，替代原来独立的项目 skill 补扫。全局技能与 prompt 始终来自 Gateway；项目同名覆盖全局，不再有目标 home 来源、实例分组或 home 清单缓存，实例管理页也不扫描目标 home。

### Pi 1.4.0 对照

- `dist/core/resource-loader.js:115-134,145-195`：每目录只选首个普通文件，优先级 `AGENTS.override.md`、`AGENTS.md`、`AGENTS.MD`、`CLAUDE.md`、`CLAUDE.MD`；祖先从 `/` 到 cwd，不在 `.git` 停止；嵌套 linked worktree 有自身上下文时遮蔽主仓库同名上下文。全局 agentDir 上下文在项目前。
- `dist/core/settings-manager.js:120-125,232-271,338-380`：项目设置只在 cwd 的配置目录，不沿祖先合并；`SettingsManager.fromStorage` 保留 `projectTrusted` 的加载、合并和重载语义，嵌入 SDK 默认 trusted。PRK 已批准 rebrand 的 `CONFIG_DIR_NAME` 是 `.prk`（`dist/config.js:473`），没有新增 `.pi` 别名。
- `dist/core/package-manager.js:1972-2067`：Pi 的项目 `.prk/{prompts,skills,extensions}` 只查 cwd；`.agents/skills` 从 cwd 向上至首个 `.git`，home 原本单列。PRK 去掉目标 home 来源，保留公开 `DefaultPackageManager.resolve` 的 ignore、显式路径、包资源与覆盖模式；缺失项目包明确拒绝，不安装、不联网。本机和远程按每类资源各自的 Pi 查找规则执行，项目 prompt 不沿祖先目录查找。
- `dist/core/package-manager.js:309-344,381-458` 与 `prompt-templates.js:86-169`：自动 prompt 只含目录第一层 `.md`；扩展支持目录自身／子目录的 manifest、index.ts、index.js 及直接 `.ts`／`.js`。模板经公开 `parseFrontmatter` 解析，并用 `promptsOverride` 注入。
- `.agents/skills` 内部扫描继续采用已确认的 BFS 深度 ≤6、SKILL.md 停止、仅根层 loose Markdown；这是 PRK 已确认的规则，不改回 Pi 的递归模式。所有项目技能进入同一个 `skillsOverride` 和现有能力选择／读取路由。

### 回传、上限与宿主

上下文正文必须回 Gateway，因为模型请求／系统提示词在那里构造；prompt 正文用于 SDK 的模板展开，settings 正文用于公开 `SettingsManager.fromStorage`，skill 仅回广告所需 frontmatter／路径。插件正文、skill 支持文件及其他项目文件不回传。`agentsFilesOverride` 注入全局上下文加目标上下文；Gateway 侧资源 loader 使用中立 PRK home、关闭项目准入并禁止本机上下文扫描，最终 SDK 会话仍使用真实目标 cwd 和目标设置，避免同名路径污染。

`limits.contextFileBytes` 默认 **64 KiB**，`limits.contextTotalBytes` 默认 **256 KiB**，按文件原始 UTF-8 字节计数，适用于单次快照的上下文、settings、prompt 和必要技能元数据；默认总预算沿用既有目标文件结果 256 KiB 量级，单文件预算为其四分之一，防止单个项目文档挤占整段提示词。目标侧有界读取，任一单文件或总预算超限都拒绝整个发现并报告路径、字段和上限，不截断、不忽略；用户可配置提高。运行时／SDK 首次通过现有制品通道分发，缓存命中只复用锁定制品，不传项目文件；这属于发现前的依赖准备，不是一文件一次请求。

资源请求前的依赖探测只返回 cwd 是否存在及 `.prk` 资源是否需要 Pi 解析，不回传正文。没有 `.prk/settings.json` 或 `.prk/{skills,prompts,extensions}` 时，目标模块直接完成同一批上下文／`.agents` 发现，不部署无用 SDK；需要时先走现有制品准备，再执行一次资源批量请求。探测与读取之间若新增了需要解析的资源而依赖未准备，明确失败，不丢资源或猜测回退。

资源解析器沿用 `remoteHost.runtime`（默认 Bun）；不要求 Node。解析器与会话宿主使用同一目标制品缓存，不因资源解析额外下发 Node。冷目标仍需准备锁定 SDK bundle；包构建会在 Gateway 制品库发布 Node 供显式 Node 模式使用，不等于目标机传输。

目标 Pi 辅助程序只做公开资源解析，不执行扩展；项目扩展路径随后交给现有每会话单一远程宿主，与原生工具和已安装 target 包共享事件总线、scope、代次与释放。`extensions.locations` 继续只决定受管包的位置；项目路径始终是目标路径，不能改放 Gateway，也不加入全局实例包列表。原有 noContextFiles／noPromptTemplates／noSkills／noExtensions 开关保持生效。

真实 SDK session manager 与新建／克隆 JSONL header 使用会话 cwd；中立 cwd 只属于 Gateway 辅助服务。历史启动使用公开 `SessionManager.listAll(historyDir)` 枚举当前 PRK 的多 cwd 文件，不用 `list(cwd, historyDir)` 的单项目过滤；打开已有会话沿用其 header，不新增项目影子状态或迁移旧文件。

Pi `agent-session-runtime.js:311-314` 的便捷工厂通过 `session-cwd.js:2-35` 在当前进程检查 manager cwd，不能用于 Gateway 上不存在的目标路径。远程会话由公开 `createAgentSessionFromServices` 完成创建后，用根导出的公开 `AgentSessionRuntime` 构造器接管原生生命周期（`agent-session-runtime.d.ts:52`）；目录存在性已由目标资源请求的目标 cwd 检查。本机会话仍用原便捷工厂。retarget 通过公开 `SessionManager.open(file, historyDir, nextCwd)` 重新绑定 manager，保留原 SDK 会话身份与历史，不修改上游实例。
