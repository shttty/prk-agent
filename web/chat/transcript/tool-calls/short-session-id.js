import { safeText } from "../../../workbench/payloads/safe-text.js";
export const shortSessionId = (id) => safeText(id).slice(0, 8);
