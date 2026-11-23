import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createGatewayFixture } from "./host/create-gateway-fixture.mjs";
import { awaitTargetFile } from "./runtime-channel/await-target-file.mjs";
import { observeProcesses } from "./runtime-channel/observe-processes.mjs";

const mode = process.argv[2] ?? "local";
const plugin = `import fs from 'node:fs';
export default function(pi) {
  pi.on('tool_call', event => { fs.appendFileSync('s5-hooks.jsonl', JSON.stringify({name:event.toolName,pid:process.pid})+'\\n'); });
  pi.registerTool({name:'s5_identity',label:'identity',description:'Owned host identity',parameters:{type:'object',properties:{}},
    execute:async()=>({content:[{type:'text',text:'owned'}],details:{pid:process.pid,cwd:process.cwd()}})});
  pi.registerTool({name:'s5_block',label:'block',description:'Owned abort acknowledgment deadline probe',parameters:{type:'object',properties:{}},
    execute:async()=>{fs.appendFileSync('s5-blocked.jsonl',JSON.stringify({pid:process.pid})+'\\n'); const end=Date.now()+60000; while(Date.now()<end){}; return {content:[{type:'text',text:'late'}]}}});
}`;
const fixture = await createGatewayFixture(mode, plugin);
const { host, sessionId, owned, generations } = fixture;
const run = async (name, args) => {
  const start = host.state(sessionId).messages.length;
  const admission = await fixture.submit(name, args);
  assert.equal(admission.accepted, true);
  const completion = await admission.completion;
  assert.equal(completion.status, "completed", JSON.stringify(completion));
  const result = host.state(sessionId).messages.slice(start).findLast((message) => message.role === "toolResult" && message.toolName === name);
  assert(result, `${name} result missing`);
  assert(!result.isError, JSON.stringify(result));
  return result;
};
const kernel = (code) => run("kernel_code", { code, title: "S5 real file/host integration" });
const native = async (enabled) => {
  const response = await host.nativeAction(sessionId, { sessionId, requestId: randomUUID(), action: "local-tools", args: { enabled } });
  assert.equal(response.status, "completed", JSON.stringify(response));
};
try {
  const first = await run("s5_identity", {});
  assert.notEqual(first.details.pid, process.pid);
  assert.equal(first.details.cwd, owned.fixture.root);
  await kernel("from pathlib import Path\nimport json\ns5_sentinel=8675309\nwrite('s5-typed.txt','before\\nsecond\\n')\nv=read('s5-typed.txt')\nassert v['total_lines']==2 and v['next_offset'] is None\nr=v['lines'][0]['ref']\nedit('s5-typed.txt',[{'op':'replace','start':r,'end':r,'text':'after'}])\nassert Path('s5-typed.txt').read_text()=='after\\nsecond\\n'\nhooks=[json.loads(x) for x in Path('s5-hooks.jsonl').read_text().splitlines()]\nassert {'read','write','edit'} <= {x['name'] for x in hooks}");
  const before = host.state(sessionId);
  const kernelId = before.kernel.kernelId;
  assert(kernelId);
  await native(true);
  await run("write", { path: "s5-native.txt", content: "NATIVE_TARGET\n" });
  await native(false);
  await kernel("assert s5_sentinel==8675309\nassert Path('s5-native.txt').read_text()=='NATIVE_TARGET\\n'\nwrite('s5-off.txt','TYPED_WHILE_NATIVE_OFF\\n')\nassert read('s5-off.txt')['lines'][0]['text']=='TYPED_WHILE_NATIVE_OFF'");
  assert.equal(host.state(sessionId).kernel.kernelId, kernelId);
  const generation = generations.at(-1);
  const oldStreamId = host.state(sessionId).streamId;
  const admission = await fixture.submit("s5_block", {});
  assert.equal(admission.accepted, true);
  const blocked = JSON.parse((await awaitTargetFile(owned.fixture, `${owned.fixture.root}/s5-blocked.jsonl`)).trim());
  await host.session(sessionId).cancel({ operationId: host.state(sessionId).operation.operationId });
  const completion = await admission.completion;
  const deadline = Date.now() + 20000;
  while (generations.at(-1)?.generation === generation.generation || host.state(sessionId).streamId === oldStreamId) {
    assert(Date.now() < deadline, "Unresponsive host was not replaced");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  await observeProcesses(owned.fixture, [blocked.pid], { gone: true });
  assert.equal(host.state(sessionId).kernel.kernelId, kernelId);
  await kernel("assert s5_sentinel==8675309\nassert len(Path('s5-blocked.jsonl').read_text().splitlines())==1\nassert Path('s5-off.txt').read_text()=='TYPED_WHILE_NATIVE_OFF\\n'");
  assert.equal(host.state(sessionId).sessionId, sessionId);
  console.log(JSON.stringify({ status: "PASS", mode, sdkFileCallbacks: true, pluginHooks: true, nativeToggle: true,
    abortReplacesHost: true, kernelId, sentinelRetained: true, replayCount: 0, completion: completion.status }));
} finally { await fixture.close(); }
