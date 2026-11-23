## `extensions`

PRK worker policy lives in `config.toml`; Pi resource settings live in `<home>/agent/settings.json` and project `.prk/settings.json`.
`deny` and optional `allow` each contain `packages` and `tools` string arrays; omitted arrays are empty.
Defaults: `deny: {packages: [], tools: []}` and `allow` omitted. Legacy location maps and instance/default remote-installation lists are rejected.
Validation and filtering: [模块约定](../configuration.md#约定).

```toml
[extensions.deny]
packages = ["pi-web-access"]
tools = ["web_search"]

[extensions.allow]
packages = ["pi-web-access", "@sting8k/pi-vcc"]
tools = ["web_search", "vcc_recall"]
```

- Package selectors use an npm package name with optional `npm:` prefix, ignoring the source's npm version suffix; other sources use exact source strings.
- Tool selectors use exact extension tool names.
- Worker package/tool filtering does not control Gateway provider ownership; see [provider plugin loading and ownership](#provider-plugin-loading-and-ownership).
- The worker prompt lists the public SDK's callable tool names with one sentence from each existing description on every model request; `gateway.describe()` provides schemas.
- Plugin-owned activation remains visible in that callable set; for example, a plugin with dynamic activation may initially expose only its enable tool.

Configuration changes: [模块约定](../wire/targets.md#约定)、[模块约定](../configuration.md#约定).

### Provider plugin loading and ownership

Add a provider plugin to the existing `packages` array in `<home>/agent/settings.json`, preserving your other entries. For example:

```json
{
  "packages": [{ "source": "npm:@router-for-me/pi-cliproxyapi-provider", "enabled": true, "location": "gateway" }]
}
```

The same entry supplies Gateway provider initialization and the package's normal session capabilities. No `extensions.providers` field or duplicate provider list is used. Provider-owned settings, such as `cliproxyapi.json`, remain in `<home>/agent/`.

Gateway loads enabled Gateway packages once for the shared model runtime. A package is recognized as a provider owner when it actually calls `registerProvider`, not by name or metadata. Worker `deny` / `allow` filters remain session policy; they do not remove a Gateway-owned provider.

Ownership rules:

- Every provider ID declared in `<home>/agent/models.json` is reserved for that handwritten configuration. A plugin registration for it fails with a structured extension error and a Gateway log entry; it neither overrides nor merges the provider.
- For other IDs, the first registering package in `packages` load order owns the ID. A later package's conflicting registration fails with a structured extension error and a log entry rather than replacing the owner.
- The owner's Gateway instance may subsequently register or unregister its own IDs, including background model-catalog updates. Another package cannot mutate those IDs.
- In session, global-catalog and discovery instances, registration or unregistration of any already-owned ID is a no-op with a debug log. An unowned ID produces a structured extension error and a Gateway log entry. These policies leave the package's other tool, hook and command registrations intact, and do not prevent it from using existing models.

For packages that do not register a provider during bootstrap, Gateway discards the SDK-managed tool, hook, command and event-bus registrations and their SDK lifecycle. This is not a sandbox or rollback of arbitrary JavaScript: plugin-created timers, module state and file effects are outside that cleanup boundary. The Gateway bootstrap instance does not serve session tools or commands; normal session instances own those capabilities.

Provider package changes save successfully and return `restartRequired:true`; restart Gateway to apply them. Until then, model selection and existing sessions retain actual bootstrap ownership. Ordinary package CRUD never rebuilds or unregisters the shared ModelRuntime. Changes to provider configuration or `models.json` also require restart. Package discovery alone does not establish whether every synchronous SDK/TUI capability can cross the host boundary.


### Native package list and unique location

`<home>/agent/settings.json` contains the only installed plugin list. Each native package record preserves Pi resource filters and adds explicit `enabled:boolean` and `location:"gateway"|"host"`. New installation and one-time migration default to Gateway; source is an npm package identity or an absolute local directory. Local directories stay linked and are never deleted by uninstall.

```json
{"packages":[{"source":"/absolute/plugin-directory","enabled":true,"location":"gateway"}]}
```

Use the single Plugins settings page or the [plugin API](../wire/plugin-config.md): list, install, enable/disable, change location, and confirmed uninstall. Native SDK source identity rejects duplicate npm versions before install side effects. No instance-specific list, priority array, textual location classifier, upload route, or compatibility alias remains.

`host` means the session's independent process, including local instances. Saving that location does not require an instance to exist yet. Known provider owners are Gateway-only and return structured `PROVIDER_POLICY` rather than silently changing location.

### 约定

- Gateway and local hosts load the original directory. A remote host builds the current directory at startup/reload, reuses the content-addressed artifact when unchanged, and uses new content on the next generation. A failed package is unavailable with its own error; it never falls back to an older artifact or prevents another package loading.
- The independent native-host artifact owns the installed SDK/runtime. Plugin artifacts contain only plugin code and its locked dependencies; targets install no npm packages. SDK peer imports resolve to the host's public SDK entry points.
- Native package order is preserved. Saves apply at create/wake/explicit reload; existing SDK history and Python kernel survive reload, while the host stream changes. The existing reload notice reports saved configuration changes, not file watching.
- Commands execute their original handler on the selected side and use the existing UI transport. Public synchronous capabilities such as `tool.prepareArguments` cannot be implemented through asynchronous host RPC: reject only that package with `UNSUPPORTED` and `details.member`, preserve its reason in the list/UI, and never bypass schema validation or load it on both sides. Such host acceptance cells are N/A only when structured rejection, other-package isolation, and Gateway functionality are proven.
- `scripts/migrate-plugin-packages.mjs --home /absolute/owned-copy --source-home /absolute/original-home` performs explicit offline migration, with backups and private settings. Old artifact-only entries require `--sources /absolute/source-map.json` mapping bundle IDs to proven native sources; name/version never implies a registry upload. Ordinary startup reads only the new schema.

The shared-channel, native-tool, and hosted UI boundaries remain in [the wire contract](../contract.md).

## `remoteHost`

Global settings for the one target-side host shared by a session's target plugins and enabled Pi native tools. The runtime defaults to Bun; Node remains an explicit alternative. These do not change the Python kernel's limits or isolate plugins loaded locally in the Gateway.

| Key | Default | Range / meaning |
| --- | --- | --- |
| `runtime` | `"bun"` | `"bun"` or `"node"`, shared by the session host and short-lived project resource resolver. Bun is resolved from the artifact manifest's `tools.bun` for target Linux x86_64/aarch64; Node uses the bundle's immutable Gateway-version Node artifact. No system-runtime lookup or automatic fallback. |
| `memoryMax` | 1073741824 (1 GiB) | **positive**, bytes; the host scope's `MemoryMax`, shared by the runtime and all descendants, including native bash and LSP processes. Unlike `kernel.memoryMax`, this is an integer, not a unit-suffixed string. |
| `memorySwapMax` | 0 | Nonnegative safe integer, bytes; the scope's `MemorySwapMax`. Zero disables swap for the scope. |
| `abortTimeoutMs` | 5000 | **timer**; after abort, the maximum wait for the remote host's acknowledgement before the session's host is replaced. This is not an execution or hook duration limit. |
| `nodeArgs` | `["--optimize-for-size"]` | String array, passed as individual Node/V8 arguments before `host.mjs`, without shell parsing. `[]` disables all configured arguments. Elements must not contain NUL; Node rejects unsupported flags during host startup, with no fallback ([TGT-30](../contract.md)). |
| `bunArgs` | `["--smol"]` | String array, used only with `runtime:"bun"`, before `host.mjs`. Same argv, empty-array and NUL rules as `nodeArgs`; unsupported flags fail startup without fallback. |

For example, in `config.toml`:

```toml
[remoteHost]
runtime = "bun"
memoryMax = 1073741824
memorySwapMax = 0
abortTimeoutMs = 5000
bunArgs = ["--smol"]
nodeArgs = ["--optimize-for-size"]
```

Omitted keys take their defaults; unknown keys and invalid field types/ranges are rejected. Numeric fields reject strings and fractional values; both argument fields require string arrays, including the valid empty array. The Gateway reads this group at startup; existing hosts retain their launched values until replaced. Restart the Gateway after file edits. To run Node-dependent target plugins, select `runtime = "node"`; PRK does not rewrite plugins for Bun compatibility.

Bun must first be imported through the existing remote-tool artifact management into `tools.bun`, with separate `x86_64`/`aarch64` platform entries. It follows the same SHA-256 chunk transfer and target cache as rg/fd; absent artifacts fail explicitly. Tests import the local Bun executable into isolated stores, never the production store. `--smol` was selected by the tools-only marginal scope working-set comparison recorded in the PRK-HOSTSLIM task report; it does not enable transport compression or target-runtime discovery.

When Linux cgroup v2 with the delegated memory controller and a systemd user manager/bus are available, each host starts through [`systemd-run --user --scope`](https://www.freedesktop.org/software/systemd/man/latest/systemd-run.html) in its own `prk-remote-host-<uuid>.scope`, separate from the kernel scope, verifying the exact scope name, `memory.max`, `memory.swap.max`, and readable memory accounting files (use page-aligned byte limits). When user-level systemd/cgroup prerequisites are unavailable (e.g. containers, virtual-desktop sessions, or `su -` sessions), the target logs a timestamped fallback notice and starts the host in its own POSIX process group (`start_new_session=True` plus Linux `PR_SET_PDEATHSIG`), reporting `scoped:false` with `memory` omitted; cleanup sends `SIGTERM` then `SIGKILL` to the process group, with the physical boundary that grandchildren calling `setsid()` on their own cannot be tracked without cgroups.

Scope execution inherits the target channel's environment and mount/network namespaces; it is not a service started in the user manager's namespace. Both runtimes use public `net.connect({path})` to a one-shot Unix listener. `tempfile.mkdtemp(prefix="prk-",dir=$XDG_RUNTIME_DIR or /tmp)` supplies the temporary directory; no permission/owner checks or residual scans are added. The short `prk-<random>/s` path must fit Linux AF_UNIX's 107-byte limit. After one accept, the channel unlinks the socket and closes the listener; host exit or startup failure removes the directory. Stdin remains `/dev/null`; the existing five-second deadline covers connection and scope/PID handshake. No inherited-fd path remains. Standard output/error are host logs. `OOMPolicy=continue` does not stop a surviving host after child OOM; `MemoryMax`/`MemorySwapMax` remain hard limits. A host killed under pressure fails without replay or kernel replacement.

Closing/reloading a session, host process or IPC exit, and load failure stop the whole owned scope, including descendants that called `setsid`. Scope stop sends TERM to the control group and escalates to KILL after one second. Cleanup checks that the scope's `cgroup.events` reports no populated descendants or that its cgroup has disappeared; an unconfirmed cleanup is logged and returned as an error, not reported as success. The shared target-channel lease and other sessions' scopes are not closed by a host stop ([LIFE-21](../contract.md)).

The host reads its own cgroup-v2 memory counters and reports the same `KernelMemory` shape as the kernel, including `workingSet=max(0,memory.current-inactive_file)` and `oomKill=memory.events.oom_kill`. It samples at root `kernel.telemetryIntervalMs` (default 1000 ms), including while idle, plus initial/final samples; no new host sampling setting exists. This is independent of the machine monitor switch because it uses the already-running host and target channel. Public fields and terminal-sample limits are in [the monitor wire contract](../wire/kernel.md#monitor).
