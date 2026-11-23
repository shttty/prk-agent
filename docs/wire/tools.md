# 沉淀工具库

规则：[模块约定](tools.md#约定)、[模块约定](skills.md#约定)、[模块约定](tools.md#约定)、[模块约定](skills.md#约定)。
## Persisted tools

Global store：`<PRK home>/tools/library.json`。
Kernel globals：`tool`、`library_sync`；saved SDK tool：`prk_saved_<name> {args?:unknown[],kwargs?:object}`，exposure `codemode`。

```python
@tool(persist=True, reason="future task class")
def reusable(value):
    return value + 1
```

保存数据包含 inspected synchronous Python source、imports、signature、docstring、trimmed reuse reason。
`library_sync()` 返回发现/刷新后的函数与 target import availability。
Internal prelude callbacks 的 markers 见 [kernel](kernel.md#execution-and-callbacks)。

## Library entry

```ts
type ToolLibraryEntry = {
  name:string;reason:string;version:number;status:"staging"|"promoted"|"archived";
  manual:boolean;successfulCalls:number;distinctSessions:number;lastUsedAt?:string;
  imports:string[];source:string;signature:string;docstring:string;
  available?:boolean;unavailableReason?:string;
};
```

列表按 name、version newest-first，包含 retained archived versions。
`successfulCalls` 是成功调用次数；`distinctSessions` 是成功使用的 native SDK session IDs 去重数。
Same-name save 使用新 reason / source version，旧 source archive；累计 usage 与 manual promotion 保留。
Archived versions 保留当时 metrics。
Import availability 按 instance 表示，未 probe 时省略 availability 字段。

## Methods and HTTP

| Wire | Params | HTTP POST | Body |
| --- | --- | --- | --- |
| `toolsList` | `{target?}` | `/api/tools/list` | `{target?}` |
| `toolsPromote` | `{name}` | `/api/tools/:name/promote` | `{}` |
| `toolsDemote` | `{name}` | `/api/tools/:name/demote` | `{}` |
| `toolsArchive` | `{name}` | `/api/tools/:name/archive` | `{}` |
| `toolsRestore` | `{name}` | `/api/tools/:name/restore` | `{}` |
| `toolsDelete` | `{name}` | `/api/tools/:name/delete` | `{}` |

Result：`{tools:ToolLibraryEntry[]}`。
Unknown names / unknown target：`NOT_FOUND`；manual promoted capacity occupied：`BUSY`。
Lifecycle 参数见 [configuration](../configuration.md)。


## 约定

- 沉淀工具必须是 `inspect` 提取的自包含同步 `Python` 函数且有非空复用理由，不得含闭包或不可导入的全局依赖。
- 沉淀工具必须在所属内核执行，不得在同一繁忙内核嵌套执行。
- 沉淀工具必须报告真实导入可用性。
- 共享沉淀工具必须写入本项目主目录的 `tools/library.json`。
- 工具及技能库不得以工作进程会话记录或目标专属存储作为第二权威。
