# Recovering a Gateway session's execution environment

History browsing follows [REQ-13](contract.md). Durable execution selection contains only `target` and absolute `cwd`; Python comes from the current instance configuration. Concrete REPL/PTY handles and namespace are process-local, never persisted or adopted across Gateway restart.

## Sending is the way back

Operation outcomes `failed` / `unknown` and subsequent input are governed by [REQ-9](contract.md)、[REQ-8](contract.md). Runtime recovery on the next message is [LIFE-7](contract.md)、[LIFE-8](contract.md); unavailable starts and not-submitted input are [REQ-10](contract.md).

Unavailable recovery returns `recovery:{status:"unavailable",message,code?}`; connection failures preserve `TARGET_UNREACHABLE`. Runtime failures refuse input with `submitted:false`. Pending instance configuration returns `INVALID_REQUEST` with `details:{submitted:false,configurationIssue:{code,message}}`; history and sleeping settings remain usable without connecting. Missing cwd, target and interpreter failures never redirect execution.

## Explicit choices

The Gateway request is `recoverSession {sessionId, mode, target?, cwd?}`; HTTP uses `POST /api/sessions/:sessionId/recover`. Only `auto` and `new` are supported. `auto` preserves target/cwd; `new` requires target and may set cwd. Neither accepts session-level Python or kernel selection.

