import { useRef } from "react";
import { useState } from "react";
import { useEffect } from "react";
import { useEffectEvent } from "react";
import { useCallback } from "react";
import { css } from "./terminal-theme.js";
import { themeFrom } from "./terminal-theme.js";
import { fitTerminal } from "./fit-terminal.js";
import { measurable } from "./measurable.js";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { TERMINAL_SOCKET_FINAL } from "./terminal-constants.js";
import { useTerminalAppearance } from "./use-terminal-appearance.js";
import { useTerminalClipboard } from "./context-menu/use-terminal-clipboard.js";
import { terminalShortcut } from "./context-menu/terminal-shortcut.js";
import { terminalSocketUrl } from "./terminal-socket-url.js";
import { loadTerminalAddons } from "./addons/load-terminal-addons.js";
import { useNoAnimation } from "../../design-system/motion/use-no-animation.js";
import { useTerminalCursorBlink } from "./use-terminal-cursor-blink.js";
import { useTerminalFontSize } from "./font-size/use-terminal-font-size.js";
import { zoomFontSize } from "./font-size/zoom-font-size.js";
/** `generation`: the server's generation of this shell when its tab was made from the terminal list (read once, at mount);
 * absent for a tab the user just opened, whose first connection carries none and takes the generation from the snapshot
 * (`onGeneration` reports it). Every reconnect of this socket subscribes with that generation and never creates.
 * `onQuote(text)` receives the selection for the menu's 引用到输入框. */
