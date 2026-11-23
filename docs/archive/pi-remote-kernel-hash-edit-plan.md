# Pi 内置远端 Python Kernel 与 Hash Edit：实现计划

更新：2026-09-15。状态：计划草案，尚未实施或部署。

本计划对应用户已明确的方向：源码使用原版 Pi；Python 主要在目标机器的标准 Jupyter kernel 里直接执行，kernel 是 Agent 的远程触手；第一批目标文件能力是配套的读取与 Hash Edit，参照 OMP，但不搬 Hash Edit Pro 或 OMP 的整套重量。当前授权是制定计划，不包含安装依赖、修改 Pi 源码、启动 kernel、部署目标机、迁移或重启现有入口。

## 1. 已定方向与本计划建议

### 已定方向

- Pi 保有模型调用、Agent 上下文、决策和会话；远端 kernel 保有 Python 执行状态与目标环境，不是另一个 Agent。
- 在 Pi 公共源码路径注册内置执行工具，不要求通过标准扩展或自有启动器注入。
- 普通 TUI 与原生 `--mode rpc` 必须使用同一实现。RPC 客户端通过 `prompt` 让模型选择工具；本轮不增加绕过模型的通用 `execute_tool` RPC。
- Python 在目标 kernel 就地调用文件、库与命令；不设置必经的本地 Python 编排 kernel，不把目标文件传回 Pi 本机改完再覆盖。
- 长期所有用户入口由自有 Gateway 统一接入、路由与分发。Gateway 实现和 Pi 实验性 server/client 都不是本轮前置。
- 现有 OMP、QQ、OpenViking 生产入口保持不动。

### 建议的首批范围，实施前随计划确认

- 内置工具暂名 `python`，输入为显式目标别名 `target` 和 Python `code`。
- Pi 的 TypeScript 实现优先使用官方 `@jupyterlab/services`，连接已有 Jupyter Server 的 REST/WebSocket；不自研 ZMQ、Python 中转 daemon 或第二套消息协议。
- 在既有 Server 上，按“Pi 会话 × 目标”懒创建专用 kernel；先不实现共享 Notebook kernel、任意已有 kernel 的自动接管。
- 目标侧提供一个小型 Python 文件模块，首批支持有界读取、原行号范围替换、插入与删除、版本冲突检测。
- Hash Edit 的首批建议是 Python 结构化调用，不要求逐字兼容 OMP 的文本补丁语言；语法块、寄存器、跨文件移动、自动修复和 LSP 不在本轮建议范围。此前二选一没有得到用户选择，不把这些删减写成已经批准的规格。

## 2. 最小运行链路

```text
普通 Pi TUI / 原生 Pi RPC
          |
同一个 AgentSession 的内置 python 工具
          |
会话持有的目标/kernel 连接
          |
目标机既有 Jupyter Server（私网 REST + WebSocket）
          |
该 Pi 会话专属 ipykernel
          |
Python 标准库 + 目标文件模块
```

将来 Gateway 接在 Pi 入口前面，不要求重写这条执行链。直接原生 RPC 是本轮验收入口，不意味着未来前端绕过 Gateway。

不做通用后端框架：当前只有标准 Jupyter 一种连接实现。连接库内部已有协议、Future、消息关联和 kernel API，优先复用。

## 3. Pi 公共接入与所有权

### 已核对的上游结构

- `packages/coding-agent/src/core/tools/index.ts`：`ToolName`、`allToolNames`、`ToolsOptions`、工具工厂分派与聚合。
- `core/agent-session.ts`：构造与 `_buildRuntime()` 组装工具；工具重载会重建 definition；会话 `dispose()` 是清理接入点。
- `core/sdk.ts`：SDK 创建会话、处理启用工具及允许/排除名单。
- `main.ts`：普通交互与 RPC 共用会话创建路径，再进入对应模式。
- `core/settings-manager.ts`、`cli/args.ts`、`src/index.ts`：配置、工具选择/帮助、公开工厂导出。

新增工具必须把名称、definition、工厂、选择校验、SDK 导出、帮助与配置接齐，而不是只改某个 TUI 初始化函数。实施时先做符号引用检查，核对选定版本的具体调用点。

### 建议实现

