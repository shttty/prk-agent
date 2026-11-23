import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { ToolMode } from "../session/session-options.ts";
import type { CapabilitySwitches } from "../capabilities/capability-types.ts";

export const DEFAULT_DERIVED_INSTRUCTIONS =
  "Your parent already planned the overall work; you own only this piece. Do it directly unless your role or assignment explicitly calls for further sessions.";
export const DEFAULT_MAX_DERIVATION_DEPTH = 3;
export const DEFAULT_DERIVATION_ROLE = "task";

export type DerivationRole = {
  readonly description?: string;
  readonly model?: string;
  readonly thinkingLevel?: ThinkingLevel;
  readonly toolMode?: ToolMode;
  readonly isolated?: boolean;
  readonly instructions?: string;
  readonly capabilities?: CapabilitySwitches;
};

export const DEFAULT_DERIVATION_ROLES: Readonly<Record<string, DerivationRole>> = Object.freeze({
  [DEFAULT_DERIVATION_ROLE]: Object.freeze({ description: "Default role for general coding and implementation sub-sessions." }),
  small: Object.freeze({ description: "Fast, lightweight role for quick searches, exploration and small tasks.", toolMode: "direct" }),
});

export interface DerivationConfig {
  readonly defaultToolMode?: ToolMode;
  readonly defaultIsolated?: boolean;
  readonly maxDepth?: number;
  readonly defaultInstructions?: string;
  readonly roles?: Readonly<Record<string, DerivationRole>>;
}

export interface DerivationSettings {
  readonly derivation: DerivationConfig;
  readonly defaults: {
    readonly defaultToolMode: ToolMode;
    readonly defaultIsolated: boolean;
    readonly maxDepth: number;
    readonly defaultInstructions: string;
    readonly roles: Readonly<Record<string, DerivationRole>>;
  };
}

export interface DerivationModelRequest {
  readonly model?: string;
  readonly thinkingLevel?: ThinkingLevel;
  readonly role?: string;
  readonly lifecycle: "temporary" | "persistent" | "user";
}

export type ParentModel = {
  readonly model: NonNullable<AgentSession["model"]>;
  readonly thinkingLevel: AgentSession["thinkingLevel"];
};

export type DerivationModelSelection = ParentModel & { readonly instructions?: string };
