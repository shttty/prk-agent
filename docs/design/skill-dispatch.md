# Skill 调度：让模型在动手前读到方法

第一阶段只把 **“什么时候读”和“怎么读”放在技能目录同一处**。先测它能否接住报错、审补丁、写任务书、划模块边界，再决定是否改技能描述或做按轮推荐。OMP 的常规路径也是模型自己选，并没有一个在每轮开始前替它挑 skill 的通用分类器。

这次的现场线索是：一个 PRK 长会话一天只观察到两次读 skill，其中一次经过提醒；另有四类理应先读的任务没读。这能定位体验问题，不能当调用率：没有机会数，人工提醒也不是自主调用。下面比较源码行为，不把两个不同会话当成控制实验。

**基线源码坐标**（本节到「调度候选」为原版调查）：`O:` 相对 oh-my-pi `89d2610993` 的 `packages/coding-agent/`；`P:` 相对 PRK `5c60d5d0`；`Pi:` 相对 PRK 安装的 `@earendil-works/pi-coding-agent` 1.6.0 包。`S:` 是此次会话已广告的本机 skills 目录，不是项目随附文件。

## 从磁盘到第一步行动

### 谁决定哪一份可以用

- **OMP**：SDK 未显式收到 `skills` 才发现，否则直接用调用方的列表（`O:src/sdk.ts:1777-1786,2021-2029`）。`loadSkills` 用 capability providers 收集资源；例如 `.agent(s)/skills` 查项目祖先和用户目录，扫描器从 `SKILL.md` 解析正文、frontmatter 和名称。总开关、来源、include/ignore、disabled extensions 参与筛选，还可加 custom directories；同名且正文与 frontmatter 相同可折叠，不同内容可用命名空间区分，managed 让位于启用的 authored，最后稳定排序。发现阶段读文件不等于把正文给模型（`O:src/discovery/agents.ts:157-179`；`O:src/discovery/helpers.ts:472-499,505-520`；`O:src/extensibility/skills.ts:119-139,289-340,348-371,458-506,537-559,595-601`）。
- **PRK**：Gateway 建 Pi services；目标资源走既有 `skills.probe/resources`，传 cwd、`noSkills` 等，技能项带路径与 frontmatter，而不是为做目录回传所有正文。目标侧项目 `.agents/skills` 沿 cwd 到 Git 根（无 Git 到文件系统根），此扫描明确排除目标 home 的 `.agents/skills`；需要 Pi 解析项目配置或包时结合 SDK resolver，`match-agent-skill` 等匹配的是**资源路径开关**，不是用户意图（`P:src/sessions/runtime/resources/discover-resources.ts:17-30`；`P:src/sessions/target-resources/discover.ts:15-35,46`；`P:src/target-channel/target-resources/discovery/{discover.py:1-9,find-project-directories.py:1-10,scan-skills.py:1-21}`；`P:src/target-channel/target-resources/resolution/resolve-resources.py:14-23,49-71`；`P:src/remote-extensions/resources/resolve.mjs:19-39`）。目标条目解析出 `name/description/filePath/baseDir/disableModelInvocation`；Gateway 用 SDK collision diagnostics 保留备选项，补收 Gateway home 根层散 `.md`（`P:src/sessions/target-skills/parse-target-skills-reply.ts:15-39`；`P:src/sessions/resource-catalog/preserve-gateway-skill-candidates.ts:3-8`；`P:src/sessions/resource-catalog/discover-gateway-root-skills.ts:5-12`）。
- `PLAN.md` 的历史实例方案还写过“目标 HOME 最后单独收集”（`P:PLAN.md:284-286,290-294`）；上面的当前项目扫描路径不能证明每个目标 home 都已入表。调度只消费当前会话的可广告集合，不借这次设计恢复或扩展发现范围。
- **PRK 的最终权威是当前会话的 filtered ResourceLoader，不是管理页或全局库**。目标项目条目在前、本机与 Gateway 重叠路径只保留一份，再按来源组／单项开关、共享库范围筛选；同名取首个启用者。其它 loader 职责交还 SDK（`P:src/sessions/runtime/resources/skills/{list-skills.ts:5-9,list-gateway-skills.ts:5,is-skill-enabled.ts:6-10}`；`P:src/sessions/resource-catalog/{classify-skill-origin.ts:11-21,loader/get-skills.ts:3-10,assemble-skill-loader.ts:5-19}`；`P:src/sessions/runtime/conversation/create-sdk-session.ts:39-46,54-64`）。`SkillLibrary` 管 PRK home 下的共享文档、`library.json` 和生命周期；非归档且 scope 匹配（global、instance 或 project）的路径才参与共享库发现。它不是所有可读 skill 的数据库（`P:src/sessions/skill-library/{assemble-skill-library.ts:16-34,catalog/list-loadable-paths.ts:5-9}`；`P:src/plugins/skill-tools/assemble-skill-tools-plugin.ts:20-22`）。

