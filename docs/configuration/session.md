## `derivation`

These defaults apply to every newly derived lifecycle. Model and thinking selection is per field: request > selected role > creator's current value. Configure reusable model/thinking choices on roles, not global derivation defaults; `derivation.defaultModel` and `derivation.defaultThinkingLevel` are unsupported fields and rejected. Unsupported inherited selections fail rather than being coerced. Unknown fields at either configuration or role level are rejected.

| Key | Default | Valid value |
| --- | --- | --- |
| `defaultToolMode` | omitted (host `session.workerTools`) | `code` or `direct`; the parent's current mode is not inherited. |
| `defaultIsolated` | `false` | Boolean; create an independent target-side git worktree. |
| `maxDepth` | `3` | Integer 1..10; top-level depth is 0 and a child above the limit is rejected before creation. |
| `defaultInstructions` | built-in text below | String, including empty string. |
| `roles` | built-in `task` and `small` | Object keyed by non-blank role names, distinct from task labels; user fields override each built-in field. |
| `roles.<name>.description` | built-in description for `task` / `small`, otherwise omitted | String; discovery/settings description. |
| `roles.<name>.model` | omitted (inherit current parent) | Non-empty `PROVIDER/MODEL`, no whitespace/control characters. |
| `roles.<name>.thinkingLevel` | omitted (inherit current parent) | `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max`. |
| `roles.<name>.toolMode` | omitted (global/host default) | `code` or `direct`; not selectable by the model's spawn task parameters. |
| `roles.<name>.isolated` | omitted (global default) | Boolean; an explicit spawn `isolated` value wins. |
| `roles.<name>.instructions` | omitted (global/built-in default) | String; explicit `""` suppresses instruction injection rather than inheriting. |
| `roles.<name>.capabilities` | omitted | Capability-ID-to-boolean map, validated by the same rules as existing switches. Saved with tool mode in the child's initial `gateway-native-session-state` to override instance/global defaults; no separate capability layer. |

The native-tools master remains `session.localTools`; roles can override individual native tool IDs, but cannot store `group:tools:local`. The role editor therefore omits that group's master control while keeping its individual tool switches.

Omitted `session_spawn.tasks[].role` selects `task`, including its model/thinking, tool mode, isolation, instructions and capability overrides. `task` starts with description `Default role for general coding and implementation sub-sessions.`; `small` starts with description `Fast, lightweight role for quick searches, exploration and small tasks.` and `toolMode:"direct"`. Neither provides a model or thinking override by default. Both always appear in settings and `space_status`; configured fields override the built-in fields, and omitting one restores its defaults rather than deleting it. The Web editor permits changing their settings but not deleting or renaming them; custom roles remain removable.

Derived target selection and lifecycle are described in [session management](../machine-session-management.md); Python is selected only in instance configuration.

Built-in instructions (`DEFAULT_DERIVED_INSTRUCTIONS`): `Your parent already planned the overall work; you own only this piece. Do it directly unless your role or assignment explicitly calls for further sessions.` Role instructions take precedence even when empty, then `defaultInstructions`, then this constant. The child identity prompt remains mechanism-only; assignment text and role policy are separate.

