import type { DelegationLevel } from "../../../config/session/delegation-levels.ts";

const LEVEL_POLICY: Record<DelegationLevel, string> = {
    gated: "No subagents unless the user or an applicable AGENTS.md/skill explicitly requests subagents, delegation, or parallel agent work.",
    restrained: "Inline first. Inspect with your own search and read tools before deciding. Fan out only for 2+ independent substantial slices, each costing more than a handful of your own calls, or when the read set would flood context. Never open with a scout; use research children only after inline scoping reveals a genuinely unmapped subsystem.",
    eager: "Delegation preferred. Once the design settles, prefer fanning substantial work to session_spawn: multi-file changes, refactors, features, tests and investigations are strong candidates. Use read-only research children to map unknown code while you continue useful work.",
};

export function delegationPolicy(level: DelegationLevel): string {
  return `Delegation policy: ${level}. ${LEVEL_POLICY[level]}`;
}
