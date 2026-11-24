# Pi SDK Gateway Daemon、Worker 会话与远端 Kernel

现行测试入口见 [测试环境](docs/kernel-recovery.md#test-environment)。旧候选的运行结果是历史记录。

## PLUGMGR：单一原生插件清单（2026-11-18）

- 全部插件只使用 Pi `agent/settings.json` 的 packages 记录，显式 enabled 与唯一 location（gateway 默认 / host）；旧远程面板、实例列表、location优先数组及文本自动分类退出运行契约，无兼容读写。
- 本地目录直链且卸载不删源；远程宿主按当前内容hash复用/更新插件制品，失败仅该包不可用、不退旧版本。SDK及host源码由独立runtime制品提供，不逐插件重复安装/打包。
- 实际provider所有者只在Gateway；包变更保存成功提示restartRequired，重启前保持bootstrap模型和已有会话，普通插件CRUD不碰共享ModelRuntime。
- host命令执行原handler并复用UI通道；同步prepareArguments等公开同步能力结构化UNSUPPORTED/member，仅该包注册清理。按批准P5，VCC/web等相应host矩阵为N/A，前提是其他包正常且Gateway功能通过，不绕schema或双载。
- 单帧传输保持新请求BUSY准入；已接受调用的reply/abort等当前帧完成，不丢控制帧、不重放。Gateway和本机/远端独立宿主、真实插件、受控Hindsight注册及web_search direct/kernel归属证据见当时的任务报告（未随仓库发布）。
- 离线工具 `scripts/migrate-plugin-packages.mjs` 只显式迁移，旧bundle需要经证明的source映射；演练仅自有副本，真实home未迁移。此条取代下方历史的远程包安装/位置契约；后续验收及提交仍须协调授权。

## PRK-PIENV S6：目标环境切换（2026-11-18）

- 实例使用 local:true 自有 daemon 或原文 sshCommand，Python 为实例级绝对可执行路径且最低3.9；删去 Jupyter URL/token/kernelspec 与会话解释器覆盖。待补实例可保存、只读历史与休眠设置可用，执行 submitted:false 并给结构化原因。
- Gateway 顶层与派生会话统一装配 S1–S5：共享目标连接、目标文件、owned PTY、stdlib REPL 与独立目标插件/七工具宿主。location:local 的 Gateway 插件/provider 所有权不变。
- Web/浏览器单独断开保留活 Gateway 资源；Gateway/目标连接丢失作废执行 handle，下一明确输入创建空 REPL，不认领旧namespace、不后台重连、不重放。recoverSession仅auto/new，new显式target。
- 专用离线 scripts/migrate-pienv.mjs 全量预检旧split TOML和SDK各分支PRK元数据，先staging、一次备份、逐文件原子替换；不改SDK信封/链/正文。prk-python从真实旧spec读取绝对解释器，缺失或不可读待补；远端命令不猜。
- 普通运行只接受新schema；安装入口调用专用迁移。旧JSON→TOML工具使用当前parser，不能串联迁移旧Jupyter JSON。本节取代下方历史条目中的旧执行选择/接回语义，历史验证记录保留。
- 实例表单复用inspect/browse与目录picker：连接测试、目标可执行文件选择、真实版本校验；只读选择/归档/休眠设置不唤醒。真实副本与浏览器证据、断言迁移和最终门禁状态见当时的 S6 任务报告与账本（未随仓库发布）；不授权生产部署。

## PRK-TOML：人写配置改为 TOML（2026-11-16）

- PRK home 的全局／实例配置只读 `config.toml`、`instances.toml`，kernel 清单只读 `prk-tool.toml` / `<name>.prk-tool.toml`；值校验、默认值和特殊键名保持。SDK、插件、项目 `.prk/settings.json` 与 PRK 生成的状态文件继续 JSON。
- Gateway 发现旧 `config.json` 或 `instances.json` 必须拒绝启动并指向显式迁移；旧 kernel JSON 清单只使该模块报错，不双读、不回退、不在启动时迁移。
- 设置写回用已有 `smol-toml` 重建，首行说明 PRK 设置页写回且不保留注释；按服务端本次读取的 hash 在原子替换前检查磁盘，冲突报 `CONFLICT`，客户端协议不加参数。实例仍为 0600，全局仍按 umask。
- `kernelTools` 覆盖在 Gateway 配置入口一次性递归拒绝所有 null（含数组元素）；Python 合并／冻结不改，能力 API `enabled:null` 仍删除覆盖键。
- `node scripts/migrate-config-toml.mjs --home /absolute/owned-copy` 仅转换两份主目录文档；绝对 `--home` 必填、无环境默认，先整体校验新解析器及 TOML 往返语义，再保留 `*.json.before-toml` 备份；重复运行无改动，输出 JSON 摘要。迁移与重启必须走操作者另行授权的离线副本／部署流程。

## PRK-SELECTBLUE-R2：下拉与列表蓝色高亮（2026-11-04）

- 浅深色悬停统一读取 `--pi-hover`；Mantine 菜单、Combobox／Select 悬停或键盘当前项和命令列表当前项统一读取 `--pi-selected`，继续支持主题导入／导出。
- 浅色高亮底色为 `#DCE8F6`，`faint` 调为 `#666561`，保证所有文字 token 在检查 surface 上对比度不低于 4.5；Select 同时覆盖实际输出的 `mantine-Select-option` 与 `data-checked`。
- Combobox／Select 当前生效项（`data-combobox-active`／`data-checked`）背景透明，仅使用 `--pi-accent-strong` 文字与 600 字重；只有悬停或键盘导航项（`data-combobox-selected`）显示 `--pi-selected` 背景，生效项在这两种状态下仍保留强调色文字。Mantine 的 `active` 表示已生效值，`selected` 表示键盘导航位置，不反向使用。

## PRK-SESSMSG：会话通信与固定控制权（2026-11-02）

- 当前工具仅 session_spawn / session_send / session_result / session_list / session_manage，均由进程内 sessions 扩展工厂注册，不保留旧工具别名。前三个常驻、后两个延迟的部署默认由全局 `session.capabilities` 配置；插件本身沿用通用插件默认值，分组与配置见 `docs/configuration.md`。
- 消息、转交提议和结果共用有界内存收件箱。steer 在 turn_end，followUp 在 SDK 整轮边界，abort 中断当前工具后合并积压开启新轮，保留 kernel 与变量。
- 结果先写当前父会话原生 receipt，phase=delivered 后等待 temporary 子会话当前 SDK 运行正常结束，再停止归档；成功提交终态为 completed。删除 acknowledge，不自动重放。转交须接收方显式接受，createdBy 不变；定向 pendingOwner 的 accept 不授予其他控制权。
- abort 和管理只允许祖先、全局 local root 或同项目 supervisor；用户 API 不受限。root 唯一持久化，每项目 supervisor 唯一且离开后由最早存活成员接任；模型指定 supervisor 只允许 root。
- 本节取代下文历史的「项目不授予管理权」、销毁授权委派、结果确认及旧会话工具说明。项目仍可有多个顶层会话；IM 与完整前端接入不在本单。设计理由见 docs/design-notes/sessions.md；公开字段与接口见 docs/wire/native.md 与 docs/wire/sessions.md。

## PRK-TREE-B5：Gateway 对象树迁移（2026-11-01）

- `src/gateway/` 按宿主、会话准入／生命周期、稳定路由绑定、只读视图、资源接线及 Unix 协议对象划分；共享状态归唯一宿主 ctx，SDK 会话、历史与排队仍由原实现拥有。
- 保留原初始化、订阅与关闭顺序，跨 await 的局部捕获、代次校验、休眠／唤醒、kernel 接回、cwd 继承及 transient BUSY 语义不变；wire 与用户可见接口不变。
- 对象入口及内部约定见 [会话](docs/wire/sessions.md#约定) 与 [传输](docs/wire/transport.md#约定)；纯搬家、独立优化、三轮测试和接手题见当时的任务报告（未随仓库发布）。
- 独立优化只删除 `workerSession → storedSession` 的纯转发层及登记；工作区直接使用同一受管／未归档会话校验，错误、同步准入和 transient BUSY 顺序不变。

## PRK-TREE-B4：workers 与 HTTP 对象树迁移（2026-11-01）

- 实例目标配置迁入 `src/config/worker-target/`；配置解析、默认值、校验错误和调用者行为保持不变。
- 派生配置迁入 `src/config/derivation/`；角色、模型和思考等级的选择顺序及不可用错误保持不变。
- 派生生命周期迁入 `src/workers/derivation/`；同一 ctx 保留原 busy／closing 集合，所有权、回执与结果继续读取 SDK 历史，工具顺序和可重入发布后确认顺序保持不变。
- 运行时集合迁入 `src/workers/collection/`；原记录、单飞启动、绑定比较、观察订阅、重载及关闭顺序保留在同一集合 ctx，`list` 与 `snapshot` 仍是同一函数视图。
- SDK 会话运行时迁入 `src/workers/runtime/`；原共享状态归唯一 runtime ctx，每次装入的捕获值归该次 conversation ctx，保留 SDK／kernel 权威、资源发现和清理次序。技能路径去重函数仅显式化 ctx，不改函数体逻辑；kernel 观察类型归 `src/jupyter/kernel/kernel-types.ts`。
- Web HTTP／SSE、Gateway 客户端与终端连接按对象和稳定职责迁入 `src/http/`，原 Origin 校验、流顺序与资源归属不变；阶段提交、测试对照和接手题见当时的任务报告（未随仓库发布）。

## PRK-TREE-B3：目标通道与工作区对象树迁移（2026-11-01）

- 将共享目标通道、租约、传输、目标 Python 静态源码，以及工作区文件与终端拆入对象和稳定职责；通信、取消、资源归属和初始化顺序沿用原实现。
- 目标 Python 源按显式清单以原序拼接，各 wire 模块保留独立 namespace 与线程；类方法片段保留原缩进，以保持完整下发源码和 bootstrap 字节不变。阶段提交、测试和接手题见当时的任务报告（未随仓库发布）。

## PRK-TREE-B2：代码模式与 Jupyter 对象树迁移（2026-11-01）

- 将 codemode 的协议、二进制交付、目录／载荷、工具库及 kernel prelude／loader／SDK，以及 Jupyter 的连接、发现、目标引用和 kernel 迁入对象树；状态、取消、清理、错误与调用顺序保持原语义。
- Python 源片段由显式清单按原顺序拼接到既有 namespace；原类与闭包、虚拟文件名和 linecache 保持不变。起点与纯搬家提交、逐项测试及偏离见当时的任务报告（未随仓库发布）。

## PRK-TREE-B1：首批对象树迁移（2026-11-01）

- 将 config／home、shared 错误诊断、artifacts、monitor、kernel-tools 与 main 命令选择迁入 R3 对象树；其他模块仅调整本批消费者的 import 和源码清单，根层保留 `src/main.ts` 进程入口。
- 共享状态显式 ctx，装配入口使用 assemble；Python 保留原工具函数身份、唯一 Session、目标模块 namespace 与有序源码清单，不新增 loader 或 SDK 状态。
- 纯搬家提交与内部优化分开；结构偏离、逐文件三轮测试、既有失败、环境问题和冻结 before/after 见当时的任务报告（未随仓库发布）。四模块接手题草稿随该报告保存，未运行真实模型实验。

## PRK-RELOADFIX：重载提示不消失回归（2026-10-31）

- `edc7b0c` 移除了本机目标扫描与 Gateway home skill 的去重；同一绝对路径同时进入项目与全局候选，目录项自覆盖，导致重载后 `requiresReload` 仍为 true。
- 恢复 Gateway home skill 的单一全局归属，同时排除重复的本机项目分组；不改变目标项目覆盖、prompt 仅 cwd 或 skill 向上到 git 根的查找规则。
- 新增聚焦用例，真实 Gateway／SDK／目标通道重载，单个 skill 最小 fixture 已先红后绿。验收结果见当时的任务报告（未随仓库发布）。

## PRK-PILOT：remote-extensions 对象树试点（2026-10-31）

- 将 `src/remote-extensions/` 的平铺源码拆为 14 个对象；跨对象引用落在公开层，代次、宿主、单次加载与遥测分别使用显式 ctx 和真实装配入口，不新增 SDK 权威状态，不修改算法、错误文案或测试断言。
- 宿主与资源解析器沿完整源码清单下发；启动入口上移到 `host/start-host.mjs`，部署名保留 `host/host.mjs`。模块约定见 [远程扩展](docs/wire/plugin-config.md#约定)，偏离与逐文件测试计数见当时的任务报告（未随仓库发布）。

## PRK-DEADCODE：目录重构前死代码清理（2026-10-31）

- Knip 分别扫描完整产品入口与含 tests 的入口图，Vulture 扫描目标通道、kernel-tools 与 codemode；动态回调、源码下发入口和配对声明逐项核实后保留，候选处理清单见当时的任务记录（未随仓库发布）。
- 删除无消费者的导出、死类型／局部校验器和失效 CSS；测试专用 Jupyter 配置发现迁入既有 fixture，hashline 参考值 oracle 迁入当时的测试夹具，产品 Session 行为与断言保留。
- 仅删除 Web 的 `dockview` 直接依赖声明，运行依赖继续由 `dockview-react` 提供；未发现无运行时消费者的配置键。跨边界行为不变，`docs/contract.md` 无待删除条目。
- 聚焦测试、桌面／手机实际渲染及最终 quick 结果见当时的任务报告（未随仓库发布）；不跑 full、不 push、不合入或重启 daily。

## PRK-HOSTSLIM：远程宿主瘦身（2026-10-31）

- 无 target 插件时只加载 Pi 1.4.0 的 tools/event-bus 内部模块，精确版本闸门拒绝未复核版本，不回退整包；有插件时仍用公开包根。沿用不可变 bundle 的完整锁定依赖，不修改 Pi。
- 当时的聚焦验收以自有包根执行信号验证无插件不执行入口、真实 read/bash、插件总线和版本错误；接缝见 `docs/pi-sdk/README.md`。
- `remoteHost.runtime` 默认 bun，可切 node；`bunArgs` 默认 `["--smol"]`，`nodeArgs` 仍默认 `["--optimize-for-size"]`。Bun 从 `tools.bun` 按目标平台下发，缺少制品不回退系统运行时；生产制品库不在本任务变更范围。
- ANS1／ANS2：Node/Bun 统一用公开 Unix socket，移除继承 fd；`$XDG_RUNTIME_DIR`（未设置则 `/tmp`）下短前缀 mkdtemp，单次 accept 后 unlink/关 listener，退出／启动失败 rmtree；不加权限、属主或残留扫描检查。
- smol 默认值按五轮双 scope 复现中工具宿主的最低边际内存选取；四格内存与热启动、逐项验收和环境失败记录见当时的任务报告（未随仓库发布），不宣称已验证 Bun 1.4.4 或 aarch64。

## PRK-HOSTSTOP：会话宿主、独立 scope 与钩子停止（2026-10-30）

- 每会话每目标机一个 Node 宿主，Pi 原生七工具与全部 target 包共享 Pi 原装事件总线；状态／错误／来源仍按包投影。宿主独立 systemd user scope，默认 MemoryMax=1 GiB、MemorySwapMax=0；缺少前置条件明确失败，退出／重载／释放清空整个 scope，含 setsid 子进程。
- 远程 event 与 execute 无固定期限，load／snapshot／shutdown 保留控制期限；停止作废挂起钩子、发送 abort 并丢弃迟到结果，Pi 原生 handler 抛错语义不变。本机通过公开 loader override 返回独立 handler 投影与 abort 赛跑，不改 SDK 本体或运行时对象。
- abort 回执默认 5 秒未到时停止旧 scope，经现有 Gateway 重载替换会话宿主／streamId，重新 session_start；同一 SessionManager／JSONL／kernel 保留，在途结果未知且不重放，其他会话和共享目标通道不换代。配置为 `remoteHost.{memoryMax,memorySwapMax,abortTimeoutMs,nodeArgs}`。
- STEER1 后端提供 `workers[].monitor.remoteHost`（running／replacing／failed，空为 null），memory 与 kernel 同形且按代次计数；宿主自采样 current-inactive_file、memory.max 与 oom_kill，经已有目标通道／session_monitor 发布。宿主显式 OOMPolicy=continue，内存硬上限不变；Node 被杀时只保留实测末值。网页行留给后续前端，字段见 [wire](docs/wire/kernel.md#monitor)。
- R2：`remoteHost.nodeArgs` 默认 `["--optimize-for-size"]`，空数组关闭额外启动参数；由既有目标通道传到 scope 内的 Node argv，不影响 Gateway／kernel。已 rebase 到冻结的 daily `7ad558a`，保留 Gateway 重启与基准脚本；135 条契约、七项指定运行时回归与 quick 在最终基准全部重跑通过（47.9 秒）。三轮真实原生宿主 RSS 对比与完整证据见累计报告。
- R1 验收：check-contract 131 条／153 行有效，quick 全绿 49.6 秒；full 139 项通过，仅任务书已知 check-web-history 保留 1 红（2874.3 秒）。原远程核心／UI、native、生命周期、fileoutlet、停止换代与宿主遥测均通过；首轮新增 5 项回归已通过实现修正转绿，未放宽原断言。独立 Web 复测曾因漏设 PRK_HOME 触及默认配置读取边界，违规及纠正完整记入报告，不宣称全程零接触生产配置。
- 设计见 [已实施说明](docs/design-notes.md#已实施设计远程宿主按会话合并独立-scope-与钩子停止)，累计验收、断言逐条变更与待决定事项见当时的任务报告（未随仓库发布）。零付费、不 push／合入／重启 daily；本机同步死循环不在本阶段隔离范围。


## PRK-FILEOUTLET：目标文件原生工具与插件出口（2026-10-29）

- 远程会话同名注册 PRK read/edit/write，经共享目标通道一次就地执行；只对齐插件可见输入与原生 diff/patch 结果。整文件不经 Gateway 往返；直接 read 有界返回模型页，kernel 嵌套 read 仅传实际页元数据与插件追加结果。
- kernel hashline 保留展示表、64 位校验与对齐，写入改走公开 executeTool；钩子拦截／改参／追加结果生效，写后本地 SHA-256 比对与实际 diff 刷新格式化引用。kernel flock、lock_timeout 与旧写入实现删除，无第二队列／锁。本机 local:true 保持 Pi 实现但同样有原生嵌套事件。
- 同一 localTools 开关：本机七项「本机工具」，远程三项「原生工具」，远程默认关、显式开后模型可直接用目标 read/edit/write；不开放 Gateway 命令工具。取代旧远程拒绝开关及 kernel 文件修改无插件事件的历史决策。
- 包位置在 Gateway 打包时按包内字面文件钩子／fs／child_process 代码静态判定一次并保存，target/local 显式覆盖优先。文本启发式的动态名称漏判和注释／字符串误判边界写入配置文档，无新依赖或执行插件来判定。
- 设计与输入结果见 [已实施设计](docs/design-notes.md#已实施设计kernel-文件写入对插件可见) 与 [文件工具](docs/wire/file-tools.md#原生出口与插件)。累计测试、每调用传输内容／上限、断言删改和待决定事项见当时的任务报告（未随仓库发布）。零付费，不 push／合入／重启 daily。

## PRK-CREDS：实例连接文件与权限收敛（2026-10-29）

- 全部实例字段统一移到主目录唯一的 `instances.toml`，0600；`config.toml` 只留全局设置，拒绝 `instances` 和实例字段，不兼容读取、不自动迁移。
- 实例及实例能力保存只原子替换 `instances.toml`，全局设置只原子替换默认权限的 `config.toml`；不需要联合写入或回滚。读取接口不回传 token，URL 回传及空 token 沿用规则保持。
- 配置与历史目录遵循 umask，历史真实路径/inode 守卫保留；Web 取消绑定 host 范围限制，端口与请求 Host/Origin 检查保留。
- 已接入 daily 的实例 `remoteExtensions` 一并保存在 `instances.toml`；全局 `extensions.locations`／`extensions.defaultRemote` 留在 `config.toml`。远程扩展保存不得把实例包与全局位置映射混在同一次写请求中；各自保存，不新增跨文件事务。

## PRK-DESEC：收敛单用户安全边界（2026-10-29）

- 删除 Gateway 发布层全量脱敏，快照、事件与结果不再因凭据匹配而改写内容；按 STEER4，插件配置保留服务端 mask，删除 reveal 全链和网页显示按钮，秘密字段空串／掩码沿用旧值、新值覆盖。实例 token 不回传、网址未变时省略／空 token 沿用旧值的行为及测试不变，公开工作台列表不新增 token。
- Unix socket 父目录按默认权限递归创建，不检查 mode／uid／realpath，客户端不做 lstat；已有路径能连接则拒启，不能连接时只清理 lstat 确认的 socket，非 socket 路径保留并拒启，保留路径长度上限。
- 通信契约仅删除全量脱敏、持久化凭据与 socket 权限的指定旧条款，不新增规则、不重编号；Origin／Fetch-Metadata、大小上限与制品 SHA-256 不变。

## PRK-WEBSTATE：网页会话状态容器（2026-10-29）

- Gateway/socket/HTTP/SSE 与网页已接入 `streamId`，移除 HostedExtensionUI `generation`；网页瞬态字段迁入 `state.session`，用户输入继续用既有 session-storage。
- 忙碌状态按工作台/会话所有者统一为 `pending` Set，目录/候选读取统一 `{value,loading,error}`；根状态 54→17 字段，会话容器 27 字段。四场景复测和 当时的冒烟检查通过，完整门禁结果以任务报告为准。
- 真实 Gateway/Jupyter/Chromium＋faux 用例覆盖进程重启、原生重载、乱序帧和 A→B→A；daily 前两项红，候选四项通过。已 rebase `daily 965c3c3`，逐计数器规则集中于 `docs/contract.md` ORD-9～19，拆分 wire 文档不再保留界面 generation 规则。
- 收尾 `check-contract` 通过（103 条、125/250 行），当时的冒烟检查通过（45.6 秒）；旧的全量检查只跑一次，13 红中的两项 tool-bodies 夹具与一项流式停止回归已聚焦转绿，其余 10 项已有或已在 pristine daily 复现，不宣称 full 全绿。停止回归通过宿主状态增量携带权威 operation 投影修复，不放行旧快照或另建执行状态。
- 分阶段证据、字段对照、完整验收与待决定事项见当时的任务报告（未随仓库发布）。不 push／合入／重启 daily。

## PRK-REMOTE-EXT：远程扩展正式接入（2026-10-29，功能验收完成）

- 基于已合入原型补齐包位置、默认／实例安装列表、Gateway 锁定制品构建与共享 TargetChannels 接线；沿用原生 SDK 会话、三层工具开关与重载生效机制。`local:true` 的 target 插件就地加载。
- 范围限工具／事件与已验证 RPC UI 子集；`ui.theme` 明确不支持并日志，kernel 写后合成事件不做。Linux aarch64 仅合同，不声称实机通过。
- 已 rebase daily `d0e88e5`：沿用 `streamId`／`state.session`，删除 worker 时间戳 UI revision 方案与重复重启测试；跨进程规则归 `docs/contract.md`，字段和模块约定归 `docs/wire/`。远程执行代次只负责目标进程与回调归属。
- 正式 core、RPC UI／管理、四场景 stream-state、capability-switches、capability-ui、tool-artifacts 和最终 quick 通过；真实故障注入确认正常 catalog 关闭不误报，SIGKILL 仍报未知结果。最终 quick 46.3 秒，超过既定 30 秒目标；未增加 quick 注册或扩做门禁优化。未跑 full、未实测 aarch64。
- 配置、数据流、三张桌面／手机截图、累计失败与修正、删除清单和待决定事项见当时的任务报告（未随仓库发布）。零付费，不 push／合入／重启 daily。

## PRK-FILETOOLS：kernel 文件模块与加盐行引用（2026-10-29）

- `read/edit/write/grep` 通过 A loader 自动加载为 `prk_tools.files`，复用标准库纯库 `prk_tools.hashline`。工具页、开关、真实签名与模型说明统一来自 inspect catalog；冷目录只列待加载模块。旧 prelude 15–18、分配池／kernel seed／步长／累计 next、全文身份表及 anchor offset 全删，无兼容层。
- 引用 `N#hhh│内容`：默认 BLAKE2b(realpath + NUL + 行内容) 前 12 bit，展示表只存实际返回行号及前 64 bit；LF／CRLF 分隔符不参与，裸 CR 是内容。read 流式分页即停、2000 行／50 KiB，total_lines 到 EOF 才知道；grep 用 SDK tool_bin('rg')，只把实际命中／上下文交给纯库登记。
- edit 的 replace.start/end 与 insert.ref 都用 N#hhh；区间中每行必须展示且全 64 bit 仍匹配。被引用行原位全匹配即编辑；否则取连续展示窗口在 ±K 对齐（默认 2000），剥相同首尾＋SequenceMatcher(autojunk=False)；映射不唯一／中间行变化则整批拒绝，返回可直接 edit 的最新上下文。自身编辑平移展示坐标，diff 新行／上下文立即可用；write 清该文件表，真正 restart／休眠后先 read。
- `kernelTools.files` 默认 align_window=2000、max_edit_bytes=209715200、lock_timeout=10 秒，均走 A 配置边界。edit 上限不影响 read/grep。edit/write 使用目标机 `~/.cache/prk/locks/<sha256(realpath)>.lock` 排他 flock，锁内重读／校验，再同目录同权限临时文件 fsync＋replace；可保留的 uid/gid、BOM／LF/CRLF 保留。whole-write payload 决定 EOF；edit 保持原 EOF，但逻辑结果末行为空时允许补上末尾换行，diff 如实返回逻辑行（PRK-EOFEDIT）。
- 锁内检查相邻 Vim swap 与 Emacs 锁链接，本机存活 PID 拒绝；残留、不可解析和外机锁不阻塞。Vim 公开格式出处、协作锁边界、短 hash 碰撞和 EOF 空行语义见 [wire 契约](docs/wire/file-tools.md#salted-hashlines)。不另造 epoch、持久身份或恢复状态机。
- 验证只用标准库真文件、隔离真实 Jupyter／Gateway／faux／浏览器，零付费；先红后改。最终验收前已按用户要求 rebase daily（Pi SDK 1.4.0）并重新真装根目录／web 依赖。逐项结果、2 百万行 RSS、o200k 数字、删除断言覆盖及待用户决定见当时的任务报告（未随仓库发布）。不 push／合入／重启 daily。
- 最终指定检查全部通过：纯库 45 例、hashedit／grep／filetools-contract／glob／tool-modules／codemode／capability-switches／capability-ui，以及冒烟检查。真实 200 万行、54 MB 文件最后 20 行读取 RSS 增加 4096 bytes，peak 增加 0；双 kernel 不同行两处均保留，同一行一个成功一个校验拒绝。quick 45.6 秒，超既定 30 秒目标，未新增 quick 注册或扩大调度修改范围。

## PRK-REMOTE-EXT-PROTO：远程扩展宿主原型（2026-10-29，不上线）

- 仅在 `proto/remote-ext-host` 验证工具／会话事件代理：复用 target-channel 隐藏 Jupyter terminal 和 manifest/store 制品；每个 session generation 独立 Node 子进程，原版 `@narumitw/pi-lsp@0.49.11` 在目标机运行。
- Gateway 原生 Pi 保持会话、权限与事件链权威；按 STEER1 改为远端 `mode='rpc'、hasUI=true`，数据 UI／四种对话框转既有网页，组件能力按 Pi RPC 不支持语义记录日志；`ui.theme` 的公开保真接缝缺口单列报告。同步 getters 限定快照支持范围。无远端命令执行、provider、TUI 或 kernel 写文件合成事件。
- 分阶段证据与未决项见当时的任务报告（未随仓库发布）。不 push／合并／重启 daily；最终验收前按用户追加指令 rebase daily 的 Pi SDK 1.4.0 并重装两处依赖。
- 最终已再次 rebase daily（`7a0aa17`，含 `eecc9f0` 文件工具与 Pi SDK 1.4.0），重装 root/web。真实目标通道＋原版 pi-lsp 核心八项通过，真实网页 RPC UI 24 次调用通过（129.34s），独立浏览器 confirm 回传 target=true；当时的冒烟检查全过（47.3s，超过 30s 目标，未新增 quick 项）。`ui.theme` 保真公开接缝仍 BLOCKED；正式 Gateway 配置／共享通道生产接线不在本原型内。未实现 kernel 写后合成事件，未恢复旧 prelude。

## PRK-TOOLMOD A：kernel 模块宿主（2026-10-29，含 STEER1／STEER2）

- 工具模块来源为仓库 `src/kernel-tools/` 与 `<PRK home>/kernel-tools/`；用户同名包完整覆盖内置。新 kernel 经项目 loader 注入真正 `prk_tools.<name>` 模块，模块间普通 import 公开 API，仅经 `prk_tool` SDK 访问宿主；Gateway 不执行模块代码。
- 显式 `@prk_tool.tool` 导出同步函数，kernel inspect 签名／docstring 上报为实际 catalog。无 kernel 时静态列旧 helper 与待加载模块，不猜函数签名、不为目录启动 kernel。运行报告按 home／实例内存缓存；工具页、模型说明和既有能力开关共用此目录，模块错误独立显示。
- SDK 提供 config、tool_bin、Gateway 回调、trace 与 UI-only progress。模块配置为 `kernelTools.<模块名>`，默认配置在 import 边界合并校验；同进程 prelude 重装保留模块与内存，源码／配置变更重启 kernel 生效。二进制依赖复用 manifest/store＋stdin SHA256 下发，不建第二套存储。
- STEER1：不限制只能标准库；允许成熟 Python 包／二进制依赖。Python wheel 分发本阶段按授权延期，保留声明并明确报该模块不可用；纯 Python wheel、兼容标签、目标缓存及后续复用制品协议方案见 [模块契约](docs/kernel-tools.md)。没有联网 pip 或伪安装成功。
- A 阶段 STEER2 当时暂停文件工具；现由上方获批 PRK-FILETOOLS 一次性迁移取代。bash/glob/ls/phase/tool_bin/memory/namespace/trace/library 仍不迁移；模型生成工具统一包格式及 staging／转正／使用计数方案仍只写契约。
- A 的历史验证使用隔离真实 Jupyter／Gateway／faux、工具开关／工具页及冒烟检查；不付费、不 push／合入、不重启 daily。历史暂停草稿不作为 B 验收成果。
- A 候选验收全部通过：新 tool-modules 真实链路 6.57 秒、capability-switches 5.24 秒、完整 capability-ui（含实例 mock 前置 smoke）142.98 秒、最终 config 6.31 秒；quick 全通过 49.9 秒，超 30 秒目标但未新增 quick 注册／改调度。独立浏览器打开真实自有 UI，验证模块成功／失败目录、错误详情及开关状态；截图与逐次失败／fixture 修正记录见当时的任务报告（未随仓库发布）。仅修正既有 mock 缺失的 monitor history/focus 与 themes/list 契约，未删基线断言。

## PRK-TERMTAIL A：bash／terminal 返回字段（2026-10-29）

- 共有字段统一 `exit_code`／`duration_ms`／`truncated`；现有前两项已同名，bash 补 `truncated:false`，继续返回分开的原样 stdout／stderr 与 timed_out。terminal 保留 cwd／status；无旧名别名、无输出文件及 full_output_path。
- 聚焦验证沿用真实 Jupyter 的 `check-kernel-bash.mjs` 与 SDK／Gateway／faux 的 `check-terminal-long-lines.mjs`，明确检查实际结果字段、两路文本及旧名缺席；不增加 quick 注册，不改 Pi 原生本机 bash。

## PRK-TERMTAIL B：模型终端说明（2026-10-29）

- bash stdin 关闭／prompt 用 terminal_send 已在真实模型系统提示中，保持原文；terminal_send／terminal_read 的工具描述明确回答输入或等待时填预计剩余 yield_s，随后结束本轮等 completion／quiet 事件、不轮询。仅改描述，不改执行与事件行为。
- faux provider 验证实际 tools／system prompt：direct 与 code 均收到 bash 约束，两个终端工具都有剩余等待与事件约束；terminal_send 参数仍为 text、没有 command，不增加参数别名。

## PRK-TERMTAIL C：kernel_code 通用精简（2026-10-29）

- 模型 content 复用 `terminal-output.ts`：去 ANSI、CR 进度最后状态、连续重复 ×N／空行折叠、长行及整体头尾截断，再附既有变量摘要／内存行。阈值复用 terminal.outputBytes／longLine*；不增加配置常量。
- Jupyter 原始捕获仍按 maxOutputChars 有界，但从只保留头改为头＋最新尾；捕获缺口以源 UTF-16 字数接入同一精简器，标记保持原子、不被长行截断吞掉，也不伪造 terminal_read／offset。只在与模型文本不同时附 details.rawOutput（有界 ANSI 原文＋相同摘要），网页显示／懒加载预览优先读它。
- 当时的聚焦用例通过真实 SDK／Gateway／Jupyter／Vite／Chromium＋faux：模型与网页分流、长 traceback 尾、CR／×N／空行、Unicode 长行省略计数、无重复原文、变量与内存后缀、懒加载及刷新后 ANSI 语义色。纯函数追加 CR 原文坐标与有界缺口原子性；不新增 quick 注册，不运行 full、不部署 daily。
- 候选验收：真实 kernel-output 可见性版 10.84 秒、共享输出纯函数 12/12、累计终端长行／字段／说明 5.18 秒、已修改 Jupyter 捕获用例 12.38 秒均通过；冒烟检查全通过，42.5 秒（超既定 30 秒目标，未新增 quick 注册／调整调度）。完整证据见当时的任务报告（未随仓库发布）；不合入、不 push、不重启 daily。

## PRK-LS：kernel 目录分页（2026-10-29）

- `ls(path=".", offset=1, limit=500)` 替换旧列表返回，结构为 entries/total/truncated/next_offset；只列目标机直接子项，含隐藏项和 ignored 项，按原始名称大小写敏感排序，目录（含指向目录的 symlink）加 `/`。
- Python 标准库 `os.scandir`；默认 500、封顶 2000 项／50×1024 UTF-8 字节含提示。print 逐行转义名字，截断返回下一项的 1-based offset；保持同一路径续读，不承诺目录变化时的快照稳定性。无递归树、mtime、彩色、stat 表或 rg 依赖。
- 已有调用者改读 entries，模型说明与 [wire 契约](docs/wire/file-tools.md#directory-listing) 同步。真实 SDK/Gateway/Jupyter 的 `check-kernel-codemode.mjs` 加聚焦分页用例，改前先确认红测；不新增 quick 注册，不动 Pi 原生 Gateway-host ls。

## PRK-GLOB：kernel 文件路径查找（2026-10-29）

- 新增 `glob(pattern, path=".", hidden=False, gitignore=True, limit=100)`，独立 prelude `19-glob.py`；模型说明补用法，沿用现有 helper 静态发现与能力开关，不新增 Gateway 工具或 find 同义工具。
- 后端仅 `tool_bin('rg')` 的 argv `rg --files --glob`，无 shell／Python／PATH 回退。只列文件，返回相对根的标准化路径；`**` 跨零或多层目录，按 rg `--sort=path` 的稳定逐目录路径顺序，不按 mtime。
- 隐藏项默认排除、ignore 默认遵守；`.git` 始终排除，不跟随目录 symlink。rg 正向 glob 会覆盖 ignore，因此默认将两个排序 rg 流（glob 命中／遵守 ignore 的清单）增量求交，不自行解析规则；`gitignore=False` 直接 `--no-ignore` 单流。
- 结果映射为 files/truncated/limit_reached/output_limited，打印逐行路径；默认 100、封顶 1000、50×1024 UTF-8 字节含提示。额外取一项确认真的截断，恰好 limit 项不误报；无结果 files=[]，缺路径／非法模式／无 rg 抛异常。详见 [wire 契约](docs/wire/file-tools.md#glob)。
- 当时的聚焦用例通过隔离真实 Jupyter 与真实 rg，下发复用现有通道。候选任务不付费、不 push／合入／重启 daily。

## PRK-GREP：目录搜索与可编辑锚点（2026-10-29）

- kernel `grep(pattern, path=".", glob=None, ignore_case=False, literal=False, context=0, limit=100)` 完全替换旧单文件 Python re/tuple 实现；使用 `tool_bin('rg')` 下发的 rg JSON，不写 Python/PATH 回退。文件/目录共用，保留 rg 默认 ignore、隐藏和二进制规则（`.gitignore` 通常要求 Git 仓库）；错误抛异常，无命中返回正常空结果。
- 命中与上下文现在复用 `prk_tools.files` 的稀疏 hashline 展示表，实际返回行可直接 edit，未返回行不授权。结果按文件分组，结构为 files/path/lines 及 number/ref/text/match/truncated/omitted_chars，聚合 matches/truncated/limit_reached/output_limited，详见 [wire 契约](docs/wire/file-tools.md#hashline-grep)。
- context 封顶 10，默认 100 命中、limit 封顶 1000；渲染总量 50 KiB（含文件头／标记／提示），单行显示前 2000 字符并标省略数，仍保留整行引用。达到上限即停止，不另扫剩余数量、不做 count/files/type、多行或伪分页。
- 旧 prelude `18-anchor-grep.py` 已删除；适配模块拥有 rg 进程，纯 hashline 库只格式化并登记命中。BOM／CRLF 与 read 一致，裸 CR 是行内容；晚出现 NUL 的候选文件也不返回引用，不建全文身份表或搜索缓存。
- 验证用隔离真实 Jupyter、仓库外真实 rg 15.2.0 资产、现有 tool_bin 分块下发及 SHA256 比对；faux SDK/Gateway 执行实际模型说明中的 grep→edit 示例。当时只跑新用例、指定 hashedit/codemode 与冒烟检查，不付费、不 push／合入／重启 daily。
- 候选验证全部通过：新 grep 真实 kernel 9.03 秒，hashedit 9.05 秒，codemode 18.00 秒，冒烟检查 49.5 秒（指定检查同批运行）；quick 超过 30 秒目标，保持原调度并报告。完整证据与保守取舍见当时的任务报告（未随仓库发布）。

## PRK-ARTIFACTS：远程工具制品管理（2026-10-29）

- 取代 2026-10-14 手动 `assets/bin` 来源方案：网页设置新增「远程工具」，上传版本/平台/文件（可选期望 SHA256），切当前版本即回滚，删除仅非当前版本。Linux 平台仅 x86_64/aarch64；HTTP 边界一次校验名字、版本和平台。GitLab 暂不接，不起独立服务。
- 固定 `<PRK home>/assets/store/<sha256>` 内容寻址及 `assets/manifest.json`（工具→当前版本/版本→平台→sha256、大小、添加时间）；不提交二进制。第一版成为当前，后续上传不自动切换；同版本可补另一平台，不覆盖既有平台。原子发布清单，删除时保留其他工具/版本共享的内容。
- `tool_bin` 每次读当前清单，仍走真实 kernel stdin；chunk 固定 hash，切版不混读，目标缓存按 hash 复用。移除旧 `codemode.binDir` 与旧布局读取；显式 `scripts/import-tool-artifacts.mjs --home DIR --version imported` 离线导入，整树预检且保留旧文件，不做启动时隐式迁移。
- `artifacts.maxUploadBytes` 默认 209715200（200 MiB），独立于 HTTP JSON 上限。API 与 Gateway 使用同一 home、一个 API 写者；导入不可与 API 写操作并发，不加跨进程持久锁或启动垃圾回收。
- 聚焦验收使用真实隔离 Gateway/Jupyter/Vite/浏览器＋受控 provider，覆盖上传/切版/回滚/导入、目标 SHA256、输入/大小/当前删除拒绝及共享/孤儿 blob 清理。零付费调用，不 push/合入/重启 daily。

## PRK-HASHEDIT 历史（已由 PRK-FILETOOLS 取代）

- 分配锚点方案及其旧 API、容量、随机起点和全文建表已删除；当前契约见上方 PRK-FILETOOLS。原验收数字仅为历史证据，不证明本次模块／锁语义；原记录见当时的任务报告（未随仓库发布）。

## PRK-THEME：共享主题库与设备选择（2026-10-29）

- JSON 格式 `{name, mode:"light"|"dark", tokens:{"--pi-…":"CSS color"}}`；真实颜色源已在 `shared/palette.js`，`tokens.css` 只保留布局等非颜色变量。内置浅／深完整沿用原值，阴影、字体、尺寸不属于可导入颜色。
- Gateway `<PRK home>/themes/<uuid>.json` 一主题一文件；每次导入创建新条目，同名不覆盖。`POST /api/themes/{list,preview,import,delete}` 经现有 Gateway wire；preview/import body 为 `{theme}`，delete 为 `{id,confirm:true}`。内置主题只读，导出不含 id/builtin；缺键回落到同 mode 内置值。
- Color.js 解析独立 CSS 颜色，拒绝未知键、非法值、依赖页面上下文的 currentColor/var()；错误给具体键。预览返回 WCAG 2.1 AA <4.5 的正文、次要文字、行号、注释及 diff 增删行文字／行号／高亮对比度；透明色按 sRGB 合成，提示不阻止保存。
- 设置「通用→主题」提供列表、选用、JSON 粘贴／选文件、局部预览、AA 提示、下载、确认删除。浏览器 `pi-worker-color-theme` 只存选用 id，原 `pi-worker-theme` 继续存浅深／跟随系统；快捷明暗按钮返回内置主题。删除当前自定义主题回同 mode 内置主题，不覆盖其他设备选择。
- 主题由 Mantine resolver 写入 CSS，代码高亮和终端沿用同一 token；不复制主题文件到浏览器持久存储。`FoldMore` 改有边框按钮，手机触摸高度至少 40px；bash 配置文案为次要样式 `timeout Ns`，嵌套 ×N 单独保持中性色，失败工具名仍红。
- 验收使用真实 SDK/Gateway/Jupyter/Vite/Chromium 与 faux；保留既有配色和内置对比度断言。

## PRK-MONHIST：实例监控历史与自定义指标（2026-10-29）

- Gateway 按实例保存内存环形历史；`monitor.historyWindowMs` 默认 15 分钟，读取时淘汰过期点，重启丢失可接受。不为补历史启动采集，沿用已有监控通道租约；内置采集及快慢频率保持不变。
- 网页打开卡片、刷新、切会话先取 `monitorHistory`，随后接实时点；同实例不同会话共享历史，采样使用 Gateway 时间戳。
- 自定义指标使用实例配置 `customMetrics` 列表 `{name,command,interval_s,parse,unit?,chart?}`，`parse` 仅 `number`／`json:<点路径>`，图形仅折线。只在卡片展开租约有效期间经目标机通道执行；命令有超时与输出上限，失败逐项显示，不改写内置指标为配置。设置页只读展示，编辑走配置文件。
- 本任务不 push、不合入、不重启 daily；真实 Jupyter 目标通道与 faux 验收，零付费模型调用。
- 验收覆盖实例共享、短窗口淘汰、真实通道解析／错误／租约与计数，以及在真实 Gateway／HTTP／Vite／Chromium 中的桌面及手机刷新、切会话、折线、关闭停止、设置列表与保存保留。截图由 `PI_TEST_WEB_EVIDENCE` 指定目录。手机抽屉打开时暂隐藏监控浮层，选完会话恢复并重取历史，避免浮层挡住会话行。

## PRK-LINEOFFSET：省略字数与原文续读位置（2026-10-29）

- 长行内部及整体 head/tail 省略改用 ` …[+N chars, terminal_read(command="<id>", offset=B)]… `；`N` 沿用 UTF-16 字符单位，`B` 精确指向 `full` 中被省略段首字符的 UTF-8 字节位置，重复行及空白折叠不改变原文坐标。
- 标记计入原有 `outputBytes`，不切标记及 Unicode 码点；预算不足以容纳完整提示时只写字数，极小预算连字数也放不下时只保留完整文本并置 `truncated=true`。running 屏幕尾部及 ANSI 删除改变文本时不给猜测 offset，只给字数。
- 不改阈值、原文分页、`raw` 或 Python `bash()`；纯函数验证 300 KB／三命中、中文、×N 及整体预算；真实 SDK/Jupyter 用标记 offset 调用 `terminal_read` 验证原文段首，零付费调用。

## PRK-LONGLINE：模型终端单行过长截断（2026-10-28）

- 模型终端共用精简在原行折叠之后、整体字节 head/tail 之前增加长行窗口：保留头／各处 pattern 命中上下文／尾，重叠合并，省略标记见上节；普通结果及后台通知、code/direct 共用，不因截断后相同误折叠不同原行。
- pattern 只从静态单条 grep/rg 类命令取，支持引号、转义、positional／`-e`／`--regexp` 和已知带值选项；不增模型关键词参数。动态 shell／复合命令、未知选项、pattern 文件、反选和非 JavaScript 可表达正则保守只留头尾。原搜索命令的执行不变。
- 配置 `terminal.longLineThresholdChars=2000`、`longLineHeadChars=80`、`longLineTailChars=80`、`longLineContextChars=40`（每侧）；正整数 UTF-16 长度，不切半个码点。长行省略置 `truncated=true`，仍受 `outputBytes` 总预算限制。
- 完整归一化终端文本与 `total_bytes` 不变，继续走 `terminal_read(command, offset)` UTF-8 原文分页；`raw` 屏幕旁路、Python `bash()` 原始数据与 Pi 原生本机 bash 不变，不新造 `full_output_path` 或输出持久化。原生 bash 是否另接精简、是否需要输出文件留待用户决定。
- 当时用纯逻辑及真实 SDK／Jupyter＋faux 验证三处命中、cat、精确原文分页、code 回调及 raw Python bash；未改前端及原浏览器用例，不新增 quick 注册，不调用付费模型、不部署或重启 daily。


- 2026-10-28（PRK-REDTESTS-A）：无运行宿主的归档快照不再附带 memory 待确认机制遗留的空 `extensionUi`；Web 收到不含 UI 宿主的权威快照时清空旧 UI、渲染和 revision。closed／sleeping 会话保持可输入，发送继续沿既有恢复／唤醒路径；不改变 composer 禁用条件。

## PRK-LAZYTOOL：大块工具内容按需加载（2026-10-29）

- Gateway 网页投影按 `toolContent.maxBytes`（8192）或 `maxLines`（40）裁剪大工具输入／输出，携带开头预览、全文字节数／行数和内容版本。额外检查完整结构化载荷，diff／details／图片不绕过阈值；SDK 历史、JSONL、模型上下文不变。
- wire `toolContent {worker,sessionId,toolCallId}`／HTTP `GET /api/workers/:name/tool-content?sessionId=…&toolCallId=…` 读取原生 SDK 全文；运行中读既有 execution observation，休眠／关闭／归档读历史，不唤醒、不请求模型。保留现有传输上限，无新持久存储。
- 前端复用现有工具行／`FoldMore`：展开行显示预览，点击展开全文才取数；页面内按 sessionId＋toolCallId＋版本缓存，请求合并，加载失败保留预览并可重试。查询当前页显式补齐工具全文后搜索；diff、ask 记录和嵌套摘要从完整 result 渲染。HTML／JSONL 导出、复制、重发／回退／分叉继续使用原生完整内容路径。
- STEER1：展开控件按 1024 进制显示 B／KB／MB；不足 1 KB 保留整数字节，KB／MB 固定一位小数。仅网页文案换算，wire/API 和 `data-total-bytes` 保留原始字节数；测试读取 data 属性，不按文案断言。
- 插件渲染器仍以原始 SDK 内容渲染，未取全文的工具出站节点不发送；`toolContentExpandedIds` 与原有行打开状态分开。大 malformed-JSON `argumentsError` 同样按需读取。
- 聚焦验证：用例使用隔离 SDK／Gateway／Jupyter／Vite／Chromium＋faux，覆盖大／小 snapshot/live、API、模型／历史不变、展开缓存复制搜索、diff／嵌套及休眠／关闭／归档；当时只跑了该用例和旧的冒烟检查、不部署 daily。


## PRK-SKILLSCAN：`.agents/skills` 扫描规则与支持文件清单（2026-10-28）

- 目录内扫描改用 OpenCode `skill-scan.ts` 规则：BFS，根目录 depth=0、最多到 6；忽略点目录及 node_modules／venv／__pycache__；遇到 SKILL.md 仅收该文件并停止下钻，只有根层散 `.md` 可以成为 skill。
- 目标全局／实例／项目 `.agents/skills` 使用同一规则；Gateway 从 Pi 结果中过滤不合规则的条目，漏收的 home 根层 `.md` 通过既有 `resources_discover` → `skillPaths` 补充。PRK 共享库、package 和 PRK home 来源不变，cwd 向上至 git root 的目录来源规则不变。
- Pi 同名去重可能先把全局条目压到 collision diagnostics，再被 PRK 的 SDK 项目来源过滤一起丢掉。通过公开 `skillsOverride`／`loadSkills` 解析 diagnostics 已给出的 Gateway home 文件路径，交还现有来源优先级选择，不另扫目录、不复制元数据解析或维护影子状态。
- 聚焦回归沿用 当时的用例，比较 Gateway home、目标 home 与项目目录的同构 fixture 集合，覆盖根层 Markdown、子目录散文档、终止下钻、深度 6／7 与忽略目录；使用真实 Jupyter／SDK 与 faux，不调用付费模型。
- `skill_read` 成功读取已加载 skill 的 SKILL.md 入口后，在 SDK 正文／分页／截断结果末尾附 base directory 和 `<skill_files>`，同目录递归文件按绝对路径排序后最多取 10 个；目标机通过 channel `skills.files`，Gateway 用本机文件系统，只列路径、不读支持文件内容。忽略 OpenCode 的固定目录，保留普通隐藏支持文件；排除入口自身，按本任务明确契约保留 `sub/SKILL.md`。
- 支持文件（包括被父 skill 覆盖的 `sub/SKILL.md`）与根层非 SKILL.md skill 读取不附清单；direct 文本和 code-mode structured output 一致。「成功读取正文才计使用」及现有按会话去重逻辑不变。聚焦回归同时覆盖本地／目标读取、排序取前 10、忽略目录、分页与非入口读取。


## PRK-INSTCACHE：实例 home skill 目录复用与手动刷新（2026-10-28）

- Gateway 按实例名在内存保存最近一次成功发现的目标 home `.agents/skills`，不存项目目录、不落盘。会话创建／唤醒／重载的既有 discover 成功后提取 home 组更新；`GET /api/capabilities?instance=<名>` 只在未缓存时发现一次，之后直接复用（含空目录结果）。
- `POST /api/capabilities/refresh` 接受 `{}` 或 `{instance:"<名>"}`，拒绝多余字段。前者保留全局目录刷新行为，后者只重扫实例 home 并返回实例层视图；失败沿用 `instanceError` 并保留上一份成功结果。实例删除或连接 URL／token／cwd／local 改动（含 reloadTargets）清除此实例缓存。
- 验证沿用 当时用例的真实本机 Jupyter＋隔离 HOME＋faux：重复 GET 不重扫、手动刷新、新建／重载会话复用且不泄漏项目、连接编辑／删除同名重建失效及 body 严格校验；先红后绿，再跑冒烟检查。不改前端、不付费调用、不跑 full／related／额外浏览器、不部署／重启 daily。

## PRK-SKILLS3-BE：skill 三级来源与实例默认（2026-10-28）

- 所有会话在创建／唤醒／重载时通过既有 target channel `skills` 模块发现目标机 `.agents/skills`：cwd 向上直到含 `.git` 的目录（含该层），无 git 到 `/`；目标 HOME 排除出项目来源、最后单独收集。目录内扫描已由上方 PRK-SKILLSCAN 的 OpenCode 规则取代，坏条目单独跳过，目标离线记日志但不阻塞会话，不进 kernel。
- Gateway home 固定 `group:skills:global`（`全局 · ~/.agents/skills`，machine=gateway），目标 home 固定 `group:skills:instance`（`实例 · ~/.agents/skills · <实例名>`）；本机同目录不重复出实例组。项目每目录一个 `group:skills:dir:<machine>:<绝对路径>`，标签为绝对路径＋实例名（本机显示「本机」）。组带绝对 `path`、`machine`，优先级为近端项目→祖先项目→实例→全局及其它既有 Gateway 来源，删除 home 动态组产出、不留兼容。
- SDK 自发现的 `.agents` 项目项滤掉；会话 loader 并入目标条目并按自身／组开关和名称优先级选胜者，目录投影实时计算 `shadowedBy`。被覆盖项不广告、不可 `skill_read`；关闭胜者后下一项在重载生效。全局目录不收集目标机目录。
- `skill_read` 依据本会话发现目录分流到目标 channel 或既有 Gateway reader，继续复用 SDK 的分页与输出上限。共享库只有成功正文读取才计使用，目标 skills 不参与共享库计数。
- 共享记录和 `skill_manage` create 必填 scope，无默认或迁移：`global`／`instance:<实例名>`／`project:<projectId>`；模型自行判断可移植性。新增 patch `section:"scope"` 与 `skillsScope`／`POST /api/skills/:name/scope`，只校验格式。会话仅注入匹配范围的共享条目，改动后重载生效。
- 开关三层：全局 `session.capabilities` ＜ 实例 `instances[].capabilities` ＜ 会话稀疏覆盖；有效值为会话覆盖 ?? 实例默认 ?? 全局默认 ?? true。实例表可选、格式校验同全局；会话 `defaultEnabled` 为实例层生效值，恢复默认回到实例层。
- `GET /api/capabilities?instance=<实例名>` 返回全局目录＋经共享 target-channel lease 发现的该实例 home，不含会话项目；条目的 configured=实例层生效值、defaultEnabled=全局默认、overridden=实例表是否存在。不可达或未知实例返回其余目录和 `instanceError`。`POST /api/capabilities {instance,id,enabled:boolean|null}` 原子更新该实例稀疏表，null 删除一项，保留配置其它字段，并沿用既有机制更新该实例醒着会话的 `requiresReload`；连接编辑／删除 API 不变。
- 验证限制：一个真实本机 fixture＋临时 HOME＋faux 聚焦用例与当时的冒烟检查；不跑 full／related／额外浏览器测试、不调用付费模型、不测远端机、不部署或重启 daily。

- 2026-10-28（PRK-NORECONNECT）：移除对话顶部的 `#connection-status` 重连提示及 App 内专用变量；连接状态继续由侧栏 `#management-connection-status` 展示。保留 `#connection-banner`、断线重试按钮和 store 重连状态；两个既有浏览器重连用例改等侧栏 `data-status="connecting"`，并断言旧提示不存在。

- 2026-10-28（PRK-SKILLSCOPE，分组已由上方 PRK-SKILLS3-BE 取代）：Gateway 全量目录发现按 `sourceInfo.scope === "project"` 排除项目 skill，避免不同 cwd 会话因 Gateway 项目 skill 误报需重载。

- 2026-10-28（PRK-RELOADBANNER / STEER1）：重载提示复用灰色 Mantine Alert 和 `.shell-alert`，保留状态属性及重载按钮行为，不新增 CSS。全局 skill 目录过滤与对应回归用例已撤掉：`group:skills:project` 也包含用户级 `~/.agents/skills`，不能整组过滤；误报根因本轮不改。

- 2026-10-27（PRK-PANEL-FIX-2b/2c）：全局工具／Skills 目录不再汇总醒着的会话。Gateway 启动及手动刷新通过公开 SDK 创建全开、无排除的内存目录会话，正常运行扩展加载与 session_start，读取后 shutdown/dispose；不分配 worker、不写 JSONL、不起 kernel、不请求模型。目录仅存 Gateway 内存；实际会话创建／唤醒／重载只合并新条目和更新描述，删除仅由成功的全量发现决定。会话页以全局目录为底叠加本会话开关和实际 loaded 状态，排除的工具仍可见、可重新开启；目录中发现的动态扩展名称参与 worker 原生准入和排除。全局页增加刷新按钮、转圈与错误提示，失败保留旧目录，会话页无该按钮。

- 2026-10-27（PRK-PANEL-FIX-1）：内嵌记忆页移除旧弹窗的内层限高滚动，统一由设置内容区滚动，避免编辑器与列表点击区域冲突；记忆浏览器测试保持原样。工具／Skills 的关闭开关轨道与边框使用既有主题 token 增强可见性，手机来源 tag 改为单行横向滚动。tool-mode fixture 关闭后台记忆复盘，并按当前沉淀工具已在 direct 集合、显式 off 才是会话覆盖的契约修正测试数据；不改后端产品行为。

- 2026-10-27（PRK-TERM-HINT）：仅补充提示与结果说明：kernel `bash()` 的 stdin 接 `/dev/null`，输入提示读 EOF；终端 `running` 结果带 `note`，说明可结束本轮、完成／安静事件会开启新轮，不需轮询，非 running 结果不带该字段。回答终端 prompt 时 `yield_s` 按预期剩余运行时间设置；执行与事件行为不变。

- 2026-10-27（PRK-PANEL-P3）：全局设置和会话行菜单的工具／Skills 共用同一目录组件，来源 tag 筛选、列表原名/首行说明/开关、详情完整说明；组主开关保留单项状态，部分关闭显示灰色，远程本机组不可用。沉淀工具与共享 Skills 的生命周期管理合并到详情；归档/未加载记录保留管理但不冒充已加载能力。终端工具详情编辑全局 terminal 配置。会话覆盖标「已改」并可单项恢复默认；会话提示需重载，菜单与提示提供重载入口，忙时禁用。

- 2026-10-27（PRK-PANEL-P2）：设置改为左侧通用／实例／工具／Skills／记忆／归档导航与右侧内嵌内容；手机为一级列表→二级页→返回。主题、布局和通知同在通用页；原实例、归档、记忆和沉淀管理不再另开管理弹窗，破坏性操作保留确认。

- 2026-10-27（PRK-PANEL-P1 / STEER-1）：工具和 Skills 采用全局默认 `<` 会话稀疏覆盖；保存不改运行中集合，`requiresReload` 比较已加载与期望集合。空闲时手动重建 SDK session，以公开 `excludeTools` 在注册层排除关闭工具，恢复同一 JSONL；保留原 kernel、变量及执行连接，仅刷新 helper/沉淀函数可用性。本机工具组总开关继续即时下一轮生效，单项走重载。kernel 清单从本项目 prelude 源码静态取名字、签名与 docstring 首行，绝不启动 kernel；原生 home/project/package skills 在 code 档同样广告和读取，由各自开关过滤。清单按真实加载来源分组，终端配置从 config 读写。术语统一为「沉淀工具」。

- 2026-10-27（PRK-TERM-R2b）：增加 code/direct 共用 `terminal_send/key/read/close`，模型具名 tab 复用 Jupyter workspace terminal；通过公开创建参数直接启动干净 bash 并传 rc，不改用户 dotfiles、不回显 bootstrap。OSC 133/7 与 `@xterm/headless` 公共 parser/buffer/marker 接口提供命令边界、cwd、屏幕与完整输出；滚动历史有界，模型结果精简与完整 UTF-8 分页分开。yield／硬超时／安静阶梯按任务书，超时经 PTY Ctrl-C 后必要时重建；没有等待输入检测。后台模型命令事件两秒合批，经原生 `pi.sendMessage` 唤醒／steer，网页灰字可展开，真人命令不推。终端状态跨 worker idle sleep/reload 保留；关闭／归档／换目标／正常 Gateway shutdown 清理模型终端，无新增崩溃恢复或持久输出日志。验证仅聚焦真实 Jupyter＋faux＋浏览器与 quick，不运行 related full。

- 2026-10-27（PRK-TERM-R2a）：保留 kernel `bash(command, timeout=None)`，stdin 接 `/dev/null`，新进程组执行与超时整组终止；shell 退出后管道安静 100ms 即返回。结果统一 `{exit_code,stdout,stderr,duration_ms,timed_out}`，两路原样文本；selectors 分块增量 UTF-8 输出经 progress MIME 只进工具实时 UI，不重复进入最终模型结果。Pi 原生本机 bash 不变。

- 2026-10-27（PRK-TERM-R1，按 STEER-1 收窄）：
  - 从 monitor 抽出 `src/target-channel/`：隐藏 Jupyter terminal、一次性 runtime／模块下发、JSON 行请求回复／事件、退避重启和防孤儿心跳。按目标共享，使用方持租约；最后归还立即关闭。monitor 保留原采集、面板频率与对外事件，只替换通道接入。
  - 目标 runtime 为 Python ≥3.6 stdlib 模块注册表；模块各自处理请求与采样，异常只影响本请求／发本模块错误事件。当前仅注册 `monitor`。
  - STEER-1：删除 tty 模块，不留占位；原 syscall 判据的祖先进程探针误判了 Yama=1 下兄弟进程的可访问性。真实 Jupyter 通道读终端 syscall 得 EPERM；用户确认 PR_SET_PTRACER_ANY 不继承到 shell fork 的子进程，不采用。R1 提交后停止，等待新版 R2 等待输入方案；本轮不删 prelude bash，不实现模型终端。

- 2026-11-15（PRK-MEMORY-R3，取代 R1 的文件位置、固定四层、容量与 `reviewInterval` 配置；R2 不变）：记忆层改为由 `<memory.directory>/localmemory.toml` 加 `prk-localmemory-override.toml` 配置；`memory.directory` 默认仍是 PRK home 下的 `memories`，生产配置为 `"~/memories"` 时与 OMP 的 pi-local-memory 读写同一批文件；默认五层（control/user/memory/instance/project），层的容量、soft、explicitOnly、review 由配置定，复盘默认可写全部五层；复盘在用户输入达 `userTurns` 或工具调用达 `toolCalls` 后触发，`memory.review=false` 关闭本网关复盘；条目仍以 `\n§\n` 分隔，`~/memories` 现有 `- ` 格式文件随 pi-local-memory 换解析一次性转换；设置页按层显示，并可用表单编辑两份配置。详见 [docs/specs/memory-layers.md](docs/specs/memory-layers.md)。第 1–3 步（配置解析、后端、前端）已在分支 `memory-layers` 落地，pi-local-memory 对齐待续，2–4 步一起上线。

- 2026-10-27（PRK-MEMORY-R2，取代 R1 control 确认决策）：control 增改删与其它 target 一样立即落盘，删除待确认文件、路由、卡片和 memory 的 asking 标记；主模型或复盘每次成功写 control 都在发起会话留一行可展开提示，显示新增、改前改后或被删条目，其它 target 仍只在复盘写入后提示。规矩、边界、授权、工作偏好进 control；user 只记用户是谁的事实。control 软上限提醒保留。

- 2026-10-26（PRK-NS-R2）：两档共用的 `kernel_code` 增加 `reset?:boolean`；为 true 时复用现有 kernel restart 后执行 code，空字符串只重启，变量全部丢失，prelude／沉淀工具照常重装；失败返回 kernel 不可用结果，不执行 code。系统提示词只在 cgroup 那一句补充接近内存上限时 del 大对象或 `reset:true`。

- 2026-10-26（PRK-NS-R1）：namespace 只描述变量 `name`／`type`，函数与方法另保留 inspect 签名和 docstring 首行，沿用 origin；删除 repr、size 及 `namespace.reprChars`，不触发对象的值预览或大小计算。改动检测只比较 `(id(value), type(value))`，明确接受原地修改不再标 modified，避免大对象预览 OOM 与用户方法副作用。

- 2026-10-26（PRK-STOP-R1）：用户 cancel 在 Gateway 边界记录来源，收尾后为 `cancelled` 且无 error（不承诺回滚）；非用户 unknown 语义不变；网页只在对话末尾显示停止／unknown，工具 output 复用 ANSI SGR 语义样式并保持纯文本。
- 2026-10-26（PRK-STOP-R3，取代 R2）：`kernel_code` 返回结果时若执行 signal 已 aborted，在工具结果 `details` 写 `interrupted:true`，随 SDK 历史保存；工具行只读本结果该字段，工具组只看本轮是否含该字段，统一中性「已中断」／`data-state="interrupted"`，刷新后不变；删除 R2 内存 operation 关联，其它错误与 KeyboardInterrupt 正文不改。

## 2026-10-26 PRK-MEMORY-R1：本地文件记忆与后台复盘

| 层 | Gateway PRK home 下的文件 | 谁写 | 注入范围 | 内容 |
| --- | --- | --- | --- | --- |
| soul | `prompts/soul.md`，配置 `session.soulFile` | 只用户手写 | 全部会话 | 人设与身份 |
| control | `memories/CONTROL.md` | 模型或用户直接写 | 全部会话 | 每个会话都遵守的规矩、边界、授权、工作偏好 |
| user | `memories/USER.md` | 模型或用户 | 全部会话 | 用户的身份、背景等本人事实 |
| memory | `memories/MEMORY.md` | 模型或用户 | 全部会话 | 与任务类别无关的通用环境、约定、工具怪癖、教训 |
| instance | `memories/instances/<实例名>.md` | 模型只写当前绑定实例；用户可选实例 | 只绑定该实例的会话 | 那台机器的路径、GPU、服务、坑 |

- `memory` 在 direct 档为 Pi 工具，code 档通过 `gateway.memory(...)` 调用同一实现；远程实例文件仍存在 Gateway。条目以 `\n§\n` 分隔，允许手改；每次写前重读，进程内串行、临时文件加 rename，不加文件锁或正则／DLP 注入扫描。
- 单操作或跨 target 批量 add／replace／remove；replace 是整条替换，old_text 必须唯一子串命中，零／多条命中给候选，完全重复 add 拒绝。先验证整批、只检查最终容量，失败整批不写。user／memory／instance 默认硬上限 1375／2200／1375 字符；control 推荐 2000 字符，超出只提醒，不拒绝或要求删规矩。
- 模型 control 增改删直接落盘，不等待确认；每次成功写入在发起会话显示可展开的原生轻提示，不触发模型轮次。新增显示新条目，修改显示改前改后，删除显示被删条目。
- 新建、重建、唤醒和原生 reload 读取非空块，control 排 user／memory 前，实例块带实例名；块头显示字符用量。会话运行中冻结系统提示词，写入只改文件；换实例在下一次启动读取新实例块。
- `memory.reviewInterval` 默认 10，0 关闭复盘。按 Pi 公开 `input.source` 计数：`interactive`／`rpc` 每次输入计一轮，`extension` 不计；复用 worker 现有扩展工厂，真人 prompt／steer／followUp 共用，主模型成功调 memory 清零。达到间隔后等本轮回复结束，以会话同模型和当前上下文快照后台复盘，仅开放 memory。复盘自身不再触发，单会话不重叠；复盘对话不进主历史／上下文，失败只记日志。control 每次写入立即提示，其它 target 在复盘有写入时显示可展开的轻提示。
- 分层提示一句一层：如何工作的规矩、边界、授权和工作偏好进 control；user 只记本人事实，通用事实进 memory，机器事实进 instance；某类任务的流程、判断、坑、偏好／纠正进 skill；可再次调用的确定性函数进 tool，理由必填；任务进度、一次性脚本、当前状态都不存。autoTools／autoSkills 继续各自控制对应主动引导。
- `memory.enabled` 默认 true；关闭不注入、不提供 memory／gateway.memory、不复盘，保留文件。`session.soulFile` 整块取代原 soul 配置键，默认仍为空，无兼容别名。所有启动配置变更需重启 Gateway；真实配置由上线方改键，本任务不触碰。
- 设置的「记忆」入口与 Skills 同类，tab 为规矩／用户／记忆／实例；可增改删、显示用量，control 超推荐标黄。实例删除不删除记忆，页面标「已删除实例」并提供人工删除。
- 验收只用真实 Pi SDK、隔离 Gateway／Jupyter fixture、faux provider 的实际 payload 与真实浏览器；只跑 当时的用例 与 当时的用例，control 不落盘只做一次撤修复变红。不付费调用、不 push、不合 daily、不重启 daily、不碰真实 PRK home。
- 2026-10-29（PRK-HUMANCOUNT）：移除按 `message_end` 的 user role 计数；同伴 `agent_send` 经 `source:"extension"` 不计，Gateway 内部 `sendCustomMessage` 通知也不计，独立 review loop 不经过主会话 input。当时的用例 用真实 SDK＋隔离 Gateway／Jupyter＋faux 验证间隔 2 下两条同伴不触发、两条真人触发、真人 steer／followUp 计数，以及 custom 通知和复盘自身不污染计数；不按文本推断、不加影子队列。

## 2026-10-26 PRK-KMEM-R1：kernel 内存反馈与 working set

- 系统提示词仅增加 `The kernel runs inside a cgroup.`，不写具体上限或 meminfo 提示。遥测与 Gateway 快照保留 `current`，新增 `workingSet = max(0, current - memory.stat.inactive_file)`；监控 Kernel 数字、内存条与 `monitor.memoryAlertPercent` 告警均改用 working set，避免把 inactive file cache 算作压力。
- 每次 `kernel_code` 结果末尾附 `[kernel memory 0.2/4.0 GiB]`（working set / memoryMax，一位小数、MiB/GiB 自适应）；正数 `oomKill` 追加 ` · OOM N`。只用该 execute request 内 `post_run_cell` 的明确终样本，与结果同次交付；没有就省略，不读上个 cell 的 snapshot。只改模型工具结果文本，不另加 Web UI。
- 验收按 PRK-KMEM-STEER-1 收窄：一个真实 SDK＋隔离 Gateway/Jupyter/cgroup＋faux provider 聚焦用例覆盖 prompt、200 MiB 分配后的结果尾行与 page cache 区分；监控一条浏览器数值来源断言及桌面／手机截图；撤尾行一次必须变红，再跑冒烟检查。不跑相关 full、不付费调用、不合入／重启 daily、不碰真实 PRK home。

## 2026-10-26 PRK-LOCALTOOLS-R2：回复中切换模型与思考强度

- 模型／思考选择与工具模式／本机工具开关均允许在会话 busy 时修改；当前已发出的模型请求保持原值，下一次 assistant 请求使用新值，可能仍在同一次用户回复中。复用公开 `AgentSession.setModel`／`setThinkingLevel` 与 SDK next-turn refresh，不缓存第二套待生效设置、不重启或中断回复。
- `model`／`thinking` 的 catalog 与执行边界仅移除 idle 要求，仍拒绝只读、sleeping、无 SDK session；其它 native action 的 idle 限制不变。SDK 原生 model/thinking entries 和现有 custom session record 按原生 leaf 追加；历史、reload、fork、rerun 继续走 SDK。
- 输入框下两下拉只去掉 busy 禁用条件，其余禁用条件不变，不加提示文案。验收采用真实 SDK＋隔离 Gateway/Jupyter＋faux provider，直接断言同回复前后两次请求的 model/reasoning、历史投影与桌面/手机操作，并撤回后端放行验证红灯。

## 2026-10-26 PRK-LOCALTOOLS-R1：本机工具独立于工具模式

- 决定：`toolMode`／`session.workerTools` 只接受 `code`、`direct`，默认 `code`；删除其他工具模式取值，不留别名、兼容或迁移。新增每会话布尔 `localTools`，配置 `session.localTools` 默认 `false`。新 local 实例会话采用该默认值；新远程会话始终关闭，即使配置为 `true`。实例是否本机仍只取显式 `instances[].local:true`，不从 URL 推断。
- 两档使用同一 `kernel_code`／prelude／Gateway callbacks／tool library／`tool_bin`。开关关闭时，`code` 仅声明 `kernel_code`，`direct` 另声明 Gateway／session／ask／允许的 extension tools；开关开启时，两档各自额外声明公开 Pi SDK 原生 `read`／`bash`／`edit`／`write`／`grep`／`find`／`ls`，在 Gateway 主机按保留的 session cwd 执行，不是 sandbox。远程开启只在 native-action 边界拒绝一次。
- `tool-mode` 接收且仅接收 `{mode:"code"|"direct"}`，成功 `data:{toolMode}`；`local-tools` 接收且仅接收 `{enabled:boolean}`，成功 `data:{localTools:boolean}`。两项互不改写，沿用公开 `AgentSession.setActiveToolsByName` 于下一 SDK turn 生效，不替换 runtime／kernel。两项均写入原生 `gateway-native-session-state` custom record，sleep/wake／重建后保持。catalog `target.current.localTools` 为布尔开关，`target.local` 仍是实例本机属性。原生 `read` 的 skill 使用计数和原生 skill catalog 选择改看开关，与模式无关。
- 网页 `#chat-tool-mode` 只保留「代码」「直接」。仅 local 实例会话在输入框下同行右侧、`#context-usage` 左边渲染 Mantine `Switch size="xs"`：`#chat-local-tools`，标签「本机工具」，提示「在 Gateway 本机直接读写文件、跑命令（read / bash / edit…）」。手机位置相同，窄屏可短标签，不挤掉既有控件；远程会话不渲染。
- 验收走真实 SDK＋隔离 Gateway＋Jupyter fixture＋faux provider，断言 provider 实际 tools：code 关／开、direct 开、下一轮切换、sleep/wake 持久化、新会话默认与配置覆盖、远程开启和非法模式拒绝。撤除远程拒绝／开关叠加各一次须令对应测试变红；浏览器以 id／data 断言 local／remote、catalog 与切换，并留桌面／手机浅深色截图。受控 provider 不代表真实模型能力；不调用付费模型、不动 daily 或真实 PRK home。
- 本机开关为开时显式改绑远程实例，重建前关闭并持久化开关。相关回归覆盖已关闭记录释放（沿现有 collection lifecycle，不另建状态机）。扩展后的 `check-tool-mode.mjs` 包含真实 idle sleep/wake、重启及配置矩阵，放入 full 自动发现，不占 quick 的 30 秒时限。

## 2026-10-26 PRK-ATREF-R1：`@` 相对路径以会话 cwd 为基准

- `@` 空 token 列 worker 的绝对 cwd；`@sub/` 列 cwd/sub；`@../` 先相对 cwd 规范化，只要仍在 Jupyter 根内就允许，越根报 `out-of-root`。相对路径先转绝对路径，与原有 `/abs/` 共用 `contentsPath(…, workerRoot(…))`，不保留 Jupyter-root-relative 的输入分支，不加 cache 或 kernel probe。
- 绝对路径原有规则、`~/` 的 `home-unsupported`、名字片段过滤不变。候选 `path` 仍是 Jupyter Contents 路径；输入框保留用户的相对／绝对写法，发送时继续按候选 Contents 路径读取，不再按 cwd 二次解析。
- 真实 HTTP → Gateway → Jupyter fixture 分别覆盖根 `/` 与高于 cwd 的根、空／子目录／父目录、出根、绝对路径和休眠无 kernel 浏览；真实桌面／手机浏览器在多级 cwd 下覆盖首屏候选与目录插入。选中相对路径文件后，faux provider 必须收到 cwd 内容而非 Jupyter 根下同名诱饵；撤除修复后回归必须红。仅证明受控调用链，不代表付费模型能力。

## 2026-10-26 PRK-LEARN-R7：预装工具用法与内部回调隔离

- 真机发现模型尝试 `from prk import tool`，失败后手拼 `source/signature` 经内部保存回调写库，绕过源码检查，原函数也没有调用计数包装。明确 `tool`／`library_sync` 是 kernel 预装全局函数，直接装饰／调用，不要 import 或手拼 metadata。
- `prk_library_*` 仅供 prelude 使用：从 `gateway.describe()` 列表、按名 describe 和模型提示词 callable 清单中排除；普通 `gateway.<name>`／`gateway.call` 对内部名字明确拒绝。prelude 改走内部 `PRK_LIBRARY_CALL:` stdin 标记，继续通过当前 cell 的公开 SDK `ctx.executeTool` 执行与校验，不修改上游或另建执行器。
- 这是可信单用户下防止模型误用的协议分流，不是 sandbox、秘密或对恶意 kernel 代码的安全边界。SDK 的 `hidden` 会让 prelude 也不可调用，`prepareLoadout` 只隐藏声明而不改变 callable，因此保留内部注册与原生生命周期，不用私有 SDK 状态补齐。
- 真实 SDK／隔离 Gateway／Jupyter／faux 回归覆盖四个内部回调的发现与直接调用拒绝、装饰器同会话成功两次为 calls=2／sessions=1、新会话加载后为 calls=3／sessions=2，以及原有源码检查、失败不计数和 idle 执行。撤除普通通道拒绝后必须红；不以受控 provider 冒充真实模型质量验收。

## 2026-10-26 PRK-LEARN-R6：沉淀边界、复用理由与调用次数

- tool 只沉淀输入输出明确、可确定执行的自包含同步 Python 函数，且能说出未来哪类任务还会调用；保存前看已加载工具的名字／签名，相近的同名覆盖为新版本。`@tool(persist=True, reason="未来任务类型")` 的 reason 必填且去首尾空白后非空；同名新版本使用新理由。沉淀工具旧记录格式不迁移、不兼容（daily 沉淀工具为空）。
- skill 沉淀需要理解才能使用的多步流程、判断、用户偏好／纠正与环境坑；新建前看提示词已列 skills，相近的 patch。提示使用现行 `skill_manage` 结构化字段与事实 evidence，不要求模型编写 frontmatter。一次性脚本、任务进度和当前状态两边都不存。
- 工具新增累计 `successfulCalls`：每次成功执行 +1，同一会话多次也计，失败不计；同名修订继承总次数。`distinctSessions` 仍按原生会话去重，转正、容量竞争和闲置规则不使用总次数。网页沉淀工具列表／详情显示理由、成功调用次数与使用会话；skill 不加次数。
- `learning.autoTools`／`learning.autoSkills` 两个布尔配置默认 true，分别控制系统提示词中的主动沉淀引导；关闭不撤销工具、skill 发现／读取或用户明确要求的保存。配置沿用 Gateway 启动快照，新建／重建会话及其原生 reload 使用该配置；修改文件后需重启配置所属 Gateway，不加热读取或后台复盘。
- 验证只用真实 Pi SDK／隔离 Gateway／Jupyter fixture／faux provider，检查实际 provider prompt、保存／拒绝、同会话 3 次仍 staging，以及桌面／手机浅深色展示；受控结果不等同于真实模型主动沉淀质量。

## 2026-10-26 PRK-LEARN-R5：新建 skill 由模型判断是否复用

- 删除新建时的名字／描述相似度计算、分词、阈值配置与相似拒绝，不留兼容路径。名字不同即可创建；完全同名（含 archived）仍拒绝并提示 patch，归档先恢复。
- `skill_manage` 描述提示新建前先看系统提示词已列出的 skills，相近的用 patch 增强已有 skill，不另建。首行保留 `Minimal: {...}`；code 档 `gateway.describe('skill_manage')` 与直接声明共用这一份描述。
- 真实 SDK／隔离 Gateway／Jupyter／faux 回归验证 `prk-service-status` 与 `prk-service-status-check` 均能创建，以及活动／归档同名仍拒绝。结构化写入、读取计数、生命周期不变；不触碰 daily 服务，不做付费调用。

## 2026-10-26 PRK-LEARN-R3：结构化 skill 写入

- `skill_manage` 保留 create／patch／write_file／remove_file／delete 动作，删除整段 SKILL.md 与 oldText／newText 接口，不留兼容。create 接收 name、description、whenToUse、evidence、procedure、pitfalls、verification；TypeBox 同时声明字段用途与长度／条数上限。没有事实依据就不写。
- 工具以 JSON 字符串编码生成 YAML frontmatter；章节标题统一来自一处常量：When to use／Procedure／Pitfalls／Verification／Evidence。procedure、verification 自动编号，pitfalls 自动项目符号；字段是文本，不要求模型编写 YAML 或 Markdown 结构。
- patch 用固定 `section/value`，字符串对应 description／whenToUse／evidence，数组对应 procedure／pitfalls／verification；whenToUse、evidence 同步 frontmatter 与正文。必填不允许空白，procedure 至少一步，可空数组允许清空。人写的原生 SKILL.md 仍能原样加载读取；目标章节缺失／重复就明确报错，不猜标题或追加章节。辅助文件只经 write_file／remove_file，不能写入／删除任何 SKILL.md。
- code 档 `gateway.describe('skill_manage')` 与模型直接声明使用同一描述／参数；描述首行给 `Minimal: {...}` 示例。loader、读取计数、生命周期、网页详情字段与 HTTP 管理路由不变。受控 provider 只验证实际调用链，不代表真实模型学习效果。

## 2026-10-26 PRK-LEARN-R2：读取正文才计入 skill 使用

- R2 取代 R1 的加载／广告计数决定：仅活动受管 `<home>/skills/<name>/SKILL.md` 的成功读取计数，按原生 SDK session ID 去重；同一会话重复读取不增会话数，但刷新 `lastUsedAt`。加载、广告、管理页查看、supporting files、无关路径、失败／取消读取均不计，不再发布加载口径字段／文案。
- 公开接缝：`tool_result.input.path` 与 `isError` 同时适用于 code 的嵌套 `gateway.skill_read`、direct 的 `skill_read`；启用 `localTools` 后两档的原生 `read` 仅按绝对受管路径计。`skill_read` 的相对路径沿用现有 reader 的共享目录。分页／SDK 截断成功也计；不聚合页面、不解析输出文本。`disable-model-invocation` 只影响广告，显式成功读取仍计。
- 保留原生 loader／formatter／reader、slash 展开与证据 frontmatter 不变。原生 `bash` 无可靠公开文件读取身份；slash 的 `input` 在展开前，没有成功展开身份事件，因此两者按任务授权排除计数，不用文本相等、时序猜测、私有拦截或影子生命周期补齐。
- 回归在真实 SDK＋隔离 Gateway/HTTP＋Jupyter＋faux 与公共 SkillLibrary／原生 loader 接缝覆盖未读多会话不晋升、成功读取阈值、重复读取时间戳、各 reader、原生本机 read、隐藏／分页／截断读取及原有闲置／容量／人工生命周期。临时改回广告计数必须红，恢复后绿；只说明受控路径，不宣称真实模型学习质量。最终 quick／相关 full／浏览器由独立验收流执行。

## 2026-10-26 PRK-LEARN-R1：共享原生 skills 与主动沉淀

- 决定：统一 `<PRK home>/skills/<name>/SKILL.md` 与可选 supporting files，全会话共享一份；`skills/library.json` 只存 PRK 生命周期。保持 Pi 1.3.0 `DefaultResourceLoader`，经公开 `resources_discover` 加载 staging/promoted；不替换 loader、不改上游、不接管 SDK 生命周期。`session.noSkills` 默认 `false`，显式关闭时不发布共享 skill 路径；变更发现结果沿用下一会话／原生 reload。
- 生命周期沿用沉淀工具的 staging → promoted → archived 思路与嵌套配置风格：默认 staging 20／14 天，promoted 15／14 天，3 个原生会话晋升，archive 200。手动转正占容量且免疫自动降级；降级／归档移除免疫；恢复回 staging；删除移除文件与元数据。skills 保留当前文件树，不另做版本历史。容量／闲置在启动与访问时处理，不加调度器。
- 使用口径已由上方 R2 的成功正文读取语义取代；加载／广告不再作为使用证据。
- skill 文件在 Gateway，不在目标 Jupyter；关闭 `localTools` 时两档均没有原生 host read。必要接入只有 `skill_read`：路径限制在活动共享 skill 内，调用公开 SDK `createReadToolDefinition`，保留原生输出／分页／错误；code 经 `gateway.skill_read`，direct 另声明。原生 `/skill:name` 在两档均可展开正文。SDK 默认仅在 read/bash 存在时广告 skills，因此开关关闭时经公开可变 prompt sections 与导出的 `formatSkillsForPrompt(...,"indirect")` 只广告可读共享路径；开启后保持原生 catalog，其他 project/package skills 保留原生发现、显式 slash 与启用后的 native host read，不伪装成 target 文件。
- `skill_manage` 的写入契约已由上方 R3 结构化接口取代；新建进 staging，归档先人工恢复再编辑。单一应用边界校验名称、目录内路径、符号链接与结果 frontmatter；`SKILL.md` 只由 create／patch 生成。**经验必须带依据**：name／description／when-to-use／evidence 均保留必填校验；依据记录具体任务／会话、用户纠正、失败或观察结果，不做语义打分、不得编造。
- worker 主动沉淀提示、工具理由必填与两个独立开关以 R6 决策为准；一次性脚本、进度和当前状态不存。
- 网页入口放设置对话框，沉淀工具与 Skills 各自打开管理对话框，不增加 workspace 面板。列表／详情显示状态、手动、会话数与最近使用；skill 另显示适用情况、依据，正文来自 SDK `parseFrontmatter(...).body`。沿用工具 HTTP/wire 形状增加 skills list／promote／demote／archive／restore／delete；无兼容接口。
- 验证入口：当时的用例 为真实 SDK＋隔离 Gateway/HTTP＋Jupyter fixture＋faux model 集成；`check-skill-lifecycle.mjs` 以原生 loader 返回值覆盖配置、闲置、容量、人工免疫与持久化。路径校验、staging、新增依据校验分别临时撤除，保留对应红／恢复绿证据；受控 provider 不代表真实模型主动学习效果。完整验收与提交由本轮 director 收口。

## 2026-10-26 PRK-UNIFY-R1：main 合入 worker、统一 worker 工具模式

- 决定：Gateway 只管理 `worker` 会话；原 `main` 会话类型已合入 `worker`，不再有免 kernel 的协调会话或独立会话路由。每个 worker 都是绑定显式配置 Jupyter 实例、kernelspec 与持久化绝对 cwd 的 Pi SDK `AgentSession`。
- `createWorker` 必须提供已配置的 `target`。省略 `kernelName` 时只使用实例可选的 `defaultKernelName`；没有该默认值就必须显式指定，否则在创建 session identity 前失败。省略 `cwd` 使用实例 cwd；显式绝对 cwd 优先。不得由 URL、回环地址、tag、Jupyter 原生默认值或其他 session 推断 target／kernelspec。
- `instances[].local` 默认 `false`；仅显式 `true` 表示 Jupyter 位于 Gateway 主机，不从 URL 或 tag 推断本机属性。
- `session.workerTools` 只决定新 worker 的默认 `toolMode`：`code` 或 `direct`。两档使用同一 `kernel_code`、helpers、Gateway callbacks、tool library 与 `tool_bin`，只改变模型可见工具声明：未叠加本机工具时，`code` 仅声明 `kernel_code`；`direct` 另声明 Gateway／session／ask／允许的 extension tools。独立 `localTools` 开关按上方 PRK-LOCALTOOLS-R1 决策叠加，不是工具模式。
- 每个 worker 将自己的 `toolMode` 持久化在原生 SDK session metadata。`tool-mode` native action 经公开 `AgentSession.setActiveToolsByName` 切换，下一轮 SDK turn 生效（包括当前 turn 内提交的切换），不替换 runtime 或 kernel。修改 `session.workerTools` 只影响新 worker 默认值。
- 派生 worker 默认继承创建者配置的 target，显式 target 优先；不会继承创建者 kernelspec。省略 kernelName 时使用所选实例的默认值，否则失败。worker 可通过既有 session tool 与 code-mode Gateway callback 设置 project。
- 正常 Gateway shutdown 将运行中的 worker 记为 sleeping，并只关闭其拥有的 kernel；之后选择或发送消息会以保存的 target／kernelspec／cwd 唤醒同一 worker，分配新 kernel。明确关闭或进程崩溃丢失的 worker 保持 closed，并在后续消息走现有 `auto` 恢复；未知操作绝不重放。
- “main 已并入 worker”是会话类型 cutover；旧 `python`／`all` 是工具模式决策。两项旧合同都不迁移、不经兼容路径选择；任何过期记录清理均由操作员明确执行。下方历史验证只作为原候选证据，不代表本 cutover 已验收。

## 2026-10-25 原生 ask 工具：模型向用户提问，网页原生作答（用户确认，`PRK-ASK-R1` / `R2` / `R3` / `R4`，分支 `feat/ask`、`feat/ask-worker`）

- 决定：做成 PRK 自身能力，不是 Pi 插件，也不管 Pi TUI。行为参照 OMP 的 `ask`（多题分 tab、汇总 tab、提交），代码不搬（它依赖 OMP fork 的 pi-tui）。
- 1. Every worker session has the PRK-owned `ask` tool. In `code` mode the model does not see its declaration and a cell calls `gateway.ask(questions=[...])` through the existing Gateway callback; `direct` declares `ask` as an ordinary tool, independently of `localTools`. The schema matches OMP (`questions[]` ≥1, `id/question/header?/options[{label,description?,preview?}]/multi?/recommended?`); labels conflicting with webpage-owned rows (`其他`, `先聊聊`), duplicate question IDs, and duplicate labels within a question are rejected.
- 2. 通道复用扩展 UI 对话框：`extension-ui.ts` 新增 `kind:"ask"`，答案走既有 `nativeAction extension-ui` 的 `dialog`；答案在 `parseAskAnswers` 这一个边界校验，之后传类型化值。对话框通道本身不新增 Gateway 事件或路由（R3 的全局提醒另加了行字段与一个 collection 事件，见 7）。停止 turn 关闭对话框，工具返回取消。
- 3. 网页：输入框上方托盘里的卡片，每题一个 tab + 汇总 tab；单选/多选；`recommended` 只做默认高亮不预选；每题「其他…」（文本）；选项可加备注（文本）；先聊聊；取消；`preview` 用 markdown 渲染。草稿只在页面内存里，刷新不保留（R2 确认维持）。
- 3a.（R2）**取消 = 中止整个 turn**，对齐 OMP：网页「取消」走输入框停止按钮同一条路径（`actions.cancelOperation`），对话框随之关闭，ask 的结果记为取消，模型不再被调用，会话回到可发消息状态；没有可停止的 operation 时才退回只关对话框（`dialog {cancel:true}`）。线协议里的 `dialog cancel` 仍是「只关对话框、turn 继续」。
- 3b.（R2）**只有一题且为单选时不显示汇总 tab**：题目页的主按钮直接是「提交」（先选再点提交，点选不提交；未选时禁用）。多题、或单题多选，仍是 tab + 汇总。
- 其余待定项维持现状（R2 确认）：超时为固定截止时间且对所有题自动选；一题一条备注；选项列表上 Tab 用于切题；结果文本单题也用 `User answers:` 形式。（「提醒只覆盖当前所选会话」已由 R3 的第 7 条取代。）
- 4. 超时 `session.askTimeoutMs`（默认 0 = 不超时）：固定截止时间，到点每题自动选推荐项（无推荐取第一项），结果标注自动选择。
- 5. 等待提醒：标签页标题标记；系统通知放设置、默认关，非安全上下文（http + tailnet）不可用时禁用并说明。不做 TTS。R3 起覆盖所有会话，见 7。
- 6. 结果文本照 OMP `formatQuestionResult` 的形状（纯文本）；`details` 存结构化记录，历史里的 ask 行据此显示每题问题与回答。详见 [wire](docs/wire/transport.md)、[configuration](docs/configuration.md)。
- 7.（R3）**全局等待提醒**（用户定：R1 只提醒所选会话不够）。后端：workbench 快照里每个会话行带 `asking: true`（该会话的活动运行时里有 ask 卡在等；不另存，读该会话的扩展 UI 得出），翻转时推 collection 事件 `session_ask {asking}`，不轮询；运行时随卡消失（关闭、归档、睡眠）也会清掉标记。网页：侧边栏会话行（手机抽屉里同样）显示标记，折叠的分组、折叠的父会话行也显示其内有 ask 在等；标题标记与系统通知（设置里打开时）改为「任何会话有 ask 在等」就触发，每个在等的会话一条通知，点击通知切到那个会话；页面回到前台，或没有任何 ask 在等时，标题恢复。线协议见 [wire](docs/wire/transport.md)。
- 8.（R4）**code 模式下 ask 等待不计入 cell 期限**（用户定：R3 里 `askTimeoutMs=0` 实际被 `executionTimeoutMs` 的 5 分钟截断不合理）：`jupyter.ts` 的 cell 期限只在 cell 干活时走，`ask` 回调等待用户期间暂停，作答/取消/`askTimeoutMs` 超时后从暂停处接着计时；**只对 `ask` 暂停**（`protocol.ts` 的 `USER_WAIT_CALLBACK`），其他 Gateway 回调（等子会话、插件工具）仍算工作量，语义不变；停止 turn 仍立即结束 cell。`recommended` 的说明（0 起的整数下标，不是选项文字）在工具描述、schema 和 code 模式的 worker 提示里写清楚，校验不放宽。
- 9.（R4）**ask 不支持图片**（用户定，取代 R1 的「其他…和备注可贴图」与 R3 里「code 模式传不到图」的遗留问题）：「其他…」和备注都只收文本，卡片里没有图片入口，答案里不带附件（带了就被 `parseAskAnswers` 当非法答案拒绝，不静默丢弃），结果文本没有 `[image N]` 也没有 image block，历史行不显示图片张数；相关代码和额度分配都删干净，没有开关。输入框的附件行为不变（`attachments.js` / `Attachments.jsx` 现在只有输入框用）。用户要给模型看图：点「先聊聊」，再在输入框里贴。

## 2026-10-14 Gateway 分发远程 CLI 二进制 + 内置包装（用户确认，`PRK-REMOTE-BIN-20261014-A1`）

- 理由：查“机器”的能力（如 `dust`）必须在目标机执行，`gateway.<tool>()` 在 Gateway 机器上跑会查错机器；普通 Pi 插件工具仍留在 Gateway。二进制只在 Gateway 侧维护一份，用到时送到目标机执行。
- 1. 来源：用户手动放到 `<PRK home>/assets/bin/<name>/linux-<arch>/<name>`（`codemode.binDir` 可改）；Gateway 只读、只分发，不联网下载。
- 2. 传输：kernel 在当前 cell 内经既有 Jupyter stdin 回调通道向 Gateway 拉取（内部请求 `PRK_GATEWAY_BIN:`，不注册为工具、`gateway.describe()` 看不到），不走 Jupyter Contents API，也不向忙碌 kernel 发第二个 execute。目标机缓存 `codemode.binCacheDir`（默认 `~/.cache/prk/bin/<sha256>/<name>`），sha256 校验、0755、原子 rename；哈希对就不重传。
- 3. 平台：只做 Linux，arch 为 x86_64／aarch64（amd64→x86_64、arm64→aarch64）。非 Linux、无对应资产、缓存不可写或 noexec 都明确报错（缺资产时给出期望路径），不回退到 Gateway 执行。不考虑 Windows。
- 4. 内置包装：prelude 随附 Python 包装，v1 只有 `disk_usage(path='.', depth=1, limit=50, apparent=False)`（dust 1.2.6 `--output-json --output-format b`）。worker 提示词只在资产存在时提 `tool_bin()` 和对应包装名。不改 exposure、prepareLoadout、Pi runtime，不新增工具发现机制。详见 [configuration](docs/configuration.md#gateway-distributed-clis-tool_bin)。

## 2026-10-14 回收站改归档，去掉独立“结束会话”（用户 2026-10-13 确认，`PRK-ARCHIVE-20261014-A3`）

- 取代 09-29「会话生命周期：回收站…」中“恢复后根会话成为独立会话、处于已结束只读状态”与“网页删除＝移入回收站”的条款，以及“已结束的 main 保持关闭”。
- **归档**替代会话菜单的“结束会话”和“删除…”：停止运行、释放 kernel／运行时、从日常列表收起、保留历史。级联沿用原删除预览（Gateway `archivePreview` 计算，客户端不自算）；agent 的 `session_destroy`、任务确认后的自动销毁与网页归档是同一动作。派生会话管理里的“销毁”入口与 `manageSession destroy` 一并删除。停止生成只在输入框旁。
- **侧栏底部“归档”**打开大尺寸归档视图（桌面宽 Modal，手机全屏）：沿用侧栏“空间／项目”分组（同一分组函数），可折叠，文本筛选匹配会话名、实例名、项目名；每行列出实例（kernel）、项目、上级（`↳`），同组子会话按管理关系缩进。数据来自 workbench 快照 `archive` 组，Gateway 为每个会话补 `target`、`kernelName`、`projectId/projectName`，`owner` 为当前管理者（根会话即组外上级）。
- **取消归档**：归档组回到列表，状态 `closed`，不分配运行实例；后续选择或消息按 worker 的恢复规则处理。归属尽力恢复：上级仍在列表（含同组）就保留；上级已不存在或仍在归档里，就作为独立会话恢复（`gateway-derived-detached`），不阻塞、不重建上级。被接回的已确认任务子会话重新计入上级的未收尾子会话，上级可再次归档它。
- **所有会话均为 worker**：正常 Gateway 重启后休眠 worker 由后续选择／消息唤醒；明确关闭或崩溃丢失的 worker 保持关闭并按现有恢复规则处理。归档与恢复不另建会话种类或启动路径。
- **永久删除**只在归档视图里，二次确认后删除该组 SDK 文件（`purgeArchive`）。
- 命名：wire `archiveSession`／`archivePreview`／`unarchive`／`purgeArchive`，事件 `session_archived`／`session_unarchived`／`session_purged`，HTTP `POST /api/workers/:name/archive`、`GET …/archive-preview`、`POST /api/archive/:group/unarchive|purge`；旧 `deleteHistory`／`deletePreview`／`restoreTrash`／`purgeTrash`、`/delete-history`、`/delete-preview`、`/api/trash/*` 与 `POST /api/workers/:name/close` 直接删除，不留别名。Gateway socket 的 `closeWorker` 保留给 CLI。磁盘记录类型 `gateway-session-trash`（含 `trashed` 字段）不改名，旧回收站里的会话直接按归档显示，不写迁移。

## 2026-10-13 取消 session 的“失败”状态（用户决定，`PRK-SESSION-STATE-20261013-A1`）

- 用户决定：模型调用失败不再算 session 失败。session 状态里不再有 `failed`，“恢复”按钮整块删除，发消息本身就是恢复。浏览器↔Gateway 断线仍只由网页连接状态表示，自动重连不变。取代本页 1.2.0 节与 f4c76d0 的“failed main/worker 无输入手动恢复”。
- 操作级失败（重试耗尽、不可重试、SDK 调用异常）与 `unknown` 只记在该操作的 outcome 与 `recentOperations`；Host 回到 `idle`，extension UI 照常，下一条输入直接发；不重放、不自动重试。`agent_end.willRetry` 终态映射不变。
- 没有可用运行实例时 session 为 `unavailable`（沿用 wire 已有值与 `recovery.status:"unavailable"` 投影），`recovery.message` 说明 worker 的目标／kernelspec／cwd 或运行时不可用。下一条消息按已结束 worker 的恢复路径自动尝试：校验并接回原 kernel，否则按原 target/kernelspec/cwd 新建；活着但 kernel 已不能执行的 idle worker 换新 kernel。再失败则 `submitted:false`（`stage` 为 `runtime`/`kernel`）并说明原因，不追加、不重放。`recoverWorker` 只服务 worker（接回、换环境）。
- reload 失败：报错给调用者，Host 状态不变。依据：SDK 文档未声明 reload 失败后 runtime 不可用，原生 TUI `handleReloadCommand` 捕获错误、显示 “Reload failed” 后继续使用同一 session。
- 结束时资源清理未确认：session 仍记为 `closed`；worker 的 kernel 绑定标记“可能残留”，写日志，关闭请求以 `details.closed:true` 报告，网页显示“会话已结束”加清理提示。`host_shutdown_failed` 事件删除，`host_closed.details.failureCount` 保留该事实。

## 2026-10-13 内嵌 Pi 1.2.0 升级候选

- 候选基线 `daily f4c76d0`，只升级项目内嵌 SDK，不升级全局 Pi/OMP 或外部插件，不合入 worker direct 工具候选。根依赖独立安装；现有 `piConfig` 品牌配置工作流不变。
- 当前集中只读组件／KeybindingsManager 接缝绑定 1.2.0；下方 1.1.0 的授权与实测记录保留为历史，边界不扩大。已对照两个版本的声明／源码，并通过真实组件和隔离 agentDir 的 keybindings probe。
- `before_agent_start` 的 user/custom union 和启动 busy 语义已通过真实 Host 测试；worker callable-name prompt 对两种 run 都有效。既有 `agent_end.willRetry` 终态映射、无输入手动恢复相关测试属于旧会话模型的历史证据，不定义当前 worker-only 合同。
- UI probe 与旧会话模型的 Gateway/浏览器验收通过其原有有界合同；全局 theme 依赖用例仍 BLOCKED，不记完整 TUI parity。现装四个非 provider 插件仅证明隔离加载、普通 prompt/context 与 VCC recall custom run；CLIProxyAPI provider 只静态核查，不宣称真实模型/provider 全面兼容。
- 契约与版本核对见 [SDK 参考](docs/pi-sdk/README.md#pi-120-核对2026-10-13)。本轮没有原生 MCP 接入需求，因此不添加 `reachesTools`，不改变 callability/loadout/allow-deny。最终独立验收与上线由外部验收方执行，本候选不 ship。

## 2026-10-12 先做 Pi UI 覆盖测试插件与主题隔离用例，先在 TUI 上证明完备（已实现，原生 TUI 已实测）

- 顺序：实现下节“插件 UI 在网页的承载方式”之前，先做一个测试插件（暂名 `pi-ui-probe`），触发 Pi 1.1.0 插件可用的全部 UI 组件和行为，先在原生 Pi TUI 上跑通、证明覆盖完备；之后同一插件作为 PRK 网页承载的验收用例。
- 覆盖面以 1.1.0 的类型声明为准：
  1. `ExtensionUIContext` 全部成员：`select`、`confirm`、`input`、`editor`、`notify`、`onTerminalInput`、`setStatus`、`setWorkingMessage`、`setWorkingVisible`、`setWorkingIndicator`、`setHiddenThinkingLabel`、`setWidget`（文本行与组件工厂两种）、`setFooter`、`setHeader`、`setTitle`、`custom`、`pasteToEditor`、`setEditorText`、`getEditorText`、`addAutocompleteProvider`、`setEditorComponent`、`getEditorComponent`、`theme`、`getAllThemes`、`getTheme`、`setTheme`、`getToolsExpanded`、`setToolsExpanded`。
  2. `ExtensionAPI` 中产生界面的部分：工具的 `renderCall`／`renderResult`／`renderShell`（`default` 与 `self`），`registerCommand` 与参数补全，`registerShortcut`，`registerMessageRenderer`、`registerEntryRenderer`、`registerToolRenderer`、`registerMarkdownTransformer`，`sendMessage`（显示与不显示），`sendUserMessage`，`setSessionName`、`setLabel`，以及 `ui_prompt_start`／`ui_prompt_end`、`input` 事件。
  3. 选项与行为：对话框的 `timeout` 倒计时和 `signal` 取消；widget 上下两种位置、覆盖与清除；`custom()` 的 overlay 与替换编辑器两种挂法、`done`、`dispose`、`requestRender` 驱动的持续刷新；overlay 的锚点、边距、百分比尺寸、`maxHeight`、`setHidden`、叠放、不抢焦点与焦点切换；`setFooter`、`setHeader` 的设置与恢复；`setEditorComponent` 调用被忽略。
  4. 组件：pi-tui 导出的全部组件（`Box`、`CancellableLoader`、`Editor`、`HStack`、`Image`、`Input`、`Loader`、`Markdown`、`MouseRegion`、`ScrollView`、`SelectList`、`SettingsList`、`Spacer`、`Text`、`TruncatedText`、`VStack`）和 Pi 交互模式导出、插件可复用的组件（如 `BorderedLoader`、`DynamicBorder`、`CustomEditor`）各至少出现在一个用例里；另加一个只实现 `render`／`handleInput` 的自写组件，覆盖“读不出结构”的路径。
  5. 主题：`theme.fg` 的 49 个前景 token、`theme.bg` 的 7 个背景 token，以及 `bold`、`italic`、`underline`、`inverse`、`strikethrough`。
- 完备性怎么证明：用例表在类型上绑定 Pi 的声明（如 `satisfies Record<keyof ExtensionUIContext, …>`、`Record<ThemeColor, …>`、`Record<ThemeBg, …>`），漏掉一项或升级 Pi 后新增成员时类型检查直接失败；pi-tui 导出的组件用脚本对照其 `index.d.ts` 核对。TUI 侧在 tmux 中启动原生 Pi，逐个用例触发并抓屏留证。
- 主题隔离用例：TUI 主题怎么变都不影响网页（见下节“主题与网页”）。用 `pi-cc-extensions`（minuque，把 Pi 改成 Claude Code 外观，2026-10 月下载约 7.9 万，1.0.1）作被测主题插件，装进测试用 agent 目录，不装日常 PRK home；Pi 1.1.0 下已在独立 agent 目录实测正常装载。它覆盖面广，正好当捣乱样本：自带 `cc-dark`／`cc-light` 主题，`setFooter`、`setHeader`、`setWidget`、`custom()`、`onTerminalInput`，`registerMarkdownTransformer`；工具行与助手消息的样式不走公开的 `registerToolRenderer`，而是给 Pi 交互模式的 `ToolExecutionComponent`、`AssistantMessageComponent` 原型打补丁（替换 `getCallRenderer`／`getResultRenderer`／`getRenderShell`），且仅在 `ctx.mode === "tui" && ctx.hasUI` 时启用；还会直接往 `tui.terminal.write` 写鼠标跟踪序列（`\x1b[?1003h` 等）、给组件原型的 `handleMouse` 打补丁。PRK 不实例化这两个交互模式组件，预期这些原型补丁在 PRK 里没有效果（推测，待实测）。TUI 侧先用它跑一遍 probe 用例确认能正常装载；PRK 侧对比装与不装、切换 `cc-dark`／`cc-light`／`system` 时网页的显示。
- 位置：probe 位于 当时的用例，按 Pi package 结构，不装进 PRK home 的日常 agent。
- 验证：当时的用例 绑定声明并对照组件导出，已纳入当时的冒烟检查。原生 Pi 1.1.0 的无主题插件与带 `pi-cc-extensions@1.0.1` 两组 TUI 用例，以及 `cc-dark`／`cc-light`／`system` 抓屏见当时的实测证据（未随仓库发布）。Image 在 tmux 中仅显示官方 fallback，像素显示未验证；CC 原型样式覆盖真实工具行的差异已留证。网页候选的隔离与限制见下一节，不改记历史 TUI 证据。

## 2026-10-12 插件 UI 网页承载候选（有界实现），2026-10-13 code 模式 worker 普通插件工具放行（已实现）

- 状态：`PRK-WEB-UI-20261012-A1` 在 `feat/extension-web-ui` 接入有界网页承载；仍有明确 TUI-only 阻塞，不记全量 parity PASS。`PRK-WORKER-TOOLS-20261013-A1` 在 `fix/worker-plugin-exposure` 完成相邻普通插件工具准入修复，不扩大 Web UI 范围。本节取代[交互盘点](docs/native-pi-interaction-inventory.md)中“未声明 Web contract 的 extension UI 不执行”的旧决定；受控 provider 只证明机制与传输，不证明付费模型能力。

### 插件 UI

- 有界合同：数据 UI、可解析内置组件、正常工具／消息 renderer 由网页承载；`custom()` 不整体禁用，但不承诺任意终端组件的完整交互；`setEditorComponent()` 被忽略（插件编辑器的逻辑在 `handleInput`，网页不注入原始按键，网页始终保留 PRK 自己的 composer）。需要 raw `handleInput`、mouse、终端状态或全局 TUI theme 的部分单列 BLOCKED；只读显示与取消不冒充完整 TUI。
- 绑定：每个 worker 均由 `bindHostedExtensions` 以 `bindExtensions({ mode: "tui", uiContext })` 接入，`ctx.hasUI` 为真。`mode: "tui"` 是 Pi 1.1.0 的兼容标签，不代表 PRK 有真实终端能力；不实例化 `TUI`／`InteractiveMode`。
- 不做终端模拟：前端不用 xterm，后端不用虚拟 `Terminal` 跑 pi-tui 的 `TUI` 或 `InteractiveMode`，手机不加虚拟按键。
- 数据类接口由网页原生实现：`select`／`confirm`／`input`／`editor` 对话框、`notify`、`setStatus`、`setTitle`、`setWorking*`、`setHiddenThinkingLabel`、文本行 `setWidget`、`setEditorText`／`getEditorText`／`pasteToEditor`、`addAutocompleteProvider`、`getToolsExpanded`／`setToolsExpanded` 与主题接口。
- 主题与网页（2026-10-13 定，取代原“前端一律不渲染颜色”）：网页显示插件文本的颜色语义，不显示 TUI 原始颜色；TUI 主题（含插件 `setTheme`、`pi-cc-extensions` 的 `cc-dark`）不改变网页外观。托管 UI 一律用仓库内 `shared/pi-web-theme.json`（主题名 `prk-web`，经 `additionalThemePaths` 公开加载）：49 个前景 token 各占一个互不相同的 256 色索引（52–100），背景 token 为空（终端默认）。`ctx.ui.theme` 及 widget/header/footer/custom/editor/renderer 工厂拿到的都是它；`getAllThemes`／`getTheme` 照常列出已加载主题；`setTheme` 与 Pi RPC 模式一样返回 `{ success: false }`，不记设置、不假装切换。插件输出原样传给前端；前端（`web/chat/ansi.jsx`，anser 解析 SGR）把标记色反查成 token，再按一张表分组映射到 `--pi-*`（成功／危险／警告／强调／正文／灰／弱化，弱化为灰加降低不透明度），浅色深色随网页主题；写死的 16 色按固定对照表映射（红→危险，绿→成功，黄→警告，蓝／青／洋红→强调，黑／亮黑→灰，白／亮白→正文）；非标记的 256 色与真彩色不显示颜色；背景色、反显不显示；加粗、变暗、斜体、下划线、删除线全部显示。适用于插件显示文本（text 节点／widget／header／footer、status、notification、prompt 标题与正文、renderer 输出、working 文案与指示帧、settings 标签与值、顶栏标题）；输入值、选项、补全候选与 renderer 错误仍 `stripAnsi`。已知上限：插件若写死 52–100 的 256 色会被当作对应 token；Pi `theme.bold/italic/underline/strikethrough/inverse` 走 chalk，Gateway 标准输出不是 TTY 时（systemd、测试）chalk 不输出任何转义，网页因此看不到这些属性——`theme.style()` 与直接 SGR 不受影响；不改 chalk 全局或 `FORCE_COLOR`。只改外观的覆盖（替换 footer／header、重写内置工具渲染、工作提示、Markdown 变换）前端渲染哪些、插件直接写给 `tui.terminal` 的终端控制序列如何处理，仍以 `pi-cc-extensions` 为用例定。
- 组件：在集中 Pi 1.1.0 adapter 中经公开 getter／`children` 及下述已批准字段读取内置组件数据，映射网页原生控件；用户操作调用 `onSelect`／`onCancel`／`onSubmit`／`onEscape` 等已有回调，不模拟按键。`custom()` 支持 overlay／编辑器替换、`done`、`dispose`、`requestRender`。
- 只读组件（`renderCall`／`renderResult`、消息渲染器、不交互的 widget）：后端按客户端宽度调 `render(width)`，结果作只读文本显示，样式按上条“主题与网页”处理；每个客户端按自己的宽度渲染。
- Renderer 合同（`PRK-WEB-UI-RENDER-CONTRACT-20261012-I1`）：网页复用同一份 `toolDefinition` 的 `renderCall`／`renderResult`／`renderShell`，再走原生 `registerToolRenderer` resolver 链；这就是 TUI `getCallRenderer`／`getResultRenderer`／`getRenderShell` accessor 所表达的语义。无需实例化 `ToolExecutionComponent` 或 `InteractiveMode`；适配层直接取定义，必要的已授权只读读取集中在边界。`default` 复用网页默认外壳，`self` 用插件自绘区域；返回组件按各客户端的列宽 `render(width)`。缺少某一 renderer 或该 phase 抛错时保留对应网页默认内容，并显示错误；不把 CC 原型替换当成定义或 resolver。
- 组件数据读取例外（G1）：允许集中、只读读取 Pi 1.1.0 普通 JS 运行时组件数据字段（如 `Text/Markdown.text`、`SelectList.items/filteredItems/selectedIndex`、`SettingsList.items/onChange/onCancel`）；`filteredItems` 承载原生 `setFilter` 后的列表，不能从原始 items 猜测筛选状态。不修改上游对象，不复制私有业务逻辑。该边界版本耦合，升级须重验。
- KeybindingsManager 例外（恢复票已批准）：Pi 1.1.0 root 只导出 coding-agent 类型，但安装目录 `dist/core/keybindings.js` 有真实类。`extension-ui.ts` 通过 `getPackageDir()` + file URL 集中只读导入，并 `create(当前 agentDir)` 传给 custom/editor 工厂；严格检查版本为 `1.1.0`，升级需重验。不用 pi-tui manager 强转，不改全局 manager／原型。旧“用户选择该工厂路径 BLOCKED”记录错误，已纠正。
- 读不出结构的交互组件（只实现 `render`／`handleInput`、不由内置组件组成）：先只读显示 render 结果并提供取消按钮，取消时调 `done` 结束。
- 验证入口：历史 当时的用例 经真实 Pi SDK→Gateway→Unix socket→HTTP native/SSE；当时的用例 增加桌面／手机真实 Vite+Chromium。它们按各自原有会话模型验收，不证明当前 worker-only cutover；`--cc --browser` 加载 CC 负样本，不承载其私有 get* 原型补丁。PASS 只对应各命令实际断言；测试打印的 BLOCKED 不记成功覆盖。
- 具体 BLOCKED：原 probe `tui-settings-list` 的 `getSettingsListTheme()` 和 Pi `ExtensionInputComponent`／`ExtensionSelectorComponent` 构造函数访问未初始化的上游全局 `theme`，真实命令报 `Theme not initialized. Call initTheme() first.`。不通过调用 `initTheme()` 修改全局来消除错误。自行传入 theme 的原生 SettingsList 可经 custom/widget 正常承载；该缺口不扩展成 custom/editor 整体禁用。
- 待决定或未验：`onTerminalInput`、`registerShortcut` 的 Web 输入政策（本轮不新增 raw key 转发／手机虚拟按键）；OSC 8 链接的呈现政策（现剥掉序列，只显示链接文字）；纯装饰覆盖的选择策略；多页面 owner/disconnect 的产品语义（不造 lease）；图片像素／kitty 探针保持停止；终端列宽与网页字体的 CJK 对齐、完整 mouse／IME／硬件光标／terminal.write 不能宣称等价。
- 已装插件的影响（PRK home 5 个包已查）：`pi-web-access` 在有 `uiContext` 后 `hasUI` 为真，`/` 命令中的 `ui.select` 会真实弹出；模型显式请求 `workflow: "summary-review"` 时会在 Gateway 主机执行 `xdg-open`。`pi-cliproxyapi-provider` 的 fast-footer 在 `tui` 下给 Pi 交互模式的 `FooterComponent` 原型打补丁，PRK 不实例化该组件，无效果。`pi-vcc`、`pi-compaction-recall` 只用 `notify`。

### code 模式 worker 的插件工具

- Code-mode workers can invoke registered ordinary extension tools through `gateway.<name>()`; model-visible declarations remain `kernel_code` plus the seven native tools only when the independent `localTools` switch is enabled. The shared `extensions` package/tool policy applies to all workers. Pi's original exposure is preserved: active `direct` tools are callable, registered `codemode`/`deferred` tools are callable, and `model-only`/`hidden` tools are not.
- `selectExtensionToolNames` and `kernel_code.prepareLoadout` preserve this through the public SDK `ctx.executeTool`; no extension exposure is rewritten. The 2026-10-09 role-filtering regression and then-current SDK/Jupyter smoke are historical evidence only, not acceptance of the current worker-only contract.
- The 2026-10-14 prompt correction removed the fixed false web-search claim from code workers; current callable plugin names are supplied dynamically each turn and through `gateway.describe()`.

## 2026-10-09 PRK-CODEMODE 候选：Worker 远端 code 模式（用户授权）

- This historical code-mode candidate documented the original callback/prelude/tracing implementation. Its role-specific tool defaults and old `python`/`all` modes are superseded; the current `code` / `direct` contract and independent `localTools` switch are defined at the top of this file and have no aliases.
- 所有执行沿用 `src/jupyter/kernel/assemble-kernel.ts` 的唯一 owned client。Gateway 会话操作经公开 SDK `ctx.executeTool` 与非阻塞 Jupyter stdin 回调；普通 `input()` 明确失败，取消后的迟到回包丢弃，不重放未知副作用。
- prelude 按模块注入；`gateway.wait` 只读原生 `session_children` 的已提交状态，必须用 child.name；消息使用 child.sessionId，确认使用真实 taskId／result.id，不猜测身份或维护第二任务队列。
- 操作 trace 经私有 MIME 进入原生工具结果 `details.traces` 并随 SDK 历史保存；保留读取、写入和命令启动的尽力记录，过滤解释器路径与 pipe fd，不承诺安全审计或子进程内部可见性。配置与 wire 合同分别见 `docs/configuration.md`、`docs/wire/transport.md`。

## 历史：2026-10-09 daily Gateway-native tools

This branch-specific role policy, cwd selection, target default, and SDK/Jupyter smoke described that daily candidate only. It is superseded by the unified worker tool modes and explicit target contract at the top of this file; it is not evidence that the current cutover was verified.
## 2026-10-09 PRK 独立配置家目录（Phase A 已确认并实现）

- Gateway／API／attach／直接 SDK 验证统一使用 `--home DIR`；其次 `PRK_HOME`，再取有效的绝对 `XDG_CONFIG_HOME/pi-remote-kernel`，否则 `$HOME/.config/pi-remote-kernel`。空或相对 XDG 值按标准忽略；显式空家目录与非法配置启动时明确报错，不启动本地替代服务。
- 家目录下 `config.toml` 保存全局 `derivation` 和 `session`／`jupyter`／`gateway`／`http`／`limits`，完整 `instances` 单独放在 `instances.toml`；SDK 凭据、模型、provider 包与资源使用独立的 `agent/`。不读取 Pi CLI 家目录，不自动迁移真实部署数据。完整键、默认值与有效范围见 [配置说明](docs/configuration.md)。
- `src/` 中的项目行为常量集中为 92 个带加载校验的标量选项，通过显式参数传到原消费点；不增加全局可变配置。实例创建／编辑／删除原子更新 `instances.toml`，保留其他原始字段与 `0600` 文件模式。
- Gateway 历史仍在项目 `.pi/gateway-sessions`；直接 SDK 验证显式使用 `<home>/agent/sessions`。后者通过 SDK 公共 `SettingsManager.fromStorage` 保留全局／项目设置作用域并应用内存队列模式，实际 SDK reload 后不改写原设置文件。测试与 live 脚本使用临时或调用者明确准备的独立家目录。
- 本轮只完成 Phase A。收件方 inbox、整批合并信封／网页解析分组、停止／拒绝投递丢弃通知、用户排队输入取回与一次回复限制留给单独执行的 Phase B；声明它们的配置上限不代表已实现这些语义。网页没有视觉改动。
- 验证证据：配置专测覆盖家目录优先级、XDG 边界、默认值、校验、真实 CLI 拒绝与真实 HTTP 编辑保留；直接 SDK reload 和原生 plain-send／scope 上限的真实调用 smoke 已通过。完整后端／浏览器门禁和提交记录写在任务外部 `impl-report.md`；不运行付费模型验收、不改动真实 `.runtime` 与凭据目录。
- Phase A 审查修复：路由／请求／操作 ID 上限分别不得小于 44／90／73，覆盖项目前缀 UUID、派生转移复合请求和 SDK 会话复合操作；实例 `name` 加载时按路由上限校验。无运行时消费点的本地 Jupyter 端口选项已移除，测试 fixture 自己传入发现端口。
- Phase A fix 2：独立家目录解析后，在导入／初始化 SDK 及 provider 扩展前统一设置 `PI_CODING_AGENT_DIR=<home>/agent`，覆盖继承值而不把它作为输入来源；子进程继承该目录。provider 自有配置（例如 `cliproxyapi.json`）也必须放在独立 `agent/` 中。真实 Gateway CLI 扩展回归验证 SDK 公共目录查询、环境与子进程一致，空 HOME 下没有 SDK `.pi` 落盘。

## 2026-09-30 前后端拆分：后端只提供 /api，前端由 web/ 的 Vite 独立运行（已确认并实现）

- 用户确认：开发阶段前后端彻底分开，改后端不用管前端、前端改动热更新；接受开发时 Vite 红色报错页、暂不设前端 CSP。否决了“Node 仍托管 dist、另开 Vite dev”的折中。
- **后端**（`node src/main.ts web`）只提供 `/api` JSON/SSE：删除 dist 读取与静态托管（`/`、`/web/*`）、每响应 CSP nonce 和 `--debug`；旧页面路径返回 404 JSON，API 响应带 `default-src 'none'; frame-ancestors 'none'`。Host/Origin/Sec-Fetch-Site 校验不变，不加 CORS。Gateway 所有权语义不变：停止 API 不清理 worker 或 kernel。
- **前端** `web/` 是独立 npm 包（自己的 `package.json`、lock、`node_modules`），React/Mantine/assistant-ui/字体/Vite 等只在这里声明；根包只留后端依赖，删除 `build:web`/`preweb`。加 `@vitejs/plugin-react`（Fast Refresh）。去掉 `style-nonce` meta 与 Mantine `getStyleNonce`。字体仍是 npm 本地打包，`assetsInlineLimit: 0` 保留。
- **代理**：`web/vite.config.js` 的 dev 与 preview 都把 `/api` 代理到 `PRK_API`（默认 `http://127.0.0.1:8787`），`changeOrigin`；只有等于页面自身 origin 的 `Origin` 才改写为后端 origin（`bypass` 钩子里同步改），其他 Origin 原样转发，后端照常拒绝跨站修改。
- **侧栏去掉“历史”折叠**：回收站已承担删除语义、已关闭会话可恢复；原来只折叠顶层已关闭会话、子会话已关闭却留在树里，规则不一致。已关闭/已结束的顶层行排在可运行行之后同列显示，保留空心点、状态文字和变淡外观；树关系不变。
- **测试**：当时的用例 为每个测试后端起一个真实 Vite dev 子进程，页面打开它，直连 HTTP 的边界检查仍打 API。重启 API 的测试（native 断线重连、history、idle、workbench、model-live、recovery）让 API 回到原端口、前端保持运行。`web-server-smoke` 改为验证 API-only。浏览器测试不再需要先构建。
- **本机启动**：`.runtime/start-tmux.sh`（gitignored）改为 `prk` 的 jupyter / gateway / api（127.0.0.1:8788）/ ui（Vite，监听私网 Tailscale 地址的 8787 端口，`PRK_API=http://127.0.0.1:8788`）四个窗口，页面仍在 8787。2026-09-30 已切换：原 `web` 窗口换成 `api` + `ui`，gateway / jupyter 未重启。
- 下方历史章节里“`npm run web` 先构建 dist”“运行浏览器验收前先 `npm run build:web`”“Node 托管 `web/dist` 并注入 CSP nonce”的说法均被本节取代。
- 验证：`tsc --noEmit`；`cd web && npm run build`（字体为独立 woff2，CSS 无 `data:font`）；`web-server-smoke`（API-only）；浏览器 server / workbench / native / history / derived / idle / machine / recovery 八组经 Vite dev 全部 PASS；`check-target-reload`、`check-history-protocol`、`check-recovery-protocol` PASS；mock-harness `session-tree`、`ui-tour` 浅深色与手机截图目视正常、没有“历史”分组。真实 Gateway + Vite 代理探针：同源 GET 与 SSE 通；外来 Origin、`null`、无 Origin 的修改请求、`Sec-Fetch-Site: cross-site` 均 403；API 停止时 502，同端口重启后恢复。
- 顺带修正：recovery 浏览器夹具还在找 09-22 已移走的顶栏“会话设置”按钮，并断言 `state` 报错（Gateway 现返回存档快照）；改为走侧栏行菜单，断言 `closed`、没有 kernel、Jupyter kernel 列表不变。结束会话后侧栏底部误显示“正在重新连接…”：`worker_closed` 时一并清掉 `reconnecting`，截图确认为“未连接”。
- 未覆盖：`check-web-model-live --controlled` 自 `2318ba9`（09-21）起就跑不通——`workerConfig` 定义被删（已补回），随后仍按旧名 `sameenv` 找新建按钮而超时；属拆分前遗留，本轮未修，它的 Vite 入口迁移只做了语法检查。

## 2026-09-29 派生会话的项目归属与两个视图里的会话树（已确认并实现）

- 依据 09-19「项目／实例双视图」与 09-21 多类会话候选：空间视图按实例列出 worker；项目只是 `{projectId,projectName}` 归组，不授予管理权、不改变派生关系。上一版会话树曾将不同实例的会话错误地按管理关系嵌套；这段历史仅说明当时修复，不定义当前结构。
- 会话树只在同一分组内按当前管理者挂；空间视图按实例分组，跨实例子会话作为顶层行并显示管理者提示，同实例 worker 父子照常挂树。项目视图里管理者与子会话同属一个项目时才挂在一起，不同项目各归各的。删除确认框和连带销毁仍按完整管理关系计算。
- 派生时默认继承创建者的项目（未归类的创建者派生出未归类的子会话）；复制和“在新会话中继续”同样继承。这是创建时的默认值，之后可改。
- `session_spawn` 不带项目参数、不做项目权限判断，子会话一律继承创建者的项目。worker 可通过现有 `session_set_project` session 工具（也可在 code 模式经 Gateway callback）调整归属；项目名已有则复用，`null` 为未归类。用户在网页“所属项目”里也可修改。归组变化发出与网页相同的 `worker_project_assigned` 事件。
- 项目名唯一：Gateway 拒绝把会话归入与另一个项目同名的新项目（归档里的会话也算），网页“新建项目名称”填了已有名称时提示直接选择它。既有同名项目不迁移、不合并。
- 相关历史 `check-derived-sessions`／`check-main-space` 验收基于旧会话模型，仅作原候选证据；不声称验证当前 worker-only 归组及项目工具行为。

## 2026-09-29 会话生命周期：回收站、连带销毁、会话树与工作区失效（已确认并实现）

用户逐条确认，替代此前“销毁即删除受管历史”的实现，以及“不能默认永久保留已销毁会话”（Session Search 一节）的旧决定：

- **销毁 = 关闭并移入回收站。** agent 的 `session_destroy`、`task` 型孩子在结果确认后的自动销毁、网页上的“删除”统一为同一动作：结束运行、关闭 kernel，会话从左侧栏、`agent_list`、`session_children` 消失，不能被消息或唤醒拉回；SDK JSONL 保留。只有在回收站里执行“彻底删除”才删除 JSONL。回收站没有自动过期。
- **连带销毁。** 销毁一个会话时，先逐层（最深一层先）销毁它当前负责的子会话，`task` 与 `creator` 两档都算；已升级为 `user` 的会话、已交接给别人的会话不连带。连带跟随当前管理关系，不跟随原始创建来源。正在执行的子会话先中断再关闭；目标侧已执行的操作不回滚。
- **网页删除前确认。** 点击删除时弹出确认框，展示这次会被销毁的整棵会话树：正在运行的节点标明将被中断，不随之销毁的会话（已升级、已交接）灰色标“保留”。确认框与左侧栏使用同一份管理关系。
- **回收站。** 一次销毁连带进去的一整棵树作为一个整体恢复或彻底删除。恢复后根会话成为用户管理的独立会话：不再记录原创建者与管理者（`user` 型、无来源依赖），树内父子关系保留；恢复出来的会话处于已结束、只读状态，要用再按现有方式继续或恢复执行环境。
- **左侧栏会话树。** 派生会话挂在当前管理者下，默认展开，可折叠；`task` 型在视觉上更小、更“临时”，与长期会话区分。已升级为 `user` 的会话显示在顶层。
- **`agent_list` 只列运行中和休眠中的会话**（用户可见、且能收到消息的那些）；已结束、在回收站里的不列。
- **已提交结果、等待确认的子会话允许空闲休眠**，释放 kernel；结果与结果通知保留，有消息时唤醒。
- **关闭不依赖 kernel 可达。** 销毁、连带销毁、进回收站、空闲休眠都先尝试关闭 kernel；关不掉时记录日志并在会话上标“kernel 可能残留在目标机上”，流程照常完成（回收站条目同样显示）。用户接受目标机上可能残留无人管理的 kernel，由用户在目标机上手动清理。
- **工作区失效明确报错。** Jupyter 启动 kernel 时，路径不存在会悄悄退到上一级存在的目录（jupyter_server `cwd_for_path`）；本项目随后显式 `os.chdir` 会失败，但报错笼统。改为启动前经 Jupyter 文件接口确认工作目录存在，不存在时明确报“工作目录在目标上不存在”。
- **强行恢复到新的执行环境。** 只缺工作目录时，可选择新工作目录恢复，目标与 kernel 类型不变；目标或 kernel 也没了时，可重新选择目标、kernel 与工作目录恢复。新的选择追加写入会话的执行环境记录，并向会话写入通知：工作区已从旧位置换到新位置，原目录文件不在，Python 变量不在。强行恢复不搬文件。入口出现在已结束会话、唤醒失败的休眠会话、从回收站恢复出来的会话；只能由用户手动触发，agent 发消息给这类会话只得到明确报错。

实现（同日）：
- 存储：SDK JSONL 追加 `gateway-session-trash`（进出回收站，带组名、时间、kernel 可能残留标记）与 `gateway-worker-retarget`（最新一条覆盖创建时的目标、kernel 类型与工作目录）；恢复时对根会话追加 `gateway-derived-detached`，派生元数据读取遇到它即视为非派生。三类记录都按会话 ID 限定，复制会话不继承。`listAll` 只返回可见会话，回收站另由 `listTrashed` 列出；只有彻底删除调用原有的文件删除。
- 连带：`derived-session.ts` 的 `plan` 按当前管理关系算出销毁顺序（最深一层先）与保留列表，`session_destroy`、结果确认后的自动销毁、网页删除共用同一条路径；有子会话不再拒绝销毁。正在启动、关闭或切换休眠的会话仍拒绝删除（BUSY），避免与启动互相等待。
- 接口：Gateway socket 与 HTTP 新增 `deletePreview`（`GET /api/workers/:name/delete-preview`）、`restoreTrash`、`purgeTrash`（`POST /api/trash/:group/restore|purge`，后者要求 `{confirm:true}`）；`recoverWorker` 的 `new` 可带 `target`、`kernelName`、`cwd`；workbench 快照带 `trash`。生命周期事件新增 `session_trashed`、`session_restored`、`session_purged`，原 `worker_history_deleted` 不再使用，已整块移除。
- 关闭：销毁时 kernel 关不掉会复位运行记录、在 kernel 绑定上写明“可能残留”、照常进回收站；空闲休眠时 worker 关不掉同样标记后照常休眠。更正：此前说“休眠失败会每秒重试刷日志”不对——休眠标记在关闭前已写入，不会重试；原来的问题只是没有标记、并发出一次 `session_sleep_failed`。
- 工作区：Jupyter 文件接口返回 404 时报“工作目录在目标上不存在”；绝对路径经 `os.chdir` 失败时按 `FileNotFoundError`／`NotADirectoryError` 给出同样明确的报错。强行换环境先释放已关闭的运行绑定（`WorkerCollection.forget`），再写入新选择并新建 kernel；失败时恢复原选择。换环境的说明通过 SDK `sendCustomMessage`（不触发新一轮）写入当前上下文。
- 网页：左侧栏按当前管理者挂树（同一分组内才挂，见上一节更正），默认展开、可折叠，临时会话单行更小、带虚线“临时”标记；删除弹出受影响的树（运行中标“将被中断”，已升级／已交接的列为保留）；侧栏底部“回收站”按组恢复或二次确认后彻底删除；已结束和休眠的执行会话菜单与恢复提示里有“换到新的执行环境…”，复用新建会话的实例、kernel、目录选择。
- 验证：`tsc --noEmit`、`build:web`；`check-derived-sessions`（新增连带、预览、`agent_list` 排除回收站、回收站跨重启、恢复后根脱离依赖、网页删除同一连带、彻底删除）、`check-gateway-history`（删除运行中会话进回收站、文件保留、彻底删除才删文件）、`check-recovery-protocol`（换环境参数）、新增 `check-workspace-retarget`（真实 Jupyter：工作目录被删明确报错、失败恢复原选择、换目录和换目标后在新位置运行、说明写入、重启后保留）、`check-idle-resume`、`check-agent-messaging`、`check-main-space`、`check-gateway-workers`、`check-history-protocol`、`check-worker-lifecycle` 均通过；`check-web-history` 按新语义改为删除进回收站后再彻底删除；假数据场景 `session-tree` 桌面浅色／深色与手机截图目视确认。`check-recovery-runtime` 在改动前的 HEAD 上同样失败（测试替身缺 `getContextUsage`），与本轮无关，未修。
- 未覆盖：kernel 关不掉的残留标记路径、已提交结果的子会话实际进入休眠，只有代码与类型检查，没有专门测试。

## 2026-09-29 Agent 间通信：历史行为与真实模型实测

- 历史实现曾向 main 与 worker 注册 `agent_list`、`agent_send`；真实模型场景直接创建了两个 worker。其消息头、队列、回复抑制和验收结果仅描述当时实现，不构成当前工具策略或 worker-only cutover 的验证。
- 空闲休眠合入后：`agent_send` 投递经 `host.submit` → `admitInput` → `wake`，与用户输入唤醒休眠会话同一路径。按代码，发给休眠会话会先唤醒再投递；目前没有测试覆盖，不算已验证。已明确结束的会话仍返回错误。
- 历史受控 provider 测试记录：当时的用例 在 `8f43112` 合并后重跑通过（忙碌时被提问、空闲被唤醒回信、补充要求、错误路径）；这些结果不证明当前实现。
- 真实模型实测（`clp/gpt-6-luna`，thinking low；脚本与证据（transcripts、summary、运行日志）为当时的本地产物，未随仓库发布）：临时 agentDir 只带认证、模型配置和 cliproxy provider，不加载 QQ、权限、herdr 等扩展；历史和 cwd 在临时目录，kernel 用 Jupyter fixture。两个 worker 直接由 Gateway 创建，不经 main 派生。
  - 做对了：分析方用 `agent_list` 按标签找到“Data keeper”，按 UUID `agent_send` 提问；对方正在跑 20 秒的 Python，回执 `queued`，Python 没被打断、结果正确，提问在工具结束后并入同一操作；对方带正确 `replyTo` 作答；分析方被唤醒（`delivered`），写出行数和空值数都正确的说明；对方也完成了自己的任务。
  - 问题：答完之后两边互相道谢／确认了 5 个来回，共 11 次 `agent_send`，其中 9 次是纯确认；分析方每收到一次确认就把说明重写一遍，直到一条“无需进一步操作”后才停。工具说明里“不要回复纯确认消息”对这个模型不起作用，而每条消息末尾“要回答请调用 agent_send…”的提示反而在邀请回复。这是调查文档中“来回互发没有硬性刹车”的实证。
  - 选定：用户选择“发送方可标注无需回复”，同日实现，见下一条。备选的 `replyTo` 链深度上限和只改文案未采用。
- 互发刹车（`agent_send` 新增可选 `expectReply`）：新消息默认期待回复，末尾照旧附“要回答请调用 agent_send…”提示；带 `replyTo` 的回复默认不期待回复，末尾改成“No reply expected for message=…，不要用 agent_send 回它”。回复本身在提问时由发送方显式设 `expectReply=true` 恢复回复提示。Gateway 在内存里记住不期待回复的消息 ID（上限 4096 条，重启即丢，最坏多出一条消息），对它们的 `replyTo` 回复直接报错且不投递，提示有新信息或新问题就不带 `replyTo` 另发。回执里带 `expectReply`。网页解析器同时认两种结尾：回复提示核对发件人和消息 ID，无需回复说明核对消息 ID。
  - 受控测试补了：新消息 `expectReply=true`、回复 `false`；回复里只有无需回复说明；对它回“Thanks!”被拒绝且对方消息数不变；带 `replyTo` 加 `expectReply=true` 的追问保留回复提示。`check-agent-messaging.mjs` 通过。
  - 真实模型复测（同一脚本与场景，`clp/gpt-6-luna`，证据为当时的本地产物，未随仓库发布）：只剩提问和回答 2 次 `agent_send`，没有任何确认往返，也没有触发拒绝；分析方收到答复后直接写出正确说明，Data keeper 的 Python 同样未被打断。首轮是 11 次。
- 网页显示：Gateway 盖章的同伴消息不再显示成用户正文。`web/chat/conversation.js` 的 `parsePeerMessage` 只在消息头与末尾回复提示里的发件人 ID、消息 ID 一致时才认作同伴消息，只用于显示，不参与投递或状态判断。卡片去掉信封，保留“来自会话／主控 + 名称 + 回复”一行；名称可点开发件会话，该会话已不存在时只显示名称。同伴消息不进 ↑ 键的输入历史。`agent_send` 工具行显示为“发送同伴消息 → 接收方名称 · 消息首行”，`agent_list` 显示为“列出同伴会话”。真实模型那 11 条同伴消息全部被识别，普通用户消息没有误判。
- 本轮验证：`tsc --noEmit`、`build:web` 通过；假数据测试台 `peer-messages` 场景在桌面浅色／深色和 390px 手机截图目视确认，点击发件人能切到对应会话；workbench、native、history 三组浏览器回归通过。受控 provider 与假数据只证明链路和显示，模型行为以上面的真实实测为准。
- 仍缺：已读回执（发送方只知道唤醒／排队）、休眠唤醒的测试、跨 Gateway／跨机器转发。

## 2026-09-28 网页改版并入 09-22 候选

- 候选克隆 `pi-remote-kernel-candidate-main-native-ui-20260921-a1` 在 09-22 合入后又提交了 `d0a28ad`、`ddba708`、`fe5a964`，一直没回到 main。本次合并：后端语义照候选收（空闲休眠／唤醒、回复分叉 `fork-reply`、`clearQueue()` 整批取回、内部通知不冒用用户消息、用户正文只由 SDK 消息投影）；网页外观以海岸／夜航改版为准。
- 候选的“历史工具调用汇成一个折叠容器”被按轮次折叠取代：工具行与正文同列按时间顺序，一轮结束后折进“已处理 Xs · N 次工具调用”。工具输入／输出不带复制按钮；复制只留在代码块和消息悬停操作里。
- 2026-10-14 工具行展开体（`web/chat/tool-body.*`、`code.jsx`）：内置工具按名字分流——`kernel_code`/`python` 与 `write` 带行号和语法高亮，`bash` 为 `$ 命令`（行头不再重复命令、不显示前端算的 Wall，只在带 `timeout` 参数时显示 Timeout），`edit` 用结果 `details.diff` 画 diff（行头 `(+N -M)`），`read` 把 Pi 追加的 `[Showing lines …]` 续读提示拎成卡片下的淡色提示行；其余工具用统一的 JSON 输入加 Output 结构。超过 20 行（`TOOL_FOLD_LINES`）的代码、diff、输出只显示前 20 行，其余用“展开剩余 M 行”就地展开，卡片内部没有滚动条，刷新后恢复折叠。父工具（如 `kernel_code`）底部按结果消息上的 SDK `nestedCalls.calls` 列出子调用摘要，失败的标红；不新增后端字段。展开体语法高亮仅在行展开时按需懒加载。
- 输入框只有 ＋、文本、发送／停止。＋ 是小菜单：添加图片或文件、命令、查找当前页、快捷键。模型、思考程度、运行中发送方式（补充当前任务／排到下一轮）和上下文用量圆环放在输入框下方一行；点圆环看 SDK 报告的上下文、消息数、累计 token 和费用。
- 历史网页候选的会话详情曾列出用量与设置控件；其主控／执行会话差异已不适用于统一 worker 模型。当前可用控件与设置写入边界以现行 Gateway/Web 实现及其文档为准。
- 回复下方常驻复制和“在新会话中继续”（`fork-reply`，开新会话，原会话不变）。回复的“…”菜单：引用、回到这里（同一会话内 `navigateTree` 到这条回复，之后发的消息开出新分支）、加标签（`tree-label`）。会话树的标签和筛选改用页内输入框，不再用 `window.prompt`。
- 用户正文只来自 SDK 后，本地请求只在输入框下方显示发送中／结果未知；最近一次操作若被取消、失败或结果未知，结果显示在对话末尾（该操作结束的位置），不猜测归属到哪条用户消息。
- `/` 补全只列网页能执行、且界面上没有专门控件的命令，目前内置命令只剩 `/compact`（带自由文本参数），其余是 skill 和提示模板。每条带一两行中文说明；有更多说明的在单元格右下角打开详细说明弹窗，弹窗只能“填入”，发送才执行。说明文字归 `web/chat/commands.js`，命令是否存在、此刻能否执行仍以 Gateway 能力目录为准。
- 不列出的命令：已有控件的（model、thinking、name、new、resume、copy、tree、fork、session、export、clone、reload、hotkeys、settings）、网页里不单独展示的（changelog）、无意义的（quit、scoped-models）和永久拒绝的（login、logout、trust、share、import、debug、llama 等）。手动输入完整命令仍按原生命令执行，输入框提示对应控件在哪里。
- 历史限制：当时 worker 的文件型 SDK settings 会写入全局 Pi 配置，候选因此只给内存设置会话显示自动压缩／重试开关。这不是当前 worker-only UI 的控件合同；本文件不宣称该全局设置问题已修复。
- 待定：编辑用户消息后重发、同一位置多个分支的 ‹ 1/2 › 切换需要 Gateway 给用户消息补 entryId 和分支数，本轮未做。

## 2026-09-22 功能目录迁移

- 按下方“精简项目布局”归类现有文件；只更新导入、资源定位、测试子进程／Python 路径和 npm 命令，不改变业务语义。公共 `src/main.ts`、`web/main.jsx` 与 `scripts/jupyter-server.py` 入口保持不变，不留旧路径转发层。
- 当前可运行命令以 `package.json` 为准。历史审计段与旧回执保留其验收结果。
- 本轮类型检查、Web 构建、CLI help、SDK／host、Gateway transport、history、main／派生、target reload、Jupyter fixture／spec、kernel recovery 和 native-web 均通过；浏览器实际覆盖桌面与 390px 手机，provider 为受控响应，不代表外部模型或生产部署验收。
- 现有业务配置、依赖锁与上游安装不变；Web／Gateway／本地 Jupyter 服务保持停止。本轮不提交、推送、部署。

## 2026-09-22 显示重连与空闲休眠

- 显示连接使用自动重连，移除主动暂停入口；持续断线提供重试，发送前可恢复连接。恢复只读取当前快照与订阅，不重发旧输入；连接恢复失败保留草稿。未知接收结果仍明确未知，不承诺跨断线精确一次执行。
- 会话连续空闲默认 30 分钟后释放运行时及自有 worker kernel，Gateway 本身继续运行。正在执行、原生队列未清空、压缩或仍承担未完成派生任务责任的会话不回收；浏览历史和事件订阅不延长执行资源寿命。
- 黄色“休眠”与显示断线、明确结束分开。历史、原生会话身份和配置保留；新消息唤醒原会话后仅提交本次输入，不重放旧任务。worker 唤醒创建空 kernel，Python 内存变量不保留；已结束会话不会自动复活，唤醒失败保留休眠身份并报告错误。
- 事件序号属于具体 runtime，不跨休眠重建比较。重新连接的权威快照重建序号基线；旧连接与非当前会话事件仍受连接／路由身份检查约束。
- 用例使用真实 SDK 与隔离 Jupyter、受控 provider，将空闲阈值缩短为 800ms，覆盖实际 kernel 回收／新建、浏览及重启不重放、关闭不复活、失败保留历史、忙碌／排队／未完成子任务保护。设置 `PI_TEST_PLAYWRIGHT` 与 `PI_TEST_CHROMIUM` 时额外验证连续两轮浏览器休眠唤醒、第二轮显示连接中断及每条消息单次提交。
- 本轮通过类型检查、Web 构建、旧检查、旧检查、旧检查、含浏览器的 旧检查 和 旧检查。另现场查看重建后预览的桌面与 390px touch 页面，验证黄色休眠、跨端续聊及无横向溢出。属于隔离 SDK／Jupyter／浏览器验收，不代表真实手机移动网络或外部模型验收；未重启生产入口。

## 2026-09-22 前端交互与回复分叉

- 聊天正文统一为 16px；辅助文本保留更小层级，桌面和 390px 手机布局无横向溢出。输入区、消息操作和候选列表使用短过渡；触屏按钮至少 44px，减少动态效果偏好关闭明显动画。
- 输入框内 `/` 展示安全／受限原生命令及参数补全；候选只呈现名称、说明与必要禁用原因，不堆内部能力字段。方向键、Tab／Enter 和触控只选择候选，显式发送才执行；组合输入 Enter 不发送。更多菜单只保留输入工具、资源与必要树操作，不重复整个命令目录。
- 每条可定位的已保存助手回复下提供分支图标，调用 action-only `fork-reply`；不新增 Web `/fork`。精确 native entry ID 随消息投影返回，后端检查所属分支与 assistant 类型；通过独立打开的 SDK manager 调用 `createBranchedSession(entryId)`，包含该回复、不含后续轮次、不改变源历史。新会话直接打开；普通 worker 使用同 target／kernelspec／cwd 的独立新 kernel，不复制 Python 内存或任务责任。原 `/clone` 的历史副本／显式恢复语义不变。
- 已在隔离预览中实测桌面与 390px touch、斜杠与参数选择、真实 Chromium composition Enter、减少动态效果、消息图标分支及继续发送；真实 Jupyter smoke 验证 worker 分支可直接使用、来源历史未改、后续轮次排除、分支变量为空且来源变量保留。证据为当时的任务产物，未随仓库发布。受控模型只证明交互与 SDK／kernel 行为，不代表外部模型验收；未重启生产入口。
- 后续交互修正：用户正文只由 SDK 消息投影，本地请求仅显示发送／未知状态，不按文本去重；Enter 统一由表单发送，连续两条相同内容仍保留两条。仅存在 SDK 待发文本时，在队列旁提供“取回全部待发送文本”；经用户确认使用公开 `clearQueue()` 整批取回，不模拟逐条撤回。返回文本追加到最新草稿，不清除已有附件／引用；Stop 与队列取回分开。
- 输入框下方常驻模型、思考程度、Steering／Follow-up 下拉和 SDK 上下文使用量。模型来自 Gateway 独立可用模型目录，新建与当前会话都只提供对应模型支持的思考等级；设置切换后重新读取实际快照。菜单移入每张侧栏会话卡片右上，对话框绑定具体目标，非当前卡片操作不会误改上一会话。
- 本轮类型、SDK 检查与桌面／390px 浏览器回归通过；覆盖 Enter 单请求、流式／结束后单用户气泡、重复文本、队列撤销、触控发送方式与会话菜单。另实测无会话时模型发现、切换模型后有效思考等级、真实 SDK 用量与非当前卡片重命名。后续截图只在内存中当场查看，不保存为证据文件。
- 本轮工具区：所有历史调用汇入一个默认折叠容器，最新调用在外部显示一两行摘要、点击才展开完整详情；不显示任何工具复制按钮或纯工具消息的普通操作栏。工具字体与留白单独压缩，正文维持 16px。展开／收起保持阅读锚点，查看历史时新输出不拉到底；主动跳到最新仍有效。
- 页内查找已移出发送表单，独立关闭按钮与 Escape 收起并清空高亮；Enter／Shift+Enter 只跳查找结果，关闭后焦点返回输入框。模型／思考程度下拉不产生聊天回执，失败单独显示错误；主动斜杠命令保留反馈。
- 工具耗时仅使用实际收到的生命周期时间戳；同页重连保留已观测值，缺少事件或历史重载时省略时长，不伪造零值，也不新增持久计时机制。
- 内部派生通知经原生 `sendCustomMessage` 保留为 `gateway-internal-notification`、`display:false`，工作区不展示，不再冒用用户消息身份。SDK 送模型时可转换为 provider user role，不承诺 system-role 通知。旧历史中的无类型 user 通知未迁移或按文本猜删。重复确认只依据当前接收者原生分支中精确的 child/task/result acknowledgment；已入 SDK 队列的晚到通知不能逐条撤回，不加重放／重试调度。
- 主控可通过 `space_status()` 发现配置角色、可用模型、支持的思考等级与继承规则，通过 `space_status({target})` 查询该实例真实 kernelspec；不猜默认 kernel、不自动降级思考等级。手动创建的普通执行会话目前不可被主控接管；升级仅适用于既有派生会话转用户管理。
- 本轮通过 TypeScript、原生 SDK／Host、主控／派生及桌面／390px 浏览器回归，并现场验证工具分组、隐藏内部通知但保留用户同前缀文字、桌面与触控折叠不跳页、新输出不打断历史阅读。受控 provider 验证真实接入链路，不代表外部模型自主决策验收；未保存截图文件。

## 2026-09-21 逐项设计决定：运行时入口与输入接收保证

- 已确认：本项目是现成 Agent 运行时的 UI／接入层，不替 Pi SDK 补更强的执行保证，也不重新实现运行时。UI 展示和项目业务映射使用公开 SDK 调用、状态与原生持久化。
- 第一项 `preflightResult` 的取舍：优先取消项目自加的“执行前可靠落盘、崩溃后精确判定请求是否开始”的强保证，以去掉内部 RPC hook 依赖；SDK 未提供的精确接收和崩溃恢复保证不承诺，不以影子队列、额外状态机或事件时序猜测补齐。
- 正常运行时准确展示 SDK 能提供的状态和错误；异常后无法确认执行结果就明确未知，不自动重发可能产生副作用的操作。这不是精确一次执行承诺。
- 参考边界：Hermes Desktop 将发送持久化交给后端公开 `prompt.submit` 协议，renderer 不重做 Agent 行为；DeepSeek Harness 将输入接收、消息日志与执行交给原生 loop，Web 消费其事件和投影。原生后端具备某项保证，不代表本项目需要绕过 Pi 的公开接口仿造它。来源：[Hermes Desktop](https://github.com/NousResearch/hermes-agent/blob/main/apps/desktop/AGENTS.md)、[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)。
- 第二项已确认：分支总结、压缩与发送沿用 Pi 原生忙碌、排队和取消语义；接入层保留基于公开 `isCompacting`／`isIdle` 的轻量检查及草稿、错误反馈，不追求跨客户端／异步步骤的额外原子并发保证。不为未复现的理论竞态添加锁、影子状态机或内部钩子。
- 实现依据为当前 Pi SDK 0.85.1：`isCompacting` 包含分支总结；原生 TUI 在此期间临时保存尚未提交的普通输入，结束后再交给 SDK，生成中输入使用原生 steer／followUp。入口暂存未提交输入不等同于复制 SDK 队列权威；SDK `prompt()` 对分支总结并非全程自动互斥，不能取消所有接入协调后宣称原生兜底。
- 第三项已确认：需要历史分支／复制时复用 Pi 原生 branch、createBranchedSession、forkFrom 或 runtime fork 的相应公开语义，不维护项目自己的逐条历史复制、ID 重映射和过滤式 fork 实现。普通派生任务不自动等于历史 fork；此前“用户明确要求派生时完整继承指定分支历史”的归因已由用户否认，下文相关旧描述不能作为既定需求或实施授权。
- fork 责任映射：`gateway-session-capability` 只接受 version 2 且携带原生 `sessionId`，不新增存储、marker 或迁移。自属 capability 下仅同 subject 的任务／目标／kernel／回执／归档／结束状态授予当前权限；复制的记录仅是历史。带 native parentSession 但无合法自属 capability 的 fork 不继承来源权限，保持不可用／未受管。普通受管记录损坏仍报错。只调整项目 authority readers，不过滤 SDK 上下文／历史。
- 第四项已确认：导出直接采用 Pi 原生公开导出能力及其语义，不维护只读历史的自制 JSONL／HTML 序列化替代路径，不新增原始文件下载等替代功能。遇到原生接口前提不满足时如实说明，不以自制降级结果冒充原生导出，也不为导出自动启动模型、kernel 或恢复任务。
- 第五项已确认：会话历史用于日常回看和续聊，不承担高级审计、逐条无损追溯或额外完整性保证。读取、坏行处理、分支与上下文压缩沿用 Pi 原生公开能力及其语义；不再维护比原生更严格的 JSONL framing／历史解析包装，不因原生允许的情况额外拒绝历史，也不为压缩前后逐条对账增加机制。正常报告原生读取错误即可；本决定不授权主动删除历史或把读取失败伪装成成功。
- 第六项已确认：F4“同文本、不同附件的排队消息精确取回”明确不实现，不是暂缓或待办。从后续修复范围和验收门槛移除，不为此增加 SDK 队列拦截、影子状态或精确附件关联机制；R22 中仅为支持这一边界的要求一并取消。不删除普通消息发送或一般取回功能。既有复现仅保留为历史证据，不触发自动排期，不记为已修复或 PASS。
- 第七项已确认：剪贴板仅按真实使用需求实现：使用浏览器标准接口执行复制，失败时给出明确提示，不假报成功。不再为强制模拟剪贴板权限拒绝增加机制、浏览器兼容层或故障注入工程；该特定拒绝状态的复现不作为交付门槛。正常复制仍需验证，既有拒绝场景未测成不记为已通过。
- 2026-09-22 独立 OMP review（clp/gpt-6-astra，low）已完成，用户认可报告建议。审查仅使用 read／grep／glob，未改文件、运行测试或启动服务；静态建议不等于运行验收通过。以下收口优先于旧审计和验收矩阵，不构成代码修改、恢复流水线或部署授权。
- 第九项已确认：WebUI 不提供“替换当前会话身份”的语义；新建是新增独立会话并打开，切换是打开已有会话，原会话身份与历史不被替换。页面切换不隐式销毁旧 runtime／kernel，浏览历史不隐式启动执行环境；生命周期仍由明确操作管理。本项不涉及删除会话树功能。
- TUI 的新会话操作沿用 Pi 原生 `/new` 生命周期与错误处理。Web/Gateway 新建独立会话并打开、resume 打开已有会话，不替换来源身份或隐式关闭旧 runtime/kernel。不叠加跨文件事务、staged replacement、commit/rollback 或任意失败精确恢复承诺。保留必要归属映射、错误反馈与未知副作用不重放。
- Review 收口一：会话树查看、筛选、折叠、复制等只读／展示操作直接返回结果，展示状态留在前端，不追加持久 custom entry／custom message，不推进 SDK 历史叶节点；功能本身不删除。依据：`src/sessions/native-interactions.ts` 的 `appendResult()` 与 tree action 路径。
- Review 收口二：改名、项目归类及普通历史选择不复用删除级整文件审计，取消重复解析、重复打开和 inode 永不变化的承诺。保留受管目录、正确会话身份及防止符号链接写穿／误删的必要检查；真实删除仍须确认归属。依据：`src/sessions/worker-history.ts` 的 `validateForDelete()` 及其普通操作调用者。
- Review 收口三：原生命令不另建跨历史的永久回执、精确恢复和跨重启结果去重体系；与第一项取消自加精确接收保证统一收口。保留当前请求关联、运行中取消、必要误重复保护及明确错误反馈，断连后读取原生状态，不自动重发副作用。删除仅为证明额外持久回执恢复而裁剪 JSONL 的验收要求，不另造幂等框架。依据：`src/sessions/native-interactions.ts` 的 `persistedResult()`／`admitMutation()`。
- Review 收口四：会话替换事务按第九项处理；原生接口存在不等于已验证 kernel、路由与管理关系的完整接入，不孤立删除仍被其他必要状态依赖的排序或记录。
- Review 收口五：Unix socket 接受可信单用户的正常生命周期，不承诺同 UID／root 在运行中主动替换 endpoint 后仍维持原保护。采用标准 Node 单路径监听，移除仅服务该保证的私有 bind 名称、hard-link 发布及替换注入门槛；目录／socket 权限与已有路径行为现以 PRK-DESEC 为准，退出仍关闭自有资源。减少保证不声称行为完全等价。
- Review 保留边界：真实销毁授权与结果确认、执行目标归属、避免误删、显式 kernel 恢复、不自动重放未知副作用、浏览器 Host／Origin 等跨站防护、合理资源上限和正常错误反馈继续保留。报告未证明当前代码存在私有 ROUTER wedge 注入；该旧验收要求不因本次静态审查自动记为完成或已删除。
- 状态：本节是当前简化合同。最终受控 SDK、native-web、workbench、历史、恢复、main/派生与生命周期检查已通过各自实际断言；fork 责任映射已有 SDK/storage/responsibility 与浏览器证据，不再是待集成项。权威运行结果见当时的 design-simplify verification-results（未随仓库发布）。RPC 公开装配缺口与确定性私有 ROUTER wedge 未证明边界保留；外部真实模型与独立 verifier 不由受控通过替代。不宣称原全量 RUN_COMPLETE、独立接受或部署授权；旧失败保留，正常集成与先前候选／探针缺陷返工分别记录。
- 依赖清理仅移除已退出前端 source-hash 关联的直接 `@noble/hashes` 与对应 lock entry；前端 A1/A2 删除其唯一 conversation consumer。其他依赖版本/integrity 不变，不安装或更改 node_modules；本项须随前端累计 delta 装配，不能单独用于仍有旧 imports 的输入候选。
- `REWORK-INDEPENDENT-3FINDINGS-20260922`：独立 verifier 在旧冻结上确认 DS-F1（closed target-file 执行及 send 准备顺序）、DS-F2（new/resume 旧目录说明）、DS-S1（workbench 全局 EventSource 包装）。原责任链已给出有界修复；Root 的真实 HTTP 复现、原生 SDK、类型检查、workbench 与 native-web 复验通过。旧冻结、失败与带插桩限制的旧 PASS 均不覆盖；新增量及证据见当时的 rework receipt（未随仓库发布）。不恢复已取消保证，不提交、推送、部署或自动整合原分支。
- `COMMIT-MERGE-MAIN-20260922`：用户随后明确授权本地提交已独立复验候选并合并到原项目 main，覆盖前述阶段的不提交／不整合限制；不授权 push、部署、生产启动／重启或第三方修改。独立增量复验已关闭 DS-F1／DS-F2／DS-S1；源码对应冻结 manifest `b1d40f42b362970274b35c63b8d8eb6941e730daaa4630096a1325eb0df7db6a`，保留原项目最新 AGENTS 及 RPC 延期规则。不扩大为全工程 RUN_COMPLETE 或延期功能已通过。

## 历史：2026-09-21 Root 修订范围与独立审查交接

- 用户最新目标优先：代码规范化、通过公开契约降低 SDK 版本耦合、复用 SDK／平台／成熟库，停止为原全量验收强推无公开接缝或代价失衡的边界。保留现有功能与累计补丁；这不授权改变上游、增加兼容框架或静默缩减产品契约。
- 后续有界复验已通过 `npm run check`、Web 构建、公开 SDK resource/export 检查、实际投影的 UTF-8 SHA 对照、无设置分支默认值及历史重开检查。真实桌面／手机两个观察者已验证 main 创建列表刷新、new/resume 的精确 SDK 身份、各自草稿恢复和零输入重放。受控 provider 证据不代表外部模型能力。
- F4 已由后续逐项决定明确不实现，不再属于暂缓项或验收门槛；剪贴板按第七项收窄为正常复制与失败提示，强制复现权限拒绝不再作为交付门槛，原未完成场景不记通过。非剪贴板浏览器补充运行在只读文件故障注入的 `/new` 请求处返回 503，未证明 archive-commit 回滚阶段，后续条款仍未完成。R04/R05 的精确组合场景未由通用 recovery/history/lifecycle 检查替代；新建且有缺陷的组合探针被排除，没有继续堆返工。
- 当前已取消额外原子准入、严格解析、过滤式 fork、永久命令回执、只读自制导出及替换事务保证。仍保留 scoped local-sdk RPC 初始化公开装配缺口与确定性私有 ROUTER wedge 未证明边界。fork 以现有 JSONL subject 映射实现独立责任，不以缺少 metadata filter 推导必须重写历史；运行验证未完成。
- 下文初验段仅保留阶段证据，包括后来修复并复验的类型／export 失败、未完成的 browser 条款及失败探针。当前结果以上述 design-simplify ledger/assembly 为准；旧 `sdk-remediation` ledger、`revised-priority.json` 与冻结回执仍是历史，不覆盖当前合同，也不将失败改记 PASS。

## 历史：2026-09-21 SDK 审计修复初验（不再定义当前合同）

以下保留当时要求、失败与 blocker 的原始口径；其中 preflight、严格解析、metadata-filter fork、永久回执、替换回滚和 hash 关联已被上文简化决定取代。不是当前依赖清单或待实施任务。

- Root has completed one initial central runtime validation after writers stopped; the cumulative candidate remains unaccepted. Older “implemented/passed” text and receipts describe their own stages only. Initial statuses are recorded in the original central verification results and verification-entrypoint ledger (not published with this repository); they do not constitute final SDK public-contract acceptance.
- F4（矩阵 R10）及 R22 中仅为支持该边界的要求，已由后续用户决定明确不实现，从修复与验收范围移除。原失败与 blocker 记录仅作历史证据，不记 PASS，也不再作为未完成任务推动实现；其余矩阵项分别按最新逐项决定处理。
- R14 的恢复浏览器默认监听改为 `127.0.0.1`；显式 `PI_TEST_WEB_HOST` 仍保留私网测试用途。R16 直接声明现有锁定的 `@earendil-works/pi-ai`、`@earendil-works/pi-agent-core` 为精确 `0.85.1`；前端摘要改用精确 `@noble/hashes@2.4.0`（MIT、零运行时依赖、Node >=20.19）。现有其他依赖版本与 integrity 不变；依赖安装由 Root 在写入停止后执行。
- R29 已移除 `scripts/local-sdk.ts` 对全局 console 的重写。公开 `runRpcMode(runtime)` 负责进入 RPC 后的 stdout JSONL 输出；SDK 0.85.1 的 `rpc-mode.d.ts` 无 logger／输出参数，公开 index 未导出其内部 output guard。runtime 创建及 ambient extension 加载发生在 runner 之前，因此初始化日志的 stdout 隔离仍是 **BLOCKED**，不能声称所有 RPC 库日志均走 stderr。可行选择是请求上游提供初始化前的公开输出配置；不复制私有 guard、不改扩展／provider／全局对象来绕过。无模型的 `get_state` 检查只能证明其实际运行环境，不能证明任意扩展初始化输出安全。
- Session owner 静态交接仍报告 R01 内部 preflight 依赖、R02 summary/send 原子准入公开能力及 R20 只读 manager-only 导出能力缺口；这些不是本轮完成项。Root 的初始集中运行是证据而非最终条目验收；其中 TypeScript 类型检查（`npm run check`）和 SDK resource/export 检查失败，正处于有界返工且尚未最终复验。model scope 上限、SDK 资源定位、active export 等候选修复仍不因局部通过而闭合。
- Lifecycle owner 的静态审查早于 Root 初始集中运行；ledger 只记录各入口的初始结果，不关闭仍 pending 的矩阵项。R08/R19 remain **BLOCKED**: the installed native SDK fork has no metadata filter, and its unchanged `copyContext` path can copy task/control metadata. R21 strict corruption parsing remains **BLOCKED**: the SDK parser silently skips malformed records or repairs newlines, so the existing strict wrapper is retained.
- Owner 报告中的 `node scripts/check-conversation-responsibility.mjs` 当时未执行；Root 随后在初始集中运行中执行并通过。单独的 Python/public-client smoke 仍不证明 deterministic wedge guarantee，故其仍为 **BLOCKED**。Root 的 旧检查 初始浏览器子路径失败，后续 browser clauses 未运行；clipboard 旧检查 也实际失败，用户已暂缓进一步 clipboard 返工。Parent **non-document code/metadata** changes are limited to `package.json`, `package-lock.json`, `scripts/recovery-browser-fixture.mjs`, and `scripts/local-sdk.ts`; PLAN.md and the two documentation files are reviewed separately here, so this is not a claim that the total candidate scope is four files. The input-candidate comparison shows no old dependency version/integrity drift, but this is not runtime acceptance.

## 历史：2026-09-21 多类会话候选（已由统一 worker 模型取代）

This candidate's role-specific routes, permissions, tool defaults, project presentation, derivation and lifecycle are not current product contracts. Its initial verification status remains in the historical verification ledger (not published with this repository); those assertions do not accept or verify the current unified worker contract.
## 原生 Pi 交互能力接入：全量盘点与 Web 候选（2026-09-21，初始集中验证未最终接受）

- 当前安装的 `@earendil-works/pi-coding-agent` 0.85.1 由 Gateway 持有唯一 `AgentSession`、`SessionHost` 与 JSONL；Web 不创建第二套 SDK、历史或调度器。`scripts/check-native-interactions.mjs` 与 `scripts/check-native-web-interactions.mjs` 是 Root 初始集中运行的 SDK/browser 验收入口；旧检查 初始通过，而 旧检查 在完成桌面与 390px touch 条款前失败，因此不记最终浏览器验收通过。

- 本次候选已接入原生命令目录、参数补全、目标文件引用、浏览器附件、队列/取消、会话树和 `new/resume/clone` 的 Web 候选路径；仍不实现 Session Search、任意工作中会话通信、OpenViking 迁移。UI 回复分叉已按 2026-09-22 的明确要求补入，见本文开头。信任、登录、登出、分享、导入、shell、模型下载和 Gateway/worker 销毁等敏感权限仍按能力目录拒绝并显示原因；初始集中验证没有改变这些边界，最终 PASS、提交和集成仍由 Smart Cascade Root 在有界返工与复验完成后决定。
- 27 条原生命令全部有去向：23 条 Pi builtin，加上 native CLI `/llama` catalog entry，以及隐藏 dispatch `debug/arminsayshi/dementedelves`（前端目录因此呈现 24 个安全/受限命令条目与 3 个 hidden dispatch）。目录、来源、参数候选和可用状态来自 Gateway catalog；动态 extension、skill、prompt template 逐项显示资源状态，当前 worker 装配保持禁用时显示真实 disabled 原因，不伪造执行。
- `/model`、`/thinking`、`/scoped-models`、`/export` 参数候选来自 SDK catalog，选择只填编辑器，显式发送才执行。Web `new` 新建独立会话并打开，`resume` 打开指定受管会话，不替换来源路由身份、销毁旧 runtime/kernel 或提供事务回滚。`nativeAction.sessionId` 是所属 `worker` 路由下的历史来源／视图，`args.sessionId` 是 resume 目的地，二者独立。`history`／`nativeCapabilities` 同样接受可选精确 sessionId，不改变 route-current；非当前历史没有可用于 mutation 的 runtime。
- `@` 只浏览当前 worker target 相对路径，发送时以 target/session 校验；浏览器附件有界，图片进入 SDK images，文本／引用经 SDK 输入。接受及来源关联仅为瞬态，不再写永久 `gateway-native-input`／命令回执，不从文本摘要猜测附件所属历史。历史展示以 SDK 内容为准，已接受二进制不保存在浏览器 sessionStorage。
- `/`、`@`、未知 slash 与普通文本有明确候选/逃逸路径；`!`/`!!` 的 shell 类前缀在当前 Gateway 仍是权限禁用并显示原因，不把 Gateway 主机当执行位置。未知 slash 点击“普通文本”后才作为普通 prompt 发送。桌面键盘候选导航与显式发送、source inspect/remove/replace、队列 steer/follow-up/dequeue、普通取消和 native branch-summary cancel 均由可见 control 完成；IME composition 的 Enter 在 idle/busy 都不会误提交，手机不依赖硬件键盘。
- 忙碌、steer/follow-up、clearQueue 与取消沿用 SDK；公开 idle/compaction 轻量检查不是跨客户端原子准入。一般 dequeue 只恢复 SDK 返回的文本，不推断 requestId／附件精确关联，F4 明确不实现。cancel-native 只确认取消请求，原操作的 SDK 结果才是终态；费用不回滚。tree/read/copy/filter/fold 只读展示不追加 JSONL、不推进 leaf；真实 tree navigation/summary/label 保留原生效果。
- 当前固定边界：Session Search、任意 session 通信、OpenViking migration 是明确延期；share/login/logout/trust/import/debug/shell/llama/model-download 等 permission-sensitive/external effects 不从聊天执行。`compact`/branch summary 真实调用 model，可能产生 token/cost；普通 read-only 命令不调用模型。失败、BUSY、INVALID_REQUEST、unknown outcome、closed/read-only history 都由 Gateway result/history 显示，不能把错误降级为普通模型回复。
- 当时的原生 SDK 与浏览器检查分别执行；浏览器测试自己启动 `web/` 的 Vite dev（见 2026-09-30 前后端拆分），不需要先构建。Web 检查要求 `PI_TEST_PYTHON`（Jupyter fixture Python）、`PI_TEST_PLAYWRIGHT`（Playwright module）和 `PI_TEST_CHROMIUM`（Chromium executable）；自有 fixture 模式需 unset（不是置空）`JUPYTER_URL`、`JUPYTER_TOKEN`、`PI_TEST_WEB_HOST`。监听使用 loopback `127.0.0.1` 与 owned Unix Gateway socket；`TMPDIR` 必须足够短，使完整 socket path 不超过 100 bytes。受控 provider 只证明本地交互/协议/历史语义，不是外部模型成本或质量证据；external provider/live model 需要明确授权、凭据和单独预算，不能由 controlled PASS 推断。
- Browser run 写入自有 temporary evidence directory，保留 desktop/phone screenshots 与 JSON manifest 并打印目录；没有 product hash router，worker 始终通过 `data-worker` sidebar selection helper 选取，closed/history selection 等待读取只读快照而不是 enabled composer。

### 前端交互要求与实际证据

- 命令/参数候选、引用元数据、普通文本逃逸、附件 preview、queue/cancel、IME、draft persistence、disconnect/reconnect、Gateway/Web restart 由 `scripts/check-native-web-interactions.mjs` 作为候选 locator/button/file-control 验收路径；browser child 已由 Root 初始运行但在后续条款前失败，故这些路径仍非通过证据，`page.evaluate(fetch)` 仅用于 fixture 建立和 authoritative observation。
- 当前 browser evidence 应记录 routing/session 身份、只读操作无历史写入、独立 new/open、实际 SDK context、零自动重放及 screenshots；不要求永久回执／摘要关联／精确取回／替换回滚。初始 browser child 失败及其未运行 manifest/IME/CDP 条款保留为历史，当前 UI 集成待 Root 实测。详见交互盘点和 wire 文档。

### 实际限制与成本口径

- Worker target file 读取受 target/session 精确绑定、相对路径和大小限制；main 没有 target namespace。附件每项 384 KiB、总计 640 KiB，Gateway frame/input 上限仍有效。history 是显式只读 browse，不会分配 kernel、执行模型或 replay。
- Gateway/Web restart 只恢复 JSONL identity/metadata；worker kernel recovery 必须显式选择 reconnect/new，Web 不隐式恢复。断线后请求结果可能 unknown，必须观察 snapshot/history 再决定，不能自动重发。
- 控制 provider 不产生真实账单；`compact`、branch summary 与普通 prompt 在真实 provider 上可能多轮调用并产生成本。live provider 的凭据仅在 Gateway 私有配置中读取，不能进入浏览器、prompt 或 evidence。

## 后续优先：派生 Session、SDK 复用与搜索边界（2026-09-20）

### 已确认范围与取舍

- 用户已从仅规格讨论推进为“先做出来一个能跑的，先跑起来看看”：实现已确认的自动派生闭环，复用原生 SDK；UI 不做重设计，仅补派生来源与必要生命周期操作。不同时铺开完整历史存储、任意跨会话通信和自动调度系统，不迁移数据。生产服务重启仍需另行明确授权。
- 派生 Session 仍是普通 Session，用户可见、可直接进入和介入；允许轻量父子关系，标记由哪个 Agent 会话为了哪个任务自动创建。来源关系不等于无限控制权，不另造隐藏式 subagent 会话体系。
- 用户确认支持嵌套派生：派生 Session 也可以为任务继续创建派生 Session，不限制为 main 或用户直接创建会话才能派生。各层沿用相同的来源、结果确认和生命周期规则；嵌套本身不授予祖先对全部后代的销毁权限。
- 普通派生默认独立新上下文，仅接任务说明与必要材料，不自动 fork。此前把“完整继承指定分支历史”归为用户既定需求的说法已撤回；不再将其作为本轮验收。需要复制时只用 SDK 公开分支语义，不逐条复制／过滤／重映射 ID；复制上下文不复制 Python 内存或任务责任。
- 用户确认派生 Session 默认沿用创建者的 Python 运行环境，分别使用独立 kernel，不共享或自动复制 Python 内存变量。同实例下可访问的项目文件可以共享，独立 kernel 不构成文件系统隔离；共同数据优先通过明确的文件路径与产物传递，当前不引入共享变量空间或共享内存机制。跨实例及 kernelspec 的显式选择接口仍待明确。
- UI 回复点分叉已于 2026-09-22 单独接入，详见本文开头。`/clone` 的明确语义仍是当前 active branch，而不是 `forkFrom` 的整个文件复制；对单独打开的 manager 调用 `createBranchedSession(sourceLeaf)`，不得变更 live source manager/file/leaf。SDK 未公开 force-flush，assistant-free 分支不能持久时明确报告前提，不伪造 assistant 或序列化历史补救。
- 生命周期有三种：任务完成、结果可靠回传且创建者读过结果并明确确认“收到／接受”后自动销毁；持续存在直到创建者 Session 明确终止销毁；持续存在直到用户手动销毁或用户明确授权其他 worker/main 销毁。完成、停止、归档和销毁必须区分。
- 用户确认：派生 Session 通过显式“提交任务结果”工具宣告任务完成，不根据最后一条助手回复或模型停止输出推断完成。普通回复、询问补充信息、模型报错、用户停止及连接中断不触发自动销毁；Gateway 保存并可靠回传结果后，才按生命周期规则收尾。
- 用户选择自动销毁门槛 B：创建者读过本次任务结果并明确确认“收到／接受”，才允许任务型派生 Session 自动销毁。该确认通过创建者显式调用的工具动作表达，关联具体派生 Session、任务及结果，不扫描自然语言回复中的“收到”等字样触发销毁。结果已写入创建者历史不等于已确认；未确认时保留孩子与结果，不因空闲或等待确认自动销毁。该确认不替代创建者管理型的明确终止指令，也不赋予创建者对用户管理型 Session 的销毁权限。具体工具接口和确认持久记录方式仍待明确。
- 嵌套收尾是提交任务结果的前置条件：A 创建 B、B 创建 C 时，B 向 A 提交任务结果之前，必须先处置自己仍负责的 C。可以等待 C 完成、接收确认其结果并完成销毁，也可以在具备权限时明确中断并销毁 C；无论选择哪条路径，C 的销毁必须已经完成，不能仅发出请求。例外仅为 C 已完成所有权交接，或已升级为不再由 B 负责收尾的会话；不能凭交接意向或仅修改标签跳过收尾。该规则沿创建关系逐层适用，不采用“先回传完成结果、等父会话确认后再因孩子尚存而暂缓销毁”的方案。交接、升级及中断销毁仍遵守相应生命周期与用户授权，不获得额外销毁权限。
- 提交任务结果时，由 Gateway 检查调用会话仍负责的子会话是否已经完成上述收尾；存在未处置子会话时拒绝完成提交，明确返回阻塞的子会话及状态，不仅依靠提示词约束。创建来源与当前管理责任分开：交接或升级后仍保留原始创建来源。
- 用户确认所有权交接须接收方显式接受：B 提出将 C 交给 A，接受前 C 仍由 B 负责；接受后，当前管理责任和后续任务结果回传目标转给 A，C 的历史、当前任务与创建来源保持不变。用户可直接指定交接，无须模型双方再次确认。具体工具接口、交接记录和异常处理仍待规格化。
- 用户确认“升级”为用户管理的长期 Session：须用户确认或已有明确授权，Agent 可提出但不能自行升级以绕过收尾。升级后 C 不随 B 的任务结束而销毁，B 不再负责 C 的生命周期收尾；原始创建来源保留，后续销毁由用户或其明确授权者执行。
- 当前只接派生必需的任务交付与结果回传；任意 Session 在工作中互发消息、追加任务或协商等通用通信能力后续另做，不作为自动派生的前置。
- 现阶段优先复用原生 Pi SDK 已有能力：SessionManager 的本地 JSONL、会话身份、消息与自定义记录、历史分支及上下文重建；需要的业务元数据使用 SDK 扩展记录，不重新实现一套历史存储。SDK 的历史树 parentId 或 fork 来源不等同于任务派生关系及其销毁权限。
- 用户确认模型与 thinking 默认继承创建者，并允许派生时显式选择已配置模型；同时支持配置文件中的 role 定义和默认临时派生 Session 模型。按字段取值优先级为派生显式参数、所选 role、任务型临时派生默认值、创建者当前值；不擅自降级或替换不可用模型，创建后不随父会话后续切换而变化。
- OpenViking 保留为后续候选，尚未决定承担搜索归档还是权威存储；不把迁移或重建存储当成派生 Session 的前置。

### Session Search：明确需求，暂不实现

- 搜索用户消息与助手正文，不纳入工具调用参数、工具输出、思考过程及运行诊断；完整执行历史与可搜索内容可以分层，排除搜索不等于删除原始执行记录。
- 搜索结果应能定位回原 Session 与原消息；后续设计须保留这种关联，不仅返回脱离出处的摘要。
- 当前不建设搜索、不预建索引、不选定搜索或存储后端；只保留需求及兼容空间，不因此引入占位框架，也不扩大派生 Session 的前置工作。
- 临时 Session 销毁后保留哪些结果、产物和历史，以及搜索副本随删除如何处理，需在生命周期设计中明确；不能默认永久保留已销毁会话。（2026-09-29 用户改为：销毁即移入回收站、保留 JSONL，回收站中彻底删除才删除；见文件开头同日一节。搜索副本随删除的处理仍待搜索设计时定。）

### 已接入接口与运行方式

- 普通 Gateway 会话通过 Pi SDK 原生 custom tools 使用 `session_spawn`、`session_children`、`session_result`、`session_acknowledge`、`session_transfer`、`session_accept_transfer`、`session_destroy`。Python 仍只负责目标侧执行，派生管理不经 Python 旁路调用。
- `session_spawn` 必填 `task`，默认 `context:task`，保留现有生命周期／role／model／thinking／target／kernelName 业务选择，不会自动 fork。full-context task 模式仍明确未实现，不再归为通用 ownership blocker，也不增加完整历史派生要求。`/clone` 使用独立责任映射：main 经显式 main runtime 创建成为独立受管会话；worker clone 仅历史、不可重连来源 kernel，需明确 fresh recovery。新 clone 不继承 owner/creator/delegate/transfer/result 状态，复制的 delivery receipt 不抑制以后转交给 clone 的结果；项目归类与原生 settings/context 按原有语义保留。SDK 空／仅 user 分支缺少 assistant 时不能持久，明确 unavailable，无 force-flush 或自制替代。映射正在集成，未宣称运行通过。
- `session_result` 提交 `summary` 与可选的产物路径数组 `artifacts`，生成持久 result ID；`session_acknowledge` 必须指定 `child` 与匹配的 `resultId`，且调用者必须是当前管理者。完整结果保存在接收者的 SDK 自定义记录中，并通过现有 SessionHost 提交带来源的结果通知；接收者忙碌时使用 follow-up 队列，不另建调度器。
- 任务型在确认后销毁，创建者管理型确认后仍保留。销毁关闭自有 kernel 并删除受管 SDK 会话文件，不删除项目产物、不回滚目标侧副作用。存在仍归自己管理的子会话时，完成提交或销毁都会拒绝并列出阻塞者。（2026-09-29 起：销毁改为关闭并移入回收站、保留文件，并连带销毁当前负责的子会话；只有完成提交仍要求先收尾子会话。见文件开头同日一节。）
- 用户在派生会话管理入口可直接转交、升级为用户管理、授权其他 Session 销毁或明确销毁。Agent 不能通过派生参数自行创建用户管理型以绕过收尾；需由用户将已创建的派生会话升级。仅打开或插话不隐式改变生命周期，需要长期保留时显式升级。
- 全局配置位于独立 PRK home 的 `config.toml`，实例单独放在 `instances.toml`；home 按 `--home`、`PRK_HOME`、`XDG_CONFIG_HOME/pi-remote-kernel`、`~/.config/pi-remote-kernel` 依次选择。`roles.<名称>` 支持 `model`、`thinkingLevel`、`instructions`；当前默认值与选择规则见 [配置说明](docs/configuration/session.md#derivation)。配置在 Gateway 启动或显式重载实例配置时读取，既有孩子保留自己的已选配置。
- 例如在现有 `config.toml` 增加以下角色说明；模型仍按默认规则选择。指定模型时在角色表填写本机已配置的 `model = "PROVIDER/MODEL"`，不改写或复制凭据。

```toml
[derivation.roles.reviewer]
instructions = "只读检查指定内容，给出有依据的结果，不修改目标文件。"
```
- JSONL 记录创建来源、当前管理者、任务、生命周期、模型及 thinking、结果与确认；Gateway 重启后保留这些记录，不自动重放任务或静默重建 kernel。接收者不在线时保留结果，通知未受理会有日志，恢复后可用 `session_children` 查询并明确确认；不会因为通知失败自动销毁。
- 用例使用真实 Pi SDK 工具调用与 Jupyter、受控模型响应验证嵌套派生、变量隔离、结果确认、权限与持久历史。设置 `PI_TEST_DERIVED_BROWSER=1`，并提供既有 Playwright/Chromium 路径时同时运行手机 UI 验收；这不等于真实外部模型质量验收，也不等于生产已激活。

### 仍不扩展的范围

- Session Search、任意工作中会话通信不在本次实现内。
- 不自动转交孤立会话、不按超时清理未确认结果、不自动重放未知结果的工作。非正常退出后的任务续跑仍须用户显式恢复；不为这轮增加无人值守恢复调度。

## 实例与 kernel 环境模型（2026-09-19）

- 用户确认：一个实例就是一个 Jupyter 入口；运行环境由实例和具体 kernelspec 共同确定，不再给用户增加机器分组或 `default / office` 环境名称层。
- 实例名在初始化配置时填写，默认取实际 Jupyter 端的短 hostname；用户已输入的名称不被覆盖。重名必须报错让用户修改，不自动追加后缀。初始化的 hostname 探测使用并回收自有临时 Python kernel，不以 URL 或转发地址猜测主机名。
- 新建仅在实例旁提供“＋”：查询该实例的 Python kernel 列表，单个直接创建，多个才选择。实例配置不固定 kernel；会话在执行前持久保存实例 ID 与 kernelspec，恢复不得换成新的默认 kernel。
- 用户明确允许隔离验收后停本项目 Gateway，备份并离线迁移配置和历史绑定，再启动新版；已说明正常停止会释放原有 Python kernel、丢失内存变量，聊天历史保留。QQ 不动。
- 迁移副本已生成：两个既有入口保留内部 ID，实例显示名沿用两台机器各自的原名称；四条会话保留路由和 SDK 身份，按现存 kernel 绑定或旧配置的确定语义写入 `python3`。副本生成未改动正式数据；完整验收与正式切换结果在完成后记录。

## 正式前端重构：Mantine 与 assistant-ui（2026-09-19）

- 已切换到 React + Mantine 应用外壳、管理表单与移动端抽屉，以及 assistant-ui 的消息流、Markdown 和工具展示。沿用既有 HTTP/SSE、Gateway 会话所有权与浏览器会话存储，不新增后端会话体系。
- 删除已退出运行链的六个旧 DOM 前端模块及 Marked、DOMPurify 直接依赖。Vite 构建产物位于 `web/dist`；`npm run web` 自动先构建，直接运行 `node src/main.ts web` 前须执行 `npm run build:web`。
- 输入区空闲时不显示排队和停止按钮；执行时显示相应控制。消息菜单支持复制和引用；编辑、重新生成、分支切换仅保留禁用入口，未宣称 Gateway 已实现这些能力。
- 修正工具输出流式更新时的阅读位置、独立展示状态更新相互覆盖，以及切换会话时原生自动滚底覆盖保存位置的问题。先等待消息渲染并恢复位置，再允许原生跟随滚动；加载中的临时滚动不写回保存状态。
- 验收通过：`npm run check`、`npm run build:web`、当时的用例、`check-web-workbench.mjs`、`check-machine-sessions.mjs`、`check-web-history.mjs` 和启用浏览器的 `check-kernel-recovery.mjs`。覆盖真实 SDK/Gateway/Jupyter、流式输出、同环境会话隔离、重启与恢复、只读历史、桌面与 390px 窄屏、焦点返回及无横向溢出；截图和结构化证据为当时的任务产物，未随仓库发布。模型部分使用受控 provider，不冒充真实外部模型调用。
- 另以浏览器直接检查最终构建的桌面和手机抽屉布局。用户随后明确授权提交上线；正式部署仅重启 8787 网页服务加载新构建，Gateway 保持原进程，QQ 入口不动。
- 上线后按用户确认移除全部全局新建入口，只保留机器标题旁的“＋”：单环境直接创建，多环境才弹出仅限本机的环境选择。空白页提示从机器旁新建，无配置时仍提供添加环境入口。机器视图直接显示会话，删除 `default / office` 环境入口及重复位置副标题；项目视图仍保留跨机器位置提示。桌面与手机回归覆盖直接创建、同机选择范围和实际创建归属；既有会话不迁移、不删除。

## 后续规划：项目视图与跨实例 Worker 协作（2026-09-19）

本节记录用户确认的产品方向。2026-09-19 用户随后授权实例配置前端优化，并追加项目／实例双视图与项目归属字段；本轮已实现并通过隔离验收，尚未提交或上线。群级任务与多 Worker 协作仍属后期规划。下方原有内容继续作为历史记录保留。

- 提供两个并列视图：实例视图按运行位置组织会话；项目视图按共同任务组织会话，同一项目可以包含来自不同机器、不同 Jupyter 实例的 Worker。
- 两个视图展示同一批会话，而非复制会话。项目归组与执行位置独立；切换视图或调整项目归属，不迁移 Worker、不重建内核、不清空变量。
- 项目不是 Python 工作目录，也不要求绑定同一目录、Git 仓库或物理机器。先做会话归组，允许未归类会话；归组本身不等于 Worker 已能协作。
- **后期能力：用户向整个项目／会话群发送任务，由群内多个 Worker 协作完成，允许跨机器执行。** 不只是把同一条消息广播给所有 Worker；具体任务分配、协作通信与结果汇总机制留到多 Worker 协作阶段设计，不在此预定调度架构。
- 当前范围：Jupyter 独立连接验证、实例配置与目录选择体验，以及项目／实例双视图和持久化项目归属。项目身份与会话归属复用已有会话持久化，不复制 Worker；群级任务与多 Worker 协作后期另行设计，不作为本轮验收条件，不提前搭调度器或协作占位实现。
- 验收：类型检查、配置／会话持久化、目录发现、内核取消与关闭、HTTP 边界、Gateway 传输和桌面／手机浏览器回归通过；补充验证了旧连接请求返回失效、目录取消／返回与 Token 清空、空 Token 编辑保留凭据、项目归属持久化。独立真实 Jupyter 上的两个配置目标证明归组不改变会话与内核身份，Python 变量分别保留为 41→42 与 99；这是跨实例逻辑与真实内核验证，不冒充两台物理机实测或真实外部模型验收。生产 Gateway、网页与 QQ 入口未重启。

## 既往阶段记录

> **历史记录，不是当前启动或验收指引。** 下文保留此前独立 Web 宿主、上线与有限交付的阶段证据，其中的“当前”、启动顺序和旧 host-live 豁免均属于各自历史阶段。2026-09-18 本轮未提交候选已改为 Gateway 内嵌 Pi SDK 并持有 worker，Web 仅为独立 HTTP/SSE 客户端；当前操作以 [Gateway 指引](docs/wire/transport.md)、[kernel 恢复](docs/kernel-recovery.md) 和 [机器配置](docs/machine-session-management.md) 为准。旧豁免不能作为本轮真实模型检查通过的依据；本轮控制目录中的实际结果与最终独立 verifier 结论分别记录，不能互相替代。生产 8787/18888 保持停止，本轮没有提交、部署或重启生产的授权。

更新：2026-09-18。独立 worker + Jupyter Web workbench 已按用户明确选择的“带限制交付”集成至 main：`web` 单独启动，不创建 main，也不依赖 Gateway daemon。独立 worker/真实模型/真实浏览器路径已验证；旧 main → worker 的 host-live 失败仍保留，后一次 SyntaxError 缺少生成源码，不能宣称全部测试通过。原始失败及最终限制回执保留在 run control；下文 Gateway 历史实测不替代独立 Web 证据。本次前端更新改为单条聊天流、就地工具卡与可持久保存的明暗主题。

## 1. 已确认的产品形态

Pi 是普通 npm SDK 依赖，我们开发自己的应用，不 fork Pi、不把上游 monorepo 作为项目根目录，也不修改 `node_modules`。项目暂名 `pi-remote-kernel`。

**2026-09-18 用户澄清：目标架构以此为准。** 网页连接 Gateway，由 Gateway 派生、创建和持有 worker 会话；网页是客户端，不另设一套独立的 Agent 会话宿主。“网页不需要 main”不等于“网页绕过 Gateway”。下述独立 Web 宿主是当前实现现状，不是最终目标架构，不能把此前的有限验收解释为对该架构的最终确认。

**当前实施顺序：** 先完成网页的机器短 hostname 显示、按机器分组的可折叠会话树和 Markdown 回复渲染，再处理 Gateway 接入与会话恢复。此次记录不构成架构迁移或服务重启授权；不为现有独立 Web 宿主临时另建持久化体系。当前 Web worker 使用 `SessionManager.inMemory(...)`，没有本地会话文件，刷新重连仅在宿主进程存活期间保留上下文；更新服务前须说明会话及 kernel 状态丢失的影响，不能把聊天历史恢复与 Python 变量恢复混为一谈。

**网页修复验收（2026-09-18）：** 机器短 hostname 展示、机器→会话折叠树、Markdown 回复渲染已实现；新增直接依赖 Marked 与 DOMPurify，资源本地提供。`npm run check`、当时的用例 通过，覆盖同机分组、折叠状态保留、Markdown 结构及不安全内容过滤，并复验桌面/手机、会话隔离、重连、取消和自有资源清理。截图为当时的任务产物，未随仓库发布。这是隔离的真实浏览器/SDK/Jupyter、受控 provider 验收；本轮未调用外部模型，未重启现有网页服务，未提交。现有内存会话保持原状，线上仍是旧页面；服务切换须先确认可放弃现有会话及 kernel 状态。

**随后上线确认（2026-09-18）：** 用户明确授权“上线提交重启”。网页与此前多会话改动已提交为 `c979620`；原网页宿主正常退出后，以相同模型、扩展及私网监听参数启动为受管后台进程 `pi-remote-kernel-web`（当前控制连接不在 Herdr 面板内，未控制原面板）。地址仍为原私网地址的 8787 端口。线上新会话与真实模型 Markdown 回复已通过浏览器验收，机器节点显示本机主机名。旧内存会话按授权清空；Jupyter Server 原进程保留，QQ 未操作。此条取代上一条“尚未上线”的阶段状态；Gateway 接入和会话持久化仍未实现。

当前 Web 使用常驻 Node 宿主持有独立 Pi SDK worker sessions，HTTP/SSE 浏览器只是客户端；没有隐藏 main。配置名称代表运行环境，同一环境可以创建多个会话；每个会话有独立路由身份、SDK 上下文和懒创建 retained kernel。断开或重开前端不另建 Agent、不终止执行。既有 Gateway daemon 的具名 main/worker CLI 保留原先按名称复用的语义，不是 Web 前置条件。

初始授权来自批准的任务队列文件：独立 worker、Web workbench、真实浏览器/模型验收三个依赖切片。用户于 2026-09-18 追加授权本地合并提交、在 Herdr 中启动网页与项目 Jupyter，并允许关闭/重启当前网页服务；QQ 及其他生产服务不动。当前前端修改由主助手直接实施。main 编排、多物理机部署、Hash Edit 与跨进程崩溃恢复不在此次范围；隔离测试仅回收自有资源。

### 已确定与尚未实现

- 模型调用、Agent 上下文、消息队列、会话持久化、压缩和插件加载复用 Pi SDK。
- Web worker 由独立 Web 宿主创建和持有；既有 CLI Agent 仍由 Gateway daemon 持有。`src/main.ts daemon` 显式启动宿主，`src/main.ts attach` 只连接已有宿主；无参数只显示帮助并失败，不隐式启动本地 Agent。
- kernel 执行工具通过 SDK 的 `defineTool()` / `customTools` 注册，不再向上游内置工具名单追加 `python`。
- main 与 worker 的模型上下文和执行循环位于 Agent 宿主侧；Python 才通过网络发送到目标 kernel。每个 worker 绑定配置目标上的独立 kernel（可共享同一 Jupyter Server），不增加必经的本地 Python 控制 kernel。
- 配套读取和 Hash Edit 属于未来目标文件能力，参考历史版本校验闭环；不在本轮同机 Gateway/客户端范围内，也不依赖 OMP runtime。
- 当前 Gateway 候选统一持有 main/worker、连接和应用协议；不依赖 Pi 实验性 server/client。最小 attach 客户端不是官方远端 TUI；另有独立 Web 前端，QQ 未实现。
- 现有 Pi/OMP、QQ 和 OpenViking 生产入口不动。

## 2. 官方已提供的接入能力

以实际安装的 `@earendil-works/pi-coding-agent` 0.85.1 合同和官方 SDK 文档为依据：

| 能力 | 公开入口 |
| --- | --- |
| 创建单个会话 | `createAgentSession()` |
| 自定义工具 | `defineTool()`、`customTools` |
| 插件、skills、模板、配置发现 | `DefaultResourceLoader` |
| 新建、切换、fork、导入会话 | `createAgentSessionRuntime()` / `AgentSessionRuntime` |
| 构建 cwd 相关服务与会话 | `createAgentSessionServices()` / `createAgentSessionFromServices()` |
| 官方 stdio JSONL RPC | `runRpcMode(runtime)` |
| 官方 TUI（默认模式） | `InteractiveMode` |

当前 SDK 验证入口共用 runtime 初始化，默认调用 `InteractiveMode`，显式 `--mode rpc` 调用 `runRpcMode(runtime)`。这证明进程内复用能力，不证明它们可以直接 attach 到远端 daemon。后续保留 SDK 会话与插件能力，核对前端接入 seam，不能直接重开现有 TUI 来代替 daemon 客户端。自定义工具采用显式 allowlist 时须包含对应工具名。

### 自定义 RPC 方法的真实缺口

0.85.1 的 `runRpcMode` 只接收 runtime，没有自定义命令 handler 注册参数；它自行接管 stdin/stdout，未知命令返回错误。不能把“公开导出了 RPC runner”误写为“已支持 Flask 式加路由”。

因此区分两条交付：

1. SDK 注册工具 + 官方 stdio RPC：已有进程内宿主验证路径，不等于网络 daemon 或多客户端服务。
2. daemon 的统一应用协议：见 [冻结的 wire v1](docs/wire/transport.md)，state/messages/subscribe/send/cancel/reload/closeWorker/shutdown 全部访问同一 accepted host；无独立 Agent 或 kernel 执行旁路。它不兼容完整官方 stdio JSONL RPC。

先列出实际需要的方法，再核对所选 SDK 的公开 seam。若没有可组合 dispatcher，比较上游小型扩展接口与应用自己的薄 RPC 分发；需要明确是否兼容完整官方 JSONL 协议，再选方案。不要未经确认复制整个 `rpc-mode.ts`、导入包内部路径、抢占同一 stdin 的两个监听器、猴子补丁，或额外启动一个独立 Pi 进程。

当前 Unix socket 使用标准 Node 单路径监听，父目录按默认权限递归创建，不做 mode／uid／realpath 检查。已有 endpoint 能连接则拒绝启动，不能连接则 unlink 后监听；客户端不做 lstat，退出关闭自有资源，路径长度上限保留。不使用私有 bind/hard-link 发布，也不承诺同 UID/root 主动替换 endpoint 后的保护。该单用户边界不是远端 TUI 或 Windows 兼容承诺。

不预先限制自定义 RPC 只能经过模型：应用方法可以直接调用自有执行逻辑，但必须共享目标身份、执行队列和取消语义，不并行绕过同一 kernel 的保护。当前尚未实现或承诺任何 `kernel.execute` 等 RPC 方法。

## 3. 精简项目布局与依赖

```text
pi-remote-kernel/
  PLAN.md
  package.json
  package-lock.json
  tsconfig.json
  .gitignore
  src/
    main.ts               # gateway / attach / web 公共入口
    gateway/              # CLI、Unix socket、wire 协议与 Gateway 宿主
    sessions/             # Pi runtime、会话宿主、原生交互与历史
    workers/              # 执行目标、worker 装配与派生生命周期
    jupyter/              # Jupyter 发现与 retained Python kernel 工具
    http/                 # HTTP/SSE 服务与 Gateway 客户端
    shared/               # 共用错误展示与输出处理
  web/
    main.jsx              # Vite 应用入口
    app/                  # 应用壳、store、events 与会话展示状态
    chat/                 # 对话、剪贴板与聊天样式
    management/           # 实例和会话管理界面
  test/
    gateway/
    sessions/
    workers/
    jupyter/
    web/
    fixtures/             # 共用 Jupyter 与受控 provider/process 夹具
  scripts/
    jupyter-server.py     # 保持原运行入口
    dev/local-sdk.ts      # 独立 SDK/TUI/RPC 开发验证
  docs/archive/           # 原样保留旧稿
  node_modules/           # Pi 及 npm 依赖，不进 Git
```

这里只列当前实现相关模块。kernel 执行已由现有 Jupyter 工具承担；后续目标文件 Python 包仍按需求另行实施，不预建空目录、占位 handler 或通用后端框架。

- 当前运行时依赖为 Pi SDK、官方 `@jupyterlab/services` 与 TypeBox；Python/kernel 工具和 worker 已存在，宿主复用这些实现。
- TypeScript 项目使用当前受支持的 Node，开发依赖用于类型检查。不为启动额外维护一套上游构建脚本。
- `npm install` 建立锁文件，后续 `npm ci` 重现；Pi 更新通过依赖版本与 lockfile，不执行 Git upstream merge。
- 不需要 hydrate 上游模型生成数据或构建 Pi monorepo；使用官方 npm 包携带的运行产物。
- 当前 SDK 基线 0.85.1。升级时核验 SDK 与运行协议，不把 `/docs/latest` 的新增接口无条件当成已安装版本能力。
- 历史 monorepo 的源码、Git 历史、未提交文件和忽略文件移到 workspace 外的回退目录；不把上游任务文件、扩展、AGENTS.md 或构建配置复制进新应用。

## 4. 原 Gateway/main 路线的运行时设计（保留历史，不是 Web 前置条件）

以下 main 委派、物理机映射属于原路线；当前 Web 直接选择独立 worker，不构造 main，同一 Server 可拥有多个隔离 kernel。kernel 隔离不是文件系统或权限沙箱。

```text
UI / CLI / QQ 等客户端
          ↕ 统一 RPC
Agent 宿主机：Gateway daemon
  ├─ main session：面对用户、派发任务、汇总结果
  ├─ worker session A ──网络──→ 物理机 A：kernel A
  ├─ worker session B ──网络──→ 物理机 B：kernel B
  └─ worker session C ──网络──→ 物理机 C：kernel C
```

- **运行归属**：daemon 通过 Pi SDK 创建并持有 main、worker 和远端连接。kernel 在各自物理目标机执行，不把 worker 的模型循环部署到 kernel 内。
- **任务指挥**：main 理解任务并委派给 worker；worker 有各自独立的模型上下文、消息队列和工具调用。daemon 做实例管理、路由与事件分发，不另加一个调度模型。
- **机器绑定**：worker、会话和目标机器/kernel 的映射显式维护。不同目标的 cwd、变量、文件和依赖独立；不把 A 的读取视图交给 B 编辑，断线不偷偷换机器。
- **资源分工**：daemon 管 main/worker 生命周期及绑定；每台目标机的 Jupyter Server 可承担 kernel 启停、连接、中断和关闭。Jupyter Server 不是上层 Agent Gateway，也不需另起 IPython CLI 作为 Agent。
- **进程方案建议**：先由一个 Node daemon 持有多个 SDK 会话实例。实施时验证插件全局状态、进程级事件是否互相影响；只有出现真实隔离需求，再让 daemon 管理独立 worker 子进程，不预建进程平台。
- **前端独立**：客户端断开只释放连接/订阅，不 dispose main/worker，不取消执行或关闭 kernel。显式取消任务、关闭会话和停止 daemon 是不同操作。
- **重新连接**：daemon 存活时，客户端可按会话标识取得当前状态并继续订阅；快照与增量交接需避免漏事件。首批不承诺任意历史事件重放；请求确认丢失时不能自动重发副作用操作。
- **重启不是重连**：daemon 崩溃或重启后的 Agent 执行恢复、kernel 接管另行设计；Pi 可恢复聊天历史不等于可以恢复正在执行的工具。

每个 worker 的工具闭包引用其执行资源，工具 reload 不应重启 kernel。不同会话不默认共享 Python 命名空间，原 `read/edit/bash/write` 仍是本地工具，不暗中变为远端。main 首批通过委派 worker 进行目标操作，不默认给它所有 kernel 的直接执行权限。

`AgentSessionRuntime` 的 `runtime.session` 是该 runtime 当前会话，不是整个 daemon 的全局当前会话。main 与各 worker 分别持有自己的会话/runtime；客户端选择查看哪个会话不能改掉其他 worker 的绑定。`newSession/switchSession/fork/import` 导致的实例替换、订阅迁移和资源清理由明确的会话管理路径处理，不共享一个可切换指针承载所有 worker。

## 5. Jupyter 连接与执行合同

建议复用官方 `@jupyterlab/services` 直接走 REST/WebSocket，不自研 ZMQ、不加入 Python 中转 daemon。首批目标配置由应用拥有，不假设 Pi SettingsManager 自动支持任意新字段；具体配置入口在实施时选最小可用方案。

每个目标包含别名、私网 Server URL、凭据环境变量引用、kernel 名称、明确的目标 cwd，以及可配置的连接/执行/中断等待和输出限制。秘密值不放模型参数、日志或计划。不要沿用 OpenViking 的 40 秒等待作为 Python 执行默认。

### 正常执行

- worker 的 Python 工具执行代码时使用其绑定目标；若参数保留 `target`，必须与绑定一致，否则失败，不退回本机或其它机器。
- 各物理机运行标准执行端；通过其 Jupyter Server 为绑定 worker 懒创建专属 kernel。目标可达性、kernel 启动与 worker 会话创建分别报告，不能混成一个成功状态。
- 目标 Python 环境用项目级 uv 准备；正常工具调用不临时联网 pip install。不默认附带 Prime 的大依赖集合。
- 同一 kernel 前台执行串行化；反馈标明目标、kernel 与 cwd，路径在目标解释。
- `requestExecute()` 的完成要等匹配请求的 `execute_reply` 与 IOPub `idle`，按 `parent_header.msg_id` 关联输出，不能见任意 idle 就结束。
- `allow_stdin=false`；`input()` 不允许无限等待交互。Python error 与传输错误分开，保留有界 traceback 和已有输出。
- 复用标准 `onUpdate` 与工具结果流；首批明确支持文本输出，截断与未展开 MIME 可见，不声称完整 Notebook 展示已实现。

### 中断、断线与退出

- AbortSignal 发起专属 kernel 的 `interrupt()`；HTTP 204 不等于代码已经停止，等待收束并区分已确认/未确认。
- 不自动 restart kernel；重启会丢变量，属于独立操作。
- Jupyter 客户端普通断线不会必然拒绝已发请求的 Future，还可能重连发送尚未发出的队列项。首批建议连接就绪后提交，执行中断线标记 outcome unknown 并终结该连接实例，防止排队代码迟到执行。
- 关闭连接不能取消已经到达 kernel 的代码；断线/超时不是“肯定没有副作用”。绝不自动重发未知结果的 Python；先只读核对目标实际状态。
- 明确关闭 worker、停止 daemon 或达到上述空闲休眠条件时，按归属回收自建 kernel；前端断开本身不触发清理。不能关闭整台 Jupyter Server 或他人 kernel；有界清理失败必须反馈。
- 崩溃可能遗留远端 kernel；首批不做持久接管注册表、变量快照或跨重启恢复。残留通过官方管理入口显式处理。

## 6. 目标侧读取与 Hash Edit

目标侧提供小型 Python 模块，暂名 `pi_remote_tools.files`，优先标准库。模块属于我们的应用，不是 Pi 核心补丁；不在每台目标机部署 OMP/Node/NAPI。

拟议接口，尚未实现：

```python
from pi_remote_tools import files

view = files.read("src/app.py", start=1, limit=120)
print(view)
result = files.edit(view, [
    {"op": "replace", "start": 12, "end": 14, "text": "replacement\n"}
])
print(result)
```

读取视图在目标 kernel 的 Python 变量里保存可见范围、原始行号、目标绝对路径和完整原始字节版本，并保持目标/kernel 身份关联，不作为跨 worker 或跨机器通用编辑凭据。显示短标签可以，校验用完整 SHA-256。

- 读、计算版本、校验和实际写入都在目标执行；不把文件传回 Pi 主机再覆盖。
- 首批建议普通 UTF-8 文本，明确处理 LF/CRLF、Unicode、空文件、末尾换行与权限，不悄悄转码或格式化。
- 有界读取，省略可见；行操作限于读取视图覆盖的范围，其它范围先读。读取后的绝对路径不受后续 `os.chdir()` 影响。
- 整批修改按原行号解释，先全量校验再提交；范围替换、前后插入和删除拒绝重叠/歧义，不模糊猜位置。
- 写入前重读完整内容版本，不符则返回 stale/conflict 且零额外写入。
- 单文件提交避免半写，保持未修改内容和应保留元数据，符号链接读写指向一致。只承诺乐观校验，不宣称对任意外部写入者提供原子 CAS 或跨文件事务。
- 成功返回 diff、摘要和新版本依据；旧 view 不再使用，继续编辑重新读取。
- 任意 Python 本来就能直接写文件；helper 是可靠编辑合同，不是安全沙箱。

OMP 是语义参考，不要求复制完整 PUT/CUT 文本语言。基础行操作、不包含语法块/寄存器/跨文件移动/自动修复/LSP 是首批建议，仍须确认，不把此前未选定的范围写成用户已批准。

## 7. 插件兼容与观测

通过 `DefaultResourceLoader` 保留正常插件、skills、模板与配置发现，不另造插件加载器。我们的工具与插件工具共同注册；命名冲突和工具 allowlist 按官方合同处理。

Pi 默认看到一次 `python` 工具调用，Python 内部 read/edit 不会自动变成原生工具事件或触发那些工具钩子。首批用输出摘要、diff 和标准工具事件，不伪造嵌套工具执行。

直接应用 RPC 执行与模型工具执行是不同的入口，不应假称具有相同的 Pi 钩子/消息历史；如需统一记录，单独明确合同。关键执行状态和异常带时间、目标与阶段，认证 URL/token 不进入日志。

## 8. 实施步骤与验收

### A. 已有 SDK 验证入口（完成范围不扩大）

- 独立 npm 应用、Pi SDK 依赖、进程内 TUI/RPC、`--no-skills` 已准备并验证。
- 这些结果不包含常驻 daemon、attach 客户端、多个 worker 或 kernel 执行。

### B. 原 Gateway daemon 与客户端路线（历史）

- 明确统一 RPC 传输、认证、必要方法与官方协议兼容范围；复用公开 SDK，不复制整套 Agent 循环。
- daemon 持有一个 main session，客户端只连接它。先完成查看状态、发消息、事件订阅、取消、断开重连；再接 main 委派所需的 worker 创建、状态、消息、结果及显式关闭操作。
- 验证两个客户端观察同一 main 会话；一端断开后会话继续存活，重连恢复当前状态，不创建替代 Agent。
- 官方 TUI 能否复用为客户端需按实际接口验证；当前 `InteractiveMode` 的进程内成功不算 attach 验收。

### C. 原 main 委派纵向闭环（历史，非本轮 Web gate）

- main 委派 → daemon 管理的 worker → worker 绑定 kernel → worker 结果回到 main → 前端观察；不是 main 绕过 worker 直接执行。
- 本地 kernel 仅用于协议初验，然后在一台授权受控的远端物理机器完成实际执行。目标模块优先 uv 和官方 Jupyter 客户端，不先造自有执行 daemon。
- 验证 worker 自有上下文、Python 变量跨调用保留、异常/中断、资源归属，以及文件读取/Hash Edit 的冲突与整批提交合同。

### D. 多物理机与生命周期验收（未来，未交付）

- 至少两个 worker，分别绑定两台不同物理机器；各机器上的同名文件与变量不同，证明不串上下文、不串文件、不交换读取视图，Agent 宿主本机文件不变。同机多个 kernel 不算通过。
- main 通过真实模型委派，worker 使用 Python 读文件、修改、再读取确认，结果经 main 和 daemon 返回客户端。
- 在运行期间断开 UI，验证 worker/kernel 不中止；重连后看到真实状态/结果。客户端断开、取消任务、关闭 worker、停止 daemon 分别验收。
- 验证目标断线的未知结果不自动重发，不隐式重新绑定机器；匹配 reply+idle 才完成、输出超限与禁止 stdin 不挂起。
- 验证插件跨会话隔离和会话替换不误路由；显式关闭只清理自有测试资源。

既有 Gateway 保留；独立 Web 现在是当前候选，不再后置。QQ、通用后台作业平台、跨进程重启接管、多物理机部署仍未交付。历史 A–D 不能替代当前队列验收。

## 9. 当前状态与后续决策

旧 monorepo 路线曾通过构建与原生 CLI get_state，属于被替换架构的历史证据，不作为 SDK 新入口的验收。2026-09-16 已完成 SDK 项目重组：

- 旧项目完整保留在本地备份目录，包含原 Git 历史、依赖、忽略文件和本地任务文件；纠正前的计划另存于同级 `PLAN.before-sdk.md`。
- 当前工作区是独立 npm 应用，无上游源码工作树、上游 Git 历史或 upstream remote。`docs/archive/` 旧稿与搬迁前逐字节一致（其中个人讨论记录发布前已移除，现仅保留 Hash Edit 计划）。
- Pi 作为正常 npm 依赖安装；当前 lockfile 解析到 `@earendil-works/pi-coding-agent@0.85.1`，另使用官方 `@jupyterlab/services` 与 TypeBox。开发依赖为 TypeScript 与 Node 类型。安装跳过依赖生命周期脚本，不需要上游 hydrate 或构建。
- `npm run check` 通过。`src/main.ts` 使用公开 SDK 创建 runtime，默认接官方 TUI；`--mode rpc` 接官方 RPC，不是 CLI 子进程或复制的界面/dispatcher。
- 在独立 HOME、agent 目录与工作目录中，以 `PI_OFFLINE=1` 启动本应用，实测 `get_state → new_session → get_state` 全部成功，新旧 session ID 不同；`get_commands` 也正常响应。
- TUI 已通过真实 PTY 验证：启动显示官方界面，`/session` 输出会话信息，空输入区 `Ctrl+D` 正常退出（exit 0）；模式切换后 RPC `get_state` 成功。帮助、无效参数/模式和非终端 TUI 诊断均已执行验证。
- 已接入会话级 `python` 工具与本地认证 Jupyter Server，Python 依赖由项目 `uv.lock` 固定（Jupyter Server 2.21.1、ipykernel 7.3.0）。实测变量保留、Python 异常、提交前取消、中断后继续使用、禁用 stdin、输出截断、已删除 kernel 不重建以及所属 kernel 清理；保留了当时的执行证据。
- 已通过真实模型 `clp/gpt-5.6-luna` 的两次 Python 调用验证 `41 → 42`，并通过实际 RPC `new_session` 验证旧 kernel 关闭。测试用 RPC 进程、隔离配置与临时凭据副本已清理。本地 Jupyter Server 保留运行；仍未实现 Hash Edit 或新增 RPC 方法。
- 生产 Pi/OMP、QQ、OpenViking 的安装指向与运行进程未修改；没有执行全局安装或 npm link。
- 上述 TUI/RPC 是历史进程内路径；应用由 Gateway 持有会话，attach 只作客户端。

### 进程内 host 合同（已由 Root 接受，传输直接消费）

Gateway 经受管 worker runtime 创建实际 SDK 会话和 kernel；`createSessionHost()` 提供单会话的准入、事件与生命周期。宿主绑定公开 SDK 扩展 startup/reload/shutdown，扩展命令的 replacement/navigation 在变更前明确拒绝。

- **身份/相关性**：`host.sessionId` 是 SDK 会话 ID；操作 ID 是该 ID 加递增计数，客户端 requestId 不代替会话 ID。同一未结束的 SDK drain（包括重叠异步 preflight 与 steer/followUp 输入）共享一个 operationId。`submit()` 的 accepted 仅表示 SDK preflight 已接受，不表示执行完成；返回的 completion 与 `operation_completed` 是该操作全部已接受请求的终态。拒绝没有执行成功含义，也不保证扩展 input handler 在 preflight 前从未产生副作用。
- **队列**：执行与队列完全由 SDK 管理；应用只串行化 preflight 准入并跟踪其完成，不重放输入、不另建执行调度器。SDK idle 后残留 display queue 会显式清除并报告 failed/unknown，而不是循环等待立即 resolve 的 `waitForIdle()`。异步 preflight 未结束时不会提前发布终态。
- **重连**：同步 `subscribe(listener)` 先注册再返回快照及 sequence；按 sequence 取之后的事件，不需要持久 replay。事件按递增序号（包括重入回调）交付，unsubscribe 只断开观察。快照包含 SDK 当前 messages 视图的拷贝、当前 kernel、当前操作和最近 **64** 个终态；不维护第二份对话/持久 job journal。缓存内重复 requestId 拒绝；过期/未确认 ID 的结果是未知，不得自动重发副作用请求。
- **取消**：针对指定 operationId，覆盖当前 SDK drain；clearQueue 后 abort，`requested` 只是确认请求。终态区分 completed/failed/cancelled/unknown；文本变换使排队请求无法可靠匹配时保守 unknown。若 kernel 操作已开始，SDK abort 本身不能证明远端无副作用，终态保守 unknown。取消不是回滚，也不关闭 worker runtime/kernel；安全时可继续下一次请求。
- **生命周期**：reload 只允许 host idle，不重建 worker/kernel；reload 失败只报错，状态不变。host.close 先关准入，等待迟到 preflight/执行、取消与生命周期操作收束，尝试所有自有资源清理后发布 `host_closed`（清理未确认时 `failureCount>0` 并抛出同一错误，状态仍为 closed）；重复 close 保留同一结果。任意永不返回的第三方 input handler 可能延迟关闭，SDK 无通用强制终止该 JavaScript handler 的能力。
- **证据入口**：当时的用例 覆盖 SDK 异步准入、队列、输入处理、终态、stream 与扩展重载。生产 worker 与认证 Jupyter 的真实调用链由独立 Gateway、worker 和 kernel 检查覆盖；受控 provider 不代表外部模型能力。

### Private daemon / attach（传输已由 Root 接受；最终累计候选仍待独立核验）

当时的用例 同时执行协议边界检查及独立启动的真实 daemon/CLI：两 socket 共用 SDK main/worker 身份，A 在 Python sleep 中断连而 B 继续观察，重连取得 messages/终态，保留变量/文件 41→42，显式 cancel 抵达真实 worker 后复用同一 kernel，reload/worker close/shutdown 保持归属。SDK provider 在该检查中受控，不把它冒充最终 live-model connected-client 验收。

协议检查不再要求目录/socket 的 lstat、owner/mode/symlink 拒绝；已有活 endpoint 拒绝启动，死 socket 不阻塞重启。同步重入 snapshot-first handoff、非法/重复/未知方法、分块 UTF-8/字节限制、并发上限及慢客户端断开继续保留。订阅/断连不取消；send acceptance 与 operation terminal 分离。连接丢失或请求超时只报告 unknown，客户端无自动重发/重连。终态仅保留 host 的 64 条；大于 8 MiB 的完整快照明确拒绝，不返回伪完整历史。详见 `docs/wire/transport.md`。

### 当前环境与验收边界（2026-09-17 重启后）

上述历史实测保留为历史，不替代当前候选的验收。重启后初次检查未发现可用 Jupyter 配置，`127.0.0.1:18888` 连接被拒绝。用户随后明确授权测试脚本启动/停止自己创建的临时认证 loopback Jupyter：使用临时端口、隔离的 runtime/config/cwd 与项目管理的 Python 环境，不重启或修改既有服务。显式外部 `JUPYTER_URL` / `JUPYTER_TOKEN` 仍属于外部所有者；测试只清理自己创建的 kernel，绝不停止该服务。SDK 受控 provider 的测试或模型注册成功不能替代真实 host → worker → kernel 验收。

当前候选的两项窄修复分别有独立回归：临时 prefix 的 kernelspec 在 ServerApp 初始化后的公开 manager 上固定，并与安装返回目录核对（当时的用例 验证竞争 spec；fixture 检查实际 `sys.executable/sys.prefix`）；首次 kernel info 延迟时，在原有 10 秒总预算内接受迟到的官方 initial info 或唯一一次已验证的 metadata probe，关闭/取消/超时后不提交代码（当时的用例）。默认 launcher prefix 行为不变；受管本地实例显式传入 `--fixed-token-source .runtime/workers-office.json`，只读取现有 owner-only 配置中唯一 `name: default` 条目的 token，缺失、非法 JSON、错误结构或非法 token 直接失败，不回退随机 token。

**未解释的历史风险**：attempt4 曾出现低频 worker beta 启动缺失 info reply，原因尚未查明；不能把上述修复归因为该历史故障的已证实解决。attempt5 的一次有效、有界、仅消息元数据的诊断执行了 20 对实际 SDK alpha/beta workers（40 次 kernel 分配），全部初始 info 请求均匹配服务端接收/转发、reply 和客户端接收/settlement，未复现故障；自有 kernel 集合归零，服务与临时目录已回收。此前一次诊断因 instrumentation 的 trait 方法名冲突无效，单独保留，不算产品故障或成功证据。未追加压力循环、失败重试、kernel 替换或传输切换。当前候选的完整检查与 Root 独立复验仍需分别报告；未复现不等于证明间歇故障不存在。

### 历史启动与检查记录（已被 worker-only 合同取代）

- 以下旧候选曾记录多类会话及其启动顺序；不再作为当前操作指引或 cutover 验收。当前 Gateway／worker 创建与 attach 命令见 [wire/API 文档](docs/wire/transport.md)，实例 target、kernelspec 与 cwd 规则见[机器配置](docs/machine-session-management.md)，恢复与关闭见[kernel 恢复](docs/kernel-recovery.md)。旧检查入口不适用于当前合同。

### 独立 Web 启动与本轮验收

```sh
npm ci --ignore-scripts
# 在独立 PRK home 中准备 config.toml、instances.toml 与 agent/；不要把秘密写进命令/网页。
node src/main.ts gateway --home /absolute/owned/prk-home --model PROVIDER/MODEL --no-skills
# 自定义 provider 可加 --extension /absolute/owned/prk-home/agent/provider/index.ts（可重复）
node src/main.ts web --home /absolute/owned/prk-home
# 默认 http://127.0.0.1:8787，地址可由 config.toml http 分组或 Web flags 指定。
```

全局设置及完整实例字段见 [配置 schema](docs/configuration.md)。下面是主目录 `instances.toml` 的实例示意；cwd 必须是目标上已经存在且获准使用的目录：

```toml
[[instances]]
name = "alpha"
label = "Alpha"
url = "http://127.0.0.1:18888"
token = "SERVER_SIDE_SECRET"
cwd = "/absolute/owned/alpha"

[[instances]]
name = "beta"
label = "Beta"
url = "http://127.0.0.1:18889"
token = "SERVER_SIDE_SECRET"
cwd = "/absolute/owned/beta"
```

配置身份、显示名与规范化 endpoint 必须唯一。一个实例即可创建多个独立 SDK 会话与 kernel，不需要复制配置或准备不同物理机。内核命名空间隔离不隔离共享文件系统、OS 用户或权限。缺少 instances.toml 时实例列表为空；缺少 config.toml 时行为分组选用默认值。无效 TOML、schema、值或未知字段会在启动服务之前明确失败；旧 JSON 配置仍存在时也拒绝启动。模型未注册会启动失败，凭据/网络失败不能算可用，kernel 启动失败明确显示，绝不偷偷替换旧会话的 kernel。

浏览器创建/选择 worker、发送请求、观察 assistant/Python 实时文本、代码与输出。宿主持有内存 worker 上下文；首个 Python 调用才创建 kernel。关闭标签、Disconnect 或 reload 只失去观察，Reconnect 重新取快照，不重发任务。Cancel 的确认不代表远端已经停止或副作用回滚，终态可为 unknown；只在核对状态后安全继续。Close worker 要确认，永久关闭其会话及自有 kernel，失败必须报告；停止 Web 宿主尝试关闭全部自有 workers，不关闭 Jupyter Server 或无关 kernel。进程崩溃恢复未实现。

新建会话通过 `POST /api/workers {target}` 选择环境，服务返回 HTTP 201、独立 UUID 路由 `name`、环境 `target`、显示 `label` 及 SDK `sessionId`/快照。后续请求按返回的 `name` 寻址，不再用环境名称当会话身份。列表区分“新会话 N”和其运行环境；已有或已关闭会话都不会禁用该环境的新建按钮。关闭只永久关闭原身份，不能复活它，但可以在同一环境新建新身份。创建响应未知时只刷新列表供人工确认，不自动重试。

多会话验收：浏览器回归已覆盖同环境的上下文/kernel 隔离、关闭一个后另一个继续执行、关闭后新建空白会话，以及原有重连、取消和清理。常驻页面的真实模型实测：两个 `default` 会话分别保存 41 和 99，切回仍为 41；关闭前者后后者仍在原 kernel 返回 99；再次创建的会话使用新的 kernel，并实际断言旧变量不存在。网页服务已在原 Herdr 面板按授权重启，不涉及 QQ/Jupyter Server 重启。

**2026-09-18 前端更新：** 主界面只保留会话列表、连续对话和固定输入框。工具调用按 `toolCallId` 与结果配对，依照 assistant 内容块的位置就地显示；同名工具不会按名称或数组位置配对。工具卡默认折叠，展开查看输入和实时/最终输出，保留展开状态与输出阅读位置。session/事件序号、断开和关闭操作、运行记录收进“会话详情”；执行中才显示停止与忙时投递选项，异常和结果未知仍明确提示。右上角提供明暗切换，默认跟随系统，手动选择仅以 `pi-worker-theme` 保存到浏览器 localStorage。

本次已重新通过 当时用例的实际 SDK/Jupyter/受控浏览器检查，包括连续轮次的工具顺序、流式输出滚动、重连、取消和资源清理。另在常驻网页通过真实模型完成“文字 → Python 42 → 文字 → Python 100 → 文字”，验证重载后调用/结果对应不变、明暗偏好保留及桌面/390px 手机布局；乱序结果与旧实时事件覆盖问题另用浏览器内渲染样例验证。没有新增前端依赖，也没有更改模型或执行协议。

Web 不是 Gateway socket 的浏览器代理。HTTP 默认 loopback；仅显式私网 IP（RFC1918/Tailscale 或 loopback）可绑定，拒绝 wildcard/public/DNS 名称。精确 Host/Origin 与跨站请求限制防护不等于用户认证。没有 TLS、浏览器登录或多租户隔离，所有能接触监听端点的受信单用户网络参与者可操作 worker；不要公网暴露、端口转发或当作公共服务。实例 token 仍省略，插件配置秘密值仍遮罩且不提供原值揭示，公开工作台列表不新增 token；会话与工具输出由发布层原样传递，可能含敏感内容。详见 [wire 文档的 Web 边界](docs/wire/http.md#independent-web-workbench)。

#### 检查入口与前提（Root 已完成初始集中运行；累计候选仍未最终接受）

- Node >=22.19、`npm ci --ignore-scripts` 后：`npm run check`；当时的用例；`node src/main.ts --help`。
- Python 公共客户端 smoke／spec 回归：当时的用例。解释器须来自锁定环境，含 Jupyter/ipykernel 与官方修复；不修改既有 `.venv`。`check-shell-wakeup.py` 只验证公开 client 的 shell execute request/reply 交付；不声称 IOPub idle 完成或上游 ROUTER 已消耗 edge 的确定性前提，因此 R26 deterministic wedge 仍为 **BLOCKED**，不能把 public smoke 当作等价验收；fixture 通过 `PI_TEST_PYTHON` 指定现有解释器，缺失则明确不可运行；成对外部 `JUPYTER_URL`/`JUPYTER_TOKEN` 仅在所有者明确配置时使用，绝不停止外部服务。同机共享测试临时文件系统是前提。
- 当时的受控浏览器验收未完整通过，后续条款未运行；目标包括 1440×1000 与 390×844、断开后续接、变量复用、显式取消与归属隔离。
- 真实外部模型调用另需明确授权。
- 早期外部模型调用确曾被拒绝，`live-command-denied.txt` 作为历史失败证据保留。后续同会话授权与独立验证已完成，最终以 `final-limited-delivery-receipt.json` 的 LIMITED_ACCEPTED 为准：独立 worker/网页通过，旧 host-live 未通过且被用户仅就本次有限交付豁免，不改记为 PASS。
- 旧检查 仍是受控 provider 检查，没有真实模型模式。真实浏览器验收使用实际 `web` 服务；手机尺寸验证不等于蜂窝网络或远端机器部署验证。本计划不替代对应回执与实际输出。

### 当前 Gateway 与本地实例指引

当前 Gateway、attach 命令及创建 worker 的完整示例见[wire/API 文档](docs/wire/transport.md)；Jupyter 实例的配置与本机标记规则见[机器配置](docs/machine-session-management.md)。不再保留旧 CLI 命令或不完整实例示例。

受管本地 launcher 的固定 token 来源为 `<PRK home>/instances.toml` 中唯一 `name = "default"` 条目；显式源缺失或非法时启动失败，不随机回退，实例不从 `config.toml` 读取。fixture 不传 `--fixed-token-source`，仍使用临时随机凭据。官方 runtime 记录保存在 `.runtime/jupyter/`，不要复制到聊天或版本库。客户端优先读取成对的 `JUPYTER_URL` / `JUPYTER_TOKEN`，否则读取项目内唯一匹配的 runtime 记录；不在启动时探测网络，无配置时保持普通 Pi 行为。陈旧记录或服务离线会明确失败，不自动重启服务或换 kernel；异常停止留下多个记录时，需要确认旧 Server 已停止再清理其记录。

每个 Pi 会话首次调用时创建自己的 kernel，后续保留变量；正常会话切换/退出关闭所属 kernel，扩展 reload 保留。关闭未确认会报告可能残留，不声称已清理；强杀进程不保证清理。Server 已关闭自动 kernel 重启。Python 报错作为工具错误回传；中断确认有界，连接丢失不自动重放。直接 SDK RPC 的初始化日志隔离缺口见本文件开头 R29 边界，不再通过全局 console 重写制造 JSONL 保证。

这里只覆盖同机范围；当前 daemon/CLI 支持断连后继续执行，不等于远端物理机、手机蜂窝网络访问或崩溃恢复验收。

### Python 依赖：ipykernel ≥ 7.4.0

`pyproject.toml` 要求 PyPI 的 `ipykernel>=7.4.0`，`uv.lock` 锁定 7.4.0。7.4.0（2026-09-29）包含官方 PR [#1529](https://github.com/ipython/ipykernel/pull/1529)（提交 `c7422704`，shell reply 经 ZMQStream 发送；旧版 raw ROUTER reply 路径会搁置请求）；用 GitHub compare 核对过该提交是 v7.4.0 的祖先（behind 0）。此前锁的是该提交的 GitHub archive，安装时要访问 GitHub；换成 PyPI 正式版后，锁里不再有 GitHub 来源，不能访问 GitHub 的机器也能 `uv sync --frozen`。

当时以新建的锁定环境验证，未采用运行中服务的环境。

没有能复现上游 ROUTER 搁置前提的测试，R26 的 deterministic wedge 保证仍为 **BLOCKED**，不记 PASS。

### 在另一台 Linux 机器上运行

`scripts/package.sh [OUT_DIR]` 把 HEAD 的源码和 `<PRK home>/assets/bin` 里的 rg/dust 打成 `dist/prk-<短 sha>.tar.gz`（工作树不干净时拒绝）。目标机上的安装、接模型 provider、验收和排错见仓库根目录的 [INSTALL.md](INSTALL.md)。

### 历史同机 SDK worker 验证

2026-09-17 已用 `clp/gpt-5.6-luna` 实测通过：worker 仅暴露 Python；两个 kernel 的变量、目录与文件隔离；变量保留、输出进度、Python 异常、中断后复用；执行超时后状态保留；无效 cwd 无副作用；真实 main → worker → Python → 文件两轮完成 `41 → 42`。成功和失败路径均回收自有资源并核对原 Server 的 kernel 集合，临时目录自动移除，不启动或停止现有 Server。

这项结果只覆盖同机 SDK worker 执行链，不代表原 Smart Cascade 全队列、实际 TUI/RPC 的全部生命周期、远端物理机或 Gateway daemon 已完成验收。

Gateway 使用启动 cwd 作为会话目录，公开 SDK loader 保留正常资源发现；独立 `--home` 的 agent/ 是唯一 SDK 配置目录，`--no-skills` 禁用 skills 但不禁用扩展。凭据和 provider 包不从其他 Agent 目录自动发现。测试使用临时 home 与公开 `SessionManager.inMemory(cwd)`，不得读写操作者真实配置。Attach 不创建 Agent。

### 同机真实 Gateway 验收入口（历史路径，不是 Web live 证明）

当时的受控实测独立启动实际 CLI daemon、两个真实 socket 客户端和实际 attach CLI；使用显式真实模型，不加载受控 provider、不自动 fallback。main 委派 worker 后，Python 写入变量/文件 41 并继续执行，检测真实文件进度且确认同一 operation/worker 为 running 才断开 A，不用任意等待冒充执行证据。B 观察终态，A 重连原 session；第二次实际 CLI 模型请求使同一 worker/kernel 的变量和文件变成 42，官方认证 kernel 连接独立断言变量值。随后单独测试长 Python 的显式 cancel、终态及复用；远端副作用不确定时终态 `unknown` 是诚实结果，不声称回滚或重放。每次模型操作总预算 180 秒；失败路径经 fixture `onCleanup` 与 `finally` 回收自有资源。

2026-09-17 此入口已用批准的 `clp/gpt-5.6-luna` 和从最终 lock 创建的只读 adopted Python 环境实测通过上述链路。shutdown 前仍保有自有 kernel；shutdown reply 仅证实 host close，测试另等 daemon 正常退出及 socket/bind 路径移除，然后核对 Server 启动身份、原 kernel 集合及额外非 Gateway 所属 sentinel kernel 仍可执行。最后仅删除测试自有 sentinel、fixture Server 与临时文件。本轮临时 Server 的外部初始 kernel 数为 0，因此额外 sentinel 是非空归属隔离证据，不声称观察了未配置的生产 Server。显式外部 `JUPYTER_URL`/`JUPYTER_TOKEN` 可沿用同一入口，外部 Server 永不由 fixture 停止；现有服务/QQ/OMP/OpenViking 未修改。

最终流程仍需 Root 检查与重跑、冻结准确累计 candidate，再请求 **external supervisor 的独立 verifier**；实现者自测不满足该 gate，也不授权 commit。受控物理目标授权、Hash Edit、QQ、远端部署、官方远端 TUI 兼容和崩溃恢复仍在本轮之外。目标绑定由 `src/workers/worker-config.ts` 承担；本轮未部署或重启生产服务。

## 10. 权威参考

- [Pi SDK](https://pi.dev/docs/latest/sdk)：Custom Tools、ResourceLoader、AgentSessionRuntime、Run Modes。
- [Pi RPC](https://pi.dev/docs/latest/rpc)：stdio JSONL 命令和事件合同。
- [0.85.1 RPC runner](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/src/modes/rpc/rpc-mode.ts)：当前无自定义 dispatcher 参数。
- [JupyterLab services](https://jupyterlab.readthedocs.io/en/stable/api/modules/services.html)。
- [Jupyter 消息协议](https://jupyter-client.readthedocs.io/en/stable/messaging.html)与 [Server REST API](https://jupyter-server.readthedocs.io/en/latest/developers/rest-api.html)。
