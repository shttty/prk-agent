import type { ExecutionTarget } from "../../config/execution-target/target-types.ts";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { SessionLifecycleListener } from "./collection-types.ts";
import type { SessionCollectionOptions } from "./collection-types.ts";
import type { SessionRecord } from "./collection-types.ts";

export interface CollectionContext {
  readonly options: SessionCollectionOptions;
  readonly limits: LimitsOptions;
  readonly configured: Map<string, ExecutionTarget>;
  readonly sessionFactory: NonNullable<SessionCollectionOptions["sessionFactory"]>;
  readonly records: Map<string, SessionRecord>;
  readonly listeners: Set<SessionLifecycleListener>;
  closed: boolean;
  closing: Promise<void> | undefined;
}
