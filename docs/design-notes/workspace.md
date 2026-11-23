## 终端生命周期与重连限制

关联 [TGT-10](../contract.md)、[TGT-12](../contract.md)、[TGT-14](../contract.md)、[TGT-15](../contract.md)、[TGT-16](../contract.md)、[TGT-11](../contract.md)、[TGT-13](../contract.md)、[LIFE-11](../contract.md)、[LIFE-12](../contract.md)、[LIFE-13](../contract.md)、[LIFE-16](../contract.md)。
来源：原 `gateway-wire.md:511,550-564,577-606`。

- 新 PTY 模块的 owner、实例与连接代次只在 Gateway 内存存在。浏览器断开只退订；Gateway 或目标连接失效后旧 tab 不接回，重新打开必须明确创建新终端。S6 才切换生产装配并删除旧 Jupyter 绑定实现。
- 人工终端记录创建时目标；会话切换目标不得把现有 handle 改绑另一连接。模型终端沿现有规则关闭；清理失败必须报告。
- 新传输使用 pi-env 公开 PTY argv/env 与事件，重放最近有界输出，不读取或修改上游私有状态。无启动 adoption、终端列表对账或持久输入输出日志。
- D7在PTY首进程使用内存Python wrapper，私有pipe完成fork与前台PGID交接；不读取或转发用户输入。Linux shell先设置父死SIGHUP，再校验父PID并exec。nonce首帧只关联启动身份，不是输入消费确认。正常close先HUP shell并等wrapper真实退出，再pi-env close；`aborted`不证明退出。
- 终端关闭后，已保留的命令页面仍可读取，直到轮换或会话关闭；缺失或已轮换的标识报错。屏幕高度不限制 `OSC` 命令捕获；没有结束标记的交互解释器或 `ssh` 继续捕获，不猜测是否等待输入。
- `WebSocket` 输入流水线限制在途请求；Web 待发送队列按序并合并相邻输入，项数受 `gateway.pendingMax`、UTF-8 文本总量受 `limits.inputBytes` 限制。满时拒绝，拒绝项不进入队列；D6 不豁免 PRK 侧限额。
已拒绝的输入不重发；没有网关附着连接的输入丢弃。
每次网络变化、手机退后台或接口服务重启后，重连都会获取新的重放快照，而非重新施加输入。
- 建立连接时，只有唤醒或内核转换造成的瞬态 `BUSY` 可按有界倍增退避重试；其他错误立即报告。最终关闭码 `4000` 与可重连的 `1012`、`1006` 之间的区别是传输策略，不是命令解释器副作用回滚。
- 时间戳保存与创建时的存在性检查只是尽力而为；外部写入者可在检查后竞争。没有额外的比较交换、锁或跨文件事务。
- `clear` 常连续输出 `CSI 2 J` 与 `CSI 3 J`；两端处理遵循 [TGT-54](../contract.md)。清屏后可向上翻阅，命令中途清屏也不截断 `terminal_read(command,offset)` 的保留输出；仍受各自历史容量与命令轮换限制，不改变重连回放容量。
- D6 接受 daemon PTY 输入无界入队风险；PRK 限单次输入并串行调用原版 handle.write，不建输入队列。openTerminal 不公开 request id/session，无法合法 await 入队应答；不复制其装配、不读私有状态、不另造确认机制。write 返回不表示消费。
- 浏览器终端宿主以实际组内容器为尺寸来源，使用自身 `ResizeObserver` 和可见性恢复通知 fit，再发送同代 PTY resize；不能把旧 overlay 尺寸当作几何权威。组内裁剪不能代替正确 cols/rows；布局与隐藏切换不得丢失终端状态、generation、文件草稿或持久布局。
- HTTP 结束回执与 WebSocket closed 可交错到达；视图关闭复用公开 dockview registry/engine 的幂等入口，并校验终端代次。旧终态不能删除同名新代视图，也不能误关其他终端或文件。
- 新建与恢复的终端 panel 统一使用公开 `onlyWhenVisible` renderer，直接依附组 content，不再依赖滞后 overlay。隐藏时仅移出 DOM，React/xterm/WebSocket 不卸载；显示后立即重新 fit，保留 generation、回放与文件草稿。旧持久布局中的终端 renderer 在恢复时归一化。
- 浏览器 xterm 加载 Unicode 11 宽度、可点击链接（新标签打开）与搜索插件。搜索最多高亮 100 处（`highlightLimit`），长日志或单行压缩 JSON 搜索不卡页面；入口为右键菜单「查找」和 Ctrl+Shift+F。字号存于本浏览器 localStorage `pi-terminal-font-size`（与配色主题同处，所有终端共用），设置页与 Ctrl/⌘ + `+`/`-`/`0` 改同一值；改后重新 fit，cols/rows 走既有 resize 同步 PTY。缩放按 `event.key` 判断，不占 Ctrl+Shift+`-`（Shift 下 key 为 `_`）：xterm.js 对 Ctrl+`-` 本不发字节，`^_` 来自 Ctrl+Shift+`-` 与 Ctrl+`/`，仍可用于 readline/emacs 撤销。
- 图片：`@xterm/addon-image` 开 Sixel、iTerm2 IIP 与 Kitty 图形；图片画在插件自己的 2D canvas 层，DOM 渲染器下即可用，不需要 GPU/WebGL（无 GPU 的环境也能用）。Kitty 图形只在 xterm 6.1 beta 线（addon-image 0.10 beta）里有，`web/package.json` 因此精确钉 `@xterm/xterm 6.1.0-beta.339` 与同批插件；6.0.0 也没有 Kitty 键盘协议。Kitty 键盘协议以 `vtExtensions.kittyKeyboard` 打开，只在程序推入 flags 后生效（如 Shift+Enter → `CSI 13;2u`）；PRK 自己的键（Ctrl+Shift+C/V/A/F、缩放）在 xterm 编码前截走，程序拿不到。PRK 不合批输出，>16 KB 图像按 daemon 分块逐帧写入，xterm 解析器跨 write 拼接；单个 APC 载荷受 xterm 10 MB 上限。
- 右键菜单「引用到输入框」（有选区才可用）把选中文本按回复菜单「引用」同一格式（`> ` 逐行，接在现有草稿后空一行）写进当前会话的输入框并聚焦；手机先关工作区浮层。这是用户主动插入的文本，模型仍不读取人类终端 tab。
- 只开 `?1000h`、不开 SGR `?1006h` 的程序，鼠标上报来自 xterm `onBinary`，同样作为 `input` 文本帧发送。`input` 是 JSON 字符串，Gateway 以字符串交给 pi-env `write`，按 UTF-8 编码进 PTY；X10 坐标字节 = 32+坐标，第 95 列/行之后大于 127 会被拆成两字节，因此含 >127 字节的事件整条丢弃，不另建绕开文本通道的二进制帧。SGR 程序（nvim、tmux、新 ncurses）不受影响。
- 图2的短idle验收通过 `createPtyBrowserFixture({ idleTimeoutMs })` 透传正常会话配置；省略时仍为600000ms。该测试参数不修改产品默认，不合成sleep/wake事件。

