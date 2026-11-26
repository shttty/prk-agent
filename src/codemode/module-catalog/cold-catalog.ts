import { readFileSync } from "node:fs";
import type { KernelHelper } from "./catalog-types.ts";
import { parseKernelToolCatalog } from "./parse-catalog.ts";

/**
 * Cold-start metadata: a snapshot of the report a real kernel inspects out of the built-in tools, so the prompt before the
 * first cell is byte-identical to the one after it. The kernel's own report replaces this entire list. Regenerate it after
 * changing a built-in tool's signature or docstring: PRK_UPDATE_COLD_CATALOG=1 node --test test/integration/session/kernel-stubs.test.mjs
 */
export const STATIC_KERNEL_HELPERS: readonly KernelHelper[] = parseKernelToolCatalog(JSON.parse(readFileSync(new URL("./cold-catalog.json", import.meta.url), "utf8")));
