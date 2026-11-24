# Gateway 文件记忆

规则：[REQ-44](../contract.md)、[模块约定](memory.md#约定)。
## Model API

Direct tool：`memory`；code mode：`gateway.memory(...)`。
Request 为 `{operations:[{target,action,content?,old_text?}, ...]}`，单次修改也用非空数组。
`target`：`localmemory.toml` 里配置的层名（默认 `control|user|memory|instance|project`）；`action`：`add|replace|remove`。
`add` 仅需 `content`，`replace` 需 `content` 和 `old_text`，`remove` 仅需 `old_text`；不接受多余字段。`content` 是完整新条目，`old_text` 是用于定位的非空精确子串。
Model 的 instance 层取调用会话的绑定目标，project 层取会话所属项目；无项目时 project 层不可写。

## Operator routes

| Wire method | HTTP POST route | Parameters | Result |
| --- | --- | --- | --- |
| `memoryList` | `/api/memory/list` | `{}` | `MemoryListing` |
| `memoryChange` | `/api/memory/change` | `{operations,instance?,project?}`; `instance` / `project` select the scoped file | Same listing after direct operator mutation, including explicit-only layers |
| `memoryDeleteInstance` | `/api/memory/delete-instance` | `{instance:string,confirm:true}` | Same listing after deleting that instance's file in every instance-scoped layer |
| `memoryConfigGet` | `/api/memory/config/get` | `{file:"shared"\|"override"}` | `LayerConfigView` of `localmemory.toml` or `prk-localmemory-override.toml` |
| `memoryConfigSave` | `/api/memory/config/save` | `{file, document:object, hash:string}` | Saved `LayerConfigView`; `CONFLICT` when the file's hash no longer matches, `INVALID_REQUEST` when the document would not parse (shared: alone and merged with PRK's override; override: merged) |

```ts
type MemoryListing = {
  enabled:boolean; error?:string;  // error: the TOML configuration is invalid; memory is off until fixed
  layers:{name:string;description:string;capacityCharacters:number;soft:boolean;explicitOnly:boolean;review:boolean;scope:"none"|"instance"|"project"}[];
  memories:MemoryDocument[];
};
type MemoryDocument = {
  target:string;instance?:string;project?:string;projectName?:string;
  entries:string[];chars:number;limit:number;soft:boolean;overLimit:boolean;deleted?:boolean;
};
type MemoryChange = {target:string;instance?:string;project?:string;action:string;before?:string;after?:string};
type LayerConfigView = {
  file:"shared"|"override"; path:string; exists:boolean;
  raw:string; hash:string;                   // hash: sha256 hex of raw, "" when the file does not exist
  document:object|null; error?:string;       // parsed TOML; null when absent or unparseable (error says why)
};
```

Separator 为 `\n§\n`；chars 计 Unicode characters（包括 separators），不是 UTF-8 bytes。
`soft:true` 的层超限只提醒；disk-only instance group 的 `deleted:true`。
List 按配置顺序含每个层：无作用域层一份；instance 层含 configured instance groups（可为空）与 retained disk-only groups；project 层含项目注册表（`<projectsDirectory>/<id>/project.json`）里的每个项目。

## Direct explicit-only writes

`explicitOnly` 层（默认 control）与其他层共用 batch store；容量由各层 `capacityCharacters` 与 `soft` 决定。
新增 entry 的 change 含 `after`；删除含 `before`；替换含二者。

## Background review and lightweight notices

计数：公开 input source 中非 `extension` 输入，与会话的 `tool_execution_end`；successful main-model memory call 重置两者。
自上次复盘起用户输入达 `[review].userTurns` 或工具调用达 `[review].toolCalls`，在 main reply settled 时安排至多一个 review；review 使用该 session model 与 public SDK context snapshot，tool set 只有 `memory`，只能写 `review = true` 的层。`config.toml` 的 `memory.review = false` 关闭本网关的复盘。

Notices 使用 SDK custom message：

```ts
{customType:"memory-notice",display:true,
 content:string,details:{source:"control"|"review",changes:MemoryChange[]}}
```

`explicitOnly` 层的写入 source 为 `control`；其他层的 review writes source 为 `review`；main-model 对其他层的写入无 notice。
Web hook：`data-memory-notice`、`data-count`、per-change `data-memory-change` / `data-target` 与 before/after sides。
Public delivered-message source 的限制见 [design notes](../design-notes.md#记忆审查的消息来源边界)。


## 约定

- 记忆请求必须在存储边界校验。
- 记忆批次必须先规划完整批次。
- 记忆容量必须只校验最终硬容量，不得以 `soft` 层的推荐上限拒绝或截断。
- 记忆 `replace`、`remove` 的 `old_text` 必须唯一匹配一个条目。
- 模型实例层与项目层的写入必须绑定当前会话的实例与项目，不得任意指定。
- 后台记忆复查只能写 `review = true` 的层。
- 后台记忆复查必须仅在主回复结束后用当前会话模型、上下文快照及记忆工具运行。
- 同一会话的记忆复查不得重叠。
- 记忆复查不得递归触发。
- 记忆复查失败不得使主回合失败。
- 会话关闭必须中止并等待记忆复查。
- 各层记忆文件必须保存在网关这一侧的记忆目录（`memory.directory`，默认本项目主目录的 `memories`）里由层配置决定的路径，远程实例记忆也不得写到目标机。
- 层配置每次存取都重读；配置无效时记忆停用并给出原因，不得退回旧布局或默认层继续写。
- 项目注册记录只在缺失时创建，不得覆盖已有记录。
- 灵魂文件必须仅由操作者维护。
- 每次记忆变更必须重读受影响文件并完成整批校验，再暂存全部文件并逐个重命名发布。
- 记忆写入失败必须尝试回滚已发布文件。
- 会话启动、重建、唤醒或原生资源重载必须读取灵魂及记忆文件并冻结提示前缀，运行中记忆写入不得改写该前缀。
- 更换实例后必须在新运行时启动时选取新实例记忆。
- 删除实例配置必须保留记忆文件，实例记忆文件只能由显式记忆删除操作移除。
- 后台记忆复查提示及会话不得写入主会话记录。
- 记忆写入通知必须使用不触发模型回合的原生消息。
- 层配置保存必须比对打开时的文件哈希，不一致即拒绝，不得覆盖别处的改动。
- 层配置保存必须先用与读取相同的解析器校验，未通过不得写入；表单整份重写文件，不保留手写注释。