| Mode / result | Contract |
| --- | --- |
| `auto` | [LIFE-7](contract.md)、[LIFE-8](contract.md) |
| `new` | [LIFE-9](contract.md)、[模块约定](kernel-recovery.md#约定) |
| `unavailable` | [REQ-10](contract.md) |

Recovery metadata and credentials: [模块约定](kernel-recovery.md#约定). The default `session.historyDir` is `"sessions"`, resolved as `<PRK home>/sessions`; a Gateway host can supply a server-side history directory.

Workbench hooks include `.pi-operation-outcome` for an operation failure, an unavailable status pill with its reason, and a not-submitted banner for refused input. Kernel-only rebuild presentation is covered by [LIFE-9](contract.md)、[模块约定](kernel-recovery.md#约定). SDK history includes failed assistant messages.

Close requests with unconfirmed owned-kernel cleanup return `UNAVAILABLE` with `details.closed:true`, `details.cleanup:"unconfirmed"` and the old generation's owned identity ([LIFE-10](contract.md), [wire details](wire/kernel.md#generation-retirement)). `closed:true` marks the generation unusable; it does not prove the process exited.

## Three different shutdown cases

| Owner event | Contract |
| --- | --- |
| Browser or Web-adapter disconnection | [LIFE-1](contract.md) |
| Normal Gateway shutdown and later wake | [LIFE-3](contract.md)、[LIFE-4](contract.md) |
| Abnormal Gateway OS-process exit | [REQ-8](contract.md)、[LIFE-5](contract.md) |

Gateway or target-connection loss invalidates old execution handles and namespaces. The next explicit input may create a fresh REPL; it never adopts the previous process or replays uncertain input. While the Gateway still tracks the retired generation, it refuses to start a replacement without proof that the old owned generation has exited. A disconnected snapshot is not proof.

## Focused verification

`npm run check:recovery` uses the real Pi SDK, an owned target fixture and a controlled provider. It checks same-Gateway continuity, Gateway loss with fresh namespace on explicit input, uncertain side effects without replay, and normal-stop cleanup while an independently owned sentinel remains usable. Set `PI_TEST_PYTHON` to an existing Python 3.9+ executable and use an isolated HOME/PRK_HOME; never use production services.

`tests/sessions/check-failed-recovery.mjs` covers provider failure without losing the live session/namespace, REPL death yielding unknown, subsequent fresh execution without replay, missing-cwd refusal without submitting input, and saved-model fallback. Optional browser checks use `PI_TEST_PLAYWRIGHT` and `PI_TEST_CHROMIUM`; they are controlled-provider mechanism checks, not paid-model acceptance.

`tests/web/check-web-model-live.mjs` exercises two sessions through the browser: Web-only restart preserves the live Gateway namespaces; Gateway SIGKILL preserves readable history but explicit execution gets new empty namespaces. Fresh tool-result IDs distinguish actual execution from retained history. Its `--controlled` mode uses the existing zero-paid provider fixture.

## Session spawn benchmark

`scripts/bench/session-spawn.mjs` is an opt-in, zero-paid benchmark using the embedded Gateway, Pi SDK, owned daemons/REPLs, process channel and faux provider. It is not registered in quick/full. Run with an isolated HOME/PRK_HOME and `SHELL=/bin/bash`:

```sh
env SHELL=/bin/bash \
  PI_TEST_PYTHON=/path/to/existing/python \
  node scripts/bench/session-spawn.mjs --out /tmp/prk-spawn-bench
```

Default: five measured samples and five simultaneously retained idle children per local/remote × code/direct × native off/on scenario, plus twenty sequential execute/destroy cycles. Remote native-on adds five target-cache-hot samples; its cold samples clear only the owned fixture's target artifact cache. Gateway bundle preparation happens before timing. `--scenario remote/code/on` selects one scenario; `--smoke` reduces counts to one and is not a benchmark result. `--help` defines clocks, RSS attribution, transfer byte accounting and output files.

Current PRK only applies `session.localTools:true` defaults to `local:true` targets. Remote spawn cannot request native tools, so remote native-on is explicitly measured as spawn → idle → `local-tools` → reload → task; its actual first request remains native-off, and its first post-reload request is reported separately. This benchmark does not change that product behavior. The remote target is another owned loopback fixture, not a real network-latency measurement.

Raw JSON includes per-sample clocks, context component sizes, kernel scope memory, host process RSS, artifact hashes/bytes, process-exit checks and RSS trajectories. `summary.json` contains count/median/max. Gateway RSS includes the in-process benchmark harness and ordinary SDK history/catalog/archive retention; no forced GC is used. Host cgroup memory can belong to a shared scope and must not be attributed to one host; use the recorded host PID's RSS. Twenty-cycle RSS growth alone does not establish a leak.


## Test environment

Install the checkout's locked dependencies with `npm ci && npm --prefix web ci`. Both `npm run check:quick` and `npm run check:full` require:

```sh
export PI_TEST_PYTHON=/absolute/path/to/python3
export PI_TEST_PLAYWRIGHT=/absolute/path/to/node_modules/playwright-core/index.mjs
export PI_TEST_CHROMIUM=/absolute/path/to/chromium
```

Use an existing Python 3.9+ interpreter and a compatible Chromium binary. Install Playwright separately from PRK's dependencies; `PI_TEST_PLAYWRIGHT` points to its ESM entry and `PI_TEST_CHROMIUM` to the executable, not the browser directory. `check:quick` runs controlled-provider and mock-browser checks. `check:full` is reserved for release verification; live-model checks have separate entry points and may incur provider charges.

Run the smoke suite in a Linux user session with a working systemd user manager and delegated cgroup v2 memory controller: the restart check starts its own user units, and the instance-Python check requires a real scope. When isolating `HOME`, keep access to the user bus (`XDG_RUNTIME_DIR` / `DBUS_SESSION_BUS_ADDRESS`). Native deployment fixtures also need real `bun`, `rg` and `fd` executables on `PATH`, or explicit `PI_TEST_BUN_BINARY`, `PI_TEST_RG_BINARY` and `PI_TEST_FD_BINARY` paths.

Use owned fixtures and isolated state, not an existing Gateway, browser session, or user home.

- Remote fixtures named `office` take `PI_TEST_SSH`: the full non-interactive SSH command up to and including a test-owned host. Do not use a production target.
- `check-plugin-host-commands.mjs` and `check-real-plugin-catalog.mjs` use a prepared, isolated `PI_TEST_PLUGIN_AGENT`. Set `PI_TEST_TASTE_PACKAGE` to the owned package's absolute path for the commands check, or `PI_TEST_HINDSIGHT_SOURCE` to the memory plugin's exact `source` in the fixture settings for the catalog check.
- `check-managed-python-live.mjs` requires an isolated `PRK_HOME` and, if set, `PI_TEST_ARTIFACT_HOME` under `$TMPDIR/uvenv-1/` (or `/tmp/uvenv-1/` when `TMPDIR` is unset).


## 约定

- 首次执行前必须持久化会话的显式实例和有效绝对 cwd；Python 只由实例选择。
- 实例 cwd 默认值后续变更不得重定向已有会话；实例 Python 变更必须通过活动资源检查。
- 仅重建内核不得保留旧 `Python` 内存。
- 仅重建内核不得额外插入变量丢失提示、成功通知或确认步骤。
- 执行选择必须保存在原生 SDK 会话记录中；运行时 handle 不得持久化。
- 新连接必须使用当前实例的 local/sshCommand 配置。
- 不得持久化 `Python` 内存快照。
- 连接级失败必须保留 TargetUnreachableError 与结构化 reason，不得用错误文案推导错误类型。
- Web 恢复横幅的 data-code 必须原样展示 recovery.code；失败不得后台重连或重放。
- 退休与租约释放顺序见 [Generation retirement](wire/kernel.md#generation-retirement)。
