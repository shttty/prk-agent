import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, statSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import type { PluginConfigContext, PluginConfigView } from "../config-types.ts";
import { invalid } from "../reject-invalid-config.ts";
import { readSchema } from "../descriptors/read-schema.ts";
import { readValues } from "./read-values.ts";
import { secretKeys } from "../masking/find-secret-keys.ts";
import { setPath } from "./set-key.ts";
import { MASK } from "../config-constants.ts";
import { get } from "../get.ts";

/** Change exactly the given keys in the plugin's file (created when missing), atomically; other fields are kept. */
export function write(ctx: PluginConfigContext, provider: string, changes: readonly { key: string; value: unknown }[]): PluginConfigView {
  const schema = readSchema(ctx, provider) ?? invalid("Provider has no config.");
  if (!changes.length) invalid("No changes to write.");
  const { values } = readValues(ctx, schema.file);
  for (const { key, value } of changes) {
    if ((value === "" || value === MASK) && secretKeys(ctx, schema.sections, values).includes(key)) continue;
    setPath(values, key, value);
  }
  mkdirSync(dirname(schema.file), { recursive: true });
  const temporary = `${schema.file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(values, null, 2)}\n`, { mode: existsSync(schema.file) ? statSync(schema.file).mode & 0o777 : 0o600 });
    renameSync(temporary, schema.file);
  } finally { rmSync(temporary, { force: true }); }
  return get(ctx, provider);
}
