import type { DerivedSessionSchemas } from "../../plugins/sessions/session-types.ts";
import { DEFAULT_DERIVED_SCHEMAS } from "../../plugins/sessions/default-schema.ts";
import type { DerivationEnvironment } from "./derivation-types.ts";
import { assertSettled } from "./ownership/assert-children-settled.ts";
import { plan } from "./lifecycle/plan-destruction.ts";
import { manage } from "./manage.ts";
import { spawn } from "./lifecycle/create-child.ts";
import { submit } from "./results/record-task-result.ts";
import { destroyByAgent } from "./lifecycle/destroy-by-agent.ts";
import { transfer } from "./ownership/propose-transfer.ts";
import { acceptTransfer } from "./ownership/assume-ownership.ts";
import type { DerivationContext } from "./derivation-state.ts";
import { destroySession } from "./lifecycle/destroy-session.ts";
import { notifyFailure } from "./lifecycle/notify-failure.ts";
import { isChanging } from "./is-changing.ts";

export function createSessionDerivation(env: DerivationEnvironment, schemas: DerivedSessionSchemas = DEFAULT_DERIVED_SCHEMAS) {
  const ctx: DerivationContext = { env, schemas, busy: new Set<string>(), closing: new Set<string>() };
  return {
    spawn: spawn.bind(undefined, ctx),
    submit: submit.bind(undefined, ctx),
    notifyFailure: notifyFailure.bind(undefined, ctx),
    destroyByAgent: destroyByAgent.bind(undefined, ctx),
    transfer: transfer.bind(undefined, ctx),
    acceptTransfer: acceptTransfer.bind(undefined, ctx),
    manage: manage.bind(undefined, ctx),
    assertSettled: assertSettled.bind(undefined, ctx),
    plan: plan.bind(undefined, ctx),
    /** User archiving from the web: same cascade as agent destruction. */
    destroySession: destroySession.bind(undefined, ctx),
    isChanging: isChanging.bind(undefined, ctx),
  };
}
