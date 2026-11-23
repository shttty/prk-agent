import assert from "node:assert/strict";

export function assertSessionSection(section, { depth = 0, parentLabel, canSpawn = true } = {}) {
  assert.equal(typeof section, "string");
  const general = [
    "Other sessions run beside you.",
    "Each has its own context, model, kernel and tools; a child you spawn starts with none of your conversation, so its task must be self-contained.",
    "session_send delivery: steer lands at its next turn boundary, followUp after its whole run, abort interrupts it.",
    "A child finishes by session_result.",
    "Its result and any messages reach you through your inbox automatically; you are woken if idle. Never sleep or poll for them.",
    "A temporary child ends after delivering its result. A persistent child stays until you destroy it, so you can keep sending it follow-up work.",
    "Only the user can turn a child into an independent long-lived session; you may suggest it, not do it.",
    "You control your children and their descendants; the root session controls all.",
  ];
  for (const sentence of general) assert.equal(section.includes(sentence), canSpawn, `General session mechanism must follow callable session_spawn: ${sentence}`);
  const policies = section.split("\n").filter((line) => line.startsWith("Delegation policy: "));
  assert.equal(policies.length, depth === 0 && canSpawn ? 1 : 0, "Only an ownerless top-level session receives delegation policy");
  const identities = section.split("\n").filter((line) => line.startsWith("You are a child session at depth "));
  if (depth === 0) assert.deepEqual(identities, [], "A top-level session must not acquire a child identity");
  else assert.deepEqual(identities, [
    `You are a child session at depth ${depth} (top level = 0), created by ${JSON.stringify(parentLabel)} for one assigned task. Submit with session_result — plain replies are not delivered. Your parent can message, steer or abort you through your inbox.`,
  ], "The child must see its exact current owner label and owner-chain depth");
  if (!canSpawn) assert.equal(section.trim(), identities[0], "A spawn-disabled child keeps only its independent identity, not delegation policy");
}
