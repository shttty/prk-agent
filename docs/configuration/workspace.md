## `workspace`

| Key | Default | Range / meaning |
| --- | --- | --- |
| `fileReadBytes` | 524288 | Positive maximum file body bytes; opened-file size and bounded reads both enforce it. Oversize content is rejected, never truncated. |
| `terminalReplayBytes` | 262144 | **positive**; fixed UTF-8 recent-output ring capacity per owned terminal; whole code points are evicted. |
| `terminalsPerWorkerMax` | 4 | **positive**; named terminals per worker, including pending creation. |
| `fileChunkBytes` | 262144 | Positive sequential pread/write payload size, at most 16711680; actual JSON + payload must also fit the protocol's 16777216-byte frame. |
| `directoryEntries` | 1000 | Positive maximum returned direct children; overflow is explicit `truncated:true`. |
| `directoryBytes` | 262144 | Positive UTF-8 JSON budget for directory metadata response. |
| `directoryPageEntries` | 32 | Positive target readdir page size; reading stops at the directory count/byte budget. |
| `fileRequestsMax` | 16 | Positive in-flight file operation limit; excess requests receive BUSY without queuing. |
| `terminalInputBytes` | 1048576 | Positive UTF-8 byte maximum for one PTY write, including model direct calls. |
| `terminalStartTimeoutMs` | 10000 | Positive timer; PTY creation and shell integration readiness budget. |
| `terminalCloseTimeoutMs` | 3000 | Positive timer; terminal cleanup confirmation budget, not proof of death. |

