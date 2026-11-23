import assert from "node:assert/strict";

export async function checkTimeout(start, questions, text) {
  // Timeout: every question answers itself with its recommended option (else the first); the result says so.
  const quick = await start({ askTimeoutMs: 400 });
  {
    const turn = await quick.asking(questions);
    assert.ok(turn.prompt.expiresAt > Date.now() - 1000 && turn.prompt.expiresAt <= Date.now() + 400, "expiresAt is the deadline");
    const { outcome, seen, result } = await quick.finished(turn.operation);
    assert.equal(outcome.status, "completed");
    assert.equal(text(seen), "User answers:\nstorage: Postgres (auto-selected after timeout)\nfeatures: [Search] (auto-selected after timeout)");
    assert.deepEqual(result.details.answers.map((answer) => answer.autoSelected), [true, true]);
    assert.equal(quick.prompts().length, 0);
  }
}
