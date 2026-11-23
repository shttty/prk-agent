import assert from "node:assert/strict";
import { createGatewayFixture } from "./host/create-gateway-fixture.mjs";

const plugin = `export default function(pi) {
  for (const name of ['s5_allowed','s5_denied','s5_outside']) pi.registerTool({name,label:name,description:name,
    parameters:{type:'object',properties:{}},execute:async()=>({content:[{type:'text',text:name}]})});
}`;
const fixture = await createGatewayFixture("local", plugin, { extensionFilter: {
  allow: { packages: [], tools: ["s5_allowed", "s5_denied"] }, deny: { packages: [], tools: ["s5_denied"] },
} });
try {
  const admission = await fixture.submit("kernel_code", { title: "Mandatory kernel filter regression", code: `
names = {entry['name'] for entry in gateway.describe()}
assert 's5_allowed' in names
for name in ['s5_denied', 's5_outside']:
    assert name not in names
    try:
        gateway.call(name, {})
        raise AssertionError('denied tool executed: ' + name)
    except RuntimeError as error:
        assert 'Tool ' + name + ' not found' in str(error)
assert gateway.call('s5_allowed', {}) == 's5_allowed'
print('MANDATORY_KERNEL_FILTER_OK')
` });
  assert.equal(admission.accepted, true);
  assert.equal((await admission.completion).status, "completed");
  const result = fixture.host.state(fixture.sessionId).messages.findLast((entry) => entry.role === "toolResult" && entry.toolName === "kernel_code");
  assert(result && !result.isError, JSON.stringify(result));
  assert(result.content.some((entry) => entry.type === "text" && entry.text.includes("MANDATORY_KERNEL_FILTER_OK")));
  console.log("PASS mandatory PRK kernel survives extension allowlist; plugin allow and deny stay effective through real SDK callbacks");
} finally { await fixture.close(); }
