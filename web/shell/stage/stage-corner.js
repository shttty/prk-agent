import { createContext } from "react";

/** The chat column's slot for the stage's buttons (a callback ref the stage provides): while the chat holds the
 * stage's top-right corner the buttons render there, in one row with the session heading and the monitor pill. */
export const StageCorner = createContext(null);