### 模型看到了什么，下一步怎么读

| | OMP | PRK |
|---|---|---|
| 常规系统提示 | 默认 `skillful=true`；有可读 `skill://` 的工具，才列非隐藏项。默认模板在 Personality 后、Runtime 开头写 **“Matching skill → MUST read `skill://<name>` first.”** 下一行就是 `<skills>` 里的 `- name: description`。自定义模板在 custom prompt 后也明确写 *before proceeding*（`O:src/session/settings.ts:382-392`；`O:src/sdk.ts:3844-3845`；`O:src/system-prompt.ts:925-945,975-977`；`O:src/prompts/system/{system-prompt.md:19-35,custom-system-prompt.md:4-19}`）。 | `context_with_system` 每次请求把当前 loader 交给 `formatSkillsForPrompt(..., "indirect")`，替换 system 的 `skills` 节。SDK 隐去 `disableModelInvocation`，写 **“Load a skill's file when the task matches its description.”**，再列 `<available_skills>`，每项 name、完整 description、绝对 location；不是没有触发指令。实际读法在另一个受工具可用性控制的 `skill_tools` 节（`P:src/sessions/runtime/conversation/bind-session-hooks.ts:16-24`；`Pi:dist/core/skills.js:275-302`；`P:src/plugins/skill-tools/{assemble-skill-tools-plugin.ts:28-32,prompt/render.ts:1-5}`）。 |
| 每项占多少注意力 | 描述是 routing hint：初次无缓存取至多 100 字符预览，可后台用小模型压成单行、至多 12 词／160 字符，保留触发词；结果缓存，当前快照不被异步改写。压的是**描述**，没给压缩器用户本轮消息（`O:src/sdk.ts:3656-3667`；`O:src/extensibility/skill-descriptions.ts:23-29,41-73,95-110,258-297,312-324`；`O:src/prompts/skills/compress-description.md:1-4`）。 | 描述、路径、XML 每项常驻；路径付出了上下文成本，但也让目标机资源可定位。没有压缩丢 branch 的风险；长描述尾部的触发词与别项抢注意力（格式见上）。 |
| 自主读取 | `read`、`bash` 都声明 `readsSkillUris`。例如 `read` 把 `skill://review` 交给内部 URL router；协议按已加载名称找到入口，附相对路径则找同目录资料（`O:src/tools/{read.ts:856,read.ts:1595-1612,bash.ts:503}`；`O:src/internal-urls/{router.ts:106,skill-protocol.ts:48-82,skill-protocol.ts:121-149}`）。 | code 模式用 `gateway.skill_read(path=广告的绝对路径)` 并让正文出现在 cell 输出；direct 已声明就直接调，隐藏则先 `tool_search` 再 `tool_call`。工具复用 Pi reader 的分页参数；按目标目录分流本机／目标，拒绝 disabled、shadowed、未加载的文件。读正式 `SKILL.md` 还附 base dir 与最多十个支持文件路径，后续按需读，不预载（`P:src/plugins/skill-tools/prompt/render.ts:2-4`；`P:src/sessions/tool-declarations/call-tool.ts:5-19`；`P:src/sessions/skill-library/{create-tools.ts:11-30,tools/read-skill.ts:8-46}`；`P:PLAN.md:280-281`）。 |
| 用户点名 | `/skill:<name>`（含受限的行内 token）走命令解析，读正文、去 frontmatter，作为用户显式调用交付；隐藏项不广告，不等于卸载（`O:src/extensibility/skills.ts:37-42,629-657,671-692`；`O:src/modes/skill-command.ts:60-85`）。 | 命令目录列 `/skill:<name>`，走 slash send 而非 nativeAction；普通 prompt 是否展开由 `hostExpandPromptTemplates` 决定（默认 true），SDK 展开时读 Gateway 本机 `filePath`。因此不能拿 SDK 命令展开替代跨机 `skill_read`，也不能把用户点名算自主命中（`P:src/sessions/native-interaction/{catalog/read-sdk-resources.ts:51-56,dispatch/dispatch-action.ts:52-58}`；`P:src/sessions/host/input/dispatch.ts:7-21`；`P:src/config/session/session-options.ts:36`；`Pi:dist/core/agent-session.js:1741-1756,1820-1842`）。 |

