# 会话工作区：文件与终端

规则：[TGT-6](../contract.md)、[TGT-7](../contract.md)、[TGT-8](../contract.md)、[TGT-9](../contract.md)、[TGT-10](../contract.md)、[TGT-11](../contract.md)、[TGT-12](../contract.md)、[TGT-13](../contract.md)、[TGT-14](../contract.md)、[TGT-15](../contract.md)、[TGT-16](../contract.md)、[TGT-48](../contract.md)、[REQ-43](../contract.md)、[WEB-4](../contract.md)、[GEN-7](../contract.md)、[LIFE-11](../contract.md)、[LIFE-12](../contract.md)、[LIFE-13](../contract.md)、[LIFE-16](../contract.md)。
## Files and terminal shapes

```ts
type WorkspaceFileMetadata = {
  name: string; path: string; type: string; // includes native "notebook" listings
  size: number | null; mimetype: string | null;
  last_modified: string | null; writable: boolean | null;
};
type TerminalSnapshot = {
  name: string; generation: string; connectionStatus: "connecting" | "connected" | "disconnected";
  owner?: "model"; label?: string; rows: number; cols: number;
  cleanup?: "linux-pdeathsig" | "normal-close-only";
  replay: string; // recent raw stdout, including terminal control sequences
};
type TerminalEvent = {type:"stdout", data:string} | {type:"closed"} | {type:"resize", rows:number, cols:number};
```

File paths 是规范化目标绝对 POSIX 路径；root listing 用 `path:"/"`，空串不是根。
Omitted listing path 使用持久化会话的绝对 cwd；不存在/不可访问即失败，不换 HOME 或 Gateway 同名目录。
Human terminal target 是创建时捕获的实例与连接代次；model terminal 使用同一 PTY transport。

### Running model commands

The session snapshot's `terminals` array and `state_changed` events at `details.terminals` carry the session's terminal inventory. Each event replaces the array; the existing session `streamId` / `sequence` rules apply. `GET /api/sessions/:sessionId/terminals` returns the same entries under `{terminals}`. No timer or additional observation endpoint is needed.

A model terminal entry may include `runningCommand:{id,text,startedAt}`. It is present only while the existing command tracker reports a running model-issued command in an `owner:"model"` terminal. `id` is that command's existing ID; `startedAt` is its original epoch-millisecond start time. `text` is the first nonempty trimmed command line, bounded to 160 UTF-16 units including a trailing ellipsis without splitting a surrogate pair. Replies to an interactive command preserve its ID, label and start time. Completion, interruption or shell exit removes `runningCommand`; human-owned terminals and manually entered commands never receive it.

The background-task view uses only the selected session's `owner:"model"` entries with `runningCommand`, alongside `kernel.activeCells`. It must not aggregate child sessions or infer command state from PTY output. Elapsed time is computed locally from `startedAt`; command tracking is not a second timer or execution authority. Terminal WebSocket snapshots remain raw PTY snapshots; command identity comes from the session snapshot/event projection.

The background task's Interrupt action requests `terminalInterrupt` with the terminal name, PTY generation and command ID. The Gateway targets only the matching running model-owned command, not the model turn. It sends Ctrl-C and uses the hard-timeout fallback: after three seconds, if the command is still running, confirm the old PTY closed before replacing it. A stale or non-model match returns `{requested:false}` without sending input. `{requested:true}` reports a request, not completion; the client waits for removal of `runningCommand`. Ordinary terminal keystrokes, including Ctrl-C, still use the raw WebSocket input frame.


## Wire methods

Every `files*` request except `filesDownloadNext` additionally requires `target:string` (HTTP body as well as wire params), captured from the operation's session selection. The Gateway compares it to the current authoritative session target before capturing the file context. A mismatch is HTTP 400 `INVALID_REQUEST` with `details.reason:"target-mismatch"`; it performs no file operation and is not a timestamp conflict or a retry instruction. Terminal requests do not take a target.

