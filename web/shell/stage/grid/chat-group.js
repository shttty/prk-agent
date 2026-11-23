import { CHAT_ID } from "./stage-constants.js";

/** The chat's group in the stage grid (null before the grid holds the chat). */
export const chatGroup = (api) => api.getPanel(CHAT_ID)?.group ?? null;
