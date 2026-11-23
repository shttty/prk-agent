## `instances.toml`: instances (default `instances = []`)

Each entry selects an owned local daemon or a remote shell connection. Instance validation: [模块约定](../configuration.md#约定).

The root contains only `instances`, expressed as `[[instances]]` tables or `instances = []` for an empty list. Every field of each instance is stored here; a missing file means no instances. Structure, unknown keys and instance validation run at the loading boundary, using global limits and root kernel defaults from `config.toml`.

| Key | Default | Valid value / normalization |
| --- | --- | --- |
| `id` | required | Non-empty string, trimmed; at most `limits.identityChars`; unique stable routing identity used by `target` references. The former key `name` is rejected. |
| `label` | required | Display name: non-empty trimmed string without control characters; at most `limits.labelChars`; unique case-insensitively. |
| `local` | `false` | `true` starts an owned local daemon and forbids `sshCommand`; locality is explicit. |
| `sshCommand` | omitted (needs configuration for remote) | Original command executed locally with `/bin/sh -c`, without appended arguments. Its stdin/stdout must reach a noninteractive target POSIX shell. |
| `python` | omitted (managed venv) | Optional absolute target executable path, Python 3.9 or newer. Saving a changed explicit path verifies its version. An explicit path is used as-is and never changed or provisioned by PRK. |
| `pythonIndexUrl` | inherit global `pythonIndexUrl` | PyPI simple-index HTTP(S) URL without userinfo, query or fragment. With neither value configured, PRK runs uv offline and the managed uv launcher reports the missing mirror. |
| `bunPackages` | omitted | Optional `{registry,scopes?}` for explicit Bun package maintenance. Set `registry` to the instance's internal npm registry, and map `"@scope"` to its internal registry under `scopes`. URLs cannot contain credentials, query, or fragment. No default npm registry. |
| `tags` | `[]` | At most `limits.tagsMax` strings; non-empty after trimming, no control characters, each at most `limits.tagChars`; duplicates removed. |
| `cwd` | **required** | Absolute POSIX path (starts with `/`) without control characters, at most `limits.cwdChars`; existing authorized execution directory on the target. A missing or relative cwd is a configuration error (load, `reloadTargets`, add, edit). Sessions default to it. |
| `executionTimeoutMs` | omitted | Overrides the nested `kernel.executionTimeoutMs` and the global value. `0` means no hard limit when `asyncExecution` is enabled, or 300000 ms when disabled. Waiting for `ask` pauses the deadline. |
| `kernel` | inherit root runner settings | Partial override of [kernel runner settings](execution.md#kernel); fields marked global only are rejected. |
| `capabilities` | `{}` | Sparse boolean overrides in the same format as `session.capabilities`; effective session settings are session override ?? instance default ?? global default ?? true. The local-tools master stays in `session.localTools`. |
| `customMetrics` | `[]` | List of `{name,command,interval_s,parse,unit?,chart?}`. Unique non-empty names; non-empty shell commands without NUL; positive finite interval (seconds, at most 2147483.647); parser `number` or `json:<non-empty dot-path>`; optional string unit and `chart:"line"` only. Unknown fields fail at config load. |

`space_status()` publishes the configured Python override, if any, and optional `configurationIssue` without connecting. Explicit target discovery returns that same configuration, not a kernel catalog.

Without `python`, deploy the instance environment to install the pinned Python offline and create one venv shared by all sessions on that instance. The REPL and model terminal use it; redeploying preserves installed packages. A remote instance without `sshCommand` is still accepted as pending: execution refuses with `submitted:false` and `configurationIssue`, but history and sleeping settings remain available. Interactive password/OTP/MFA steps are unsupported. Scope enforcement is described in [kernel death](../kernel-death.md).

Explicit package maintenance is documented in [instance environment deployment](../wire/targets.md#实例环境下发p6). Target-side `NPM_TOKEN`, when supplied, is used for registry authentication at install time. PRK does not publish token values, run package install scripts, or install packages during cell execution. Native packages must supply a working artifact for the target and pass the actual import check.

In the Web instance editor, test the connection before browsing for the working directory or Python interpreter. Each picker starts at its own absolute location (the containing directory for Python), then falls back to the other field's absolute location, then to `/`. The working directory still needs an absolute path to save.

For example, `instances.toml`:

```toml
[[instances]]
id = "office"
label = "Office Python"
local = false
sshCommand = "ssh -T -oBatchMode=yes office"
tags = ["office"]
cwd = "/absolute/owned/project"
python = "/absolute/venv/bin/python"
```


Custom metrics are edited in `instances.toml`; the instance settings page shows the list read-only. Append these nested tables after the owning instance's fields:

```toml
[[instances.customMetrics]]
name = "temperature"
command = "printf '42.5'"
interval_s = 5
parse = "number"
unit = "°C"
chart = "line"

[[instances.customMetrics]]
name = "queue"
command = "my-status --json"
interval_s = 10
parse = "json:queue.pending"
```
Reload instances after editing definitions ([模块约定](../wire/targets.md#约定)、[模块约定](../configuration.md#约定)); connection-setting saves preserve that list ([模块约定](../configuration.md#约定)).

Custom metric commands use the shared target channel with `/bin/bash -c` and stdin `/dev/null`.
The runtime tick has 0.5-second resolution; command scheduling uses completion time plus `interval_s`.
`number` parses the first signed decimal/exponent in stdout; `json:` walks object keys or unsigned array indexes to a finite numeric scalar.
Nonzero exit, parse failure, timeout and excess output appear as per-metric errors.
Results/errors use the in-memory chart window ([REQ-13](../contract.md)、[模块约定](../wire/kernel.md#约定)).
