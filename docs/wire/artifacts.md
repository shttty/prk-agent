# Private artifact HTTP routes

规则：[TGT-4](../contract.md)、[TGT-5](../contract.md)、[TGT-2](../contract.md)、[TGT-1](../contract.md)、[TGT-3](../contract.md)、[WEB-17](../contract.md)、[模块约定](artifacts.md#约定)。
API 与 Gateway 使用同一 selected PRK home 的 assets store；HTTP routes 转发至 Gateway，只有 Gateway 持有 live `ArtifactStore` 写者。
Success：HTTP 200 `{tools,maxUploadBytes}`，tools 为 [configuration](../configuration.md#gateway-distributed-clis-tool_bin) 中的 manifest map。

| Method | Path | Body / query |
| --- | --- | --- |
| GET | `/api/artifacts` | No body or query. |
| POST | `/api/artifacts/upload?name=…&version=…&platform=…&sha256=…` | Raw `application/octet-stream`; `sha256` is optional, other query keys required exactly once. No compression. |
| POST | `/api/artifacts/current` | JSON exactly `{name,version}`. |
| POST | `/api/artifacts/delete` | JSON exactly `{name,version}`; current version cannot be deleted. |

| Field | Domain |
| --- | --- |
| name / version | `^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$` |
| platform | `x86_64` / `aarch64` |
| sha256 | 64 case-insensitive hex digits |
| upload type | `application/octet-stream`，无 compression |
| upload size | `artifacts.maxUploadBytes`（declared 与 chunked bodies） |

| Error | HTTP |
| --- | --- |
| hash mismatch / invalid input | 400 |
| missing version | 404 |
| duplicate version/platform / current deletion | 409 |
| stalled request body | 408 |
| upload cap | 413 |
| content type / compression | 415 |
| sanitized filesystem failure | 500 |

## Gateway methods and upload staging

| Wire method | Exact parameters | Result |
| --- | --- | --- |
| `artifactsList` | `{}` | Artifact manifest |
| `artifactsUpload` | `{name,version,platform,source,sha256?}` | Updated manifest |
| `artifactsCurrent` | `{name,version}` | Updated manifest |
| `artifactsDelete` | `{name,version}` | Updated manifest |

Manifest 的 wire shape 为 `{tools}`；HTTP 保持 `{tools,maxUploadBytes}`。
HTTP 将原始上传暂存在 owner-only `<home>/uploads/upload-<uuid>.tgz`，以绝对 `source` 路径转发，完成后删除暂存；RPC 不携带 base64 文件体。
Gateway 只接受该 home 的 `uploads` 目录内的 source，沿用 hash、大小、版本/平台重复及当前版本保护。
远程扩展 bundle 与 Node 发布也注入同一个 Gateway `ArtifactStore`，共用 `assets/manifest.json` 和 `assets/store/<sha256>`，不是第二个并发写者。
显式 CLI import 是 offline operation；运行前停止 Gateway 写者，不能把进程内串行化当作跨进程锁。取舍见 [design notes](../design-notes.md#分发制品缓存与导入)。


## 约定

- 实现分属 `src/artifacts/store/`、`upload-staging/` 与 `upload-error/`；`store/assemble-store.ts` 保留 `ArtifactStore` 构造 API，将内容、版本与清单方法绑定到唯一 `StoreContext`，不建立第二写者。
- 制品接口不得删除当前版本。
- 制品接口不得把单进程序列化当作跨进程事务。
- `tool_bin` 必须在完整校验后以 0755 原子安装到目标缓存。
- `tool_bin` 缓存元数据变化必须重验哈希。
- 分发制品必须保存在同一本项目主目录 `assets` 的 `manifest.json` 及按 `SHA-256` 寻址的 `store`。
- 在线制品清单必须由唯一网关 `ArtifactStore` 写者串行且原子发布，扩展构建不得另建写者。
- 仍有版本引用的内容块不得删除。
