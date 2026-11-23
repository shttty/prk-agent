# Gateway wire 与订阅传输

Gateway 使用 Linux Unix stream socket；Web HTTP/SSE 和 `attach` 是其客户端。
这是 PRK application protocol，不是 Pi stdio JSONL 协议。

## Access and framing

规则：[GEN-1](../contract.md)、[GEN-2](../contract.md)、[WEB-1](../contract.md)、[WEB-2](../contract.md)、[GEN-3](../contract.md)、[REQ-5](../contract.md)、[ORD-1](../contract.md)、[ORD-2](../contract.md)。
默认 socket：OS 临时目录下的 `/tmp/pi-gateway-UID/gateway.sock`；CLI 覆盖项为规范化绝对 `--socket PATH`，路径长度上限保留。父目录按默认权限递归创建，不检查 mode、uid 或 realpath；客户端连接前不做 lstat。已有路径先尝试连接，能连接则拒绝启动；不能连接时只 unlink 经 lstat 确认的 socket 后监听，普通文件、目录或符号链接等非 socket 路径必须保留并拒绝启动。
Gateway 发布快照、事件与结果时不做全量脱敏或内容改写；实例 token 仍省略，插件配置仍遮罩秘密值且不提供原值揭示，见各模块「约定」。

UTF-8 JSON 对象以换行分帧。

```json
{"v":1,"id":1,"method":"state","params":{"sessionId":"SESSION_ID"}}
```

| 帧 | 形状 |
| --- | --- |
| 成功 | `{"v":1,"id":1,"ok":true,"result":...}` |
| 失败 | `{"v":1,"id":1,"ok":false,"error":{"code":"INVALID_REQUEST","message":"..."}}` |
| 无法解析 | 错误帧的 `id:null` |

`id` 是连接内请求关联用的 positive safe integer；并发响应可乱序返回。
Pi sessionId 是唯一会话路由身份；host operation、task/result 和 client request 各有独立身份。

错误码：`INVALID_REQUEST`、`UNSUPPORTED_METHOD`、`DUPLICATE_ID`、`BUSY`、`UNAVAILABLE`、`HOST_ERROR`、`TOO_LARGE`、`NOT_FOUND`。
`NOT_FOUND` 表示未管理的会话或工具、未配置的 target。
`UNAVAILABLE` 包括没有 retained kernel / namespace 的读取。

默认限额：入站帧 1 MiB；出站帧/缓冲 8 MiB；每连接 32 pending requests；64 connections。
主动响应超出帧上限时返回 `TOO_LARGE`。推送不携带历史页；若其他事件本身仍超限，或连接的积压加当前帧超过限额，Gateway 记录时间、帧类型、会话和字节数后断开，不跳过帧继续流。配置字段见 [configuration](../configuration.md)。

## Subscription frames and ordering

规则：[ORD-6](../contract.md)、[ORD-5](../contract.md)、[LIFE-2](../contract.md)、[ORD-1](../contract.md)、[ORD-2](../contract.md)、[ORD-3](../contract.md)、[ORD-4](../contract.md)。
| Method | Parameters | Initial result |
| --- | --- | --- |
| `subscribe` | `{sessionId}` | `SessionHostSnapshot` |
| `unsubscribe` | `{}` | `{unsubscribed:true}` |
| `subscribeSessions` | `{}` | `WorkbenchSnapshot` |
| `unsubscribeSessions` | `{}` | `{unsubscribed:true}` |
| `subscribeTerminal` | `{sessionId,name}` | `TerminalSnapshot` |
| `unsubscribeTerminal` | `{}` | `{unsubscribed:true}` |

```json
{"v":1,"sessionId":"SESSION_ID","event":{}}
{"v":1,"collection":{}}
{"v":1,"sessionId":"SESSION_ID","name":"main","terminal":{"type":"stdout","data":"..."}}
```

对应类型为 `{v:1,sessionId:string,event:SessionHostEvent}`、`{v:1,collection:SessionLifecycleEvent}` 和 `{v:1,sessionId:string,name:string,terminal:TerminalEvent}`。
Collection lifecycle 没有 global sequence；交接期缓存事件可能重复快照中的 transition。
已入发送队列的帧可能先于 unsubscribe reply 到达。
事件字段见 [sessions](sessions.md#published-shapes-and-identities)、[monitor](kernel.md#monitor)、[workspace](workspace.md)。

## Loss and reconnect

规则：[REQ-6](../contract.md)、[REQ-7](../contract.md)、[REQ-8](../contract.md)、[LIFE-1](../contract.md)。
低层 timeout / socket loss 的本地错误为 `CLIENT_ERROR`，message 包含 `request outcome unknown`。
重连后的观察入口是 `workbench`、当前 `sessionId`、operation、messages 和 bounded recent outcomes。
每次 SSE 观察连接对应独立 Gateway connection，并从新 snapshot 开始。

API 进程可为后续浏览器操作建立新的 control connection。
CLI / `connectGateway` 的重连由调用者发起。

## 约定

- `src/gateway/wire` 持有同一 v1 信封、参数校验和错误；`socket-channel` 持有每连接的 UTF-8 帧缓冲；`socket-endpoint` 负责原端点探测与死 socket 清理。
- `socket-client` 的请求关联与监听器共享同一连接 ctx；`socket-server` 的 listener、peer 和单次订阅各保留原状态身份。订阅基线、缓冲与退订捕获不跨替换订阅复用，存入 ctx 的原无接收者回调仍无接收者调用。
- HTTP adapter 与 socket dispatcher 按完整必选宿主接口直接调用，不检测方法是否存在；`state`／`messages` 只读 Gateway `state`，`send` 只走 `nativeSend`，不回退 SessionHost 的快照或提交。宿主返回的业务错误沿现有错误路径保留，HTTP 与 socket 各自的入口参数校验不变。
- HTTP 路由与资源操作直接调用 `gateway.call(method, params)`，由同一 control connection 保留请求期限、错误和断线不重放语义；远程扩展安装仍取 Gateway 与 HTTP 请求期限的较大值。会话／集合观察和终端连接保留独立的流状态、配额和释放生命周期，不经通用调用替代订阅。
- `cli/run-cli.ts` 分派 Gateway、Web 与 attach 命令；各命令的 stop 保留自己的资源归属，attach 不提前装入 SDK 宿主。
