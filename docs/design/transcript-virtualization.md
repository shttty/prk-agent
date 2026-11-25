# 对话区虚拟化：只挂视口附近的消息

长会话里对话区（transcript）的 DOM 规模随消息数线性增长。无 GPU、软件渲染的远程桌面上，360 条消息时对话区约 1.4–1.5 万个元素；`:has()` 一类样式重算放大器已经修掉，CPU 4× 节流下一轮结算到按钮可用仍要数秒。本文给出只渲染视口及缓冲区内消息、其余用估算高度占位的方案，以及原型实测结论。

**结论**：采用消息级窗口化。接缝用 assistant-ui 0.15 公开的 `unstable_useThreadMessageIds` + `ThreadPrimitive.Unstable_MessageById`，窗口计算用 `@tanstack/react-virtual`，`MessageView` 与 turn 分组不动。原型把 360 行对话的元素从 16,249 降到 716，结算从 1,124 ms 降到 124 ms（生产构建、CPU 4×）。CSS `content-visibility` 和「折叠即不挂」都实测否决。上线前要先收拢滚动所有权、改成按消息 id 导航，见「分阶段计划」。

**坐标**：无前缀路径相对仓库根。`aui:` 相对 `web/node_modules/@assistant-ui/`，版本 `react` 0.15.38、`core` 0.3.38、`store` 0.3.25（`web/package.json:15`）。`tv:` 相对 `@tanstack/virtual-core` 3.19.13 的包根，它是 `@tanstack/react-virtual` 3.14.28（写作时最新版，peer 覆盖 React 19）的唯一依赖。推测处标「推测」。

## 现状地图：数据到 DOM

### 投影与运行时

1. `Chat` 从 workbench store 分字段订阅快照、流、工具运行和扩展渲染，`projectConversation` 每次输入变化都整段重新投影，再由 `reuseUnchangedMessages` 用 `dequal` 逐条比对、复用未变对象（`web/chat/thread/Chat.jsx:43-58`；`web/chat/conversation/reuse-unchanged-messages.js:7-14`）。这部分与消息总数成正比、与 DOM 无关；实测结算期间合计约 10 ms，不是瓶颈。
2. 投影顺序：历史消息与工具运行合并（`web/chat/conversation/project-conversation.js:11-33`），原生反馈、每个 operation 一条 `live-<operationId>` 的实时 assistant 消息（`web/chat/conversation/live/append-live-operations.js:14-68`），最后 `mergeTurns` 把两条用户消息之间连续的 assistant 消息合成一个 turn，id 取首条（`web/chat/conversation/turns/merge-turns.js:11-63`）。所以一个带 50 次工具调用的 turn 是一行；结算时 `live-*` 行被带 entryId 的历史行替换，行身份变化一次。
3. `useExternalStoreRuntime(adapter)` 把消息交给 assistant-ui；`unstable_capabilities.copy=false`，发送、取消、重连都回到 PRK actions（`web/chat/thread/Chat.jsx:59-80`）。最后一行不是 assistant 时，assistant-ui 会追加一个空的 optimistic 运行中 assistant 占位，`MessageView` 在已有运行中 turn 时把它渲染成 null（`web/chat/transcript/MessageView.jsx:42-45`）。
4. `ThreadPrimitive.Messages` 按 id 列表给每条消息挂 `MessageByIndexProvider` 和渲染函数（`aui:core/dist/react/primitives/thread/ThreadMessages.js:124-140`）；PRK 的渲染函数放在模块级，保证行 memo 稳定（`web/chat/thread/ChatSurface.jsx:51-52,156`）。

### 一行消息里有什么

