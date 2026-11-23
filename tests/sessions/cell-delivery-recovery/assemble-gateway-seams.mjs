import { assembleHost } from "../../../src/gateway/host/assemble-host.ts";
import { openDerivation } from "../../../src/gateway/derivation/open-derivation.ts";
import { openSessionControl } from "../../../src/gateway/session-control/open-session-control.ts";
import { openMonitor } from "../../../src/gateway/monitoring/open-monitor.ts";
import { initializePrkHome } from "../../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { createSessionHistory } from "../../../src/sessions/history/assemble-history.ts";
import { createSessionCollection } from "../../../src/sessions/collection/assemble-collection.ts";
import { executionTargetFromConfig } from "../../../src/config/execution-target/from-config.ts";
import { DEFAULT_DERIVED_SCHEMAS } from "../../../src/plugins/sessions/default-schema.ts";
import { join } from "node:path";

// Real Gateway methods, history, collection and stable binding; only process/socket startup is omitted.
export async function assembleGatewaySeams(root, config, sessionFactory) {
  const options = parsePrkConfig({ session: { workerTools: "direct", localTools: false }, monitor: { enabled: false }, memory: { review: false } });
  const target = executionTargetFromConfig({ ...config, id: "fixture", label: "Owned crash fixture", tags: [], cwd: root });
  const ctx = assembleHost({ cwd: root, home: root, model: "cell-recovery/visual", targets: [target] }, {}, initializePrkHome(root), options);
  ctx.host.history = await createSessionHistory({ cwd: root, directory: join(root, "history"), limits: options.limits });
  ctx.host.collection = createSessionCollection([target], {
    runtimeDependencies: { cwd: root, agentDir: join(root, "agent") },
    sessionFactory,
  });
  ctx.host.projectDates = new Map();
  ctx.instances.targets = [target];
  ctx.models.modelFallbacks = new Map();
  ctx.sessionHosts.hosts = new Map();
  ctx.sessionHosts.hostBindings = new Map();
  ctx.views.archivedStreamIds = new Map();
  ctx.events.listeners = new Set();
  ctx.capabilities.capabilityDefaults = { capabilities: options.session.capabilities, localTools: options.session.localTools };
  ctx.monitoring.kernelWatches = new Map();
  ctx.asking.askWatches = new Map();
  ctx.lifecycle.runtimeChanges = 0;
  ctx.lifecycle.mutationInProgress = false;
  ctx.lifecycle.sessionIdleTimeoutMs = 0;
  ctx.lifecycle.transitions = new Map();
  ctx.lifecycle.recoveryStates = new Map();
  ctx.derivation.derivationSchemas = DEFAULT_DERIVED_SCHEMAS;
  openDerivation(ctx);
  openSessionControl(ctx);
  openMonitor(ctx);
  return ctx;
}
