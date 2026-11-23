// Short-lived target resource resolver. Resolves paths only; never evaluates extensions.
import { resolveResources } from "./resolve.mjs";
import { ResourceLimitError } from "./content/create-resource-limit-error.mjs";

try {
  const parts = [];
  for await (const part of process.stdin) parts.push(part);
  const result = await resolveResources(JSON.parse(Buffer.concat(parts).toString("utf8")));
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  if (error instanceof ResourceLimitError) process.stdout.write(JSON.stringify({ validationError: error.message }));
  else {
    process.stderr.write(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
