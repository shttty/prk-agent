
// Presentation policy for the "/" command menu.
//
// The Gateway capability catalog stays the authority on which commands exist.
// This module decides which builtins the Web composer advertises, and explains
// them in Chinese. A builtin is advertised only when it (1) actually executes
// from Web chat and (2) has no dedicated control elsewhere in the UI. Everything
// else stays out of the menu; if the user types it anyway, the composer says where
// to go instead.

/**
 * Advertised builtins. `summary` is the one-to-two line text under the command
 * name; `help` (optional) opens the detail dialog from the row's corner button.
 */
export const COMMAND_HELP = {
  compact: {
    summary: "把早先的对话压成摘要。命令后可加压缩指令，不是轮数。",
    help: {
      usage: ["/compact", "/compact 保留和数据清洗有关的结论"],
      body: [
        "让当前模型把较早的对话整理成一段摘要，之后的回复基于摘要继续，最近几轮保持原样。",
        "命令后的文字是给模型的压缩指令（不是保留轮数），比如指定要保留的结论。",
      ],
      notes: [
        "会真实调用模型，产生 token 费用。",
        "运行中发送会先中断当前任务再压缩；压缩中可以用停止按钮取消。",
        "会话记录里原来的消息仍然保留，只是后续请求不再逐条带上。",
      ],
    },
  },
};

/** Builtins that exist but are not advertised, and where the user should go instead. */
export const COMMAND_ELSEWHERE = {
  model: "模型在输入框下方切换。",
  thinking: "思考程度在输入框下方切换。",
  name: "重命名在侧栏会话卡片的菜单里。",
  new: "新建会话用侧栏的 ＋。",
  copy: "复制回复用回复下方的复制按钮。",
  tree: "网页不显示会话树；用消息下方的准星或编辑按钮。",
  fork: "在新会话中继续，用回复下方的分支按钮。",
  session: "统计在会话详情里；上下文看输入框下方的圆环。",
  export: "导出在侧栏会话卡片的菜单里。",
  clone: "复制为新会话在侧栏会话卡片的菜单里。",
  hotkeys: "快捷键在输入框的 ＋ 菜单里。",
  changelog: "发送后在对话里显示 Pi 版本和更新内容。",
  quit: "关闭标签页即可，Gateway 继续运行。",
  "scoped-models": "网页没有模型轮换快捷键。",
};

export const SETTINGS_LOCATION = "自动压缩和自动重试在会话详情里切换。";

/** Web keyboard and input help, shown from the composer's + menu. */
export const SHORTCUTS = [
  ["Enter", "发送"],
  ["Shift+Enter", "换行"],
  ["运行中 Enter", "按输入框下方的选择，补充当前任务或排到下一轮"],
  ["Ctrl/Cmd+Enter", "运行中这一条改用另一种：补充 ⇄ 排队"],
  ["Esc", "输入框中停止任务；先关闭补全菜单"],
  ["↑ / ↓", "输入框为空时翻看发过的消息"],
  ["/", "调出命令；↑↓ 挑选，Tab/Enter 填入，Esc 关闭"],
  ["@", "执行会话里引用目标实例上的文件"],
  ["粘贴 / 拖入", "添加图片和文本文件"],
];

export const UNSUPPORTED_REASON = {
  llama: "当前运行时没有加载 llama 扩展。",
};

/** Longest summary we show without offering the detail dialog. */
export const SUMMARY_LIMIT = 90;