- 新增 `core/tools/python.ts`，只承担输入校验、调用会话执行模块、转换标准工具输出。
- kernel 连接与目标绑定由 `AgentSession` 生命周期持有；工具 definition 闭包引用它。不得在每次 `_buildRuntime()`、工具开关、cwd 变化时创建新 kernel。
- 连接实现单独放在一个小模块，暂名 `core/remote-kernel.ts`。这是运行语义的归属，不再拆成多层工厂或抽象 provider 框架。
- 工具和连接必须懒初始化；未启用/未调用 `python` 时不创建远端 kernel。
- 保留上游普通默认工具名单，通过当前用户的 `defaultTools` 或 `--tools python` 显式启用。内置不等于强制所有会话启用。
- 原有 `read/edit/bash/write` 仍明确是本地工具，不暗改为远端，也不让相同名称在不同时间偷偷指向不同机器。
- 在共同会话清理路径释放连接、处理自建 kernel；不使用全局单例或依赖自有启动器的退出钩子。

## 4. 目标配置、kernel 与环境

建议使用普通 Pi 能读取的共享配置字段，暂名 `python.targets`，与 `defaultTools` 配合；不单独发明 profile 系统。每个目标至少包含：

- 目标别名；Jupyter Server `baseUrl`，必要时独立 `wsUrl`。
- 凭据的环境变量引用，不把凭据放在模型工具参数或计划文件里。
- kernel 名称与明确的目标工作目录。
- 可配置的连接等待、中断确认、执行等待和输出大小限制。

语义：

1. 一次调用只选择一个配置目标，未知目标明确失败，不退回本机或“第一个可用 kernel”。
2. 首次调用懒创建专用 kernel，初始化工作目录并导入已准备的 Python 文件模块；普通工具调用不临时联网 pip install。
3. 同一 Pi 会话后续调用复用该目标 kernel，保留变量与导入；不同独立 Pi 会话不默认共享命名空间。
4. 同一 kernel 的前台执行串行化，不添加持久任务队列。多目标并发与后台进程管理不是首批要求。
5. 执行反馈携带目标别名、kernel 标识和目标当前 cwd；相对路径在目标解释。文件读取后保存绝对路径，后续 `os.chdir()` 不得把编辑导向另一份同名文件。
6. 正常关闭会话时，只清理由本会话创建的 kernel；不能关闭 Jupyter Server 或他人 kernel。清理有界，失败有反馈。
7. Pi 崩溃与正常关闭不同：远端 kernel 可能残留。首批不建立跨 Pi 重启的 kernel 接管注册表，也不承诺 namespace 自动恢复；残留按官方管理入口显式处理。
8. 目标 kernel 运行环境用项目级 uv 管理，独立于项目业务环境。只安装实际需要的 Jupyter/ipykernel 和小型文件模块，不默认加入 Prime 的科学计算依赖集合。

目标 Server 的准备与跨机器连通是实施阶段的显式前置；目前没有选定或授权修改某台目标机器。本轮不默认使用生产 EL7/8/9 或改台式机服务。

## 5. Python 执行、结果与取消

复用 `ServerConnection.makeSettings()`、`KernelManager.startNew()`、`KernelConnection.requestExecute()` 和对应 Future。

- 工具返回前，必须收到该请求的 `execute_reply` 和匹配请求的 IOPub `idle`；不能把任意 idle 或 HTTP 已接受当完成。
- 按 `parent_header.msg_id` 关联 stdout/stderr、`text/plain` 展示结果、执行结果和异常，不串入别的 kernel/client 请求。
- 显式设置 `allow_stdin=false`；遇到 `input()` 明确报不支持交互输入，不让 RPC 永久等一个不存在的输入框。
- Python 异常与连接错误分开。保留有界的 `ename/evalue/traceback` 和已收到的输出；不能把 `execute_reply.status=error` 当成功。
- 输出使用 Pi 标准 `onUpdate`/工具结果路径；累计输出受限，截断明确可见，不虚构已保存的完整输出附件。
- 首批支持文本输出；非文本 MIME 明确告知未展开，不伪称具有完整 Notebook 展示能力。
- 连接/中断确认等待有界；运行时长可配置，不能套用 OpenViking 的 40 秒默认值。实施时明确长执行的等待、取消和超时合同。

### 中断与断线

