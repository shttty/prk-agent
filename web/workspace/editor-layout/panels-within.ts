import { within } from "../file-paths/within.ts";
import type { PathPanel } from "./editor-layout-types.ts";

export const panelsWithin = (panels: readonly PathPanel[], gone: string) => panels.filter((panel) => within(panel.path, gone)).map((panel) => panel.id);