- `MessageView` 按 `metadata.custom` 分支：压缩摘要、记忆提示、终端事件、kernel 事件链接、扩展通知，普通消息走 `MessagePrimitive.Root`（带 `data-message-id`，用户消息另带 `data-entry-id`）+ `Unstable_PartsGrouped`（`web/chat/transcript/MessageView.jsx:46-93`）。
- turn 分组：最后一个工具调用或思考之前的部分折进 `TurnProcess`，其余是答案（`web/chat/transcript/turns/turn-grouping.js:7-28`）。`TurnProcess` 和 `ToolRow` 都是 `<details>`，折叠时子树照样渲染（`web/chat/transcript/turns/TurnProcess.jsx:50-56`；`web/chat/transcript/tool-calls/ToolRow.jsx:100-148`）。`CodeBlock` 折叠时只推迟高亮，前 20 行每行一个 `<span>` 仍然挂着（`web/chat/code/CodeBlock.jsx:17-41`；`web/chat/tool-text/tool-text-constants.js:5`）。实测这部分只占对话区元素的 13–19%（见 H5）。
- 工具展开态：`ToolRow`/`TurnProcess` 的初值和同步都来自 `PresentationContext.openedTools`，切换时 `savePresentation({ openedTools })`，最多保留 128 个键（`web/chat/transcript/tool-calls/ToolRow.jsx:40,76-91`；`web/chat/transcript/turns/TurnProcess.jsx:29-45`；`web/workbench/session-storage/session-storage-constants.js:4`）。
- 工具输出、图片、kernel cell：大输入输出先给预览，点开再 `loadToolContent`（`web/chat/transcript/tool-calls/ToolRow.jsx:38-39`）；历史快照里的图片结果也只给预览（`src/gateway/tool-content/tool-output-preview.ts:7-9`）。加载后的结果图是 base64 `<img>`，没有 `loading="lazy"`，也没有尺寸（`web/chat/transcript/tool-calls/body/ResultImages.jsx:8-16`）；用户附件图有 `loading="lazy"`（`web/chat/transcript/MessageView.jsx:86`）。kernel cell 的最终结果和图片按需取（`web/chat/transcript/tool-calls/kernel-cell/KernelCellBody.jsx:16-39`），cell 行用 `id="kernel-cell-<cellId>"`，kernel 事件链接和后台任务卡片都靠 `document.getElementById` 找它并展开祖先 `<details>`（`web/chat/transcript/tool-calls/ToolRow.jsx:111`；`web/chat/transcript/tool-calls/kernel-cell/reveal-kernel-cell.js:4-13`；`web/chat/background-tasks/BackgroundTasks.jsx:35`）。
- 消息操作：复制、引用、重发、改了重发、fork 都在行内 `MessageActions`，读 `MessageActionState`（busy、hostState、连接）这个 Context（`web/chat/thread/ChatSurface.jsx:76,155-157`；`web/chat/transcript/messages/MessageActions.jsx:27-86`）。结算时 busy 翻转，这个值变化，**每个已挂载行的操作区都重渲染**；这就是实测里占结算 92% 的 React render + commit 的来源。浮层首用才挂（`web/chat/transcript/messages/MessageActions.jsx:23-25`）。打字不重渲染历史行由浏览器用例守住（`test/browser/conversation/layout.test.mjs:55-80`）。
- 流式增量：只有 live turn 的对象变化；`MarkdownPart` 每个文本部分自带一个解析缓存，只重解析最后一个未闭合块（`web/chat/transcript/messages/MarkdownPart.jsx:10-24`；`web/chat/markdown/settled-blocks-plugin.js:14-36`）。

### 滚动：PRK 自己管，assistant-ui 的控制器仍挂着

