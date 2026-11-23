import { posix } from "node:path";

export function migrateCacheRoot(document) {
  if (!document?.codemode || typeof document.codemode !== "object" || !Object.hasOwn(document.codemode, "binCacheDir")) return document;
  if (Object.hasOwn(document, "targetCacheRoot")) {
    throw new Error("Migration preflight failed: both codemode.binCacheDir and targetCacheRoot are set; remove the old key manually after choosing the intended root. No files were written.");
  }
  const old = document.codemode.binCacheDir;
  const path = typeof old === "string" ? old.replace(/\/+$/u, "") : "";
  if ((!path.startsWith("/") && !path.startsWith("~/")) || !path.endsWith("/bin") || /\p{Cc}/u.test(path)) {
    throw new Error("Migration preflight failed: codemode.binCacheDir does not end in /bin at an absolute or ~/ target path; refusing to guess targetCacheRoot. Set targetCacheRoot explicitly and remove codemode.binCacheDir manually. No files were written.");
  }
  const codemode = { ...document.codemode };
  delete codemode.binCacheDir;
  return { ...document, codemode, targetCacheRoot: path === "~/bin" ? "~/" : posix.dirname(path) };
}
