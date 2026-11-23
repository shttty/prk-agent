import { parseTodoWidget } from "../../../../web/chat/extension-ui/widgets/todo/parse-todo-widget.js";

export function createFixture() {
  const now = Date.now();
  const GiB = 1024 ** 3;
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
  /** A smooth, deterministic series of `n` points. */
  const series = (n, base, amp, phase, noise, lo, hi) => Array.from({ length: n }, (_, i) => +clamp(base + amp * Math.sin(i / 11 + phase) + amp * 0.45 * Math.sin(i / 4.3 + phase * 2) + noise * (rand() - 0.5), lo, hi).toFixed(2));
  const POINTS = 180; // 15 minutes of Gateway history at the fast 5-second cadence.
  const cpu = series(POINTS, 34, 16, 0.4, 14, 2, 100).map((value, i) => (i > 150 && i < 162 ? Math.min(96, value + 42) : value));
  const mem = series(POINTS, 61, 2.5, 1.2, 0.8, 0, 100).map((value, i) => +(value + i * 0.012).toFixed(2));
  const load = series(POINTS, 2.1, 0.7, 2.1, 0.5, 0.1, 16);
  const disk = Array.from({ length: POINTS }, (_, i) => +(71.2 + i * 0.0021).toFixed(3));
  const gpu = series(POINTS, 38, 30, 0.2, 18, 0, 100).map((value, i) => (i < 40 ? Math.max(0, value - 30) : value));
  // The newest sample is the one the tiles print: settle each series on a typical "busy" reading.
  for (const [values, end] of [[cpu, 37.4], [gpu, 54], [load, 2.31]]) values.splice(-3, 3, (values.at(-4) + end) / 2, end - 0.6, end);
  /** A session row's `monitor`; `at` picks the sample (index into the series) and its age. */
  const monitorOf = ({ withGpu = true, added = 42, removed = 7, files, at = POINTS - 1, ageMs = 2000 } = {}) => ({
    state: "ok",
    machine: {
      ageMs, sampledAt: now - ageMs, cpu: { pct: cpu[at], cores: 16 }, load: [load[at], 1.98, 1.64],
      mem: { total: 64 * GiB, available: 64 * GiB * (1 - mem[at] / 100) }, disk: { total: 1863 * GiB, free: 1863 * GiB * (1 - disk[at] / 100) },
      gpus: withGpu ? [{ name: "NVIDIA RTX 4090", util: Math.round(gpu[at]), memUsed: 9.8 * GiB, memTotal: 24 * GiB }] : [],
    },
    changes: { ageMs: 4000, source: "git", added, removed, truncated: false, files: files || [
      { path: "analysis.py", status: "M", added: 30, removed: 5 }, { path: "report/summary.md", status: "A", added: 12, removed: 0 }, { path: "data/old_regions.csv", status: "D", added: 0, removed: 2 },
    ] },
    alerts: {},
  });
  const monitorHistory = Array.from({ length: POINTS }, (_, at) => {
    const value = monitorOf({ at, ageMs: (POINTS - 1 - at) * 5000 + 2000 }).machine;
    return { at: value.sampledAt, value };
  });

  const targets = [
    { id: "alpha", label: "Alpha · GPU 工作站", local: true, cwd: "/home/user", python: "/usr/bin/python3", tags: ["gpu", "家里"] },
    { id: "office", label: "办公室", local: false, sshCommand: "ssh -T 203.0.113.5", cwd: "/srv", python: "/usr/bin/python3", tags: ["办公室"] },
  ];
  const workers = [
    { name: "w6", label: "九月对账", capability: "worker", sessionId: "s7", state: "closed", target: "office", cwd: "/srv/finance/2026-09" },
    { name: "w5", label: "旧版 ETL 排查", capability: "worker", sessionId: "s6", state: "closed", target: "alpha", cwd: "/home/user/etl" },
    { name: "w3", label: "训练 baseline 模型", capability: "worker", sessionId: "s3", state: "sleeping", target: "office", cwd: "/srv/ml/baseline" },
    { name: "w8", label: "日常", capability: "worker", sessionId: "s5", state: "idle", target: "alpha", cwd: "/home/user", projectName: "日常" },
    { name: "w4", label: "整理实验日志", capability: "worker", sessionId: "s4", state: "running", target: "office", cwd: "/srv/ml/logs", derivation: { createdBy: "w8", owner: "w8", lifecycle: "temporary" } },
    { name: "w2", label: "清洗 2026Q3 原始数据", capability: "worker", sessionId: "s2", state: "running", target: "alpha", cwd: "/home/user/data/raw", monitor: monitorOf({ added: 128, removed: 40 }) },
    { name: "w7", label: "新会话", capability: "worker", sessionId: "s8", state: "idle", target: "alpha", cwd: "/home/user/scratch" },
    { name: "w9", label: "核对华东退货", capability: "worker", sessionId: "s9", state: "idle", target: "office", cwd: "/srv/finance", derivation: { createdBy: "w1", owner: "w1", lifecycle: "temporary", phase: "submitted" } },
    { name: "w1", label: "销售数据分析", capability: "worker", sessionId: "s1", state: "idle", target: "alpha", cwd: "/home/user/data/sales", projectName: "Q3 报表", monitor: { ...monitorOf(), remoteHost: { state: "running", generation: "g3", pid: 31337, memory: { workingSet: 0.12 * GiB, memoryMax: GiB, memorySwapMax: 0, oomKill: 0 } } } },
  ];
  const archive = [
    { group: "a1", label: "八月月报", at: new Date(now - 2 * 86400_000).toISOString(), sessions: [
      { name: "a1", label: "八月月报", capability: "worker", target: "alpha", cwd: "/home/user/reports", projectName: "月报" },
      { name: "a1c", label: "画趋势图", capability: "worker", lifecycle: "temporary", owner: "a1", target: "alpha", cwd: "/home/user/reports" },
    ] },
    { group: "a2", label: "周计划", at: new Date(now - 6 * 86400_000).toISOString(), sessions: [{ name: "a2", label: "周计划", capability: "worker", target: "alpha", cwd: "/home/user", projectName: "日常" }] },
    { group: "a3", label: "试跑 vLLM", at: new Date(now - 12 * 86400_000).toISOString(), sessions: [{ name: "a3", label: "试跑 vLLM", capability: "worker", target: "office", cwd: "/srv/ml", kernelOrphan: true }] },
  ];
  const models = { models: [
    { value: "clp/claude-opus-5-5", label: "Claude Opus 5.5", provider: "clp", thinkingLevels: ["off", "low", "medium", "high"] },
    { value: "clp/gpt-6", label: "GPT-6", provider: "clp", thinkingLevels: ["off", "low", "medium", "high", "xhigh"] },
  ], defaultModel: "clp/claude-opus-5-5", defaultThinkingLevel: "medium" };

  const todo = (id, content, status, extra = {}) => ({ id, content, status, ...extra });
  const todosA = [todo("1", "读取 sales.csv，检查列和缺失值", "completed"), todo("2", "按地区汇总销售额", "in_progress"), todo("3", "画月度趋势图", "pending"), todo("4", "写结论到 report/summary.md", "pending")];
  const todosB = [todo("1", "读取 sales.csv，检查列和缺失值", "completed"), todo("2", "按地区汇总销售额", "completed"), todo("2a", "华东拆分到省", "completed", { parent: "2" }),
    todo("3", "画月度趋势图", "in_progress"), todo("4", "核对华东 9 月下滑 12% 的原因", "blocked", { reason: "缺 9 月退货明细" }), todo("5", "写结论到 report/summary.md", "pending"), todo("6", "导出 PDF", "cancelled")];
  const summary = (todos) => ({ total: todos.length, ...Object.fromEntries(["pending", "in_progress", "completed", "cancelled", "blocked"].map((s) => [s, todos.filter((t) => t.status === s).length])) });
  const todoResult = (id, todos, before) => ({ role: "toolResult", toolCallId: id, toolName: "todo_list", content: [{ type: "text", text: JSON.stringify({ todos, revision: 2, summary: summary(todos) }) }], details: { result: { todos, revision: 2, summary: summary(todos) }, before } });
  const pyCode = "import pandas as pd\n\ndf = pd.read_csv(\"data/sales.csv\", parse_dates=[\"date\"])\n# 按地区、月份汇总\nmonthly = (df.groupby([\"region\", df.date.dt.to_period(\"M\")])[\"amount\"]\n             .sum().unstack(fill_value=0))\nprint(monthly.tail(3).T)";
  const pyOut = "region      华东      华北      华南     西南\ndate\n2026-07   1284.0   902.5   1130.2   611.0\n2026-08   1342.7   911.0   1198.4   640.3\n2026-09   1181.6   934.8   1207.9   652.1";
  const answer = "按地区汇总完成，9 月合计 **3,976.4 万**，环比 −2.7%。\n\n| 地区 | 8 月 | 9 月 | 环比 |\n|---|---:|---:|---:|\n| 华东 | 1,342.7 | 1,181.6 | −12.0% |\n| 华南 | 1,198.4 | 1,207.9 | +0.8% |\n| 华北 | 911.0 | 934.8 | +2.6% |\n| 西南 | 640.3 | 652.1 | +1.8% |\n\n下滑全部来自华东。复现汇总：\n\n```python\nmonthly = df.pivot_table(index=\"region\", columns=df.date.dt.month,\n                         values=\"amount\", aggfunc=\"sum\")\nmonthly[9] / monthly[8] - 1\n```";
  const t = (offset) => now - 600_000 + offset;
  const assistantCall = (text, id, name, args, offset) => ({ role: "assistant", content: [...(text ? [{ type: "text", text }] : []), { type: "toolCall", id, name, arguments: args }], timestamp: t(offset), stopReason: "toolUse" });
  const toolOut = (id, name, text, offset, extra = {}) => ({ role: "toolResult", toolCallId: id, toolName: name, content: [{ type: "text", text }], timestamp: t(offset), ...extra });
  const w1Messages = [
    { role: "user", content: [{ type: "text", text: "读一下 data/sales.csv，按地区汇总 7–9 月销售额，看看哪里在下滑" }], timestamp: t(0) },
    assistantCall("先列个计划。", "c1", "todo_list", { todos: todosA }, 2000), { ...todoResult("c1", todosA, []), timestamp: t(2100) },
    assistantCall("", "c2", "bash", { command: "ls -la data && wc -l data/sales.csv" }, 4000),
    toolOut("c2", "bash", "total 5120\n-rw-r--r-- 1 user user 4.9M Oct 16 22:10 sales.csv\n-rw-r--r-- 1 user user  12K Oct 16 22:10 regions.json\n48213 data/sales.csv", 4600),
    assistantCall("", "c3", "kernel_code", { code: pyCode }, 7000), toolOut("c3", "kernel_code", pyOut, 9400),
    assistantCall("", "c4", "read", { path: "report/summary.md" }, 11000), toolOut("c4", "read", "# Q3 销售小结\n\n（待补充）", 11200),
    assistantCall("", "c5", "todo_list", { todos: [{ id: "2", status: "completed" }, { id: "3", status: "in_progress" }], merge: true }, 13000), { ...todoResult("c5", todosB, todosA), timestamp: t(13100) },
    { role: "assistant", content: [{ type: "text", text: answer }], timestamp: t(16000), stopReason: "stop" },
    { role: "user", content: [{ type: "text", text: "华东这 12% 是退货还是出货少了？" }], timestamp: t(60000) },
    { role: "assistant", content: [{ type: "text", text: "需要 9 月的退货明细才能拆开。`data/` 里只有出货表，没有退货字段；把退货导出放到 `data/returns_2026_09.csv` 我再接着算。" }], timestamp: t(64000), stopReason: "stop" },
  ];
  const extensionUi = { revision: 1, autocomplete: false, status: [], notifications: [], working: { visible: false }, editor: { text: "", revision: 0 } };
  const kernel = { state: "idle", connectionStatus: "connected", memory: { current: 1.34 * GiB, workingSet: 1.34 * GiB, memoryMax: "4G", oomKill: 0 } };
  const snapshotOf = (worker, messages = [], extra = {}) => ({ sessionId: worker.sessionId, streamId: `${worker.sessionId}-stream`, sequence: 9, state: worker.state, capability: worker.capability, messages, queuedMessages: { steering: [], followUp: [] }, model: "clp/claude-opus-5-5", thinkingLevel: "medium", contextUsage: { tokens: 61_400, contextWindow: 200_000, percent: 31 }, recentOperations: [], messageEntryIds: messages.map((_, index) => `e${index}`), extensionUi, ...extra });
  const byName = Object.fromEntries(workers.map((worker) => [worker.name, worker]));
  // A spawn turn: w9 (a child on office, handed in) shows in the turn's spawned-children card.
  w1Messages.push(
    { role: "user", content: [{ type: "text", text: "把华东退货核对派到办公室那台跑" }], timestamp: t(90000) },
    assistantCall("", "c6", "session_spawn", { task: "核对华东 9 月退货", label: "核对华东退货", target: "office" }, 92000),
    toolOut("c6", "session_spawn", JSON.stringify({ name: "w9", sessionId: "s9", taskId: "t9" }), 92600, { details: { name: "w9", sessionId: "s9", taskId: "t9" } }),
    { role: "assistant", content: [{ type: "text", text: "已派出，结果回来后我再汇总。" }], timestamp: t(93000), stopReason: "stop" },
  );
  byName.w9.derivation.result = { id: "r9", summary: "9 月退货 1,284 单，华东占 61%；退货额 142.6 万，解释了下滑的 9.8 个百分点。", artifacts: ["report/returns.md"] };
  const dailyMessages = [
    { role: "user", content: [{ type: "text", text: "今天有哪些会话还在跑？" }], timestamp: t(0) },
    { role: "assistant", content: [{ type: "text", text: "两个在执行：**清洗 2026Q3 原始数据**（Alpha）和 **整理实验日志**（办公室，我派生的临时会话）。" }], timestamp: t(3000), stopReason: "stop" },
  ];
  const snapshots = Object.fromEntries(workers.map((worker) => [worker.name, snapshotOf(worker, worker.name === "w1" ? w1Messages : worker.name === "w8" ? dailyMessages : [], { kernel })]));

  const files = {
    "analysis.py": `${pyCode}\n\n\ndef ratio(frame, month):\n    """环比：本月 / 上月 - 1。"""\n    return frame[month] / frame[month - 1] - 1\n\n\nif __name__ == "__main__":\n    print(ratio(monthly, 9).round(3))\n`,
    "clean.py": "import pandas as pd\n\nraw = pd.read_csv('data/raw.csv')\nraw.columns = [c.strip().lower() for c in raw.columns]\nraw.drop_duplicates().to_csv('data/sales.csv', index=False)\n",
    "README.md": "# 销售数据分析\n\n- `analysis.py`：按地区、月份汇总\n- `clean.py`：清洗原始导出\n\n```bash\npython analysis.py\n```\n",
    "report/summary.md": "# Q3 销售小结\n\n（待补充）\n",
    "data/sales.csv": "date,region,amount\n2026-07-01,华东,41.2\n",
    "data/regions.json": "{\"华东\": [\"上海\", \"江苏\", \"浙江\"]}\n",
    "notebooks/explore.ipynb": "{}\n",
    "requirements.txt": "pandas==3.0.1\nmatplotlib==3.10.0\n",
  };
  const terminalReplay = [
    "\x1b[38;5;31m\x1b[0m\x1b[48;5;31;38;5;255m  ~/data/sales \x1b[0m\x1b[38;5;31;48;5;236m\x1b[0m\x1b[48;5;236;38;5;76m  main \x1b[0m\x1b[38;5;236m\x1b[0m\r\n",
    "\x1b[38;5;76m❯\x1b[0m python analysis.py\r\n",
    "region\r\n华东   -0.120\r\n华北    0.026\r\n华南    0.008\r\n西南    0.018\r\ndtype: float64\r\n",
    "\x1b[38;5;31m\x1b[0m\x1b[48;5;31;38;5;255m  ~/data/sales \x1b[0m\x1b[38;5;31;48;5;236m\x1b[0m\x1b[48;5;236;38;5;178m  main ✚1 \x1b[0m\x1b[38;5;236m\x1b[0m\r\n",
    "\x1b[38;5;76m❯\x1b[0m git status --short\r\n\x1b[31m M\x1b[0m analysis.py\r\n\x1b[32m??\x1b[0m report/summary.md\r\n",
    "\x1b[38;5;76m❯\x1b[0m ",
  ].join("");

  const commands = [
    ["compact", "把早先的对话压成摘要，腾出上下文。", [{ name: "instructions", description: "Optional compaction instructions" }]],
    ["settings", "Inspect or change safe session settings."], ["copy", "Read the last assistant text."], ["reload", "Reload approved SDK resources while idle."],
  ].map(([name, description, args]) => ({ name, description, source: "builtin", effect: "read", risk: "none", availability: { enabled: true }, ...(args ? { arguments: args } : {}) }));
  commands.push({ name: "skill:data-cleaning", description: "清洗表格数据：统一列名、处理缺失值、去重，并输出清洗报告。适合在导入 CSV 或 Excel 之后立刻使用。", source: "skill", availability: { enabled: true } });
  commands.push({ name: "review", description: "Review the current diff.", source: "template", availability: { enabled: true } });
  const catalog = { version: 1, target: { identity: "", capability: "worker", state: "idle", readOnly: false, local: false, current: { toolMode: "code" } }, commands, actions: [{ name: "tool-mode", effect: "session", risk: "low", enabled: true }], inputPrefixes: [{ prefix: "/", enabled: true, kind: "native-command" }], resources: [], attachments: { enabled: true, imageMimeTypes: ["image/png"] }, references: { targetFile: { enabled: true, candidates: [] } } };
  const references = [
    { name: "data", path: "data", navigable: true }, { name: "report", path: "report", navigable: true },
    { name: "analysis.py", path: "analysis.py" }, { name: "clean.py", path: "clean.py" }, { name: "README.md", path: "README.md" }, { name: "requirements.txt", path: "requirements.txt" },
  ];
  const text = (...lines) => ({ kind: "text", lines });
  // The todo plugin (prk-todolist) as w1 has it: its widget, the text lines the plugin renders (docs/widget-format.md
  // there; styled like the TUI theme does, the web reads the plain text). The shared samples have no single list with every
  // feature, so the showcase is composed here in the same format and must parse. `todoWidget(lines)` is the widget with
  // other lines, e.g. text the parser rejects.
  const TODO_SHOWCASE = ["Todo 6/15", "I. 调研  2/2", "II. 实现  3/11", "  ✓ 3 completed", "  ▸ 写解析器  · worker-a", "    ✓ 状态行", "    ○ 层级", "  ▸ 接入浮窗  · worker-b", "  ! 联调", "    等 Gateway 重启", "  ○ 补充空状态 · 加载中 · 失败", "  ○ 适配手机宽度  · 小 林", "  ○ 暗色模式走查", "  ○ 键盘操作", "  ○ 性能检查", "III. 收尾  1/2", "  ○ 写文档", "  ✕ 导出 PDF"];
  if (!parseTodoWidget(TODO_SHOWCASE)) throw new Error("the todo showcase lines do not parse");
  const TODO_STYLES = { "▸": "\x1b[36m\x1b[1m", "✓": "\x1b[2m", "✕": "\x1b[2m", "!": "\x1b[33m", "○": "\x1b[90m" };
  const styleTodoLine = (line) => { const style = TODO_STYLES[line.trimStart()[0]]; return style ? `${line.slice(0, line.length - line.trimStart().length)}${style}${line.trimStart()}\x1b[0m` : line; };
  const todoWidget = (lines) => ({ key: "prk-todolist.todo", placement: "aboveEditor", node: { id: "widget-prk-todolist.todo", ...text(...lines) } });
  const todoPlugin = { widgets: [todoWidget(TODO_SHOWCASE.map(styleTodoLine))] };
  /** `render`: extra extension-ui render fields for this screen (prompts, widgets), or a function returning them at call time. */
  const native = (name, render) => (body) => {
    if (!body.action) return { ...catalog, target: { ...catalog.target, identity: name, sessionId: byName[name]?.sessionId, target: byName[name]?.target, local: targets.find((item) => item.id === byName[name]?.target)?.local === true } };
    const extra = (typeof render === "function" ? render() : render) ?? {};
    const plugins = name === "w1" ? { widgets: todoPlugin.widgets.filter((widget) => !extra.widgets?.some((own) => own.key === widget.key)) } : { widgets: [] };
    const data = body.action === "session" ? { sessionId: byName[name]?.sessionId, userMessages: 2, assistantMessages: 7, toolCalls: 5, toolResults: 5, totalMessages: 14, tokens: { input: 48_210, output: 6_320, cacheRead: 22_000, cacheWrite: 0, total: 76_530 }, cost: 0.1342, contextUsage: { tokens: 61_400, contextWindow: 200_000, percent: 31 } }
      : body.action === "settings" ? { autoCompaction: true, autoRetry: true, scope: "current-session" }
        : body.action === "reference-candidates" ? { candidates: references }
          : body.action === "extension-ui" ? { revision: 2, status: [], notifications: [], entries: [], toolErrors: {}, tools: { c1: { shell: "default", call: text("todo_list Write 4 items"), result: text("added ○ 读取 sales.csv") }, c5: { shell: "default", call: text("todo_list Merge 2 items"), result: text("updated ✓ 按地区汇总销售额") } }, ...extra, widgets: [...(extra.widgets ?? []), ...plugins.widgets] }
            : {};
    return { requestId: body.requestId, action: body.action, status: "completed", message: "ok", data };
  };
  const routes = {
    ...Object.fromEntries(workers.map((worker) => [`/api/workers/${worker.name}/native`, native(worker.name)])),
    ...Object.fromEntries(workers.map((worker) => [`/api/workers/${worker.name}/monitor/focus`, () => ({ leaseMs: 30_000 })])),
    ...Object.fromEntries(workers.map((worker) => [`/api/workers/${worker.name}/monitor/history`, () => ({ instance: worker.target, windowMs: 900000, machine: worker.target === "alpha" ? monitorHistory : [], customMetrics: [] })])),
    "/api/workers/w8/archive-preview": () => ({ root: "w8", sessions: [
      { name: "w8", label: "日常", capability: "worker", target: "alpha", cwd: "/home/user", state: "idle" },
      { name: "w4", label: "整理实验日志", capability: "worker", lifecycle: "temporary", owner: "w8", target: "office", cwd: "/srv/ml/logs", state: "running" },
      { name: "w4b", label: "汇总周报", capability: "worker", lifecycle: "temporary", owner: "w8", target: "alpha", cwd: "/home/user/reports", state: "idle" },
    ], retained: [{ name: "w2", label: "清洗 2026Q3 原始数据", owner: "w1" }] }),
    "/api/targets/alpha": () => ({ target: { ...targets[0] } }),
  };
  // Plugin UI states (task item 9): dialog card, custom card, widgets + todo, toasts, overlay. Times are taken when the
  // page asks, so countdowns and toast lifetimes are fresh.
  const statusEntries = [{ key: "git", text: "\x1b[32m\x1b[0m main ✚1" }, { key: "pytest", text: "pytest \x1b[32m42 passed\x1b[0m \x1b[31m3 failed\x1b[0m" }];
  const PLUGIN = {
    dialog: () => ({ prompts: [{ id: "p-select", kind: "select", title: "清洗哪一张表？", message: "data-cleaning 会就地改写所选文件。", options: ["sales.csv（48,213 行）", "returns_2026_09.csv（3,104 行）", "regions.json"], expiresAt: Date.now() + 48_000, focused: true }] }),
    custom: () => ({ prompts: [{ id: "p-custom", kind: "custom", focused: true, node: { id: "custom-root", kind: "container", direction: "column", children: [
      { id: "custom-text", kind: "text", lines: ["\x1b[1m部署到 staging？\x1b[0m", "推送 3 个提交到 origin/staging，并重启 api、worker 两个服务。"] },
      { id: "custom-select", kind: "select", selectedIndex: 0, value: "deploy", options: [{ value: "deploy", label: "部署" }, { value: "dry", label: "只做 dry-run" }], submit: true, cancel: true },
    ] } }] }),
    overlay: () => ({ prompts: [{ id: "p-overlay", kind: "custom", overlay: { anchor: "center", width: 64 }, focused: true, node: { id: "overlay-root", kind: "container", direction: "column", children: [
      { id: "overlay-text", kind: "text", lines: ["\x1b[1m提交说明\x1b[0m", "\x1b[2m3 个文件 · +42 −7\x1b[0m"] },
      { id: "overlay-input", kind: "editor", value: "fix(sales): 华东 9 月退货拆分\n\n按 returns_2026_09.csv 重新计算环比。", submit: true, cancel: true },
    ] } }] }),
    tray: () => ({ widgets: [
      { key: "pytest", placement: "aboveEditor", node: { id: "widget-pytest", kind: "text", lines: ["\x1b[1mpytest\x1b[0m  tests/test_sales.py  \x1b[32m42 passed\x1b[0m  \x1b[31m3 failed\x1b[0m  · 0:37", "\x1b[2mFAILED test_ratio_east · test_returns_join · test_month_gap\x1b[0m"] } },
      { key: "branch", placement: "belowEditor", node: { id: "widget-branch", kind: "text", lines: ["\x1b[36m⎇\x1b[0m main → origin/main  ↑2  · 未推送"] } },
    ] }),
  };
  const notice = (id, type, message, ageMs) => ({ id, sessionId: "s1", position: w1Messages.length, message, type, createdAt: new Date(Date.now() - ageMs).toISOString() });
  return { workers, targets, archive, models, snapshots, files, terminalReplay, routes, native, PLUGIN, extensionUi, statusEntries, notice, todoWidget, monitorOf };
}
