import type { KernelContext } from "../kernel-state.ts";
import { maintain } from "../lifecycle/maintain.ts";
import { variables } from "./list-variables.ts";

export async function deleteVariable(ctx: KernelContext, name: string) {
  variables(ctx);
  return maintain(ctx, { kind: "delete", name });
}
