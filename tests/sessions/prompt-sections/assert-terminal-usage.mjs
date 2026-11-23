import assert from "node:assert/strict";

export function assertTerminalUsage(request, schemas, declared) {
  const schema = schemas.terminal_textsend;
  assert.equal(schema.name, "terminal_textsend", "Inspect the real gateway.describe terminal schema");
  assert.equal(schema.parameters.type, "object");
  for (const parameter of ["name", "text", "yield_s", "restart", "quiet_notify", "output_brake"]) assert(Object.hasOwn(schema.parameters.properties, parameter), `The actual terminal schema includes ${parameter}`);
  const usage = {
    terminal_textsend: [
      /An existing name receives input; only a new name opens a clean model bash tab visible to the user/u,
      /interactive, long-running or watched commands/u,
      /named terminals for services\/background tasks/u,
      /yield_s to the expected remaining run time/u,
      /do not sleep or poll terminal_read/u,
      /background completion\/quiet events arrive automatically and wake you/u,
      /quiet event only means output has been quiet, not that input is required/u,
      /inspect the last screen lines before deciding/u,
      /\[y\/N\]/u,
      /sudo\/ssh asks for a password/u,
      /user type directly in the visible terminal/u,
      /never route passwords through the model/u,
      /restart=true deletes and recreates the terminal first/u,
      /empty text only restarts/u,
      /service readiness/u,
      /timeout 60 bash -c 'until curl -sf/u,
      /Quiet notifications default to off/u,
      /for long-running background tasks, set quiet_notify=true on creation or call terminal_set \(code mode: gateway\.terminal_set\)/u,
      /keep quiet_notify off for interactive persistent sessions such as ssh/u,
      /Output braking defaults to on \(terminal\.outputBrakeDefault=true\): model-issued commands that exceed terminal\.commandOutputLimitBytes receive Ctrl-C/u,
      /Set output_brake=false on creation or any terminal_textsend call, or use terminal_set\(output_brake=false\), to exempt dev servers and continuously logging processes; exempt commands emit one warning instead of being interrupted/u,
      /After the limit is exceeded, only the configured UTF-8 head and tail are retained with an explicit discarded-byte marker; the discarded middle is permanently lost/u,
      /terminal_read\(command, offset\) pages only that retained head\/marker\/tail text, and total_bytes is its retained UTF-8 size/u,
      /After a running result, end your turn/u,
      /Restarting human terminals is normally prohibited unless the user explicitly requests it/u,
      /timeout_s is an optional hard limit: Ctrl-C, then rebuild if still running, including human terminals/u,
      /use prk_ssh \[ssh options\] <destination> for interactive bash login/u,
      /supports further prk_ssh hops/u,
      /Ordinary ssh stays one running command/u,
      /Non-bash shells and REPLs have no command-level tracking; inspect the screen with terminal_read raw=true/u,
    ],
    terminal_keysend: [
      /C-c=interrupt, C-d=EOF/u,
      /Use terminal_textsend for command text and answers/u,
      /Background events report completion or silence, never an inferred waiting-for-input state/u,
    ],
    terminal_read: [
      /raw=true returns the current visible screen/u,
      /command=<command_id>, offset=<UTF-8 byte offset> pages the retained command output; total_bytes is its retained UTF-8 size/u,
      /After the limit is exceeded, only the configured UTF-8 head and tail are retained with an explicit discarded-byte marker; the discarded middle is permanently lost/u,
      /terminal_read\(command, offset\) pages only that retained head\/marker\/tail text, and total_bytes is its retained UTF-8 size/u,
      /When waiting, set yield_s to the expected remaining run time/u,
      /enable quiet_notify via terminal_textsend or terminal_set and wait for completion\/quiet events/u,
      /do not sleep or poll terminal_read/u,
      /Quiet means output silence, not inferred waiting for input/u,
      /inspect the last screen lines before sending a reply with terminal_textsend/u,
      /Use prk_ssh for tracked remote bash commands/u,
      /remote non-bash shells or REPLs have no command-level tracking, so read the visible screen with raw=true/u,
    ],
    terminal_set: [
      /Omitted switches remain unchanged; returns both quiet_notify and output_brake/u,
      /Output braking defaults to on \(terminal\.outputBrakeDefault=true\): model-issued commands that exceed terminal\.commandOutputLimitBytes receive Ctrl-C/u,
      /Set output_brake=false on creation or any terminal_textsend call, or use terminal_set\(output_brake=false\), to exempt dev servers and continuously logging processes; exempt commands emit one warning instead of being interrupted/u,
      /After the limit is exceeded, only the configured UTF-8 head and tail are retained with an explicit discarded-byte marker; the discarded middle is permanently lost/u,
      /terminal_read\(command, offset\) pages only that retained head\/marker\/tail text, and total_bytes is its retained UTF-8 size/u,
      /Enable quiet_notify=true on long-running background tasks to wake on output silence/u,
      /restarting the quiet ladder from level 0/u,
      /keep quiet_notify=false on ssh or interactive persistent sessions/u,
    ],
    terminal_list: [
      /Returns name, owner, label and marker integration status/u,
      /integration=unavailable means command-level tracking is unavailable/u,
      /use terminal_read with raw=true to inspect the visible screen/u,
    ],
    terminal_close: [
      /Closing human terminals is normally prohibited unless the user explicitly requests it/u,
    ],
  };
  for (const [name, patterns] of Object.entries(usage)) {
    const described = schemas[name];
    assert.equal(described.name, name, "Every description comes from the real gateway.describe result");
    assert.match(described.description, /human/u, `${name} documents human-terminal access`);
    assert(!request.instructions.includes(described.description), `${name}: full descriptions must not be copied into system instructions`);
    for (const pattern of patterns) {
      assert.match(described.description, pattern, `${name}: full usage must be discoverable in the real tool description: ${pattern}`);
      assert.doesNotMatch(request.instructions, pattern, `${name}: full usage must not leak into any system instruction section: ${pattern}`);
    }
    const tool = request.tools.find((tool) => tool.name === name);
    assert.equal(Boolean(tool), declared, `${name} follows the direct/code declaration policy`);
    if (declared) {
      assert.equal(tool.description, described.description, `${name}: the actual declaration and gateway.describe expose the same full usage`);
    } else {
      const summary = described.description.split(/(?<=[.!?])\s/u, 1)[0];
      assert(request.instructions.includes(`${name}: ${summary}`), `${name}: the hidden catalog retains its first-sentence summary`);
    }
  }
}
