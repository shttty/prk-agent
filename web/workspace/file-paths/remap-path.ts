import { within } from "./within.ts";
import { joinPath } from "./join-path.ts";
export const remapPath = (path: string, from: string, to: string) => (!within(path, from) ? path : path === from ? to : joinPath(to, path.slice(from === "/" ? 1 : from.length + 1)));
