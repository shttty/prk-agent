# Instances and session environments

## Vocabulary

- **Instance (实例):** a stable configured target using an owned local daemon or a remote shell command, with an instance-level Python executable.
- **Python environment:** the selected absolute executable and its installed dependencies; selection belongs to the instance, not the session.
- **Session:** a managed conversation with its native sessionId and retained target/cwd, independent of a lazily allocated REPL.
- **Kernel:** the live owned Python REPL and namespace. Its execution identity is transient and cannot be adopted after Gateway loss.

Tool modes are code/direct. The independent localTools switch adds Pi's seven native coding tools in an isolated target host, including for local instances. Defaults remain session.workerTools=code and session.localTools=false. Gateway-local plugins/provider ownership remains separate from target execution. Tools use the saved cwd; it is not a sandbox.

## Instance configuration

The private instances.toml stores all instance fields under [[instances]]; global settings remain in config.toml. See [configuration](configuration.md). Session selection contains target and effective absolute cwd. The selected instance supplies Python.

Draft inspection returns hostname/platform/home from the target daemon and discovered Python candidates, without a session or REPL. The editor tests the connection, allows target filesystem selection, then runs the selected Python to verify version 3.9 or newer. Missing command/Python can be saved as pending configuration; history and sleeping settings remain available, while execution refuses with submitted:false and a structured configurationIssue.

Connection-data storage and browser exposure: [模块约定](configuration.md#约定), [模块约定](wire/targets.md#约定). The private configuration file is plaintext with owner-only mode `0600`.

## Configuration and discovery APIs

The existing `/api/targets` route and internal `target` identifier remain transport plumbing for instances, not a separate domain entity.

- `POST /api/targets` creates an instance.
- `GET /api/targets/:id` returns editable configuration, including the saved command.
- `PATCH /api/targets/:id` accepts edits; omitted fields retain saved values, empty command/Python clears them.
- `DELETE /api/targets/:id` accepts `{ "confirm": true }`; deletion and active-binding rules are [模块约定](wire/targets.md#约定).
- `POST /api/targets/inspect` accepts `{connection:{local,sshCommand?,python?,cwd?}}` and returns `{hostname,platform,home,pythonCandidates,python?:{path,version}}`.
- `POST /api/targets/browse` accepts `{connection:{local,sshCommand?,cwd?},path}` and returns bounded target entries. There is no kernels catalog route.

The shared picker starts at the current cwd and browses absolute target paths, with `/` as the root. Directory mode selects folders; interpreter mode also selects files. Loading/error states disable selection and show the failure. Cancel preserves the prior selection. Changing the connection invalidates prior checks and pending replies; stale results never overwrite the current draft. See [target API](wire/targets.md).
 
## Session creation and presentation

The instance-header `+` form selects an instance, effective cwd and optional session name. Its request is `{target,cwd?,label?}`. Python is displayed from the selected instance; there is no session-level selector.

Public session/history/creation responses expose target and cwd. `session_spawn({context,tasks:[{task,label,target?,cwd?}]})` captures each child's directory independently: omitted cwd inherits the creator's directory on the same instance, or the other instance's default across instances. Project resources follow that captured target directory.

The sidebar's **实例** and **项目** views project the same session identities. Grouping and project assignment boundaries: [模块约定](wire/sessions.md#约定).

Project membership shape is `{projectId,projectName}` in SDK metadata. `PATCH /api/sessions/:sessionId/project` accepts `{project:{id,name}|null}`. Groups are derived from member sessions; there is no separate empty-project catalog or project-wide scheduler in this API.

## Lifecycle and deployment boundary

Gateway/Web ownership and operation failure: [LIFE-1](contract.md), [REQ-9](contract.md)、[REQ-8](contract.md). History browsing, normal shutdown/wake and explicit recovery: [REQ-13](contract.md)、[模块约定](wire/sessions.md#约定), [LIFE-3](contract.md)、[LIFE-4](contract.md), [LIFE-7](contract.md).

The session API's explicit target and absolute-cwd requirements are [模块约定](kernel-recovery.md#约定), [模块约定](configuration.md#约定).

Production configuration or session files must not be rewritten while an older Gateway can still mutate them. Any production cleanup or restart requires its own backup, rollback path and explicit authorization; installing code is not authorization to interrupt a service.
