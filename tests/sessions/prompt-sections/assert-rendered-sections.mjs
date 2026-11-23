import assert from "node:assert/strict";

export function assertRenderedSections(instructions, expected) {
  assert.equal(typeof instructions, "string", "The public request hook must expose serialized instructions, not a reconstructed context");
  assert(instructions.trim(), "Serialized instructions must be complete and nonempty");
  assert.doesNotMatch(instructions, /<\/?prk_capabilities>|Native batch example/u);
  assert.doesNotMatch(instructions, /<\/?terminals?>/u, "Terminal usage belongs to tool descriptions, not its own system section");
  const sections = new Map();
  for (const [name, present] of Object.entries(expected)) {
    const matches = [...instructions.matchAll(new RegExp(`<${name}>\\n([\\s\\S]*?)\\n</${name}>`, "gu"))];
    assert.equal(matches.length, present ? 1 : 0, `${name} must be ${present ? "rendered exactly once" : "omitted when its content is empty"}`);
    if (present) {
      assert(matches[0][1].trim(), `${name} must never be an empty XML section`);
      sections.set(name, matches[0][1]);
    }
  }
  return sections;
}
