# Lazy tool content

规则：[模块约定](tool-content.md#约定)、[WEB-10](../contract.md)、[REQ-13](../contract.md)、[WEB-11](../contract.md)、[模块约定](native.md#约定)。
## Descriptors

```ts
type ToolContentPreview = {
  preview: string; bytes: number; lines: number;
  version: string; // SHA-256 of the full corresponding value's compact JSON
};
// Assistant content toolCall: large arguments become arguments:{}, with inputPreview.
// Large toolResult: content:[{type:"text",text:outputPreview.preview}], with outputPreview.
type ToolContent = {
  sessionId: string; toolCallId: string;
  args?: unknown; argumentsError?: string; result?: unknown;
  inputVersion?: string; outputVersion?: string;
};
```

`toolContent.maxBytes` / `maxLines` 默认 8192 UTF-8 bytes / 40 lines。
测量覆盖 display text 与整个 compact JSON 的 bytes，包括 details、structured content、images、nested-call metadata。
Preview bounds 见 [configuration](../configuration.md#toolcontent)。

小值保留原有形状。
Deferred input 的 `arguments:{}` 配套 `inputPreview`；deferred result 的文本配套 `outputPreview`。
保留的 result metadata 是 routing、error、timestamp、duration，以及 bounded `details.outcome` / `interrupted`。
Live `tool_execution_*` 在 placeholder `args`、projected `result` / `partialResult` 旁给出 descriptors。
`message_start` / `message_end` 使用同一投影。

Malformed arguments 的 display text 来自 `argumentsError`。
该场景的 `inputVersion` 是 compact JSON `{args,argumentsError}`（字段顺序固定）的 SHA-256。

## Full-content lookup

`toolContent {sessionId,toolCallId}` → `ToolContent`。
HTTP：`GET /api/sessions/:sessionId/tool-content?toolCallId=ID`。
`toolCallId` query 参数只出现一次；`URLSearchParams` 可编码含 `/`、标点的 opaque tool ID。
Malformed/repeated query：400；missing call / unknown route：404。
完整回复仍受 wire / HTTP output cap 约束。

Running result 可以是 partial，返回版本可能随后变化。
当前原生分支的持久记录优先于 hosted execution observation，含已压缩和尚未分页加载的工具；observation 在 SDK `agent_end` 清理。

## Renderer hydration

`nativeAction extension-ui render` 支持：

- `expandedToolCallIds:string[]`：行展开状态。
- `toolContentExpandedIds:string[]`：明确 hydrated 的工具内容。

Full-content consumers 包括 expand-lines、code copy/selection、whole-page search、diff 和 nested-call summaries。
Export、copy、rerun/tree、reply fork、clone 的原生路径见 [native](native.md)。


## 约定

- 延迟描述符必须按工具展示文本及完整紧凑 `JSON` 的配置阈值生成。
- 延迟投影不得修改 `SDK` 原始参数、结果或会话记录。
