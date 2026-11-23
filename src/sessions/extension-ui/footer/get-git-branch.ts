import type { UiContext } from "../ui-types.ts";
import { execFileSync } from "node:child_process";

export function getGitBranch(ctx: UiContext) {
      const cwd = ctx.session.sessionManager.getCwd();
      if (ctx.branchCwd !== cwd) {
        ctx.branchCwd = cwd;
        try { ctx.branch = execFileSync("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
        catch (error) {
          if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") { ctx.branchCwd = undefined; throw error; }
          try { execFileSync("git", ["rev-parse", "--verify", "HEAD"], { cwd, stdio: "ignore" }); ctx.branch = "detached"; }
          catch { ctx.branch = null; }
        }
      }
      return ctx.branch;
    }
