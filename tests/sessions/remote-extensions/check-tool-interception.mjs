import assert from "node:assert/strict";
import { join } from "node:path";

export async function checkToolInterception({ call, modelResults, updates, until, logs, proof }) {
    const beforeBlocked = (await call("remote_probe", { action: "identity" })).details.calls;
    const blocked = await call("remote_probe", { action: "blocked" });
    assert.equal(blocked.isError, true);
    assert.equal((await call("remote_probe", { action: "identity" })).details.calls, beforeBlocked + 1);
    const mutated = await call("remote_probe", { action: "mutate" });
    assert.equal(mutated.details.marker, "rewritten-on-target");
    const rewritten = await call("remote_probe", { action: "rewrite" });
    assert.equal(rewritten.details.rewritten, true);
    assert.equal(modelResults.at(-1).content[0].text, "REMOTE_REWRITTEN_RESULT");
    proof("native-tool-interception", { blocked: blocked.isError, mutated: mutated.details.marker, rewritten: modelResults.at(-1).content });
    const targetError = await call("remote_probe", { action: "error" });
    assert.equal(targetError.isError, true);
    assert.match(targetError.content.map((part) => part.text ?? "").join("\n"), /TARGET_ERROR_中文/);
    const encoding = await call("remote_probe", { action: "encoding" });
    assert.equal(encoding.details.unicode, "中文\nsecond line");
    assert.equal(encoding.details.base64, "AP8R");
    assert.equal(encoding.details.nullable, null);
    assert(Object.hasOwn(encoding.details, "cleared"));
    assert.equal(encoding.details.cleared, undefined);
    assert.deepEqual(encoding.details.nested, [undefined, null]);
    assert(updates.some((event) => event.partialResult?.details?.step === "streamed"));
    await until(() => logs, (events) => events.some((event) => event.t === "log" && String(event.data).includes("stdout")));
    proof("logs-and-codec", { unicode: encoding.details.unicode, clearPreserved: Object.hasOwn(encoding.details, "cleared"), logStreams: [...new Set(logs.filter((event) => event.t === "log").map((event) => event.stream))] });
}
