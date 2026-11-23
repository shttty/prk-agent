import { launch } from "./launch-gateway.mjs";
import { bounded } from "./wait-bounded.mjs";
import assert from "node:assert/strict";

export async function cli(entry, root, args, env, expected = 0) {
  const run = launch(entry, root, args, env);
  try { assert.equal(await bounded(run.done, "CLI exit"), expected); return run.stdout; }
  finally { await run.stop(); }
}

