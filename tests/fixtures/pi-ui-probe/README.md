# Pi UI probe（只认 Pi 1.6.0）

这是本地 Pi package 测试夹具，不是运行器、快照测试或网页实现。入口是 `/probe <case> [argument]`，参数可补全；`/probe help` 列出全部用例。

## 声明检查

在仓库根目录运行：

```sh
npm run check:ui-probe
# 分开运行：
npm run check:ui-probe:types
npm run check:ui-probe:components
```

`uiCoverage` 绑定 `keyof ExtensionUIContext`；`API_METHODS` 绑定需求中的 `ExtensionAPI` 方法；前景／背景表分别绑定 `ThemeColor`／`ThemeBg`。组件脚本对照已安装包的公开 `index.d.ts` named re-exports，区分组件类、类型和辅助函数，同时核对两个包均为 1.6.0。组件表的值绑定实际用例键；新增或漏掉组件会失败。公开组件集合仍是 16 个 pi-tui 和 26 个 Pi 交互组件。tool、message、entry renderers 均调用注入的 `keyText/keyHint`；PRK 托管时使用各会话独立绑定，不初始化全局 keybindings／theme。下方原生 TUI 抓屏属于历史 1.1.0，不宣称已重验 1.6.0 全量 TUI。

`check:quick` 与 `check:full` 都包含该声明／组件检查，也可单独运行 `npm run check:ui-probe`。它不会自动启动 Pi、tmux、安装包或调用模型。

## 独立目录和原生启动（历史记录）

```sh
export PI_CODING_AGENT_DIR="$PWD/.runtime/pi-ui-probe/agent"
export PI_TELEMETRY=0
pi install "$PWD/tests/fixtures/pi-ui-probe"
pi install npm:pi-cc-extensions@1.0.1
```

模型用例还需在这个目录配置 `clp`。实测安装了既有 provider 的相同版本 `npm:@router-for-me/pi-cliproxyapi-provider@1.4.21`，只将现有 provider 配置和模型缓存复制到测试目录；不打印凭据，不修改来源目录。

单独启动 probe（不加载其他插件）：

```sh
pi --offline --no-approve --no-context-files \
  --no-skills --no-prompt-templates --no-mcp --no-extensions \
  -e "$PI_CODING_AGENT_DIR/npm/node_modules/@router-for-me/pi-cliproxyapi-provider/extensions/index.ts" \
  -e "$PWD/tests/fixtures/pi-ui-probe/index.ts" \
  --provider clp --model gpt-5.6-luna --thinking low --no-builtin-tools
```

带主题插件时，在 `-e probe` 前增加：

```sh
-e "$PI_CODING_AGENT_DIR/npm/node_modules/pi-cc-extensions/extensions/index.ts"
```

本次在专用 `tmux -L pi-ui-probe` 的 `pi-ui-probe` 会话中运行，终端 140×44；证据使用 `tmux -L pi-ui-probe capture-pane -e -p -t <pane>`。不要使用默认 socket 或日常 agent 目录。

## 用例与操作

| 类别 | 数量／入口 | 操作 |
| --- | --- | --- |
| UI context | 28 个声明成员；`ui.ts` 的 `uiCoverage` | 对话框按 Enter 提交／Esc 取消。`editor_text`、`paste` 留下草稿，下一条命令前清空。 |
| API 界面行为 | 19 项；`api.ts` | `message-renderer`／`message-hidden` 后查看 transcript 与 `/tree`；`entry-renderer` 追加原生 custom entry；`session-name-label` 与真实 turn 的标签在 `/tree` 可见。 |
| 选项与行为 | 22 组 | `dialog_timeout <select\|confirm\|input>` 等待倒计时；`dialog_signal <kind>` 等待取消。widget 上／下／覆盖／清除；custom 两种挂法、done、dispose、刷新；overlay 9 锚点、两种 margin、百分比尺寸、maxHeight、隐藏、叠放、不抢焦点、焦点切换；editor/footer/header 设置与恢复。 |
| 组件 | 16 + 26 + 1 opaque | `tui-*`／`pi-*` 打开组件；Esc 关闭。输入组件按 Enter 观察回调；选择器箭头＋Enter。`opaque-component` 输入 `o`。MouseRegion 用真实终端鼠标输入。 |
| 主题 | 49 fg + 7 bg + 5 文字属性 = 61 | `theme-fg-1/2/3`（20/20/9）、`theme-bg`、`theme-styles`；Esc 关闭。 |

