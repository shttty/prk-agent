# 原生记忆改为可配置层（与 pi-local-memory 共用 ~/memories）

2026-11-15 草案，待用户确认后开工。

## 目标

PRK 保留原生记忆（后端、`memory` 工具、后台复盘、设置页「记忆」、记忆变更通知），但不再写死四层：改为读 `<memory.directory>/localmemory.toml` 加 `prk` 的 override；显式设置 `memory.directory = "~/memories"` 后可与 OMP 上的 pi-local-memory 读写同一批文件。

## 现状差异（必须先统一的）

| 项 | PRK 原生 | pi-local-memory / `~/memories` | 处理 |
|---|---|---|---|
| 条目格式 | `\n§\n` 分隔，条目可多行 | 每条 `- ` 开头、空行分隔，续行要缩进 | 统一用 `\n§\n`：条目可含空行、列表、代码块，解析只按分隔符切，不会因 Markdown 写法拒写；也与 Hermes Agent 一致。`~/memories` 现有三份文件在第 4 步一次性转换（去掉 `- ` 前缀、用 `\n§\n` 拼接，留备份），与 pi-local-memory 换用新解析同一次上线 |
| 文件 | `<PRK_HOME>/memories/USER.md` 等，大写 | `~/memories/user.md`、`notes.md`、`active_control.md` | 按配置路径；PRK 旧目录为空，不迁移 |
| 层 | 写死 control/user/memory/instance | 配置列表，默认五层含 project | 按配置；补 project |
| 容量 | 1375/2200/1375，control 软上限 2000 | 每层 `capacityCharacters`，都是硬上限 | 层加 `soft = true`（超了只提醒）；control 默认 soft 由公共配置决定 |
| 快照 | 运行时创建时 `render(target.id)` 追加进系统提示 | `session_start` 冻结并写进会话 | PRK 保持自己的冻结时机，只换内容来源 |
| 复盘 | 每 10 次用户输入，固定提示词 | 轮数/工具数阈值，可写层由 `review = true` 决定 | PRK 保持自己的计数，提示词和可写层改为由配置生成 |
| 满时 | 只能删改 | 可 `sink` 进 Hindsight | 先不做，见“以后” |

## 设计

- **配置**：`<memory.directory>/localmemory.toml` + `<memory.directory>/prk-localmemory-override.toml`。`config.toml` 的 `memory` 段为 `enabled`、`directory`、`review`：`directory` 默认 PRK home 下的 `memories`（保持原位置；PRK 的四十多个集成测试只传临时 home，默认值保证它们碰不到真实记忆），生产配置写 `directory = "~/memories"` 才与 OMP 共用；`review = false` 关掉本网关的复盘（测试夹具用它取代原 `reviewInterval: 0`）。容量与复盘阈值在 TOML。PRK 打开记忆库时设 `MEMORIES_AGENT=prk`，同进程的 pi-rinne-hindsight 读 `prk-hindsight-override.toml`（现有 `pi-remote-kernel-hindsight-override.toml` 上线时改名）。配置无效时记忆停用，原因写日志并随 `/memory/list` 返回。
- **内置默认路径**：没有 `localmemory.toml` 时，五层按已解析的 `memory.directory` 生成绝对路径：`active_control.md`、`user.md`、`notes.md`、`instances/{instance}.md`、`projects/{project}/memory.md`，项目注册根目录为 `<directory>/projects`；显式 TOML 未写 `projectsDirectory` 时也使用该根目录。保存包含这些默认值的文档时保留绝对路径。显式 TOML 路径仍只接受绝对路径或 `~/…`，不引入相对路径语义。
- **路径变量**：`{instance}` = 会话绑定的目标（`ctx.target.id`，与现在一致）；`{project}` = `ctx.dependencies.projectId()`，无项目时该层不存在（不注入，工具拒写）。
- **项目注册**：首次看到某项目 id 时在 `<projectsDirectory>/<id>/project.json` 登记（名字取 PRK 的项目名），与 pi-local-memory 同格式；默认项目记忆是 `<memory.directory>/projects/<id>/memory.md`。PRK 的项目删除不动这个目录。
- **工具**：`memory` 的 `target` 枚举、描述由配置生成；`explicitOnly` 层（control）文案保持“只在明确要求时写”。批量原子提交（`commit-files.ts`）、重复/歧义/超限的报错结构保持不变。
- **复盘**：提示词按 `review = true` 的层生成路由说明；`control` 的变更仍单独发通知。
- **前端设置页**：`/memory/list` 额外返回层列表（名字、说明、容量、soft）；标签页按层生成，已知层沿用中文名（规矩/用户/记忆/实例/项目），其他显示层名。实例页照旧列出所有目标；项目页列出注册表里的项目（含 PRK 已删除的，标注“已删除项目”）。记忆变更通知不变。

## 共用代码

只共用纯函数：TOML 解析与 override 合并、路径解析、条目解析与增删改计划。以 PRK 为真源放在 `src/sessions/memory/layers/`，pi-local-memory 按 commit 原样复制进 `src/vendor/`（与 pi-lossless-context 复制 compaction-recall 内核同一做法）。

## 在 PRK 界面编辑层配置

