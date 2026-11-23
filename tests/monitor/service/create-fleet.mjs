import { TARGET_CHANNEL_VERSION } from "../../../src/target-channel/deployment-source/assemble-runtime-source.ts";

const READY = "@@PRK-READY@@";
export function fakeFleet(behaviors = []) {
  const opens = [];
  const open = async (_machine, _signal) => {
    const behavior = behaviors[opens.length] ?? {};
    const pipe = { commands: [], shipped: undefined, closed: false, emit: undefined, crash: undefined, behavior };
    opens.push(pipe);
    if (behavior.failOpen) throw new Error("terminal refused");
    let onData = () => {};
    let onClose = () => {};
    pipe.emit = (message) => onData(`${typeof message === "string" ? message : JSON.stringify(message.t === "hello" || "re" in message ? message : { mod: "monitor", ...message })}\r\n`);
    pipe.crash = (reason = "exited") => { if (!pipe.closed) { pipe.closed = true; onClose(reason); } };
    const transport = {
      write(data) {
        if (pipe.shipped === undefined && !data.startsWith("{")) {
          pipe.shipped = Buffer.from(data.trim(), "base64").toString("utf8");
          if (!behavior.silent) queueMicrotask(() => pipe.emit({ t: "hello", version: behavior.version ?? TARGET_CHANNEL_VERSION, pid: 1 }));
        } else {
          const command = JSON.parse(data);
          const { id, mod, ...body } = command;
          pipe.commands.push(body);
          if (behavior.hold === command.op) return;
          pipe.emit(command.op === "diff"
            ? { re: id, text: `diff of ${command.path}`, truncated: false, error: null }
            : { re: id });
        }
      },
      onData: (listener) => { onData = listener; queueMicrotask(() => onData(`${READY}\n`)); },
      onClose: (listener) => { onClose = listener; },
      async close() { pipe.crash("closed"); },
    };
    return { transport, command: "" };
  };
  return { opens, open };
}

