import { readdir } from "node:fs/promises";

export async function entries(directory: string) {
  try { return await readdir(directory, { withFileTypes: true }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
