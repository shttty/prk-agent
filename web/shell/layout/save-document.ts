import { storage } from "./layout-storage.ts";

export const saveDocument = (key: string, value: unknown) => { try { storage()?.setItem(key, JSON.stringify(value)); } catch { /* private mode: this tab only */ } };
