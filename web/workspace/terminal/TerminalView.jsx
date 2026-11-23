import { Button } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { useTerminalSession } from "./use-terminal-session.js";
import { TerminalMenu } from "./context-menu/TerminalMenu.jsx";
import { TerminalSearch } from "./search/TerminalSearch.jsx";
import "@xterm/xterm/css/xterm.css";
import "./terminal.css";
/** One shell: xterm over its WebSocket, filling the dock panel it lives in. `active`: the tab is the shown one. `generation`
 * and `onGeneration`: see useTerminalSession. A shell whose connection ended for good (`failed`) offers an explicit reopen.
 * `onQuote(text)`: the menu's 引用到输入框 target (absent: no such item). */
export function TerminalView({ api, sessionId, name, active, generation, onGeneration, onClosed, onQuote }) {
  const { host, term, status, error, clipboard, act, reopen, search } = useTerminalSession({ api, sessionId, name, active, generation, onGeneration, onClosed, onQuote });
  return <div className="pi-term-view" data-status={status}>
    {status !== "connected" || error ? <InlineAlert color={error ? "red" : "gray"} role="status" m="xs" flex="none" data-terminal-status={error ? "error" : status}>{error || { connecting: "正在连接终端…", disconnected: "终端连接已断开。", closed: "终端已结束。", failed: "终端已无法接回。" }[status] || ""}
      {status === "failed" ? <Button data-action="reopen-terminal" size="compact-xs" variant="default" ml="xs" onClick={reopen}>重新打开</Button> : null}</InlineAlert> : null}
    {clipboard.error ? <InlineAlert m="xs" flex="none" data-kind="clipboard-error" withCloseButton closeButtonLabel="关闭错误提示" onClose={clipboard.clearError}>{clipboard.error}</InlineAlert> : null}
    <div className="pi-term-host" ref={host} aria-label={`终端 ${name}`} />
    {search ? <TerminalSearch search={search.addon} term={term} host={host} onClose={search.close} /> : null}
    <TerminalMenu shell={name} menu={clipboard.menu} onClose={clipboard.closeMenu} onAction={act} quotable={Boolean(onQuote)} />
  </div>;
}
