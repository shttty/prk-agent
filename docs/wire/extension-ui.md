# Hosted extension UI

规则：[WEB-12](../contract.md)、[ORD-7](../contract.md)、[WEB-13](../contract.md)、[WEB-12](../contract.md)、[ORD-8](../contract.md)、[LIFE-17](../contract.md)、[WEB-15](../contract.md)、[REQ-4](../contract.md)、[模块约定](native.md#约定)、[模块约定](extension-ui.md#约定)、[LIFE-17](../contract.md)、[模块约定](extension-ui.md#约定)、[ORD-1](../contract.md)、[ORD-2](../contract.md)、[ORD-3](../contract.md)、[ORD-4](../contract.md)、[ORD-6](../contract.md)、[LIFE-18](../contract.md)、[模块约定](native.md#约定)。
## UI side channel

`nativeAction {sessionId,requestId,action:"extension-ui",args}`。
该 action 使用 active selected session 的 UI channel。
Snapshot 字段为 `extensionUi`；host event 为 `extension_ui`，外层携带 `streamId` 与 host sequence。

| Operation | Args |
| --- | --- |
| `render` | `{operation,width,height,clientId,expandedToolCallIds?,toolContentExpandedIds?,operationId?,historyStart?}` |
| `dialog` | `{operation,id,value? ,cancel?}`，ask 形状见下节 |
| `editor` | `{operation,text,clientId}` |
| `component` | `{operation,nodeId,componentOperation,value?,clientId}` |
| `release-client` | `{operation,clientId}` |
| autocomplete | existing autocomplete operation payload |

`width` 是 integer terminal columns；`height` 是 terminal rows。
Render data 含 raw nodes、`streamId`、`revision`、tool `{call,result,shell}` phases、message/entry renderer output。
`historyStart` 是浏览器当前已加载的最早消息条目 ID；默认只渲染最新历史页。`messages` 以原生条目 ID 为键；`entries[].beforeEntryId` 指向此条目之后第一条投影消息，`null` 表示分支末尾。
Actions 附当前 `data.extensionUi` 与 `data.streamId`；计数器及接收规则见 [ORD-12](../contract.md)、[ORD-13](../contract.md)、[ORD-15](../contract.md)、[ORD-19](../contract.md)。
`GET /api/ui` → `{extensionUiRenderIntervalMs,gatewayRestartUnit}`，来自 Web process 的 HTTP 与 gateway config；`gatewayRestartUnit` 见 [Gateway restart](http.md#gateway-restart)。
Scalar snapshot 与 rendered view 各有独立更新边界。
Data dialogs 使用 scalar snapshot；custom components 使用 render output。

Host SDK binding 为 `mode:"tui",uiContext`，`ctx.hasUI:true`。
Web `setEditorComponent` 保持 PRK composer；可解析 `ctx.ui.custom` nodes 使用 native Web controls/callbacks，opaque nodes 为 read-only + cancel。
SDK resources 由 `additionalThemePaths` 加载。
Native `ui_prompt_start/end` 为 ExtensionRunner events。

## Remote extension UI

远程 Node 宿主的 extension context 为 `mode:"rpc",hasUI:true`，与 Gateway 的本机托管 `mode:"tui"` 不同。
反向 UI 请求进入所属 Gateway 会话已有的 `extension-ui` 通道，不新增 Web routes 或界面身份。

| Remote capability | Behavior |
| --- | --- |
| `select` / `confirm` / `input` / `editor` | Forward existing data dialogs and return answers; supported dialog timeout/signal cancellation stays on the owning call |
| `notify` / `setStatus` / `setTitle` | Forward scalar UI updates |
| `setEditorText` / `pasteToEditor` | Forward text through existing editor updates |
| `setWidget` | Forward text-line arrays or clear; component widgets log unsupported |
| `custom`, renderers, terminal input, editor components and remaining TUI-only methods | RPC unsupported behavior with logs; not general TUI passthrough |
| `ui.theme` | Explicit unsupported error and log; rationale in [design notes](../design-notes.md#远程扩展宿主正式接入) |

关闭/换代遵循 [LIFE-19](../contract.md)、[LIFE-20](../contract.md)，回答关联遵循 [ORD-17](../contract.md)，界面接收继续使用 [ORD-12](../contract.md) 至 [ORD-19](../contract.md)。
目标进程 `generation` 只隔离传输帧与回调，不进入 UI snapshot，也不参与 Web revision 比较。

## Ask

```ts
type AskPrompt = {id:string;kind:"ask";questions:AskQuestion[];expiresAt?:number};
type AskQuestion = {
  id:string;question:string;header?:string;
  options:{label:string;description?:string;preview?:string}[];
  multi?:boolean;recommended?:number;
};
type AskAnswer = {id:string;selected?:number[];custom?:{text:string};note?:{text:string}};
```

`recommended` 是 0-based option index。
Direct mode 声明 `ask`；code mode 为 `gateway.ask(questions=[...])`，返回 tool text。
Dialog answer：`{operation:"dialog",id,answers:AskAnswer[]}`。
`{id,chat:true}` 返回 discuss-first outcome；`{id,cancel:true}` 返回 cancelled tool outcome。
Web cancel button 使用普通 operation cancel route。
Invalid answer：`unavailable`，dialog 保持 open。
`session.askTimeoutMs > 0` 时使用 `expiresAt`；自动答案为 recommended option（否则 first），附 auto-selected 标记。
Browser page 存放 unsubmitted ask drafts。

## Waiting for user input

会话快照与工作台行在待答 `ask`（direct 或 kernel）、扩展 `confirm` / `select` / `input` / `editor`，或安装了 `blocked` 标记的本机 `custom` 组件活跃时含 `blocked:true`。其他自定义组件、通知、终端及后台工作不计入。`blocked` 不改变执行生命周期 `state`；作答、取消、超时或宿主清理使最后一个等待点消失时，快照省略该字段。

工作台行另以 `asking:true` 标明存在 PRK `ask`，供提问通知使用。工作台的 [`session_attention_changed`](http.md#independent-web-workbench) 集合事件同时推送等待、重试宽限与出错停止的变化。见 [WEB-51](../contract.md)、[ORD-8](../contract.md)。

## Notifications and renderers

`notify` projection fields 含 `sessionId`、SDK leaf anchor / projection position；`afterEntryId` 指向网页通知之前最后一条持久消息，`null` 表示分支开头；`afterLive` 表示通知跟在尚未持久化的回复后。
Consecutive info at one anchor coalesces；warning / error append。
Registered definition 是 `resolveToolRenderers` 的 base。
`renderShell:"default"` 是 native Web shell；`"self"` 是 plugin region。
Missing/failed render phase 保留 native Web content 与 visible errors。
Renderer text 原样运输，browser suppresses TUI colors。
界面流身份与对话框 UUID 见 [ORD-17](../contract.md)、[ORD-18](../contract.md)；托管模式与 TUI limits 见 [design notes](../design-notes.md#插件配置与宿主限制)。

`extension-ui` 的 `tools` 按工具自身 `toolCallId` 返回 call/result/shell。运行中嵌套调用按公开执行事件的真实工具名渲染；`agent_end` 仍清理瞬态执行载荷。已完成的 `tool_call` 第一层透传目标从外层结果的 `nestedCalls.calls` 精确选择 `<outer id>/1`，使用其真实名称、参数和耗时及外层透传的 content/details/isError 重建相同渲染；嵌套参数因 SDK 大小限制省略时，从对应持久外层调用的 `args` 读取。每次构建均复用原注册 renderer，外层条目不变，不新增持久字段。

历史恢复仅覆盖该第一层透传目标：SDK 1.4.0 的其他嵌套条目没有保存结果，不能重建其 result renderer。缺少真实调用记录或可用参数时不伪造渲染。


## 约定

- 插件通知不得放入模型输入、`JSONL` 或跨重启通知存储。
- 渲染阶段必须按实际注册工具定义解析，阶段缺失或失败必须保留原生网页内容和可见错误。
- 渲染器不得实例化上游终端界面执行宿主或覆盖上游原型。
- 渲染文本不得改作另一份结果。
- 插件通知必须绑定宿主会话和公开 `SDK` 投影锚点。
- 远程界面必须仅透传已声明的 `Pi RPC` 子集，不得伪造通用终端组件能力。
- 远程 `ui.theme` 访问必须明确报错并记录日志，不得用近似颜色重建主题。
