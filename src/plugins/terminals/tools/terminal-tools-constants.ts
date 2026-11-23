import { Type } from "typebox";

export const name = Type.Optional(Type.String({ minLength: 1, description: "Independent terminal name; defaults to main." }));
export const yieldSeconds = Type.Optional(Type.Number({ minimum: 0, description: "Maximum foreground wait in seconds. Completion returns early; running commands continue in the background and send events. Do not poll." }));
const integrationSchema = Type.Union([Type.Literal("ready"), Type.Literal("unavailable")]);
export const listResultSchema = Type.Object({
  terminals: Type.Array(Type.Object({
    name: Type.String(), owner: Type.Union([Type.Literal("model"), Type.Literal("human")]),
    label: Type.String(), integration: integrationSchema, note: Type.Optional(Type.String()),
  }, { additionalProperties: false })),
}, { additionalProperties: false });
export const resultSchema = Type.Object({
  name: Type.String(), command_id: Type.Union([Type.String(), Type.Null()]), command: Type.String(),
  status: Type.Union([Type.Literal("done"), Type.Literal("running"), Type.Literal("killed"), Type.Literal("unavailable")]),
  integration: Type.Optional(integrationSchema), note: Type.Optional(Type.String()),
  exit_code: Type.Union([Type.Number(), Type.Null()]), cwd: Type.String(), duration_ms: Type.Number(),
  output: Type.String(), truncated: Type.Boolean(), total_bytes: Type.Number(),
});

export const TERMINAL_TOOL_METADATA = {
  terminal_list: {
    name: "terminal_list",
    description: "List every terminal in this session, including human-owned tabs (code mode: gateway.terminal_list). Returns name, owner, label and marker integration status. integration=unavailable means command-level tracking is unavailable; use terminal_read with raw=true to inspect the visible screen.",
  },
  terminal_textsend: {
    name: "terminal_textsend",
    description: "Send text and Enter to a named target terminal, including human-owned tabs. An existing name receives input; only a new name opens a clean model bash tab visible to the user. One call sends one complete input: multi-line scripts, heredocs, tabs and ! arrive verbatim without base64 or escaping. Use either terminal tools or kernel bash(), not both. Use this instead of bash for interactive, long-running or watched commands (code mode: gateway.terminal_textsend). Use named terminals for services/background tasks. Send prompt replies such as [y/N] with text. Set yield_s to the expected remaining run time; do not sleep or poll terminal_read for completion: background completion/quiet events arrive automatically and wake you. Quiet notifications default to off; for long-running background tasks, set quiet_notify=true on creation or call terminal_set (code mode: gateway.terminal_set) so silence/completion events wake you—never sleep to block or poll terminal_read; keep quiet_notify off for interactive persistent sessions such as ssh. Output braking defaults to on (terminal.outputBrakeDefault=true): model-issued commands that exceed terminal.commandOutputLimitBytes receive Ctrl-C. Set output_brake=false on creation or any terminal_textsend call, or use terminal_set(output_brake=false), to exempt dev servers and continuously logging processes; exempt commands emit one warning instead of being interrupted. After the limit is exceeded, only the configured UTF-8 head and tail are retained with an explicit discarded-byte marker; the discarded middle is permanently lost. terminal_read(command, offset) pages only that retained head/marker/tail text, and total_bytes is its retained UTF-8 size. After a running result, end your turn. A quiet event only means output has been quiet, not that input is required; inspect the last screen lines before deciding. If sudo/ssh asks for a password, stop and have the user type directly in the visible terminal; never route passwords through the model. restart=true deletes and recreates the terminal first; use it when the environment is dirty or Ctrl-C cannot recover it, and empty text only restarts. Restarting human terminals is normally prohibited unless the user explicitly requests it. timeout_s is an optional hard limit: Ctrl-C, then rebuild if still running, including human terminals. To wait for service readiness, use another named terminal running timeout 60 bash -c 'until curl -sf URL; do sleep 1; done' and wait for its completion. To run commands remotely with command-level tracking, use prk_ssh [ssh options] <destination> for interactive bash login; it also supports further prk_ssh hops. Ordinary ssh stays one running command. Non-bash shells and REPLs have no command-level tracking; inspect the screen with terminal_read raw=true.",
  },
  terminal_keysend: {
    name: "terminal_keysend",
    description: "Send shortcut keys to a model or human terminal without appending Enter (code mode: gateway.terminal_keysend). Keys: C-c=interrupt, C-d=EOF, C-z=suspend, Up/Down=history, Tab=completion, Esc=escape, Enter=return, q=quit a pager. Use terminal_textsend for command text and answers. Background events report completion or silence, never an inferred waiting-for-input state.",
  },
  terminal_read: {
    name: "terminal_read",
    description: "Read the current/latest command from a model or human terminal without sending input (code mode: gateway.terminal_read). raw=true returns the current visible screen. command=<command_id>, offset=<UTF-8 byte offset> pages the retained command output; total_bytes is its retained UTF-8 size. After the limit is exceeded, only the configured UTF-8 head and tail are retained with an explicit discarded-byte marker; the discarded middle is permanently lost. terminal_read(command, offset) pages only that retained head/marker/tail text, and total_bytes is its retained UTF-8 size. When waiting, set yield_s to the expected remaining run time; for long background tasks enable quiet_notify via terminal_textsend or terminal_set and wait for completion/quiet events—do not sleep or poll terminal_read. Quiet means output silence, not inferred waiting for input; inspect the last screen lines before sending a reply with terminal_textsend. Use prk_ssh for tracked remote bash commands; remote non-bash shells or REPLs have no command-level tracking, so read the visible screen with raw=true.",
  },
  terminal_set: {
    name: "terminal_set",
    description: "Configure a model or human terminal's quiet_notify and output_brake switches without sending input (code mode: gateway.terminal_set). Omitted switches remain unchanged; returns both quiet_notify and output_brake. Enable quiet_notify=true on long-running background tasks to wake on output silence (restarting the quiet ladder from level 0); keep quiet_notify=false on ssh or interactive persistent sessions. Output braking defaults to on (terminal.outputBrakeDefault=true): model-issued commands that exceed terminal.commandOutputLimitBytes receive Ctrl-C. Set output_brake=false on creation or any terminal_textsend call, or use terminal_set(output_brake=false), to exempt dev servers and continuously logging processes; exempt commands emit one warning instead of being interrupted. After the limit is exceeded, only the configured UTF-8 head and tail are retained with an explicit discarded-byte marker; the discarded middle is permanently lost. terminal_read(command, offset) pages only that retained head/marker/tail text, and total_bytes is its retained UTF-8 size.",
  },
  terminal_close: { name: "terminal_close", description: "Close the named terminal and its processes (code mode: gateway.terminal_close). Closing human terminals is normally prohibited unless the user explicitly requests it." },
};
