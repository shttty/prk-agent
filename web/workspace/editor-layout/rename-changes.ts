import { within } from "../file-paths/within.ts";
import { remapPath } from "../file-paths/remap-path.ts";
import type { PathPanel } from "./editor-layout-types.ts";

export const renameChanges = (panels: readonly PathPanel[], from: string, to: string) => panels.filter((panel) => within(panel.path, from)).map((panel) => ({ id: panel.id, path: remapPath(panel.path, from, to) }));
