import { isAbsolute, resolve } from "node:path";
import { parseInstanceConfig } from "../execution-target/parse-instance-config.ts";
import { parseDerivationConfig } from "../derivation/parse-config.ts";
import { DEFAULT_SESSION_OPTIONS } from "../session/session-options.ts";
import { parseTraceOptions } from "../trace/parse-trace-options.ts";
import { parseGlobalKernelOptions } from "../kernel/parse-global-kernel-options.ts";
import { DEFAULT_NAMESPACE_OPTIONS } from "../namespace/namespace-options.ts";
import { DEFAULT_GATEWAY_OPTIONS } from "../gateway/gateway-options.ts";
import { DEFAULT_HTTP_OPTIONS } from "../http/http-options.ts";
import { DEFAULT_LIMITS_OPTIONS } from "../limits/limits-options.ts";
import { DEFAULT_CODEMODE_OPTIONS } from "../codemode/codemode-options.ts";
import { parseToolsOptions } from "../tools/parse-tools-options.ts";
import { parseSkillsOptions } from "../skills/parse-skills-options.ts";
import { parseExtensionFilters } from "../extensions/parse-extension-filters.ts";
import { DEFAULT_MONITOR_OPTIONS } from "../monitor/monitor-options.ts";
import { DEFAULT_METRICS_OPTIONS } from "../metrics/metrics-options.ts";
import { DEFAULT_WORKSPACE_OPTIONS } from "../workspace/workspace-options.ts";
import { DEFAULT_LEARNING_OPTIONS } from "../learning/learning-options.ts";
import { DEFAULT_MEMORY_OPTIONS } from "../memory/memory-options.ts";
import { parseTerminalOptions } from "../terminal/parse-terminal-options.ts";
import { DEFAULT_ARTIFACTS_OPTIONS } from "../artifacts/artifacts-options.ts";
import { DEFAULT_REMOTE_HOST_OPTIONS } from "../remote-host/remote-host-options.ts";
import { validateWebAddress } from "../../http/request/validate-web-address.ts";
import { parseKernelModuleConfig } from "../../codemode/module-payload/parse-kernel-module-config.ts";
import type { PrkConfig } from "./document-types.ts";
import { groupOptions } from "./validation/group-options.ts";
import { parseProcessWindowLimits } from "../../target-environment/process-window/parse-limits.ts";
import { DEFAULT_REFERENCES_OPTIONS } from "../references/references-options.ts";
import { DEFAULT_TARGET_CONNECTION_OPTIONS } from "../target-connection/target-connection-options.ts";
import { isPythonIndexUrl } from "../python-index/is-python-index-url.ts";
import { DEFAULT_TARGET_CACHE_ROOT } from "../target-cache/target-cache-options.ts";

