
/** `GET /api/sessions/<sessionId>/terminals/<name>/ws` upgrades to the terminal WebSocket (open + live output + input + resize). */
export function terminalSocketRoute(pathname: string): { sessionId: string; name: string } | undefined {
  const parts = pathname.split("/");
  if (parts.length === 7 && parts[1] === "api" && parts[2] === "sessions" && parts[3] && parts[4] === "terminals" && parts[5] && parts[6] === "ws") {
    return { sessionId: parts[3], name: parts[5] };
  }
}
