import { relative, sep } from "node:path";

export function within(directory: string, file: string): boolean {
  const local = relative(directory, file);
  return local === "" || (local !== ".." && !local.startsWith(`..${sep}`) && !local.startsWith(sep));
}
