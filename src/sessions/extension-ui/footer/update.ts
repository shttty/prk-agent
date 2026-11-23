import type { UiContext } from "../ui-types.ts";
import { publish } from "../publication/publish-revision.ts";

export function updateBranch(ctx: UiContext, cwd: string, next: string | null): void {
          ctx.branchRefreshing = false;
          if (ctx.disposed) return;
          const changed = next !== ctx.branch || ctx.branchCwd !== cwd;
          ctx.branch = next; ctx.branchCwd = cwd;
          if (changed) { for (const callback of [...ctx.branchListeners]) callback(); publish(ctx); }
        }
