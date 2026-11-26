# Instances、目标发现与路径

规则：[模块约定](targets.md#约定)、[WEB-8](../contract.md)、[模块约定](targets.md#约定)、[模块约定](../configuration.md#约定)、[模块约定](targets.md#约定)、[模块约定](../configuration.md#约定)。
## Target methods

| Method | Parameters | Result |
| --- | --- | --- |
| `reloadTargets` | `{}` | `WorkbenchSnapshot` |
| `getTarget` | `{target}` | `{id,label,local,tags,sshCommand?,python?,pythonIndexUrl?,bunPackages?,cwd,executionTimeoutMs?,kernel?}` |
| `addTarget` | `{target:ExecutionTargetConfig}` | `WorkbenchSnapshot` |
| `editTarget` | `{target:ExecutionTargetEdit}` | `WorkbenchSnapshot` |
| `deleteTarget` | `{target,confirm:true}` | `WorkbenchSnapshot` |
| `inspectTarget` | `{connection:{local,sshCommand?,python?,cwd?}}` | `{hostname,platform,home,pythonCandidates,python?:{path,version}}` |
| `browseTarget` | `{connection:{local,sshCommand?,cwd?},path}` | `{path,atRoot,entries:[{name,type,path}],truncated}` |

```ts
type ExecutionTargetConfig = {
  id:string; label:string; cwd:string;
  local?:boolean; sshCommand?:string; python?:string; pythonIndexUrl?:string; tags?:string[];
  bunPackages?:{registry:string;scopes?:Record<string,string>};
  executionTimeoutMs?:number;
  kernel?:{memoryMax?:string;memorySwapMax?:string;telemetryIntervalMs?:number};
};
```

Complete definitions live in `<PRK home>/instances.toml`, mode `0600`; global `config.toml` rejects `instances`. Edit may omit cwd and connection/Python fields to retain saved values. PATCH empty `sshCommand` or `python` clears that field; local=true removes the saved command. Omitted Python selects the managed instance environment; a missing remote command is pending configuration. See [configuration](../configuration.md#约定).
`pythonIndexUrl` is the saved instance override only; omit it in PATCH to retain, or pass an empty string to clear and inherit the global default. URLs do not include credentials, query or fragment.
Persisted entries also retain `capabilities` and `customMetrics`. Plugins belong exclusively to native `agent/settings.json` packages; instance plugin lists are rejected. See the [plugin API](plugin-config.md) and [configuration](../configuration.md).

Editable `kernel` reports effective `{memoryMax:string,memorySwapMax:string,telemetryIntervalMs:number}`。
Public target shape 见 [sessions](sessions.md#published-shapes-and-identities)。
`configurationIssue?:{code:"SSH_COMMAND_REQUIRED",message}` is published on pending targets and their session rows. An explicit interpreter is validated when added or changed or its connection changes; pending saves do not connect.

`browseTarget.path` / entry paths 是规范化目标绝对 POSIX 路径；根是 `/`，`atRoot` 只标记 `/`。
Browse lists bounded direct children only; it never reads file bodies. Interpreter selection allows files, followed by inspect with python to verify the actual executable/version (minimum 3.9).
相对引用仅以保存的会话 cwd 解析一次，候选/read 使用同一绝对 path；不展开 `~/`。
Draft inspection works before saving, does not create a session or REPL, and closes its owned discovery lease. Omitted cwd uses `/`; supplied cwd is validated on target. Python checking executes in `/`, independently of the selected workspace. Candidates are discovered executable paths, not a fixed catalog.

The connection command runs verbatim in local `/bin/sh -c`; probe, deployment and daemon exec travel through stdin. Interactive passwords, OTP/MFA menus and taking over a manual login are unsupported. See [target environment](../design-notes/target-environment.md).


## Reference candidates

`nativeAction` `action:"reference-candidates"`，`args:{target,sessionId,path}` → `{candidates,truncated:boolean}`。
`action:"reference-read"`，`args:{target,sessionId,path}` → reference content。

`@` token 最后一个 `/` 之前是目录，之后是 case-insensitive name filter。
空 token 对应 cwd；相对目录以保存 cwd 解析，绝对目录保持目标绝对路径。
Candidate `path` 为目标绝对路径；composer 保留用户键入的相对/绝对拼法，read 不再二次拼 cwd。
Name fragment 以 `.` 开头时返回 matching dot entries；仅目录名含点不改变 children filter。
候选经 pi-env 文档化 `listFiles` 有界递归枚举，再投影当前目录的匹配项；不把递归结果当直接目录扫描。
数量、枚举字节、最终 JSON 字节和时间上限任一截断均透传 `truncated:true`，候选不预读正文。

| `details.reason` | HTTP |
| --- | --- |
| `invalid-path` / `home-unsupported` / `not-directory` | 400 |
| `not-found` | 404 |
| `forbidden` / `unreachable` / `failed` | 503 |

新路径不再产生 `root-unknown`/`out-of-root`；权限和不存在错误不得伪装为空目录。

## HTTP routes

| Route | Body | Wire |
| --- | --- | --- |
| `POST /api/targets/reload` | `{}` | `reloadTargets` |
| `POST /api/targets` | `{target:ExecutionTargetConfig}` | `addTarget` |
| `GET /api/targets/:id` | none | `getTarget` |
| `PATCH /api/targets/:id` | `{target:ExecutionTargetEdit}` | `editTarget` |
| `POST /api/targets/inspect` | `{connection:{local,sshCommand?,python?,cwd?}}` | `inspectTarget` |
| `POST /api/targets/browse` | `{connection:{local,sshCommand?,cwd?},path}` | `browseTarget` |
| `DELETE /api/targets/:target` | `{confirm:true}` | `deleteTarget` |

## 实例环境下发（P6）

`GET /api/targets/:target/environment` → wire `getTargetEnvironment {target}`；只读返回以下快照。
`POST /api/targets/:target/environment`，body `{}` → wire `deployTargetEnvironment {target}`，HTTP 202立即返回快照，启动或共享该实例在途检查/下发；这是手动入口（实例设置的「下发」/「重试」），失败后重发即重试，不续传半文件。会话启动走同一任务，见下文。

显式 Bun 包维护使用同一 POST 的 `{bunPackages:{"<npm name>":"<exact version>"}}`，wire 为 `deployTargetEnvironment {target,bunPackages}`。包集为完整替换清单，限 64 项；需要实例已配置 registry，维护中再次请求报 `BUSY`，不排队。`ready` 意味着目标已完成冻结安装与真实导入，并原子发布，失败保留上一已发布包集。启动中的 Bun 代只在 ready 前读一次当前发布指针，固定到该版本目录。

```ts
type TargetEnvironmentSnapshot = {
  target:string; streamId:string; revision:number;
  status:"idle"|"checking"|"transferring"|"ready"|"failed";
  transferredBytes:number; totalBytes:number; percent:number; bytesPerSecond:number;
  error?:{code:string;message:string;details?:Record<string,unknown>};
};
```

工作台targets行与getTarget返回`environment:TargetEnvironmentSnapshot`。既有集合事件增加`{type:"target_environment_changed",target,timestamp,details:{environment}}`，无sessionId；同连接仍先快照后增量，不开新通道。streamId仅标识该Gateway实例环境状态寿命，revision单调递增；同流旧快照不得覆盖新事件，换流丢弃旧进度，无独立会话或下发持久ID。

- 草稿连接测试/选解释器仍用inspectTarget。保存有效连接的实例立即启动下发；补全/更改连接或解释器同样重新检查下发。仅改cwd/label不触发；pending实例仅建历史、不启动运行时。
- create/wake/reload 先只读缓存检查当前版本：托管 Python、各制品当前 hash 已在 Gateway 制品库且目标已有。全部命中直接继续（快照非 ready 时发布 ready，不经 checking）。任一缺失（含 Gateway 升级后宿主缓存键变化）则调用与 POST 相同的 `deployTargetEnvironment`：没有在途任务就启动，有就加入（`record.pending`），请求在 Gateway 内等待任务结束后再启动运行时。同一实例并发的多个新建/唤醒只触发一次下发，也不在 Gateway 排会话队列。
- 进度只经 `target_environment_changed` 快照发布，没有会话级环境状态；网页新建对话框与会话横幅（「正在准备环境…」）都读所属实例的这份快照。
- 下发结束为 `failed` 时，create/wake/reload 报 `DEPLOYMENT_FAILED`，消息为一句 `Instance environment deployment failed: <原因>`，不带堆栈。create 的 `details:{target,environment}` 带完整快照（原始 `error.code` 如 `TARGET_UNREACHABLE` 及 `details.reason` 保留在 `environment.error`），不创建会话。wake 以 `DEPLOYMENT_FAILED` 和 `details:{submitted:false,stage:"wake",reason}` 拒绝本次输入，会话保持休眠，下次输入再试。目标连接本身在检查阶段就失败时，照旧报连接错误，不进入下发。
- checking时0/0、percent=0；未压缩制品固定gzip -6并按原内容hash缓存，已有tar.gz/tar.xz不重复压缩。totalBytes为本次实际需传的压缩字节；每块pi-env文件写入ACK后累加transferredBytes并按相邻确认采样速率。目标使用shell/gzip解压、校验原SHA-256并发布，ready时percent=100、速率0。失败保留实传量及原因，不回退旧制品。
- 托管目标先在同一下发任务传输 SHA 固定的 uv 与 Python 归档，再由 uv 在 `UV_OFFLINE=1` 下从 `file://` 镜像安装 Python。后续宿主制品扫描沿用同一进度，分母在实际需传的宿主字节确定后更新；`ready` 才达 100%。
- 浏览器/Gateway连接丢失沿既有断线UI将观察中的下发标失败待重连；活Gateway任务不因观察者断开而取消。目标通道失效使任务失败；Gateway重启后的新stream/idle不恢复旧任务；下一次会话启动或手动POST会重新检查并下发。完整已校验制品可命中已有hash缓存，不恢复半文件偏移。
- SDK/插件归档及固定hash的Node可执行文件位于 `targetCacheRoot/remote-extensions`；Bun、rg、fd 和 uv 位于同一根下的 `bin/<sha256>/`。Python 基础环境、镜像、uv 缓存及实例 venv 都在该根下。
- 单包解析/打包失败沿既有插件catalog/runtime状态报告`PLUGIN_BUILD_FAILED`，不加入本次可下发闭包，健康包仍可正常加载；已有打包错误只对同一当前内容hash有效，内容变化后下一次会话启动或手动下发重新构建。环境ready不伪称坏包可用；实际传输/解压/校验失败仍为环境failed且不创建会话。
- assetBegin预创建并登记上传文件及其派生解压暂存名；解压只打开已登记文件，不重新创建。assetAbort/目标关闭同时清理二者，取消后迟启动的exec不能重建暂存；校验成功才原子发布。


## 约定

- 实例变更和 `reloadTargets` 的实例及派生配置必须完整校验并通过活动绑定检查后原子发布。
- 原生工具宿主 bundle 的 Gateway 缓存键只取实际打进 bundle 的内容：`npm query` 选出的包集合（location@version，按 location 排序）、宿主源文件、Gateway 的 Node 版本与目标平台，不含 `package-lock.json` 全文。lock 里无关依赖变化不改键，不重建。宿主插件包的键取 `npm pack --dry-run` 文件清单的内容、平台、Node 版本，以及插件目录自己的 `package-lock.json`；PRK 自身的 lock 不参与。
- 实例变更不得改变路由 ID；PATCH 的 `target.id` 必须与 URL 中的 `:id` 一致。旧字段 `name` 一律拒绝。
- 编辑接口返回保存的 sshCommand 原文；workbench 不发布命令。
- 旧 url/token/defaultKernelName/kernelName 与 kernels 路由必须拒绝，不保留别名。
- 实例增删改及实例能力默认必须只保存 `instances.toml`，不得改写全局 `config.toml`。
- `reloadTargets` 必须加载 `instances.toml`，不得从全局配置读取实例。
- 删除实例配置不得删除会话或内核。
- 浏览和引用必须使用所属目标机的绝对 POSIX 路径；cwd 不可用即失败，不得换 HOME、Gateway 同名目录或分配 kernel 补救。
- 解释器选择必须在目标真实执行并返回实际版本；版本与可执行错误分别使用 python-version、python-executable。
- 主机信息必须来自目标 daemon，不得推断主机名或创建临时 REPL。
- 连接失败必须保留 TARGET_UNREACHABLE 与 connection/deployment/timeout 原因。
