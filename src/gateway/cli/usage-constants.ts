export const usage = `Usage:
  node src/main.ts gateway --model PROVIDER/MODEL [--socket PATH]
      [--home DIR] [--extension PATH ...] [--no-skills]
  node src/main.ts attach [--home DIR] [--socket PATH]
      [workbench|create|reload-targets|state|messages|watch|watch-sessions|send|cancel|reload|close-session|shutdown]
      [--session ID] [--target NAME] [--label LABEL] [--cwd PATH] [--message TEXT] [--request-id ID]
      [--queue steer|followUp] [--operation-id ID]
  node src/main.ts web [--home DIR] [--socket PATH] [--host PRIVATE_IP] [--port PORT]

The gateway command is the Agent host: it embeds the Pi SDK and owns every
session. Each conversation retains its explicit target and working directory.
Attach and web are clients of that one managed collection and never construct
an Agent or kernel locally. Attach failure exits without starting anything locally.

attach without an action subscribes to --session and accepts input lines; ordinary text sends a message. /state, /messages, /workbench, /reload-targets, /cancel OPERATION_ID, /reload, /close-session, /shutdown and /quit are explicit commands. Ctrl+D/Ctrl+C disconnect only.
create --target INSTANCE_ID [--label LABEL] [--cwd PATH] allocates a session and prints its routing identity. Python is configured on the instance. watch streams one session's snapshot/events; watch-sessions streams collection lifecycle changes.
Reconnect by attaching again: state includes messages and retained outcomes.
Never automatically retry a send after connection loss (outcome may be unknown).
Private local Unix socket; application v1 protocol, NOT official stdio JSONL RPC.
Shutdown acknowledgement means the Gateway host closed, not proof of subsequent
socket cleanup. Check the gateway process exit when that matters.

The web command is a private browser client for an already running Gateway. It
addresses that Gateway through --socket, defaulting to the same private path as
attach, and holds no model, SDK, session or kernel; the default address is
http://127.0.0.1:8787 (configurable); loopback/RFC1918/Tailscale literal IP or 0.0.0.0 binds. Stopping
or updating it interrupts observation only: sessions and Python variables
stay in the Gateway. When the Gateway is unavailable the web service reports
unavailability and never starts a replacement host. No TLS/login: trusted
single-user private access only.
Configuration: --home > PRK_HOME > XDG_CONFIG_HOME/pi-remote-kernel >
~/.config/pi-remote-kernel. config.toml contains global behavior options;
instances.toml contains complete instance definitions (0600). agent/ contains
independent SDK credentials and provider packages. Instance settings
omit saved plugin secrets. Session content is published unchanged.
Browser disconnect/reload retains work; cancel is not rollback; confirmed session
close or Gateway SIGINT/SIGTERM cleans owned target resources, not unrelated services.
See PLAN.md for configuration, prerequisites and current acceptance status.`;