- `ThreadPrimitive.Viewport` 传了 `autoScroll={false}` 和三个 `scrollToBottomOn*={false}`（`web/chat/thread/ChatSurface.jsx:148-149`）。控制器照样 `attach`：对 viewport 子树挂 `MutationObserver`（childList、subtree、attributes、characterData），任何非 style 变更都回调 `onContentResize`，读 `scrollHeight/clientHeight`，`handleScroll` 里再取首条消息的 `getBoundingClientRect`（`aui:store/dist/utils/viewport-scroll.js:17-46`；`aui:store/dist/utils/thread-viewport-auto-scroll.js:154-211,292-330`）。首条消息 id 变化时它还会做 `messagesPrepended` → `keepMessageAt` 锚定并写 `scrollTo`（`aui:react/dist/primitives/thread/useThreadViewportAutoScroll.js:36-51`；`aui:store/dist/utils/thread-viewport-auto-scroll.js:90-101,366-379`），与 PRK 自己的翻页还原并行。PRK 没有别处读 ThreadViewport 上下文（`grep -rn useThreadViewport web/chat` 为空）。
- 跟随最新：`followRef` 为真时，`ResizeObserver` 盯 viewport、`#messages` 和输入区浮层，尺寸一变就 `scrollTop = scrollHeight`（`web/chat/transcript/follow-transcript.js:2-31`）；transcript 修订号变化时同样钉底（`web/chat/transcript/notify-transcript-change.js:2-20`）。只有读者的上滚输入（滚轮、触摸、上翻键、滚动条拖动）才停止跟随，单纯 scroll 事件不算（`web/chat/transcript/note-scroll-intent.js:9-35`；`web/chat/transcript/save-scroll.js:5-20`）。「跳到底部」按钮自己实现，不用 `ThreadPrimitive.ScrollToBottom`（`web/chat/thread/ChatSurface.jsx:129-138,168-169`）。
- 展开锚定：点 summary 前记下节点位置，布局后按位移补 `scrollTop`（`web/chat/transcript/preserve-disclosure.js:2-8`；`web/chat/transcript/anchor-disclosure.js:2-10`）。
- 滚动位置持久化：滚动停 200 ms 后采样 `{scrollTop, anchor}`，anchor 是视口内第一条 `.pi-message` 的 id、序号、偏移和前 160 字（`web/workbench/store/drafts/note-scroll.js:1-7`；`web/chat/transcript/presentation/visible-presentation-anchor.js:2-19`），写进会话存储（`web/workbench/store/drafts/save-presentation.js:3-10`；`web/workbench/session-storage/sanitizing/normalize-presentation.js:4-23`）。切回会话时先按 anchor id 找节点，找不到退回保存的 `scrollTop`（`web/chat/transcript/restore-scroll.js:3-42`；`web/chat/transcript/presentation/find-presentation-anchor.js:2-6`）。

### historyPage 与查找

- 服务端按轮分页：最多 50 轮，并按投影后 JSON 字节从新到旧装整轮，默认预算 3 MiB，一轮装不下返回 `TOO_LARGE`（`src/sessions/history/project-branch-page.ts:4,24-83`；`src/config/limits/limits-options.ts:41`；`docs/wire/session-snapshots.md:122`）。360 条消息需要读者主动翻 3 页以上；DOM 里有多少消息，取决于读者翻过多少页。
- 网页翻页：滚到顶部 24 px 内或点按钮触发；加载前记 anchor、`scrollTop`、`scrollHeight`，新页拼到快照前面，提交后在 layout 和下一帧各还原一次（`web/chat/thread/ChatSurface.jsx:98-103,151-154`；`web/chat/transcript/use-history-pagination.js:12-43`；`web/workbench/store/session-stream/load-history-page.js:5-31`）。分页按钮是 `#messages` 里的第一个子节点，最后一页加载完就消失（`web/chat/thread/ChatSurface.jsx:151-154`）。
- 页内查找只搜已加载部分（UI 明写「只搜已加载的部分」）：先 `loadTranscriptContent` 把所有预览工具内容取全，按数据匹配消息 id，再到 DOM 里 `querySelectorAll(".pi-message")` 收集节点，命中节点展开全部 `<details>` 后居中（`web/chat/transcript/select-search-match.js:4-31`；`web/workbench/store/tool-content/load-transcript-content.js:3-15`；`web/chat/transcript/TranscriptSearch.jsx:10-12`）。高亮直接改节点 class（`web/chat/transcript/mark-search-match.js:2-5`）。浏览器原生 Ctrl+F 没被拦，能搜到所有已挂载文本，包括折叠 `<details>` 里的。

## 实测

### 方法

原型和测量脚本放在本地 scratch 目录，没有入库；下面写全口径，按它可以复现。基准提交 `2f18c720`。

