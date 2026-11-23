import { contentText } from "../conversation/content-text.js";
import { safeText } from "../../workbench/payloads/safe-text.js";
import { printable } from "../../workbench/payloads/printable.js";
export async function selectSearchMatch({ searchRequest, setSearchError, setSearchMatches, setSearchIndex, setSearchStatus, actions, viewportRef, lastScrollTopRef, setAwayFromBottom, setFollowOutput }, query, offset) {
    const request = ++searchRequest.current;
    const value = safeText(query).trim().toLocaleLowerCase();
    setSearchError("");
    if (!value) { setSearchMatches([]); setSearchIndex(0); setSearchStatus(""); return; }
    setSearchStatus("loading");
    try {
      const messages = await actions.loadTranscriptContent();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (request !== searchRequest.current) return;
      const ids = new Set(messages.filter((message) => safeText(message.metadata?.custom?.copyText).toLocaleLowerCase().includes(value) || message.content.some((part) => {
        const text = part.type === "tool-call" ? `${part.argsText || ""}\n${printable(part.result)}\n${JSON.stringify(part.result?.details || {})}\n${part.artifact?.output || ""}` : contentText(part);
        return text.toLocaleLowerCase().includes(value);
      })).map((message) => message.id));
      const viewport = viewportRef.current;
      const matches = viewport ? [...viewport.querySelectorAll(".pi-message")].filter((node) => ids.has(node.dataset.messageId) || (node.textContent || "").toLocaleLowerCase().includes(value)) : [];
      setSearchMatches(matches);
      const nextIndex = matches.length ? (offset + matches.length) % matches.length : 0;
      setSearchIndex(nextIndex);
      setSearchStatus("ready");
      setFollowOutput(false);
      const node = matches[nextIndex];
      if (node && viewport) {
        for (const details of node.querySelectorAll("details")) details.open = true;
        viewport.scrollTop += node.getBoundingClientRect().top - viewport.getBoundingClientRect().top - (viewport.clientHeight - node.clientHeight) / 2;
        if (lastScrollTopRef) lastScrollTopRef.current = viewport.scrollTop;
        setAwayFromBottom?.(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop >= 80);
      }
    } catch (error) {
      if (request !== searchRequest.current) return;
      setSearchStatus("error");
      setSearchError(error instanceof Error ? error.message : "查找失败。");
      setSearchMatches([]);
    }
  }
