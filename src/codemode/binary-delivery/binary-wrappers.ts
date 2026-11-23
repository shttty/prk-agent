/** Built-in Python wrappers (src/codemode/kernel-prelude/disk-usage/read_disk_usage.py), keyed by the CLI they need. */
export const WRAPPERS: Readonly<Record<string, string>> = {
  dust: "disk_usage(path='.', depth=1, limit=50, apparent=False) -> {path,bytes,children:[...]} largest first",
};
