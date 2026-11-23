import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { encode } from "../../remote-extensions/codec/encode.mjs";
import { decode } from "../../remote-extensions/codec/decode.mjs";
import type { Registration } from "../../remote-extensions/generation/generation-types.ts";
import LIMITS from "../../target-channel/target-extensions/extension-limits.json" with { type: "json" };
import { readFrames } from "../socket-channel/read-frames.ts";
import { writeFrame } from "../socket-channel/write-frame.ts";
import { object } from "../wire/is-record.ts";

/** Run the existing host's registration loader, never a session or a target deployment. */
export async function probeHostRegistration(cwd: string, name: string, extensions: string[]): Promise<Registration> {
  const directory = await mkdtemp(join(tmpdir(), "prk-host-probe-"));
  const socketPath = join(directory, "control.sock");
  const result = Promise.withResolvers<Registration>();
  const server = createServer();
  server.maxConnections = 1;
  let socket: Socket | undefined;
  let child: ChildProcess | undefined;
  const exited = Promise.withResolvers<void>();
  const timer = setTimeout(() => result.reject(new Error("Host registration preflight timed out; no package change was saved.")), 30_000);
  try {
    const listening = Promise.withResolvers<void>();
    server.once("error", listening.reject);
    server.listen(socketPath, listening.resolve);
    await listening.promise;
    server.on("error", result.reject);
    server.on("connection", (connection) => {
      socket = connection;
      let greeted = false;
      connection.on("error", result.reject);
      connection.on("close", () => result.reject(new Error("Host registration preflight disconnected.")));
      readFrames(connection, LIMITS.MAX_FRAME_BYTES, (frame) => {
        if (!object(frame)) throw new Error("Invalid preflight host frame.");
        if (!greeted) {
          if (frame.pid !== child?.pid || frame.rootPid !== process.pid) throw new Error("Invalid preflight host process identity.");
          greeted = true;
          const sent = writeFrame(connection, { kind: "request", id: "gateway:1", method: "load", payload: encode({
            generation: randomUUID(), nativeTools: false, packages: [{ name, extensions }],
            providerOwnerIds: [], projectExtensions: [], snapshot: { revision: 0, cwd, projectTrusted: false },
          }) }, LIMITS.MAX_FRAME_BYTES, LIMITS.MAX_FRAME_BYTES);
          if (!sent) throw new Error("Host registration preflight exceeds the frame budget.");
          return;
        }
        if (frame.kind === "provider_policy") return; // The load reply carries the same structured errors.
        if (frame.kind !== "reply" || frame.id !== "gateway:1" || Object.hasOwn(frame, "error") === Object.hasOwn(frame, "result")) {
          throw new Error("Unexpected registration-only host frame.");
        }
        if (Object.hasOwn(frame, "error")) { result.reject(decode(frame.error)); return; }
        const registration = decode(frame.result) as Registration;
        if (registration.pid !== child?.pid || registration.rootPid !== process.pid || !Array.isArray(registration.packages)) {
          throw new Error("Invalid preflight host registration.");
        }
        result.resolve(registration);
      }, result.reject);
    });
    child = spawn(process.execPath, [fileURLToPath(new URL("../../remote-extensions/host/start-host.mjs", import.meta.url))], {
      cwd, detached: true, stdio: ["ignore", "ignore", "inherit"],
      env: { ...process.env, PRK_EXT_SOCKET: socketPath, PRK_EXT_SCOPE_PATH: "" },
    });
    child.once("exit", (code, signal) => result.reject(new Error(`Host registration preflight exited (${signal ?? code}).`)));
    child.once("error", result.reject);
    child.once("close", () => exited.resolve());
    return await result.promise;
  } finally {
    clearTimeout(timer);
    // Kill before closing the control socket: disconnect/shutdown would run session_shutdown hooks.
    try { if (child?.pid) process.kill(-child.pid, "SIGKILL"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
    if (child) await exited.promise;
    socket?.destroy();
    const closed = Promise.withResolvers<void>();
    server.close(() => closed.resolve());
    await closed.promise;
    await rm(directory, { recursive: true, force: true });
  }
}
