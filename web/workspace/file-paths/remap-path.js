import { within } from "./within.js";
import { joinPath } from "./join-path.js";
export const remapPath = (path, from, to) => (!within(path, from) ? path : path === from ? to : joinPath(to, path.slice(from === "/" ? 1 : from.length + 1)));
