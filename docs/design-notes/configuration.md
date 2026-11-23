## 配置参考迁入的说明

以下按配置主题保留实现、取舍、历史与限制；字段表、`TOML` 示例、现场安装与离线导入步骤仍在 [配置参考](../configuration.md)。

### 人写配置载体（PRK-TOML）

- PRK 自有的人写配置只读 `config.toml`、`instances.toml` 和 kernel 工具 `prk-tool.toml` / `<name>.prk-tool.toml`，沿用现有解析与默认值。SDK、插件自有配置、项目 `.prk/settings.json` 及 PRK 状态文件继续 JSON，不扩大格式迁移。
- Gateway 发现任一旧全局／实例 JSON 文件即拒绝启动；旧 kernel 清单按模块报错。一次性迁移脚本必须显式传绝对 `--home`，先整体校验 TOML 往返语义，再转换两份主目录文档并保留 `.json.before-toml` 备份；无启动双读、自动迁移或回退。
- 设置页写回复用已有 `smol-toml` 重建文档；首行说明写回来源及注释丢失。服务端本次读改写记录源 hash，原子替换前比对磁盘，不符报 `CONFLICT`；不增加客户端参数，也不声称文件系统原子比较交换。
- TOML 无 null；`kernelTools` 覆盖在 Gateway 配置入口递归拒绝所有 null（含数组元素）。Python 默认值合并／冻结不改；能力 API 的 `enabled:null` 仍是删除覆盖键，不作为文件值保存。


### 开发套件主目录与包加载

