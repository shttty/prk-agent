import { appendFileSync } from "node:fs";
import { join } from "node:path";

export default function activate() {
  appendFileSync(join(process.env.PRK_HOME, "load-error-loaded.log"), "loaded\n");
  throw new Error("Extension load failed in fixture C");
}
