import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { CodeModeMethod } from "../gateway-connection/client-types.ts";
import { skillMethods } from "./route-constants.ts";
import { toolMethods } from "./route-constants.ts";
import { decodeRouteIdentity } from "../request/decode-route-identity.ts";
import { kernelMethods } from "./route-constants.ts";
import { monitorMethods } from "./route-constants.ts";

export function routeCodeModePath(limits: LimitsOptions, pathname: string): { method: CodeModeMethod; verb: "GET" | "POST"; sessionId?: string; name?: string } | undefined {
  if (pathname === "/api/tools/list") return { method: "toolsList", verb: "POST" };
  if (pathname === "/api/skills/list") return { method: "skillsList", verb: "POST" };
  const themes = { "/api/themes/list": "themesList", "/api/themes/preview": "themesPreview", "/api/themes/import": "themesImport", "/api/themes/delete": "themesDelete" } as const;
  if (Object.hasOwn(themes, pathname)) return { method: themes[pathname as keyof typeof themes], verb: "POST" };
  if (pathname === "/api/memory/list") return { method: "memoryList", verb: "POST" };
  if (pathname === "/api/memory/change") return { method: "memoryChange", verb: "POST" };
  if (pathname === "/api/memory/delete-instance") return { method: "memoryDeleteInstance", verb: "POST" };
  if (pathname === "/api/memory/config/get") return { method: "memoryConfigGet", verb: "POST" };
  if (pathname === "/api/memory/config/save") return { method: "memoryConfigSave", verb: "POST" };
  const pluginConfig = { "/api/plugin-config/get": "pluginConfigGet", "/api/plugin-config/set": "pluginConfigSet", "/api/plugin-config/write": "pluginConfigWrite" } as const;
  if (Object.hasOwn(pluginConfig, pathname)) return { method: pluginConfig[pathname as keyof typeof pluginConfig], verb: "POST" };
  const library = /^\/api\/(tools|skills)\/([^/]+)\/([^/]+)$/u.exec(pathname);
  if (library) {
    const method = (library[1] === "skills" ? skillMethods : toolMethods)[library[3]!];
    if (typeof method === "string") return { method, verb: "POST", name: decodeRouteIdentity(limits, library[2]!, library[1] === "skills" ? 64 : limits.identityChars) };
  }
  const kernel = /^\/api\/sessions\/([^/]+)\/kernel\/(.+)$/u.exec(pathname);
  if (kernel) {
    const method = kernelMethods[kernel[2]!];
    if (typeof method === "string") return { method, verb: method === "kernelVariables" ? "GET" : "POST", sessionId: decodeRouteIdentity(limits, kernel[1]!) };
  }
  const monitor = /^\/api\/sessions\/([^/]+)\/monitor\/([^/]+)$/u.exec(pathname);
  if (monitor) {
    const method = monitorMethods[monitor[2]!];
    if (typeof method === "string") return { method, verb: method === "monitorHistory" ? "GET" : "POST", sessionId: decodeRouteIdentity(limits, monitor[1]!) };
  }
}
