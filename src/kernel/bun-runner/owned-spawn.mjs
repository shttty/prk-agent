import { readFileSync } from "node:fs";

function ownedSpawn(owner, stream, argv, { cwd, env, stdin = "ignore" } = {}) {
  owner.abort.signal.throwIfAborted();
  if (!owner.accepting) throw new Error("Kernel cell ended.");
  // In a scope, private sessions still belong to generation cleanup. Without a
  // scope, keep children in the runner's PGID rather than create an orphan group.
  const detached = scoped === "true";
  const child = Bun.spawn(argv, { cwd, env, stdin, stdout: "pipe", stderr: "pipe", detached });
  const identity = detached ? privateGroupLeader(child.pid) : undefined;
  let stopping = false;
  const stdout = drainPipe(child.stdout, (text) => stream("stdout", text));
  const stderr = drainPipe(child.stderr, (text) => stream("stderr", text));
  const done = Promise.all([child.exited, stdout.done, stderr.done]);
  hold(owner, done, () => {
    if (stopping) return;
    stopping = true;
    if (identity !== undefined && privateGroupLeader(child.pid) === identity) {
      try { process.kill(-child.pid, "SIGKILL"); }
      catch (error) { if (error.code !== "ESRCH") throw error; }
    }
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  });
  return Object.freeze({ pid: child.pid, exited: child.exited, stdin: child.stdin, stdout: stdout.readable, stderr: stderr.readable });
}

function privateGroupLeader(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    if (Number(fields[1]) === process.pid && Number(fields[2]) === pid && Number(fields[3]) === pid) return fields[19];
  } catch (error) { if (error.code !== "ENOENT" && error.code !== "ESRCH") throw error; }
}

function drainPipe(pipe, output) {
  let sink, buffering = true;
  const readable = new ReadableStream({
    start(controller) { sink = controller; },
    cancel() { buffering = false; }, // The owned drain continues to EOF.
  }, new ByteLengthQueuingStrategy({ highWaterMark: Math.min(maxMessageBytes, 256 * 1024) }));
  const done = (async () => {
    const decoder = new StringDecoder("utf8");
    try {
      for await (const bytes of pipe) {
        output(decoder.write(bytes));
        if (!buffering) continue;
        if (sink.desiredSize < bytes.byteLength) {
          buffering = false;
          sink.error(new Error("Owned subprocess pipe buffer exceeded; cell output capture continues."));
        } else sink.enqueue(bytes);
      }
      output(decoder.end());
      if (buffering) sink.close();
    } catch (error) {
      if (buffering) sink.error(error);
      throw error;
    }
  })();
  return { readable, done };
}
