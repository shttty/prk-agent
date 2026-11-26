## `targetCacheRoot` (top-level)

`targetCacheRoot = "~/.cache/prk"` selects one writable, executable cache root **on each target**, including local instances. Use an absolute POSIX path or `~/...`; `~` expands to the target user's home, never the Gateway home. Relative paths and `~otheruser` are rejected. For isolated acceptance runs, set an explicit owned test root rather than using the default.

| Directory below the root | Contents |
| --- | --- |
| `bin/<sha256>/<name>` | Distributed CLI executables, including uv, Bun, rg and fd. |
| `pi-env/` | Remote pi-env daemon versions and hashes. |
| `remote-extensions/` | Immutable Node runtime, SDK, host and plugin bundles. |
| `python-mirror/` | Pinned Python install archive for offline uv installation. |
| `python/` | uv-managed Python installations (`UV_PYTHON_INSTALL_DIR`). |
| `uv-cache/` | uv cache (`UV_CACHE_DIR`). |
| `venvs/<instance>/` | Persistent per-instance environments, shared by that instance's sessions. |

`wheels/` is reserved for the unimplemented kernel-module wheel-distribution design; declaring Python wheel dependencies still fails explicitly. It is not populated by the managed Python setup.

### Offline cache-root migration

`codemode.binCacheDir` has been removed. Gateway refuses it with migration guidance; startup never reads both keys or rewrites configuration. Stop Gateway and run on an owned, backed-up PRK home:

```sh
node scripts/migrate-config-toml.mjs --home /absolute/prk-home
```

The script also handles an existing `config.toml`: an old cache path ending in `/bin` becomes its parent `targetCacheRoot` (`"/owned/cache/bin"` → `"/owned/cache"`, `"~/.cache/prk/bin"` → `"~/.cache/prk"`). It preserves the original as `config.toml.before-target-cache-root`. A different suffix, a relative path, or both old and new keys cause an explicit no-write refusal: choose `targetCacheRoot` yourself and remove `codemode.binCacheDir` manually. Existing JSON-to-TOML migration retains its `*.json.before-toml` backups.

No old cache directories are moved. After the instance environment is deployed into the new root (the next session start does it), old `~/.cache/prk-remote-extensions`, old binary-cache directories and obsolete hashes can be deleted when no session or Gateway still uses them. Do not delete the new root: its per-instance venvs retain installed packages. Changing the root redeploys on the next session start.

## `codemode`

| Key | Default | Range / meaning |
| --- | --- | --- |
| `binChunkBytes` | 1048576 | **positive**; requested raw transfer chunk size, bounded by the typed callback and process-window budgets. |

Python entry points: `gateway.<tool_name>(**args)` and `gateway.call(tool_name,args)`. After spawning, finish any independent inline work, then end the turn without sleeping or polling child status. A later automatic native result message starts a new turn in code mode too.
Batch spawn uses `gateway.session_spawn(context="Shared goal and contracts", tasks=[{"task":"Self-contained slice","label":"Slice"}])` and returns `{children:[{index,sessionName,sessionId,taskId}],errors:[{index,error}]}` in task-index order. `errors:[]` means admission, not completion; partial failure retains admitted children and must not cause replay. Results arrive through native messages; the exact operations are in [Gateway transport](../wire/transport.md).
Bridge and prompt-construction details are in [design notes](../design-notes.md).

### Gateway-distributed CLIs (`tool_bin`)