### 哪些机制真的会主动塞东西

- **OMP 子代理确有预载**：agent 定义的 `autoloadSkills` 是名称列表；用会话 skill 集合解析，未找到的不进结果。executor 在 drive 任务前把选中**正文**作为 `display:false`、不另起 turn 的 custom message 交给子代理。触发器是 agent 配置，不是任务书语义分类（`O:src/discovery/helpers.ts:383-395`；`O:src/task/structured-subagent.ts:587-603,666`；`O:src/task/executor.ts:4393-4411`；`O:src/extensibility/skills.ts:693-703`）。PRK 的 `session_spawn` 接收共享 context 与分任务 task 等字段，没有 skills；子会话按自己的 target/cwd、工作树、角色能力建会话，首条输入是共享内容加本任务。**使用同一种目录机制，不保证同一份目录**；没有按任务缩选或预载（`P:src/plugins/sessions/create-derived-session-schemas.ts:43-58`；`P:src/gateway/derivation/spawn-derived-session.ts:24-56`）。
- **OMP 的会话通知不是每轮推荐**：中途开 `/skillful`，空会话重建提示；非空会话若有 reader 且未公告过，就把全目录 notice 隐藏投到下一轮。`autolearn.enabled` 与 `autoContinue` 默认都关；启用后有沉淀指引，可在顶层、一次有足够工具调用的正常 stop 后启动私有 capture（默认门槛 5；跳过 abort/plan/goal 等）。结果是 `manage_skill`／学习经验，供后续使用，不是当前任务第一步的技能选择。已有 skill read 还受到 prune/shake 保护，那也只发生在**读后**（`O:src/session/agent-session.ts:9830-9857`；`O:src/prompts/system/skillful-notice.md:1-6`；`O:src/autolearn/{settings.ts:7-38,controller.ts:91-142}`；`O:src/sdk.ts:3753-3765,5127-5142`；`O:src/prompts/system/autolearn-guidance.md:3-8`；`O:src/session/session-maintenance.ts:644-652`）。
- **PRK 的 `learning.autoSkills` 也是写库指引**：默认开，将“何时创建／更新”放入 `skill_tools`，不拿用户消息给 skill 排名。`recordRead` 只记共享库里匹配入口的成功读，更新最后使用时间、按 session 去重以晋级；工具结果钩子看 `skill_read` 或开启 native tools 时绝对路径的 `read`。这既不是全目录读次数，也没有“被推荐”的分母（`P:src/config/learning/learning-options.ts:1-9`；`P:src/plugins/skill-tools/{prompt/render.ts:2-5,assemble-skill-tools-plugin.ts:21-32}`；`P:src/sessions/skill-library/lifecycle/record-read.ts:8-18`）。

**诊断（推测，没实测）**：OMP 把识别、先后顺序、读入口压在一行，PRK 要先在长 XML 中辨认任务，再跨节找工具和地址。两者常规路径都靠模型判断；区别在于做对这个判断的成本。仅增强 `MUST` 可能改善“想到了但没读”，救不了“没意识到这个任务属于它”。例如 `writing-for-agents` 的描述点名了 skills、AGENTS.md、CLAUDE.md，却没点任务书；`review` 和 `code-review` 的描述近乎重复（`S:writing-for-agents/SKILL.md:2-7`；`S:{review,code-review}/SKILL.md:2-3`）。这两个缺口比猜测某个模型天生不爱读更值得先修。

