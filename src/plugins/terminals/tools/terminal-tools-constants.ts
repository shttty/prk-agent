import { Type } from "typebox";

export const name = Type.Optional(Type.String({ minLength: 1 }));
export const yieldSeconds = Type.Optional(Type.Number({ minimum: 0 }));
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
    description: "List model and human terminals with tracking status; use terminal_read(raw=true) when unavailable.",
  },
  terminal_textsend: {
    name: "terminal_textsend",
    description: "Send verbatim text+Enter to a model or human terminal for interactive/long commands (default main; new name opens bash; prk_ssh tracks remote bash; avoid kernel bash). Events wake you—end turn without polling. Quiet means silence: check screen first; user types sudo/ssh passwords directly.",
  },
  terminal_keysend: {
    name: "terminal_keysend",
    description: "Send raw shortcut keys without Enter; use terminal_textsend for text and answers.",
  },
  terminal_read: {
    name: "terminal_read",
    description: "Read latest command output, visible screen (raw=true for REPLs/untracked shells), or retained page (command+offset; over-limit keeps head+tail) without input.",
  },
  terminal_set: {
    name: "terminal_set",
    description: "Set a terminal's quiet_notify and output_brake switches without input.",
  },
  terminal_close: {
    name: "terminal_close",
    description: "Close a terminal and its processes; close human tabs only on explicit user request.",
  },
};
