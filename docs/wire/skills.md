# Native skill library 与来源目录

规则：[模块约定](skills.md#约定)、[模块约定](tools.md#约定)、[模块约定](skills.md#约定)。
## Shared native skill library

Native files：`<PRK home>/skills/<name>/SKILL.md`。
Lifecycle metadata：`<PRK home>/skills/library.json`。

`skill_manage` 接受以下互斥形状：

| Action | Fields | Result |
| --- | --- | --- |
| `create` | `{action,name,scope,description,whenToUse,evidence,procedure,pitfalls,verification}` | `{skill:SkillLibraryEntry}` |
| `patch` | `{action,name,section,value}` | `{skill:SkillLibraryEntry}` |
| `write_file` | `{action,name,path,content}` | `{skill:SkillLibraryEntry}` |
| `remove_file` | `{action,name,path}` | `{skill:SkillLibraryEntry}` |
| `delete` | `{action,name}` | `{deleted:name}` |

`patch.section`：`description|whenToUse|evidence|procedure|pitfalls|verification|scope`。
String sections 使用 string `value`；procedure / pitfalls / verification 使用 string arrays。
生成文档章节：When to use / Procedure / Pitfalls / Verification / Evidence。
API `whenToUse` / `evidence` 对应 frontmatter `when-to-use` / `evidence`。

| Field | Domain |
| --- | --- |
| `name` | lowercase letters/digits/single hyphens，1–64 chars |
| `description` | nonblank，1–1024 chars |
| `whenToUse` | nonblank，1–4096 chars |
| `evidence` | nonblank，1–8192 chars |
| `procedure` | 1–32 items |
| `pitfalls` / `verification` | 0–32 items |
| step item | nonblank，1–2048 chars |
| `scope` | `global` / `instance:<name>` / `project:<projectId>`，suffix nonempty，无 control chars |

```ts
type SkillLibraryEntry = {
  name:string;scope:string;description:string;whenToUse:string;evidence:string;
  status:"staging"|"promoted"|"archived";manual:boolean;distinctSessions:number;
  lastUsedAt?:string;content:string;body:string;files:string[];
};
```

`content` 是完整 SKILL.md；`body` 是 SDK `parseFrontmatter(...).body`；`files` 含 `SKILL.md` 与 supporting relative paths。
`distinctSessions` / `lastUsedAt` 来自 exact active managed SKILL.md 的 successful native reads。
Successful limited/truncated reads 计入；list/detail、supporting files、failed/cancelled reads、loading/advertising 不计入。
`bash` 与 native slash input 没有受支持的 successful file-read identity evidence。

## Discovery, shadowing and read

Directory catalog group fields：`{id,name,kind,enabled,defaultEnabled,overridden,available?,path?,machine?}`。
Skill entries 可含 `shadowedBy:<winning entry id>`。

| Source | Group |
| --- | --- |
| Gateway `~/.agents/skills` | `group:skills:global`，`machine:"gateway"` |
| Target project directory | `group:skills:dir:<machine>:<absolute directory>` |
| Shared/home/package | existing corresponding IDs |

Priority：项目 > Gateway 全局。Target `.agents/skills` directories are ordered nearest cwd first，向上至首个 `.git`（含该目录；无 git 则到 `/`），排除目标 home 的 `.agents/skills`。目标用户级技能和 prompt 不进入目录或会话；全局始终来自 Gateway。
Project group display name 为 `<absolute directory> · <instance name>`；local display 为 `本机`。
Global display name 为 `全局 · ~/.agents/skills`。实例设置没有会话 cwd，只显示 Gateway 技能与实例包，不扫描目标 home。

`skill_read(path=...)` 与 `gateway.skill_read(path=...)` 按 loaded skill directory 分派到 target channel `skills.read` 或 Gateway reader。
Reader 输出边界为 50 KiB / 2000 lines，并保留 SDK pagination/read errors。
`requiresReload` 的 catalog 投影见 [native](native.md#capability-catalog)。

开关不需要重载：保留 SDK 发现顺序的同名候选，当前有效开关过滤后按名称取首项，关闭胜者立即使下一个候选可读、下一请求更新 skills 段；重新开启恢复原优先级。已关闭或被覆盖的 skill 及其支持文件不得读取。注册资源改动仍需重载。


## Methods and HTTP

| Wire | Params | HTTP POST | Body |
| --- | --- | --- | --- |
| `skillsList` | `{}` | `/api/skills/list` | `{}` |
| `skillsPromote` | `{name}` | `/api/skills/:name/promote` | `{}` |
| `skillsDemote` | `{name}` | `/api/skills/:name/demote` | `{}` |
| `skillsArchive` | `{name}` | `/api/skills/:name/archive` | `{}` |
| `skillsRestore` | `{name}` | `/api/skills/:name/restore` | `{}` |
| `skillsDelete` | `{name}` | `/api/skills/:name/delete` | `{}` |
| `skillsScope` | `{name,scope}` | `/api/skills/:name/scope` | `{scope}` |

Result：`{skills:SkillLibraryEntry[]}`。
Unknown names：`NOT_FOUND`；invalid scope：`INVALID_REQUEST` / HTTP 400。
Scope format 与已有 instance/project 的存在性是不同事项。
HTTP skill names 的 64-char bound 独立于 `limits.identityChars`。


## 约定

- 原生技能生成或修改必须使用含真实证据和显式作用域的结构化字段。
- 技能修改必须校验名称、章节及受限相对辅助路径，不得猜歧义章节或编辑未恢复的归档技能。
- 辅助文件接口不得写删 `SKILL.md`。
- 技能注入和读取权限必须取当前实例、项目作用域内已启用、已加载且未被覆盖的技能集合。
- 技能读取必须路由到该技能所在机器。
- 工具和技能必须以 `staging`、`promoted`、`archived` 管理，恢复必须回到 `staging`。
- 手工提升必须占容量且免于空闲或溢出降级。
- 全部提升槽均为手工时不得静默抢占。
- 未知工具或技能名称不得当作操作成功。
- 原生技能文件树和生命周期元数据必须分别保存在本项目主目录的 `skills/<name>/` 与 `skills/library.json`。
- 远程会话技能发现必须并入会话 cwd 资源快照，不得另发项目技能补扫请求；实例设置不得发现目标 home 技能。
- `.prk/skills`、显式技能路径与包内技能必须复用目标 Pi 的公开资源解析；`.agents/skills` 保留已确认的 BFS 与来源分层。
- 本机目标发现的 Gateway `~/.agents/skills` 必须同时从项目目录分组与项目技能候选中排除，沿用 Gateway loader 的全局条目；同一路径不得重复投影并产生指向自身的 `shadowedBy`。不同项目路径的同名覆盖规则不变。