## 调度候选：让哪一步变得可靠

一个 **context pointer** 要同时说清“哪一份材料”和“什么情况下去读”。一个 **branch** 对应一种不同工作，不是同义词清单。把用户会用的 **leading word** 放在 pointer 开头，例如“审补丁”，比把它埋在“用于协助软件开发……”之后有用。保留 **progressive disclosure**：目录放指针，命中才读正文，正文指向该分支才需要的 supporting file。以后即使加推荐，调度器也只移动指针，不搬运整套文件。

| 候选 | 机制与最小改动面 | 缓存与上下文 | 要付的维护成本 |
|---|---|---|---|
| A · 借 OMP 的动作顺序 | 在现有 `skills` 节里先写“任务命中说明时，先读对应入口，再做该任务”，紧邻本模式实际可用的读法；保持 SDK 过滤、转义和路径，`skill_tools` 不再重复读法。没有可跨该来源读取的工具就不发该读取指令。 | 固定目录／工具模式下前缀不随用户消息变；改版首次变一次。缩短重复文案；不去掉唯一可用的绝对路径。 | 一处提示装配，覆盖 code/direct/隐藏工具三条路径。暂不引入 OMP URL 协议、压缩模型、SQLite，也不改 SDK。 |
| B · 每轮给一个相关指针 | 在新用户 run 开始时，从当前**可广告且可读**的胜者中匹配；把“先读 `<name>`，位置见目录”放在本轮输入后面的隐藏 custom message。近况只用当前分支上一条明确任务补足“还是很慢”这类承接，新的显式任务优先，负面条件如“只解释 diff，不审”不推荐。无把握就保持原目录。 | 变的是尾部，不重写 system、工具声明或目录顺序；新增尾部和被读正文仍耗 token，`display:false` 也不是不进历史。不在每个工具回合重复追加。 | 本地确定性匹配要付漏词、歧义和跨语言的校准成本；全文向量索引／额外模型调用还需评延迟、预算和维护，首版不选。 |
| C · 在派发点缩小任务 | 子会话启动用**自己的**已加载集合，只匹配本条 `task`；共享 `context` 只作限定，别把同批兄弟的工作一并推荐。复用 B 的首轮尾部指针。可选 `tasks[i].skills` 传已知名称（不是父会话路径）；子会话按胜者解析。显式要求不可用时报告该任务未满足，不静默换成同类 skill，不替换整个目录。 | 指针只占子任务首轮少量尾部；照搬 OMP 预载正文则每个孩子都付全文成本，且自动塞入不等于它主动读。 | 无参数版不改 spawn 协议；显式字段要改 schema、派发、错误回执与通信契约。不能靠解析展示用的 `# Your assignment` 标题反推任务边界，直接用已有结构化 task。 |
| D · 把强绑定动作挂工具层 | 有明确“写给 agent 的任务书”或“审查这份 patch”的领域入口时，在调用方准备动作前给 pointer；`session_spawn` 的固定工具指引能在**写参数前**提示写作方法。执行时才提示只救得了下一步。读 `.patch` 也可能为合并、解释或排障，所以通用 `read` / shell / kernel 不挂全局钩子。 | 固定工具指引只付静态前缀；领域工具结果末尾可给局部提醒，但首次审阅可能已发生。 | 少数清晰动作便宜；要拦所有 I/O、追踪“先读才放行”就要状态和旁路处理，且只在对话里写任务书时挡不到。不为提示新增“审补丁”工具。 |
| E · 给 skill 换成能触发的中文描述 | 由 skill 作者改现有 frontmatter 的 description，每个 branch 一句短语：写给谁、要做什么。先改四个反例；澄清同义 skill 的职责，不能仅靠换个名字一起广告。 | 内容更新／重载一次；之后是稳定前缀。用短语替换原长段，不在每项尾部追加双语同义词串。 | 成本随真正的 branch 数增长，不是按项目里所有动词增长。本机共享或外部作者的 skill 需要所有者许可，PRK 本身不能偷偷改用户目录。 |
| F · 统计推荐未读 | 验收时对齐 run 的 `skill-hint`、目标名称／胜者路径、后续成功正文读取和第一项实质动作。工具事件已有 callId、名称、参数、结果、`isError` 及嵌套父 ID（`P:src/sessions/host/sdk-events/format-tool-event.ts:4-17`）。分开记“没推、推错、推对未读、读错、正文未送进模型”。 | 离线观测不进 prompt；只有推荐本身花尾部 token。 | 先从受控回放和原生记录核对，不开后台库、不扭曲 `library.json` 的晋级指标。若需常态统计，再决定是否用有时间戳的轻量事件，仅记录必要标识／结果，不复制用户原文。 |

