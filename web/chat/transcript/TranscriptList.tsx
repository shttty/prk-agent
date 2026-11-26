import { useContext, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ThreadPrimitive, unstable_useThreadMessageIds, useAui, useAuiState } from "@assistant-ui/react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { useChatState } from "../thread/use-chat-state.ts";
import { PresentationContext } from "./presentation-context.ts";
import { MessageView } from "./MessageView.tsx";
import { HistoryPagination } from "./HistoryPagination.tsx";
import { estimateMessageHeight } from "./estimate-message-height.ts";
import { visiblePresentationAnchor } from "./presentation/visible-presentation-anchor.ts";
import { messageScrollOffset } from "./message-scroll-offset.ts";
import { projectedMessage } from "../conversation/messages/projected-message.ts";
import type { Ref } from "react";
import type { RevealOptions, TranscriptListHandle, ViewportRef } from "./scroll-types.ts";
import type { useHistoryPagination } from "./use-history-pagination.ts";
import type { TranscriptDisplay } from "./presentation-types.ts";
import type { Virtualizer } from "@tanstack/react-virtual";
import type { PresentationAnchor } from "./presentation-types.ts";

type TranscriptListProps = { ref: Ref<TranscriptListHandle>; viewportRef: ViewportRef; history: ReturnType<typeof useHistoryPagination>; following: boolean; mayFollow: () => boolean };
type RowHeight = { width: number; height: number; display: TranscriptDisplay | undefined };
type ListVirtualizer = Virtualizer<HTMLDivElement, Element>;
type PrependState = { firstId: string | undefined; anchor: PresentationAnchor | null };

const PAGE_KEY = -1;
const SIZE = { width: 720, margin: 32, gap: 15.2 };

function TranscriptMessage() {
  const message = useAuiState((state) => state.message);
  return <MessageView message={projectedMessage(message)} />;
}
const COMPONENTS = { Message: TranscriptMessage };

export function TranscriptList({ ref, viewportRef, history, following, mayFollow }: TranscriptListProps) {
  const display = useContext(PresentationContext)?.transcriptDisplay;
  const cells = useChatState((state) => state.session.snapshot?.kernelCells);
  const imageCounts = useMemo(() => new Map(cells?.filter(({ imageCount }) => imageCount > 0).map(({ toolCallId, imageCount }) => [toolCallId, imageCount])), [cells]);
  const ids = unstable_useThreadMessageIds();
  const aui = useAui();
  const [prepend, setPrepend] = useState<PrependState | null>(null);
  const firstId = ids[0];
  const prepended = prepend && firstId !== prepend.firstId;
  // The cursor can update one commit before assistant-ui publishes the new ids.
  const pageRows = history.before || (prepend && !prepended) ? 1 : 0;
  const count = ids.length + pageRows;
  const tail = count - 1;
  const tailId = ids.at(-1);
  const container = useRef<HTMLDivElement | null>(null);
  const pendingReveal = useRef<{ id: string; options?: RevealOptions } | null>(null);
  const aligningPrepend = useRef<PresentationAnchor | null>(null);
  const prependIndex = prepended ? ids.indexOf(prepend.anchor?.key ?? "") : -1;
  const heights = useRef(new Map<string | number | undefined, RowHeight>());
  const [geometry, setGeometry] = useState(SIZE);
  const getItemKey = useCallback((index: number) => pageRows && index === 0 ? PAGE_KEY : ids[index - pageRows] ?? index, [ids, pageRows]);
  const virtualizer = useVirtualizer({
    count, getItemKey, getScrollElement: () => viewportRef.current,
    estimateSize: (index) => {
      if (pageRows && index === 0) return 22;
      const measured = heights.current.get(getItemKey(index));
      if (measured?.width === geometry.width && measured.display === display) return measured.height;
      const row = aui.thread().getState().messages[index - pageRows];
      return estimateMessageHeight(row && projectedMessage(row), geometry.width, display, imageCounts);
    },
    // TanStack records no size for a row measured at its estimate: that row's size is estimateSize's answer on every
    // rebuild, so a cached height must hold as long as the row's box does. Key it only by what reflows the row.
    measureElement: (node, entry, instance) => {
      const rect = entry?.borderBoxSize?.[0];
      const height = rect?.blockSize ?? node.getBoundingClientRect().height;
      const width = Math.round(rect?.inlineSize ?? node.getBoundingClientRect().width);
      heights.current.set(getItemKey(instance.indexFromElement(node)), { width, height, display });
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
  const setContainer = useCallback((node: HTMLDivElement | null) => {
    container.current = node;
    virtualizer.containerRef(node);
  }, [virtualizer]);

  useLayoutEffect(() => {
    const node = container.current;
    if (!node) return undefined;
    let observedWidth = -1;
    const resize = () => {
      const width = node.clientWidth;
      if (!width || width === observedWidth) return;
      observedWidth = width;
      // Virtual list: the virtualizer needs the container's scroll margin and row gap in px to place rows (allowed exception).
      const { paddingTop, rowGap } = getComputedStyle(node.parentElement ?? node);
      setGeometry({ width, margin: parseFloat(paddingTop), gap: parseFloat(rowGap) });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    virtualizer.measure();
    // virtualizer.measureElement skips rows while the list scrolls, and a row whose box kept its size reports no
    // resize afterwards: measure the mounted rows here unconditionally.
    for (const row of container.current?.children ?? []) {
      virtualizer.resizeItem(virtualizer.indexFromElement(row), virtualizer.options.measureElement(row, undefined, virtualizer));
    }
  }, [geometry.width, display, virtualizer]);

  const revealMounted = useCallback((id: string, options?: RevealOptions) => {
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
      if (id === undefined) return false;
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
      const onPager = viewport && pageRows && virtualizer.getVirtualItemForOffset(viewport.scrollTop)?.key === PAGE_KEY;
      setPrepend({ firstId, anchor: viewport && onPager ? visiblePresentationAnchor(viewport) : null });
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
      {key === PAGE_KEY ? <HistoryPagination page={history.page} loadMore={history.loadMore} /> : <ThreadPrimitive.Unstable_MessageById messageId={String(key)} components={COMPONENTS} />}
    </div>)}
  </div>;
}

function pinToEnd(virtualizer: ListVirtualizer, tail: number, viewport: HTMLElement | null) {
  if (!viewport || viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 0.5) return;
  if (tail >= 0) virtualizer.scrollToIndex(tail, { align: "end", behavior: "instant" });
  else virtualizer.scrollToOffset(viewport.scrollHeight, { behavior: "instant" });
}

function alignPrepend(virtualizer: ListVirtualizer, viewport: HTMLElement | null, anchor: PresentationAnchor) {
  if (!viewport) return;
  const offset = messageScrollOffset(viewport, anchor.key, { offset: anchor.offset });
  if (offset != null && Math.abs(offset - viewport.scrollTop) > 0.5) virtualizer.scrollToOffset(offset, { behavior: "instant" });
}
