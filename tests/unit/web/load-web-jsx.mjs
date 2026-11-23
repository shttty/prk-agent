// Lets unit tests import web/ components in Node: .jsx goes through the same oxc transform Vite uses, stylesheets load empty.
// Import this first, then load components with a dynamic import (static imports link before these hooks exist).
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { transformSync } from "../../../web/node_modules/rolldown/dist/utils-index.mjs";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "", shortCircuit: true };
    if (!url.endsWith(".jsx")) return nextLoad(url, context);
    const path = fileURLToPath(url);
    const { code, errors } = transformSync(path, readFileSync(path, "utf8"), { jsx: { runtime: "automatic" } });
    if (errors.length) throw new Error(`${path}: ${errors.map((error) => error.message).join("; ")}`);
    return { format: "module", source: code, shortCircuit: true };
  },
});
