import { DEFAULT_LIMITS_OPTIONS, type LimitsOptions } from "../../config/limits/limits-options.ts";
import { workspaceMethods } from "../../workspace/requests/requests-constants.ts";
import { validateWorkspaceRequest } from "../../workspace/requests/validate-workspace-request.ts";
import { WireError } from "./create-error.ts";
import { object } from "./is-record.ts";
import type { Request } from "./wire-types.ts";
import { keys } from "./fields/has-only-fields.ts";
import { text } from "./fields/is-text.ts";
import { fieldText } from "./fields/is-field-text.ts";
import { routingIdentifier } from "./fields/is-routing-identifier.ts";
import { label } from "./fields/is-label.ts";
import { validTarget } from "./instance-parameters/validate-instance-params.ts";
import { validConnection } from "./instance-parameters/valid-connection.ts";
import { validAbsolutePath } from "./instance-parameters/is-absolute-target-path.ts";
import { validateMessageParams } from "./message-parameters/validate-message-params.ts";
import { methods } from "./method-parameters/method-constants.ts";
import { invalid } from "./method-parameters/reject-invalid-request.ts";
import { validatePackageParams } from "./method-parameters/validate-package-params.ts";
import { validateCapabilityParams } from "./method-parameters/validate-capability-params.ts";
import { validateLibraryParams } from "./method-parameters/validate-library-params.ts";
import { optionalLabel, validateSessionParams } from "./method-parameters/validate-session-params.ts";
import { validateDerivationParams } from "./method-parameters/validate-derivation-params.ts";
import { validProjectSelection } from "./validate-project-selection.ts";
import { isKernelExecutionSettings } from "../../config/kernel/is-kernel-execution-settings.ts";
import { isBunPackagePins } from "../../config/execution-target/validation/bun-package-options.ts";
import { isToolTitleSettings } from "../../config/session/is-tool-title-settings.ts";
import { isMetricsSettings } from "../../config/metrics/is-metrics-settings.ts";