- 夹具：沿用 `test/fixtures/browser/open-workbench.mjs` 的组件（真实 Gateway + Web + SDK faux provider + Chromium），种 180 轮、360 行；60 个成功工具轮（`bash seq 1 40`、读文本、读 PNG），其中 12 个是真实 PNG 结果。打开后点分页按钮直到全部加载。三次试次克隆同一份会话。
- 构建：每个变体单独 `vite build`，用 `vite preview` 提供，`/api` 代理到该试次夹具的 Web；React 是生产版。本机实际使用的网页也是这种形态。Vite dev 下的数字只作对照：dev 版 P0 结算约 4.7 s，其中开发期开销占大头，不作判据（推测：先前「4–7 s」的口径也来自 dev 构建）。
- 浏览器：Chromium 151，`--disable-gpu`，CDP `Emulation.setCPUThrottlingRate {rate: 4}`，视口 1440×1000。
- 指标：对话区元素数（`#transcript *`）；打字 30 字，keydown 到下一次 rAF；流式 faux 40 tokens/s、约 8.4 s 正文，统计 rAF 间隔与底部缺口；结算从 Gateway `operation_completed` 时间戳到首个 fork 与 retry 同时可用且 `#composer-form` 无 `data-busy`（窗口化变体里「首个」指窗口内首个）；滚动从底部按每步 −750 px、约 35 ms 滚到顶；翻页停在距顶 25 px，点分页按钮，逐帧记录原首个可见消息的 top 约 1 s，报最终偏移和相邻帧最大跳动，取 9 页最坏值。每格是三次中位数。

### 变体

- **P0**：当前代码。
- **P1**（方案 E）：`TurnProcess`、`ToolRow`、压缩摘要的 `<details>` 打开过后才渲染子树。
- **P2**（方案 D）：只加 `.pi-message { content-visibility: auto; contain-intrinsic-size: auto 135px; }`。
- **P3**（方案 B）：`ChatSurface` 里用 `unstable_useThreadMessageIds()` 取 id，`useVirtualizer({ count, getItemKey: id, estimateSize: 60/200（用户/助手交替）, gap: 8, overscan: 5, scrollMargin: 实测, anchorTo: "end", followOnAppend: 跟随态, scrollEndThreshold: 2 })`，每个虚拟项 `ref={measureElement}`、绝对定位，内放 `ThreadPrimitive.Unstable_MessageById`（它收 `components`，不是 render prop；`Message` 组件读 `state.message` 再渲染原 `MessageView`）。钉底改为 `scrollToIndex(last, { align: "end" })`；翻页去掉 PRK 的 `scrollHeight` 差值还原，交给 TanStack `anchorTo: "end"` 按旧 key 找新索引（`tv:dist/esm/index.js:404-462,636-650`）；viewport 设 `overflow-anchor: none`。保留 `ThreadPrimitive.Viewport`。查找和 kernel 跳转未改，只记录行为。
- **P3b**：P3 再把 `ThreadPrimitive.Viewport` 换成普通 div。

### 结果

| 变体 | 元素数 | 打字 p95 ms | 流式帧 p95 ms | 结算中位 ms | 滚动帧 p95 ms | 翻页最终偏移 / 单帧最大 px |
|---|---:|---:|---:|---:|---:|---:|
| P0 | 16,249 | 42.1 | 683.3 | 1,123.9 | 50 | 0.28 / 12 |
| P1 | 14,061 | 36 | 599.9 | 1,131.2 | 50 | 0.28 / 12.19 |
| P2 | 16,249 | 41.6 | 650 | 1,391.4 | 50 | 11.86 / 12.19 |
| P3 | 716 | 19.4 | 50 | 124.1 | 50.1 | 0.19 / 0.19 |
| P3b | 765 | 22.6 | 50 | 139.5 | 50.1 | 37.19 / 37.19 |

