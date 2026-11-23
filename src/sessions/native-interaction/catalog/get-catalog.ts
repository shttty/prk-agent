import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import type { NativeContext, NativeCandidate, NativeCatalog, NativeCommand, NativeInputPrefix, NativeTarget } from "../native-types.ts";
import { IMAGE_TYPES, TEXT_TYPES, THINKING_LEVELS } from "../native-constants.ts";
import { dynamicResources } from "./read-sdk-resources.ts";
import { staticCommands, replyForkAction } from "./command-metadata.ts";
import { commandAvailability } from "./command-availability.ts";
import { visit } from "./visit.ts";
import { readNativeSessionState } from "../../history/read-native-session-state.ts";

export function catalog(ctx: NativeContext, target: NativeTarget): NativeCatalog {
  const { limits } = ctx;
  const dynamic = dynamicResources(target);
  const runtime = target.session?.modelRuntime ?? target.modelRuntime;
  const availableModels = runtime?.getAvailableSnapshot() ?? [];
  const allModels = runtime?.getModels() ?? [];
  const available = new Set(availableModels.map((model) => `${model.provider}/${model.id}`));
  const modelCandidates = allModels.map((model) => {
    const value = `${model.provider}/${model.id}`;
    const isAvailable = available.has(value);
    return { value, label: value, available: isAvailable, ...(!isAvailable ? { reason: "Model is not currently available or authenticated." } : {}) };
  });
  const native = readNativeSessionState(target.manager, limits);
  const separator = native.model?.indexOf("/") ?? -1;
  const activeModel = target.session?.model ?? (separator > 0 ? runtime?.getModel(native.model!.slice(0, separator), native.model!.slice(separator + 1)) : undefined);
  const thinkingCandidates = activeModel
    ? (getSupportedThinkingLevels(activeModel) as readonly string[]).map((level) => ({ value: level, label: level, available: true }))
    : [...THINKING_LEVELS].map((level) => ({ value: level, label: level, available: false, reason: "No active model." }));
  const scopedCandidates = modelCandidates.filter((entry) => entry.available !== false);
  const treeCandidates: NativeCandidate[] = [];
  if (target.session) visit(treeCandidates, target.manager.getTree());
  const commands = staticCommands.map((command): NativeCommand => {
    const argumentsList = command.arguments?.map((argument) => argument.name === "model"
      ? { ...argument, candidates: modelCandidates }
      : argument.name === "level" ? { ...argument, candidates: thinkingCandidates }
        : argument.name === "models" ? { ...argument, candidates: scopedCandidates }
          : argument.name === "entryId" ? { ...argument, candidates: treeCandidates }
              : argument);
    return { ...command, ...(argumentsList === undefined ? {} : { arguments: argumentsList }), availability: commandAvailability(command, target) };
  });
  const extensionNames = new Set(dynamic.commands.filter((command) => command.source === "extension").map((command) => command.name));
  const staticNames = new Set(commands.map((command) => command.name));
  const allCommands = [...commands.filter((command) => !extensionNames.has(command.name)), ...dynamic.commands.filter((command) => command.source !== "extension" && !extensionNames.has(command.name) && !staticNames.has(command.name)), ...dynamic.commands.filter((command) => command.source === "extension")];
  const actions = allCommands.map((command) => {
    const sendOnly = command.source === "skill" || command.source === "template" || extensionNames.has(command.name);
    return { name: command.name, effect: command.effect, risk: command.risk, enabled: command.availability.enabled && !sendOnly, ...(sendOnly ? { reason: "Invoke this SDK resource through slash-command send, not nativeAction." } : command.availability.reason === undefined ? {} : { reason: command.availability.reason }) };
  });
  actions.push(
    { name: replyForkAction.name, effect: replyForkAction.effect, risk: replyForkAction.risk, ...commandAvailability(replyForkAction, target) },
    { name: "reference-candidates", effect: "read", risk: "none", enabled: !target.readOnly, ...(!target.readOnly ? {} : { reason: "Only a writable session can browse its configured target." }) },
    { name: "reference-read", effect: "read", risk: "none", enabled: !target.readOnly, ...(!target.readOnly ? {} : { reason: "Only a writable session can read its configured target." }) },
    { name: "tree-read", effect: "read", risk: "none", enabled: true },
    { name: "tree-label", effect: "session", risk: "low", enabled: !target.readOnly && target.state !== "sleeping", ...(!target.readOnly && target.state !== "sleeping" ? {} : { reason: "Tree labels require an active idle session." }) },
    { name: "tree-filter", effect: "presentation", risk: "none", enabled: true },
    { name: "tree-fold", effect: "presentation", risk: "none", enabled: true },
    { name: "tree-copy", effect: "presentation", risk: "none", enabled: true },
    { name: "dequeue", effect: "context", risk: "low", enabled: !!target.host, ...(target.host ? {} : { reason: "No active SDK host." }) },
    { name: "cancel-native", effect: "context", risk: "low", enabled: !!target.session, ...(target.session ? {} : { reason: "No active SDK session." }) },
    { name: "tool-mode", effect: "session", risk: "low", enabled: !!target.setToolMode && !target.readOnly },
    { name: "kernel-language", effect: "session", risk: "low", enabled: !!target.setKernelLanguage && !target.readOnly && !target.kernelBusy && target.state === "idle" },
    { name: "delegation", effect: "session", risk: "low", enabled: !!target.setDelegation && !target.readOnly },
    { name: "local-tools", effect: "session", risk: "low", enabled: !!target.setLocalTools && !target.readOnly },
    { name: "capabilities", effect: "session", risk: "low", enabled: !!target.capabilityCatalog },
  );
  const inputPrefixes: readonly NativeInputPrefix[] = [
    { prefix: "/", enabled: true, kind: "native-command" },
    { prefix: "!", enabled: false, kind: "shell", reason: "Gateway shell execution is disabled; use an explicitly authorized session operation." },
    { prefix: "!!", enabled: false, kind: "shell-detached", reason: "Gateway detached shell execution is disabled; use an explicitly authorized session operation." },
  ];
  return Object.freeze({
    version: 1,
    target: { sessionId: target.sessionId, state: target.state, readOnly: target.readOnly, local: target.local === true, ...(target.target === undefined ? {} : { target: target.target }), current: {
      model: target.session?.model ? `${target.session.model.provider}/${target.session.model.id}` : native.model,
      thinkingLevel: target.session?.thinkingLevel ?? native.thinkingLevel,
      scopedModels: target.session?.scopedModels.map((entry) => `${entry.model.provider}/${entry.model.id}`) ?? native.scopedModels,
      autoCompaction: target.session?.autoCompactionEnabled ?? native.autoCompaction,
      autoRetry: target.session?.autoRetryEnabled ?? native.autoRetry,
      kernelLanguage: target.kernelLanguage ?? "python",
      ...(target.toolMode === undefined ? {} : { toolMode: target.toolMode }), ...(target.delegation === undefined ? {} : { delegation: target.delegation }), localTools: target.localTools ?? false, requiresReload: target.requiresReload ?? false,
    } },
    commands: Object.freeze(allCommands),
    actions: Object.freeze(actions),
    inputPrefixes: Object.freeze(inputPrefixes),
    resources: Object.freeze(dynamic.resources),
    diagnostics: Object.freeze(dynamic.diagnostics),
    references: {
      targetFile: target.target && !target.readOnly
        ? { enabled: true, reason: "Candidates and reads use only the session's configured target connection; Gateway cwd is never read.", candidates: [] }
        : { enabled: false, reason: "An explicit target and a writable session are required for target-file references.", candidates: [] },
      browserUpload: { enabled: !target.readOnly, ...(target.readOnly ? { reason: "Read-only history cannot accept new browser input." } : {}) },
    },
    attachments: { maxItems: limits.attachmentsMax, maxDecodedBytesPerItem: limits.attachmentBytes, maxDecodedBytesTotal: limits.attachmentTotalBytes, maxAugmentedMessageBytes: limits.augmentedMessageBytes, maxEncodedRequestBytes: limits.inputBytes, imageMimeTypes: [...IMAGE_TYPES], textMimeTypes: [...TEXT_TYPES] },
  });
}