### 今天的四个漏点，分别在哪之前接住

| 实际意图（示意，不是逐字引文） | 第一条该读的 pointer | 读得够早的界线 |
|---|---|---|
| “页面又卡住了，查下哪儿慢” | `diagnosing-bugs`：**查故障**／定位性能回退，不要求先说 debug。A+E 常驻；若仍漏，B 用“卡住”结合本轮的定位请求。原描述已含 failing/slow（`S:diagnosing-bugs/SKILL.md:2-3`）。 | 在选诊断实验、给出根因或改码前。只问术语“什么是回归”不触发。 |
| “审一下这个 patch，看有没有漏需求” | `review`：**审补丁**／对照规范和需求；B 在读 patch 前触发，派给孩子时 C 只向审阅者提示，不能等子会话 `session_result` 返回才推荐。先为 `code-review` 与 `review` 定清主入口。 | 在开始审阅 diff／输出审查结论前。仅“把补丁发我”不触发。 |
| “给子会话写任务书”或“改 AGENTS.md 里的约定” | `writing-for-agents`：**写给 agent** 的任务书、指引或 skill。A+E 接两种表达；`session_spawn` 静态入口 D 补父会话的写作时机；只有孩子自己要写文档时，C 才把这项交给孩子。 | 在父会话起草任务书／生成 spawn 参数或作者开始写 agent 文档前。由孩子事后读不能补算父会话成功。 |
| “接口怎么划？这块职责放哪一层？” | `codebase-design`：**划模块边界**／设计接口与职责。A+E 接设计讨论，若无明确 skill 名则由 B 提示；交给设计子任务时 C 接。原描述强调 module interface 与 seam（`S:codebase-design/SKILL.md:2-3`）。 | 在提出拆分、确定接口前；不等写文件。单问已有函数在哪不触发。 |

## 建议实施顺序与停止条件

**阶段 0 · 冻结题目，先测原版。** 取 10 条经脱敏的真实输入：四类各两条（尽量各有一条口语／间接表达），两条近似但不该触发的负例；至少包含父会话写任务书与子会话审阅两侧。每条保留判意图所需的前一轮、任务所有者与可用目录，事前标明期望 skill、最晚读取点、是否已有正文在有效上下文。上表是选样条件，不是捏造的十条现场记录。相同模型、thinking、角色／工具模式、上下文起点，对比 PRK 改前改后；单列用户点名、不可读和已经读过的样本。完成判据：10 条有完整标注，基线逐条可判；不要以现场的“2 次”代替基线。

**阶段 1 · 只做 A。** 保留 SDK 原生目录条目，合并触发条件与读法；同一冻结目录对比改前、改后。候选 E（改技能描述）留待单独批准，不能把两种改动混在同一轮测评。读取成功率定义为 **在界线前，正确拥有者收到正确正文的正例数 / 需新读正文的正例数**；同一技能本任务已在有效上下文则单列复用，不强迫重复读。模型只说“我会用”、工具失败、只读 supporting file、只读一小段未续读、code cell 把结果存进变量却未向模型输出，都不是成功。明确点名或强制预载另列，不刷自主读率。

