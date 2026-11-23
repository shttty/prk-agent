import { sessionPhase } from "./session-phase.js";
export const phaseChanged = (ctx, name, phase) => sessionPhase(ctx, name).some((part, index) => part !== phase[index]);
