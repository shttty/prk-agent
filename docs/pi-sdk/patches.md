# Pi SDK 补丁

## PRK 配置目录与环境变量隔离

- 改什么：`scripts/patch-pi.mjs` 在 `@earendil-works/pi-coding-agent/package.json` 写入 `piConfig = {name:"prk", configDir:".prk"}`。脚本由 `postinstall` 在安装时执行；配置已一致时不写入，可重复执行。
- 为什么改：Pi 的项目目录名 `CONFIG_DIR_NAME` 和环境变量名 `ENV_AGENT_DIR` 在模块加载时从 Pi 自己的 `package.json` 读出，SDK 没有参数可以传。不改的话，PRK 会话会读到项目里给用户自用 Pi 准备的 `.pi/` 配置；PRK 子进程会带上 `PI_CODING_AGENT_DIR`，在 PRK 终端里运行 `pi` 会用错 agent 目录。改后分别为 `.prk` 和 `PRK_CODING_AGENT_DIR`。这个钩子是 Pi 文档 `docs/cli-integration.md`「Fork and rebrand Pi」写给源码 fork 的用法。
- 怎么检查：`src/application/sdk-brand/assert-brand.ts` 在 Gateway 启动时校验 `CONFIG_DIR_NAME === ".prk"`，不相等就拒绝启动。
- 适用版本：Pi **1.6.0**；其发布产物 `dist/config.js` 与 1.5.2 相同，继续只改原有 `piConfig` metadata。升级时复核该改动。

## 临时：Google thinking level `xhigh`

- 改什么：`scripts/patch-pi.mjs` 改 `@earendil-works/pi-ai/dist/api/google-shared.js`：`resolveGoogleThinkingLevel` 和 `toGoogleThinkingLevel` 各加 `xhigh`，`GOOGLE_SDK_THINKING_LEVEL_MAP` 加 `XHIGH: "XHIGH"`。文件里已有 `"xhigh"` 就跳过；锚点对不上就报错停止安装。
- 为什么改：Gemini 4 Hydrogen 支持 `xhigh`，provider 的 `thinkingLevelMap` 写了 `"xhigh": "xhigh"` 后可以选，但 resolver 只认 minimal/low/medium/high，请求发出前就抛 `Unsupported Google thinking level mapping`。没有配置项能绕开。pi-ai 锁定的 `@google/genai` 2.32.0 没有 `ThinkingLevel.XHIGH`，不过 SDK 不校验 `thinkingConfig`，原样发字符串 `"XHIGH"` 即可。上游 issue earendil-works/pi#12177、#12184 都以 not planned 关闭；1.6.0 的 resolver 与映射仍无 `xhigh`。
- 怎么检查：`src/application/sdk-brand/assert-google-patches.ts` 在 Gateway 启动时用一个探针模型调 resolver，结果不是 `XHIGH` 就拒绝启动。
- 适用版本：Pi **1.6.0**（`@google/genai` 2.32.0）。等发布版 pi-ai 原生支持 `xhigh` 后，删掉这组补丁和对应的启动检查。

## 临时：Google 新增 finish reason

- 改什么：同一个文件里的 `mapStopReason` 处理 5 个未识别的值：`MALFORMED_RESPONSE`、`MISSING_THOUGHT_SIGNATURE`、`ESCALATION`、`PUP_LIMITED_DISABLED`、`MODEL_ARMOR` 返回 `"error"`，原始值仍留在 `rawStopReason`。文件里已有 `"MALFORMED_RESPONSE"` 就跳过。
- 为什么改：服务端已经会返回这些值（内网 Gemini 实际返回过 `MALFORMED_RESPONSE`），1.6.0 的 switch 仍会走到 `default` 抛 `Unhandled stop reason`。1.6.0 已用 `FinishReason.CONTINUATION` 映射为 `"length"`，不再补该分支。
- 怎么检查：同一个启动检查确认 `MALFORMED_RESPONSE` 返回 `"error"`。
- 适用版本：Pi **1.6.0**；值列表按 `@google/genai` 3.4.0 的 `FinishReason` 核对。升级 pi-ai 时逐个确认上游是否已处理，已处理的删掉。

## PRK provider 所有权策略（2026-11-17 批准）

- 改什么：仅由 `scripts/patch-pi.mjs` 修改 Pi **1.6.0** 的 extension loader、resource loader、runner 与对应声明，增加 `providerPolicy` 与 `providerOnly`；不修改 ModelRuntime、模型请求或凭据实现。
- 公开接口缺口：原 `extensionsOverride` 在工厂执行后才到达，无法观察加载期注销；抛错会整体丢弃插件。新策略在工厂提交时处理 registerProvider 两个重载及 unregisterProvider，运行期仍逐次处理。true 执行、false 确认但不执行、字符串拒绝并报告结构化 `PROVIDER_POLICY` 错误；拒绝不打断其他工具、hook、命令注册。
- 工厂成功才提交 provider 变更；providerOnly 在普通 runtime 变更与 flag 提交前，丢弃没有允许注册 provider 的实例及其 SDK 总线订阅。不承诺回滚插件自己的 JS、timer 或文件副作用。所有权与手写优先规则属于 PRK，见 [模型配置](../configuration.md)。
- 包来源来自 Pi 资源元数据，非 package 来源使用扩展路径作为身份；不以源码文本猜测 provider。策略错误同时保存在资源错误与运行期 runner 错误事件中。
- 启动检查：`src/application/sdk-brand/assert-provider-policy.ts` 实际加载隔离工厂，核对注册／注销均被拒绝、命令保留和非 provider 丢弃；任一行为不符拒绝启动。版本或源码锚点不符时补丁脚本拒绝，升级时须重审所有修改。
- 当时的聚焦验证使用真实 SDK、真实包加载及内置 faux provider，覆盖双重载、加载期及绑定后注销、结构化错误、保留注册、已有模型流和非 provider 总线订阅清理。
