const live = new Map();
const transpiler = new Bun.Transpiler({ loader: "ts" });
const builtins = new Set(Reflect.ownKeys(globalThis));

function cancel(owner) {
  if (!owner || owner.cancelled) return;
  owner.cancelled = true;
  owner.emit({ kind: "cell_state", state: "stopping" });
  stopResources(owner);
  owner.reply?.reject(new Error("Kernel cell cancelled."));
  owner.reply = undefined;
}

function stopResources(owner) {
  owner.abort.abort();
  for (const resource of owner.resources) resource.stop();
}

async function executeCell({ cellId, id, code }) {
  const owner = { active: true, accepting: true, cancelled: false, requestId: 0, reply: undefined,
    abort: new AbortController(), resources: new Set(),
    emit: (event) => emit({ ...event, cellId }) };
  live.set(cellId, owner);
  const { console, display, stream } = outputFor(owner);
  let outcome = "ok";
  try {
    const source = transpiler.transformSync(`async function runCell(cell, console, gateway, display) {\n"use strict";\n${code}\n}`);
    const run = new Function(`${source}\nreturn runCell;`)();
    owner.emit({ kind: "cell_admitted", re: id });
    const cell = Object.freeze({ ...ownedWaits(owner), spawn: ownedSpawn.bind(undefined, owner, stream), import: importPackage });
    const value = await run(cell, console, gatewayFor(owner), display);
    if (!owner.cancelled && value !== undefined) display(value);
  } catch (error) {
    outcome = "error";
    if (!owner.cancelled) stream("stderr", (error instanceof Error ? error.stack ?? error.message : String(error)) + "\n");
  } finally {
    owner.accepting = false;
    owner.reply?.reject(new Error("Kernel cell ended."));
    owner.reply = undefined;
    stopResources(owner);
    await Promise.allSettled([...owner.resources].map(({ done }) => done));
    owner.active = false;
    live.delete(cellId);
    owner.emit({ kind: "cell_end", re: id, outcome: owner.cancelled ? "aborted" : outcome });
  }
}

function maintainGlobals({ kind, name, cellId, id }) {
  let outcome = "ok";
  if (kind === "clear") {
    for (const key of Reflect.ownKeys(globalThis)) if (!builtins.has(key) && !Reflect.deleteProperty(globalThis, key)) outcome = "error";
  } else if (builtins.has(name) || !Object.hasOwn(globalThis, name) || !Reflect.deleteProperty(globalThis, name)) outcome = "error";
  emit({ kind: "cell_end", cellId, re: id, outcome });
}