P0 结算期间的 CPU profile（1,106.9 ms）：React render 687.4 ms、commit 336.8 ms，合计 92.5%；`projectConversation` 7.6 ms、`reuseUnchangedMessages`/`dequal` 2.0 ms、快照与 store 0.6 ms。CDP timeline 的样式 68.6 ms、布局 17.0 ms 是包含式时间，可能嵌在 commit 里，不与上面相加。

### 假设判定

| # | 假设 | 判定 | 证据 |
|---|---|---|---|
| H1 | 结算主要花在与挂载行数成正比的工作上，不是投影与比对 | **通过** | React render + commit 占 92.5%，投影 + 比对 + 快照约 10 ms。P3 挂载行从 360 降到约 15，结算降到 11%。 |
| H2 | 消息级接缝 + TanStack 能在不改 `MessageView` 与分组的前提下窗口化，且不与 assistant-ui 控制器抢 `scrollTop` | **接缝成立，严格门槛未过** | 元素 716/765，`MessageView` 与分组未改。两个问题：一是翻页时 assistant-ui `keepMessageAt` 与 TanStack 在同一对 rAF 样本之间各写一次 `scrollTop`（3/3 页，CDP 条件断点实证），这次样本里没造成跳动；二是流式钉底时首个 live 正文行出现时离底 35 px，1–2 帧后回到 0，P3 与 P3b 都复现。逐帧几何：发送后末尾先是 assistant-ui 的空占位行（22 px），被 `live-<operationId>` 行（57 px）替换，总高 51,886→51,921 px，当帧 `scrollTop` 停在 51,886；下一帧同一行再长到 84 px，又欠 27 px。输入区浮层、SendStatus、viewport 高度都没变，离结算约 8.2 s，排除 live→entryId 换行和输入区。 |
| H3 | 翻页时锚点保持：最终 ≤ 2 px，单帧 ≤ 8 px | **P3 通过，P3b 否决** | P3 九页最坏 0.19 px。P3b 前两页都是 0，最后一页三轮一致 −37.19 px：分页按钮加 Stack 间距正好 37.19 px，按钮消失时 `scrollMargin` 变化没有并入同一次锚定。P3 里这段位移恰好被 assistant-ui 的 `keepMessageAt` 补掉。 |
| H4 | 只加 `content-visibility` 就把结算降到一半以下 | **否决** | 结算反而升到 1,391 ms（P0 的 124%）；DOM 不变，React 树不变。滚轮上滚时每轮 69 帧 `scrollTop` 反向，`scrollHeight` 在 58,916–70,110 px 间变化，翻页最终偏移 11.86 px。 |
| H5 | 折叠 `<details>` 子树占对话区 DOM ≥ 50% | **否决** | 冷态 2,188/16,249 = 13.5%（其中 `CodeBlock` 行 span 996）；12 张图全部按需加载后 3,352/17,476 = 19.2%。P1 去掉了这 2,188 个节点，结算不变（1,131 ms）。 |

另外两条行为记录：

- P3 下页内查找对已加载但未挂载的消息报 0 命中（P0 同词 1 命中），原因是 `select-search-match.js:19` 先在 DOM 里收节点。
- P3 下 kernel cell 滚出窗口后，点后台任务卡片的「查看」没有反应，`scrollTop` 停在原地：`reveal-kernel-cell.js:6-7` 找不到 DOM id 就直接返回。

P3/P3b 滚轮上滚时，估值修正让 `scrollHeight` 在 53,314–67,491 px 间变化，每轮 76 帧 `scrollTop` 反向写入。帧耗时达标，这也不等于肉眼看到内容倒退，但滚动条长度会随滚动伸缩。原型的估值只按奇偶行给 60/200 px，改进估值是实施时的必做项。

## 候选方案与取舍

