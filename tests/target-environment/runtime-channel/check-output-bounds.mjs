import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { openProcessTransport } from "../../../src/target-channel/process-transport/open.ts";
import { createScenario } from "./create-scenario.mjs";
import { createOwnedRuntime } from "./create-owned-runtime.mjs";
import { awaitTargetFile } from "./await-target-file.mjs";
import { observeProcesses } from "./observe-processes.mjs";

export async function checkOutputBounds(mode) {
  const scenario = await createScenario(mode);
  const { fixture, python, id } = scenario;
  const evidence = [];
  try {
    const guard = await fixture.acquire(id);
    for (const kind of ["stdout", "stderr", "utf8"]) {
      const record = "with open(prefix+'.json','w') as output:\n    json.dump(record,output)\n";
      const behavior = kind === "stdout"
        ? "sys.stdout.buffer.write(b'x'*1048577);sys.stdout.buffer.flush();time.sleep(300)"
        : kind === "stderr"
          ? "sys.stderr.buffer.write(b'PREFIX_MARK'+b'z'*131072+b'TAIL_MARK');sys.stderr.buffer.flush();time.sleep(0.05);sys.exit(7)"
          : "for byte in b'\\xce\\xb2\\xf0\\x9f\\x99\\x82\\r\\n':\n    os.write(1,bytes([byte]));time.sleep(0.005)";
      const owned = await createOwnedRuntime(fixture, python, kind, { beforeExec: record + behavior });
      let transport;
      let reason;
      let timer;
      try {
        transport = await openProcessTransport(await fixture.acquire(id), owned.executable, fixture.root, new AbortController().signal);
        if (kind === "utf8") {
          await delay(100);
          let output = "";
          transport.onData((text) => { output += text; });
          for (let attempt = 0; !output.includes("@@PRK-READY@@\n") && attempt < 100; attempt++) await delay(20);
          assert.equal(output, "β🙂\r\n@@PRK-READY@@\n", "Pipes preserve UTF-8 and CRLF without PTY rewriting");
          evidence.push({ kind, bytes: Buffer.byteLength(output), signature: owned.signature });
        } else {
          const ended = Promise.withResolvers();
          timer = setTimeout(() => ended.reject(new Error("Bounded output did not close its owned pipe")), 5000);
          transport.onClose(ended.resolve);
          reason = await ended.promise;
        }
      } catch (error) {
        if (kind === "utf8") throw error;
        reason = error.message;
      } finally {
        clearTimeout(timer);
        await transport?.close();
      }
      if (kind === "stderr") {
        assert.match(reason, /TAIL_MARK/u);
        assert.doesNotMatch(reason, /PREFIX_MARK/u);
        assert.ok(Buffer.byteLength(reason) <= 65700, "Diagnostic stderr tail is capped at 64 KiB");
      }
      const identity = JSON.parse(await awaitTargetFile(fixture, `${owned.prefix}.json`));
      assert.equal(identity.signature, owned.signature);
      assert.equal(identity.pid, identity.pgid);
      await observeProcesses(fixture, [identity.pid, identity.child], { gone: true });
      assert.equal(guard.signal.aborted, false);
      assert.equal((await guard.connection.info()).pid, guard.info.pid);
      if (kind !== "utf8") evidence.push({ kind, identity, diagnosticBytes: Buffer.byteLength(reason) });
    }
    await guard.release();
    await observeProcesses(fixture, [guard.info.pid], { gone: true });
    const missing = await fixture.acquire(id);
    await assert.rejects(
      openProcessTransport(missing, `${fixture.root}/missing-interpreter`, fixture.root, new AbortController().signal),
      (error) => error.code === "spawn_error",
      "Last-lease cleanup must not replace the actual interpreter startup failure",
    );
    await observeProcesses(fixture, [missing.info.pid], { gone: true });
    evidence.push({ kind: "missing-interpreter", code: "spawn_error" });
    return { scenario: "output-bounds", daemon: guard.info.pid, generation: guard.generation, evidence };
  } finally { await scenario.close(); }
}