- 设置页「记忆」加“层配置”，两个页签：公共 `localmemory.toml`、PRK 的 `prk-localmemory-override.toml`（关层、单独调字段、PRK 专用层）。
- 表单（2026-11-15 用户定）：每层一张卡片（名字、路径、说明、容量、soft、explicitOnly、review），可增删、拖动排序；另有只读“查看原文”。保存整份重新生成 TOML，手写注释不保留，文件头固定写一段说明。
- 保存：网关用同一解析器校验通过后才原子替换；请求带打开时的文件哈希，文件被别处改过即拒绝并提示刷新，不覆盖他人改动。删层只改配置，不删 `.md`。
- 生效：PRK 每次创建会话运行时重读配置，新会话即生效、无需重启网关；其他宿主（OMP 等）重启进程后生效，界面写明。

## 步骤

1. 共用纯函数落到 PRK，单测覆盖格式、合并、路径、超限（含 soft）。
2. 后端换成按配置：store、工具、渲染、复盘提示词、网关 `/memory/*`；`config.toml` 的 memory 段收窄。
3. 前端设置页按层渲染，补项目页；加“层配置”编辑（见「在 PRK 界面编辑层配置」）。
4. pi-local-memory 改为 vendor PRK 的纯函数，删掉自己的重复实现；同一次上线把 `~/memories` 的 control/user/notes 从 `- ` 格式转成 `\n§\n`（先备份），重启 IM 网关。
5. 验收：PRK 新会话的冻结快照与 OMP 新会话同源同内容；在 PRK 设置页改一条，OMP 下个会话可见；合并检查通过，并验证记忆相关 Web 操作。上线需重启 PRK 网关。

**上线顺序**：第 2–4 步必须同一次上线。`~/memories` 现在是线上 pi-local-memory 的格式（`- ` 条目、`[review]` 里有 `turnThreshold` 等键）：PRK 新后端单独上线会因未知键停用记忆，更糟的是按 `§` 把整份 `notes.md` 当成一条，一写就把条目压成一坨。所以在 daily 上做完 2–4 并通过验收前，PRK 线上仍用旧存储；切换时一次完成：转换文件格式与 `[review]` 键（先备份）、PRK 与 IM 两个网关一起重启。

**`[review]` 共用键**：`enabled`、`userTurns`（默认 10）、`toolCalls`（默认 15），自上次复盘起任一达到即触发，两个计数一起清零；在会话一次完整回复结束（`agent_settled`）后检查，不插进正在跑的工具链。工具计数保证“一句话 + 长时间自主跑工具”的会话也会复盘（2026-11-15 用户定）。PRK 补上工具调用计数；pi-local-memory 第 4 步改用同一规则，去掉 `turnThreshold`/`toolCallThreshold`/`minimumUserTurns`/`debug` 以及提示词、工具描述覆盖键（改为按层配置生成）。

## 待定

- control 是否保持软上限（PRK 现状）——默认建议保持，OMP 侧随之变软。
- 实例名：PRK 本机目标叫 `default`，OMP 已关闭 instance 层，暂不统一。

## 第 2 步实现记录（2026-11-15，分支 memory-layers）

- 工具参数的 `target` 是字符串、在存储边界按当前配置校验，没有在 schema 里枚举层名：配置每次重读，会话开始时生成的枚举会过期。工具描述、`<memory>` 节、复盘提示词仍按层生成。
- 实例 / 项目值只要求是一个路径段（无分隔符、控制字符、`.`/`..`），沿用 PRK 原实例名规则，中文目标名照常可用。
- 复盘可写 user 与 control（2026-11-15 用户定，保留 PRK R2 行为）：内置默认与 `~/memories/localmemory.toml` 均为 `review = true`，OMP 的 pi-local-memory 读同一份配置，复盘同样可写这两层。

## 第 3 步实现记录（2026-11-15，分支 memory-layers）

- 设置页「记忆」的标签页按 `/memory/list` 的层生成，末尾「配置」页编辑两份 TOML（`memoryConfigGet`/`memoryConfigSave`，哈希防并发覆盖，同一解析器校验后原子写）。
- 排序用每张卡片的上移／下移按钮，未做拖动：手机上拖动不好用，按钮两端都可靠。
- PRK override 表单：每个公共层一行（启用开关、容量覆盖、复盘跟随／允许／不允许），复盘阈值覆盖，另可加 PRK 专用层；表单没展示的补丁字段原样保留。
- 验收：检查表单改容量后 TOML 与文档页同步、磁盘被改后保存报冲突、重新载入后原文为当前文件，桌面浅色与手机深色各留截图。

## 第 4 步实现记录（2026-11-15，pi-local-memory 分支 memory-layers）

- pi-local-memory 复制本仓库 `src/sessions/memory/` 下层配置、条目解析与容量计数的纯函数（commit `4e4503e3`），删掉自己的 TOML 解析、override 合并与 `- ` 条目解析；复盘改为 `userTurns`/`toolCalls` 任一先到。
- `~/memories` 的 control/user/notes 全是单行 `- ` 条目、无标题无续行，转换只去掉 `- ` 前缀、改用 `§` 分隔；演练结果与原条目逐条一致（28/24/16 条）。
- 线上 `localmemory.toml` 随同一次切换改 `[review]` 为 `userTurns = 10`、`toolCalls = 15`，control 加 `soft = true`（与内置默认一致）。原先另有"至少 3 次用户输入"的门槛，新规则没有：只调工具不说话的长任务满 15 次工具调用也会复盘。

## 以后

- PRK 记忆满时的 `sink`（PRK 已装 Hindsight 集成插件）。
