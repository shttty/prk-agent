import type { KernelHelper } from "./catalog-types.ts";

// Cold-start metadata only. The kernel's inspect report replaces this entire list.
// Legacy helpers remain here until each is migrated to an independent module.
export const STATIC_KERNEL_HELPERS: readonly KernelHelper[] = [
  { name: "bash", signature: "(command, timeout=None)", description: "Run bash; return exit_code, raw stdout/stderr, duration_ms, timed_out and truncated=False." },
  { name: "ls", signature: "(path='.', offset=1, limit=500)", description: "List direct children, including hidden names and directory / suffixes; mapping entries/total/truncated/next_offset, max 2000 / 50KB; print to view." },
  { name: "phase", signature: "(title)", description: "Label the current cell's next phase; does not execute a Gateway operation." },
  { name: "glob", signature: "(pattern, path='.', hidden=False, gitignore=True, limit=100)", description: "List files via tool_bin('rg'): sorted relative paths, max 1000 files / 50KB; print the mapping result." },
  { name: "tool", signature: "(function=None, *, persist=False, reason=None)", description: '@tool(persist=True, reason="future tasks") saves inspected functions to shared staging.' },
  { name: "library_sync", signature: "()", description: "Refresh active saved tools, signatures, docstrings and target import availability." },
  { name: "tool_bin", signature: "(name)", description: "Absolute path on this target of the Gateway-distributed Linux CLI name; sent and sha256-cached on first use." },
  { name: "disk_usage", signature: "(path='.', depth=1, limit=50, apparent=False)", description: "dust on this target: {path, bytes, children:[...]} largest first down to depth; limit caps listed entries." },
].map((helper) => ({ source: "PRK kernel prelude", available: true, ...helper }));
