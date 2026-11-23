import { mutateArchive } from "./mutate-archive.js";
export async function purgeArchive(ctx, group) { return mutateArchive(ctx, group, true); }