| | 接入点 | 对 assistant-ui 状态与 Context | 动态高度 | 维护代价 | 依赖变化 | 实测结论 |
|---|---|---|---|---|---|---|
| A · assistant-ui 窗口化接缝 | 消息级：`unstable_useThreadMessageIds()` 给 id 序列（流式时引用不变），每个窗口内 id 渲染 `ThreadPrimitive.Unstable_MessageById`（`aui:core/dist/react/primitive-hooks/useThreadMessageIds.d.ts:1-12`；`aui:core/dist/react/primitives/thread/ThreadMessages.js:95-123`）。部件级：`createThreadRowsSelector` + `ThreadPrimitive.Row` 把 assistant 消息拆成部件行（`aui:core/dist/react/utils/threadRows.d.ts:18-80`）。 | 公开导出，Provider 语义不变；两者都标 experimental（2026-06-23 起），小版本可能改名。部件级要重做 `TurnProcess` 这个跨部件的 `<details>` 折叠。 | 只给「渲染哪条」，不管窗口与测量。 | 消息级小，部件级大。 | 无 | 消息级接缝可用，作为 B 的一半采用；部件级不做。 |
| B · `@tanstack/react-virtual` + A 的消息级接缝 | `ChatSurface` 里 `useVirtualizer`，`#messages` 下一个总高容器，窗口内渲染 `Unstable_MessageById`。 | 同 A；`MessageActionState`、`PresentationContext` 照旧，消费者从 n 个变成窗口内几十个。 | `measureElement` 按 ResizeObserver 量每行；`anchorTo: "end"` 在 `count` 变化时按旧可见 key 找新索引并校正（`tv:dist/esm/index.js:404-462`），量到新高度时在末端钉住（`tv:dist/esm/index.js:1084-1103`）。 | 中：滚动所有权集中到虚拟器，跟随、还原、翻页、查找、kernel 跳转都改为按 id 导航。 | +1 运行时依赖（`@tanstack/virtual-core` 随附）。 | **采用**。 |
| C · 自研 IntersectionObserver/ResizeObserver 分块 | 每个 turn 块一个哨兵，未挂载块用缓存高度占位。 | 同 A/B。 | 测量、缓存、上方补偿、缩放失效都自己写。 | 高，重做 B 的库已有的能力。 | 无 | B 已满足，不做。 |
| D · CSS `content-visibility` 对照 | `.pi-message` 加两行 CSS。 | 零侵入，原生查找、DOM id 全保留。 | 浏览器记住上次尺寸。 | 极低。 | 无 | 否决（H4）：省不掉 React 重渲染，结算变慢、翻页偏 12 px。 |
| E · 折叠即不挂 | 三处 `<details>` 打开过才渲染子树。 | 无。 | 不涉及。 | 低。 | 无 | 否决（H5）：DOM 只少 13%，结算不变。窗口化之后只在出现单条巨型 turn 的实例时再评估。 |

## 设计

### 单一滚动所有者

窗口化之后，所有 `scrollTop` 写入只走两条路：TanStack 虚拟器（钉底、翻页锚定、量高补偿、按索引定位），以及 PRK 已有的展开锚定（`preserveDisclosure/anchorDisclosure`，按被点节点自身位移补偿，与虚拟器「视口上方行变高才补偿」不重叠）。`ThreadPrimitive.Viewport` 换成普通 div，去掉 assistant-ui 的子树 `MutationObserver` 和 `messagesPrepended` 写入；viewport 设 `overflow-anchor: none`，不让浏览器自带的滚动锚定再插一手。PRK 的 `restorePrepend` 里按 `scrollHeight` 差值还原的分支删除，翻页锚定只由 `anchorTo: "end"` 负责。

分页按钮必须进入同一套几何：要么作为虚拟列表的第 0 项（翻完最后一页时这一项消失，由 `anchorTo: "end"` 按 key 校正），要么在没有更早历史时换成同高的占位（例如「已到最早」）。P3b 的 37 px 就是这里漏的。哪种做法由拍板事项决定，二者都要单列一条「最后一页撤掉按钮」的回归。

### 动态高度

