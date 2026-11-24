import { useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { ThreadPrimitive, unstable_useThreadMessageIds, useAui, useAuiState } from "@assistant-ui/react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { MessageView } from "./MessageView.jsx";
import { HistoryPagination } from "./HistoryPagination.jsx";
import { estimateMessageHeight } from "./estimate-message-height.js";
import { visiblePresentationAnchor } from "./presentation/visible-presentation-anchor.js";
import { messageScrollOffset } from "./message-scroll-offset.js";

const PAGE_KEY = -1;
const SIZE = { width: 720, margin: 32, gap: 15.2 };

function TranscriptMessage() {
  const message = useAuiState((state) => state.message);
  return <MessageView message={message} />;
}
const COMPONENTS = { Message: TranscriptMessage };

export function TranscriptList({ ref, viewportRef, history, following, mayFollow }) {
  const ids = unstable_useThreadMessageIds();
  const aui = useAui();
  const [prepend, setPrepend] = useState(null);
  const firstId = ids[0];
  const prepended = prepend && firstId !== prepend.firstId;
  // The cursor can update one commit before assistant-ui publishes the new ids.
  const pageRows = history.before || (prepend && !prepended) ? 1 : 0;
  const count = ids.length + pageRows;
  const tail = count - 1;
  const tailId = ids.at(-1);
  const container = useRef(null);
  const pendingReveal = useRef(null);
  const aligningPrepend = useRef(null);
  const prependIndex = prepended ? ids.indexOf(prepend.anchor?.key) : -1;
  const heights = useRef(new Map());
  const [geometry, setGeometry] = useState(SIZE);
  const getItemKey = useCallback((index) => pageRows && index === 0 ? PAGE_KEY : ids[index - pageRows], [ids, pageRows]);
  const virtualizer = useVirtualizer({
    count, getItemKey, getScrollElement: () => viewportRef.current,
    estimateSize: (index) => {
      if (pageRows && index === 0) return 22;
      const measured = heights.current.get(getItemKey(index));
      if (measured?.width === geometry.width) return measured.height;
      return estimateMessageHeight(aui.thread().getState().messages[index - pageRows], geometry.width);
    },
    measureElement: (node, entry, instance) => {
      const rect = entry?.borderBoxSize?.[0];
      const height = rect?.blockSize ?? node.getBoundingClientRect().height;
      const width = Math.round(rect?.inlineSize ?? node.getBoundingClientRect().width);
      heights.current.set(getItemKey(instance.indexFromElement(node)), { width, height });
      return height;
    },
    scrollMargin: geometry.margin, gap: geometry.gap, overscan: 4,
    anchorTo: "end", scrollEndThreshold: 2,
    directDomUpdates: true, directDomUpdatesMode: "position",
    rangeExtractor: (range) => {
      // Mount the anchor's neighbours before moving the viewport, so measurements
      // from the new window can settle without a frame at the pager's old range.
      const startIndex = prependIndex < 0 ? range.startIndex : prependIndex + pageRows;
      const endIndex = Math.min(range.count - 1, startIndex + range.endIndex - range.startIndex);
      const indexes = defaultRangeExtractor({ ...range, startIndex, endIndex });
      if (following && tailId && indexes.at(-1) !== tail) indexes.push(tail);
      return indexes;
    },
    onChange: (instance) => {
      const viewport = viewportRef.current;
      if (aligningPrepend.current) alignPrepend(instance, viewport, aligningPrepend.current);
      else if (mayFollow()) pinToEnd(instance, tail, viewport);
    },
  });
  const items = virtualizer.getVirtualItems();
  const setContainer = useCallback((node) => {
    container.current = node;
    virtualizer.containerRef(node);
  }, [virtualizer]);

  useLayoutEffect(() => {
    const node = container.current;
    let observedWidth = -1;
    const resize = () => {
      const width = node.clientWidth;
      if (!width || width === observedWidth) return;
      observedWidth = width;
      const { paddingTop, rowGap } = getComputedStyle(node.parentElement);
      setGeometry({ width, margin: parseFloat(paddingTop), gap: parseFloat(rowGap) });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    virtualizer.measure();
    for (const row of container.current.children) virtualizer.measureElement(row);
  }, [geometry.width, virtualizer]);

  const revealMounted = useCallback((id, options) => {
    const offset = messageScrollOffset(viewportRef.current, id, options);
    if (offset === undefined) return false;
    if (offset === null) return true;
    virtualizer.scrollToOffset(offset, { behavior: "instant" });
    options?.onReveal?.();
    return true;
  }, [virtualizer, viewportRef]);
  useImperativeHandle(ref, () => ({
    pin: () => pinToEnd(virtualizer, tail, viewportRef.current),
    scrollTo: (offset) => virtualizer.scrollToOffset(offset, { behavior: "instant" }),
    revealMessage(id, options) {
      pendingReveal.current = null;
      const index = ids.indexOf(id);
      if (index < 0) return false;
      if (!revealMounted(id, options)) {
        pendingReveal.current = { id, options };
        virtualizer.scrollToIndex(index + pageRows, { align: options?.offset === undefined ? "center" : "start", behavior: "instant" });
      }
      return true;
    },
    cancelReveal() { pendingReveal.current = null; },
    beforePrepend() {
      const viewport = viewportRef.current;
      // At the pager (including its gap), TanStack sees the pager key rather
      // than the old first message. Retain the first visible message instead.
      const onPager = pageRows && virtualizer.getVirtualItemForOffset(viewport.scrollTop)?.key === PAGE_KEY;
      setPrepend({ firstId, anchor: onPager ? visiblePresentationAnchor(viewport) : null });
    },
  }));
  useLayoutEffect(() => {
    if (!prepended) return;
    const { anchor } = prepend;
    if (!anchor) { setPrepend(null); return; }
    const viewport = viewportRef.current;
    aligningPrepend.current = anchor;
    alignPrepend(virtualizer, viewport, anchor);
    // Keep the anchor through the ResizeObserver delivery for the newly mounted rows.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        alignPrepend(virtualizer, viewport, anchor);
        aligningPrepend.current = null;
        setPrepend(null);
      });
    });
    return () => { cancelAnimationFrame(frame); aligningPrepend.current = null; };
  }, [prepended, prepend, viewportRef, virtualizer]);
  useLayoutEffect(() => {
    const reveal = pendingReveal.current;
    if (reveal && (!ids.includes(reveal.id) || revealMounted(reveal.id, reveal.options))) pendingReveal.current = null;
    // A live row can replace the optimistic row without changing the item count.
    if (mayFollow()) pinToEnd(virtualizer, tail, viewportRef.current);
  }, [items, ids, revealMounted, mayFollow, virtualizer, tail, viewportRef]);

  return <div className="pi-transcript-list" ref={setContainer} hidden={count === 0}>
    {items.map(({ index, key }) => <div key={key === PAGE_KEY ? "history-pagination" : `message:${key}`} className="pi-transcript-item" data-index={index} ref={virtualizer.measureElement}>
      {key === PAGE_KEY ? <HistoryPagination page={history.page} loadMore={history.loadMore} /> : <ThreadPrimitive.Unstable_MessageById messageId={key} components={COMPONENTS} />}
    </div>)}
  </div>;
}

function pinToEnd(virtualizer, tail, viewport) {
  if (!viewport || viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 0.5) return;
  if (tail >= 0) virtualizer.scrollToIndex(tail, { align: "end", behavior: "instant" });
  else virtualizer.scrollToOffset(viewport.scrollHeight, { behavior: "instant" });
}

function alignPrepend(virtualizer, viewport, anchor) {
  const offset = messageScrollOffset(viewport, anchor.key, { offset: anchor.offset });
  if (offset != null && Math.abs(offset - viewport.scrollTop) > 0.5) virtualizer.scrollToOffset(offset, { behavior: "instant" });
}
