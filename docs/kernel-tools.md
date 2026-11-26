# Kernel 工具模块契约

模块 loader、宿主 SDK、catalog 与依赖声明沿用 A 契约。`read/edit/write/grep` 已迁入内置 `files` 模块，复用独立标准库 `hashline` 库；旧分配锚点 prelude 15–18 已删除。其他旧 helper 与 `50-library.py` 保留。

## 来源与加载

- 内置来源：仓库 `src/kernel-tools/`；用户／未来生成来源：`<PRK home>/kernel-tools/`。
- 模块形状：`name.py`，或含 `__init__.py` 的 `name/` 包；名称为以英文字母开头的 Python 标识符。包的普通 Python 子模块包含在源码 payload 中。
- 同名来源选择：[模块约定](kernel-tools.md#约定)。catalog 字段为 `source`、`module`、`overridesBuiltin`。
- Gateway 静态扫描与目标 kernel 注入：[模块约定](kernel-tools.md#约定)。项目 finder/loader 注册的命名空间为 `prk_tools.<name>`。
- 跨包公开 API 使用普通 Python `import`；PRK 宿主入口见下方 `prk_tool` SDK 表。
- 同进程重装与真正重启：[模块约定](kernel-tools.md#约定)。模块代码属于可信项目代码，不是沙箱；import 中的外部副作用没有回滚机制。

## 声明与 SDK

用户创建 `<PRK home>/kernel-tools/arithmetic.py`：

```python
from prk_tool import config, tool

DEFAULT_CONFIG = {"factor": 2}
_options = config(__name__)


def scale(value):
    """Public API for another module; not advertised as a tool."""
    return value * _options["factor"]


@tool
def multiply(value: int) -> int:
    """Multiply by this module's configured factor."""
    return scale(value)
```

另一个包可用 `from prk_tools.arithmetic import scale`；包可在 `__init__.py` 重新导出自己的子模块函数。目录导出、真实签名与名称冲突：[模块约定](kernel-tools.md#约定)。

| SDK API | 作用与边界 |
| --- | --- |
| `@prk_tool.tool` | 公共同步函数标记；签名与描述见 [模块约定](kernel-tools.md#约定)。与旧全局 `@tool(persist=True)` 不同。 |
| `config(__name__)` | `DEFAULT_CONFIG` 与 `kernelTools.<模块名>`；加载边界见 [模块约定](kernel-tools.md#约定)。 |
| `host.tool_bin(name)` | 目标机绝对二进制路径；制品/校验边界见 [TGT-1](contract.md)、[模块约定](kernel-tools.md#约定)。 |
| `host.call(name, **args)` | 所属 cell 的 Gateway 回调，见 [KER-3](contract.md)、[模块约定](kernel-tools.md#约定)。 |
| `host.file_call(name, **args)` | read/edit/write 专用原生结果回调；经过同一 SDK 事件链，返回钩子后的 content/details/isError/path，边界见 [KER-13～16](contract.md)。 |
| `host.trace(operation, *args)` | trace 的操作描述；现有参数裁剪与记录限额。 |
| `host.progress(stream, text)` | `stdout` / `stderr` 进度 MIME，见 [KER-6](contract.md)。 |

模块可使用成熟 Python 库和二进制；**不规定只能依赖标准库**。应优先复用已有能力，不为插件接口重新实现通用依赖解析、协议或工具。

PRK 配置示例：

```toml
[kernelTools.arithmetic]
factor = 3
```

模块配置加载与隔离：[模块约定](kernel-tools.md#约定)。配置的持久化边界：[模块约定](kernel-recovery.md#约定)。TOML 覆盖在 Gateway 配置入口递归拒绝 `null`（包括数组元素）；省略键沿用默认值。Python 递归合并与冻结语义不变，只读值的形状仍为字典 `mappingproxy`、数组 `tuple`。

## Catalog、工具页与开关

| 目录阶段 / 范围 | 参考形状与规则 |
| --- | --- |
| 无 kernel | 内置工具的冷启动目录：`src/codemode/module-catalog/cold-catalog.json`，真实 inspect 报告的快照（含存根），再加模块名／来源／覆盖／依赖声明；用户新增或覆盖的模块为待加载（[模块约定](kernel-tools.md#约定)）。 |
| kernel 加载后 | 真实函数 inspect 报告通过 `application/x-prk-tool-catalog+json` 返回成功工具和模块错误；每个函数带 `signature`、`description`、`stub`、`types`（[模块约定](kernel-tools.md#约定)）。 |
| Gateway 缓存 | PRK home／实例／worker 的范围见 [模块约定](kernel-tools.md#约定)。 |
| 工具能力 ID | 函数 `kernel:<函数名>`；模块 `kernel:module:<模块名>`；分组 `group:tools:kernel`。 |
| 模型广告 | 实际可用且启用的函数（[模块约定](kernel-tools.md#约定)）。 |
| 开关与重载 | [模块约定](configuration.md#约定)、[模块约定](kernel-tools.md#约定)。 |
| 模块错误 | [模块约定](kernel-tools.md#约定)；错误包括语法、import、配置、缺依赖和导出名冲突。 |

用户工具目录与全局 Python 安装目录是不同来源。

## 函数存根（提示词就是 docstring）

`<kernel>` 段里每个预装函数的说明是 kernel 用 `inspect`／`typing.get_type_hints` 从函数本身生成的 Python 存根，不再手写：`def` 行（真实签名、类型注解、默认值）加 docstring **首段**；它引用的 TypedDict 按名字排序放在前面。

- 首段写一两句：用途与关键约束／替代关系（如「用它代替 open()/cat」）。细则放在空行之后的后续段落，`help(fn)` 可查，提示里不出现。
- 返回值写成具名 `TypedDict`，放在被渲染的模块里（如 `files/file_types.py`），键必须与真实返回一致；可选键用 `total=False` 的子类，字段说明用 `Annotated[T, "说明"]`，渲染为行尾注释。
- 无注解的参数或返回值渲染为 `Any`，不猜测；非字面量默认值渲染为 `...`。两个不同的 TypedDict 同名使该模块不可用。
- 冷启动目录是内置工具真实 inspect 报告的快照；改了内置函数的签名、注解或 docstring 后须重新生成：`PRK_UPDATE_COLD_CATALOG=1 node --test test/integration/session/kernel-stubs.test.mjs`。同一测试断言快照与真实 kernel 的报告一致，且两条路径渲染的 `<kernel>` 段逐字节相同。
- cell 里的 `help()` 输出归属该 cell（标准 `help()` 写到 cell 输出之外）。

## 保留包 `__prk__`

- 所有预装函数的唯一实体是 `sys.modules["__prk__"]` 的属性：前导库的 `bash/ls/glob/phase/tool/library_sync/tool_bin/disk_usage`、`gateway`、已加载的沉淀工具，以及文件等模块工具（loader 把它们绑到同一模块）。用户全局里的同名只是别名；cell 命名空间预绑定 `__prk__`，`from __prk__ import read` 与 `__prk__.read(...)` 在别名被覆盖或 `del` 后仍指向预装函数。
- 不自动恢复被覆盖的别名。cell 结束时若某个别名不再是预装对象，输出末尾追加一行 `[PRK] ...`，列出名字并给出 `__prk__.<name>(...)`；每个名字每次覆盖只提示一次，别名重新指回预装函数后再覆盖会再提示；未覆盖时没有提示；isolated cell 不检查。
- kernel 重启（reset）重建模块与别名；同进程 `/reload` 保留命名空间，也不替用户恢复被覆盖的别名，不重复提示。

## 依赖声明与制品分发

包用 `name/prk-tool.toml`，单文件模块用旁边的 `name.prk-tool.toml`，可省略无依赖声明。扫描到旧 `prk-tool.json` / `<name>.prk-tool.json` 时，该模块经既有 `module.error` 路径报告转换及改名要求；即使新清单存在也不读取旧 JSON，不影响其他模块。

```toml
[dependencies]
binaries = ["rg"]
python = []
```

### 本阶段已实现：二进制

- 声明二进制的 import 前解析和按需 `host.tool_bin`：[TGT-1](contract.md)、[模块约定](kernel-tools.md#约定)。
- Gateway manifest 为 `<PRK home>/assets/manifest.json`，blob 为 `assets/store/<sha256>`。
- 平台报告字段为 `platform.system()` / `platform.machine()`；支持 Linux x86_64／aarch64。
- 二进制在实例环境下发（会话启动发现缺失时自动，或手动下发）时按固定 SHA256 分块传输并校验；typed `binary` callback 只读制品元数据，kernel 不隐式部署。目标缓存为 `<targetCacheRoot>/bin/<sha256>/<name>`，默认 `~/.cache/prk/bin/<sha256>/<name>`；根目录配置见[执行配置](configuration/execution.md#targetcacheroot-top-level)。
- 初始化时的业务回调边界：[KER-3](contract.md)、[模块约定](kernel-tools.md#约定)。

### 本阶段明确未实现：Python wheel 分发

STEER1 允许本阶段只给方案。声明接口已保留：

```toml
[[dependencies.python]]
name = "package-name"
version = "1.2.3"
sha256 = "<64 lowercase hex>"
filename = "package_name-1.2.3-py3-none-any.whl"
```

非空 `dependencies.python` 的可用性规则：[模块约定](kernel-tools.md#约定)。其他模块隔离见 [模块约定](kernel-tools.md#约定)。

历史 wheel 分发方案（未实施，不是已实现合同）：

- 上传与版本索引扩展现有制品 manifest 的对象类型／wheel 文件 metadata，blob 继续复用同一 `store/<sha256>`。不能用 Linux 二进制平台字段冒充 wheel 兼容性。
- Gateway 按固定包版本、wheel 文件名／标签和已存 SHA256 选择制品，沿既有 stdin 分块通道分发；未来目标缓存归 `<targetCacheRoot>/wheels/<sha256>/`，核验后安装／解包并加入该 kernel 的 `sys.path`。这条路径尚未实现；将复用标准 `zipfile` 处理纯 Python wheel，不手写 ZIP。
- 首先只支持 `py3-none-any`；必须明确拒绝包含不支持的安装布局或 native extension 的 wheel。依赖集应预先锁定、离线完整提供，不在目标机求解／下载递归依赖。
- 扩大支持范围时，目标机报告 Python implementation／版本／ABI／OS／架构，用成熟 `packaging.tags` 等库求兼容 tag 交集，选择匹配 wheel；没有匹配 wheel 则只使相关模块失败。不能只凭文件名含 linux 或只比较 CPU 架构。
- loader 已在 import 前集中处理 `dependencies`，catalog 同时携带声明；未来增加 wheel installer 不改变模块装饰器、`config` 或 host 回调契约。

## 历史迁移与模型生成工具统一方案（未实施）

| 现有能力 | 后续归属 |
| --- | --- |
| `read/edit/write/grep` | 已迁入 `src/kernel-tools/files/`，通过公开 `prk_tools.hashline` API 复用纯库；见下方文件模块契约。 |
| `bash/glob/ls` | 按业务分别模块化，二进制只走 SDK／制品通道。 |
| `phase/tool_bin` | 公开工具外壳可模块化，宿主通道保留在 SDK 实现。 |
| memory／namespace／trace | kernel 生命周期宿主服务，不按普通模块复制权威状态；公共操作再决定是否做工具外壳。 |
| `50-library.py` / `@tool(persist=True)` | 当前不动；下一步把源码改为同一模块包格式，生命周期元数据继续归现有 ToolLibrary。 |

生成工具的统一方案：Gateway 仍只存源码与元数据；`tools/library.json` 继续管理 name/version、staging/promoted/archived、manual、distinctSessions、successfulCalls、lastUsedAt 和原有容量／老化／手动转正规则，不在新 loader 里建立第二套计数。生成代码写成同一 `kernel-tools/<name>/` 包＋`@prk_tool.tool`／依赖声明，由同一 loader import、inspect、报可用性。只有真实成功调用才通过现有使用记录入口增加计数，按 SDK sessionId 去重；不把 import、目录查看或模型宣称成功计为使用。版本与归档选择继续由 ToolLibrary 决定。切换时一次性迁移所有调用方并删除旧函数源码格式／旧 loader，不保留兼容别名；具体持久记录切换与产品入口待另一个获批任务。

## 文件模块与纯库（PRK-FILETOOLS）

- `src/kernel-tools/hashline/` 只依赖标准库，不认识 PRK。公开 `Session(execute=...)`、`HashlineError`；execute 接收 `(name,args)` 并返回原生 `{content,details,isError?,path?}`。纯库只读取、校验、定位与刷新展示，不实现写文件。普通 Python 可从 `src/kernel-tools` import，kernel 中使用 `prk_tools.hashline`；grep 只接收 `{path,number,text,match}` 行。
- `src/kernel-tools/files/` 持有一个 `Session`，显式导出 read/edit/write/grep，经 `host.file_call` 的 stdin 回调调用 Pi 公开 `ctx.executeTool`。模块常驻；原生关闭且 `kernel:module:files` 与对应函数开关均开启时，专用回调经 `src/sessions/target-files/` 的目标出口执行。原生开启时在 IO 前拒绝 files，但保留模块及展示引用；Pi 原生工具在远程宿主／本机 Gateway 执行，正常 read 返回正文或图片。rg 按需 `host.tool_bin('rg')`，缺制品只让 PRK grep 调用失败。
- `Session.shown` 的形状为 `{realpath: {行号: 64位hash}}`；状态与重启边界见 [模块约定](wire/file-tools.md#约定)。
- 配置示例：`{"kernelTools":{"files":{"align_window":2000,"max_edit_bytes":209715200}}}`。窗口／本地编辑读取上限仍由纯库校验；远程目标另有 200 MiB 硬上限。旧 lock_timeout 配置和 flock 写入层已删除，不兼容读取。
- kernel read 发出实际页的 path/offset/limit；远程嵌套 execute 不读文件，仅通知插件，追加结果回到 read 输出。写后目标 hash 与钩子完成后的本地文件比对，实际 diff 刷新展示引用；不从 Gateway 接收文件全文。
- 传输、换行／EOF、结构化结果与短 hash 限制见 [文件工具 wire 契约](wire/file-tools.md#salted-hashlines)，边界规则见 [KER-13～16、TGT-20～22](contract.md)。

## 派生会话工具

session_spawn 接收共享 context 与 tasks；每项保存目标、cwd、角色、模型与生命周期，Python 仅由实例选择。子会话不继承父对话；任务必须说明目标、路径、约束及交付物。工具模式由 role/派生配置决定，不接受 task.toolMode。

```python
batch = gateway.session_spawn(
    context="只读检查两个独立模块，报告证据与风险，不修改文件。",
    tasks=[{"task": "检查 src/config/ 的解析边界", "label": "配置检查", "role": "small"},
           {"task": "检查 src/sessions/ 的持久化边界", "label": "历史检查", "role": "small"}])
print(batch)
```

返回 `{children:[{index,sessionName,sessionId,taskId}],errors:[{index,error}]}`；准入不是完成。部分失败保留已接纳身份，不重放整批。完成独立工作后结束回合，结果经原生消息送达，不轮询。

每项可带 outputSchema；子会话用 session_result(summary=..., artifacts=[...], output=...) 提交。校验失败不改变阶段或发布成功结果；成功结果进入父会话原生receipt并自动标记delivered，不需要确认工具。精确控制与生命周期见 [会话协议](wire/sessions.md)。


## 聚焦验收入口

使用显式自有 HOME/PRK_HOME、PI_TEST_PYTHON 与制品目录；浏览器用 PI_TEST_PLAYWRIGHT/PI_TEST_CHROMIUM，SHELL=/bin/bash。不得访问生产服务。

[集成检查](kernel-recovery.md#test-environment) 用自有 daemon、REPL、Gateway 与受控 provider 跑 kernel 执行和中断。



## 约定

- 所有 `gateway.*` 调用、内核模块工具及其 `host.call(name, **args)` 结果均为原生 Python `dict`／`list`／`str`／`int`／`float`／`bool`／`None`，不得把 PRK 自有结构化结果编码成 JSON 字符串或要求调用方 `json.loads`。PRK 结构化工具必须声明 `outputSchema` 并返回 `structuredContent`；插件有 `structuredContent` 时优先使用，否则逐字返回文本 `str`，不猜测或解析看似 JSON 的文本。调用失败必须抛出 Python 异常。此规则只改变代码回调值，不改模型直接调用的 `content`；传输信封、结果通知 JSON 行与注入参数字符串仍按各自协议解码。
- `files/__init__.py` 先发布 `DEFAULT_CONFIG`，再由 `assemble_files` 初始化唯一 `Session`，最后显式导出原 `@tool` 函数；`file_state.py` 持唯一文件工具 ctx。`hashline/assemble_session.py` 只绑定公开 Session 方法，内部动作直接传 ctx，不经 `_call/_context/_edit/_diff` 实例转发；编辑和 diff 状态由各自装配创建，不保留空类型基类。`__init__.py` 只公开导入，复用既有递归收集与 `sys.modules` 生命周期。
- prelude、loader 与 SDK 共用 `target-channel/deployment-source/read-python-source.ts` 递归发现与排序，根层 `assemble-*` 最后加载并声明实际初始化顺序，不维护逐文件清单或二次读取转发层；保留 `__prk__`／`_prk_tool_loader`／`prk_tool` namespace 与虚拟文件名、linecache 和同进程状态。SDK host 视图只绑定原 SDK 模块 ctx，不复制 `_host` 或配置状态。
- stdlib REPL 的最低 Python 为 3.9：prelude/SDK 使用 `ast.unparse` 与字符串 prefix/suffix API。runner 无 IPython 依赖，业务工具可使用目标已有包。
- 同名用户内核工具必须整模块覆盖内置工具，不得混用两者包文件。
- 网关只能只读扫描内核工具源码及 `TOML` 声明，不得在网关导入或执行模块。
- 内核工具必须经目标内核执行通道加载。
- 模块工具必须仅注册显式标记的公共同步 `Python` 函数。
- 模块工具签名、描述与存根必须来自真实 `inspect` 结果；描述和存根只取 docstring 首段，无注解处必须为 `Any`。
- 名称冲突必须使该模块不可用，不得覆盖其他模块、旧辅助函数或沉淀工具。
- 模块初始化除制品请求外不得调用宿主业务。
- 模块导入前必须解析所声明的二进制依赖。
- 二进制依赖必须在校验后原子安装。
- 二进制依赖不得由目标机联网下载。
- 非空 `Python wheel` 依赖声明必须使模块不可用，不得联网安装、借用网关包或假装安装成功。
- 首次内核 `inspect` 前的内置工具目录必须是真实 `inspect` 报告的快照，渲染的提示不得与 `inspect` 后不同；用户新增或覆盖的模块只能标待加载，不得伪造签名。
- 列模块目录不得创建内核或请求模型。
- 模型必须仅看到实际可用且启用的函数。
- 同一 `Python` 进程重装前导库只能重绑宿主，必须保留已导入模块对象及状态。
- 模块源码、配置、删除或失败导入的变更必须经内核重启生效。
- 模块语法、导入、配置、依赖或导出名错误必须隔离为该模块不可用，不得中止无关模块或旧前导库；依赖失败模块的导入可一并失败。
- 工具及技能开关必须立即改变权限并在下一模型请求过滤广告，不得为开关重载 SDK 或 kernel。
- kernel 函数与模块函数必须每次通过所属 cell 的专用权限通道读当前开关，保留全局函数及旧别名并对关闭调用抛明确异常。
- 工具或技能开关不得视为 `Python` 导入卸载或安全隔离。
- 原生工具切换必须保留同一 kernel、模块与变量；只在实际请求 restart／reset 或内核生命周期需要时清空内存。
- 内核工具检查目录必须按本项目主目录及实例缓存在网关内存中。
- 实例及工作进程结果必须保留自身可用性，不得据其他实例成功宣称本实例可用。
- 检查目录全局合并必须优先成功结果。
- 模块加载边界必须递归合并有限 `JSON` 默认值与 `kernelTools` 覆盖，拒绝未知键及精确类型不匹配。
- `kernelTools` 覆盖必须在 Gateway 配置入口一次性递归拒绝所有 `null`，包括嵌套数组元素；Python 默认值合并与冻结规则不变。
- 模块配置必须每进程缓存一次并返回递归只读值。
- 具体数值范围必须由模块校验。
- `files.align_window` 与 `files.max_edit_bytes` 必须是正整数；旧 `files.lock_timeout` 不再接受。
- 文件模块配置变更必须经内核重启生效。
