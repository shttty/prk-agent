# Gateway metrics

The Gateway process serves Prometheus text metrics on `GET http://127.0.0.1:<metrics.port>/metrics` (default port 9464; see [`metrics` settings](configuration/gateway.md#metrics)). Every session's agent loop and every Gateway-side plugin share this process's single event loop, so one synchronous block freezes all sessions. These metrics show that the loop was blocked and who blocked it.

## Why the Gateway serves it

`/metrics` has to describe the Gateway process, not the web API process. The web API (`http.port`) reaches the Gateway through a Unix socket, so serving metrics there would mean adding a Gateway socket method, a wire schema, a web route and a contract rule, and a scrape would queue behind the same socket and event loop it is meant to measure. The Gateway opens its own `127.0.0.1` listener instead: one small file, no wire change, and a Gateway that is frozen simply fails the scrape (`up == 0`), which is itself a signal. The listener host is fixed to loopback and has no setting; there is no TLS, auth or CORS. It answers `GET /metrics` only (404 elsewhere, 405 for other methods). The metrics registry is process-wide: its series belong to this Gateway process only.

## Endpoint and series

Libraries: [`prom-client`](https://github.com/siimon/prom-client) renders the text format and supplies the default process metrics. Durations are seconds. No series carries a session ID or model name.

| Metric | Type | Labels | Meaning |
| --- | --- | --- | --- |
| `prk_plugin_hook_sync_seconds` | histogram | `plugin`, `event` | Synchronous time of one Gateway-side plugin event handler call: from the call to the value or promise it returns. `plugin` is the package name (inline extensions: their name; loose files: file name without extension), `event` is the Pi event name. Work after the handler's first `await` is not included. |
| `prk_serialization_seconds` | histogram | `kind` | Synchronous time to serialize one frame sent to the web API process, or to read and parse one history file. |
| `prk_serialization_bytes` | histogram | `kind` | Size of that frame (UTF-8 bytes of the JSON line) or file. |
| `prk_eventloop_delay_seconds` | gauge | `stat` = `p50`, `p99`, `max` | Event-loop delay (`perf_hooks.monitorEventLoopDelay`, 10 ms timer, so an idle loop reads about 0.010) of the **last finished window**. The histogram is read and reset every `metrics.eventLoopWindowMs`, so the gauge forgets a window after one window; a stall shorter than the scrape interval can be missed here. Use the next series for that. |
| `prk_eventloop_window_max_seconds` | histogram | none | The max delay of every finished window. `rate()` of its buckets above 0.2 s counts windows with a stall, whatever the scrape interval. |
| `prk_eventloop_utilization_ratio` | gauge | none | `performance.eventLoopUtilization()` over the last finished window (0..1). |
| `prk_stalls_total` | counter | `kind` | Stall log lines written, by `plugin_hook`, `event_loop` or a serialization kind. |
| `prk_sessions` | gauge | `state` | Sessions held by the Gateway's session collection per state (`idle`, `starting`, `running`, `sleeping`, `unavailable`, `closing`, `closed`); all states are always present. Sleeping sessions that have no record in the collection are not counted. |
| `prk_model_requests_in_flight` | gauge | `provider` | Model requests sent and not finished. |
| `prk_model_request_seconds` | histogram | `provider`, `outcome` = `ok`, `error`, `aborted` | Wall time from the last `context_with_system` hook (just before the request is sent) to the finished assistant message, including streaming. The model name is not a label: provider keeps the cardinality low. |
| `nodejs_eventloop_lag_*`, `nodejs_gc_*`, `nodejs_heap_*`, `nodejs_active_*`, `process_*` | prom-client defaults | | Standard Node.js process metrics (`collectDefaultMetrics`). prom-client resets its `nodejs_eventloop_lag_*` histogram on every scrape, so those values cover the time since the previous scrape; with two scrapers each sees only part of it. |

`kind` values: `frame_response`, `frame_snapshot` (a pushed session snapshot event), `frame_event` (other session events), `frame_collection`, `frame_terminal`, `frame_other` (frames written to the web API process, timed around `JSON.stringify`), and `history_load` (a session JSONL file read and parsed by the Pi SDK at startup, fork, or retarget; `bytes` is the file size). A response is stringified once for its size check in the transport and once more when written; only the write is timed.

## Stall log

When one synchronous section, or one event-loop window, reaches `metrics.stallThresholdMs` (default 200), the Gateway writes one line to stderr (journald under systemd):

```text
[2026-11-27T03:21:09.412Z] WARN Gateway stall kind=plugin_hook plugin="stall-probe" event=before_agent_start sessionId=<id> durationMs=300 bytes=-
[2026-11-27T03:21:09.423Z] WARN Gateway stall kind=event_loop sessionId=- durationMs=337 bytes=- p99Ms=337 windowMs=200
[2026-11-27T03:21:09.730Z] WARN Gateway stall kind=history_load sessionId=<id> durationMs=212 bytes=43012345
```

The timestamp is when the section ended; for `event_loop` it is when the window ended (up to `eventLoopWindowMs` later). To find the culprit of an `event_loop` line, look for `plugin_hook` or serialization lines within about one window before it. The event-loop line has no culprit by itself: a plugin that blocks after an `await`, a regex backtrack or a large `JSON.parse` outside the timed sections shows up only there, with `sessionId=-`.

## Cost

One `performance.now()` pair and one histogram observation per plugin handler call and per frame, a `stat` per history open, and one timer per `eventLoopWindowMs`. Remote (target-side) plugins run in their own host process; the Gateway's forwarding handler for them appears as `plugin="remote:<instance>"`.
