import { stringify } from "smol-toml";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPrkConfig } from "../../src/config/document/load-prk-config.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { sanitizeTargets } from "../../src/gateway/instances/format-public-instances.ts";
import { validateRequest } from "../../src/gateway/wire/validate-request.ts";

const root = await mkdtemp(join(tmpdir(), "pi-instance-config-"));
const configPath = join(root, "instances.toml");

async function load(entries) {
  await writeFile(configPath, stringify({ instances: entries }), { mode: 0o600 });
  return (await loadPrkConfig(root)).instances;
}

function instance(id, label, sshCommand = `TARGET=${id} /bin/sh`) {
  return { id, label, sshCommand, python: "/usr/bin/python3", tags: ["fixture"], cwd: root };
}

try {

  const loaded = await load([
    instance("alpha", "Research instance", "TARGET=alpha /bin/sh"),
    instance("beta", "Other instance", "TARGET=beta /bin/sh"),
  ]);
  assert.equal(loaded[0].sshCommand, "TARGET=alpha /bin/sh", "Shell command is preserved without normalization");
  assert.equal(loaded[0].local, false, "An omitted locality marker defaults to remote");
  const marked = await load([
    instance("tunnel", "Configured shell", "/bin/sh"),
    { ...instance("local", "Gateway machine"), sshCommand: undefined, local: true },
  ]);
  assert.equal(marked[0].local, false, "A shell command does not identify a local owned daemon");
  assert.equal(marked[1].local, true, "Only the explicit marker identifies the Gateway machine");
  assert.equal(sanitizeTargets(marked)[1].local, true, "Public metadata preserves explicit locality");
  for (const local of [false, true]) {
    const target = { ...instance("marker", "Marker"), local, ...(local ? { sshCommand: undefined } : {}) };
    assert.equal((await load([target]))[0].local, local);
    for (const method of ["addTarget", "editTarget"]) {
      assert.equal(validateRequest({ v: 1, id: 1, method, params: { target } }).params.target.local, local);
    }
  }
  for (const local of [null, 0, 1, "true", "false", {}]) {
    const target = { ...instance("invalid", "Invalid marker"), local };
    if (local === null) assert.throws(() => parsePrkConfig({}, { instances: [target] }), /local/);
    else await assert.rejects(load([target]), /local/);
    for (const method of ["addTarget", "editTarget"]) {
      assert.throws(() => validateRequest({ v: 1, id: 1, method, params: { target } }), /Invalid v1 request/);
    }
  }

  const publicTargets = sanitizeTargets(loaded);
  assert.deepEqual(
    publicTargets,
    [
      { id: "alpha", label: "Research instance", local: false, python: "/usr/bin/python3", tags: ["fixture"] },
      { id: "beta", label: "Other instance", local: false, python: "/usr/bin/python3", tags: ["fixture"] },
    ],
    "Public instance metadata contains stable identity, display label, explicit locality and tags",
  );
  const publicText = JSON.stringify(publicTargets);
  assert(!publicText.includes("TARGET=alpha"), "Public instance summaries omit connection commands");
  const pending = await load([{ id: "pending", label: "Pending", cwd: root }]);
  assert.equal(sanitizeTargets(pending)[0].configurationIssue.code, "SSH_COMMAND_REQUIRED");

  await assert.rejects(
    load([
      instance("one", "Same label"),
      instance("two", " same LABEL "),
    ]),
    /label|duplicate|unique/i,
    "Duplicate display labels are rejected case-insensitively without suffixing",
  );
  assert.equal((await load([instance("one", "One", "/bin/sh"), instance("two", "Two", "/bin/sh")])).length, 2,
    "Distinct instance identities may use the same shell command; commands are not canonical endpoints");
  for (const patch of [{ python: "python3" }, { sshCommand: "" }, { local: true }, { url: "http://old/" }, { token: "old" }, { defaultKernelName: "old" }]) {
    await assert.rejects(load([{ ...instance("bad", "Bad"), ...patch }]));
  }
  await assert.rejects(
    load([{ ...instance("blank", "   ") }]),
    /label/i,
    "Instance labels are required",
  );

  console.log("PASS instance configuration: explicit locality, original shell commands, instance Python, pending state, removed schema refusal and unique labels");
} finally {
  await rm(root, { recursive: true, force: true });
}
