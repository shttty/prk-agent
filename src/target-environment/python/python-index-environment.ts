import type { ManagedPythonPaths } from "./managed-paths.ts";

export function pythonIndexEnvironment(index: string | undefined, paths?: ManagedPythonPaths): Record<string, string> {
  return {
    UV_NO_CONFIG: "1",
    UV_PYTHON_DOWNLOADS: "never",
    UV_INDEX_URL: index ?? "",
    UV_DEFAULT_INDEX: index ?? "",
    UV_NO_INDEX: index ? "false" : "1",
    UV_OFFLINE: index ? "false" : "1",
    ...(paths ? { PRK_UV_EXECUTABLE: paths.uv, UV_CACHE_DIR: paths.cache, UV_PYTHON_INSTALL_DIR: paths.installDir } : {}),
  };
}