建议首道门槛：8 个需新读的正例至少 **7/8**、四类均有成功，2 个负例均不误触；用同一套输入再独立跑一遍，两遍分别报分数。最终比对必须看到模型实际收到的正文与时序；受控 provider 只验路由／注入，不证明模型会选。确认目录不随用户问题变化；记录静态目录大小和首个成功读之前的工具往返。达到门槛就先停，换一批真实任务观察，而不是为了做“调度器”继续搭平台。

**阶段 2 · 只对反复漏掉的 branch 加 B。** 初版不维护第二份技能目录。一个可验的小实现是让作者把一个或两个可直接匹配的短语标在已有 description 的反引号里（如 `审补丁`）；匹配显式名称或完整已标短语，大小写／空白统一。仅在承接上一个请求时考虑近况；不能确定承接关系就只看本轮。多项同分、只提到文件、否定或转述无法消歧时不推，常规模型选择仍在。这个候选不假装懂“看下改动靠谱不”；如果冻结样例的漏项主要是同义表达，先调整少量 pointer 或保留模型选择，别靠堆规则追满分。结构化短语属于新作者约定，是否采用取决于第二阶段是否真的需要。

具体接缝是 PRK 插件的公开 `before_agent_start`：只在用户启动的新 run 返回 `message: {customType: "skill-hint", display: false, content: …}`；普通用户消息先入，再入扩展消息。SDK `display:false` 解决展示，不会清除历史、也不承诺 provider 一定命中缓存（`Pi:dist/core/extensions/types.d.ts:740-762,1145-1149`；`Pi:dist/core/agent-session.js:1553-1562,1569-1602`）。一次 run 内续调工具不会再次触发此钩子。**忙时 steer/follow-up 不是新 run 的同义词**：SDK 把 streaming 输入排进队列而不是就地启动（`Pi:dist/core/agent-session.js:1757-1769`）。首版分开报这类机会；如要求覆盖中途改任务，先用真实队列验证公开的 `context` 请求级投影能否对已交付的新用户消息加一次提示。证明不了就留缺口，不维护影子队列、不把建议塞回 system。

本阶段只在 shadow 匹配与实际注入均可核对时放行：逐样本列“推荐正确 / 应推荐”“推对但到界线仍未读 / 推对”“正例及时读 / 正例”，并查负例；不能用推荐率替代读率。相对阶段 1 让原先稳定漏掉的样例在两遍都及时读，整体仍满足阶段 1 门槛。无命中时没有附加消息，单个 run 最多一个提示；同一模型／目录／模式的相邻请求，其 system 和工具定义保持不变。可用时观察 provider 的 cached input，没暴露就只报告前缀等同性。记录尾部增加的 token 或字符及读正文成本，既不宣称零开销，也不以缓存命中率波动否定结构证据。

**阶段 3 · 用 C 解决剩下的派发缺口。** 不等阶段 2 一定上线：若根任务过线、子任务持续漏，可直接在子会话首轮投一个由结构化 task 选出的指针。先试无参数；确有“父会话指定了技能，孩子仍错选”的实例，再考虑显式 `skills`。验收同批两个孩子（审阅者／非审阅者）各自首轮，只有前者命中；再验工作树同名覆盖、目标不可用、父会话编写任务书这三种边界。明确要求却无法读取时有可定位的失败，不能按成功 admission 宣告已读。协议变动在实现提交同步更新 `docs/contract.md`。D 仅在仍有**首次动作前**的明确接点时引入；不做强制阻塞。F 在各阶段用同一口径，无需单设产品面板。

## A 的回放结果

同一组 10 条脱敏场景分别在原版、A 各跑两遍；每条新建隔离会话，固定 Claude Opus 5.5 / medium / code（Python），目录内五项 frontmatter 不变。两份审查 skill 均可用。R2 用任务文字模拟派给审阅者的输入，没有实际派发子会话。每条观察到正文入请求或首次实质动作即止。命中需同时看到成功的嵌套 `skill_read`、完整正文出现在下一次 provider 请求、HTTP 成功，以及未越过该场景的行动界线；只选对工具不算。诊断以选实验、给根因或改码为界，审补丁以审阅 diff 为界，写作以起草或派发为界，设计以给出接口或拆分为界。

