import { gridKey } from "./layout-constants.ts";
import { saveDocument } from "./save-document.ts";

export const saveGrid = (sessionId: string, grid: unknown) => saveDocument(gridKey(sessionId), grid);