- Pi AbortSignal 映射到当前目标专属 kernel 的 `interrupt()`；REST 204 仅表示中断请求被接受，还需确认执行收束。
- 未确认远端停止时返回明确的“不确定/中断未确认”，不谎报目标代码已停止；后续执行前重新确认目标连接和状态。
- 不自动 restart kernel。重启会丢变量，是独立操作，不作为超时兜底。
- `@jupyterlab/services` 会自动重连并发送自身尚未发出的排队消息；普通断线不一定清理已发请求的 Future。不能把它误当成结果恢复或 exactly-once。
- 首批采用保守执行策略：连接就绪后才提交；一次执行发生传输断线就标为 outcome unknown，并终结该连接实例，避免遗留的待发代码在重连后迟到执行。它不会取消已送达 kernel 的代码，必须明确报告这一点。
- 只允许后续调用重建连接并核对状态；绝不自动复制重发未知结果的 Python 代码。模型收到 unknown 后先做只读核对，不能把工具错误理解为“修改肯定没发生”。
- kernel 仍存活可保留变量；kernel 重启、Pi 重启、输出恢复是不同问题，首批不做变量 snapshot/restore 或持久事件补齐。

## 6. 目标侧读取与 Hash Edit

### 为什么放在 Python

Python 代码主要在目标执行，读取、计算版本、应用修改和实际写入应全部靠近目标文件。小型 Python 模块暂名 `pi_remote_tools.files`，优先标准库；模块源码可与 Pi 的少量补丁共同维护，但不依赖 OMP runtime 或 Node/NAPI 在每台目标机安装。

以下是拟议接口，不是已实现 API：

```python
from pi_remote_tools import files

view = files.read("src/app.py", start=1, limit=120)
print(view)
result = files.edit(view, [
    {"op": "replace", "start": 12, "end": 14, "text": "replacement\n"}
])
print(result)
```

`read` 返回有界可见内容、原始行号、解析后的目标绝对路径和基于原始文件字节的完整 SHA-256 版本。对象保存在 kernel 变量里；输出可用短标签提示，但校验不能只用 OMP 风格的四位显示标签。

### 必须保留的合同

- 首批针对普通 UTF-8 文本文件，明确处理 LF/CRLF、空文件、Unicode、末尾换行和文件权限；不静默转码、格式化或重写未修改的空白。
- 读取有界，省略部分必须标明；行操作限定在读取视图覆盖的范围，修改其它范围先重新读。
- 同一文件的一批修改都按原始行号解释；先完整校验，再构造结果，不能前几条已落盘后才发现最后一条无效。
- 支持范围替换、前/后插入、删除；拒绝重叠或歧义操作，不做模糊匹配、猜位置或自动修复。
- 编辑时在目标侧重读、比较完整内容版本；不匹配明确返回 stale/conflict，文件保持原样。
- 以目标侧单文件提交避免半写，保留应保留的文件元数据；符号链接须保持读取与写入指向一致，不把链接本身意外替换掉。
- 这是乐观版本校验，不宣称对任意不合作的外部写入者提供原子 compare-and-swap，也不做跨文件事务或特殊文件系统恢复框架。
- 成功返回实际变化摘要、diff 与新版本依据。旧 view 不再作为下次编辑依据；继续编辑先重新读取。
- Python 任意代码本来就能绕过 helper 直接写文件；该模块是可靠工具合同，不是文件安全沙箱。

OMP 参考的是“读出版本依据 → 原行号修改 → 过期拒绝 → 获取新依据”的闭环；不预设搬运它当前的 Rust/NAPI 引擎、语法块寻址、CUT/PUT 寄存器、自动修复、LSP 和多编辑模式。

## 7. 可观察性与现有插件的关系

- Pi 默认能观察到一次 `python` 工具调用。Python 内部的 `files.read/edit` 不会自动生成 Pi 原生 read/edit 的工具事件，也不会自动经过原 read/edit 扩展钩子。
- 首批通过标准 Python 输出/结果给出操作摘要、目标、冲突原因和 diff；保留 Agent 的工具开始/更新/结束事件。不另造嵌套工具调用协议。
- 如果以后明确需要把 Python 内部每个工具映射到 Pi 插件钩子或独立 UI 事件，再设计那条调用路径；不把它偷偷算作本轮已有能力。
- 连接日志带时间和目标别名/阶段/错误类别，不记录 token、完整连接配置或含认证参数的 WebSocket URL。
- 首批不改普通插件加载器、Pi 会话格式、模型 Provider 或 Gateway。新增内置工具与现有插件共存，不承诺所有插件都能观察 Python 内部副作用。

## 8. 实施顺序与完成门槛

### A. 固定源码基线与接入一个真实 kernel