关联 [模块约定](../configuration.md#约定)。原 5、7、95、97、98、163、165、572。

- `scripts/patch-pi.mjs` 是项目的开发套件品牌初始化入口：项目资源目录改为 `.prk`；开发套件读取 `PRK_CODING_AGENT_DIR`，另设 `PI_CODING_AGENT_DIR` 是为了让项目启动的原版 `Pi` 子进程也使用相同代理目录。
进程先选主目录，再动态导入开发套件；提供方内部的公开 `getAgentDir()` 因而得到同一目录。
工作目录和目标执行目录仍是另外的概念。
- 包策略通过全局与项目设置快照实现，不改设置文件；独立 `extensions` 路径、显式附加路径和内联工厂不在包过滤范围内。共享 `ModelRuntime` 的提供方初始化不采用工作单元的包 deny/allow，但仍遵守包位置并排除默认及实例远程列表管理的包，避免在 Gateway 提前导入 target 包。
- 旧文引用 `Pi 1.1.0` 的暴露细节：活动且直接暴露的工具可调用，代码模式或延迟工具注册后可调用，仅模型内部或隐藏的工具不可调用；`kernel_code.prepareLoadout` 只隐藏声明而不停用扩展。该版本说明不再充当规则，实际可调用集合由安装版本的公开开发套件决定。
- 旧文用 `pi-web-access` 解释插件自有激活：插件可恢复对话记录中的工具集；包被过滤时启动过的工作单元，不会因项目策略变化而自动获得旧对话记录中未启用的工具；动态模式起初可能只有 `web_enable`。这是插件特性示例，不是项目对所有插件的生命周期承诺。
- 旧文第 163、572 行声称队列模式、压缩等属于 PRK 全局配置（现为 `config.toml`）；源码 `src/sessions/session-settings.ts:14-36` 已改为直接沿用 `Pi` 全局与项目设置，运行时更新只改内存快照。旧说法保留为冲突背景，不作为有效配置说明。

### 能力目录发现

关联 [模块约定](../wire/native.md#约定)、[模块约定](../configuration.md#约定)。原 144、146、148、150。

- 全量目录使用可释放的开发套件目录会话：采用 `SessionManager.inMemory`，全部工具开启且无排除项，加载已配置扩展，并执行正常的 `session_start` 发现。
已注册的 `MCP` 状态命令在非终端界面上下文中等待其连接，避免调用提示词误触模型兜底；随后关闭并释放开发套件。
内核辅助函数元数据静态读取，不启动 `Python` 或内核。
- 全局目录使所有工作单元睡眠后管理页仍有内容；会话页在目录上叠加会话开关和实际加载状态，被排除的工具仍可重新启用。全局页有手动刷新，会话页不重复该按钮。
- 原文第 148 行声称唤醒或重载合并永不删除缺失项，只有全量发现能删除。源码 `src/gateway/capabilities/catalog/merge-catalog.ts:mergeCapabilityCatalog` 已按静态内核工具目录重建 `kernel:` 项；非内核项保留累积。旧概括不再成为规则。
- 重载使用公开会话创建参数（含 `excludeTools`）重建开发套件，沿用 `JSONL` 与保留的内核；从未启动的会话重载不分配内核。这是已实现重载接缝的说明，不是另建资源状态机。

### 分发制品、缓存与导入

关联 [模块约定](../wire/artifacts.md#约定)、[TGT-4](../contract.md)、[TGT-5](../contract.md)、[模块约定](../wire/artifacts.md#约定)、[TGT-2](../contract.md)、[TGT-1](../contract.md)、[TGT-3](../contract.md)、[模块约定](../wire/artifacts.md#约定)。原 199、201、203、205、207、213。

- 上传流写临时文件，边写边算 `SHA-256`，按数据块去重并原子发布清单；删除版本后只回收不再被任何工具版本引用的数据块。网关元数据请求读取清单哈希，不重新计算整个二进制的哈希；分块请求只读需要的字节范围。
- `tool_bin` 每次重新解析 `current` 和目标体系结构，分块请求固定使用元数据中的 `SHA-256`，所以并发切换 `current` 不会混杂两个版本。目标端完整校验后以 `0755` 权限原子安装；缓存目录按内容哈希分层，回退可复用。验证缓存采用 `size`、`mtime`、`inode`、`ctime` 签名，签名变化或进程重启会触发重新校验哈希。
- 删除仍在传输的非当前版本，可能使该次传输失败；重新调用会重新解析当前版本。普通 CLI 制品没有外部来源同步，扩展构建侧的 npm/Node 下载是另一项显式安装操作；目标执行不回落网关。突然终止可留下暂存文件，没有后台清理器。
- 远程 bundle 构建使 HTTP 与 Gateway 都需要发布制品，若各持一份写者会丢失并发清单更新。正式接入把普通上传、切版、删除及扩展发布统一交给 Gateway 唯一 `ArtifactStore`；HTTP 只暂存、转发并清理上传。不增加跨进程锁或恢复框架，离线导入器运行期间需要停止 Gateway 写者；HTTP 响应和原有 hash/大小/当前版本保护不变。
- 旧布局 `assets/bin/<name>/linux-<arch>/<name>` 与 `codemode.binDir` 已被清单和存储替代；旧文件离线导入步骤仍在配置参考。导入器预检全树，拒绝不支持的条目与已存在的版本、平台组合，保留原件。输入输出失败时可能已发布此前的导入项，不能假定整个导入原子化；已有工具保持当前版本，新工具的当前版本为导入版本，默认单文件上限为 200 二进制兆字节。

### 代码桥接与展示压缩

关联 [模块约定](../wire/kernel.md#约定)、[REQ-12](../contract.md)、[模块约定](../wire/tool-content.md#约定)、[WEB-10](../contract.md)、[REQ-13](../contract.md)、[WEB-11](../contract.md)。原 195、245、422、424。

- `Python` 动态属性 `gateway.<tool_name>(**args)` 与 `gateway.call(tool_name,args)` 共用公开开发套件当前可调用集合；调用及内核模块 `host.call` 直接返回 Python 值，不要求 `json.loads`。PRK 结构化结果使用 `outputSchema`／`structuredContent`；插件优先返回 `structuredContent`，否则保留字面文本 `str`，不猜测 JSON。失败抛出 Python 异常，模型直接调用的 `content` 保持不变。工作单元提示词每回合按真实名称与结构定义构造，不维护固定辅助函数映射；代码工具描述保持静态以利提示词缓存，自有内核启动、接管或重启时重装预置代码。
- `child.name`、`child.sessionId`、`taskId`、`result.id` 分属路由、开发套件消息目标、任务和提交结果；示例使用实际返回的标识。批量 `session_spawn` 使用 `tasks[]` 和共享 `context`，返回按输入索引关联的 `children` 与 `errors`；部分接纳不得整批重放。父会话完成独立内联工作后结束本轮，不睡眠或轮询；代码模式同样由自动结果消息开启下一轮，读取并核验 `{child,taskId,result}` 后用实际标识确认。
- `kernel_code` 捕获文本复用终端压缩器，变量与内存行组成的元数据后缀加在压缩后。终端转义序列被剥离，回车进度保留末态，重复行与空行折叠，长行及总量保留首尾；内核捕获缺口只有计数标记，没有原始输出分页。展示不同时，`details.rawOutput` 保存受限的带终端转义序列原文及同一元数据后缀；相同时不重复保存。
- 惰性输入展示优先用 `args.code`，否则用美化后的 `JSON`；输出遵循网页的可打印结果约定。描述符的 `bytes`、`lines` 统计展示文本，另用完整紧凑 `JSON`（含详情、结构化内容、嵌套调用和图片）校验 `maxBytes`。预览上限为 `min(maxLines,20)`、`min(maxBytes,2048)`，且不拆分统一码字符；版本哈希覆盖完整值，而非预览。`argumentsError` 替代格式错误的开发套件输入展示文本，完整获取返回 `args:{}` 与错误，输入版本哈希包含两者。

### `Python` 操作跟踪与观测局限

关联 [模块约定](../wire/kernel.md#约定)、[REQ-12](../contract.md)、[模块约定](../configuration.md#约定)。原 255、257。

- stdlib runner 在所属 cell 窗口使用 Python 公开审计钩子，记录文件打开、重命名、删除及子进程启动到 kernel_code.details.traces。文件和命令辅助函数共用此路径，不新增跟踪权威。
解释器/标准库前缀及整数文件描述符打开被过滤；重装 prelude 时禁用不能卸载的旧审计钩子。
- 跟踪是尽力而为的操作观测，不是安全审计或沙箱。事件可能先于失败的操作，不能证明读写成功；子进程内部、原生系统调用、被排除的解释器路径不可见，异常源码缓存读取可能带来噪声。它不能防篡改，内核死亡可能丢记录；参数截断只限制大小，不隐藏记录中的敏感内容。

### 内核资源作用域、遥测与变量

关联 [模块约定](../configuration.md#约定)、[模块约定](../wire/kernel.md#约定)、[模块约定](../kernel-death.md#约定)、[KER-7](../contract.md)、[模块约定](../wire/kernel.md#约定)、[REQ-13](../contract.md)、[模块约定](../wire/kernel.md#约定)、[KER-8](../contract.md)、[KER-11](../contract.md)、[模块约定](../kernel-death.md#约定)。原 269、279、281、283、285、287、299、301。

- REPL 通过 pi-env openProcess 启动标准库 runner，选定绝对 Python；Linux 尝试独立 systemd user scope，校验真实归属与内存上限。不可用时回退独立进程组并报告 scoped:false，不伪造遥测。
- Scope 需要 cgroup v2 内存委派及有效 user manager/bus；PRK 不修改系统服务或自动切到系统 scope。
- `memory.current` 是整个控制组的计费量，包含缓存与子进程；`workingSet` 去掉 `inactive_file`；`extra` 是当前值减基线，启动页释放后可为负。
采样受解释器调度和输出背压影响，不是硬实时。重启使用新作用域基线；clear 保留当前进程与作用域，不能承诺常驻内存下降。
- 模型内存行使用本 cell 结束样本，无结束样本不借用前一次；OOM 只根据实际观测计数展示。
- 命名空间只呈现 `name`、`type`，以及检查所得的函数、方法签名和文档字符串首行；不计算 `repr` 或大小。
按对象身份与类型识别重绑定，不把原地修改标为 `modified`；`origin` 保存最近变化单元的 `title`、`phase` 与协调世界时。
共享预算先给变化项，压缩后的首个结果额外显示一次有界的当前列表，不重写开发套件对话状态。
