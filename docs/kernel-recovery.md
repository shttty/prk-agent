# Recovering a Gateway session's execution environment

History browsing follows [REQ-13](contract.md). Durable execution selection contains only `target` and absolute `cwd`; Python comes from the current instance configuration. Concrete REPL/PTY handles and namespace are process-local, never persisted or adopted across Gateway restart.

## Sending is the way back

Operation outcomes `failed` / `unknown` and subsequent input are governed by [REQ-9](contract.md)、[REQ-8](contract.md). Runtime recovery on the next message is [LIFE-7](contract.md); unavailable starts and not-submitted input are [REQ-10](contract.md).

Unavailable recovery returns `recovery:{status:"unavailable",message,code?}`; connection failures preserve `TARGET_UNREACHABLE`. Runtime failures refuse input with `submitted:false`. Pending instance configuration returns `INVALID_REQUEST` with `details:{submitted:false,configurationIssue:{code,message}}`; history and sleeping settings remain usable without connecting. Missing cwd, target and interpreter failures never redirect execution.

## Explicit choices

The Gateway request is `recoverSession {sessionId, mode, target?, cwd?}`; HTTP uses `POST /api/sessions/:sessionId/recover`. Only `auto` and `new` are supported. `auto` preserves target/cwd; `new` requires target and may set cwd. Neither accepts session-level Python or kernel selection.

| Mode / result | Contract |
| --- | --- |
| `auto` | [LIFE-7](contract.md) |
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

## Test environment

`npm test` runs typechecking (backend and web), pure Node unit tests, Web lint, contract lint and structure lint. The unit runner loads `scripts/verification/resolve-web-sources.mjs` (`--import`) so web modules renamed to `.ts` still resolve from their `.js` specifiers. Install the checkout dependencies first: `npm ci && npm --prefix web ci`.

`npm run check` also runs real Gateway/SDK integration tests, Chromium journeys and the Web build. In a Linux user session, make `bun`, `rg` and `fd` available on `PATH` and set:

```sh
export PI_TEST_PYTHON=/absolute/path/to/python3
export PI_TEST_PLAYWRIGHT=/absolute/path/to/node_modules/playwright-core/index.mjs
export PI_TEST_CHROMIUM=/absolute/path/to/chromium
npm run check
```

The runner creates isolated HOME, PRK_HOME and TMPDIR for its layers. Use a short, owned TMPDIR so Gateway socket paths fit, and keep access to the user systemd bus. Integration uses owned local and loopback targets, not a production machine. Playwright is installed separately; `PI_TEST_PLAYWRIGHT` names the ESM entry, not its directory.

For one related layer, run `node --test 'test/integration/**/*.test.mjs'` or `node --test 'test/browser/**/*.test.mjs'` with the same owned environment and `SHELL=/bin/bash`. For one file, pass its path instead. Faux provider responses exercise the real SDK and transport without calling a paid model. For an explicitly authorized paid smoke, start an owned Gateway with the chosen `--model PROVIDER/MODEL`, then manually submit a prompt with `node src/main.ts attach --home /absolute/owned/prk-home --socket /absolute/owned/gateway.sock send --session SESSION_ID --message "Verify the selected model"`. This command is never part of `npm run check`.

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
