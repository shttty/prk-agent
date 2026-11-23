import type { SessionManager } from "@earendil-works/pi-coding-agent";
import { type LimitsOptions, DEFAULT_LIMITS_OPTIONS } from "../../config/limits/limits-options.ts";
import type { NativeSessionState } from "./history-types.ts";
import { activeModelAndThinking } from "./metadata/read-model-and-thinking.ts";
import { type ToolMode, TOOL_MODES } from "../../config/session/session-options.ts";
import { type CapabilitySwitches } from "../../config/capabilities/capability-types.ts";
import { isCapabilityChanges } from "../../config/capabilities/is-changes.ts";
import { isRecord } from "./metadata/is-history-metadata-record.ts";
import { modelSpec } from "./metadata/validate-model-spec.ts";
import { invalid } from "./reject-invalid-history.ts";
import { DELEGATION_LEVELS, type DelegationLevel } from "../../config/session/delegation-levels.ts";

const NATIVE_STATE_FIELDS = ["version", "autoCompaction", "autoRetry", "models", "toolMode", "kernelLanguage", "delegation", "localTools", "capabilities"];

export function readNativeSessionState(manager: SessionManager, limits: LimitsOptions = DEFAULT_LIMITS_OPTIONS): NativeSessionState {
  const active = activeModelAndThinking(manager, limits);
  let autoCompaction: boolean | undefined;
  let autoRetry: boolean | undefined;
  let scopedModels: readonly string[] | undefined;
  let toolMode: ToolMode | undefined;
  let kernelLanguage: NativeSessionState["kernelLanguage"];
  let delegation: DelegationLevel | undefined;
  let localTools: boolean | undefined;
  const capabilities: CapabilitySwitches = {};
  for (const entry of manager.getEntries()) {
    if (entry.type !== "custom" || entry.customType !== "gateway-native-session-state") continue;
    if (!isRecord(entry.data)) invalid("native session state at /");
    const unexpected = Object.keys(entry.data).find((key) => !NATIVE_STATE_FIELDS.includes(key));
    if (unexpected !== undefined) invalid(`native session state at /${unexpected.replaceAll("~", "~0").replaceAll("/", "~1")}`);
    if (entry.data.version !== 1) invalid("native session state at /version");
    if (entry.data.autoCompaction !== undefined && typeof entry.data.autoCompaction !== "boolean") invalid("native session state at /autoCompaction");
    if (entry.data.autoRetry !== undefined && typeof entry.data.autoRetry !== "boolean") invalid("native session state at /autoRetry");
    if (entry.data.toolMode !== undefined && !(TOOL_MODES as readonly unknown[]).includes(entry.data.toolMode)) invalid("native session state at /toolMode");
    if (entry.data.kernelLanguage !== undefined && entry.data.kernelLanguage !== "python" && entry.data.kernelLanguage !== "bun") invalid("native session state at /kernelLanguage");
    if (entry.data.delegation !== undefined && !(DELEGATION_LEVELS as readonly unknown[]).includes(entry.data.delegation)) invalid("native session state at /delegation");
    if (entry.data.localTools !== undefined && entry.data.localTools !== null && typeof entry.data.localTools !== "boolean") invalid("native session state at /localTools");
    if (entry.data.capabilities !== undefined && !isCapabilityChanges(entry.data.capabilities)) invalid("native session state at /capabilities");
    if (entry.data.models !== undefined) {
      if (!Array.isArray(entry.data.models) || entry.data.models.length > limits.scopedModelsMax) invalid("native session state at /models");
      const invalidIndex = entry.data.models.findIndex((value) => !modelSpec(value, limits));
      if (invalidIndex !== -1) invalid(`native session state at /models/${invalidIndex}`);
    }
    if (typeof entry.data.autoCompaction === "boolean") autoCompaction = entry.data.autoCompaction;
    if (typeof entry.data.autoRetry === "boolean") autoRetry = entry.data.autoRetry;
    if (Array.isArray(entry.data.models)) scopedModels = [...entry.data.models] as string[];
    if (entry.data.toolMode !== undefined) toolMode = entry.data.toolMode as ToolMode;
    if (entry.data.kernelLanguage !== undefined) kernelLanguage = entry.data.kernelLanguage;
    if (entry.data.delegation !== undefined) delegation = entry.data.delegation as DelegationLevel;
    if (entry.data.localTools === null) localTools = undefined;
    else if (typeof entry.data.localTools === "boolean") localTools = entry.data.localTools;
    if (isCapabilityChanges(entry.data.capabilities)) {
      for (const [id, enabled] of Object.entries(entry.data.capabilities)) {
        if (enabled === null) delete capabilities[id];
        else capabilities[id] = enabled;
      }
    }
  }
  return {
    ...active,
    ...(autoCompaction === undefined ? {} : { autoCompaction }),
    ...(autoRetry === undefined ? {} : { autoRetry }),
    ...(scopedModels === undefined ? {} : { scopedModels }),
    ...(toolMode === undefined ? {} : { toolMode }),
    ...(kernelLanguage === undefined ? {} : { kernelLanguage }),
    ...(delegation === undefined ? {} : { delegation }),
    ...(localTools === undefined ? {} : { localTools }),
    ...(Object.keys(capabilities).length === 0 ? {} : { capabilities }),
  };
}
