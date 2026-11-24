import assert from "node:assert/strict";
import { test } from "node:test";
import { renderSkills } from "../../../src/sessions/runtime/prompt/skills/render.ts";
import { renderSkillTools } from "../../../src/plugins/skill-tools/prompt/render.ts";

const skills = [
  { name: "visible", description: "A < B & C", filePath: "/skills/visible/SKILL.md" },
  { name: "hidden", description: "explicit only", filePath: "/skills/hidden/SKILL.md", disableModelInvocation: true },
];
const trigger = "you MUST read its full SKILL.md before proceeding.";

const code = (language, declared = ["kernel_code"]) => ({ mode: "code", language, declared });
const direct = (declared, skillReadHidden = false) => ({ mode: "direct", language: "python", declared, skillReadHidden });

for (const [name, reader, method] of [
  ["Python code", code("python"), "print(gateway.skill_read(path=absolute_skill_path))"],
  ["Bun code", code("bun"), "display(await gateway.skill_read({path: absolute_skill_path}))"],
  ["direct", direct(["skill_read"]), "Call skill_read directly"],
  ["hidden", direct(["tool_search", "tool_call"], true), "Use tool_search to find skill_read, then use tool_call"],
]) {
  test(`skills places the ${name} reader beside the trigger`, () => {
    const prompt = renderSkills(skills, reader);
    assert(prompt.split("\n")[0].includes(trigger));
    assert(prompt.split("\n")[1].includes(method));
    assert.match(prompt, /<description>A &lt; B &amp; C<\/description>\n    <location>\/skills\/visible\/SKILL\.md<\/location>/);
    assert.doesNotMatch(prompt, /explicit only|Load a skill's file/);
  });
}

test("skills lists metadata without inventing a read route", () => {
  for (const reader of [undefined, code("python", []), direct(["read"]), direct(["tool_call"], true), direct(["tool_search", "tool_call"])]) {
    const prompt = renderSkills(skills, reader);
    assert.match(prompt, /^<available_skills>/);
    assert.doesNotMatch(prompt, /skill_read|MUST read|Use absolute paths/);
  }
  assert.equal(renderSkills([skills[1]], direct(["skill_read"])), "");
});

test("skill_tools retains only the optional write guidance", () => {
  const options = { instance: "fixture", autoSkills: true };
  assert.equal(renderSkillTools(options, ["skill_read"]), "");
  assert.equal(renderSkillTools({ ...options, autoSkills: false }, ["skill_manage"]), "");
  const prompt = renderSkillTools(options, ["skill_read", "skill_manage"]);
  assert.match(prompt, /skill_manage/);
  assert.doesNotMatch(prompt, /skill_read|tool_search/);
});