Workspace file/terminal shapes: [Gateway transport](../wire/workspace.md#files-and-terminal-shapes).
Target file deadlines use `targetConnection.requestTimeoutMs` (default 10000 ms); timeout retires the owned shared generation and reports unknown effects without replay. For file transfers, this deadline applies to individual target operations, not time waiting for HTTP to supply or drain bytes. Explicit workspace uploads and downloads have no whole-file byte limit. Uploads use `http.uploadIdleTimeoutMs` and per-chunk Gateway/target deadlines, not a total time budget. The download form has the ordinary request body deadline; the streamed download response does not. Terminal setup deadlines are separate.
PTY 启动与清理使用 workspace.terminalStartTimeoutMs / terminalCloseTimeoutMs，单次输入用 terminalInputBytes；Gateway/HTTP/SSE 原有限额仍适用。
Option changes: [模块约定](../wire/targets.md#约定)、[模块约定](../configuration.md#约定); transport implementation: [design notes](../design-notes.md).

## `references`

`maxBytes=262144` bounds explicitly referenced UTF-8 file content; `maxEntries=1000`, `listingBytes=262144` and `timeoutMs=10000` bound target recursive candidate enumeration. The final candidate JSON also uses listingBytes; truncation is never discarded by native-action/HTTP/UI projections. Defaults and validation belong only to `src/config/references/references-options.ts`.


## `terminal`

Terminal entry points: direct `terminal_list`, `terminal_textsend`, `terminal_keysend`, `terminal_read`, `terminal_set`, `terminal_close`; code mode `gateway.<name>`. Read/write/set also support human terminals; human close/restart normally requires an explicit user request. Hard timeout rebuilds a stuck human terminal with its original owner/name and reports the rebuild.
Transport and ownership details: [design notes](../design-notes.md); execution lifecycle: [TGT-14](../contract.md)、[TGT-15](../contract.md)、[TGT-16](../contract.md)、[TGT-55](../contract.md)、[TGT-56](../contract.md)、[模块约定](../wire/workspace.md#约定).

S3 的新 PTY 模块仅经原版 `openTerminal` 创建，显式设置 `TERM=xterm-256color` / `COLORTERM=truecolor`。单次输入须有字节上限；Gateway 不缓存、排队或重发。原版 handle 没有公开关联入队应答的身份，按 D6 不另造确认机制；daemon 不读输入时无界队列增长是已接受风险。
关闭与硬超时重建遵守LIFE-16：正常close先HUP shell，在`terminalCloseTimeoutMs`内等待wrapper确认shell退出，再调用pi-env close。`aborted`不证明死亡。Linux父死HUP与login/huponexit处理普通job；主动nohup/disown/setsid/tmux保留。非Linux仅在线关闭，明确不保证断链清理。D7新行为由`check-pty-d7.mjs`独立验收，S6才接入最终装配。

| Key | Default | Range / meaning |
| --- | --- | --- |
| `modelHistoryFile` | `~/.bash_history.prk-model` | Nonempty Bash history path, without NUL or newlines. Model terminals on the same target share the file; each prompt appends new history. A leading `~` expands to the target shell's `$HOME`, including on `prk_ssh` hops. Human Bash history is unchanged. |
| `yieldMs` | 10000 | Nonnegative foreground wait; must not exceed `maxYieldMs`. |
| `maxYieldMs` | 300000 | Positive maximum `yield_s` converted to milliseconds. |
| `foregroundQuietMs` | 30000 | Positive output-silence interval that releases a foreground wait early. |
| `timeoutMs` | 0 | Nonnegative default hard timeout; 0 disables it. A command can override with positive `timeout_s`. |
| `quietNotifyDefault` | `false` | Boolean default for each terminal's `quiet_notify` switch; overridden per terminal by `terminal_set(name, quiet_notify)`. |
| `outputBrakeDefault` | `true` | Boolean default for each terminal's `output_brake` switch; overridden per terminal by `terminal_set(name, output_brake)`. |
| `quietLadderMs` | `[10000,60000,300000,1800000]` | Nonempty ascending positive timer integers used while a terminal's `quiet_notify` is enabled; each notification advances one level, repeats at the last level. Model input or enabling `quiet_notify` resets to the first level. |
| `scrollbackLines` | 100000 | Positive headless xterm scrollback; active command rows are drained before eviction so retained output is independent of viewport/scrollback height, subject to `commandOutputLimitBytes`. Erase-display handling: [TGT-54](../contract.md). |
| `outputBytes` | 50000 | At least 4 UTF-8 bytes; compact terminal / kernel cell head-tail budget and terminal full-output page size. Kernel metadata suffixes are outside this budget. |
| `historyCommands` | 100 | Positive count of retained finished commands per session; oldest complete outputs rotate out when this or `historyBytes` is exceeded. |
| `commandOutputLimitBytes` | 16777216 (16 MiB) | Positive cumulative PTY-byte threshold per command; model-issued commands receive one Ctrl-C above it unless `output_brake=false`. |
| `truncatedHeadBytes` | 4096 | Positive maximum UTF-8 bytes retained from the start of an over-limit command, without splitting code points. |
| `truncatedTailBytes` | 4096 | Positive maximum UTF-8 bytes retained from the end of an over-limit command, without splitting code points. |
| `historyBytes` | 67108864 (64 MiB) | Positive total UTF-8 byte budget for retained finished-command text, including discarded-byte markers; exceeding either retention budget evicts the oldest commands. |
| `longLineThresholdChars` | 2000 | Positive UTF-16 length above which a logical output line is shortened. |
| `longLineHeadChars` | 80 | Positive retained prefix length per long line. |
| `longLineTailChars` | 80 | Positive retained suffix length per long line. |
| `longLineContextChars` | 40 | Positive context length on each side of every pattern match (about 80 context characters per hit). |

Example in `<PRK home>/config.toml`; omit keys to use their defaults:

```toml
[terminal]
quietNotifyDefault = false
quietLadderMs = [10000, 60000, 300000, 1800000]
```

Timer values are safe integer milliseconds up to 2147483647; terminal count/character fields also have that upper bound. Byte fields permit positive safe integers (`outputBytes` must be at least 4).
`yield_s` and `timeout_s` use seconds; wait, timeout and notification semantics: [TGT-14](../contract.md)、[TGT-15](../contract.md)、[TGT-16](../contract.md)、[模块约定](../wire/workspace.md#约定).
Presentation-only output markers have the form ` …[+N chars, terminal_read(command="<id>", offset=B)]… ` and refer only to retained text.
Retained-output paging: `terminal_read(command=<id>, offset=<UTF-8 bytes>)`; `total_bytes` is the retained text's UTF-8 size; `raw:true` selects the current screen.
`commandOutputLimitBytes` counts raw UTF-8 PTY bytes after OSC 133 C and before D, excluding the OSC 133 boundary framing; OSC 7 and other control bytes count. Below the threshold, complete output and paging are unchanged. Above it, all commands retain only the configured head and tail with `…[discarded N bytes]…`; N counts normalized xterm-text UTF-8 bytes actually discarded, not raw PTY bytes or the marker. The marker is present even when N is 0; retained head/tail caps never split a code point. The discarded middle is permanently unavailable, and paging/`total_bytes` address only the retained head/marker/tail text.
The output brake defaults to on. For dev servers and continuously logging processes, open the terminal first (send `text:""` for a fresh prompt), then call `terminal_set(output_brake=false)` before sending the command. Each over-limit model-issued command emits one warning instead of Ctrl-C, including during foreground waits and with `quiet_notify=false`. Warning delivery is independent of done/quiet notifications. Human-typed commands use the same bounded retention but never trigger the brake or model warnings. An automatic Ctrl-C does not invent a status: the real completion settles it; an unresponsive command uses the existing confirmed-close/rebuild path after three seconds.
Compaction and truncation: [模块约定](../wire/kernel.md#约定)、[REQ-12](../contract.md); retained-output boundary: [TGT-55](../contract.md)、[TGT-56](../contract.md)、[模块约定](../wire/workspace.md#约定).
Shell setup, search-hit windows, Unicode/offset handling and notification implementation: [design notes](../design-notes.md).
For tracked remote commands, use `prk_ssh [ssh options] <destination>` in either terminal type; interactive bash login and further hops retain markers without writing remote files. Ordinary `ssh` stays a single running command. For non-bash shells and REPLs, use `terminal_read(raw=true)`.

## `monitor`

| Key | Default | Range / meaning |
| --- | --- | --- |
| `enabled` | true | Master switch. Off: no collector is started and sessions carry no monitor data. |
| `slowIntervalMs` | 30000 | Collection period of every machine that has an awake session (cards closed): machine metrics and the disk of each session cwd. Git is not sampled on this tick. |
| `fastIntervalMs` | 5000 | Period of a machine while one of its sessions has its card open. |
| `focusLeaseMs` | 30000 | The browser repeats `monitorFocus` while a card is open; without a repeat the machine falls back to the slow period after this long. |
| `historyWindowMs` | 900000 | Positive timer; per-instance chart window (15 minutes), [REQ-13](../contract.md)、[模块约定](../wire/kernel.md#约定). |
| `customTimeoutMs` | 5000 | **timer**; deadline of each custom command, enforced at target tick resolution. |
| `customMaxOutputBytes` | 65536 | **positive**; combined stdout/stderr limit per custom command. Overflow is an item error and kills its process group. |
| `memoryAlertPercent` | 90 | 1–100; kernel memory (`workingSet / memoryMax`) at or above this raises the alert dot. |
| `refreshDebounceMs` | 300 | Finished `write`/`edit`/`bash`/`python`/`kernel_code` tools re-read their session's changes after this coalescing window. |
| `startTimeoutMs` | 15000 | Target-channel startup (terminal, handshake, `hello`) and individual request deadline. |
| `idleExitMs` | 120000 | Legacy parser field retained until the S6 configuration cutover; unused. PRK sends no target-runtime heartbeat and applies no idle-exit timeout. |
| `restartBackoffMs` / `restartBackoffMaxMs` | 2000 / 60000 | Legacy parser fields retained until S6; unused. A failed channel generation is retired immediately, without background retries or stability timers. |
| `restartAttemptsMax` | 5 | Legacy parser field retained until S6; unused. Existing leases remain failed; only a new explicit acquire can start another generation. |

Target-channel request shape: `{id,mod,op,...}`; replies: `{re,...}` / `{re,error}`; events: `{mod,t,...}`.
The last consumer release closes the shared runtime immediately. Sampling ticks, card focus/expiry, refresh and unchanged session lists never relaunch a failed channel; a newly admitted session may acquire a new generation. Module sampling ticks and pi-env's own protocol liveness are separate from the removed PRK heartbeat.

Focus/collection semantics: [REQ-13](../contract.md)、[模块约定](../wire/kernel.md#约定); chart storage: [REQ-13](../contract.md)、[模块约定](../wire/kernel.md#约定).
Hidden-terminal transport, module threads, collector lifecycle and git fallback display: [design notes](../design-notes.md).
Monitor option changes: [模块约定](../wire/targets.md#约定)、[模块约定](../configuration.md#约定).
