import { WireError } from "../wire/create-error.ts";
import { usage } from "./usage-constants.ts";
import { gateway } from "./gateway-command/run-gateway.ts";
import { web } from "./web-command/run-web.ts";
import { attach } from "./attach-command/run-attach.ts";

export async function runCli(args: string[]): Promise<void> {
  if (!args.length || args.includes("--help") || args.includes("-h")) { console.log(usage); if (!args.length) process.exitCode = 2; return; }
  const [command, ...rest] = args;
  if (command === "gateway") { await gateway(rest); return; }
  if (command === "web") { await web(rest); return; }
  if (command !== "attach") throw new WireError("CLI_ERROR","Choose gateway, web or attach explicitly. No local Agent was started.");
  await attach(rest);
}
