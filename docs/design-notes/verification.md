## 运行与验收证据

关联 [GEN-1](../contract.md)、[REQ-1](../contract.md)、[REQ-2](../contract.md)、[REQ-3](../contract.md)、[REQ-11](../contract.md)、[REQ-6](../contract.md)、[REQ-7](../contract.md)、[REQ-8](../contract.md)、[LIFE-1](../contract.md)、[模块约定](../configuration.md#约定)。
来源：原 `gateway-wire.md:3,664-684,698-729,733,760`。

- 网关命令名为 `gateway`，不是旧的 `daemon`。网关先于独立网页适配器启动；网页适配器没有模型或扩展参数。后端只提供接口，不提供页面或静态制品，也不要求前端构建。
- 界面位于 `web/` 独立的包及锁文件中；启动命令为 `cd web && PRK_API=http://HOST:PORT npm run dev -- [--host HOST] [--port PORT]`，默认代理后端是 `http://127.0.0.1:8787`。代理只把界面自身的 `Origin` 映为后端来源，其他来源原样转发，后端不加跨域资源共享。构建与预览使用同一代理；页面内容安全策略和同源反向代理由界面宿主负责。
- `Mantine` 管理应用外壳、管理界面与响应式控件；`assistant-ui` 使用外部存储式的网页请求与服务端事件运行时。
旧的文档对象渲染器和内置依赖路由已退场。
原文第 `760` 行的 `Marked` 与 `DOMPurify` 是旧实现；`web/chat/markdown/SafeLink.jsx`、`web/chat/markdown/SafeImage.jsx`、`web/chat/transcript/messages/MarkdownPart.jsx` 使用 `ReactMarkdown` 与 `assistant-ui` 的标记文本组件，链接只允许 `http(s)` 和 `mailto`，远端标记文本图片关闭。
- 项目工具结构定义使用上游支持的 `typebox 1.x`。旧的 2026-10-03 依赖基线记录：当时 `Jupyter services 7.6.4` 是最新稳定版，而注册表的 `latest` 停在 `7.5.11`；根目录与网页目录的锁文件分离，不因该历史记录建议变更依赖。

### 旧验收范围与入口

原顶层说明：

当前仅工作单元的产品契约遵循 [产品计划](../../PLAN.md) 中的 2026-10-26 决策。
所链接的 2026-09-22 验证账本记录了更早的多类型设计与实际运行的断言；它作为历史证据保留，不代表当前仅工作单元契约的验收。
早期失败仍是历史证据；这些结果既不解决远程调用的公开组装能力缺口，也不构成独立验收或整体完成状态 `RUN_COMPLETE`。

受控提供方的可复现入口（本次未执行）：

```sh
npm run check:native:sdk
npm run check:native:web
npm run check:gateway:workers
npm run check:history
npm run check:recovery
```

权威结果为当时的任务产物 `verification-results.json`（未随仓库发布）。
它记录早期多类型设计的原生开发套件、原生网页、工作台、历史、恢复、派生会话及生命周期运行；实际运行的断言仍属历史，不声称已验收当前仅工作单元契约。
常规集成工作不同于修复早期候选实现或探针引入的缺陷。
独立验收仍未完成；不声称整体 `RUN_COMPLETE`，也不声称获得部署授权。

历史证据（当时的 central-verification 结果 `all-runtime-results.json` 与 `verification-entrypoint-ledger.json`，未随仓库发布）：最初的 `TypeScript` 与资源导出失败后来已修复并重验；最初的原生浏览器失败使后续条款未运行；强制剪贴板拒绝与 `F4` 失败不改标为通过。
严格解析器、过滤式分支、持久崩溃前缀回执与替换回滚不再是当前验收契约。
普通剪贴板复制仍使用标准 `Clipboard API` 并报告实际成败；不要求为强制权限拒绝另做工程。

浏览器检查在每个测试后端前启动自己的 `web/` 下 `Vite` 开发服务器（`tests/fixtures/web-dev.mjs`），因此必须先安装网页依赖；无需构建。
浏览器检查需要已有的 `PI_TEST_PYTHON`、`PI_TEST_PLAYWRIGHT`、`PI_TEST_CHROMIUM`；使用测试自有的回环环境时，取消设置 `JUPYTER_URL`、`JUPYTER_TOKEN`、`PI_TEST_WEB_HOST`。
`TMPDIR` 须足够短，使完整的 `Unix` 套接字路径不超过 100 字节。`PI_TEST_WEB_EVIDENCE` 选择保留的证据。
受控提供方结果只证明实际执行的路径，不能证明真实外部模型的质量、成本、凭据或副作用；外部提供方运行需要明确授权。
本地通过不授权部署。

应用启动顺序是先网关，再独立网页适配器。
以下示例假定测试框架已准备好：自有临时目录内唯一且绝对的 `OWNED_SOCKET`，以及独立私有的 `PRK_HOME`。
不要换成网页侧模型或凭据：

```sh
node src/main.ts gateway --socket "$OWNED_SOCKET" \
  --model clp/gpt-5.6-luna \
  --home "$PRK_HOME" \
  --extension "$PRK_HOME/agent/npm/node_modules/@router-for-me/pi-cliproxyapi-provider/extensions/index.ts" \
  --no-skills
node src/main.ts web --home "$PRK_HOME" --socket "$OWNED_SOCKET" --host 127.0.0.1 --port 0
```

只有明确获授权的真实运行才可使用该模型。
分别记录启动参数、不含凭据的目标身份、工作单元提交、终端结果和可观测的提供方用量；一次工作单元提交可能需要多次提供方交互。
凭据由获授权的应用配置原地加载，绝不复制到浏览器制品、提示词或证据中。
受控提供方检查不是真实模型证据。
本地检查成功不意味着可以部署或重启生产环境。
