import { patch } from "../updates/patch.js";
export function setQueue(ctx, mode) { if (["steer", "followUp"].includes(mode)) patch(ctx, { queue: mode }); }

