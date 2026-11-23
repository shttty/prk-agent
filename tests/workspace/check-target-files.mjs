import { createEnvironment } from "./target-files/create-environment.mjs";
import { checkOperations } from "./target-files/check-operations.mjs";
import { checkPaths } from "./target-files/check-paths.mjs";
import { checkLifecycle } from "./target-files/check-lifecycle.mjs";
import { createGateway } from "./target-files/create-gateway.mjs";
import { checkHttp } from "./target-files/check-http.mjs";
import { checkBoundaries } from "./target-files/check-boundaries.mjs";
import { assembleFiles } from "../../src/workspace/target-files/assemble-files.ts";
import { DEFAULT_WORKSPACE_OPTIONS } from "../../src/config/workspace/workspace-options.ts";
import { DEFAULT_REFERENCES_OPTIONS } from "../../src/config/references/references-options.ts";
import { DEFAULT_TARGET_CONNECTION_OPTIONS } from "../../src/config/target-connection/target-connection-options.ts";

const scenario = process.argv[3] ?? "all";
if (!["all", "http-lifecycle", "http", "bounds"].includes(scenario)) throw new Error("Unknown target-files scenario.");
const fixture = await createEnvironment(process.argv[2] ?? "local");
let gateway;
try {
  const options = { environments: fixture.environments, workspace: DEFAULT_WORKSPACE_OPTIONS, references: DEFAULT_REFERENCES_OPTIONS, targetConnection: DEFAULT_TARGET_CONNECTION_OPTIONS };
  const files = assembleFiles(options);
  const context = { target: "owned", sessionId: "owned-files", cwd: fixture.root };
  if (scenario === "all") {
    await checkOperations(files, context);
    await checkPaths(fixture, options, files, context);
  }
  if (scenario === "all" || scenario === "bounds") await checkBoundaries(fixture, options, files, context);
  if (scenario !== "bounds") {
    gateway = await createGateway(fixture, files);
    await checkHttp(gateway);
    if (scenario !== "http") await checkLifecycle(fixture, options, context);
  }
} finally { if (gateway) await gateway.close(); else await fixture.close(); }