- **首个 live 行**：跟随态下，末行的 key 或实测高度一变，就在同一帧钉底。做法：跟随时用 ResizeObserver 直接观察窗口内最后一个虚拟项，在回调里同步 `scrollToIndex(last, { align: "end" })`；末尾 optimistic 占位被 `live-*` 行替换时 `count` 不变（推测：所以 `followOnAppend` 没有生效），这条路径不依赖它。验收：P3 同口径下首个正文帧离底 ≤ 1 px。
- **估值**：按角色和内容给初值（用户行按文本行数，助手行按折叠方式估算折叠组数量与组外正文长度），量过的高度绑定消息 id、viewport 宽度与折叠方式。宽度或折叠方式变动后重新估算，视口内的行重新量。
- **工具展开、思考展开、「显示更多」**：保留现有展开锚定。
- **图片**：结果图加载后高度跳变由 `measureElement` 补；视口上方的图（例如翻页时）由虚拟器补偿。给 `<img>` 写明尺寸能消掉这一跳，但需要服务端在结果里带尺寸，不在本方案范围内。

### 向上加载 historyPage

`count` 变大、索引整体后移；按 id 作 key，`anchorTo: "end"` 用上次可见项的 key 找新索引、保持其偏移。触发条件从「`scrollTop <= 24`」改为「第一项进入窗口」，语义不变。实测 P3 九页最坏 0.19 px。

### 跟随最新与跳到底部

钉底统一为 `scrollToIndex(count - 1, { align: "end" })`：最后一行总在窗口内且已测量，不受上方估值误差影响。「跳到底部」按钮和发送后跟随走同一个调用。`note-scroll-intent` 的停止跟随判定不变；「有新消息」判定 `scrollHeight - clientHeight - scrollTop >= 80` 在底部附近都是实测行，仍成立。

### 滚动与展开态持久化

`openedTools` 本来就是数据，行重挂时 `ToolRow`/`TurnProcess` 从 Context 读初值即恢复（`web/chat/transcript/tool-calls/ToolRow.jsx:40`；`web/chat/transcript/turns/TurnProcess.jsx:29`）。会话恢复用保存的 anchor id → 索引 → `scrollToIndex` 再按偏移微调；保存的 `scrollTop` 在估值下不再可靠，只在 anchor 不在已加载范围时作后备。

行内瞬态状态会随卸载丢失：`UserMarkdownPart` 的「显示更多」、`CodeBlock` 的 FoldMore 展开、kernel cell 已加载的最终结果和图片（`web/chat/transcript/messages/UserMarkdownPart.jsx:11`；`web/chat/code/CodeBlock.jsx:22`；`web/chat/transcript/tool-calls/kernel-cell/KernelCellBody.jsx:12-13`）。首版接受丢失，滚回来要再点一次；是否提升为持久展示态见拍板事项。

### 按消息 id 导航：查找、kernel 跳转、恢复

新增一个导航动作 `revealMessage(messageId, { align, openDetails })`：id → 索引 → `scrollToIndex`，等该行挂载并测量后再展开 `<details>`、居中。三个入口都改用它：

- 页内查找：`select-search-match.js:14-17` 已经产出命中 id 集合，结果改存 id 数组，删掉 `:19` 的 DOM 收集；高亮改为行根据「当前命中 id」自己加 class，替代 `mark-search-match.js` 直接改节点。
- kernel 跳转：toolCallId → 所在消息 id 的映射是纯函数（投影结果里查 `tool-call` 部件），`revealKernelCell` 的两个调用方都先映射再导航。
- 会话恢复：见上一节。

浏览器原生 Ctrl+F 在窗口化后只能找到窗口内文本，而且找不到时不报错。处理方案见拍板事项。

### 与 historyPage 的职责边界

historyPage 决定浏览器持有多少数据，按轮和字节预算，属于数据层；窗口化决定这些数据里哪些挂成 DOM，属于渲染层。不用窗口化去减少下载，也不靠缩小页预算来减少 DOM。改动全部在 `web/` 内，不改服务端分页契约，不涉及 `docs/contract.md`。

## 分阶段计划

每个阶段一个提交，可以单独验收，回退就是 revert 这个提交。前两个阶段在当前全量 DOM 下就成立，先把滚动所有权和导航收拢，第三阶段才换渲染方式。

