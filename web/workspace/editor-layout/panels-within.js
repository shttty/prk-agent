import { within } from "../file-paths/within.js";
export const panelsWithin = (panels, gone) => panels.filter((panel) => within(panel.path, gone)).map((panel) => panel.id);
