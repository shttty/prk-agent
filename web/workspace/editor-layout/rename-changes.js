import { within } from "../file-paths/within.js";
import { remapPath } from "../file-paths/remap-path.js";
export const renameChanges = (panels, from, to) => panels.filter((panel) => within(panel.path, from)).map((panel) => ({ id: panel.id, path: remapPath(panel.path, from, to) }));
