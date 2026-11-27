## `gateway`

| Key | Default | Range / meaning |
| --- | --- | --- |
| `socketPath` | `<OS tmpdir>/pi-gateway-<effective UID>/gateway.sock` | Non-empty absolute Unix socket path without control characters; normalized path bytes must fit `limits.socketPathBytes`. CLI `--socket` overrides it. |
| `connectionsMax` | 64 | **positive**; simultaneous private socket connections. |
| `pendingMax` | 32 | **positive**; pending per-connection requests. |
| `connectTimeoutMs` | 30000 | **timer**; client connection deadline. |
| `requestTimeoutMs` | 30000 | **timer**; client request deadline. |
| `socketCloseGraceMs` | 1000 | **timer**; socket close grace period. |
| `systemdUnit` | `""` (not configured) | Empty, or a systemd **user** unit name (letters, digits and `: _ . @ \ -`; must not start with `-`) that runs the Gateway, such as `prk-gateway.service`. Read by the web process only: Settings → 通用 → 重启 Gateway and `POST /api/gateway/restart` run `systemctl --user restart -- <unit>` directly, never through the Gateway socket ([WEB-21](../contract.md)). Empty means the API answers `NOT_CONFIGURED` and the button is disabled; no unit name is guessed. Restart the API after changing it. |
| `restartTimeoutMs` | 120000 | **timer**; deadline of that `systemctl` call. Keep it above the unit's `TimeoutStopSec` (systemd default 90 s): a Gateway frozen in a synchronous loop ignores SIGTERM and is only killed after that timeout. On expiry the API reports an unknown outcome (504) and never retries. |

## `http`

| Key | Default | Range / meaning |
| --- | --- | --- |
| `host` | `"127.0.0.1"` | Any host accepted by Node's listener (IP address or hostname); no application-level address-range restriction. |
| `port` | 8787 | **port**; API-only Web listener. |
| `connectionsMax` | 64 | **positive**; HTTP connection cap. |
| `streamsMax` | 24 | **positive**; simultaneous SSE stream cap, shared with terminal WebSockets (one Gateway connection each). |
| `requestTimeoutMs` | 120000 | **timer**; fixed budget to receive a non-upload request body once its headers have arrived. Incoming bytes do not extend this budget; incomplete bodies receive 408 and the connection closes. Does not limit response streaming. |
| `uploadIdleTimeoutMs` | 60000 | **timer**; maximum wait for the next workspace/artifact upload body bytes or a workspace chunk acknowledgement. No whole-upload deadline. One minute tolerates brief network interruptions without keeping abandoned transfers open indefinitely. A shorter Gateway or target operation deadline still applies. |
| `headersTimeoutMs` | 15000 | **timer**; header deadline. |
| `heartbeatMs` | 15000 | **timer**; SSE heartbeat and terminal WebSocket ping interval. |
| `streamTimeoutMs` | 0 | Integer 0..2147483647 milliseconds; zero disables stream timeout. |
| `bodyBytes` | 1048576 | **positive**; HTTP request body cap. |
| `outputBytes` | 8388608 | **positive**; slow-consumer output buffer cap. |
| `contentLengthDigits` | 15 | **positive**; Content-Length decimal digit cap. |
| `extensionUiRenderIntervalMs` | 60 | **timer**; minimum spacing between browser plugin-UI render requests. Each page keeps at most one render in flight and coalesces pending updates; a continuous update stream cannot postpone the next render indefinitely. The browser reads it from `GET /api/ui`. |
| `terminalBusyRetriesMax` | 40 | **positive**; how many times a terminal WebSocket retries `terminalOpen`/`subscribeTerminal` while the Gateway reports a transient session transition (wake, kernel action) before it reports the failure. Other failures are never retried. |
| `terminalBusyBackoffMs` | 200 | **timer**; first wait between those retries; it doubles each time. |
| `terminalBusyBackoffMaxMs` | 2000 | **timer**; ceiling of that wait. The defaults wait about 75 s in total. |

