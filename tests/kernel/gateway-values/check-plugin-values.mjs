import assert from "node:assert/strict";

export async function checkPluginValues({ sessionId: worker, run }) {
  await run(worker, `from prk_tool import host
expected = {'object': {'answer': 42}, 'array': [1, 2], 'text': 'native text', 'integer': 7, 'float': 1.25, 'boolean': False, 'null': None}
for suffix, value in expected.items():
    name = 'value_' + suffix
    assert gateway.call(name, {}) == value, name
    assert host.call(name) == value, name
    assert gateway.describe(name).get('outputSchema') is None
assert gateway.value_json_text() == '{"answer":42}'
assert isinstance(gateway.value_json_text(), str)
try:
    gateway.value_error()
except RuntimeError as error:
    assert 'PLUGIN_VALUE_FAILURE' in str(error)
else:
    raise AssertionError('isError structured result must throw, not return data')
print('PLUGIN_VALUES_OK')`);
  const failed = await run(worker, "gateway.value_error()", true);
  assert.match(failed.text, /PLUGIN_VALUE_FAILURE/);
  console.log("PASS plugin structuredContent without schema: object/list/scalars/null, host.call parity, literal JSON text, isError raises");
}
