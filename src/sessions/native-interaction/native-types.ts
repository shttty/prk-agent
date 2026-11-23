import type { AgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import type { SessionHost } from "../host/host-types.ts";
import type { ExtendedSendRequest, NativeActionRequest, NativeActionResult } from "../../gateway/wire/wire-types.ts";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { SessionOptions, ToolMode } from "../../config/session/session-options.ts";
import type { ReferencesOptions } from "../../config/references/references-options.ts";
import type { CapabilityCatalog, CapabilityChange } from "../../config/capabilities/capability-types.ts";
import type { DelegationLevel } from "../../config/session/delegation-levels.ts";
import type { ModelProviderOwnership, ProviderPolicyError } from "../model-providers/provider-types.ts";
import type { KernelLanguage, KernelLanguageChange } from "../../kernel/kernel-types.ts";

export type NativeState = "idle" | "running" | "cancel_requested" | "sleeping" | "unavailable" | "closing" | "closed";
export interface NativeCandidate {
  readonly value: string;
  readonly label?: string;
  readonly description?: string;
  readonly available?: boolean;
  readonly reason?: string;
}
export interface NativeActionDescriptor {
  readonly name: string;
  readonly effect: NativeCommand["effect"];
  readonly risk: NativeCommand["risk"];
  readonly enabled: boolean;
  readonly reason?: string;
}
export interface NativeInputPrefix {
  readonly prefix: "/" | "!" | "!!";
  readonly enabled: boolean;
  readonly kind: "native-command" | "shell" | "shell-detached";
  readonly reason?: string;
}
export interface NativeReferenceCandidate {
  readonly type: "target-file";
  readonly source: "session-target";
  readonly target: string;
  readonly sessionId: string;
  readonly path: string;
  readonly name: string;
  readonly label?: string;
  readonly selectable?: boolean;
  readonly navigable?: boolean;
}
export interface NativeTarget {
  readonly sessionId: string;
  readonly streamId: string;
  readonly target?: string;
  readonly state: NativeState;
  readonly readOnly: boolean;
  readonly session?: AgentSession;
  readonly modelProviders?: ModelProviderOwnership;
  readonly modelRuntime?: AgentSession["modelRuntime"];
  readonly onModelChange?: () => void;
  readonly host?: SessionHost;
  readonly manager: SessionManager;
  readonly referenceCandidates?: (path?: string) => Promise<{ readonly candidates: readonly NativeReferenceCandidate[]; readonly truncated: boolean }>;
  readonly readReference?: (path: string) => Promise<{ readonly path: string; readonly type: string; readonly content: string }>;
  readonly local?: boolean;
  readonly rename?: (label: string) => Promise<unknown>;
  readonly toolMode?: ToolMode;
  readonly setToolMode?: (mode: ToolMode) => void;
  readonly kernelLanguage?: KernelLanguage;
  readonly kernelBusy?: boolean;
  readonly setKernelLanguage?: (language: KernelLanguage) => Promise<KernelLanguageChange>;
  readonly delegation?: DelegationLevel;
  readonly setDelegation?: (level: DelegationLevel) => void;
  readonly localTools?: boolean;
  readonly setLocalTools?: (enabled: boolean) => void;
  readonly requiresReload?: boolean;
  readonly capabilityCatalog?: () => CapabilityCatalog;
  readonly refreshRegistration?: () => Promise<void>;
  readonly setCapabilities?: (changes: readonly CapabilityChange[]) => void;
}

export interface NativeCommandArgument {
  readonly name: string;
  readonly description: string;
  readonly required?: boolean;
  readonly candidates?: readonly NativeCandidate[];
}
export interface NativeCommand {
  readonly name: string;
  readonly description: string;
  readonly source: "builtin" | "hidden" | "extension" | "skill" | "template";
  readonly hidden?: boolean;
  readonly arguments?: readonly NativeCommandArgument[];
  readonly availability: { readonly enabled: boolean; readonly reason?: string };
  readonly effect: "read" | "context" | "model" | "session" | "external" | "presentation";
  readonly risk: "none" | "low" | "model" | "external" | "sensitive";
}
export interface NativeResource {
  readonly type: "extension" | "skill" | "template";
  readonly name: string;
  readonly source?: string;
  readonly providers?: string[];
  readonly code?: ProviderPolicyError["code"];
  readonly providerId?: string;
  readonly operation?: ProviderPolicyError["operation"];
  readonly loaded: boolean;
  readonly disabled?: boolean;
  readonly reason?: string;
}
export interface NativeCatalog {
  readonly version: 1;
  readonly target: {
    readonly sessionId: string;
    readonly state: NativeState;
    readonly readOnly: boolean;
    readonly target?: string;
    readonly local: boolean;
    readonly current?: { readonly model?: string; readonly thinkingLevel?: string; readonly scopedModels?: readonly string[]; readonly autoCompaction?: boolean; readonly autoRetry?: boolean; readonly toolMode?: ToolMode; readonly kernelLanguage?: KernelLanguage; readonly delegation?: DelegationLevel; readonly localTools: boolean; readonly requiresReload: boolean };
  };
  readonly commands: readonly NativeCommand[];
  readonly actions: readonly NativeActionDescriptor[];
  readonly inputPrefixes: readonly NativeInputPrefix[];
  readonly resources: readonly NativeResource[];
  readonly diagnostics: readonly string[];
  readonly references: {
    readonly targetFile: { readonly enabled: boolean; readonly reason: string; readonly candidates: readonly NativeReferenceCandidate[] };
    readonly browserUpload: { readonly enabled: boolean; readonly reason?: string };
  };
  readonly attachments: {
    readonly maxItems: number;
    readonly maxDecodedBytesPerItem: number;
    readonly maxDecodedBytesTotal: number;
    readonly maxAugmentedMessageBytes: number;
    readonly maxEncodedRequestBytes: number;
    readonly imageMimeTypes: readonly string[];
    readonly textMimeTypes: readonly string[];
  };
}
export type NativeInputAdmission = (deliver: (target: NativeTarget) => Promise<unknown>) => Promise<unknown>;

export interface NativeInteractionService {
  catalog(target: NativeTarget): NativeCatalog;
  action(target: NativeTarget, request: NativeActionRequest): Promise<NativeActionResult>;
  send(target: NativeTarget, request: ExtendedSendRequest, admit?: NativeInputAdmission): Promise<unknown>;
}
export interface NativeInteractionOptions {
  readonly lifecycle?: (target: NativeTarget, action: "new" | "clone" | "fork", args?: Record<string, unknown>) => Promise<unknown>;
  readonly dispatchAction?: (request: NativeActionRequest) => Promise<NativeActionResult>;
  readonly limits?: LimitsOptions;
  readonly sessionOptions?: SessionOptions;
  readonly referencesOptions?: ReferencesOptions;
}
export type StaticCommand = Omit<NativeCommand, "availability">;

export interface NativeContext {
  readonly options: NativeInteractionOptions;
  readonly limits: LimitsOptions;
  readonly sessionOptions: SessionOptions;
  readonly referencesOptions: ReferencesOptions;
  readonly running: Map<string, { readonly cancel: () => void; readonly action: string }>;
  readonly activeRequests: Set<string>;
}

export interface NativeActionContext {
  runningCancel?: () => void;
}

export interface NativeTreeContext {
  readonly limits: LimitsOptions;
  remaining: number;
}
