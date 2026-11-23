import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { createGatewayFixture } from "./create-gateway-fixture.mjs";
import { awaitTargetFile } from "../runtime-channel/await-target-file.mjs";

const [mode, action, scopeMode] = process.argv.slice(2);
const unscoped = scopeMode === "unscoped";
const plugin = `import {spawn} from 'node:child_process'; import {writeFileSync} from 'node:fs'; import {dirname} from 'node:path';
export default function(pi) {
  pi.registerTool({name:'s5_tree',label:'tree',description:'Owned cleanup tree',parameters:{type:'object',properties:{}},execute:async()=>{
    const ordinary=spawn('sleep',['600'],{stdio:'ignore'});
    const nohup=spawn('nohup',['sleep','600'],{stdio:'ignore'});
    const escaped=process.env.PRK_EXT_SCOPE_PATH ? spawn('sleep',['600'],{stdio:'ignore',detached:true}) : undefined;
    return {content:[{type:'text',text:'owned tree'}],details:{pid:process.pid,rootPid:process.ppid,ordinary:ordinary.pid,nohup:nohup.pid,
      escaped:escaped?.pid,scope:process.env.PRK_EXT_SCOPE_PATH??null,directory:dirname(process.env.PRK_EXT_SOCKET)}};
  }});
  pi.registerTool({name:'s5_identity',label:'identity',description:'Owned other session',parameters:{type:'object',properties:{}},execute:async()=>({
    content:[{type:'text',text:'owned other session'}],details:{pid:process.pid,rootPid:process.ppid}})});
  pi.registerTool({name:'s5_freeze',label:'freeze',description:'Owned synchronous loop',parameters:{type:'object',properties:{}},execute:async()=>{
    writeFileSync('s5-frozen','entered'); while(true){};
  }});
}`;
const fixture = await createGatewayFixture(mode, plugin, { unscoped, onOwned: (paths) => process.send({ kind: "owned", paths }) });
const { host, owned, sessionId } = fixture;
const run = async (id, name, args) => {
  const start = host.state(id).messages.length;
  const admission = await host.session(id).submit({ requestId: randomUUID(), message: `S5_TOOL ${JSON.stringify({ name, args })}` });
  assert.equal((await admission.completion).status, "completed");
  const result = host.state(id).messages.slice(start).findLast((entry) => entry.role === "toolResult" && entry.toolName === name);
  assert(result && !result.isError, JSON.stringify(result));
  return result;
};
try {
  const seeded = await run(sessionId, "kernel_code", { code: "import os\ns5_keep=12345\nprint('D7_KERNEL_PID='+str(os.getpid()))", title: "D7 kernel isolation" });
  const kernelPid = Number(/D7_KERNEL_PID=(\d+)/.exec(JSON.stringify(seeded.content))?.[1]);
  assert(kernelPid > 0);
  const tree = (await run(sessionId, "s5_tree", {})).details;
  assert.equal(Boolean(tree.scope), !unscoped);
  const generation = fixture.generations.find((entry) => entry.registration?.pid === tree.pid);
  assert.equal(generation.registration.rootPid, tree.rootPid);
  let protectedHost;
  if (action === "normal") {
    const other = (await host.createSession({ target: "owned", cwd: owned.fixture.root })).session.sessionId;
    protectedHost = (await run(other, "s5_identity", {})).details;
  } else {
    const pending = await fixture.submit("s5_freeze", {});
    void pending.completion.catch((error) => console.error(error));
    await awaitTargetFile(owned.fixture, `${owned.fixture.root}/s5-frozen`);
  }
  const command = once(process, "message");
  process.send({ kind: "ready", record: { mode, action, scopeMode, gatewayPid: process.pid, root: owned.fixture.root, tree, kernelPid,
    protectedHost, runtime: await owned.identity(), connection: owned.fixture.events.findLast((event) => event.kind === "spawn"), synchronousFreeze: action !== "normal" } });
  const [message] = await command;
  assert.equal(message.action, action === "normal" ? "close-host" : "finish");
  if (action === "normal") {
    await generation.close("d7-normal-close");
    await run(sessionId, "kernel_code", { code: `assert s5_keep==12345\nassert os.getpid()==${kernelPid}`, title: "D7 kernel retained" });
    const finish = once(process, "message");
    process.send({ kind: "closed" });
    assert.equal((await finish)[0].action, "finish");
  }
} finally {
  try { await fixture.close(); }
  catch (error) {
    const leaves = (value) => value instanceof AggregateError ? value.errors.flatMap(leaves)
      : [{ message: value.message, code: value.code, details: value.details, cause: value.cause?.message }];
    await new Promise((resolve) => process.send({ kind: "shutdown-error", errors: leaves(error) }, resolve));
    throw error;
  } finally { if (process.connected) process.disconnect(); }
}
