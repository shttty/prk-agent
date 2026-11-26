import type { StageApi } from "./grid-types.ts";
import { CHAT_ID } from "./stage-constants.ts";

/** The chat's group in the stage grid (null before the grid holds the chat). */
export const chatGroup = (api: StageApi) => api.getPanel(CHAT_ID)?.group ?? null;
