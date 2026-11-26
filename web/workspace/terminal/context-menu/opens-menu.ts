/** A right click opens PRK's menu unless the program reports the mouse (vim, tmux, htop); Shift forces it, as in Konsole. */
export const opensMenu = (mouseTrackingMode: string, shiftKey: boolean) => mouseTrackingMode === "none" || shiftKey;