| Method | Parameters | Result |
| --- | --- | --- |
| `filesList` | `{sessionId,path?}` | `{path,entries:WorkspaceFileMetadata[],truncated:boolean}` |
| `filesRead` | `{sessionId,path,format?:"text"\|"base64"}` | `WorkspaceFileMetadata & {content:string,format:"text"\|"base64"}` |
| `filesDownload` | `{sessionId,path}` | `{done:false,value:{name,size}}` |
| `filesDownloadNext` | `{}` | `{done,value:{data}}`; `data` is one base64 chunk |
| `filesWrite` | `{sessionId,path,content:string,format:"text"\|"base64",expectedLastModified?:string}` | `WorkspaceFileMetadata` |
| `filesCreate` | `{sessionId,path,type:"file"\|"directory",content?:string,format?:"text"\|"base64"}` | `WorkspaceFileMetadata` |
| `filesRename` | `{sessionId,path,newPath}` | `WorkspaceFileMetadata` |
| `filesCopy` | `{sessionId,path,toDir}` | metadata of the new copy |
| `filesDelete` | `{sessionId,path}` | `{path}` |
| `terminalsList` | `{sessionId}` | `{terminals:[{name,generation,connectionStatus,owner?,label?,cleanup?,runningCommand?:{id,text,startedAt}}]}` |
| `terminalOpen` | `{sessionId,name}` | `TerminalSnapshot` |
| `terminalInterrupt` | `{sessionId,name,generation,commandId}` | `{requested:boolean}` |
| `terminalInput` | `{sessionId,name,data:string}` | `{sent:true}` |
| `terminalResize` | `{sessionId,name,rows,cols}` | `{resized:true}` |
| `terminalClose` | `{sessionId,name}` | `{closed:true}` |
| `subscribeTerminal` | `{sessionId,name}` | `TerminalSnapshot`, then terminal frames |
| `unsubscribeTerminal` | `{}` | `{unsubscribed:true}` |

`filesRead` 使用 raw bytes（包括 notebooks）；omitted format 对有效 UTF-8 无 NUL 文件返回 text，否则 base64。
Read cap 按正文原始/解码字节检查打开句柄 size 与实际 bounded pread；超限报 TOO_LARGE，不返回截断正文。
下载只用于用户明确取回完整文件。每个下载使用独立 Web ↔ Gateway 连接与目标机上的一个文件句柄，禁止并行拉块。Web 按 HTTP 写入背压依次调用 `filesDownloadNext`；原始块上限为 `workspace.fileChunkBytes` 和 JSON/base64 帧预算的较小值。只有目标句柄关闭成功才返回 `done:true` 的末块（空文件末块为空）；任一连接断开后停止拉取并清理本次下载，不重放。
Write 受 encoded inbound frame / body cap 限制，按 fileChunkBytes 顺序发送；单帧另受 pi-env 固有上限限制。
Empty content 有效；base64 可以包含 standard ASCII whitespace。
File create 默认 empty text；directory create 的参数不含 content / format。
Metadata 中 size / MIME 可为 null。

Timestamp conflict：`{code:"CONFLICT",message,details:{last_modified:<current timestamp>}}`。
版本字符串为 `mtime:<mtimeMs>`，mtimeMs 保留 pi-env stat 的 JavaScript number 小数；客户端原样传回，不用 Date.parse。
时间戳/存在性检查不是 CAS；写失败可能已有部分副作用，不自动重放。冲突必须重读后再决定覆盖。
直接目录按小页累计条目数和 JSON 字节，停止时明确 truncated；隐藏开关仍在客户端。
同名 copy 生成 `name-CopyN.ext`；cp -R -P 在目标复制（保留 symlink），rename 在目标完成；非空目录由 rmdir 拒绝删除。
文件操作达到在途数上限立即 BUSY；超时经目标连接 owner 退休共享代次，所有旧消费者失效，未确认副作用报 UNKNOWN。
Terminal names scoped to session，bound 为 `limits.identityChars`。
Rows / columns 为 positive safe integers。
Replay cap 为 `workspace.terminalReplayBytes` UTF-8 bytes，按完整 code points eviction。
PTY 创建只使用 pi-env 1.6.0 原版 `openTerminal`；输入与尺寸使用其公开 handle。
原版 handle 不公开 request id/session，不能合法关联 `ptyWrite` 入队应答；按 D6 不另造确认机制。
每次输入限制字节，同终端同步 write 按调用顺序执行；Gateway 不缓存、排队或重发输入。
D6 接受 daemon 不消费输入时无界队列增长；write 返回不证明入队或消费，不以 echo/OSC/限速冒充确认。
启动走内存Python wrapper，实例解释器由`python(targetId)`注入。wrapper不读取或转发用户输入；nonce身份首帧仅关联本次wrapper/shell PID，不是D6消费确认，也不进入replay。