- 建议以当前稳定 Pi 0.85.1 对应源码为起点，另建小型功能分支；不自动追 main 或混用不同提交的内部包。
- 本轮注册点调查包含官方 main；实施前对照所选提交重读，不把 main 的接口误当成稳定 tag 已有。
- 加公共内置工具与配置，接官方 Jupyter 客户端；用隔离目标验证执行、变量跨调用保留、文本输出和 Python 异常。
- 工具 reload/禁用再启用不重置 kernel；不同 Agent 会话不串变量。

### B. 实现目标文件模块与版本化编辑

- 先在临时文件证明读取视图、准确替换/插入/删除、整批校验和新版本反馈。
- 回归重点：外部修改后拒绝且零额外写入、无效后续操作不造成部分提交、重复内容不猜位置、CRLF/末尾换行、cwd 变化不编辑错文件。
- 只留下能防真实错误的少量测试，不为包装转发、固定提示措辞或内部字段堆测试。

### C. 经原生 Pi RPC 完成真实闭环

- 用源码普通入口 `--mode rpc --tools python` 和隔离配置启动，不使用自有 Gateway，也不临时注入 customTools/内联扩展。
- 真实模型调用 Python，读取测试文件、保留 view、按要求编辑，再读取确认实际内容；不是仅验证注册或模拟工具回声。
- 观察标准 RPC 工具开始、增量输出、结果和最终状态。普通 TUI 使用相同工厂，并至少做一次实际界面确认。
- 同一目标变量跨调用保留；两个测试目标放同名文件/不同标识，确认只修改选中目标，Pi 本机同名文件不动。
- 同机两个 kernel 可用于隔离初验，但最终还需一次真实跨机器受控文件编辑；不能把同机成功报成跨机器验收。

### D. 取消、断线与收尾

- 中断正在执行的前台 Python，验证已确认停止与未确认停止两条结果；不自动重启 kernel。
- 用计数文件等可观察副作用，在提交后断开连接，验证没有重复提交；未知结果必须被报告。
- 测试无关请求的 idle 不会提前结束本次调用，输出超限有明确标记，不支持 stdin 时不挂死。
- 验证正常关闭只回收本会话创建的测试 kernel，连接/清理失败不静默；删除测试文件与隔离环境。

A–D 全部达到才算这一轮完成。生产接入、Gateway、多入口同步、跨重启接管、后台作业系统、完整 OMP 编辑协议和实验性 Pi server/client 都不属于本轮完工条件。

## 9. 需要在实施前明确的少量事项

1. Pi 源码工作区/分支位置与实际基线提交；当前仅提供建议，不创建仓库或改变任何安装指向。
2. 受控测试目标及其既有 Jupyter Server；是否授权准备环境、安装目标 Python 模块和创建专用测试 kernel。
3. 确认第 1 节的首批 Hash Edit 范围，以及使用共享配置显式启用 `python`、专属懒创建 kernel 的方案。工具名、模块名和配置字段名仍可在这一步简化。

不需要现在决定 Gateway 协议、实验性插件 ABI、多机调度平台或任意旧插件迁移方案。

## 10. 证据与尚未验证

已完成：阅读上游普通工具注册/RPC 路径、Jupyter 官方客户端与消息协议、OMP 当前编辑协议与快照归属；形成计划。未完成：源码编译、依赖安装、kernel 启动、真实模型调用、跨机器编辑或生产部署；本文件不是运行验收报告。

- Pi 公共工具工厂：[tools/index.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/index.ts)
- Pi 会话与工具重建：[agent-session.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/agent-session.ts)
- Pi SDK 与配置：[sdk.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/sdk.ts)、[settings-manager.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/settings-manager.ts)
- Pi 原生 RPC：[rpc.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md)
- 官方 JS 客户端：[JupyterLab services](https://jupyterlab.readthedocs.io/en/stable/api/modules/services.html)
- 执行完成与 Future：[future.ts](https://github.com/jupyterlab/jupyterlab/blob/main/packages/services/src/kernel/future.ts)
- 执行/重连实现：[kernel/default.ts](https://github.com/jupyterlab/jupyterlab/blob/main/packages/services/src/kernel/default.ts)
- Jupyter 消息与 REST：[messaging](https://jupyter-client.readthedocs.io/en/stable/messaging.html)、[REST API](https://jupyter-server.readthedocs.io/en/latest/developers/rest-api.html)
- OMP 本机已读参考：`src/edit/hashline-compact.md`、`src/edit/store.ts`、`src/tools/hashline-format.ts`、`src/edit/index.ts`（当前实现使用 `pi-natives`；是语义参考，不是拟新增依赖）。
