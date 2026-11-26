import type { SavedGroup } from "../../../workspace/editor-layout/editor-layout-types.ts";
import type { GridTests } from "./grid-types.ts";
import { holdsChat } from "./stage-constants.ts";

/** Grid-leaf tests for fitGrid / splitAxes: the main area is group `main` (the chat's while there is none), the chat is
 * the group holding the chat panel. */
export const mainTests = (main: string | null | undefined): GridTests => ({ isMain: (group: SavedGroup) => (main ? group?.id === main : holdsChat(group)), isChat: holdsChat });