## Lifetime

owner、name、generation、连接租约和 replay 只在 Gateway 内存保存，不写终端绑定或输入输出日志。
Public terminal `generation` 为每次新建的 UUID；浏览器重订阅仍活的同一 PTY 时保持不变。
Model tabs 使用 `data-owner="model"` 与 label。
浏览器断开或只重启 Web 只退订；Gateway 与目标连接仍活时终端继续存在。
Gateway 停止或目标连接断开退休两种终端，旧 tab 不接回、不自动创建替代、不补发输入。
重新打开必须是明确新请求；没有终端列表对账、启动 adoption 或持久恢复绑定。
正常`close`先向同一连接代次的shell发SIGHUP，等待`workspace.terminalCloseTimeoutMs`内wrapper确认shell退出，再调用pi-env close；失败不得返回`{closed:true}`或重建。`closeSession`关闭该会话全部终端，`shutdown`拒绝新开并关闭全部会话。
Linux wrapper的shell在fork后设置父死SIGHUP并校验父PID，再以独立PGID取得PTY前台；wrapper死亡触发shell原生job清理。不扫描SID，不增加后台守护。
人工/模型 Bash 以 `--login --noprofile -i` 启动；首次 `PROMPT_COMMAND` 在内存加载共享 rc，串联用户 prompt/DEBUG 钩子，profile 后设置 `huponexit`。模型额外在每次 prompt 追加 [独立 Bash 历史](../configuration/workspace.md#terminal)。自然 exit 保留真实退出码并按 Bash 原生 job 表发送 HUP；主动 nohup/disown（含 -h）/setsid/tmux 保留，不宣称已清除。
`cleanup:"normal-close-only"`表示非Linux能力降级：只保证在线正常close，不保证断链/Gateway SIGKILL清理；界面须明确显示。`linux-pdeathsig`表示父死HUP可用，并不意味着强制结束主动脱离进程。

## Model terminal tools

| Tool | Parameters | Operation |
| --- | --- | --- |
| `terminal_list` | `{}` | List session terminals; returns `{terminals:[{name,owner:"model"\|"human",label,integration:"ready"\|"unavailable",note?}]}`. |
| `terminal_textsend` | `{text,name="main",yield_s?,timeout_s?,restart=false}` | Send text plus Enter to a model or human terminal; only a new name opens clean model bash. Rejects C0/DEL except `\t`/`\n`; wraps `?2004` paste or uses prompt `eval`+`base64` for multi-line/tab text. Restart recreates with the same owner/name; human close/restart is allowed only on explicit user request (description rule, no intent detection). |
| `terminal_keysend` | `{keys,name="main",yield_s?}` | Send raw shortcut bytes without Enter (`C-c`, `C-d`, `C-z`, `Up`, `Down`, `Tab`, `Esc`, `Enter`, `q`, space-separated in order). |
| `terminal_read` | `{name="main",raw=false,command?,offset=0,yield_s?}` | Read latest command output, visible screen (`raw=true`), or retained page (`command` + UTF-8 byte `offset`; head/marker/tail only past limit). Explicit `yield_s` waits in the foreground. |
| `terminal_set` | `{name="main",quiet_notify?,output_brake?}` | Set `quiet_notify` / `output_brake` on an open terminal without input (omitted unchanged); returns `{name,quiet_notify,output_brake,note?}`. Enabling `quiet_notify` restarts the quiet ladder from level 0; `output_brake=false` exempts from auto Ctrl-C, not bounded retention. |
| `terminal_close` | `{name}` | Close the terminal and its processes; returns `{name,closed:true}`. Close human tabs only on explicit user request. |

Direct tools 与 code-mode `gateway.<name>(...)` 共用实现；code mode 收到 structured Python dictionary。

```ts
type ModelTerminalResult = {
  name:string;command_id:string|null;command:string;status:"done"|"running"|"killed"|"unavailable";
  integration?:"ready"|"unavailable";note?:string;
  exit_code:number|null;cwd:string;duration_ms:number;output:string;
  truncated:boolean;total_bytes:number;
};
```

`exit_code:null` 表示无可报告的命令退出码，`command_id:null` 表示尚无 command。
Normal output 的 compact bounds / markers 见 [模块约定](kernel.md#约定)、[REQ-12](../contract.md) 与 [terminal configuration](../configuration.md#terminal)。
Retained command pages 使用 command ID + UTF-8 byte offset；未超限时保留全文。超限后 `truncated:true`，只保留配置的 UTF-8 头尾与 `…[discarded N bytes]…`；N 是实际丢弃的归一化 xterm 文本 UTF-8 字节数，不含 PTY 控制序列和标记本身。标记即使 N 为 0 也保留，头尾上限按完整码点截取。丢弃中段永久不可通过命令分页取回，分页和 `total_bytes` 仅针对保留的头／标记／尾；`raw:true` 仍是当前 visible screen，不是完整输出存档。
OSC 133 标记 command boundaries；收到 C 后为已开始命令，收到 D 以该退出码结束，执行中收到 B（嵌套 shell 的提示符）则以 `exit_code:null` 结束。尚未收到 C 时，单独的 B 是 readline 提示符重绘，不结束待执行输入。新的 PROMPT_COMMAND 标记 A（不含上一条命令 D 随后的 A）说明 shell 已回到提示符且未报告开始，待执行输入以 `status:"killed", exit_code:null` 及说明结算。无结束／提示标记的 REPL 或普通 ssh 继续属于当前 running 命令。
Text reply（如 `y`）延续 current command ID。

人工终端使用人类版 bash rc；10 秒内未见 B 时，`terminal_list` 及 read/textsend/keysend/set 明确给出“命令级跟踪不可用”，read/textsend/keysend 返回 `status:"unavailable"` 和屏幕，不推断 running/done。无法跟踪时，显式或配置的非零硬超时在发送输入前拒绝，不能静默忽略；人类自己输入的命令超限时仅做同样的头尾保留，不发 Ctrl-C，也不触发任何模型通知。
硬超时先 Ctrl-C，三秒后仍未结束则确认旧 PTY 清理后重建；人类终端保留 owner/name 并重新加载人类 rc，工具结果和完成事件带 `note:"人类终端已因硬超时重建"`。清理无法确认时报告失败，不创建替代。
输出阈值 `terminal.commandOutputLimitBytes` 默认 16 MiB，累计 OSC 133 C 后、D 前的原始 UTF-8 PTY 字节，不计 OSC 133 边界帧，计入 OSC 7 等其他控制字节。`output_brake` 初值取 `terminal.outputBrakeDefault`（默认 true）。模型发出的命令超限后，开启时只发一次 Ctrl-C，并在结果 note 明示超过阈值被自动中断；status 按真实结束结算，不因发出 Ctrl-C 伪造 killed，三秒后仍不结束则复用已有确认关闭／重建路径。关闭时不发 Ctrl-C，而是每条命令发一次 warning，明确超限后只保留头尾。
人工和模型终端均提供 `prk_ssh [ssh options] <destination>`（只用于交互登录）；`ssh -t` 将发起端同份 rc 的 base64 交给远端 Bash，在内存 process substitution 中加载，支持多跳且不落盘 rc。远端只需 bash/base64，加载目标 profile 和用户钩子；模型历史路径在目标机展开。远端 exit 的完成码来自返回上一层 Bash 的 D；远端非 Bash／REPL 使用 `terminal_read(raw=true)` 看屏幕。
终端颜色环境遵循 [TGT-53](../contract.md)；rc 的位置与 profile 顺序见 [环境说明](../design-notes/workspace.md#模型终端的展示与运行说明)。

Background custom message：

```ts
{customType:"terminal-event",display:true,content:JSON.stringify({events}),details:{events}}
// events: {kind:"done"|"quiet"|"exit"|"warning",quiet_ms?,result:ModelTerminalResult}[]
```

通知经 two-second batching 后使用 `pi.sendMessage(...,{triggerTurn:true,deliverAs:"steer"})`。warning 与 done／quiet 共用此原生消息路径，前台等待及 `quiet_notify=false` 均不抑制 warning；同批的 done／quiet 不替换或吞并 warning。
Web row hook：`.pi-terminal-event[data-kind]`。

## Private workspace HTTP routes

| Route | JSON body | Wire method |
| --- | --- | --- |
| `POST /api/sessions/:sessionId/files/list` | `{path?}` | `filesList` |
| `POST /api/sessions/:sessionId/files/read` | `{path,format?}` | `filesRead` |
| `POST /api/sessions/:sessionId/files/download` | URL 编码表单 `{target,path}` | `filesDownload` / `filesDownloadNext`，返回二进制附件 |
| `POST /api/sessions/:sessionId/files/write` | `{path,content,format,expectedLastModified?}` | `filesWrite` |
| `POST /api/sessions/:sessionId/files/create` | `{path,type,content?,format?}` | `filesCreate` |
| `POST /api/sessions/:sessionId/files/rename` | `{path,newPath}` | `filesRename` |
| `POST /api/sessions/:sessionId/files/copy` | `{path,toDir}` | `filesCopy` (same dir → `name-Copy1.ext`; directories copy recursively) |
| `POST /api/sessions/:sessionId/files/delete` | `{path}` | `filesDelete` |

下载保留原有精确 Origin 与目标、会话、绝对路径校验。响应携带 `Content-Disposition: attachment`（含文件名）、按扩展名获取的 `Content-Type`（未知为 `application/octet-stream`）和 `Content-Length`。`workspace.fileDownloadBytes` 默认 4 GiB，超限返回 413 `TOO_LARGE`；不改变 `fileReadBytes`。已开始响应后，提前 EOF、读错或连接失败均中止响应，不把截断体作为成功文件发送。
| `GET /api/sessions/:sessionId/terminals` | none | `terminalsList` |
| `POST /api/sessions/:sessionId/terminals/interrupt` | `{name,generation,commandId}` | `terminalInterrupt` |
| `POST /api/sessions/:sessionId/terminals/close` | `{name}` | `terminalClose` |
| `GET /api/sessions/:sessionId/terminals/:terminal/ws` (WebSocket upgrade) | frames below | `terminalOpen` + `subscribeTerminal` + `terminalInput`/`terminalResize` |

JSON success：HTTP 200，result 与对应 wire method 一致。
Error：`{error:string,code?:string,details?:object}`。
`CONFLICT` / `BUSY` → 409；`TOO_LARGE` → 413；`NOT_FOUND` → 404；invalid/unsupported → 400；host/connection failure → 503。

## Terminal WebSocket

Route：`GET /api/sessions/:sessionId/terminals/:terminal/ws`，唯一可选 query 为 `generation`（非空、仅一次）。
不带 generation 仅用于显式新开，先 terminalOpen 再 subscribeTerminal；带 generation 只订阅，并严格匹配 snapshot.generation，缺失或异代以4000结束，不重开。
一 terminal 对应一 WebSocket；Gateway request pipeline 上限为 `gateway.pendingMax - 1`。Web 待发队列项数不超过 `gateway.pendingMax`，文本总量不超过 `limits.inputBytes`；相邻 input 可在预算内 merge，满时拒绝且不补发。

| Direction | Frame |
| --- | --- |
| Up | `{type:"input",data}`（nonempty） |
| Up | `{type:"resize",rows,cols}` |
| Up | `{type:"ping"}` |
| Down first | `{type:"snapshot",name,generation,connectionStatus,replay,rows,cols,owner?,label?}` |
| Down | `{type:"stdout",data}` |
| Down | `{type:"closed"}` |
| Down | `{type:"error",code,message}` |
| Down | `{type:"pong"}` |

Invalid frame close code：1008。
Final close / error code：4000；Gateway connection loss：1012；network loss 可为 1006。
Input/resize rejection 的 `error` frame 本身可保持 socket open。
宿主变尺寸或恢复可见时按实际组内空间fit，再向当前generation发送resize；裁剪不得替代正确rows/cols。
HTTP结束回执与WS closed可先后重复到达，客户端必须幂等关闭对应代次视图，旧代终态不得删除新代视图。
Heartbeat interval：`http.heartbeatMs`。
Transient setup 的 retry bounds：`http.terminalBusyRetriesMax`、`terminalBusyBackoffMs`、`terminalBusyBackoffMaxMs`。
Gateway library observation API：`onTerminalEvent(listener(event,sessionId,name))`。


## 约定

- 工作区文件/路径属于 target-files/ 与 target-paths/，使用同一目标 daemon 的公开文件请求；target-channel/files 仍是独立 kernel 文件工具出口。生产 Gateway、HTTP 与 native handlers 共用这些模块。
- 工作区文件删除必须由界面确认。
- 模型终端必须仅由 `terminal_textsend` 创建。
- 新 PTY 不预保存或读取恢复绑定；并发创建共享一个 Promise，pending 占终端配额。
- 终端重放缓冲与模型命令输出只能保留在网关内存，不得持久化输入输出日志。
- `replay` 是环形缓冲的近期原始输出，但不从开头被挤出的字符串控制序列（DCS/OSC/APC/PM/SOS，即 Sixel、iTerm2、Kitty 图片）中段开始：已结束的从其结束处（ESC 保留，BEL/CAN/SUB 一并去掉）起；仍未结束的整段替换为 `ESC ]`（原为 OSC）或 `ESC ^`（PM），让续到的载荷落在 xterm 忽略的串里。浏览器收到 snapshot 必须带内写入 `CAN ESC c` 再写 `replay`：CAN 结束旧连接断在半截的串，RIS 清屏幕、模式、Kitty 键盘标志和图片；`Terminal.reset()` 不清解析器状态，不能代替。
- 未超限的命令输出完整保留；超限后不再向 `prefix` 无界追加，只保留 `terminal.truncatedHeadBytes`／`terminal.truncatedTailBytes`（默认各 4096）及丢弃字节标记，见 [TGT-55](../contract.md)、[TGT-56](../contract.md)。归一化文本沿用 xterm 的 `bufferText` 提取口径；已提交的滚动内容累计丢弃字节，可变 viewport 在冻结前仍按原有终端语义更新。
- 已完成命令同时受 `terminal.historyCommands` 与 `terminal.historyBytes`（默认 64 MiB）约束；计费为保留文本及标记的 UTF-8 字节数，任一超出即从最旧命令淘汰，并释放最新命令引用，不保留被淘汰输出的旁路副本。
- 模型命令跟踪不得跨异常退出恢复。
- 网页与 Gateway headless xterm 均开启 `scrollOnEraseInDisplay:true`，用公开 `registerCsiHandler({final:"J"}, ...)` 只吞掉参数 3；其他 `J` 参数交给默认处理。人工与模型 tab 共用此行为，见 [TGT-54](../contract.md)。
