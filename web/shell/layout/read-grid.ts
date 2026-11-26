import { gridKey } from "./layout-constants.ts";
import { readDocument } from "./read-document.ts";

export const readGrid = (sessionId: string) => readDocument(gridKey(sessionId));
