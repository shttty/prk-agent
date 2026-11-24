## 目标文件工具的取舍与限制

关联 [模块约定](../wire/file-tools.md#约定)。
来源：原 `gateway-wire.md:195,204-222,237-256,269-274`。

- 已分配锚点的预置代码、锚点池与偏移接口已直接移除，不留别名。独立哈希行工具只依赖标准库，由调用者持有 `Session`，不与开发套件、内核、网关或搜索进程耦合。
- 加盐后缀不是分配式身份：同文件不同行号的相同文本有相同后缀；12 位可能碰撞。完整表用 64 位值拒绝相对已展示内容发生碰撞的更改，却无法区分刷新后恰好等于当前授权引用的旧字符串或外来字符串。重读未改内容会恢复确定引用，不保证持久代次。
- `read` 逐页扫描，不检查未见尾部；read/edit helper 均可用时，模型提示要求用 `read()` 查看文件、用 `edit()` 定点修改，同一文件的修改合并为一次 `edit()`。`Path` 与 `open` 用于 Python 原始数据处理，不用于查看或定点修改；open/write 也可用于新建文件或整文件重写。超长行即使没有返回全部文本，仍可整行替换；达到行数上限的页面不吞下一行。只有编辑后返回的上下文与差异会授权新行，截断行须另行读取。
- 哈希行对齐先尝试提交的坐标；新近匹配的引用不被相邻的过期展示条目覆盖。
仅失配窗口执行公共前后缀剥离与 `SequenceMatcher` 中段比较；重复的连续上下文、中间插入及超窗口位移都可能使批次冲突。冲突上下文可立即用于重试；缺失表的错误不会暗中触发读取。
- 真实重启或休眠清空展示授权；同进程内重装或清理预置代码保留模块表。整文件写入即使内容相同，也清空该真实路径的授权；编辑成功会平移仍有效的行，不保留旧坐标别名。
- kernel 文件库不再写文件或持有 flock；远程写入由目标通道一次「读、匹配、原子替换」完成，不协调其他进程的写入者。同目录 fsync 与替换不是多文件事务或崩溃恢复事务；符号链接仍指向原真实目标，mode/uid/gid 仅尽力保留，不作权限／属主校验。
- 编辑器检测依据 `Vim v9.1.0000`：`memline.c` 的首块进程标识采用第 24–27 字节的小端序，主机名位于第 68–107 字节；隐藏文件名遵循 `fileio.c` 的 `buf_modname` 规则。相邻交换文件检测无法发现禁用交换文件或使用独立交换目录的 `Vim`。进程已结束、来自其他主机、不可读或格式错误的残留锁不阻塞操作。
- `grep` 只格式化实际命中并计算预算，不保留全文件文本、搜索缓存或第二权威状态；`rg` 可能先输出匹配，之后才遇到空字节，因此适配层会增量校验候选文件。
外部更改可能使返回的引用过期，kernel 编辑时重验；随后目标原生工具再匹配 oldText。两次检查之间与目标读到写之间的竞争窗口仍存在，没有协作锁／事务保证。上下文或数量上限不证明还有额外命中；达到匹配数上限后仍保留请求的后续上下文。
- `glob` 保留二进制文件，不跟随目录符号链接；没有修改时间、多根目录、`find` 别名或分页能力。正向 `rg` 匹配模式会覆盖忽略规则，因此隐藏项排除规则放在最后；启用忽略时，还会对匹配流与遵循普通忽略规则的流做增量交集。流完成或截断后会终止进程、关闭通道并回收进程，不用 `Python` 重写路径匹配或忽略规则，也不积累无界列表。
- `ls` 每次重新扫描、排序以获得精确总数；目录变化可能移动按位置分页的内容。恰好耗尽时不标截断；每页保留完整且带引号转义的名称，没有冻结快照、缓存或游标状态机。
- 文件操作尝试进入开发套件的宿主跟踪；只有真实网关回调产生嵌套开发套件调用，不因辅助函数命名再增加一层跟踪权威。

### 文件工具的既有验证入口

以下是旧文列出的验证材料，本文迁移时没有执行。

公开辅助函数名及跟踪、嵌套调用的归属不变：开发套件的宿主跟踪记录文件系统操作尝试；只有真实网关回调创建嵌套开发套件调用。
合并的 hashedit 运行器中，bash、glob 及场景 cwd 设置同样通过 `createFileKernel().execute()` 驱动真实 SDK 会话，不直接调用 `owner.tool.execute()`；helper 的逐次权限查询需要所属 SDK cell 上下文（[KER-21](../contract.md)）。

代码模式的模拟运行器复制了实际模型提示词中先用 `grep`、再编辑的示例；这不是付费模型能力证据。

覆盖递归模式、`Git` 仓库内彼此独立的隐藏项与忽略开关、稳定相对路径、恰好达到上限与超出一项、硬数量及字节上限、特殊文件名、空结果、错误和 `rg` 不可用。
该验证由完整批次发现，不加入快速批次。

覆盖续页重建、隐藏项、目录后缀、转义名称、空页与恰好达到上限的页面、默认和硬条目上限、`UTF-8` 输出预算、路径缺失或不是目录、非法边界值。
不新增快速批次注册。

## 已实施设计：kernel 文件写入对插件可见

状态：PRK-FILEOUTLET，2026-10-29；跨边界规则见 [KER-13～16、TGT-20～22](../contract.md)，模块输入与结果见 [文件工具](../wire/file-tools.md#原生出口与插件)。

### 原则与公开接入

PRK 文件模式用同名 registerTool 注册 read/edit/write，执行在目标通道；原生模式则排除这些出口，见 [Pi 原生工具](extensions.md#已实施设计pi-原生工具装在远程宿主)。Pi 1.4.0 公开 executeTool 的声明和真实 SDK 路径均确认：嵌套调用 id 为 `<parent>/<n>`、经过原生校验、tool_call/tool_result 和权限链，结果只进父工具的 nestedCalls，不另造历史。

插件兼容面只包括工具名、输入 read `{path,offset?,limit?}`／edit `{path,edits:[{oldText,newText}]}`／write `{path,content}`、isError/content、edit 字符串 diff/patch 与 firstChangedLine。描述、提示片段、渲染器由 PRK 编写，不展开内置定义，不复刻 prepareArguments。自己注册同名文件工具的插件仍与 PRK 出口冲突，二选一。

### 执行位置与数据流

- src/kernel-tools/hashline 只负责读取、展示、校验、定位与刷新；files 注入 host.file_call，通过所属 cell 的 typed callback 调用 SDK executeTool。result:file 返回钩子后的 content/details/isError 及最终输入 path。
- 目标通道 files 模块一次完成本机读取、去 BOM／CRLF 归一、顺序替换、还原第一换行风格和 BOM、同目录临时文件 fsync＋replace。edit/write 返回写后原始 bytes 的 SHA-256 和解析后 path；edit 另有 Pi 形状的 diff/patch/firstChangedLine。文件全文不经过 Gateway。
- 不使用 createEditTool(cwd,{operations}) 或 withFileMutationQueue：它们会使远程 access/read/write 分成多次往返，整文件双向传送，并在 Gateway realpath 目标路径。现有 TargetChannels 的共享租约、模块调度和远程宿主保持原职责，没有增加队列或并发机制。
- 模型直接 read 读取目标页（2000 行／50 KiB）。kernel read 的原生嵌套 execute 根据公开 `<parent>/<n>` 语义只返回一行说明，不获取租约、不读文件。tool_call 的 path/offset/limit 对应 kernel 实际展示页；追加诊断合并到 kernel 输出。若钩子整体替换 content，仍只追加到真实页并记录日志，不接管 kernel 文件展示。

### 匹配、写后格式化与状态

- PRK edit 采用顺序、唯一精确 oldText 匹配，匹配前去前导 BOM、CRLF→LF，裸 CR 为内容；空 oldText 只对空文件有效。模糊匹配不在兼容面。无变化 edit 成功并返回空 diff/patch。kernel 从后向前生成片段，必要时扩大有界未变上下文消除重复文本，不降级为 whole write。
- 钩子改参按实际参数写入；匹配失败就失败。executeTool 返回后 kernel 在目标机本地重读文件，对比写后 SHA-256 和预期内容，使用实际改动更新 diff 与新引用；未变展示行按实际位移保留。插件写后的格式化无需 PRK 实现或传回全文。
- 原 kernel flock、lock_timeout 配置及写文件实现已删除。活 Vim／Emacs 的相邻交换／锁文件检测迁到目标通道；无权限／属主检查。远程 read→write 窗口不保证多进程串行，外部变化只由引用校验与 oldText 匹配尽力发现。

### 模型直接工具与插件位置

唯一 localTools 开关沿用现有保存格式；本机显示「本机工具」、远程显示「原生工具」，均选择 Pi 七工具或 PRK 文件权限。新远程会话默认关；此节描述关闭时的专用 PRK 文件出口，下一请求声明／即时权限规则见 [切换生效与代价](extensions.md#切换生效与代价)。没有第二个开关，也没有远程 Gateway 命令工具。

包未声明位置时，Gateway 打包扫描包自身 JS/TS：字面 tool_call/tool_result 注册或 fs/child_process 导入默认 target，否则 local，结果写入既有记录。显式 pi.location、用户 extensions.locations 优先；辅助文件在扫描范围，依赖／声明／symlink 不在。文本启发式可能匹配注释和字符串，也识别不了计算出的名称，用户覆盖是明确修正入口；没有执行插件来猜位置。

### 大小与兼容范围

回调／目标请求上限 1 MiB UTF-8 JSON；原生结果含 diff/patch 上限 256 KiB；目标 edit/write 文件上限 200 MiB。目标模块先计算、检查有界结果再替换。结果钩子追加到超限时磁盘可能已经写过，按错误返回，不重放。

open、bash 重定向与子进程写入不经过文件出口；管理 code 档的插件应拦 kernel_code。读内容依赖型插件在远程嵌套 read 中得不到原生页正文，需在 target 自行读盘；只对齐元数据与追加诊断，不宣传全插件透明兼容。插件主动将全文写入诊断不在 PRK 无整文件传输保证内。


## S2 工作区目标文件候选

`src/workspace/target-files/assemble-files.ts` 装配文件 CRUD、直接目录浏览及引用；`target-paths/` 负责绝对路径、引用 token 和文档化 listFiles payload 投影。与上述 kernel hashline 出口无关，不替换 Pi 七工具。

- local 与 office 都使用 S1 所有的真实 pi-env daemon Connection；没有 Gateway 本地 fs 旁路。操作获取所属目标 lease，所有 handle 使用原 Reply.session，结束关闭 handle 并释放自己的 lease。
- 使用公开 `Connection.request` 与 pi-env 1.6.0 `docs/protocol.md` 文件操作，不新增目标 fs 协议。Chord 1.6.0 已放宽 ws peer 范围；升级保持既有文件调用路径。
- `opendir/readdir` 小页只读直接子项元数据，数量和 JSON 字节达到预算就停止并返回 truncated。递归引用用已有 listFiles 的目标侧数量/字节/时间预算，并限制候选投影字节，不读取正文。
- 用户明确打开/引用时才 `open` regular file，经打开句柄的 info 预检大小，顺序 bounded pread；最多多取一个溢出检测字节，文件读取中增长不能突破返回上限。UTF-8 原字节保留 BOM/CRLF，invalid UTF-8/NUL 默认 base64，notebook 不解析重写。
- 上传只发送用户内容，write keep 后顺序 writeChunk，finally close；无8深并发框架。fileChunkBytes 可配置且不得越过协议固有上限，实际 JSON+payload 帧另逐次检查。
- copy 用目标原生 cp -R -P，保留 symlink，不经 Gateway 中转正文；同名生成 -CopyN，拒绝把目录复制进自身。rename 用 daemon rename，不跨文件系统复制。目录删除用原生 rmdir，非空目录原子拒绝；symlink 删除链接本身。
- 版本是 `mtime:<mtimeSec*1000+mtimeNsec/1e6>`，保留 JavaScript number 小数，不宣称纳秒精度或 CAS。写前不匹配拒绝；create/rename/copy 的存在性预检仍与外部写入者存在竞态，没有新锁或事务。
- 操作准入达到配置数量立即 BUSY，不缓存请求。操作期限到达通过 lease.retire 退休该共享连接代次：所有旧消费者失效，副作用未确认则 UNKNOWN，不重放；不直接 close 他人的连接、不在 Promise.race 后放任后台累积。

生产 root 与所有实例均使用新目标连接和文件模块；不保留旧装配、双格式 parser 或开关。文件入口只接受绝对路径与不透明 mtime。
