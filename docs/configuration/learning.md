## `learning`

| Key | Default | Meaning |
| --- | --- | --- |
| `autoTools` | `true` | Include proactive reusable-Python-tool learning guidance in the system prompt. |
| `autoSkills` | `true` | Include proactive reusable-knowledge/skill learning guidance in the system prompt. |

Guidance switches: [模块约定](../configuration.md#约定); startup configuration boundary: [模块约定](../wire/targets.md#约定)、[模块约定](../configuration.md#约定).
The guidance distinguishes `control` (standing work rules), `user` (user facts), `memory` (general durable facts), `instance` (machine facts), skills (task-class procedures), and tools (reusable deterministic functions).
The model-facing descriptions are in `src/plugins/memory/tool-metadata.ts`, `src/plugins/skill-tools/tool-metadata.ts`, and the renderers `src/plugins/kernel/prompt/kernel/render.ts`, `src/plugins/memory/prompt/render.ts`, and `src/plugins/skill-tools/prompt/render.ts`.

## `memory`

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Boolean. When false, omit all memory injection and the model-facing `memory` tool, reject `gateway.memory`, and disable background review. Existing files are retained. |
| `directory` | `"memories"` | Memories directory: absolute, `~/…`, or relative to the PRK home. Holds `localmemory.toml`, `prk-localmemory-override.toml` and, by default, the layer files. Set `"~/memories"` to share layers and files with pi-local-memory on OMP/Pi. |
| `review` | `true` | Boolean. Whether this gateway runs background reviews; thresholds come from the TOML `[review]`. |

Layers, capacities and review thresholds are not in `config.toml`: they come from `<directory>/localmemory.toml` merged with `<directory>/prk-localmemory-override.toml` (built-in five layers when the shared file is absent). The PRK gateway also sets `MEMORIES_AGENT=prk` for plugins in its process. Design: [docs/specs/memory-layers.md](../specs/memory-layers.md).

When `localmemory.toml` is absent, every built-in path is absolute under the resolved `memory.directory`: `active_control.md`, `user.md`, `notes.md`, `instances/{instance}.md`, and `projects/{project}/memory.md`; `projectsDirectory` is `<directory>/projects`. An explicit TOML document that omits `projectsDirectory` also uses `<directory>/projects`. Saving a document containing these defaults preserves the absolute paths. Explicit TOML paths keep their existing meaning: absolute or `~/…` (the user's HOME), never relative to `memory.directory`. The following example explicitly opts into the shared HOME directory:

```toml
projectsDirectory = "~/memories/projects"
[review]            # either threshold, counted since the last review, starts one after a settled reply
userTurns = 10
toolCalls = 15
[[layers]]          # order = authority order; repeated per layer
name = "control"
path = "~/memories/active_control.md"   # may use {instance} (bound target) and {project} (session project id)
description = "Standing user rules and authorization boundaries; changed only on explicit user instruction."
capacityCharacters = 4000
soft = true         # over capacity only reminds
explicitOnly = true # written only on an explicit instruction; every write gets a visible notice
review = false      # background review may write it
```

The override merges by layer name: listed fields replace, `enabled = false` drops a layer, new names are PRK-only layers appended last; `[review]` merges by field. An invalid file disables memory with the reason in the gateway log and the memory list response.

Memory file format: plain text entries separated by `\n§\n`.
Storage/writer boundary: [模块约定](../wire/memory.md#约定); write publication: [模块约定](../wire/memory.md#约定).

| Layer scope | Path variable | Writer | Injection scope |
| --- | --- | --- | --- |
| soul | `prompts/soul.md` via `session.soulFile` | Operator only | All sessions |
| unscoped layer | none | Model or operator | All sessions |
| instance layer | `{instance}` | Model writes only its bound instance; operator chooses the group | Sessions bound to that instance |
| project layer | `{project}` | Model writes only its session's project; operator chooses the project | Sessions of that project; absent without a project. First render registers `<projectsDirectory>/<id>/project.json` (never overwritten) |

Prompt snapshot and retained orphan files: [模块约定](../wire/memory.md#约定).

The `memory` tool belongs to `group:tools:package:<inline:memory>`; direct-mode declaration follows its ordinary lazy settings, while code mode calls `gateway.memory(...)`. The deployment policy in [tool declaration lazy loading](../configuration.md#tool-declaration-lazy-loading) keeps it lazy through a stored global group setting, not a plugin code default.
Send `{operations:[...]}` even for one change. Each operation names a configured `target` and an `action`: `add` needs `content`, `replace` needs `content` and `old_text`, and `remove` needs `old_text`. The tool description and the `<memory>` section are generated from the layers.
Batch matching, budgets and immediate saving: [模块约定](../wire/memory.md#约定); persistence: [模块约定](../wire/memory.md#约定).

Background reviews use the current session model and context with only `memory` available, restricted to `review = true` layers.
Review lifecycle and history boundary: [模块约定](../wire/memory.md#约定).
Writes to `explicitOnly` layers show before/after notices; other layers show notices after review writes.
Review eligibility uses non-extension input events and tool calls; peer inputs can contribute.
Disabled-memory behavior: [模块约定](../configuration.md#约定).
File-edit visibility: [模块约定](../wire/memory.md#约定); option changes: [模块约定](../wire/targets.md#约定)、[模块约定](../configuration.md#约定).

## `tools`

Catalog location: `<PRK home>/tools/library.json` ([模块约定](../wire/tools.md#约定)、[模块约定](../wire/skills.md#约定)).
Validation: [模块约定](../configuration.md#约定); option changes: [模块约定](../wire/targets.md#约定)、[模块约定](../configuration.md#约定).

| Key | Default | Meaning |
| --- | --- | --- |
| `staging.capacity` | 20 | Loaded staging tool names; overflow archives the lowest distinct-session score, breaking ties by last successful use (never used first). |
| `staging.idleDays` | 14 | Idle staging tools are archived. Restoring/demoting starts a fresh staging competition period. |
| `promoted.capacity` | 15 | Loaded promoted names, including manual promotions. Overflow demotes the lowest-scoring automatic promotion. |
| `promoted.idleDays` | 14 | Idle automatic promotions return to staging; manual promotions are immune. |
| `promotion.distinctSessions` | 3 | Distinct native SDK session IDs with successful calls required for automatic promotion. Repeated calls in one session count once. |
| `archive.capacity` | 200 | Archived source versions retained globally; oldest archive transitions are trimmed first. |
| `versionsKept` | 5 | Total source versions retained per name, newest first. Saving a new version archives the previous one and preserves distinct-session and cumulative successful-call counts. |

`tool` and `library_sync` are preinstalled target-kernel functions.
Usage: `@tool(persist=True, reason="future task class")`, then `library_sync()` for saved entries, signatures/docstrings and instance import availability.
Validation and execution: [模块约定](../wire/tools.md#约定); lifecycle: [模块约定](../wire/skills.md#约定); storage: [模块约定](../wire/tools.md#约定)、[模块约定](../wire/skills.md#约定).
The `src/plugins/tool-library/` factory registers the preserved internal callbacks `prk_library_save`, `prk_library_access`, `prk_library_used`, and `prk_library_available`, plus dynamic saved tools. These callbacks are not ordinary capability entries; no `tool_save` / `tool_remove` API is added. Saved tools remain in the independent `group:tools:library` group, whose lazy default is true. The stored global `lazy:group:tools:package:<inline:tool-library>=true` policy has no current ordinary management-tool declaration to affect.

Tool entries include `reason`, nonnegative integer `successfulCalls`, `distinctSessions`, `available?` and `unavailableReason?`.
SDK names use `prk_saved_<Python name>`, `exposure:"codemode"`, and optional positional `args` / keyword `kwargs`.
Human operations: `toolsPromote`, `toolsDemote`, `toolsArchive`, `toolsRestore`, `toolsDelete`, each with `{name}` and result `{tools:[...]}`.
`toolsList` accepts `{target?}` and returns the same list shape.
Management transport: [private HTTP routes](../wire/kernel.md#http-routes-and-events).

## `skills`

Shared native skill files: `<PRK home>/skills/<name>/SKILL.md` plus supporting files; lifecycle metadata: `<PRK home>/skills/library.json` ([模块约定](../wire/tools.md#约定)、[模块约定](../wire/skills.md#约定)).
Discovery, scope and read boundary: [模块约定](../wire/skills.md#约定); capability reload: [模块约定](../configuration.md#约定).

Lifecycle option validation: [模块约定](../configuration.md#约定); option changes: [模块约定](../wire/targets.md#约定)、[模块约定](../configuration.md#约定).

| Key | Default | Meaning |
| --- | --- | --- |
| `staging.capacity` | 20 | Active staging skill names; overflow archives the lowest distinct-read-session score, then the oldest last read/creation. |
| `staging.idleDays` | 14 | Idle staging entries are archived; restore/demote starts a fresh staging period. |
| `promoted.capacity` | 15 | Promoted names, including manual promotions; overflow demotes the weakest automatic promotion. |
| `promoted.idleDays` | 14 | Idle automatic promotions return to staging. Manual promotions do not age or lose overflow competition. |
| `promotion.distinctSessions` | 3 | Distinct native SDK sessions with a successful read of the active managed `SKILL.md`; repeated reads in one session count once. |
| `archive.capacity` | 200 | Archived skill directories retained; oldest archive transitions are permanently removed on overflow. |

Skill lifecycle and manual promotion: [模块约定](../wire/skills.md#约定); structured create/patch and supporting files: [模块约定](../wire/skills.md#约定).
Generated `SKILL.md` frontmatter fields: `name`, `description`, `when-to-use`, `evidence`.
Generated chapters: When to use / Procedure / Pitfalls / Verification / Evidence.
Procedure/verification use ordered lists; pitfalls use bullets.

| Create field | Limit / meaning |
| --- | --- |
| `name` | 1–64 characters, native name syntax above. |
| `description` | 1–1024 characters; index/discovery trigger signals. |
| `whenToUse` | 1–4096 characters; applicability, also emitted as `when-to-use` frontmatter. |
| `evidence` | 1–8192 characters; concrete task/session, correction, failure or observed-result facts. Never invent evidence; without it do not write. |
| `procedure` | 1–32 ordered text steps, each 1–2048 characters. |
| `pitfalls` | 0–32 text items, each 1–2048 characters; an empty array is allowed. |
| `verification` | 0–32 ordered text steps, each 1–2048 characters; an empty array is allowed. |

Create fields appear above; `patch {name,section,value}` targets `description`, `whenToUse`, `evidence`, `procedure`, `pitfalls` or `verification` ([模块约定](../wire/skills.md#约定)).

```json
{"action":"create","name":"inspect-kernel-failure","description":"Use when a retained Jupyter cell fails","whenToUse":"A failed cell needs diagnosis before another run","evidence":"Session example-42 observed a missing import in the traceback","procedure":["Read the actual traceback before changing the target environment"],"pitfalls":[],"verification":[]}
```

Supporting-file operations: `write_file` / `remove_file`; whole-skill removal: `delete` ([模块约定](../wire/skills.md#约定)).
Code-mode entry: `gateway.skill_read(path=...)`; direct entry: `skill_read`; explicit expansion: `/skill:name` ([模块约定](../wire/skills.md#约定)).
Usage metadata includes `distinctSessions` and `lastUsedAt`; read accounting and API evidence limitations are documented in [design notes](../design-notes.md).


## `toolContent`

| Key | Default | Range / meaning |
| --- | --- | --- |
| `maxBytes` | 8192 | **positive**; defer a tool input/output when its display text or its complete compact JSON representation exceeds this many UTF-8 bytes. |
| `maxLines` | 40 | **positive**; defer a tool input/output when its display text exceeds this many newline-delimited lines (`text.split("\n").length`, including an empty last line after a final newline). |

Projection semantics: [模块约定](../wire/tool-content.md#约定); content lookup: [WEB-10](../contract.md)、[REQ-13](../contract.md); browser hydration: [WEB-11](../contract.md).
Input display uses `args.code` or formatted JSON; malformed arguments use `argumentsError` with `args:{}`.
Descriptors include display-text `bytes` / `lines`, a preview, and a compact-JSON SHA-256 version.

Full-content lookup: [Gateway transport](../wire/tool-content.md#descriptors), [WEB-10](../contract.md)、[REQ-13](../contract.md).
Projection/history boundary: [模块约定](../wire/tool-content.md#约定); option changes: [模块约定](../wire/targets.md#约定)、[模块约定](../configuration.md#约定).
