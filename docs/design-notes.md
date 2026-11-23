# 设计说明与已知边界

跨进程与机器的通信规则见 [通信契约](contract.md)；模块内部规则见各模块文档末尾的「约定」。
本文集中保存取舍、实现说明、旧设计、原型和验收材料；这些说明不把未实现能力变为承诺。
字段与端点按主题见 [网页接口目录](wire/http.md#topical-endpoints)。

## 按主题投影系统提示词

PRK 不再拼接一个 `<prk_capabilities>` 大节，而是每请求按当前权限分别投影 kernel、gateway_calls、tool_catalog、sessions、ask、memory、skill_tools、native_tools。空主题不输出，Pi 自己的 skills、cwd、addendum 等节保持原语义；模块位置与出现条件见 [会话约定](wire/sessions.md#约定)。

`<sessions>` 将会话机制与 delegation 档位分开：gated／restrained／eager 原文不变，只向无 owner 的顶层会话输出；派生子会话只保留机制与身份，不用替代句劝派或劝不派，特殊多层派活由 role／skill 配置。session_spawn 描述只讲准入、身份、结果与消息机制，不引用派活策略。子身份随当前 owner 链即时计算，转交后采用新父 label 和深度，不另存层级或复制 SDK 状态；即使关闭 session_spawn，子会话仍看得到自己的交付职责。

终端是 bash 的交互替代路径，命名终端、静默事件、输入确认、密码手输、restart 与服务就绪等待都随 terminal_* 工具完整 description 发现，不增加终端提示词节，也不在多个节里重复。隐藏摘要继续只取第一句，完整参数与说明经原生工具发现入口取得。


## 工作台按会话隔离读取失败

工作台是聚合视图，不是一次全有全无的会话操作。历史目录的逐文件加载、当前路由选择和逐会话投影各自保留校验失败；不可读会话通过 `unreadableSessions` 返回，健康会话继续列出。可用身份、文件与字段原因同时进入 Gateway 的单行 warning，同一进程按原生会话 ID 只报告一次；原生身份本身缺失或损坏时按文件定位并去重，不伪造 ID。诊断是展示数据，不是另一套 SDK 会话状态。

网页把已知位置的诊断放回原活跃或归档列表，用警告图标和「无法读取」区别执行失败；点击只显示原因，不进入聊天。归档身份本身损坏而无法确认位置时，按用户选择单列在侧栏「无法读取」分组，不猜状态；不再叠加顶部 banner。历史、唤醒等定向操作仍拒绝坏数据，解归档先验证全组，避免先修改健康成员再失败。

同类隔离覆盖 binding / cwd、project、archive、native state 及派生元数据。Pi 1.4.0 的公开 `SessionManager.listAll` 会略过无法解析的文件及吞掉目录枚举异常，未公开被略过文件的身份和原因，本次不另造目录扫描或 SDK parser。协议字段见 [会话快照](wire/session-snapshots.md#无法读取的会话)。

## direct 档按需加载：固定声明，不改 exposure

`src/sessions/tool-declarations/` 投影当前工具模式、启用与懒加载状态，统一给出声明、隐藏清单和提示词。通过 Pi 公开 `prepareLoadout.hiddenDeclarations` 隐藏声明，工具保留原 exposure 和 active 状态；`tool_search` 只返回启用隐藏项的 schema，`tool_call` 经原生 `ctx.executeTool` 执行，搜索或调用均不激活工具、不改变声明。启用开关与懒加载设置一样在下一请求更新声明；权限由统一 `tool_call` 钩子即时拒绝，不再通过 `excludeTools` 重建注册集合。

`tool_search` 的查询按空白分词，任一词命中名称或描述即入选；按命中词数降序，同数量时名称命中数更多者优先，完全同分保持原清单顺序。

不用 `deferred`：它会改变插件原 exposure 与可调用语义。也不用 Pi CLI 内置 `tool_search`：它通过激活工具扩充声明；CLP 模型没有 compat，Claude 同样走 Responses，工具集变化会使整段请求重发并打掉 prompt cache，各厂商支持不一致。固定声明的方案与 provider 无关，不依赖厂商增量工具协议。

隐藏工具的 guidelines 由 PRK 每请求计算的 `<tool_catalog>` 补回；工具清单优先使用 `promptSnippet`，否则取 description 第一句。code 档复用同一摘要格式，继续通过 `gateway.describe` 获取 schema，不加元工具。Pi 原生七工具没有懒加载开关；`model-only` 不能经 `ctx.executeTool` 调用，因此也不可懒加载（用户确认）。常驻默认名单为 `kernel_code`、`todo`、`ask`、`session_spawn`、`session_send`、`session_result`；其余 PRK 工具默认懒加载，插件默认不懒加载。

Pi 1.4.0 对显式 tools 名单的 registry refresh 会重新激活所有可声明的匹配项；迟注册库工具也会触发。`prepareDeclarations` 因此同时隐藏不在当前投影 declared 集合中的两个元工具，保持 code 档不出现 tool_search/tool_call，direct 档无隐藏项时也不泄漏它们；不修改 SDK、exposure 或另建 loadout 状态。
扩展的聚合声明钩子（包括 Pi codemode）通过公开 `extensionsOverride` 获得 PRK 自有 definition 投影：只过滤 `prepareLoadout` 的声明输入，不修改上游对象、注册集合或 execute，因此关闭项不会从聚合 description 泄漏。PRK 自定义 system prompt 会绕过 Pi 默认 guidelines 段，故同一投影补回全部启用工具的 guidelines，关闭项不贡献规则。


### 会话开关：注册、声明、权限

插件、PRK、原生和 library 工具常驻注册；开关只影响声明和权限，MCP／插件组沿同一层级解析。skills 保留 Pi 发现顺序的同名候选，目标项目优先；当前启用过滤后按名称选胜者，广告和 `skill_read` 共用同一动态 loader。`requiresReload` 不比较 enabled 与 loaded，而比较注册资源、文件版本和远程包配置；`loaded` 只描述注册，不充当权限。

`prk_tools.files` 的导入只建立 namespace、配置和空展示表，不读写工作区、不启动文件进程、不持文件锁；Python 函数与 SDK 工具分属不同命名空间。每次函数调用经有界专用 stdin 查当前权限，旧别名同样受控；原生开启时在 IO 前拒绝 files。七个同名 SDK 工具保持注册，PRK-owned dispatch 只让专用文件回调在原生关闭时走目标出口，其他调用走 Pi 原生权限。切换保留 kernel、变量及 hashline 展示表。

无 target 插件的远程宿主只在首次原生调用部署启动；并发首次调用共享该代次的启动 Promise，未启动时关闭只释放租约。有插件／可信项目扩展时，为取得注册需先启动，之后原生工具与插件仍共享一个宿主、事件总线和 scope。装卸插件与资源文件变化仍走显式重载；没有新增队列、持久状态或兼容路径。


## 会话通信：一个收件箱，固定控制权

详见 [会话通信：一个收件箱，固定控制权](design-notes/sessions.md#会话通信一个收件箱固定控制权)。


## 可信单用户与传输边界

详见 [可信单用户与传输边界](design-notes/transport.md#可信单用户与传输边界).

## 目标文件工具的取舍与限制

详见 [目标文件工具的取舍与限制](design-notes/files.md#目标文件工具的取舍与限制).

### 文件工具的既有验证入口

详见 [文件工具的既有验证入口](design-notes/files.md#文件工具的既有验证入口).

## 会话分支与元数据归属

详见 [会话分支与元数据归属](design-notes/sessions.md#会话分支与元数据归属).

## 插件配置与宿主限制

详见 [插件配置与宿主限制](design-notes/extensions.md#插件配置与宿主限制).

### 远程扩展宿主正式接入

详见 [远程扩展宿主正式接入](design-notes/extensions.md#远程扩展宿主正式接入).

#### 约定

详见 [约定](design-notes/extensions.md#约定).

### 网页会话流身份

详见 [网页会话流身份](design-notes/extensions.md#网页会话流身份).

## 记忆审查的消息来源边界

详见 [记忆审查的消息来源边界](design-notes/memory.md#记忆审查的消息来源边界).

## 终端生命周期与重连限制

详见 [终端生命周期与重连限制](design-notes/workspace.md#终端生命周期与重连限制).

### 终端验证材料

详见 [终端验证材料](design-notes/workspace.md#终端验证材料).

## 未开放的能力与接入边界

详见 [未开放的能力与接入边界](design-notes/transport.md#未开放的能力与接入边界).

## 已实施设计：kernel 文件写入对插件可见

详见 [已实施设计：kernel 文件写入对插件可见](design-notes/files.md#已实施设计kernel-文件写入对插件可见).

### 原则与公开接入

详见 [原则与公开接入](design-notes/files.md#原则与公开接入).

### 执行位置与数据流

详见 [执行位置与数据流](design-notes/files.md#执行位置与数据流).

### 匹配、写后格式化与状态

详见 [匹配、写后格式化与状态](design-notes/files.md#匹配写后格式化与状态).

### 模型直接工具与插件位置

详见 [模型直接工具与插件位置](design-notes/files.md#模型直接工具与插件位置).

### 大小与兼容范围

详见 [大小与兼容范围](design-notes/files.md#大小与兼容范围).

## 已实施设计：Pi 原生工具装在远程宿主

详见 [已实施设计：Pi 原生工具装在远程宿主](design-notes/extensions.md#已实施设计pi-原生工具装在远程宿主).

### 互斥与执行位置

详见 [互斥与执行位置](design-notes/extensions.md#互斥与执行位置).

### 公开定义与插件事件

详见 [公开定义与插件事件](design-notes/extensions.md#公开定义与插件事件).

### 制品与离线运行

详见 [制品与离线运行](design-notes/extensions.md#制品与离线运行).

### 切换生效与代价

详见 [切换生效与代价](design-notes/extensions.md#切换生效与代价).

## 已实施设计：远程宿主按会话合并、独立 scope 与钩子停止

详见 [已实施设计：远程宿主按会话合并、独立 scope 与钩子停止](design-notes/extensions.md#已实施设计远程宿主按会话合并独立-scope-与钩子停止).

### 宿主形态（对齐本机 Pi）

详见 [宿主形态（对齐本机 Pi）](design-notes/extensions.md#宿主形态对齐本机-pi).

### 钩子与停止

详见 [钩子与停止](design-notes/extensions.md#钩子与停止).

### 不做

详见 [不做](design-notes/extensions.md#不做).

## 运行与验收证据

详见 [运行与验收证据](design-notes/verification.md#运行与验收证据).

### 旧验收范围与入口

详见 [旧验收范围与入口](design-notes/verification.md#旧验收范围与入口).

## 配置参考迁入的说明

详见 [配置参考迁入的说明](design-notes/configuration.md#配置参考迁入的说明).

### 开发套件主目录与包加载

详见 [开发套件主目录与包加载](design-notes/configuration.md#开发套件主目录与包加载).

### 能力目录发现

详见 [能力目录发现](design-notes/configuration.md#能力目录发现).

### 同伴消息与取消限制

详见 [同伴消息与取消限制](design-notes/sessions.md#同伴消息与取消限制).

### 分发制品、缓存与导入

详见 [分发制品、缓存与导入](design-notes/configuration.md#分发制品缓存与导入).

### 代码桥接与展示压缩

详见 [代码桥接与展示压缩](design-notes/configuration.md#代码桥接与展示压缩).

PRK-PYRETURN 的动机是 luna 中同一套调用习惯遇到的类型分歧：`json.loads(gateway.terminal_send(...))` 因已经拿到 `dict` 而抛 `TypeError`，但 `gateway.session_spawn(...)` 当时仍返回 JSON 字符串、要求调用方再解码。返回类型不应取决于 PRK 工具内部如何组织面向模型的文本；因此所有 `gateway.*` 与内核模块 `host.call` 直接返回 Python 值，PRK 结构化结果显式使用 `outputSchema`／`structuredContent`，插件则优先结构化内容、否则保留字面文本，不增加 JSON 猜测兜底。模型直接调用的 `content` 不变；失败仍作为 Python 异常，结果通知中的 JSON 行仍按消息协议解析。

### `Python` 操作跟踪与观测局限

详见 [`Python` 操作跟踪与观测局限](design-notes/configuration.md#python-操作跟踪与观测局限).

### 内核资源作用域、遥测与变量

详见 [内核资源作用域、遥测与变量](design-notes/configuration.md#内核资源作用域遥测与变量).

### 可复用工具、技能与证据边界

详见 [可复用工具、技能与证据边界](design-notes/memory.md#可复用工具技能与证据边界).

### 记忆审查与输入计数边界

详见 [记忆审查与输入计数边界](design-notes/memory.md#记忆审查与输入计数边界).

### 模型终端的展示与运行说明

详见 [模型终端的展示与运行说明](design-notes/workspace.md#模型终端的展示与运行说明).

### 监控目标通道与版本控制后备展示

详见 [监控目标通道与版本控制后备展示](design-notes/workspace.md#监控目标通道与版本控制后备展示).

## 会话 cwd 资源

详见 [会话 cwd 资源](design-notes/sessions.md#会话-cwd-资源).

### Pi 1.4.0 对照

详见 [Pi 1.4.0 对照](design-notes/sessions.md#pi-140-对照).

### 回传、上限与宿主

详见 [回传、上限与宿主](design-notes/sessions.md#回传上限与宿主).
