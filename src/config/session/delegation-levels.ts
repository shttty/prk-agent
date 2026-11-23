export const DELEGATION_LEVELS = ["gated", "restrained", "eager"] as const;
export type DelegationLevel = (typeof DELEGATION_LEVELS)[number];