export function validateRequest(value: unknown, limits: LimitsOptions = DEFAULT_LIMITS_OPTIONS): Request {
  if (!object(value) || !keys(value, ["v", "id", "method", "params"]) || value.v !== 1
    || !Number.isSafeInteger(value.id) || (value.id as number) <= 0 || typeof value.method !== "string" || !object(value.params)) return invalid();
  if (!(methods as readonly string[]).includes(value.method)) throw new WireError("UNSUPPORTED_METHOD", "Unsupported gateway method.");
  const p = value.params;
  const request = value as Record<string, unknown> & { method: string };
  if (!validatePackageParams(request, p, limits)
    && !validateCapabilityParams(request, p, limits)
    && !validateDerivationParams(request, p)
    && !validateLibraryParams(request, p, limits)) {
    if ((workspaceMethods as readonly string[]).includes(value.method)) {
      if (!validateWorkspaceRequest(value.method, p, limits)) return invalid();
    } else if (value.method === "kernelExecutionGet" || value.method === "toolTitleGet" || value.method === "soulGet" || value.method === "metricsGet") {
      if (!keys(p, [])) return invalid();
    } else if (value.method === "kernelExecutionSet") {
      if (!isKernelExecutionSettings(p)) return invalid();
    } else if (value.method === "metricsSet") {
      if (!isMetricsSettings(p)) return invalid();
    } else if (value.method === "soulSave") {
      // Size is the soul file's own limit, checked once where it is written.
      if (!keys(p, ["content", "revision"]) || typeof p.content !== "string" || typeof p.revision !== "string") return invalid();
    } else if (value.method === "toolTitleSet") {
      if (!isToolTitleSettings(p)) return invalid();
    } else if (value.method === "send") {
      validateMessageParams(p, limits);
    } else if (value.method === "sendStatus") {
      if (!keys(p, ["sessionId", "requestId", "streamId"]) || !routingIdentifier(p.sessionId, limits)
        || !text(p.requestId, limits.requestIdChars) || !text(p.streamId, limits.identityChars)) return invalid();
    } else if (value.method === "toolContent") {
      if (!keys(p, ["sessionId", "toolCallId"]) || !routingIdentifier(p.sessionId, limits)
        || !fieldText(p.toolCallId, limits.inputBytes)) return invalid();
    } else if (value.method === "historyPage") {
      if (!keys(p, ["sessionId", "before", "through"]) || !routingIdentifier(p.sessionId, limits)
        || !(p.before !== undefined && p.through === undefined && routingIdentifier(p.before, limits)
          || p.before === undefined && (p.through === null || routingIdentifier(p.through, limits)))) return invalid();
    } else if (value.method === "kernelResult") {
      if (!keys(p, ["sessionId", "cellId", "imageIndex"]) || !routingIdentifier(p.sessionId, limits)
        || typeof p.cellId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(p.cellId)
        || (p.imageIndex !== undefined && (!Number.isInteger(p.imageIndex) || (p.imageIndex as number) < 1 || (p.imageIndex as number) > 2_147_483_647))) return invalid();
    } else if (value.method === "nativeCapabilities" || value.method === "history") {
      if (!keys(p, ["sessionId"]) || !routingIdentifier(p.sessionId, limits)) return invalid();
    } else if (value.method === "nativeAction") {
      if (!keys(p, ["sessionId", "requestId", "action", "args"]) || !routingIdentifier(p.sessionId, limits)
        || !text(p.requestId, limits.requestIdChars) || !fieldText(p.action, limits.actionChars) || (p.args !== undefined && !object(p.args))) return invalid();
      if (p.action === "name" && (!object(p.args) || !keys(p.args, ["name"]) || !label(p.args.name, limits))) return invalid();
      if (p.action === "kernel-language" && (!object(p.args) || !keys(p.args, ["language"]) || (p.args.language !== "python" && p.args.language !== "bun"))) return invalid();
    } else if (value.method === "kernelDeleteVariable") {
      if (!keys(p, ["sessionId", "name"]) || !routingIdentifier(p.sessionId, limits) || !fieldText(p.name, limits.inputBytes)) return invalid();
    } else if (value.method === "kernelInterrupt") {
      if (!keys(p, ["sessionId", "kernelId", "cellId", "cellOnly"]) || !routingIdentifier(p.sessionId, limits)
        || !fieldText(p.kernelId, limits.identityChars) || !routingIdentifier(p.cellId, limits)
        || (p.cellOnly !== undefined && typeof p.cellOnly !== "boolean")) return invalid();
    } else if (value.method === "monitorFocus") {
      if (!keys(p, ["sessionId", "open"]) || !routingIdentifier(p.sessionId, limits) || typeof p.open !== "boolean") return invalid();
    } else if (value.method === "monitorDiff") {
      if (!keys(p, ["sessionId", "path"]) || !routingIdentifier(p.sessionId, limits) || !fieldText(p.path, limits.cwdChars)) return invalid();
    } else if (value.method === "cancel") {
      if (!keys(p, ["sessionId", "operationId", "cell"]) || !routingIdentifier(p.sessionId, limits) || !text(p.operationId, limits.operationIdChars)) return invalid();
      if (p.cell !== undefined && (!object(p.cell) || !keys(p.cell, ["kernelId", "cellId"])
        || !fieldText(p.cell.kernelId, limits.identityChars) || !routingIdentifier(p.cell.cellId, limits))) return invalid();
    } else if (value.method === "createSession") {
      if (!keys(p, ["target", "label", "cwd", "project"]) || !text(p.target, limits.identityChars)
        || (p.label !== undefined && !optionalLabel(p.label, limits)) || (p.cwd !== undefined && !fieldText(p.cwd, limits.cwdChars))
        || (p.project !== undefined && !validProjectSelection(p.project, limits, true))) return invalid();
    } else if (value.method === "deployTargetEnvironment") {
      if (!keys(p, ["target", "bunPackages"]) || !routingIdentifier(p.target, limits)
        || (p.bunPackages !== undefined && !isBunPackagePins(p.bunPackages))) return invalid();
    } else if (value.method === "getTarget" || value.method === "getTargetEnvironment" || value.method === "unarchive") {
      const key = value.method === "unarchive" ? "group" : "target";
      if (!keys(p, [key]) || !routingIdentifier(p[key], limits)) return invalid();
    } else if (value.method === "addTarget") {
      if (!keys(p, ["target"]) || !validTarget(p.target, true, limits)) return invalid();
    } else if (value.method === "editTarget") {
      if (!keys(p, ["target"]) || !validTarget(p.target, false, limits)) return invalid();
    } else if (value.method === "inspectTarget") {
      if (!keys(p, ["connection"]) || !validConnection(p.connection, limits)) return invalid();
    } else if (value.method === "browseTarget") {
      if (!keys(p, ["connection", "path"]) || !validConnection(p.connection, limits) || !validAbsolutePath(p.path, limits)) return invalid();
    } else if (value.method === "assignProject") {
      if (!keys(p, ["sessionId", "project"]) || !routingIdentifier(p.sessionId, limits)
        || (p.project !== null && !validProjectSelection(p.project, limits, false))) return invalid();
    } else if (value.method === "renameProject") {
      if (!keys(p, ["projectId", "name"]) || !routingIdentifier(p.projectId, limits)) return invalid();
      if (!label(p.name, limits)) throw new WireError("INVALID_REQUEST", "Project name must be non-empty and valid.");
    } else if (value.method === "archiveProjectPreview" || value.method === "archiveProject") {
      const preview = value.method === "archiveProjectPreview";
      if (!keys(p, preview ? ["projectId"] : ["projectId", "confirm"]) || !routingIdentifier(p.projectId, limits)
        || (!preview && p.confirm !== true)) return invalid();
    } else if (value.method === "deleteTarget" || value.method === "archiveSession" || value.method === "purgeArchive") {
      const key = value.method === "deleteTarget" ? "target" : value.method === "archiveSession" ? "sessionId" : "group";
      if (!keys(p, [key, "confirm"]) || !routingIdentifier(p[key], limits) || p.confirm !== true) return invalid();
    } else if (!validateSessionParams(request, p, limits) && Object.keys(p).length) return invalid();
  }
  let requestBytes: number;
  try { requestBytes = new TextEncoder().encode(JSON.stringify(value)).byteLength + 1; }
  catch { return invalid(); }
  if (requestBytes > limits.inputBytes) throw new WireError("INVALID_REQUEST", "Request exceeds the Gateway input byte limit.");
  return value as unknown as Request;
}
