import type { UiContext } from "../ui-types.ts";
import type { ReadonlyFooterDataProvider } from "@earendil-works/pi-coding-agent";
import { renderError } from "../describe-render-error.ts";
import { notify } from "../notifications/notify.ts";
import { updateBranch } from "./update.ts";
import { getGitBranch } from "./get-git-branch.ts";
import { execFile } from "node:child_process";

export function onBranchChange(ctx: UiContext, listener: Parameters<ReadonlyFooterDataProvider["onBranchChange"]>[0]) {
      ctx.branchListeners.add(listener);
      getGitBranch(ctx);
      ctx.branchTimer ??= setInterval(() => {
        if (ctx.disposed || ctx.branchRefreshing) return;
        ctx.branchRefreshing = true;
        const cwd = ctx.session.sessionManager.getCwd();
        const update = (next: string | null): void => updateBranch(ctx, cwd, next);
        execFile("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], { cwd }, (error, stdout) => {
          if (!error) update(stdout.trim());
          else if (error.code === "ENOENT") { ctx.branchRefreshing = false; clearInterval(ctx.branchTimer); ctx.branchTimer = undefined; notify(ctx, `Footer git lookup failed: ${renderError(error)}`, "error"); }
          else execFile("git", ["rev-parse", "--verify", "HEAD"], { cwd }, (headError) => {
            if (headError?.code === "ENOENT") { ctx.branchRefreshing = false; clearInterval(ctx.branchTimer); ctx.branchTimer = undefined; notify(ctx, `Footer git lookup failed: ${renderError(headError)}`, "error"); }
            else update(headError ? null : "detached");
          });
        });
      }, 1000);
      ctx.branchTimer.unref();
      return () => { ctx.branchListeners.delete(listener); if (!ctx.branchListeners.size) { clearInterval(ctx.branchTimer); ctx.branchTimer = undefined; } };
    }
