import { join, resolve } from "node:path";

export interface PrkPaths {
  readonly home: string;
  readonly configPath: string;
  readonly instancesPath: string;
  readonly agentDir: string;
}

export function prkPaths(home: string): PrkPaths {
  const resolvedHome = resolve(home);
  return { home: resolvedHome, configPath: join(resolvedHome, "config.toml"), instancesPath: join(resolvedHome, "instances.toml"), agentDir: join(resolvedHome, "agent") };
}