1. **单一滚动所有者（不窗口化）。** `ThreadPrimitive.Viewport` 换普通 div，viewport 设 `overflow-anchor: none`；分页按钮改为固定几何（按拍板结果二选一）。验收：现有浏览器用例全过；360 行夹具上连翻到最后一页，每页最终偏移 ≤ 2 px、单帧 ≤ 8 px，包括按钮消失那一页；流式帧 p95 与 P0 对比，记录去掉子树 `MutationObserver` 的收益。
2. **按 id 导航。** 加 `revealMessage`；查找结果改 id、高亮由行自取；toolCallId → 消息 id 映射加单元用例；kernel 跳转、会话恢复改走它。全量 DOM 下行为不变。验收：单元用例覆盖映射与查找匹配；浏览器上查找、kernel 跳转、切回会话恢复位置与改前一致。
3. **消息级窗口化。** 加 `@tanstack/react-virtual`（最新版），`unstable_useThreadMessageIds` + `Unstable_MessageById` 渲染窗口；`revealMessage` 改为 `scrollToIndex` 实现；首个 live 行同帧钉底；估值与宽度缓存。验收（生产构建、CPU 4×、360 行夹具）：元素 ≤ 1,000；结算 ≤ 200 ms；打字 p95 ≤ 25 ms；流式帧 p95 ≤ 50 ms，钉底全程离底 ≤ 1 px（含首个正文帧）；翻页同阶段 1 门槛；查找能命中并跳到未挂载消息；滚出窗口的 kernel cell 能跳回。新增一个 Chromium 用例覆盖长对话的窗口化、翻页最后一页、离窗查找，控制在浏览器层 5 分钟预算内。之后在远程桌面实机上复测一次结算。
4. **按需：行内瞬态状态。** 只有拍板决定要保留「显示更多」、FoldMore、kernel 结果时才做。

否决并不做的：方案 C（自研）、D（`content-visibility`）、E（折叠即不挂）、A 的部件级拆行。

## 需要拍板

1. **用 experimental 接口。** `unstable_useThreadMessageIds` 和 `Unstable_MessageById` 标注「不计划移除，任何版本都可能改」。依赖按惯例跟最新版，改名时要跟着改窗口化那一处。接受吗？
2. **新增依赖** `@tanstack/react-virtual`（连带 `@tanstack/virtual-core`）。
3. **原生 Ctrl+F。** 二选一：焦点在对话栏（或页面 body）时拦截 Ctrl+F，打开页内查找，终端和编辑器保留各自的查找；或者不拦，接受原生查找只覆盖窗口附近，在查找框旁加一行说明。推荐拦截：页内查找已能搜全部已加载内容，原生查找静默漏掉更容易误导。
4. **分页按钮的几何。** 作为虚拟列表第 0 项，或在没有更早历史时留同高占位。前者没有新视觉元素；后者实现更直接，但顶部会多一行固定提示。
5. **行内瞬态状态丢失。** 「显示更多」、FoldMore 展开、kernel 已加载结果在行滚出窗口后复位。接受，或者做阶段 4，把它们并入会话展示态，但这会新增一类持久数据。
6. **实机复测。** 本机生产构建 P0 结算 1.1 s，远程桌面上报告的是数秒。阶段 3 后是否在远程桌面实机按同口径复测一次，作为最终验收。

## 已定决策（2026-11-24）

- 接受 assistant-ui 的 `unstable_useThreadMessageIds` 与 `ThreadPrimitive.Unstable_MessageById`，使用处收拢在对话列表一个文件内，升级时由浏览器用例兜底。
- 新增 `@tanstack/react-virtual`，跟随最新版。
- Ctrl+F：拦截后打开 PRK 页内查找；页内查找按消息 id 定位，覆盖全部已加载消息。
- 「加载更早」按钮作为列表第 0 项参与测量。
- 行内「显示更多」、折叠块手动展开、kernel 结果展开在滚出窗口后复位，可以接受；第 4 阶段不做。
- 实施范围：阶段 1–3；阶段 1 同时消除 busy 翻转导致全部已挂载 MessageActions 重渲染（H1 根因）。