Save via [`GET` / `POST /api/derivation`](../wire/native.md#derived-session-settings). POST replaces this entire group atomically and immediately updates spawn configuration; it does not rewrite existing children. Isolation uses request > role > global > false and preserves the selected base cwd's subdirectory in a detached target-side worktree; [patch delivery and cleanup](../wire/native.md#worktree-isolation-and-patch-results) do not apply changes to the parent automatically.

## `session`

Pi session settings (`steeringMode`, `followUpMode`, `compaction.*`, `cacheWarming`, ...) use `<home>/agent/settings.json` and project `.prk/settings.json`: [模块约定](../configuration.md#约定).

| Key | Default | Range / meaning |
| --- | --- | --- |
| `historyDir` | `"sessions"` | Gateway Pi JSONL history directory; relative paths resolve against the PRK home (`<home>/sessions`). Must be non-empty and contain no control characters. |
| `soulFile` | `""` | The soul layer: an operator-authored identity/persona prompt, normally `"prompts/soul.md"`. Empty disables it; relative paths resolve against the PRK home. Read for new, rebuilt, woken and natively reloaded sessions. Models never edit it through the memory tool. |
| `workerTools` | `"code"` | New-worker default: `code` or `direct` only. Both modes use the same owned `kernel_code {code,title?,reset?}`, target helpers, Gateway callbacks, shared tool library, and `tool_bin`. Before adding independently enabled local tools, `code` declares only `kernel_code`; `direct` declares resident tools plus `tool_search` / `tool_call` when enabled tools have hidden declarations. [Tool declaration lazy loading](../configuration.md#tool-declaration-lazy-loading) controls that declaration-only selection. Other values, including `local`, `python`, and `all`, are invalid; there are no aliases. |
| `delegation` | `"eager"` | New-session saved policy: `gated`, `restrained`, or `eager`; rendered only for ownerless top-level sessions. Gated requires an explicit user or applicable AGENTS.md/skill delegation request; restrained scopes inline before 2+ independent substantial slices or a context-flooding read set; eager prefers substantial delegation after design settles. |
| `localTools` | `false` | Native-tools master; permissions apply immediately and declarations on the next request. New explicit `local:true` sessions inherit this default; remote sessions start off and can enable it explicitly. Seven Pi tools are always registered: Gateway execution for local, target-host execution for remote. PRK kernel files stays loaded but cannot execute while native tools are on. Switching never restarts a kernel or clears variables; a native-only remote host starts on its first real call. |
| `toolTitle` | `true` | Boolean; every declared tool requires a short call title (kernel_code's own `title` becomes required). Changes apply on the next model request without reloading or waking sessions. Recorded titles remain visible. |
| `capabilities` | `{}` | Sparse boolean defaults keyed by `tool:<SDK name>`, `kernel:<helper name>`, `skill:<absolute path>`, source `group:*` IDs, or [declaration-lazy IDs](../configuration.md#tool-declaration-lazy-loading). Missing enable keys mean enabled; lazy keys have their own tool/source defaults. The local-tools master is stored only in `localTools`. |
| `idleTimeoutMs` | 1800000 | **timer**; continuously idle runtime reclamation. |
| `providerRetryGraceMs` | 2500 | **positive timer**; how long a retryable failed turn still appears running before the sidebar marks it stopped. Does not schedule retries. |
| `askTimeoutMs` | 0 | **non-negative timer**; `0` waits indefinitely. Above 0, an unanswered `ask` uses each question's recommended option (else the first) and reports that in the tool result. The cell's active deadline and reminders pause while it waits; the foreground yield clock does not. |
| `idleCheckIntervalMs` | 1000 | **timer**; idle reclamation scan interval. |
| `recentOperationsMax` | 64 | **positive**; retained operation outcomes. |
| `inboxMaxMessages` | 32 | **positive**; peer inbox message cap. |
| `inboxMaxChars` | 131072 | **positive**; peer inbox payload character cap (sum of entry bodies, excluding envelope framing). |
| `maxMessageChars` | 16384 | **positive**; individual peer message character cap. |
| `rememberedNoReplyMax` | 4096 | **positive**; remembered no-reply peer IDs. |
| `rememberedRepliesMax` | 4096 | **positive**; remembered answered peer IDs. |
| `noExtensions` | `true` | Boolean; disable filesystem/package extensions in worker session resource loaders (inline application factories still load). |
| `noSkills` | `false` | Boolean; disable default SDK skill discovery and PRK shared-skill discovery for worker sessions. Explicit paths supplied by other SDK extensions retain native loader semantics. Management/read tools remain available. |
| `noPromptTemplates` | `true` | Boolean; disable session prompt templates. |
| `noThemes` | `true` | Boolean; disable session themes. |
| `noContextFiles` | `true` | Boolean; disable session context-file loading. |
| `bootstrapNoSkills` | `false` | Boolean; default skill policy while resolving Gateway provider/model services; `--no-skills` explicitly disables it. |
| `hostExpandPromptTemplates` | `true` | Boolean; SDK prompt-template expansion for SessionHost submissions. |
| `expectReplyForNewMessages` | `true` | Boolean; peer-send reply expectation when omitted on a new message. |
| `expectReplyForReplies` | `false` | Boolean; peer-send reply expectation when omitted on a reply. |
| `defaultThinkingLevel` | `"medium"` | `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max`; initial session thinking level. |
| `defaultDerivedLifecycle` | `"temporary"` | `temporary` or `persistent`; default agent-derived lifecycle. Temporary children stop and archive after delivering a result; persistent children remain until their parent destroys them. |
| `defaultSendMode` | `"auto"` | `auto` or `plain`; omitted native send mode interprets control input or sends literal text. Explicit request mode takes precedence. |
| `defaultExportFormat` | `"jsonl"` | `jsonl` or `html`; native export format when omitted. |
| `errorDetailChars` | 8000 | **positive**; diagnostic detail text cap. |
| `errorStackLines` | 40 | **positive**; diagnostic stack line cap. |
| `errorLookbackMessages` | 3 | **positive**; recent SDK messages examined for failure detail. |

Per-session `gateway-native-session-state` and sparse defaults/overrides: [模块约定](../configuration.md#约定). Mode, native-tool, individual/group and skill switches affect the next request without reload; execution permission changes immediately: [模块约定](../wire/native.md#约定).

`nativeCapabilities.target.current.toolMode`, `nativeCapabilities.target.current.delegation` and boolean `nativeCapabilities.target.current.localTools` report saved selections; `nativeCapabilities.target.local` is the explicit instance-locality marker ([模块约定](../configuration.md#约定)).
The session-local native action `delegation` accepts exactly `{level:"gated"|"restrained"|"eager"}`. It changes only the selected active session, including during model work, and persists in its `gateway-native-session-state` history. For an ownerless top-level session with callable `session_spawn`, the supported per-request `context_with_system` hook applies the current policy on the next model request, even within the same run; no reload is needed. Dormant session catalogs report the saved policy without waking the session. New sessions save their initial default so later global changes do not replace it.

The derived-session identity prompt contains mechanism facts and no inherited delegation policy. A separate `Role instructions:` line uses the role/global/built-in instructions selection [above](#derivation), and is omitted for an explicit empty string. Roles or skills can supply their own multi-level delegation policy.

The same Web switch appears on both: 「本机工具」 on local instances, 「原生工具」 on remote instances; no second setting is stored.

`GET /api/capabilities` lists definitions grouped by PRK, kernel, persisted tools, plugin package, MCP server, and native local tools.
Skills use Gateway global/shared/PRK-home/package origins; session views also include target project directories, never target-home globals.
The Gateway home group is `group:skills:global`; project groups use `group:skills:dir:<machine>:<absolute directory>`. Skills and prompt templates use project > Gateway global precedence. Local and remote sessions follow Pi's lookup rules for each resource class: `.agents/skills` walks from the session cwd through the git root (or `/` if none); project `.prk/prompts` uses only the session cwd.
Skill selection and scope: [模块约定](../wire/skills.md#约定).
`POST /api/capabilities` accepts `{changes:[{id,enabled:boolean|null},...]}`, `{instance,changes:[{id,enabled:boolean|null},...]}`, or the separate `{terminal:{...}}` form. Capability batches validate atomically, save once and refresh once; the single-value capability form is rejected.
`GET /api/capabilities?instance=<name>` adds instance package discovery, not target-home skill discovery; fields include `configured`, `defaultEnabled`, `overridden`, and optional `instanceError`.
Capability inheritance, saving and reload: [模块约定](../configuration.md#约定).

`POST /api/capabilities/refresh` runs a full discovery; inventory storage/disposal and failed-refresh behavior: [模块约定](../wire/native.md#约定).
Global pages offer “刷新工具列表”; session pages overlay desired switches and actual loaded state on the inventory.
Snapshots and the session catalog expose `requiresReload`; reload boundary: [模块约定](../configuration.md#约定).

The Web settings dialog has General, Instances, Tools, Skills, Memory and Archive sections in one surface. On phones, the section list opens a detail page with Back. Tools/Skills share the same source-filtered list/detail component with each session's row-menu entry: global settings edit defaults; the session entry edits sparse overrides and offers per-item restore. A mixed group master appears gray without changing remembered item switches. The local-tools group master and composer switch are the same value. Persisted tool/shared skill lifecycle actions live in the selected detail, including archived records; terminal details edit the global terminal settings. A pending-change notice and the session row menu both expose idle-only reload.


Native tool names on either instance kind: `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`. Local instances execute on the Gateway; remote instances execute in the target Pi host over the shared channel. Both retain `kernel_code`; native mode hides and denies kernel files without unloading it.
Mode and locality: [模块约定](../wire/native.md#约定), [模块约定](../configuration.md#约定); per-tool switches: [模块约定](../configuration.md#约定).
Native tool cwd is not a sandbox: local tools carry the Gateway user's authority; remote file tools operate as the target-channel user on the target filesystem.

When native tools are off, the resident Python `files` module permits streaming `read(path, offset=None, limit=None)` row mappings with `N#hhh` refs, validated `edit(path, operations)` batches, whole-file `write`, and rg-backed `grep`. Its three file operations invoke PRK backing tools through SDK callbacks so plugins receive real events; hashline state stays in the kernel, including across native switches. See the [salted-hashline contract](../wire/file-tools.md#salted-hashlines) for payloads, paging, post-hook diff refs, encoding and lifetime, and [module configuration](../kernel-tools.md#文件模块与纯库prk-filetools) for defaults.

Retarget/local-tools behavior: [模块约定](../wire/native.md#约定).

Worker runtime and peer-message behavior:

SDK settings isolation: [模块约定](../configuration.md#约定).
Peer inbox delivery, cancellation and session shutdown are documented in [session management](../machine-session-management.md).

Peer envelope fields: sender, message ID, optional `replyTo`, reply expectation, and optional `metadata.custom.peerMessage.batch = {id,index,count}`.
Batch `id` joins member IDs with `+`; `index` is zero-based; single entries omit `batch`.
Delivery and bounded reply guards: [模块约定](../wire/sessions.md#约定).

Cancellation reports cumulative `returnedMessages` and may emit a hidden `gateway-peer-discard-notice`.
Admission, discard and cancellation boundaries: [模块约定](../wire/sessions.md#约定), [REQ-1](../contract.md)、[模块约定](../wire/native.md#约定).
Input-extension limitations and cancellation uncertainty are recorded in [design notes](../design-notes.md).

Paid acceptance requires separate explicit authorization and a caller-prepared credential copy; it does not run in the [deterministic checks](../kernel-recovery.md#test-environment).
