import { exists } from "./web-model-live/exists.mjs";
import { waitFor } from "./web-model-live/wait-for.mjs";
import { safeProcessRecord } from "./web-model-live/safe-process-record.mjs";
import { launchProcess } from "./web-model-live/launch-process.mjs";
import { stopProcess } from "./web-model-live/stop-process.mjs";
import { startGateway } from "./web-model-live/start-gateway.mjs";
import { startWeb } from "./web-model-live/start-web.mjs";
import { textOf } from "./web-model-live/text-of.mjs";
import { lastPythonResult } from "./web-model-live/last-python-result.mjs";
import { extractedResult } from "./web-model-live/extracted-result.mjs";
import { sanitizeError } from "./web-model-live/sanitize-error.mjs";
import { writeEvidence } from "./web-model-live/write-evidence.mjs";
import { browserJson } from "./web-model-live/browser-json.mjs";
import { snapshotFor } from "./web-model-live/snapshot-for.mjs";
import { selectSession } from "./web-model-live/select-session.mjs";
import { createSession } from "./web-model-live/create-session.mjs";
import { waitForWorkbenchReady } from "./web-model-live/wait-for-workbench-ready.mjs";
import { sendFromBrowser } from "./web-model-live/send-from-browser.mjs";
import { recoverFromBrowser } from "./web-model-live/recover-from-browser.mjs";
import { cleanupProcesses } from "./web-model-live/cleanup-processes.mjs";
import { kernelIds } from "./web-model-live/kernel-ids.mjs";
import { assembleLiveEnvironment } from "./web-model-live/assemble-live-environment.mjs";
import { checkLiveRecovery } from "./web-model-live/check-live-recovery.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { lstat, mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";

const ctx = {
  exists: (...args) => exists(ctx, ...args),
  waitFor: (...args) => waitFor(ctx, ...args),
  safeProcessRecord: (...args) => safeProcessRecord(ctx, ...args),
  launchProcess: (...args) => launchProcess(ctx, ...args),
  stopProcess: (...args) => stopProcess(ctx, ...args),
  startGateway: (...args) => startGateway(ctx, ...args),
  startWeb: (...args) => startWeb(ctx, ...args),
  textOf: (...args) => textOf(ctx, ...args),
  lastPythonResult: (...args) => lastPythonResult(ctx, ...args),
  extractedResult: (...args) => extractedResult(ctx, ...args),
  sanitizeError: (...args) => sanitizeError(ctx, ...args),
  writeEvidence: (...args) => writeEvidence(ctx, ...args),
  browserJson: (...args) => browserJson(ctx, ...args),
  snapshotFor: (...args) => snapshotFor(ctx, ...args),
  selectSession: (...args) => selectSession(ctx, ...args),
  createSession: (...args) => createSession(ctx, ...args),
  waitForWorkbenchReady: (...args) => waitForWorkbenchReady(ctx, ...args),
  sendFromBrowser: (...args) => sendFromBrowser(ctx, ...args),
  recoverFromBrowser: (...args) => recoverFromBrowser(ctx, ...args),
  cleanupProcesses: (...args) => cleanupProcesses(ctx, ...args),
  kernelIds: (...args) => kernelIds(ctx, ...args),

};
await assembleLiveEnvironment(ctx);
await checkLiveRecovery(ctx);
