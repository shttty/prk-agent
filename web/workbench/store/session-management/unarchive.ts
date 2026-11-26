import type { StoreContext } from "../store-context-types.ts";
import { mutateArchive } from "./mutate-archive.ts";

export async function unarchive(ctx: StoreContext, group: string): Promise<boolean> { return mutateArchive(ctx, group, false); }
