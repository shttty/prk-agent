

/**
 * Close code after which the browser must not reconnect: the terminal ended, or the Gateway refused it for good.
 * `web/workspace/terminal/terminal-constants.js` carries the same number (web/ never imports src/).
 */
export const TERMINAL_SOCKET_FINAL = 4000;

export type Message = { type: "ping" } | { type: "input"; data: string } | { type: "resize"; rows: number; cols: number };