Manage Linux executables in **Settings → 远程工具**: upload name, version, platform (`x86_64` or `aarch64`) and file, optionally with an expected SHA-256; select the current version for rollback.
Name/version shape: 1–128 ASCII letters, digits, `.`, `_`, `+`, `-`, beginning with a letter or digit.
Upload/version mutation: [TGT-4](../contract.md)、[TGT-5](../contract.md)、[模块约定](../wire/artifacts.md#约定).

Storage: `<PRK home>/assets/manifest.json` and `<PRK home>/assets/store/<sha256>` ([模块约定](../wire/artifacts.md#约定)).
Manifest: `{tools:{[name]:{current,versions:{[version]:{platforms:{[platform]:{sha256,size,addedAt}}}}}}`.
Timestamps are ISO strings; sizes and `binChunkBytes` are bytes.
`tool_bin(name)` resolves the selected tool for Linux `x86_64`/`amd64` or `aarch64`/`arm64`; its target cache path is `<targetCacheRoot>/bin/<sha256>/<name>`.
Target transfer and cache validation: [TGT-2](../contract.md)、[TGT-1](../contract.md)、[TGT-3](../contract.md)、[模块约定](../wire/artifacts.md#约定); implementation and deletion-during-transfer limitations: [design notes](../design-notes.md).

Remote Pi native mode requires current `rg` and `fd` executables for the target platform. Upload either through the same generic artifact UI/API; `fd` is not a new artifact kind. Instance environment deployment installs them in `<targetCacheRoot>/bin/<sha256>/<name>`, shared with Python `tool_bin()`. Native startup prepends those directories to the target PATH and sets `PI_OFFLINE=1`. Missing artifacts refuse native startup rather than downloading or executing a Gateway binary.

The old `assets/bin/<name>/linux-<arch>/<name>` layout and `codemode.binDir` configuration are no longer read. For a one-time import, stop the artifact-writing Gateway, remove any obsolete `codemode.binDir` key from `config.toml`, then run from the checkout:

```sh
node scripts/import-tool-artifacts.mjs --home /absolute/prk-home --version imported
```

The importer preflights the whole tree, rejects unsupported entries and existing version/platform pairs, leaves originals untouched, and prints each completed import. An I/O failure can leave earlier imports published; inspect the output/manifest before retrying. Existing tools keep their current version; a new tool starts at `imported`. Verify the list and target `tool_bin` before manually removing any retained legacy files. Import is offline: mutation serialization is per process, not a cross-process lock. The importer uses the default 200 MiB per-file limit.

Built-in wrappers (prelude `src/codemode/kernel-prelude/disk-usage/read_disk_usage.py`): `disk_usage(path='.', depth=1, limit=50, apparent=False)` runs `dust --output-json --output-format b` and returns `{path, bytes, children:[...]}`, largest first; `limit` maps to dust's `--number-of-lines`. The worker prompt lists tools with current manifest assets and the wrappers backed by those tools. To add a wrapper, define it in the prelude and list its CLI in `WRAPPERS` (`src/codemode/binary-delivery/binary-wrappers.ts`).

For managed Python, prepare the official [uv 0.9.17 musl archive](https://github.com/astral-sh/uv/releases/tag/0.9.17) (extract the `uv` executable) and the [PBS 3.12.12 gnu install-only stripped archive](https://github.com/astral-sh/python-build-standalone/releases/tag/20251209) in one directory. Keep the PBS filename unchanged, then run `node scripts/import-python-artifacts.mjs --home /absolute/prk-home --source /absolute/downloads` with Gateway stopped. The pair is SHA-256 pinned, independent of the current version selected for ordinary tools. `scripts/package.sh` includes both assets and refuses to build if either is missing.

## `artifacts`

| Key | Default | Range / meaning |
| --- | --- | --- |
| `maxUploadBytes` | 209715200 (200 MiB) | Positive safe integer; maximum raw bytes per upload, enforced for declared/chunked HTTP bodies and Gateway artifact writes. Independent of `http.bodyBytes`; restart Gateway and API after changing it. |

Uploads use the existing same-origin API, not a standalone service. Temporary staging files may remain after an abrupt process termination; there is no background scavenger or external-source synchronization.

The file tools `grep` (`src/kernel-tools/files/`) and `glob` (`19-glob.py`) use `tool_bin('rg')`; upload rg through Settings → 远程工具 (or the one-time legacy importer) and select a current version for the target platform. They share the manifest/store with other distributed CLIs. Missing rg or an unsupported target fails explicitly; no Python/PATH fallback or download. The files module resolves rg only when grep is called, so its other tools remain available without rg. Signatures and limits come from the kernel catalog independently of the optional CLI-wrapper prompt above. See the [hashline grep contract](../wire/file-tools.md#hashline-grep) and [glob contract](../wire/file-tools.md#glob).

## `targetConnection`

| Key | Default | Range / meaning |
| --- | --- | --- |
| `startTimeoutMs` | 15000 | **timer**; target connection/bootstrap budget. |
| `requestTimeoutMs` | 10000 | **timer**; target file/discovery request deadline; timeout retires the generation. |

The stdlib REPL uses bounded typed stdin/stdout frames. There is no configurable `jupyter` section, server polling, kernel adoption or hostname-probe kernel. Raw output retains bounded head/tail text and an omitted-count marker.

Kernel text projection: [模块约定](../wire/kernel.md#约定)、[REQ-12](../contract.md); deferred-content projection: [模块约定](../wire/tool-content.md#约定).
`details.rawOutput` carries the bounded original when its display differs; [design notes](../design-notes.md) describe compaction and metadata suffixes.

## `trace`

| Key | Default | Range / meaning |
| --- | --- | --- |
| `maxRecords` | 128 | **positive**; maximum kept operation records emitted per user cell. Further records are omitted; the cap resets for the next cell. |
| `argumentChars` | 300 | **positive**; maximum characters of each argument's Python representation. |
| `maxArguments` | 4 | **positive**; maximum arguments retained per operation. |

Trace result field: `kernel_code.details.traces`.
Audit-hook implementation and best-effort observation limits: [design notes](../design-notes.md).

## `kernel`

Per-instance kernel inheritance and saved overrides: [模块约定](../configuration.md#约定).

| Key | Default | Valid value / meaning |
| --- | --- | --- |
| `memoryMax` | `"4G"` | String containing a positive decimal integer with optional uppercase binary `K`, `M`, `G`, `T`, `P`, or `E` suffix; resulting bytes must be a safe integer. No percentages or unlimited value. |
| `memorySwapMax` | `"0"` | Same byte-string syntax, permitting zero. |
| `telemetryIntervalMs` | 1000 | **timer**; kernel thread publishes its own cgroup scope's `memory.current` and working set every interval **while a cell is running**, plus one sample when a cell ends. An idle kernel publishes nothing periodically (only a changed `oom_kill` count), so idle memory in snapshots is the last cell-end sample. |
| `maxOutputChars` | 32768 | Raw text cap in UTF-16 units per cell, preserving head and latest tail. Also caps stdout and stderr separately in each generation's `diagnostics`. |
| `startTimeoutMs` | 10000 | REPL startup/control-operation budget in milliseconds. |
| `interruptTimeoutMs` | 10000 | Global only. Interrupt completion budget, integer 1..2147483647 ms. |
| `closeTimeoutMs` | 3000 | Owned REPL cleanup budget in milliseconds. |
| `executionTimeoutMs` | omitted | Active execution budget in milliseconds (integer 0..2147483647), starting at matching runner admission and paused during `ask`. The instance's top-level value wins, then its `kernel` override, then this value. Omitted or `0` means no hard deadline with foreground yielding enabled and 300000 ms when disabled. |
| `asyncExecution` | `true` | Global only; independent of cell mode. When enabled, foreground waits default to `terminal.yieldMs`. When disabled, waits for the result and has no running reminders. Read at admission. |
| `reminderLadderMs` | `[60000, 300000, 900000, 1800000]` | Global only. Nonempty, strictly increasing active-time checkpoints, integer 1..2147483647. The last value repeats as the interval; time waiting for `ask` does not count. |
| `defaultCellMode` | `"thread"` | Global only. `"thread"`, `"async"` or `"isolated"`; snapshotted at admission and sent to the runner without choosing an execution path. |
| `maxActiveCells` | 4 | Global only. Positive safe integer; fixed at generation startup and passed to the bundled Python runner. Runner and Gateway use the same ceiling, subject to the process window; a lower runner-specific ceiling can apply. |
| `interruptRestart` | `"auto"` | Global only. `"auto"` or `"never"`; reserved for interrupt escalation policy. |
| `maxTimerWaitMs` | 300000 | Global only. Maximum verified pure timer wait eligible for a one-time interrupt grace extension. Integer 0..2147483647 ms; `0` disables the extension. |
| `forkserverPreload` | `[]` | Global only. Ordered array of dotted Python module names; validated but not imported until forkserver support. |
| `cleanupPollMs` | 10 | Owned process-exit observation interval. |
| `progressIntervalMs` | 100 | Minimum progress emission interval. |
| `maxProgressUpdates` | 128 | Progress update count cap per cell. |
| `progressSuffixChars` | 128 | Recent-output suffix retained for progress. |
| `maxImages` | 8 | Image count cap per cell. |
| `maxImageBytes` | 20971520 | Raw image byte budget shared by all active and freezing cells in a generation, including incomplete image chunks. Over-budget images are drained and counted as omitted; freezing a cell frees its raw bytes. `maxImages` remains per cell. |
| `chunkBytes` | 65536 | Typed output chunk budget, bounded by processWindow. |

设置窗「通用 → kernel 异步执行」保存全局 `kernel.asyncExecution`。保存沿用配置快照的冲突检查和原子 TOML 写回，其余配置值不变（注释及排版按既有写回规则重排）。下次 cell 准入采用新值；已提交的 cell 保留原等待策略、提醒与终态，不重载会话或 kernel library。

### Target setup

An instance without an explicit `python` uses its persistent managed Python 3.12 venv, which the instance environment deployment creates (on save, on the first session start that finds it missing, or from the manual deploy action); the Python REPL and model terminal share its Python and PATH. Set an absolute Python 3.9+ executable in the instance editor to keep an existing interpreter instead; PRK does not create or overwrite a managed environment for that instance. No kernel service is required. The Gateway starts the owned REPL through the instance's shared pi-env connection.

Kernel language is [a session setting](../wire/native.md#kernel-language), not an instance override. Bun requires the target's deployed Bun artifact and still uses the configured Python for its short-lived launcher and process cleanup. `bunPackages` controls explicit package preparation; it is not required to run Bun cells.

On Linux, the runner attempts a dedicated systemd user scope with the configured memory/swap limits. This requires cgroup v2 delegation and a functioning user manager/bus. When scope creation is unavailable, execution uses an independent process group, reports `scoped:false`, and does not fabricate cgroup telemetry. PRK does not change system service configuration.

Memory snapshot fields: `memory.current`, `workingSet = max(0,current-memory.stat.inactive_file)`, `baseline`, `extra = current-baseline`, scope path, configured limits and `oomKill`.
Model output example: `[kernel memory 0.2/4.0 GiB]`, optionally followed by ` · OOM 2`.
Telemetry interpretation and clear/restart implementation: [design notes](../design-notes.md); operation boundary: [KER-7](../contract.md)、[模块约定](../wire/kernel.md#约定)、[REQ-13](../contract.md)、[模块约定](../wire/kernel.md#约定).

Tests use `PI_TEST_PYTHON` and owned target fixtures; scope and process cleanup observations apply only to the resources created by each fixture.

## `namespace`

| Key | Default | Range / meaning |
| --- | --- | --- |
| `maxEntries` | 100 | **positive**; maximum entries in each namespace list. |
| `maxChars` | 16000 | Safe integer at least the serialized empty summary size; combined JSON character budget for current variables and cell changes. |
| `docstringChars` | 300 | **positive**; function docstring first-line characters. |

Namespace descriptors contain `name`, `type`, optional function/method signature/docstring and origin when known. Overlapping Python cells expose only a shared snapshot, not cell-attributed changes.
Lists expose current variables, added/modified/deleted names and `truncated`.
`kernelVariables {sessionId}` returns `{variables,truncated}`; `kernelDeleteVariable {sessionId,name}` returns `KernelSnapshot`.
Namespace and idle-operation boundaries: [模块约定](../wire/kernel.md#约定), [KER-7](../contract.md)、[模块约定](../wire/kernel.md#约定)、[REQ-13](../contract.md)、[模块约定](../wire/kernel.md#约定).
Reassignment detection, shared budgets and compaction behavior: [design notes](../design-notes.md).
