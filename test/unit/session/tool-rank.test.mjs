import assert from "node:assert/strict";
import { test } from "node:test";
import { createToolSearchExtension } from "@earendil-works/pi-coding-agent";
import { rankTools } from "../../../src/sessions/tool-declarations/tool-rank/rank-tools.ts";
import { collectBuiltinTools } from "../../fixtures/schemas/collect-builtin-tools.mjs";

const QUERIES = ["send a message to a running session", "spawn child sessions for independent tasks", "terminal", "read output of a terminal", "ask the user", "search the web",
  "tools hidden", "session results inbox", "manage session transfer", "list sessions", "keys shortcut", "queued messages followUp", "会话 笔记", "zzqxv qqzzk"];

/** The tools Pi's tool_search ranks and loads, driven through its real extension; its answer lists the matches best first. */
async function piRanking(tools, query, limit) {
  let search;
  createToolSearchExtension()({ registerTool: (definition) => { search = definition; }, getActiveTools: () => [], setActiveTools: () => {}, getAllTools: () => tools.map((tool) => ({ ...tool, exposure: "deferred" })) });
  const { content } = await search.execute("id", { query, limit });
  return [...content[0].text.matchAll(/^- (\S+):/gm)].map((match) => match[1]);
}

test("the ported ranker returns the tools Pi's tool_search ranks, in the same order, for every query", async () => {
  const tools = collectBuiltinTools();
  const decoys = ["Open a pull request on the code host.", "Resize an image and keep the aspect ratio.", "Convert 会话 notes to 笔记 summaries.", "Send mail through the relay."]
    .map((description, index) => ({ name: `decoy_tool_${index}`, description, parameters: { type: "object", properties: { text: { type: "string", description: "Free text to send" } } } }));
  const corpus = [...tools, ...decoys];
  let matched = 0;
  for (const query of QUERIES) {
    for (const limit of [3, 8]) {
      const pi = await piRanking(corpus, query, limit);
      assert.deepEqual(rankTools(corpus, query, limit).map(({ name }) => name), pi, `${query} / ${limit}`);
      matched += pi.length;
    }
  }
  assert(matched > 20, `the queries must match tools, saw ${matched}`);
  // Nonsense tokens: ordinary words such as "this" or "matches" occur in real tool descriptions (skill_manage).
  assert.deepEqual(rankTools(corpus, "zzqxv qqzzk", 8), []);
  assert.deepEqual(rankTools(corpus, "   ", 8), []);
});

test("a query that is exactly a tool's name ranks that tool first, and the default limit is 8", () => {
  const corpus = [...collectBuiltinTools(), ...Array.from({ length: 12 }, (_, index) => ({ name: `filler_${index}`, description: "Terminal output for the session.", parameters: {} }))];
  assert.equal(rankTools(corpus, "terminal_read")[0].name, "terminal_read");
  assert.equal(rankTools(corpus, "session terminal").length, 8);
});
