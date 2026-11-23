import { DEFAULT_LIMITS_OPTIONS } from "../limits/limits-options.ts";
import type { LimitsOptions } from "../limits/limits-options.ts";
import { DEFAULT_KERNEL_OPTIONS } from "../kernel/kernel-options.ts";
import type { KernelOptions } from "../kernel/kernel-options.ts";
import { parseKernelOptions } from "../kernel/parse-kernel-options.ts";
import { parseCustomMetrics } from "../custom-metrics/parse-custom-metrics.ts";
import { isCapabilitySwitches } from "../capabilities/is-capability-switches.ts";
import { isExecutionTimeoutMs, type KernelExecutionPolicy } from "../../kernel/kernel-options.ts";
import type { ExecutionTarget } from "./target-types.ts";
import { TARGET_FIELDS } from "./validation/target-constants.ts";
import { isAbsoluteCwd } from "./is-absolute-cwd.ts";
import { invalid } from "./validation/reject-invalid-target.ts";
import { nonEmptyString } from "./validation/non-empty-string.ts";
import { normalizeLabel } from "./labels/normalize-label.ts";
import { normalizeTags } from "./labels/normalize-tags.ts";
import { isPythonIndexUrl } from "../python-index/is-python-index-url.ts";
import { isBunRegistry } from "./validation/bun-package-options.ts";

export function parseInstanceConfig(value: unknown, limits: LimitsOptions = DEFAULT_LIMITS_OPTIONS, kernelDefaults: KernelOptions & Partial<KernelExecutionPolicy> = DEFAULT_KERNEL_OPTIONS): ExecutionTarget[] {
  if (!Array.isArray(value)) invalid("instances must be an array");
  const { asyncExecution: _async, reminderLadderMs: _ladder, defaultCellMode: _mode, maxActiveCells: _slots,
    interruptTimeoutMs: _grace, interruptRestart: _restart, maxTimerWaitMs: _timer, forkserverPreload: _preload, ...runnerDefaults } = kernelDefaults;

  const ids = new Set<string>();
  const labels = new Map<string, string>();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) invalid(`instance ${index} must be an object`);
    if (Object.hasOwn(entry, "name")) invalid(`instance ${index}: replace the removed name field with id`);
    if (Object.keys(entry).some((key) => !(TARGET_FIELDS as readonly string[]).includes(key))) {
      invalid(`instance ${index} contains an unsupported field`);
    }
    if (!nonEmptyString(entry.id)) invalid(`instance ${index} has an invalid id`);
    const id = entry.id.trim();
    if (id.length > limits.identityChars) invalid(`instance ${index} has an invalid id; use at most ${limits.identityChars} characters`);
    if (ids.has(id)) invalid("instance ids must be unique");
    ids.add(id);

    const label = normalizeLabel(entry.label, index, limits);
    const labelKey = label.toLocaleLowerCase();
    const previousLabel = labels.get(labelKey);
    if (previousLabel !== undefined) invalid(`instance labels must be unique; ${JSON.stringify(label)} conflicts with ${JSON.stringify(previousLabel)}`);
    labels.set(labelKey, label);
    if (entry.local !== undefined && typeof entry.local !== "boolean") invalid(`instance ${index} has an invalid local marker; use a boolean`);

    if (entry.sshCommand !== undefined && (entry.local === true || typeof entry.sshCommand !== "string"
      || !entry.sshCommand.trim() || entry.sshCommand.length > limits.sshCommandChars || /\p{Cc}/u.test(entry.sshCommand))) {
      invalid(`instance ${index} requires a non-empty remote sshCommand without control characters`);
    }
    const cwd: unknown = entry.cwd;
    if (!nonEmptyString(cwd) || cwd.length > limits.cwdChars || cwd.includes("\0") || /\p{Cc}/u.test(cwd) || !isAbsoluteCwd(cwd)) {
      invalid(`instance ${index} requires cwd, an absolute path starting with / without control characters`);
    }
    if (entry.python !== undefined && (typeof entry.python !== "string" || !isAbsoluteCwd(entry.python)
      || entry.python.length > limits.cwdChars || /\p{Cc}/u.test(entry.python))) {
      invalid(`instance ${index} python must be an absolute executable path without control characters`);
    }
    if (entry.pythonIndexUrl !== undefined && !isPythonIndexUrl(entry.pythonIndexUrl)) {
      invalid(`instance ${index} pythonIndexUrl must be an HTTP(S) URL without credentials, query or fragment`);
    }
    if (entry.bunPackages !== undefined && !isBunRegistry(entry.bunPackages)) invalid(`instance ${index} bunPackages requires a registry URL and optional scope URLs without credentials`);
    const executionTimeoutMs: unknown = entry.executionTimeoutMs;
    if (executionTimeoutMs !== undefined && !isExecutionTimeoutMs(executionTimeoutMs)) invalid(`instance ${index} has an invalid execution timeout`);
    const tags = normalizeTags(entry.tags, index, limits);
    if (entry.capabilities !== undefined && !isCapabilitySwitches(entry.capabilities)) invalid(`instance ${index} capabilities must map capability IDs to booleans; local tools use session.localTools`);
    const customMetrics = parseCustomMetrics(entry.customMetrics);
    return {
      id,
      label,
      local: entry.local === true,
      tags,
      ...(entry.capabilities === undefined ? {} : { capabilities: { ...entry.capabilities } }),
      ...(entry.customMetrics === undefined ? {} : { customMetrics }),
      ...(entry.sshCommand === undefined ? {} : { sshCommand: entry.sshCommand }),
      ...(entry.python === undefined ? {} : { python: entry.python }),
      ...(entry.pythonIndexUrl === undefined ? {} : { pythonIndexUrl: entry.pythonIndexUrl }),
      ...(entry.bunPackages === undefined ? {} : { bunPackages: entry.bunPackages }),
      kernel: {
        target: id,
        kernelOptions: parseKernelOptions(entry.kernel, runnerDefaults, `instances[${index}].kernel`),
        cwd,
        ...(executionTimeoutMs === undefined ? {} : { executionTimeoutMs }),
      },
    };
  });
}
