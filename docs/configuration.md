# Independent PRK configuration

Commands (`gateway`, `attach`, `web`) accept `--home DIR`.
Home selection and SDK bootstrap: [模块约定](configuration.md#约定).
The XDG path follows the [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir/latest/).

The home contains `config.toml`, `instances.toml` and `agent/`; `instances.toml` holds complete instance definitions, including the user's connection command, while `agent/` holds SDK credentials, model definitions, provider packages/resources and provider-owned configuration such as `cliproxyapi.json`.
Directory and history boundaries: [模块约定](configuration.md#约定).
The embedded SDK uses `.prk/` project resources (`scripts/patch-pi.mjs`, postinstall) and `PRK_CODING_AGENT_DIR`; bootstrap also sets `PI_CODING_AGENT_DIR` for owned stock-Pi child processes.
Packages and Pi session settings live only in `agent/settings.json`. Gateway startup logs a warning when it is missing, since every session then starts without packages; an OMP command run with `PI_CODING_AGENT_DIR` pointing at `agent/` migrates that file to OMP's `config.yml`, which PRK does not read.
Remote project resources use the same exported `CONFIG_DIR_NAME` (`.prk`, not a second `.pi` path) on the target. Context filename/ancestor rules and transfer rationale are recorded in [design notes](design-notes.md#会话-cwd-资源). Existing `session.noContextFiles`, `noPromptTemplates`, `noSkills` and `noExtensions` switches remain effective; resource discovery changes their machine, not their configured policy.

`PRK_ALLOWED_HOSTS` adds comma-separated hostnames (trimmed, empty entries ignored) to both Vite dev and preview host allowlists; unset or empty preserves Vite defaults.
For HTTPS reverse proxies, set e.g. `PRK_ALLOWED_HOSTS=prk.example.com` on the Vite process.

## Models and provider plugins

Models come from Pi's built-in providers, `<home>/agent/models.json`, and provider plugins identified during Gateway startup. Provider plugins use the existing `packages` array in `<home>/agent/settings.json`, alongside ordinary plugins; there is no separate provider package list. Gateway loads those packages once to build the shared model runtime and identifies each provider's owner from the package that calls `registerProvider`. See [provider plugin loading and ownership](configuration/extensions.md#provider-plugin-loading-and-ownership).

Provider IDs declared in `models.json` take precedence: a plugin attempting to register the same ID receives a structured extension error and a Gateway log entry, without replacing or merging the handwritten provider. For IDs not declared in `models.json`, the first package to register the ID owns it; conflicts are resolved in `packages` load order. The owner's Gateway instance may later update or unregister its own provider, for example after refreshing its model catalog.

Session, global-catalog and discovery instances cannot mutate the shared providers. Their registration or unregistration of an already-owned ID is a no-op with a debug log; an unowned ID produces a structured extension error and a Gateway log entry. The plugin's other tool, hook and command registrations remain available.

Restart the Gateway after editing provider packages, provider configuration or `models.json` to rebuild the shared catalog and ownership. Reloading one session does not rebuild Gateway provider ownership.

### Without a provider plugin: `models.json`

Use Pi's built-in providers with credentials in `<home>/agent/auth.json` or their supported environment variables when they already meet your needs. For a compatible proxy, define models directly in `<home>/agent/models.json`; no provider plugin is required. This mixed `clp` example uses OpenAI Responses for GPT and overrides both `api` and `baseUrl` for Claude:

```json
{
  "$schema": "https://pi.dev/schemas/models.schema.json",
  "providers": {
    "clp": {
      "baseUrl": "https://proxy.example.com/v1",
      "api": "openai-responses",
      "apiKey": "REPLACE_WITH_CLP_API_KEY",
      "models": [
        {
          "id": "gpt-6.1-sol"
        },
        {
          "id": "claude-sonnet-5-5",
          "api": "anthropic-messages",
          "baseUrl": "https://proxy.example.com"
        }
      ]
    }
  }
}
```

Replace the model IDs and URLs with those served by your proxy. GPT inherits the provider's `openai-responses` API and `/v1` base URL; Claude uses `anthropic-messages` and its model-level base URL. `api` and `baseUrl` overrides belong inside a `models` entry, not `modelOverrides`, which changes metadata on existing models.

This is the Pi 1.6.0 schema: only `id` is required in each model entry. Omitted `reasoning` defaults to `false`, `input` to `["text"]`, `contextWindow` to `128000`, and `maxTokens` to `16384`; set them to the endpoint's actual capabilities and limits. `apiKey` may instead use `"$CLP_API_KEY"` environment interpolation. See Pi's [models configuration reference](https://github.com/earendil-works/pi/blob/v1.6.0/packages/coding-agent/docs/models-configuration.md) for the complete schema.

Keep the handwritten `clp` provider or give a provider plugin a different ID, such as `clp-plugin`; a plugin cannot augment or replace that handwritten `clp` entry.

### Per-provider outbound proxy

A `models.json` provider may set `proxy`, a PRK key that Pi's schema ignores. It is either an `http://` or `https://` proxy URL, optionally with `user:password@` (percent-encode reserved characters), or `false` to force a direct connection even when the process has an environment proxy:

```json
{
  "providers": {
    "intranet": {
      "baseUrl": "https://llm.example.internal/v1",
      "api": "openai-completions",
      "apiKey": "$INTRANET_API_KEY",
      "proxy": false,
      "models": [{ "id": "qwen-max" }]
    },
    "clp": {
      "baseUrl": "https://proxy.example.com/v1",
      "api": "openai-responses",
      "apiKey": "$CLP_API_KEY",
      "proxy": "http://user:pass@proxy.example.internal:3128",
      "models": [{ "id": "gpt-6.1-sol" }]
    }
  }
}
```

Providers without `proxy` keep the process default: direct, or the environment proxy under `NODE_USE_ENV_PROXY=1`. When only one proxy for everything is needed, skip `proxy` and set `NODE_USE_ENV_PROXY=1`, `HTTPS_PROXY` and `NO_PROXY` in `prk.env`; see [INSTALL.md](../INSTALL.md#1-前置检查). An https:// endpoint is reached through a `CONNECT` tunnel and an http:// endpoint through ordinary proxy forwarding. `NODE_EXTRA_CA_CERTS` applies to both the proxy and the endpoint.

Gateway validates `proxy` once when it reads `models.json` and refuses to start on:

- any other value, such as `true`, a bare `host:port` or a `socks5://` URL; the error does not echo the value;
- a Pi built-in provider ID such as `openai`, `anthropic` or `google`, or a provider with `"oauth": "radius"`: Pi streams those models with its built-in implementation, which the proxy cannot reach. Use your own ID, as with `clp` above;
- a model API other than `openai-completions`, `openai-responses`, `azure-openai-responses`, `anthropic-messages`, `google-generative-ai`, `mistral-conversations` or `pi-messages`: Bedrock, Vertex and Codex send some requests outside the replaceable fetch.

At startup Gateway logs one line per provider with `proxy`, without credentials: `[provider-proxy] clp: http://proxy.example.internal:3128` or `[provider-proxy] intranet: direct`. Like the rest of `models.json`, a change takes effect after a Gateway restart. Plugin-registered providers are not covered.

## `config.toml`: global settings

`config.toml` groups: `derivation`, `session`, `codemode`, `trace`, `kernel`, `namespace`, `gateway`, `http`, `limits`, `tools`, `skills`, `learning`, `memory`, `extensions`, `remoteHost`, `workspace`, `terminal`, `monitor`, `metrics`, `artifacts`, `toolContent`, `kernelTools`, `processWindow`, `references`, `targetConnection`. Instance fields, including a root `instances` key, are rejected as unknown fields; normal startup reads only the current format.
Top-level `targetCacheRoot` selects the [target cache root](configuration/execution.md#targetcacheroot-top-level). Top-level `pythonIndexUrl` supplies the default [PyPI mirror for instances](configuration/instances.md); omit both global and instance mirrors to keep uv offline.
Loading/defaults: [模块约定](configuration.md#约定); numeric validation: [模块约定](configuration.md#约定).
Instance/config persistence: [模块约定](configuration.md#约定); reload boundaries: [模块约定](wire/targets.md#约定)、[模块约定](configuration.md#约定).
Complete instance definitions are plaintext in the server-side `instances.toml` file, written atomically with mode `0600`. The editable SSH command is returned by the instance API; `config.toml` and session directories follow the process umask.

Only TOML is read for PRK configuration. If either legacy `config.json` or `instances.json` remains in the selected home, Gateway startup fails with migration instructions, even when TOML files also exist. SDK/provider configuration, project `.prk/settings.json`, and PRK-generated state such as `session-control.json`, library indexes and `assets/manifest.json` remain JSON.

Settings saves regenerate TOML with `smol-toml` and a first-line comment stating that PRK settings wrote the file and comments are not preserved. They preserve unrelated values and omitted defaults, not handwritten formatting or comments. Each server-side read/modify/write remembers the source-content hash and compares it with disk immediately before atomic replacement; a mismatch returns `CONFLICT` without publishing the candidate. This is not a client-supplied version or an atomic filesystem compare-and-swap.

TOML has no `null`: omit an optional key to use its existing default. `kernelTools` overrides reject every nested `null`, including array elements, at the configuration boundary. The capability API still accepts `enabled:null` to remove an override; it removes the persisted key rather than storing a null value.

### Session control roles

`<PRK home>/session-control.json` stores `{rootSessionId:string|null,supervisors:Record<projectId,sessionId>}` with native SDK identities and atomic replacement. It is Gateway-owned role metadata, not an additional session registry; membership, ownership and creation time remain in SDK history. No new `config.toml` option is introduced.

Use the [session control API](wire/sessions.md#session-control-roles) to designate roles. Root is unique and local-only; projects elect their first session, retain manual supervisor choices and select the earliest surviving member when the supervisor leaves. Archiving root clears the designation; unarchive does not restore it. The external IM gateway calls the same setter; PRK contains no IM integration.

## Numeric range notation

- **positive**: safe integer 1..9007199254740991.
- **timer**: integer 1..2147483647 milliseconds (Node timer ceiling).
- **port**: integer 0..65535; zero requests an ephemeral listener.
Field-specific bounds and units appear in the tables below; validation is defined by [模块约定](configuration.md#约定).


## `instances.toml`: instances (default `instances = []`)

Each `[[instances]]` has a stable `id`, a globally unique display `label`, an absolute target `cwd`, and `local = true` for a Gateway-owned local pi-env daemon or `local = false` with an `sshCommand` for a remote shell. Omit `python` to use a managed per-instance venv; an explicit absolute executable (Python 3.9 or newer) is verified on the target and used unchanged. There is no session-level Python override. Existing session `target` values still identify the same instance. The old instance key `name` is rejected; `scripts/prk.sh install --gateway-stopped` migrates it offline.

```toml
[[instances]]
id = "default"
label = "Local"
local = true
cwd = "/home/user/project"
python = "/home/user/.venv/bin/python"

[[instances]]
id = "office"
label = "Office"
local = false
cwd = "/home/user/project"
sshCommand = "ssh -T user@office"
python = "/home/user/.venv/bin/python"
```

Remote `sshCommand` is executed verbatim by the Gateway host's `/bin/sh -c`; PRK does not append SSH parameters or a remote command. It must finish at a POSIX-compatible non-interactive shell reading stdin. Interactive passwords, OTP, MFA menus and manual takeover are unsupported. A local instance cannot specify `sshCommand`.

`python` may be absent, as may `sshCommand` on a remote instance. Such instances are saved as needing configuration without connecting; their existing history and sleeping or archived settings remain readable without starting a target or model. An execution request is rejected with `submitted:false` and a structured configuration issue until the missing fields are supplied. An instance's `kernel` options still control kernel budgets and telemetry; capabilities, custom metrics and remote extensions retain their existing settings.

Pi's seven native tools and target plugins run in an independent target host for both local and remote instances. Plugins explicitly placed at `location:local` and provider ownership remain on the Gateway. If a target connection or Gateway fails, old execution handles and namespaces are invalid; observation does not reconnect in the background or replay unconfirmed work.

## Global setting groups in `config.toml`

## `derivation`

Configure child-session defaults and named roles in `config.toml` under `[derivation]`; the [complete field table](configuration/session.md#derivation) includes global tool mode, worktree isolation, maximum depth and instructions, plus per-role models/thinking and capability overrides. Global `derivation.defaultModel` / `defaultThinkingLevel` are rejected; model/thinking choices belong to roles.

`GET /api/derivation` returns `{derivation,defaults}`, including merged `derivation.roles` and the built-in baseline in `defaults.roles`. `POST /api/derivation` accepts exactly `{derivation:DerivationConfig}` and replaces the whole group, not a partial merge; omission removes a prior setting or custom role, while built-in `task` and `small` return to their defaults. Validation precedes all writes, unrelated `config.toml` fields remain intact, and successful saves affect the next spawn without restarting existing sessions. See the [Wire/HTTP contract](wire/native.md#derived-session-settings).

Unconfigured defaults are the host's `session.workerTools`, `defaultIsolated:false`, `maxDepth:3`, `defaultInstructions:"Your parent already planned the overall work; you own only this piece. Do it directly unless your role or assignment explicitly calls for further sessions."`, and the built-in [task/small roles](configuration/session.md#derivation). The API's separate `defaults` object always reports fallback values rather than copying configured overrides. Omitted spawn `role` selects `task`; when its model/thinking are unset, they inherit the creator's current values.

Isolation creates a detached git worktree on the execution target, not a repository copy on the Gateway. A child result with changes includes a patch artifact and `{path,bytes,stats}` metadata; parent application of that patch is explicit. Patches are capped at 16 MiB and diff stats at 64 KiB. Remote targets must permit writing the same absolute artifact path as the Gateway; the [worktree and patch lifecycle](wire/native.md#worktree-isolation-and-patch-results) includes transfer, parent-checkout guard and cleanup requirements.

## `extensions`

See [`extensions` configuration](configuration/extensions.md#extensions).

### Package location and per-instance installation

See [Package location and per-instance installation configuration](configuration/extensions.md#package-location-and-per-instance-installation).

## `remoteHost`

See [`remoteHost` configuration](configuration/extensions.md#remotehost).

## `session`

`session.delegation` defaults to `"eager"`; accepted levels are `"gated"`, `"restrained"`, and `"eager"`. See [`session` configuration](configuration/session.md#session) for policy and session-local actions.
`session.defaultDerivedLifecycle` defaults to `"temporary"` and accepts only `"temporary"` or `"persistent"`; [lifecycle semantics](wire/sessions.md#session-tools-and-inbox-delivery) also apply to saved derivation metadata. `"user"` is reserved for an explicit user upgrade, not a spawn or configuration default.
启用开关采用注册／声明／权限三层：所有工具与技能候选在会话创建时保留注册，关闭项在下一请求隐藏声明并立即拒绝调用。`tool:*`、`kernel:*`、`skill:*` 与分组沿用原三层存储；会话优先实例、实例优先全局，同层单项优先分组。`kernel_code` 在 code 档仍锁定。开关和 lazy 都不置 `requiresReload`（插件[加载开关](#plugin-load-switches)除外）；该字段仅报告插件／技能资源注册变化。切原生工具不重载 SDK 或 kernel，变量保留；远程无插件宿主按首次原生调用启动。


### Tool declaration lazy loading

The existing capability maps also store declaration-only lazy switches: global `config.toml` `session.capabilities`, instance `instances.toml` `instances[].capabilities`, and session `gateway-native-session-state` overrides.

- `lazy:tool:<SDK name>` controls one tool. The saved-tool built-in group uses `lazy:group:tools:library`; plugin groups use `lazy:group:tools:package:<package-or-path>`, `lazy:group:tools:mcp:<server>`, or `lazy:group:tools:remote:<instance>:<package>`.
- Resolve session before instance before global; within the same layer, the tool value wins over its group value. Removing an override (`enabled:null` in the batch API) restores inheritance.
- Only the saved-tool group defaults to lazy; all plugin groups default to resident. Defaults are group-based, with no per-tool name exceptions. The remaining built-in groups are `group:tools:local`, `group:tools:kernel`, and `group:tools:library`; native/kernel-function groups have no group-lazy switch, and model-only tools remain ineligible.
- Pi's seven native tools have no lazy setting. `tool_search` and `tool_call` are excluded from capability catalogs. Model-only tools cannot be called through `executeTool`, so their lazy setting is unavailable; disabled tools also report unavailable while retaining their configured lazy value.
- Lazy writes refresh the existing loadout for the next model request, without reload or changes to the original tools' permissions/active state. In direct mode hidden tools remain discoverable through `tool_search` and callable through `tool_call`; those two meta tools are active/declared only while hidden tools exist. Code mode keeps its existing declaration policy. Lazy keys never act as enable/exclusion keys or set `requiresReload`.
- Capability writes use `{changes:[{id,enabled:boolean|null},...]}` (plus `instance` when selected). A batch may atomically enable a tool and choose its lazy policy; validation uses the whole proposed state. One invalid entry rejects every change before persistence. The old single-value write form is not accepted.

For pre-release configurations that still contain `delay:` capability keys, back up PRK home and review an offline copy before starting the Gateway. Rename the old prefix to `lazy:` where the policy is still supported; resolve any conflicting old/new values first. Replace retired group policies with the currently supported group or per-tool settings described above. Existing `lazy:tool:ask` overrides remain valid; without one, `<inline:ask>` is resident by default.

For example, the following global TOML makes that plugin's tools lazy except `lookup` at the same layer. Quote capability IDs so punctuation remains part of each exact key. Lazy status and inherited defaults are returned by the [catalog/settings API](wire/native.md#capability-catalog); no frontend switch is added in this change.

```toml
[session.capabilities]
"lazy:group:tools:package:@example/tools" = true
"lazy:tool:lookup" = false
```

All nine built-in factories live under `src/plugins/` and use public Pi extension registration; individual `tool:<name>` IDs remain unchanged:

| Factory / plugin identity | Registered API | Prompt section |
| --- | --- | --- |
| `sessions/` · `<inline:sessions>` | `space_status`, `session_spawn`, `session_send`, `session_result`, `session_list`, `session_manage` | `<sessions>` |
| `ask/` · `<inline:ask>` | `ask` | `<ask>` |
| `skill-tools/` · `<inline:skill-tools>` | `skill_manage`, `skill_read` | `<skill_tools>` |
| `memory/` · `<inline:memory>` | `memory` | `<memory>` |
| `plugin-config/` · `<inline:plugin-config>` | `plugin_config` | — |
| `terminals/` · `<inline:terminals>` | `terminal_list`, `terminal_textsend`, `terminal_keysend`, `terminal_read`, `terminal_set`, `terminal_close` | — |
| `kernel/` · `<inline:kernel>` | `kernel_code` | `<kernel>`, `<gateway_calls>` |
| `tool-library/` · `<inline:tool-library>` | Internal `prk_library_save`, `prk_library_access`, `prk_library_used`, `prk_library_available`; dynamic `prk_saved_*` | — |
| `tool-search/` · `<inline:tool-search>` | Meta tools `tool_search`, `tool_call` | `<tool_catalog>` |

The first seven factories expose ordinary groups `group:tools:package:<inline:NAME>`. Disable one to hide its tools and prompt sections and reject calls; group-lazy policy affects only callable members. `kernel_code` remains model-only and locked in code mode, so it keeps `<kernel>` and `<gateway_calls>`; there the kernel group switch only hides `kernel_read`, `kernel_interrupt` and `kernel_language`. Terminal configuration belongs to `<inline:terminals>`.

The B1 tool-library API is preserved: no `tool_save` or `tool_remove` API is introduced. The four internal `prk_library_*` callbacks are filtered from ordinary capability catalogs; saved `prk_saved_*` entries remain independently controlled by `group:tools:library`. Thus `<inline:tool-library>` has no ordinary management members or catalog group row, and its stored global lazy policy currently changes no ordinary declaration. Meta tools likewise have no ordinary catalog rows or group switches; `<tool_catalog>` continues to follow the existing hidden-tool discovery policy.

To retain the former resident/lazy split, put the following global values in `<PRK home>/config.toml` (merge them into any existing `[session.capabilities]` table):

```toml
[session.capabilities]
"lazy:tool:session_list" = true
"lazy:tool:session_manage" = true
"lazy:tool:space_status" = true
"lazy:group:tools:package:<inline:skill-tools>" = true
"lazy:group:tools:package:<inline:memory>" = true
"lazy:group:tools:package:<inline:plugin-config>" = true
"lazy:group:tools:package:<inline:terminals>" = true
"lazy:group:tools:package:<inline:tool-library>" = true
```

These are ordinary global lazy switches, not code defaults: an instance/session group-lazy override takes precedence over them, and a same-layer tool override takes precedence over its group.

The retired `group:tools:prk` / `lazy:group:tools:prk` keys are rejected by current configuration validation. The offline migration expands their values independently in each global, instance and session map, then removes both retired keys. Enable policy maps to `sessions`, `ask`, `skill-tools`, `memory`, `plugin-config`, `terminals`, and `kernel`; lazy policy maps to the same six business groups without model-only `kernel`. Each destination is `group:tools:package:<inline:NAME>` (with `lazy:` for lazy policy), and an explicit destination key in that same layer wins. Individual tool keys and the saved `group:tools:library` group remain independent. No policy is invented for meta-only `tool-search` or internal library callbacks. Session maps remain deltas in `gateway-native-session-state` custom entries inside `<PRK home>/<session.historyDir>/**/*.jsonl` (`session.historyDir` defaults to `sessions`); all historical entries are migrated. The earlier sessions-only `migrate-switches.mjs` is superseded by this complete offline mapping.


### Plugin load switches

`load:package:<source>` decides whether a session loads a plugin package at all. `<source>` is the exact `source` of the entry in `agent/settings.json` `packages` (an npm spec or an absolute directory). It lives in the same three capability maps as the tool switches (global `session.capabilities`, instance `instances[].capabilities`, session `gateway-native-session-state`) and resolves session before instance before global; absent means loaded, so only `false` needs writing.

```toml
[session.capabilities]
"load:package:/opt/plugins/memory" = false   # new sessions skip it unless a layer below says true
```

A role's `capabilities` map takes the same key. A derived session starts with the role's map as its own layer (`spawn-derived-session`), so the role sits between the instance and later edits of that session; resetting a key in the session (`null`) falls back to the instance and global values, not to the role.

- This is separate from the tool switches. A tool switch (`group:tools:package:*`, `tool:*`) leaves the package loaded: its hooks (`pi.on`), commands and skills still run and only its tools are hidden and refused. A load switch set to `false` removes the package from the settings the session's Pi resource loader resolves (the same package filter `createSessionSettings` applies to `enabled`), so none of its extension modules are imported for that session and no tool, hook, command, skill, prompt or theme of it is registered. Packages placed on the session host (`location:"host"`) are left out of that session's host `packages` list, so the host never loads them either.
- The switch applies when the session loads its extensions: on creation, wake and reload. Changing it reports `requiresReload` with `loadSwitches:{loaded,current}` in the reload diagnostics, unlike the tool and lazy switches.
- The global capability catalog (`capabilitiesList`, `capabilitiesRefresh`, instance discovery) still loads every enabled package so the settings pages list all tools; its `groups[].package` names the package of each group and `catalog.packages[]` carries `{source,name,location,providerIds,load:{id,enabled,defaultEnabled,overridden}}` at the layer asked for (see the [catalog](wire/native.md#capability-catalog)).
- A package that owns a Gateway provider cannot be unloaded by any load switch (global, instance, role or session): providers are registered once for the whole Gateway at bootstrap, so the write is refused with `PROVIDER_POLICY` naming the provider ids, and a session whose stored layers already hold such a value fails to load with the same error instead of ignoring it. Stop such a package with its `enabled` switch in plugin settings (applies after a Gateway restart). A package that is not installed, or is disabled there, is refused with `NOT_FOUND`; `null` always resets.
- Isolation, remote host and module-state findings are in the [design notes](design-notes/extensions.md#插件按会话加载的隔离边界).

## `codemode`

See [`codemode` configuration](configuration/execution.md#codemode).

### Gateway-distributed CLIs (`tool_bin`)

See [Gateway-distributed CLIs (`tool_bin`) configuration](configuration/execution.md#gateway-distributed-clis-tool_bin).

## `artifacts`

See [`artifacts` configuration](configuration/execution.md#artifacts).


## `trace`

See [`trace` configuration](configuration/execution.md#trace).

## `kernel`

全局 `config.toml` 的 `[kernel]` 中，`defaultCellMode` 默认为 `"thread"`，也可设 `"async"` 或 `"isolated"`。Gateway 在 cell 准入时快照此值；运行配置更新只影响后续准入。`asyncExecution` 独立控制前台等待是否可以 yield（默认 `true`），不是运行模式的别名；不接受旧执行模式布尔字段。

同属全局策略的还有 `maxActiveCells = 4`、`interruptTimeoutMs = 10000`（中断宽限，单位毫秒）、`interruptRestart = "auto"`（也可设 `"never"`，不能设 `"now"`）、`maxTimerWaitMs = 300000`（定时等待延长上限，`0` 禁用）和 `forkserverPreload = []`（按顺序排列的 Python 模块名，允许点分隔）。`instances.toml` 的实例 `kernel` 及实例新增／编辑入口均不接受这些字段，也不能覆写 `asyncExecution` 或 `reminderLadderMs`。
Gateway 在首次定向停止时从自己的单调钟计 `interruptTimeoutMs`；配置修改和重复停止均不重计。`interruptRestart = "auto"` 会在超期且仍无终帧时退休同代；`"never"` 不自动退休，所停 cell 仍占位。模型可用 `restart:"now"` 显式退休整代。

捆绑 Python runner 按建代时的 `maxActiveCells` 开放同代执行位，thread cell 可并行工作。显式 `mode` 优先；未传时，整段模块编译为协程则选 `async`，其余取全局默认值。选中 `isolated` 时使用本代 forkserver；可选 `inputs`／`outputs` 的值只在目标机内传输，输入包和返回包分别受 `processWindow.maxBytes` 限制（默认 2 MiB），不消耗 Gateway 传输额度。`closeTimeoutMs`、`executionTimeoutMs`、内存、输出等运行参数仍可由实例设置；未覆写则继承全局值。详见 [`kernel` 参数表](configuration/execution.md#kernel)。

`kernel.memoryMax` 默认 `"4G"`，`memorySwapMax` 默认 `"0"`，`telemetryIntervalMs` 默认 1000 ms。运行中及 cell 结束时采样；空闲时保留最后一次内存样本。

`targetConnection.startTimeoutMs` defaults to 15000 ms and `targetConnection.requestTimeoutMs` to 10000 ms. `processWindow` bounds requests, unconsumed bytes and frame size for the shared target process transport; the same effective window is used by its consumers. See [target environment](design-notes/target-environment.md#process-目标-runtime-与消费窗口).


## `namespace`

See [`namespace` configuration](configuration/execution.md#namespace).

## `learning`

See [`learning` configuration](configuration/learning.md#learning).

## `memory`

See [`memory` configuration](configuration/learning.md#memory).

## `tools`

See [`tools` configuration](configuration/learning.md#tools).

## `skills`

See [`skills` configuration](configuration/learning.md#skills).

## `toolContent`

See [`toolContent` configuration](configuration/learning.md#toolcontent).

## `workspace`

See [`workspace` configuration](configuration/workspace.md#workspace).

## `terminal`

See [`terminal` configuration](configuration/workspace.md#terminal).

## `monitor`

See [`monitor` configuration](configuration/workspace.md#monitor).

## `metrics`

See [`metrics` configuration](configuration/gateway.md#metrics) and [Gateway metrics](metrics.md).

## `gateway`

See [`gateway` configuration](configuration/gateway.md#gateway).

## `http`

See [`http` configuration](configuration/gateway.md#http).

## `limits`

See [`limits` configuration](configuration/gateway.md#limits).

## Operator migration (manual, not automatic)

Perform PRK data migrations only with all Gateways using the selected home stopped. First rehearse on an offline copy and preserve a separate recoverable home backup; the migration itself does not stop services.

For a split-JSON home whose contents already satisfy the current `local`/`sshCommand`/`python` schema, first arrange an offline copy and run from the checkout. This JSON-to-TOML tool validates with the current parser; it does **not** accept old Jupyter JSON and cannot be chained into the pi-env cutover for that format:

```sh
node scripts/migrate-config-toml.mjs --home /absolute/path/to/prk-home-copy
```

`--home` is required and must be absolute; the command takes no home default from environment variables. It converts `config.json` and `instances.json`, renaming the instance `name` key to `id`. It checks the TOML round trip and validates the current schema before writing. JSON originals are retained as `config.json.before-toml` and `instances.json.before-toml`; if it renames IDs in an existing TOML file, it retains `instances.toml.before-instance-id`. A semantic or validation failure writes neither output. Repeating a completed migration makes no changes. The command prints a JSON summary, not credentials. Review the copy privately before using the operator's normal cutover procedure. Kernel tool manifests must be converted separately to `prk-tool.toml` / `<name>.prk-tool.toml`; see [kernel tools](kernel-tools.md#依赖声明与制品分发).

For the Jupyter-to-pi-env cutover, the dedicated migration accepts the approved old split-TOML home, not old Jupyter JSON. After stopping the Gateway and backing up the home, run it from the accepted checkout:

```sh
node scripts/migrate-pienv.mjs --home /absolute/path/to/prk-home-copy \
  --kernelspec-directory /absolute/path/to/old/kernels --gateway-stopped
```

The kernelspec directory is optional. The migration reads the old local spec's actual absolute interpreter path; a missing or permission-unreadable spec leaves the instance needing configuration, never silently selects `python3`. Remote commands are not inferred. It preflights all data, creates one `before-pienv` backup and replaces files atomically. If only the instance ID key changes, it backs up just `instances.toml` under `before-instance-id` and leaves any prior `before-pienv` backup alone. On failure do not start the Gateway and follow its backup/recovery diagnostic. Repeating a completed migration validates the current format without changes. The normal Gateway parser has no legacy compatibility path. See [installation](../INSTALL.md) for the operator sequence.

When preparing a new independent home:

1. Create the selected home and `agent/` directory. Keep global settings in `config.toml` and complete instance definitions in `instances.toml` using `[[instances]]` tables; all connection, identity, execution policy and capability fields belong to the instance file. Create `instances.toml` with mode `0600`; global settings use the process umask. Normal startup does not read old formats.
2. Copy only needed SDK/provider files into `agent/`: `auth.json`, `models.json` when defining or overriding models, provider-owned configuration such as `cliproxyapi.json` when using that plugin, the normal `settings.json` package/resource list, and selected resources such as `extensions/`, `skills/`, `prompts/`, `themes/`, `AGENTS.md`, `SYSTEM.md` or `APPEND_SYSTEM.md`. Retain each selected package's dependencies and metadata: for npm packages, the needed `npm/package.json`, `npm/package-lock.json` and `npm/node_modules/` dependency subtree; for git packages, its SDK-managed checkout. Keep credential-bearing files owner-only. Do not copy unrelated sessions, logs or caches; provider configuration must be in this independent home rather than solely in the Pi CLI home.
3. Inspect copied `settings.json` package/resource registrations and explicit `--extension` paths privately for absolute references; point them at the new `agent/` locations. Provider plugins belong in the existing `agent/settings.json` `packages` array, not a second provider list or a separately configured CLIProxy extension entry path. Gateway identifies provider ownership while loading that list. Inspect/repoint absolute paths in `models.json` and provider-owned configuration, and resolve provider-ID conflicts before startup. SDK global/project settings isolation is defined by [模块约定](configuration.md#约定).
4. Change the operator's startup script to pass the same `--home` (or `PRK_HOME`) to Gateway/Web/attach. Set each instance's absolute target `cwd` and `python`, and configure an unattended `sshCommand` for remote instances; keep target cwd and Gateway socket paths separate. Gateway owns the local daemon and starts remote connections on demand.
5. Restart only the deployment services through the operator's normal process. Independent home is a clean cutover; no obsolete file/flag/environment alias is recognized.



## 约定

See [约定 configuration](configuration/conventions.md#约定).