其他行为：

- `custom_overlay`／`custom_editor` 每 250ms `requestRender()` 更新 tick；Enter 调用 done，Ctrl+R 强制刷新。dispose 清理 timer，并留下 `probe-lifecycle` 状态。
- `overlay_controls <anchor>`：`h` 隐藏／显示第二层，`f` 聚焦并置前，`u` 释放焦点，Esc 结束。第二层初始 `nonCapturing=true`。`overlay_position` 用动态 options 和百分比 row/col。
- `editor_component`：调用 `setEditorComponent`（网页忽略，`editor_factory` 仍读到默认）。footer/header/widget 的恢复或清除会显示真实 dispose 回调状态。
- `terminal_input` 只监听下一个 raw terminal input，打印 JSON、原样放行并取消订阅，不推测网页语义。
- `autocomplete` 增加 `/probe-completion` 建议；`command-autocomplete` 后输入 `/probe-api-command e` 查看 `entry/events`。`shortcut` 对应 Ctrl+Alt+P；tmux 实测用 CSI-u `ESC[112;7u`。
- `working`、`working-static`、`working-none`、`working-hide`、`working-reset` 必须在真实生成时观察。`thinking` 后 Ctrl+T 隐藏已有真实 thinking，`thinking-reset` 恢复标签。
- **只有 `send-user-message` 会主动启动模型回合**。默认请求三个真实工具。`probe_default` 的 `hold=true` 在 partial update 后打开公开 `ui.confirm`；抓屏后 Enter 释放真实结果，不靠定时截图猜测 partial。`probe_self` 使用 self shell，`probe_resolved` 使用 resolver。没有伪造工具调用。
- Pi 组件中 AssistantMessage 使用当前会话的真实回复，Session/Tree/UserMessage selectors 使用公开会话数据。Branch/Compaction/Skill/CustomMessage 的独立组件用例只提供标明为 probe 的展示样本，不声称实际执行了分支总结、压缩、技能或认证。
- Footer、ModelSelector、SettingsSelector、BashExecution、ToolExecution 的用例走**原生路径**，不创建影子 AgentSession/ModelRuntime/设置状态：恢复 footer、填入 `/model` 或 `/settings` 后 Enter、填入 `!!printf ...` 后 Enter，以及真实模型工具回合。其余 21 个 Pi 组件由插件通过公开构造器复用。

## 主题插件与边界

`/probe theme-set cc-dark`、`cc-light`、`system` 在原生 TUI 中切换；`theme-get` 只加载不切换。Pi 1.1.0 不识别 `/theme`，不要按第三方 README 里的旧命令触发模型。PRK 网页托管中 `ctx.ui.theme` 固定为标记主题 `prk-web`（`shared/pi-web-theme.json`），`theme-set` 返回不可用；`theme-fg-1/2/3` 在网页上逐个 token 显示网页语义色（`check:extension-ui:web` 断言）。

`pi-cc-extensions` 正常加载，但其原型改动会把同一真实工具回合画成 CC 的 `Multiple Tools` 分组，覆盖 probe 的公开 renderer 外观。保留这个差异，不修改或修复第三方。网页隔离不在本夹具本轮实现／验收范围。

`Image` 已实际实例化并在 tmux 中显示官方 `[Image: [image/png] 1x1]` fallback；没有 Kitty/iTerm2 图片协议，像素显示未验证。