### 终端验证材料

D7前local/office原版close反例保留于当时的任务记录（未随仓库发布），不是D7候选结论。新验收入口`tests/workspace/check-pty-d7.mjs local|office`记录正常close、杀transport wrapper、Gateway SIGKILL及自然exit；独立observer核对普通job消失、nohup/disown-h保留，测试owner最终只清记录身份。

旧 `tests/workspace/check-terminal-restore.mjs` 验证的是 Jupyter 持久接回，不作为新 PTY 生命周期证据。浏览器掉线保留与 Gateway 掉线不接回必须分开验收；不能一并删除前者。

### 模型终端的展示与运行说明

关联 [模块约定](../wire/kernel.md#约定)、[REQ-12](../contract.md)、[TGT-14](../contract.md)、[TGT-15](../contract.md)、[TGT-16](../contract.md)、[模块约定](../wire/workspace.md#约定)、[TGT-12](../contract.md)、[模块约定](../wire/workspace.md#约定)。原 440、457、459、461、463、465、467、469。

- 新PTY经公开argv/env启动内存wrapper及`/bin/bash --login --noprofile -i`；首次PROMPT_COMMAND在内存加载既有rc并安装后续原生链，初始化首提示符标记。profile后设置`huponexit`，自然exit仍返回真实码；不向PTY键入bootstrap或写用户配置。`OSC 133`定命令边界，`OSC 7`报工作目录；headless xterm沿用公开parser/buffer/marker。
- 人工和模型终端使用同一份 Bash 初始化：先加载 `/etc/profile` 与第一个可读的 `~/.bash_profile`、`~/.bash_login`、`~/.profile`，再串联用户 `PROMPT_COMMAND` 和 DEBUG trap，并在用户 PS1 后追加 B 标记。PTY 显式设 `TERM=xterm-256color`、`COLORTERM=truecolor`，profile 后保留真彩色，并设 `TERM_PROGRAM=prk`、清除继承的 `TMUX`/`STY`/`KITTY_*`/`WEZTERM_*`/`ITERM_SESSION_ID`/`LC_TERMINAL`/`VTE_VERSION`/`KONSOLE_*`/`WT_SESSION` 等标识：local daemon 继承 Gateway 环境，开发时从 tmux/herdr 等启动的 Gateway 会让程序误判终端（tmux 拒绝嵌套、图片走 tmux 透传或 kitty 专用路径）。人工终端无 B 时仍可人工使用，模型结果显式不可跟踪。只有模型输入创建的命令产生通知。
- 模型在 profile 后另设四个非交互环境变量，关闭历史展开、开启 bracketed paste，并把 HISTFILE 指向 `terminal.modelHistoryFile`。首跳的 prompt bootstrap 清除已读的人类历史并重读模型历史；`prk_ssh` 的 `--rcfile` 跳在 rc 结束后由 Bash 自己读取一次。两种启动均以 `histappend` 和 prompt 链中的 `history -a` 保留已完成命令，沿用用户的 `HISTSIZE`、`HISTFILESIZE` 和 `HISTCONTROL`；人工终端不受这些模型设置影响。
- 正常情况下模型不得关闭、重启或重建人工终端，除非用户明确要求；只在工具描述约束，不添加意图检测。硬超时与模型命令输出刹车的重建例外遵循 [TGT-14](../contract.md)：确认旧终端结束后用原 owner/name 与对应 rc 重建；完成事件和工具结果明确说明人工终端重建，不把仍存活的命令提前记成 killed。
- `prk_ssh` 通过 `ssh -t` 让远端 Bash 在内存中加载发起端的同一份 rc；base64 正文不包含自身赋值，多跳复用原正文，大小不累积。每跳加载目标机的 profile，模型历史路径中的 `~` 使用该跳的 `$HOME`。远端只需 bash/base64，不落盘 rc；普通 ssh 不注入。
- 已收到 C 的 running 命令收到新提示符 B 时结束、退出码 null；尚未 C 的待执行输入忽略 readline 粘贴／重绘产生的 B，不把正常多行输入提前结算。后续远端命令独立编号，exit 返回上一层后由该层 D 结束 exit 命令。普通 `bash -c` 的 D 与退出码不变，无标记子 bash 仍跟踪到退出；没有标记的 REPL 只显示屏幕，不猜测内部命令状态。
- `yield_s`只控制前台等待，`timeout_s`是硬命令期限。超时先Ctrl-C；三秒未结束时确认旧shell退出后重建，close失败不创建替代或标killed。D7按Bash原生job表处理未主动脱离job；nohup/disown/setsid/tmux保留。非Linux以`normal-close-only`标注断链清理降级。前台等待抑制完成/静默通知但不抑制warning；quiet_notify沿quietLadderMs通知。
- `output_brake` 是独立的每终端开关，初始值取 `terminal.outputBrakeDefault`（默认 `true`），同样可在创建或任意 `terminal_textsend` 调用、或 `terminal_set` 中设置；set 省略的开关不变，返回两个开关。模型发出的命令超过 `terminal.commandOutputLimitBytes`（默认 16 MiB）时，开启刹车只发一次 Ctrl-C，结果用 `truncated:true` 和 note 明示阈值及自动中断原因，status 仍按真实结束结算；不响应时复用硬超时的三秒确认关闭／重建路径。dev server、持续日志等长驻进程用 `output_brake=false` 豁免，只发一次 warning，不中断；人类自己敲的命令不刹车、不告警模型。
- 阈值按 OSC 133 C 之后、D 之前进入命令的原始 UTF-8 PTY 字节累计，不含 OSC 133 边界帧；OSC 7 与其他控制字节计入。所有来源的命令超限后都不再往 `prefix` 追加全文，只保留 `terminal.truncatedHeadBytes` 和 `terminal.truncatedTailBytes`（默认各 4096 字节）与 `…[discarded N bytes]…`。头尾按完整 UTF-8 码点截取；N 是实际丢弃的归一化 xterm 文本 UTF-8 字节数，不是 PTY 原始字节数，不含标记。归一化沿用原 `bufferText` 提取口径，已提交的滚动文本计入累计，可变 viewport 在冻结前仍按终端语义更新；即使控制字节使阈值超限而归一化文本全能放下，也插入 N=0 标记。
- 原始归一化命令文本只在网关内存中有界保存。未超限时完整保留，超限后丢弃的中段永久不可取回。已完成命令按 `historyCommands` 和 `historyBytes`（默认 64 MiB，保留文本与标记的 UTF-8 字节总量）双预算从最旧淘汰；淘汰同时清除最新命令引用，避免从另一引用保留已淘汰输出。
展示先折叠相同原行与连续空行，再按头部、匹配窗口和尾部缩短长行；不能折叠缩短后恰好相同的不同原行。展示省略标记中的 `N` 是省略的 `UTF-16` 字符数，偏移是保留输出中的 `UTF-8` 字节索引，不表示已丢弃中段可取回；重叠窗口会合并，统一码码点不拆分，标记计入预算且不拆分。屏幕尾部或经终端转义转换的内容没有可靠原文映射，只用计数标记；预算过小时也用计数标记，连标记都放不下时保留完整码点并设 `truncated:true`。
- 匹配窗口只针对静态的单个 `rg`、`grep`、`egrep` 或 `fgrep` 命令：支持位置参数、`-e`、`--regexp`、紧随选项的值、重复模式、带引号或转义的参数、已知取值参数；支持固定文本、忽略大小写及 `JavaScript` 可处理的 `BRE`、`ERE` 子集。命令解释器展开、复合命令、未知选项、模式文件、反向匹配、非法正则或无匹配均退为头尾展示；这是展示提示，不是第二个搜索器。
- 原文分页使用 `terminal_read(command,offset)`，偏移单位为 `UTF-8` 字节；`total_bytes` 为保留文本的未压缩长度，超限后只分页头／标记／尾，不提供丢弃中段。`raw:true` 返回当前屏幕。内核没有原始分页，`Python` 的 `bash` 与原生 `bash` 数据不变。
没有 `full_output_path`。
后台模型命令产生 `done`、`exit` 通知（及已开 `quiet_notify` 终端上的 `quiet` 通知）；豁免命令的超限 `warning` 即使在前台等待或 `quiet_notify=false` 时也发送，不被同批 done／quiet 抑制。全部复用既有两秒批次和原生 `pi.sendMessage`，参数为 `triggerTurn:true`、`deliverAs:steer`；活动命令或待发批次阻止空闲回收。睡眠和重载保留空闲终端；关闭、归档、切换目标或正常关闭进程会关闭终端并清理输出，不为崩溃建立命令恢复或持久日志。

### 监控目标通道与版本控制后备展示

关联 [REQ-13](../contract.md)、[模块约定](../wire/kernel.md#约定)、[REQ-13](../contract.md)、[模块约定](../wire/kernel.md#约定)。原 63、436、489、491。

- 目标通道集中持有隐藏终端传输、启动引导与逐行 `JSON` 分帧、请求关联、心跳及重启；使用方获取、释放引用计数租约。运行时与模块源码在启动时一次发送；每个模块单独使用标准库工作线程，缓慢的 `git` 或单模块错误不阻塞传输心跳和其他模块。`customMetrics` 自行监督非阻塞命令，正常关闭会清理进程组。
- 指标经目标通道的 `/bin/bash -c` 执行，标准输入接 `/dev/null`；每个指标独立且不重叠，完成后再等 `interval_s`，时钟步长为 0.5 秒。只有展开卡片的焦点租约会运行自定义命令，折叠、到期或最后一个唤醒会话消失都会停止，目标也校验租约。`number` 从标准输出取首个数字，`json` 取有限数字标量；标准错误计入共享输出上限但不解析。超时、取消或溢出会终止进程组，错误归属该指标。
- 采集器在公开 `Jupyter` 终端中执行 `exec python3 -u -c bootstrap`，通过标准输入下发源码，不写目标文件；隐藏终端不进用户列表或 `terminalsPerWorkerMax`，也不接触会话内核。
只为存在唤醒会话的目标维持采集器；网关宿主也需要显式 `local:true` 的唤醒实例。
机器指标读取 `/proc` 与 `os.statvfs`，不派生 `free` 或 `df` 进程。
- 定时采样只采机器与工作目录磁盘，不执行 `git`；只有监听、显式刷新，或 `write`、`edit`、`bash`、`python`、`kernel_code` 完成后经防抖，才由 `git` 自己用 `rev-parse` 定位仓库，再读取相对 `HEAD` 的差异与状态。
不是仓库、`safe.directory`、损坏的 `.git`、缺少 `git` 等失败时，汇总开发套件历史中成功 `write`、`edit` 的 `added`、`removed`，展示变更总量，并附标准错误首行；它不是净差异，也不重读文件计算。
所有会话睡眠、关闭或归档时停止采集器并删除终端，末次值保留并显示 `age`。
- 新工作区文件的 cwd 是目标绝对 POSIX 路径，根 `/`；目标机验证存在性，不调用 `/api/resolvePath`。文件请求期限使用 `targetConnection.requestTimeoutMs`，超时经连接 owner 退休共享代次，不重放。S2 模块与 S6 生产装配边界见 [文件设计](files.md#s2-工作区目标文件候选)。

## 桌面舞台与布局预设

纯浏览器内布局，不跨进程；代码在 `web/shell/stage/`。手机仍是 `web/workspace/pane/` 的全屏工作区。

- 桌面只有一个 dockview 网格：聊天是 locked、无组头的一组，文件、diff、终端 tab 可停在聊天左、右、下或彼此之间，不可在聊天上方和舞台顶边。目录（浮层或钉列）与监控浮卡在网格外。
- 主区吸收舞台尺寸变化（窗口、会话栏、钉住的目录列），其他组保持尺寸：变化期间用公开 `setConstraints` 钉住它们 200ms，方向从 `toJSON()` 的分割树推出。主区默认是聊天，布局 2 是工作区组，自定义布局记保存当时的主区。
- 每个非主区组有偏好尺寸：只在拖分割线、拖放或增删组、应用预设、恢复存档时更新；舞台变小造成的被动挤压不改它（变化期间及松开后的重排都算被动，松开时把"已排好的尺寸"记下，dockview 迟到的布局事件与之相同就不算用户改动）。松开时按偏好尺寸重排（`fitPreferred`）：变小时主区先缩到下限（聊天卡 360），之后其他组按偏好尺寸成比例让出；变大时先补回被压的组，剩下的给主区。重排用 reuse `fromJSON`，焦点留在原处。
- 每会话网格存 `pi.layout.grid.<sessionId>`（dockview JSON + `main` + `preferred`）；预设存 `pi.layout.presets`（各组尺寸取偏好尺寸），最后应用的预设存 `pi.layout.lastPreset`，全部登记在 `layout-store.js`。预设只记分割树、尺寸、每组的面板种类、主区和工作区开合，不记具体文件或终端。
- 应用预设用 dockview 的 `fromJSON(..., { reuseExistingPanels: true })`，面板不重建：shell、未保存文本、滚动位置都保留。按种类把现有面板分进预设的组，组内 tab 顺序和选中不变；没有面板的组丢掉。新开的 tab 按最后应用的预设落位。
- dockview 8.5.1 在从嵌套根的网格做 reuse `fromJSON` 后 `api.width` 可能停在旧值，舞台一律用网格元素自身尺寸。