CLI listener/socket overrides: [模块约定](../configuration.md#约定).

## `metrics`

Prometheus metrics and stall logging in the Gateway process; series, semantics and log format are in [Gateway metrics](../metrics.md). `enabled`, `host` and `port` are also edited in Settings → 通用 → 调试 and apply without a restart ([Switch and port](../metrics.md#switch-and-port)); the page rewrites `config.toml` and drops its comments.

| Key | Default | Range / meaning |
| --- | --- | --- |
| `enabled` | true | Serve `GET /metrics` on `<host>:<port>`. Off: no listener; hook and event-loop timing and the stall log still run. A busy port or an unbindable address at start does not stop the Gateway: metrics stay off for that run, the failure is logged and shown in Settings, and there is no retry (a Tailscale address may not exist yet at boot; once it does, save the settings page once to bind it). |
| `host` | `"127.0.0.1"` | IP literal to listen on (IPv4 or IPv6, `0.0.0.0` and `::` included), never a host name; `metricsSet` rejects anything else with 400. The endpoint has no authentication: with a non-loopback address, such as a Tailscale one, everyone who can reach it reads session counts, plugin and provider names (no message content, no keys). |
| `port` | 9464 | **port**; TCP port of the listener. The settings page and `metricsSet` accept only 1024..65535; `config.toml` also takes 0..1023 (0 picks a free port). |
| `stallThresholdMs` | 200 | **timer**; a synchronous section (plugin handler call, frame serialization, history load) or an event-loop window with delay at or above this writes a `Gateway stall` log line and counts in `prk_stalls_total`. |
| `eventLoopWindowMs` | 1000 | **timer**; the event-loop delay histogram is read and reset at this period; `prk_eventloop_delay_seconds` and `prk_eventloop_utilization_ratio` describe the last finished window. Shorter windows log a stall sooner. |

Changes to `config.toml` made by hand, and to `stallThresholdMs` and `eventLoopWindowMs` in any way, need a Gateway restart.

## `limits`

| Key | Default | Range / meaning |
| --- | --- | --- |
| `inputBytes` | 1048576 | **positive**; inbound Gateway frame / combined send cap. |
| `historyPageBytes` | 3145728 | **positive**; projected history page JSON budget. The effective budget is at most half the smaller of `limits.outputBytes` and `http.outputBytes`; pages keep whole user turns. |
| `outputBytes` | 8388608 | **positive**; outbound Gateway and attach output-buffer cap. |
| `identityChars` | 256 | Integer 44..9007199254740991; fits generated `project-<uuid>` (44 characters) and session UUIDs. |
| `labelChars` | 200 | **positive**; instance/session label bound. |
| `sshCommandChars` | 2048 | **positive**; original remote shell command length bound. |
| `cwdChars` | 4096 | **positive**; execution cwd field bound. |
| `contextFileBytes` | 65536 | **positive**; maximum bytes of one remote context/settings/prompt file or skill frontmatter transferred for session resources; excess rejects discovery with path and limit. |
| `contextTotalBytes` | 262144 | **positive**; combined remote context/settings/prompt text and skill frontmatter bytes per discovery; excess rejects the whole snapshot, never silently omits files. |
| `tagsMax` | 20 | **positive**; instance tag count. |
| `tagChars` | 64 | **positive**; one instance tag bound. |
| `modelChars` | 512 | **positive**; model identifier bound. |
| `messageChars` | 262144 | **positive**; user message bound. |
| `requestIdChars` | 256 | Integer 90..9007199254740991; fits the longest current generated request ID, `derived-transfer:<child-uuid>:<uuid>`. |
| `operationIdChars` | 512 | Integer 73..9007199254740991; fits generated `<SDK-session-uuid>:<uuid>` operation IDs. |
| `actionChars` | 128 | **positive**; native action/name bound. |
| `attachmentNameChars` | 256 | **positive**; attachment filename bound. |
| `mimeTypeChars` | 128 | **positive**; MIME field bound. |
| `attachmentsMax` | 4 | **positive**; attachments per send. |
| `attachmentBytes` | 393216 | **positive**; individual decoded attachment cap; base64 cap derived from it. |
| `attachmentTotalBytes` | 655360 | **positive**; aggregate decoded attachment cap. |
| `referencesMax` | 32 | **positive**; text references per send. |
| `referenceTextChars` | 262144 | **positive**; one reference text bound. |
| `referenceFieldChars` | 4096 | **positive**; reference metadata field bound. |
| `socketPathBytes` | 100 | Integer 1..100; Unix path platform ceiling cannot be increased. |
| `augmentedMessageBytes` | 327680 | **positive**; combined prompt/reference augmentation cap. |
| `nativeTreeNodes` | 512 | **positive**; displayed native tree node cap. |
| `nativeTreeDepth` | 64 | **positive**; displayed native tree depth cap. |
| `exportEnvelopeReserveBytes` | 4096 | **positive**; response framing reserve for exports. |
| `bindingMessageChars` | 500 | **positive**; unavailable-binding diagnostic bound. |
| `scopedModelsMax` | 32 | **positive**; native model-scope count and persisted scope bounds. |
| `derivedSummaryChars` | 32768 | **positive**; derived result summary bound. |
| `derivedArtifactsMax` | 100 | **positive**; derived result artifact count cap. |
| `derivedTaskChars` | 65536 | **positive**; derived task instructions bound. |
| `forkLabelChars` | 190 | **positive**; source-label prefix retained before the fork suffix; also clamped to `labelChars` so the full label fits. |
