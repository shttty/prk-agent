import assert from "node:assert/strict";

export async function checkDirectoryPaging({ run, text }) {
    const lsResult = await run("def check_ls():\n" + `from pathlib import Path
import ast
import io
from contextlib import redirect_stdout
root = Path('ls-fixture')
root.mkdir()
for name in ['z.txt', '.hidden', 'a.txt', 'line\\nbreak']:
    (root / name).touch()
(root / 'folder').mkdir()
(root / 'folder' / 'nested.txt').touch()
expected = ['.hidden', 'a.txt', 'folder/', 'line\\nbreak', 'z.txt']
page = ls(root, limit=2)
assert page == {'entries': expected[:2], 'total': 5, 'truncated': True, 'next_offset': 3}, page
joined = list(page['entries'])
while page['next_offset'] is not None:
    page = ls(root, offset=page['next_offset'], limit=2)
    assert page['total'] == 5
    joined.extend(page['entries'])
assert joined == expected, joined
assert page['truncated'] is False
complete = ls(root, limit=5)
assert complete['entries'] == expected and complete['next_offset'] is None and not complete['truncated']
with redirect_stdout(io.StringIO()) as shown:
    print(complete)
assert [ast.literal_eval(row) for row in shown.getvalue().splitlines()] == expected
with redirect_stdout(io.StringIO()) as shown:
    print(ls(root, limit=2))
assert 'offset=3' in shown.getvalue()
empty = root / 'empty'
empty.mkdir()
assert ls(empty) == {'entries': [], 'total': 0, 'truncated': False, 'next_offset': None}
many = root / 'many'
many.mkdir()
for i in range(2001):
    (many / f'{i:04}').touch()
assert len(ls(many)['entries']) == 500
capped = ls(many, limit=9000)
assert capped['total'] == 2001 and len(capped['entries']) == 2000
assert capped['truncated'] and capped['next_offset'] == 2001
assert ls(many, offset=2001)['entries'] == ['2000']
wide = root / 'wide'
wide.mkdir()
for i in range(300):
    (wide / (f'{i:03}-' + '界' * 70)).touch()
page = ls(wide, limit=2000)
assert page['truncated'] and page['next_offset'] == len(page['entries']) + 1
assert len(str(page).encode('utf-8')) <= 50 * 1024
remainder = ls(wide, offset=page['next_offset'], limit=2000)
assert len(page['entries']) + len(remainder['entries']) == 300
assert not remainder['truncated']
for path, error_type in [(root / 'missing', FileNotFoundError), (root / 'a.txt', NotADirectoryError)]:
    try:
        ls(path)
    except error_type:
        pass
    else:
        raise AssertionError(f'ls accepted {path}')
for options in [{'offset': 0}, {'offset': True}, {'offset': 1.5}, {'offset': 999}, {'limit': 0}, {'limit': True}, {'limit': 1.5}]:
    try:
        ls(root, **options)
    except ValueError:
        pass
    else:
        raise AssertionError(f'ls accepted {options}')
print('LS_PAGING_OK')`.split("\n").map((line) => `    ${line}`).join("\n") + "\ncheck_ls()");
    assert.match(text(lsResult), /LS_PAGING_OK/);
}
