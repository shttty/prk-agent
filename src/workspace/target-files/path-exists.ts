import { WireError } from "../../gateway/wire/create-error.ts";
import type { FileOperation } from "./files-types.ts";
import { request } from "./request.ts";

export async function pathExists(op: FileOperation, path: string): Promise<boolean> {
  try { await request(op, "lstat", { path }); return true; }
  catch (error) { if (error instanceof WireError && error.code === "NOT_FOUND") return false; throw error; }
}
