import { CHAT_MIN } from "../../layout/layout-table.js";
import { CARD_GAP } from "../../layout/layout-table.js";

// The chat column's panel in the desktop stage grid; the workspace engine owns the file, diff and shell panel ids.
export const CHAT_ID = "stage:chat";

export const CHAT_COMPONENT = "chat";

// The chat group's floor, as the grid measures it (a group's view includes the half gaps around its card): the chat
// card keeps CHAT_MIN of width, and 240px of height when something docks under it.
export const CHAT_VIEW_MIN = { width: CHAT_MIN + CARD_GAP, height: 240 + CARD_GAP };

// Every other group: free to size by its handles above this floor.
export const GROUP_LIMITS = { minimumWidth: 140, maximumWidth: Number.MAX_SAFE_INTEGER, minimumHeight: 90, maximumHeight: Number.MAX_SAFE_INTEGER };

// Width of the first group docked beside the chat: a 512px card plus its borders and the gap around it (the default
// right workspace).
export const FIRST_GROUP_WIDTH = 522;

/** Whether a serialized group (a grid leaf's `data`) is the chat's. */
export const holdsChat = (group) => Array.isArray(group?.views) && group.views.includes(CHAT_ID);