export function parsePrkConfig(value: unknown, instanceDocument: unknown = { instances: [] }): PrkConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid PRK configuration: root must be an object.");
  const document = value as Record<string, unknown>;
  const fields = ["derivation", "session", "codemode", "trace", "kernel", "namespace", "gateway", "http", "limits", "tools", "skills", "learning", "memory", "extensions", "workspace", "terminal", "monitor", "metrics", "artifacts", "remoteHost", "toolContent", "kernelTools", "processWindow", "references", "targetConnection", "pythonIndexUrl", "targetCacheRoot"];
  if (Object.keys(document).some((key) => !fields.includes(key))) throw new Error("Invalid PRK configuration: root contains an unsupported field.");
  if (document.pythonIndexUrl !== undefined && !isPythonIndexUrl(document.pythonIndexUrl)) {
    throw new Error("Invalid PRK configuration: pythonIndexUrl must be an HTTP(S) URL without credentials, query or fragment.");
  }
  if (!instanceDocument || typeof instanceDocument !== "object" || Array.isArray(instanceDocument)
    || Object.keys(instanceDocument).some((key) => key !== "instances")) throw new Error("Invalid instance configuration: instances.toml must contain only an instances array.");
  const instanceValues = (instanceDocument as Record<string, unknown>).instances;
  const limits = groupOptions("limits", document.limits, DEFAULT_LIMITS_OPTIONS);
  const http = groupOptions("http", document.http, DEFAULT_HTTP_OPTIONS);
  validateWebAddress(http.host, http.port);
  const gateway = groupOptions("gateway", document.gateway, DEFAULT_GATEWAY_OPTIONS);
  if (gateway.socketPath.length === 0 || !isAbsolute(gateway.socketPath) || /\p{Cc}/u.test(gateway.socketPath)
    || Buffer.byteLength(resolve(gateway.socketPath)) > limits.socketPathBytes) {
    throw new Error("Invalid PRK configuration: gateway.socketPath must be an absolute Unix socket path within limits.socketPathBytes.");
  }
  Object.assign(gateway, { socketPath: resolve(gateway.socketPath) });
  // Unit names go to systemctl as an argv element (no shell); a leading dash would read as an option.
  if (gateway.systemdUnit.length > 0 && !/^[A-Za-z0-9:_.@\\][A-Za-z0-9:_.@\\-]*$/u.test(gateway.systemdUnit)) {
    throw new Error("Invalid PRK configuration: gateway.systemdUnit must be empty or a systemd unit name (letters, digits and : _ . @ \\ -; not starting with -).");
  }
  const session = groupOptions("session", document.session, DEFAULT_SESSION_OPTIONS);
  if (session.historyDir.trim().length === 0 || /\p{Cc}/u.test(session.historyDir)) {
    throw new Error("Invalid PRK configuration: session.historyDir must be a non-empty path (relative paths resolve against the PRK home).");
  }
  const kernel = parseGlobalKernelOptions(document.kernel);
  if (document.codemode && typeof document.codemode === "object" && Object.hasOwn(document.codemode, "binCacheDir")) {
    throw new Error("Invalid PRK configuration: codemode.binCacheDir was removed; stop Gateway and run node scripts/migrate-config-toml.mjs --home /absolute/prk-home to migrate it to targetCacheRoot offline.");
  }
  const codemode = groupOptions("codemode", document.codemode, DEFAULT_CODEMODE_OPTIONS);
  const targetCacheRoot = document.targetCacheRoot === undefined ? DEFAULT_TARGET_CACHE_ROOT : document.targetCacheRoot;
  if (typeof targetCacheRoot !== "string" || (!targetCacheRoot.startsWith("/") && !targetCacheRoot.startsWith("~/")) || /\p{Cc}/u.test(targetCacheRoot)) {
    throw new Error("Invalid PRK configuration: targetCacheRoot must be an absolute target path or ~/ path without control characters.");
  }
  return {
    ...(document.pythonIndexUrl === undefined ? {} : { pythonIndexUrl: document.pythonIndexUrl }),
    targetCacheRoot,
    instances: parseInstanceConfig(instanceValues, limits, kernel),
    derivation: parseDerivationConfig(document),
    session,
    trace: parseTraceOptions(document.trace),
    codemode,
    kernel,
    namespace: groupOptions("namespace", document.namespace, DEFAULT_NAMESPACE_OPTIONS),
    gateway,
    http,
    limits,
    tools: parseToolsOptions(document.tools),
    skills: parseSkillsOptions(document.skills),
    learning: groupOptions("learning", document.learning, DEFAULT_LEARNING_OPTIONS),
    memory: groupOptions("memory", document.memory, DEFAULT_MEMORY_OPTIONS),
    extensions: parseExtensionFilters(document.extensions),
    workspace: groupOptions("workspace", document.workspace, DEFAULT_WORKSPACE_OPTIONS),
    terminal: parseTerminalOptions(document.terminal),
    monitor: groupOptions("monitor", document.monitor, DEFAULT_MONITOR_OPTIONS),
    metrics: groupOptions("metrics", document.metrics, DEFAULT_METRICS_OPTIONS),
    artifacts: groupOptions("artifacts", document.artifacts, DEFAULT_ARTIFACTS_OPTIONS),
    remoteHost: groupOptions("remoteHost", document.remoteHost, DEFAULT_REMOTE_HOST_OPTIONS),
    processWindow: parseProcessWindowLimits(document.processWindow),
    references: groupOptions("references", document.references, DEFAULT_REFERENCES_OPTIONS),
    targetConnection: groupOptions("targetConnection", document.targetConnection, DEFAULT_TARGET_CONNECTION_OPTIONS),
    toolContent: groupOptions("toolContent", document.toolContent, { maxBytes: 8192, maxLines: 40 }),
    kernelTools: parseKernelModuleConfig(document.kernelTools),
  };
}
