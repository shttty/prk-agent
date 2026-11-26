# Plugin config semantics

规则：[模块约定](plugin-config.md#约定)。
Provider 是 tools settings 中显示的 plugin package name。
Description file：`<PRK home>/config-schemas/<encodeURIComponent(provider)>.json`。

```ts
type StoredPluginConfig = {
  provider:string;file:string;updatedAt:string;
  sections:{title:string;fields:{
    key:string;label:string;type:"string"|"number"|"boolean"|"select"|"list";
    default?:unknown;options?:string[];description?:string;secret?:boolean;
  }[]}[];
};
type PluginConfigView = {
  provider:string;configured:boolean;file?:string;sections:StoredPluginConfig["sections"];
  values:Record<string,unknown>;exists:boolean;secrets:string[];
};
```

`file` 为 Gateway-host absolute JSON path；`key` 为 dot path。
`configured:false` 表示没有 description；missing file 对应 `values:{},exists:false`。
Mask 为 `••••••`；`secrets` 给出 explicit `secret:true` 或 leaf name 匹配 `key|token|secret|password` 的 dot paths（case-insensitive）。

Model tool `plugin_config` request：`{action:"set",provider,file,sections}` 或 `{action:"get",provider}` → `PluginConfigView`。
Direct / code mode 分别声明工具或调用 `gateway.plugin_config(...)`。

## Operator routes

| Wire method | HTTP POST route | Parameters | Result |
| --- | --- | --- | --- |
| `pluginConfigGet` | `/api/plugin-config/get` | `{provider}` | `PluginConfigView` |
| `pluginConfigSet` | `/api/plugin-config/set` | `{provider,file,sections?}` (UI 「添加配置文件路径」 sends only `file`) | `PluginConfigView` |
| `pluginConfigWrite` | `/api/plugin-config/write` | `{provider,changes:[{key,value}]}` | `PluginConfigView` after the write |

`pluginConfigSet` 的 omitted `sections` 对应只登记 config path。
Value updates 通过 operator `pluginConfigWrite`，plugin 读取时点见 [design notes](../design-notes.md#插件配置与宿主限制)。

## Pi packages

`<PRK home>/agent/settings.json` 的 `packages` 是唯一安装清单。每项保留 Pi 的 `source` 和可选 `autoload/extensions/skills/prompts/themes`，新增 PRK `enabled:boolean`、`location:"host"|"gateway"`。普通运行只读此新对象格式；旧字符串、默认远程列表和实例远程列表须先离线迁移。传给 SDK 的公开 SettingsStorage 投影剥离 PRK 字段；不依赖 SDK 接受未知字段。

| Wire method | HTTP route | Parameters / body | Result |
| --- | --- | --- | --- |
| `pluginsList` | `GET /api/plugins` | `{}` | `PluginList` |
| `pluginsInstall` | `POST /api/plugins/install` | `{source,location?}` | `PluginList` |
| `pluginsChange` | `POST /api/plugins/change` | `{source,enabled?,location?}`，至少一个修改字段 | `PluginList` |
| `pluginsUninstall` | `POST /api/plugins/uninstall` | `{source,confirm:true}` | `PluginList` |

所有路由拒绝 query 和未知字段；不接受 instance、tarball upload 或旧 remote-extensions 别名。安装 source 是 npm 包名（可带 npm: 与版本）或 Gateway 本地目录绝对路径；返回的 source 是后续操作的唯一身份。安装默认 enabled=true、location=gateway；迁移同样默认Gateway，只有依赖目标文件/进程/环境的插件建议host。卸载本地目录仅移除登记，绝不删除原目录。

```ts
type PluginLocation = "host" | "gateway";
type PluginCommand = {name:string;description?:string};
type ProviderPolicyError = {
  code:"PROVIDER_POLICY";providerId:string;operation:"register"|"unregister";
  path:string;source?:string;error:string;
};
type PluginList = {restartRequired:boolean;packages:Array<{
  source:string;name:string;enabled:boolean;location:PluginLocation;
  version?:string;sourceKind:"local"|"npm"|"git";sourceDisplay:string;
  installedPath?:string;
  commands:PluginCommand[];
  providerIds:string[];
  providerErrors:ProviderPolicyError[];
  warnings:string[];
  error?:string;errorCode?:string;errorDetails?:Record<string,unknown>;
}>};
```

commands 与 providerIds 从真实 SDK/宿主注册与 noprov 所有权取得，不从源码文本或名字猜测。host 命令由 Gateway 注册同名桩，经同一目标宿主协议执行原 handler；UI 使用现有 extension-ui 通道，无法提供的能力明确报 unsupported。provider 所有者只能选择 gateway；拒绝以现有错误信封 code=`PROVIDER_POLICY`、details 含 `providerErrors` 返回，不自动换位置。
`version` 取已安装包 package.json 的非空字符串；不可读时省略。`sourceKind` 由 Gateway 按 Pi 支持的来源形式判定；`sourceDisplay` 为本地路径（Gateway 用户 home 前缀按完整路径段缩为 `~`）、去掉 `npm:` 的包规格（保留版本）或去掉 `git:` 的仓库地址。Web 总是显示来源行，标题按需附版本；原始 `source` 身份不变。

保存host位置不要求实例已配置；已有真实provider所有权/注册诊断仍立即校验，尚未执行的新插件在首次实际宿主加载时接受同一provider policy检查。
已有实例时，安装/启用/改到host仍在保存前注册预检：Gateway机器上的独立短命Node直接读取已解析目录和项目已安装SDK，运行原host `load`/注册façade，复用codec、16MiB帧预算与30s控制期限；无目标连接/制品传输、SDK会话或Gateway候选工厂双载。结束先停止自有进程组，避免断开触发session_shutdown；不运行会话hooks/commands。预检只证明注册能力，目标上的实际结果仍来自真正会话宿主。
宿主遇同步 `tool.prepareArguments` 时，仅拒绝该包并保留 `UNSUPPORTED` 与 `details.member="tool.prepareArguments"`；预检经现有错误信封原样返回，列表保留error/errorCode/errorDetails。UI使用已有错误组件提示该能力不能跨进程，不能跳过schema或在Gateway双载；VCC按P5保留Gateway，host矩阵不适用。
Gateway discovery 启动通知按包源发布 `warnings`；已归属的启动错误用 `errorCode:"PLUGIN_STARTUP_FAILED"` 和 `error`，该插件至 Gateway 重启前不进入目录或新会话，不更改安装清单和已注册的共享 provider 所有权。

普通插件保存用于新建、唤醒或显式重载，不热替换正在执行的插件。已识别provider包的安装/启停/卸载保存成功后，`restartRequired:true` 明确提示“需重启Gateway生效”，就近复用通用设置的重启按钮/API；卸载后仍保留该顶层提示。该值仅从真实bootstrap所有权、注册诊断和配置差异推导，不建第二provider权威。重启前模型选择器与已有会话保持实际bootstrap，非provider CRUD不修改共享ModelRuntime。Gateway与本机host直接加载原目录；远程host当前内容hash制品由实例环境下发构建并传输：新建/唤醒/重载发现缺失时自动下发并等待，换代只校验并复用缓存，不退回旧包。
P6环境规划不改变按包失败隔离：解析/打包失败写现有`remoteCatalogStatuses`，会话加载沿既有状态投影该错误，健康包继续。`PLUGIN_BUILD_FAILED`的`errorDetails.packageHash`只标识已尝试的当前内容；新hash缺缓存由下一次会话启动或手动下发重新构建，不靠旧错误跳过检查，也不持久化第二份失败清单。

旧 `remoteExtensionsList/Change/Install` 和 `/api/remote-extensions` 整块移除，无兼容读写。插件配置文件编辑仍使用上方独立 `pluginConfig*` API。


Gateway 向远程加载器注入同一个 `TargetChannels`；每会话每目标机一个宿主与引用计数租约，原生七工具和该会话所有 target 包共享 Pi `createEventBus()`。运行时由全局 `remoteHost.runtime` 选择 Bun（默认）或 Node。加载及工具／命令错误按包投影；`onRemoteExtensionGeneration` 为每个包观察同一个 generation/PID。
目标`remoteExtensions`模块通过`platform`、`assetCheck/assetBegin/assetFinish/assetAbort`维护制品缓存；实际传输由独立实例下发任务经公开pi-env文件接口执行，`start/frameChunk/stop`管理会话宿主进程。
`start`携带执行generation、runtime/host绝对路径、runtimeArgs字符串数组、cwd、字符串环境与memoryMax/memorySwapMax。所选runtimeArgs按argv原样传入Node/Bun，空数组不补参数；所选运行时缺制品明确失败，不回退系统运行时，目标使用PI_OFFLINE=1且不联网安装。返回`{pid,rootPid,scoped}`：pid始终是执行Pi的Node/Bun进程，rootPid单独标识本次Python根，不复用旧字段含义。
目标通道在`XDG_RUNTIME_DIR`（缺失用`/tmp`）用短`mkdtemp(prefix="prk-")`目录监听一次Unix socket；Node/Bun使用公开`net.connect({path})`，不继承socket或根状态pipe。Python根校验所属scope和内存上限后fork Node/Bun，自己保留且不加载插件。宿主握手发送`{pid,rootPid,scope}`；runtime核对rootPid对应自己的Popen根、宿主是其直接子进程且同PGID，scope模式另核对所属scope路径。保持原启动/握手期限，只accept一次，随后unlink并关闭listener；退出或启动失败删除本次目录，不新增残留扫描。stdin仍为`/dev/null`。
宿主通过双向socket传换行JSON，stdout/stderr作为日志；`load`含`{generation,nativeTools,telemetryIntervalMs,providerOwnerIds?,packages:[{name,extensions:[absolutePath]}],snapshot}`，返回pid/rootPid、有效tools/commands及按包error/errorCode/errorDetails/providerErrors。Gateway核对load身份与start应答一致。providerOwnerIds只含Gateway所有者ID，不含凭据、配置或流函数，入口要求唯一非空字符串；工具、事件和反向SDK/UI调用仍用各自请求id，不承载网页流序号。
Gateway与目标runtime用`{generation,offset,total,last,data}`分块传输完整宿主帧，data为Base64；逻辑帧限16MiB，块按本代processWindow及真实封套预算计算。每方向仅重组一帧，严格检查offset/total/last，失效丢弃不重放。Gateway逐块等消费应答；新请求忙时立即BUSY，既有调用的reply/abort等待当前单帧完成，不能交错或另建队列。Unix socket队列和原装事件总线不变，观测只发布完整逻辑frame。
制品按配置`codemode.binChunkBytes`分块经pi-env `writeFile/appendFile`确认后计进度，压缩、目标解压及原SHA-256校验见[实例环境下发](targets.md#实例环境下发p6)；宿主控制帧仍独立遵守原processWindow与16MiB预算。
通道丢失或子进程退出后的待处理调用以副作用未知错误拒绝；恢复通道不会重建旧进程或重放旧请求。
Linux scope与无scope模式的Python根均设置`PR_SET_PDEATHSIG(SIGHUP)`，并在设置后核对真实父PID以覆盖启动竞态；父死、宿主退出或正常关闭时，由根停止自己的systemd scope，或仅TERM/KILL自己的进程组，再退出。根不运行插件，故Pi同步卡死不阻塞该路径；非Linux明确记录父死清理能力降级，不保证断链清理。scope包含host的setsid/nohup后代；无scope只承诺本PGID，不能套用人工终端主动脱离保留语义或伤及其他kernel/scope。
根的清理控制不依赖runtime日志pipe：systemctl不继承其stdout/stderr，诊断写入异常不能跳过finally中的本PGID清理。断链后物理scope/后代退出由独立observer验收；Gateway已失去目标连接时报告的kernel清理未确认错误仍保留，不由外部观测结果伪造产品应答。
根只向runtime专用pipe写一次有界执行宿主退出码，Node/Bun不继承该pipe。`exit`事件分别携带pid、rootPid、`code`（已知的执行宿主退出码，否则null）与`rootExitCode`；根为清理自杀的SIGKILL不得冒充Pi因OOM退出。状态不持久化、不重放。
事件 `event` 与工具 `execute` 无固定期限；`load/snapshot/shutdown` 仍用控制期限。取消按请求 id 发 `{kind:"abort",id,reason}`，宿主触发所属调用 signal 后回 `{kind:"abort_ack",id}`；Gateway 立即作废钩子关联，迟到 reply 不再匹配。`remoteHost.abortTimeoutMs` 内未收到回执时，停止旧 scope 并经既有 Gateway reload 换代；不同于断线，不重放在途调用。重建沿用会话记录及 kernel，新 SessionHost 使用新 streamId。
宿主内存帧为 `{kind:"memory",id:"host:memory",payload:encode(KernelMemory)}`；Gateway 复用 kernel 的 schema 校验，按传输 generation 归属，投影至 [monitor.remoteHost](kernel.md#monitor)。停止远程控制请求与 scope 必须先于 SDK runtime.dispose，确保 shutdown 的公开 UI 上下文仍有效；不得保存失效 ctx 再绕过其生命周期检查。
provider 策略错误使用既有 socket 帧 `{kind:"provider_policy",id,payload:encode({name,diagnostic})}`；`diagnostic` 为 [ProviderPolicyError](native.md#provider-ownership-diagnostics)。Gateway 按当前传输代次校验并追加到原包观测，不设置包的 `error`，不移除工具、hook 或命令。目标项目扩展加载前检查其 bundle 中 Pi 1.6.0 policy 接缝，缺失须重建 bundle，不执行未拦截的项目插件。
`local:true` 也通过本机daemon和共享目标通道启动独立宿主，原生七工具和host插件不在Gateway执行。`location:"gateway"` 插件及provider仍只在Gateway。只有原生工具时先注册同版公开声明，首次执行才启动宿主；有host插件时按既有加载时机启动。

嵌入观测接口为 `onRemoteExtensionEvent(event & {instance,package,sessionId?})` 与 `onRemoteExtensionGeneration(generation,{instance,package,sessionId?})`。
它们转发传输工厂的观测，不拦截或替换 SDK 方法，也不成为第二套 SDK 状态。


## 约定

- 网关插件配置描述和点分键必须校验。
- 模型描述接口不得修改插件值或覆盖无关字段。
- 插件配置读取接口必须遮罩已保存的秘密值，不得返回其原值。
- 写入秘密字段时，空串或掩码必须沿用已保存值，新值必须覆盖。
- 远程安装列表、加载错误和进程观测必须分离，观测不得持久化为会话或安装权威。
- 插件安装与位置只写 agent/settings.json 的 packages，文件为0600；不保留实例远程扩展列表或另一份默认清单。
- 远程工具与事件必须沿用原生 `SDK` 注册、调用、事件排序、结果与取消语义，不得建立影子队列。
- 远程宿主每进程只接受一次加载；每个包的声明只在其全部工厂成功后发布，失败包不发布部分工具或 handler。
- 远程同步 getter 必须只读取已声明的上下文快照，未公开成员必须明确拒绝，不得猜测补齐。
- 本机与目标运行时必须按包累计全部成功加载入口的命令声明，后续无命令入口不得清除已有声明；Gateway 同名命令桩必须执行所属目标宿主原 handler，不得伪造成功或替换原命令语义。
- `onRemoteExtensionEvent` 与 `onRemoteExtensionGeneration` 必须只观察现有传输，不得改写上游方法或状态。
- 加载错误投影必须复用传输层的失败回调，不得把正常目录探测的宿主关闭事件再次解释为失败。
- 本机与远程桩的 handler 由公开 loader override 返回的 PRK 投影与调用取消赛跑；不得回写 SDK Extension、handler 注册表或运行时方法。
- handler 取消必须交给原生 Pi 错误策略：tool_call 阻止本次执行，tool_result 保留当前结果，其余 handler 报错；不得合成成功或改写后继调用结果。
- `remote-extensions/` 按对象组织；跨对象只导入对象直接层的真实方法或声明，不加再导出入口。同对象职责目录可以互相引用。
- `generation-state.ts`、`host-state.mjs`、`load-state.ts` 与 `memory-state.mjs` 分别持有原作用域的唯一状态；动作显式接收同一 ctx，`assemble-*` 只创建状态、注入能力和绑定方法，启动及加载仍由原入口急切执行。
- 目标源码以 `bundle/runtime-source-manifest.ts` 的 source／destination 清单为准，构建缓存覆盖全部源码正文，两种构建路径均保留目录结构。源码入口 `host/start-host.mjs` 部署为 `host/host.mjs`，沿用宿主进程的 basename 识别；资源短进程入口为 `resources/run-resource-resolver.mjs`。
- 目标通道完整 Python 文件由 `deployment-source/read-python-source.ts` 递归按相对路径排序，根层 `assemble-*` 最后加载，不维护文件顺序清单。装配只绑定模块协议方法，有状态动作显式接收 ctx，无状态 files／skills 不创建类；`TARGET_MODULE_SOURCES` 为产品与测试的唯一部署源码视图，各 wire namespace、线程和虚拟源码文件名不变。
- `target-channel/channels/assemble-channels.ts` 装配唯一机器表与生命周期能力；动作显式接收共享 ctx。每次失败立即拒绝等待调用并退休该代次，不发送 PRK heartbeat/config/ping，也不做后台退避、稳定计时或自动重启；模块业务 tick 保留。
- `target-channel/lease/` 每次 acquire 独立持有 abort、事件／状态订阅和 release Promise；先登记租约再启动，最后一个租约才停止共享机器。失败租约永久绑定旧代次；只有新的 acquire 可创建新代次，旧请求、事件与反向调用不得迁入或重放，没有 retry API。monitor 的采样、focus 续期、重复 session 列表和刷新不得拉起失效代次；新会话准入可重新 acquire。
- `TargetChannelOptions` 含 `startTimeoutMs` 与 `processWindow`；装配统一解析后将有效窗口作为 `TargetChannelDeps.open(machine,signal,processWindow)` 第三参，并注入 runtime-link。open 返回 `{transport,command}`，process bootstrap 或 shell command 必须使用传入预算；监听后才发送 command，按本代 READY 下发内存源码并等待精确版本 hello。现有生产装配仍用 terminal transport，尚未切换 pi-env process。
- `TargetTransport` 的唯一公开契约位于 `target-channel/process-transport/transport-types.ts`；现有 terminal transport、共享通道与 runtime-link 直接引用该声明，不保留旧路径再导出。消费者释放只关闭自身拥有的进程／租约，不结束其他消费者的共享连接。
- runtime-link 使用 `target-environment/process-window` 的唯一窗口实现与全局 `processWindow` 配置（默认32请求、2097152未消费字节、1048576帧字节）；启动源码、目标输入和Gateway收帧同预算。满窗口以类型化 BUSY 拒绝而不排队。目标模块 handle 返回后 re 才确认消费；取消/期限届满不退款，迟到 re 只归还额度；失效代次永久退休。SDK processWrite 的应答不代表消费。
- 新 process transport 的 command 为空，先安装监听后由 process READY 触发原内存源码装配；生产 terminal transport 的 command 和消费者仍保留至 S6，不增加选择开关。
