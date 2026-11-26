import type { StoreContext } from "../store-context-types.ts";
import { sessionPhase, type SessionPhase } from "./session-phase.ts";

export const phaseChanged = (ctx: StoreContext, name: string, phase: SessionPhase): boolean => sessionPhase(ctx, name).some((part, index) => part !== phase[index]);
