# Target 文件与目录工具

这些 helper 是原生工具关闭时 `kernel_code` 中的常驻 `prk_tools.files`；PRK read/edit/write 出口共用 Pi 事件链。原生工具打开时在IO前拒绝files调用，但不卸载模块、重启kernel或丢弃hashline展示表。
Standalone `prk_tools.hashline` 使用 caller-owned `Session(execute=...)`；写入由注入的原生工具执行者负责。

## Salted hashlines

规则：[模块约定](file-tools.md#约定)。
```python
view = read('example.txt', limit=20)
print(view)
a = view['lines'][0]['ref']
print(edit('example.txt', [{'op': 'replace', 'start': a, 'end': a, 'text': 'updated'}]))
```

Reference rendering：`N#hhh│content`。
`N` 是 positive 1-based line number；`hhh` 是小写 12-bit hex display suffix。
Hash input 是 UTF-8 `realpath + "\0" + logical_line`，default BLAKE2b 的前 8 digest bytes 为 64-bit table hash，显示其前 12 bits。
LF separator / CRLF 中的 CR 不属于 logical line；bare CR 属于内容。

| Helper | Parameters | Result |
| --- | --- | --- |
| `read` | `(path,offset=None,limit=None)` | `{path,lines:[{number,ref,text,omitted}],total_lines,truncated,next_offset,tool_content}` |
| `edit` | `(path,operations)` | `{path,diff:[{kind,number,ref,text,omitted}],truncated,tool_content,formatted}`，可含 `bytes` |
| `write` | `(path,content)` | `{path,written:len(content),tool_content,formatted?}`；远程格式化后可带实际 `lines` |

`read.offset` 是 positive integer line number；`limit` 默认/最高 2000，bool 不在 integer 参数域内。
Page/diff 行内容 cap 为 50×1024 rendered UTF-8 bytes；`total_lines` 在 scan 到 EOF 前是 `None`。`tool_content` 另带原生工具与插件追加文本，`print(result)` 会一并显示。
Overlong row：`text=None,omitted=True,bytes=N`，ref 仍对应完整 row。
Empty file 是一条 empty row；BOM 不显示。
UTF-16/32 BOM、scanned NUL/binary、invalid UTF-8 是错误；未扫描 tail 不在 streaming-read 检测范围。

Operations：

```python
{'op':'replace','start':'N#hhh','end':'N#hhh','text':'new lines'}
{'op':'insert','ref':'N#hhh','where':'before'|'after','text':'new lines'}
```

Replace endpoints inclusive；empty replace text 表示删除；empty insert text 表示插入 blank row。
Display table：`{realpath:{displayed_number:64_bit_hash}}`。
Alignment search window 为 submitted coordinates ±K，middle 使用 `difflib.SequenceMatcher(...,autojunk=False)`。
`HashlineError` 兼容 `ValueError`，`.context` 为 nearby current read rows。
Diff 的 `kind` 为 `-` / `+` / space；minus 是 old coordinates，plus/context refs 是 current coordinates。
Diff 带两行 context 与同一 output cap。

远程写入统一采用第一处 LF/CRLF 风格并保留既有 BOM；kernel edit 保留 EOF-newline state。
结果 ending empty row 可使无 newline 原文件获得 EOF newline；一个 terminal payload newline 终止末行。
Whole write 的 payload 决定 EOF newline，新文件保留 payload bytes。

Defaults：`kernelTools.files:{align_window:2000,max_edit_bytes:209715200}`；旧 lock_timeout 和协作 flock 已删除。
远程 edit 在目标机单次请求中按顺序执行唯一精确 oldText 替换，匹配时去 BOM、CRLF→LF；空 oldText 只接受空文件，无模糊匹配。kernel 按从后往前的定位生成 edits；重复文本需要时只扩大有界不变上下文以保持唯一，不降级成 whole write。
请求 JSON cap 1 MiB、结果（含 diff/patch）cap 256 KiB；直接 read cap 2000 行／50 KiB，目标 edit/write cap 200 MiB。计算结果超限在写前拒绝；插件写后追加结果超限可能已有磁盘副作用，不重放。
目标模块检查相邻 Vim `.swp` 至 `.saa` 与 Emacs `.#name` 的本机活 PID；不检查权限／属主，不加锁、队列或外部写入协调。路径相对 session cwd；write 创建缺失父目录。上述只约束 PRK 文件模式；Pi 原生模式不加编辑器检测。

## 原生出口与插件

工具输入：`read {path,offset?,limit?}`、`edit {path,edits:[{oldText,newText}]}`、`write {path,content}`。远程 edit details 为 `{diff:string,patch:string,firstChangedLine?,hash,path}`；hash 是原始写后 bytes 的 SHA-256。
远程模型直接 read 返回页内容；公开嵌套 id `<parent>/<n>` 的 read 不取目标通道租约、不读文件，只产生一行说明。kernel 页内容仍经 kernel_code 给模型；read 钩子看到精确实际页范围。追加结果并入 helper，整体替换 content 也只作为追加，Gateway 记日志。
文件回调使用typed `gateway` channel，专用`result:"file"`返回钩子后的content/details/isError与实际path，仅接受read/edit/write。生产者以所属kernel的`isFileCallback(name)`瞬态上下文进入现有SDK executeTool；消费者仍用同一目标files出口，不新增file协议。请求1MiB、结果256KiB，跨帧传输不放宽业务预算。
写后 hash 在 kernel 本地比对；插件改参或格式化后重读实际文件、刷新实际 diff 和新引用，未变展示行平移保留。插件错误和拦截不自动重试。
`localTools` 沿用一个开关和现有持久化。文件模块始终加载、引用状态保留；关闭原生时可调用 PRK files 与其专用出口，单工具 capability 禁用仍会拒绝。打开原生后立即拒绝 files 调用，下一请求只声明七个 Pi 原生工具；不重载 SDK、不重启 kernel。本机原生在 Gateway、远程原生在目标宿主执行；远程从不执行 Gateway 命令工具。专用文件回调以所属 kernel 的瞬态上下文关联，普通 gateway／元工具／插件不得借该通道绕过原生开关。跨边界规则见 [通信契约](../contract.md)。

## Hashline grep

规则：[模块约定](file-tools.md#约定)。
`grep(pattern,path=".",glob=None,ignore_case=False,literal=False,context=0,limit=100)`。

```python
hits = grep('needle', 'src', glob='*.py', context=2)
print(hits)
if hits['matches']:
    file = hits['files'][0]
    a = next(row['ref'] for row in file['lines'] if row['match'])
    print(edit(file['path'], [{'op': 'replace', 'start': a, 'end': a, 'text': 'updated'}]))
```

Result：`{files:[{path,lines:[{number,ref,text,omitted,match,truncated,omitted_chars}]}],matches,truncated,limit_reached,output_limited}`。
`context` 默认 0 / 最高 10；`limit` 默认 100 / 最高 1000，计 matching rows。
Paths 是 realpaths；files 保留 rg stream order；file 内 row 按 number 排序并合并重叠 context。
Render：quoted path、`>N#hhh│match`、无 `>` 的 context rows。
Long row preview 2000 Unicode characters；完整 rendered output cap 50 KiB。
No-match：`files=[],matches=0,truncated=False`。
Regex 使用 rg 语法，`literal=True` 为 fixed strings。
Default rg ignore / hidden / binary 规则生效。

## Glob

规则：[模块约定](file-tools.md#约定)。
`glob(pattern,path=".",hidden=False,gitignore=True,limit=100)` → `{files,truncated,limit_reached,output_limited}`。
`files` 是相对 `path` 的 `/`-separated normalized paths；quoted rendering 一行一项。
`limit` 默认 100 / 最高 1000；output cap 50×1024 UTF-8 bytes，256 bytes reserved for notices。

| Pattern | Selection |
| --- | --- |
| `*.py` | recursive basenames |
| `src/*.py` | direct children in src |
| `src/**/*.py` | src and descendants，`**` 可跨零层目录 |

rg argv：`--no-config --files --null --sort=path --glob ...`。
`gitignore=False` 对应 `--no-ignore`；`hidden` 是独立开关；`.git` 不在结果域内。
Ordering 为 rg stable per-directory path traversal，不是 mtime 或全字符串 byte sort。
No-match：`files=[],truncated=False`，display `[]`。

## Directory listing

规则：[模块约定](file-tools.md#约定)。
`ls(path=".",offset=1,limit=500)` → `{entries,total,truncated,next_offset}`。
`entries` 为 direct child names，包括 hidden / ignored；directory（含 directory symlink）附 `/`。
Names 按 Python case-sensitive string order 排序后再加 suffix。
`offset` 为 positive 1-based entry position；`limit` 默认 500 / 最高 2000。
Output cap 50×1024 UTF-8 bytes，256 bytes reserved for continuation hint。
Beyond-total offset 是 `ValueError`；empty directory 接受 offset 1：`entries=[],total=0,truncated=False,next_offset=None`。

```python
page = ls('src', limit=100)
print(page)
if page['next_offset'] is not None:
    print(ls('src', offset=page['next_offset'], limit=100))
```

维护边界与验证入口见 [design notes](../design-notes.md#目标文件工具的取舍与限制)。


## 约定

- PRK 文件出口预算只定义在 `target-channel/target-files/file-limits.json`；Gateway schema／结果边界直接读取，部署时由同一数据生成 Python 常量前缀后与源码拼接，不在目标机读取或写入该 JSON。
- 逐行编辑只能由当前 `Session` 已展示行的完整 64 位加盐哈希授权，不得仅凭 12 位后缀、未展示行或重启前展示表写入。
- 逐行编辑必须验证替换区间每一行。
- 远程编辑批次必须先完整校验展示引用，再调用目标机原生 edit 一次；目标机必须检查存活本地编辑器锁、完整匹配后原子替换，不得另建协作锁或写入队列。
- 重定位歧义、区间冲突或校验失败时不得部分写入。
- `grep` 必须由目标 `tool_bin` 的真实 `rg` 执行。
- 搜索必须仅授权实际返回的完整 `UTF-8` 匹配行和上下文行。
- 搜索、编码或工具缺失错误不得伪装成无匹配成功。
- 文件匹配必须按 `rg` 通配语义独立应用隐藏和忽略开关。
- 目标文件列表必须稳定并报告数量或字节截断，不得静默裁剪路径。
- 文件匹配不得跟随目录符号链接。
- 工具和路径错误不得当作空结果。
- 目录列举必须用目标 `os.scandir` 按名称返回直接子项。
- 位置分页必须在同一路径按 `next_offset` 继续，不得视为冻结快照。
- 目录列举不得裁剪名称或越过数量与 `UTF-8` 输出上限。
- 文件工具的已展示行状态必须保留在所属内核模块内，同进程清理或前导库重装不得丢失该状态。
- 内核重启或休眠后必须重新读取文件行。
- 辅助模块导入时必须一次合并并校验 `kernelTools` 配置，新值必须经内核重启加载。
- 文件工具配置不得逐次调用热加载或另建校验状态。
