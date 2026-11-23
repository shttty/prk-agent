import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { createFixture } from "./session-delivery/create-fixture.mjs";
import { checkBoundaries } from "./session-delivery/check-boundaries.mjs";
import { checkAbort } from "./session-delivery/check-abort.mjs";
import { checkCaps } from "./session-delivery/check-caps.mjs";
import { checkReentrant } from "./session-delivery/check-reentrant.mjs";

await withTargetFixture(async (context) => {
  const delivery = await createFixture(context);
  await checkBoundaries(delivery);
  await checkAbort(delivery);
  await checkReentrant(delivery);
  const capped = await createFixture(context, { inboxMaxMessages: 3, inboxMaxChars: 32 });
  await checkCaps(capped);
  console.log("PASS session delivery: real Gateway/Pi/kernel steer boundary, full-run followUp, immediate authorized abort with retained kernel/backlog, reentrant arrival, caps/user discard and no replay");
}, { projectRoot: "/nonexistent-prk-session-delivery-project" });
