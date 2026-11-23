# Spec：跨会话 session_search

状态：已定，未实现（用户 2026-11-02 定设计，2026-11-03 落文）。
暂存本仓库；LCM 新仓库建好后整份搬过去，PRK 只留「PRK 接线」一节对应的 contract 条目。
开工顺序：子会话设置页 + worktree 隔离那一单之后，用 PRK 子会话来做（拆包、存储、tag、接线天然可并行）。

## 目标与边界

跨会话按字面找回「说过的话」，能定位并完整读回原消息。和 compaction-recall 不是一件事：

- **compaction-recall**：压缩后在**当前分支**找回原文。一直作为轻量插件独立存在，不并入。
- **session_search**：搜本 agent 目录下的**所有会话**。归 LCM 新项目（`pi-lossless-context` 原型冻结，不在上面改）。
- 两者共用分词与查询编译（见「共享包」），存储各管各。

不做：语义/向量检索、LLM 参与查询或改写、写回会话原件。

## 不绑第三方

用户不想让 session 绑定任何第三方的东西，此前外部服务的教训已经足够；Hindsight 也不行。只用自己的存储。

## 原件与副本

- **原件永远是 Pi 的会话 jsonl。** 索引库是副本：可删、可从 jsonl 全量重建、从不写回；两者不一致以 jsonl 为准。
- 允许像 Hermes `state.db` 那样整份再存一份（用户 2026-11-02）。区别：Hermes 的 state.db 是原件，我们的库只是投影。
- **全量入库**：用户消息、助手正文、工具调用与输出、思考过程都进库，供 expand 回看。
- **搜索范围只限用户消息和助手正文。** 工具输出、思考不进搜索索引。
- 提供重建命令（形如 `/lossless reindex --all`）：删库后从 jsonl 重建，结果与增量入库一致。

## 存储

- 一个存储接口，两个后端，接口一开始就按双后端设计：
  - **SQLite**（默认）：`<agent 目录>/lossless-context.db`，与 LCM 共用一个库（2026-09-29 的决定仍有效）。FTS5 + 自带的汉字 bigram 分词。
  - **PostgreSQL**（可选）：可与 Hindsight 的 pgroonga 共用实例、单独建库；分词交给 pgroonga，这一侧不处理分词。搬家用 dump。
- 分词只是 SQLite 后端的实现细节，不泄漏到接口。

## 共享包

把**分词 + 查询编译**（纯函数，与存储无关）抽成一个小包，compaction-recall 和 LCM 都依赖它。compaction-recall 的搬家重构（`pi-context-recall` main `5b45be4`、`7d7f1f2`）已经把 `src/query/` 切成零外部引用，就是为这一步铺路。

## 工具

### `session_search`

输入沿用 compaction-recall `history_recall` 的写法，加 Hermes 的跨会话参数：

| 参数 | 含义 |
|---|---|
| `concepts` | 必填。1–5 组，每组是同一个概念的 1–8 种说法，组内任一命中即算命中该组 |
| `match` | `any`（默认，任一组命中）/ `all`（同一条消息命中所有组） |
| `exclude` | 最多 5 个，命中任一即丢弃该条 |
| `tags` / `tags_match` | 范围，见「tag 与范围」。不传则用会话的默认范围 |
| `after` / `before` | 时间窗 |
| `sort` | 相关度（默认）/ 时间 |
| `limit` / `offset` | 分页，offset 用上一页返回的 `nextOffset` |
| `exclude_session_ids` | 排除指定会话（如当前会话） |

输出按会话聚合；每个会话给会话元数据（id、标题、时间、cwd、项目、是否归档、是否子会话及父会话）和命中消息定位；第一名附上下文窗口。不在一个工具里塞四种用法。

### `lcm_expand`

按消息定位读原文，前后翻页。可读全量内容（含工具调用与输出），有长度上限与续读 offset，形状参照 compaction-recall 的 `history_expand`。

## 搜索覆盖范围（用户 2026-11-02 确认）

- **包括归档会话**：归档只是从列表里藏起来，内容还在。
- **包括子会话**：默认搜，结果标明「子会话」和父会话。

## tag 与范围

- 会话级自由字符串 tag，`前缀:值` 约定，与 Hindsight 现有写法对齐：`project:`、`agent:`、`channel:`、`source:`。来源有两种：PRK 自动派生的和用户手写的。
- tag 原件写在会话 jsonl 的 custom entry 里；索引单独一张 `session_tags` 表，改 tag 不重建正文索引。
- 查询语义照抄 Hindsight：`tags` + `tags_match`（`any` / `all` / `any_strict` / `all_strict` / `exact`）。同一种范围写法同时用于 session_search 和记忆召回。`tag_groups` 暂不做。
- **默认范围分层**：「会话搜索范围」「记忆召回范围」各有一个默认值，按 全局 < 实例 < 项目 < 会话 分层设定（项目层是新加的）。session_search 默认开启。
- 模型可以在工具参数里当次覆盖；自动召回（没有模型参与）只用默认范围。
- **默认范围怎么交给插件**：PRK 把生效的默认范围写成会话 jsonl 里的一条 custom entry（两个插件共用同一个 customType，形如 `{tags, tagsMatch}`），插件每次查询读最新一条。裸 Pi 用户用插件命令写同一条 entry，插件不认识 PRK。

## PRK 接线

- PRK 自动给会话打 `project:`、`agent:`、`source:` 等 tag（写 custom entry）。
- 设置页增加两个范围默认值，按上面的四层存。
- 归档 / 父子标记由 PRK 在 `tool_result` 钩子里补进结果，插件本身不知道 PRK 的概念。

## 待用户定

1. **默认范围的出厂值**：默认按项目隔离（`project:<当前>`，跨项目的经验带不过来），还是默认不限、按需收窄？这和 2026-10 的旧规则「常规召回一律不按 tag 过滤」冲突，需要拍板。
2. **要不要「排除子会话」参数**：实现方倾向先不加（PRK 特有语义，插件参数表放不进去；默认全搜，子会话结果真刷屏了再说）。
