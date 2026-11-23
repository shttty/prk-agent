import assert from "node:assert/strict";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.js";
import { waitForSessionCondition } from "../../sessions/derivation/wait-for-session-condition.mjs";

export async function checkChildDelivery({ host, sessionId: worker, run, text, deliveries }) {
  const delivered = Promise.withResolvers();
  const toolStarts = [];
  const subscription = host.session(worker).subscribe((event) => {
    if (event.type === "session_event" && event.details?.sdkType === "tool_execution_start") toolStarts.push(event.details.toolName);
    if (event.type === "operation_completed" && deliveries.some((entry) => entry.result.summary === "CHILD_RESULT_PROOF")) delivered.resolve(event.details);
  });
  const timer = setTimeout(() => delivered.reject(new Error("Automatic code-mode child result did not arrive")), 30000);
  try {
    const spawned = await run("child = gateway.session_spawn(context='Inspect an independent input and submit the requested structured output.', tasks=[{'task':'CHILD_NATIVE_RESULT: submit the native result', 'label':'Native result child', 'lifecycle':'temporary', 'outputSchema':{'type':'object','properties':{'answer':{'const':42}},'required':['answer'],'additionalProperties':False}}])['children'][0]\nassert child['sessionName'] == 'Native result child'\nprint(child['sessionId'])");
    assert(spawned.details.callbacks.some((callback) => callback.name === "session_spawn" && callback.status === "ok"));
    assert.equal((await delivered.promise).status, "completed");
    const snapshot = host.session(worker).getSnapshot();
    const notice = snapshot.messages.filter((entry) => entry.role === "user").flatMap((entry) => parsePeerMessages(text(entry)) ?? []).find((entry) => entry.body.includes("CHILD_RESULT_PROOF"));
    assert(notice, "The existing peer inbox delivers asynchronous child results");
    const receipt = JSON.parse(notice.body.split("\n").find((line) => line.startsWith("{")));
    assert.equal(receipt.result.output.answer, 42);
    await waitForSessionCondition(() => host.workbench().archive.some(({ sessions }) => sessions.some(({ sessionId }) => sessionId === receipt.child)), "code-mode result task archive");
    const archived = host.workbench().archive.flatMap(({ sessions }) => sessions).find((entry) => entry.sessionId === receipt.child);
    assert(archived, "Receipt delivery automatically archives the actual task child");
    assert.equal(receipt.child, archived.sessionId);
    assert.equal(new Set([archived.sessionId, receipt.taskId, receipt.result.id]).size, 3);
    assert(deliveries.some((entry) => entry.result.id === receipt.result.id), "The parent provider receives the field-readable result without requesting child status");
    assert(!toolStarts.includes("session_list"), "The child-delivery lifecycle performs no status polling before inspecting the outcome");
    await run(`import json\nnotice = json.loads(${JSON.stringify(JSON.stringify(receipt))})\nassert notice['child'] == child['sessionId']\nassert notice['result']['output']['answer'] == 42\nassert 'session_acknowledge' not in {entry['name'] for entry in gateway.describe()}\nassert all(entry['sessionId'] != notice['child'] for entry in gateway.session_list())\nprint('NATIVE_ASYNC_RESULT_DELIVERED_OK')`);
    assert(toolStarts.includes("session_spawn"), "The lifecycle uses the actual nested SDK spawn tool");
    assert(!toolStarts.includes("session_acknowledge"), "No parent acknowledgment participates in delivery or archiving");
  } finally {
    clearTimeout(timer);
    subscription.unsubscribe();
  }
}
