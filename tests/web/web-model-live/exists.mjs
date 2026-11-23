import { lstat, mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";

export async function exists(ctx, path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