原版回放的隔离护栏会拦住同时包含背景探查的整个 cell，连其中的 `skill_read` 也未执行。A 回放放宽了部分只读准备动作（如工作目录列表），但仍截断部分准备动作（如一并调用原生 `read`、`grep`）。因此可比较两侧的首个 skill 选择，**不能把原版 `?` 记作漏读，或把两侧的正文到达下限相减当作 A 的收益**。表中 `✓` 表示期望正文确实到达，`?` 表示未观察到行动界线前的结果；“仅选”未执行，“仅读”确实到达但读错入口。

| 样例／期望 | 原版 1 | 原版 2 | A 1 | A 2 |
|---|---|---|---|---|
| D1 导入从 3 秒退到 40 秒／`diagnosing-bugs` | ? 仅选正确 | ? 仅选正确 | ✓ | ✓ |
| D2 切标签变卡／`diagnosing-bugs` | ? 仅选正确 | ? 仅选正确 | ✓ | ✓ |
| R1 对照规范与解绑需求审 diff／`review` | 仅选 `code-review`，同 cell 拟读 diff | ? 仅选 `code-review` | 仅读 `code-review` | ✓ 两份均读 |
| R2 审上游派来的改动／`review` | ? 仅选 `code-review` | ? 仅选 `code-review` | ✓ 两份均读 | ✓ 两份均读 |
| W1 给子会话写导入回归任务书／`writing-for-agents` | ? 先找代码，没选 skill | ? 同左 | ? 同左 | ? 同左 |
| W2 改 `AGENTS.md` 测试指引／`writing-for-agents` | ? 仅选正确 | ? 仅选正确 | ? 仅选正确 | ? 仅选正确 |
| M1 设计导入接口与测试 seam／`codebase-design` | ? 仅选正确 | ? 仅选正确 | ✓ | ? 仅选正确 |
| M2 拆开重试、解析与落库职责／`codebase-design` | ? 仅选正确 | ? 仅选正确 | ✓ | ✓ |
| N1 只解释 diff，不审／无 | 无误触 | 无误触 | 无误触 | 无误触 |
| N2 只问函数在哪／无 | 无误触 | 无误触 | 无误触 | 无误触 |

- 首个工具动作选择正确入口（含同 cell 选中两份）：原版 **5/8、5/8**，A **6/8、7/8**。负例在两侧各两遍都为 **0/2**；分别在开始读 diff、定位函数时截断。
- 正例及时读到正文的可证下限：原版 **0/8、0/8**（分别 7、8 条未判）；A **5/8、5/8**（分别 2、3 条未判）。A 两遍均没有证据达到 7/8，写作类也没有正文到达证据，不能宣布通过阶段门槛。
- `review` 和 `code-review` 同时在目录时，四条原版审查首选全是 `code-review`；A 的四条也全先调用 `code-review`，三条在同一 cell 顺手读了 `review`。先把两个描述的职责区分开（E），才有依据看是否还要补推荐（B）或派发约束（C）。W1 四次首动作均没选写作 skill，优先给描述补「写给 agent 的任务书」这个分支（E）。W2 与被截的 M1 已经选对，先统一回放护栏再判断，不拿它们给 E 或 B/C 凑证据。

## 已拍板

- 第一阶段只做候选 A：合并触发指引与读法。暂不做候选 E，不改本机 skill 的 frontmatter `description`。
- 审补丁的默认主入口是 `review`。读到 `code-review` 单列，不当作命中 `review`；现阶段不改目录或强制排序。
- 已授权 10 条脱敏样例在同一模型、同一 thinking、同一工具模式上做改前、改后各两遍对照回放。7/8、四类均覆盖、零负例误触是本批小样本门槛。

## 尚未拍板

- **自动化边界**：建议默认给指针、不给全文，不阻塞工具；先覆盖新 run 与派发首轮。若忙时 steer 也必须同等可靠、显式 `skills` 必须硬性满足、或要常驻记录推荐未读，再分别确定对应语义与存储范围。不把这些决定塞进用户 control。