export function useTerminalSession({ api, sessionId, name, active, generation: knownGeneration, onGeneration, onClosed, onQuote }) {
  const host = useRef(null);
  const term = useRef(null);
  const fit = useRef(null);
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState("");
  const closedRef = useRef(onClosed);
  closedRef.current = onClosed;
  const generationRef = useRef(onGeneration);
  generationRef.current = onGeneration;
  const initialGeneration = useRef(knownGeneration);
  const reopenRef = useRef(null);
  const clipboard = useTerminalClipboard(term, host);
  const [fontSize, setFontSize] = useTerminalFontSize();
  const [blinkPreference] = useTerminalCursorBlink();
  const cursorBlink = !useNoAnimation() && blinkPreference;
  const search = useRef(null);
  const [searching, setSearching] = useState(false);
  // Menu items and terminal keys: find opens the find bar, zoom changes the saved font size (every shell follows it, see
  // use-terminal-appearance), quote hands the selection to the composer, the rest are clipboard actions.
  const act = (action) => {
    const selection = term.current?.getSelection();
    if (action === "find") setSearching(true);
    else if (action.startsWith("zoom")) setFontSize((size) => zoomFontSize(size, action));
    else if (action === "quote") { if (selection) onQuote?.(selection); }
    else clipboard.act(action);
  };
  // For xterm's attachCustomKeyEventHandler: false keeps the key from the PTY. Ctrl+Shift+V keeps its browser default,
  // so the native paste event lands in xterm's textarea and xterm pastes it (plain http included).
  const onKey = useEffectEvent((event) => {
    const action = terminalShortcut(event);
    if (!action) return true;
    if (event.type === "keydown" && action !== "paste") {
      event.preventDefault();
      act(action);
    }
    return false;
  });
  const initialAppearance = useEffectEvent(() => ({ fontSize, cursorBlink }));
  useEffect(() => {
    const element = host.current;
    const stack = css(element, "--pi-font-mono");
    // kittyKeyboard: a program that asks for the Kitty keyboard protocol (CSI > flags u) gets it, e.g. Shift+Enter as
    // CSI 13;2u; PRK's own keys (Ctrl+Shift+C/V/A/F, zoom) are taken before xterm encodes anything (onKey).
    const terminal = new Terminal({ fontFamily: stack, ...initialAppearance(), allowProposedApi: true, vtExtensions: { kittyKeyboard: true }, scrollback: 5000, scrollOnEraseInDisplay: true, theme: themeFrom(element) });
    terminal.parser.registerCsiHandler({ final: "J" }, (params) => params[0] === 3);
    const fitter = new FitAddon();
    terminal.loadAddon(fitter);
    terminal.attachCustomKeyEventHandler((event) => onKey(event));
    terminal.open(element);
    search.current = loadTerminalAddons(terminal);
    term.current = terminal;
    fit.current = fitter;
    let disposed = false;
    // One WebSocket per terminal carries input, resize, output and the replay snapshot. It is (re)opened here, inside the
    // same effect as xterm, so a dropped connection never rebuilds the terminal.
    let generation = initialGeneration.current || null; // null: an explicit new open, which may create the shell
    let finished = false; // closed / final error: nothing reconnects until the user reopens the shell
    let socket = null;
    let attached = false; // the Gateway snapshot arrived on this socket: input may flow
    let retries = 0;
    let retryTimer = 0;
    let offlineTimer = 0;
    let pongTimer = 0;
    let errorTimer = 0;
    const send = (frame) => { if (attached && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(frame)); };

    // Keystrokes leave the moment xterm produces them; the socket keeps their order. While detached they are dropped, never queued.
    const input = terminal.onData((data) => send({ type: "input", data }));
    // Legacy mouse reports (?1000h without SGR ?1006h) arrive as bytes. The input channel is UTF-8 text, so a byte above
    // 127 (column or row past 95) would reach the program as two bytes: such an event is dropped whole, never sent wrong.
    const binary = terminal.onBinary((data) => { if (!/[\x80-\xff]/u.test(data)) send({ type: "input", data }); });

    let sized = "";
    let resizeTimer = 0;
    const sendSize = () => {
      resizeTimer = 0;
      const key = `${terminal.rows}x${terminal.cols}`;
      if (!attached || key === sized || !terminal.rows || !terminal.cols || !measurable(element)) return;
      sized = key;
      send({ type: "resize", rows: terminal.rows, cols: terminal.cols });
    };
    const resize = terminal.onResize(() => { if (!resizeTimer) resizeTimer = window.setTimeout(sendSize, 120); });

    const connect = () => {
      retryTimer = 0;
      const current = new WebSocket(terminalSocketUrl(api, sessionId, name, generation));
      socket = current;
      current.onmessage = (event) => {
        const frame = JSON.parse(event.data);
        if (frame.type === "stdout") terminal.write(frame.data);
        else if (frame.type === "snapshot") {
          if (typeof frame.generation === "string" && frame.generation) { generation = frame.generation; generationRef.current?.(generation, frame.cleanup); }
          // In band, after anything still queued from the old socket: CAN ends a control string the old stream broke
          // off (an image cut mid-Base64 would otherwise swallow the replay), RIS resets screen, modes and images.
          // Terminal.reset() would do neither: it runs at once and leaves xterm's parser state.
          terminal.write(`\x18\x1bc${frame.replay || ""}`);
          attached = true;
          retries = 0;
          window.clearTimeout(offlineTimer);
          offlineTimer = 0;
          setStatus(frame.connectionStatus || "connected");
          setError("");
          fitTerminal(element, fitter);
          sized = "";
          sendSize();
        } else if (frame.type === "closed") { finished = true; setStatus("closed"); closedRef.current?.(name); }
        else if (frame.type === "error") {
          setError(frame.message);
          window.clearTimeout(errorTimer);
          errorTimer = window.setTimeout(() => setError(""), 5000);
        } else if (frame.type === "pong") window.clearTimeout(pongTimer);
      };
      current.onclose = (event) => {
        if (disposed || current !== socket) return;
        attached = false;
        window.clearTimeout(pongTimer);
        if (finished || event.code === TERMINAL_SOCKET_FINAL) {
          finished = true;
          window.clearTimeout(errorTimer);
          setStatus((value) => (value === "closed" ? value : "failed"));
          return;
        }
        if (!offlineTimer) offlineTimer = window.setTimeout(() => setStatus("disconnected"), 800);
        retryTimer = window.setTimeout(connect, Math.min(5000, 250 * 2 ** retries++));
      };
    };
    const restart = () => {
      if (finished) return;
      window.clearTimeout(retryTimer);
      const stale = socket;
      socket = null;
      attached = false;
      stale?.close();
      connect();
    };
    // The user's explicit reopen of a shell that ended: forget the old generation and open anew (which may create it).
    reopenRef.current = () => {
      if (!finished) return;
      finished = false;
      generation = null;
      retries = 0;
      setError("");
      setStatus("connecting");
      restart();
    };
    // Back from the background (phone) or network: reconnect now if waiting for a retry; if the socket looks open, check
    // it is alive, since a connection killed while the page slept can stay "open" for minutes.
    const wake = () => {
      if (disposed || document.visibilityState !== "visible") return;
      if (retryTimer) restart();
      else if (attached && socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
        window.clearTimeout(pongTimer);
        pongTimer = window.setTimeout(restart, 3000);
      }
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", wake);
    connect();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("pageshow", wake);
      for (const timer of [resizeTimer, retryTimer, offlineTimer, pongTimer, errorTimer]) window.clearTimeout(timer);
      input.dispose();
      binary.dispose();
      resize.dispose();
      socket?.close();
      terminal.dispose();
    };
  }, [api, sessionId, name]);
  useTerminalAppearance({ host, term, fit, active, fontSize, cursorBlink });
  const reopen = useCallback(() => reopenRef.current?.(), []);
  return { host, term, status, error, clipboard, act, reopen, search: searching ? { addon: search, close: () => setSearching(false) } : null };
}
