import { run } from "../archive/run-archive-command.ts";

export async function npm(args: string[], cwd: string): Promise<string> {
  const result = await run("npm", args, {
    cwd, env: { ...process.env, NODE_ENV: "development" }, maxBuffer: 4 * 1024 * 1024,
  });
  return result.stdout;
}
