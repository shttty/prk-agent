import type { ExecutionTarget } from "../../../config/execution-target/target-types.ts";
import { checkedTargets } from "./check-targets.ts";
import type { CollectionContext } from "../collection-state.ts";

export function previewTargets(ctx: CollectionContext, targets: readonly ExecutionTarget[]): void { checkedTargets(ctx, targets); }
