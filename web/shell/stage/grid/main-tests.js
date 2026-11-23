import { holdsChat } from "./stage-constants.js";

/** Grid-leaf tests for fitGrid / splitAxes: the main area is group `main` (the chat's while there is none), the chat is
 * the group holding the chat panel. */
export const mainTests = (main) => ({ isMain: (group) => (main ? group?.id === main : holdsChat(group)), isChat: holdsChat });
