import assert from "node:assert/strict";

export async function checkModeCombinations({ sessionId: worker, change, current, toggle, run, filesProof, nativeNames, codeTools, text }) {
  let direct;
  let counter = 0;
  let loadedNative = false;
  const combinations = [["code", false], ["direct", false], ["code", true], ["direct", true], ["code", false], ["direct", true], ["direct", false]];
  for (const [mode, enabled] of combinations) {
    assert.equal((await change(worker, mode)).status, "completed");
    assert.equal((await current()).localTools, loadedNative, "Changing mode does not change the independent switch");
    assert.deepEqual((await toggle(worker, enabled)).data, { localTools: enabled });
    assert.equal((await current()).toolMode, mode, "Changing the switch does not change mode");
    assert.equal((await current()).localTools, enabled);
    assert.equal((await current()).requiresReload, false, "Native switches only change declaration and permission layers");
    loadedNative = enabled;
    const { result, declarations: tools } = await run(`counter = globals().get('counter', 0) + 1\nassert counter == ${++counter}, 'Mode and native switches retain variables'\n${filesProof(enabled)}\nassert isinstance(gateway.session_list(), list)\nassert bash(tool_bin('mode_probe'))['stdout'] == 'mode-bin-proof'\nlibrary_sync()\nassert mode_plus(25) == 42\nassert not any(item['name'].startswith('prk_library_') for item in gateway.describe())\nprint('MODE_PROOF_${mode}_${enabled}')`);
    assert.match(text(result), new RegExp(`MODE_PROOF_${mode}_${enabled}`));
    assert(!tools.some((name) => name.startsWith("prk_library_")), "Internal library callbacks are never model declarations");
    if (mode === "code") assert.deepEqual(tools, codeTools(enabled), "Code mode adds exactly the seven SDK native tools when enabled");
    else {
      assert(tools.includes("kernel_code") && tools.includes("ask") && tools.includes("session_spawn") && tools.includes("session_send") && tools.includes("session_result"));
      for (const name of nativeNames) assert.equal(tools.includes(name), enabled, `${mode}/${enabled}: native ${name}`);
      if (!direct) direct = tools;
      assert.deepEqual(tools, [...direct, ...(enabled ? nativeNames : [])].sort(), "Direct mode adds exactly seven SDK native tools without changing its base declarations");
    }
  }
  return direct;
}
