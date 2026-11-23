import { writeFile } from "node:fs/promises";
import { createTarget } from "./fixtures/create-target.mjs";
import { createWebFixture } from "./fixtures/create-web-fixture.mjs";

const target = await createTarget("local");
let fixture, restarting;
const stopped = Promise.withResolvers();
process.once("SIGTERM", stopped.resolve);
process.once("SIGINT", stopped.resolve);
try {
  fixture = await createWebFixture(target);
  const publish = async () => {
    const metadata = { pid: process.pid, url: fixture.url, apiUrl: fixture.apiUrl, sessionId: fixture.sessionId, home: target.home, socket: fixture.socket, python: target.python, restartWebSignal: "SIGUSR1" };
    if (process.env.S4_WEB_METADATA) await writeFile(process.env.S4_WEB_METADATA, JSON.stringify(metadata, null, 2));
    console.log("S4_WEB_READY " + JSON.stringify(metadata));
  };
  process.on("SIGUSR1", () => {
    restarting ??= fixture.restartWeb().then(publish).catch((error) => console.error("S4_WEB_RESTART_FAILED", error)).finally(() => { restarting = undefined; });
  });
  await publish();
  await stopped.promise;
} finally { await restarting; await fixture?.close(); await target.close(); }
