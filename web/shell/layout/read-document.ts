import { storage } from "./layout-storage.ts";

export const readDocument = (key: string): unknown => { try { return JSON.parse(storage()?.getItem(key) ?? "null"); } catch { return null; } };
