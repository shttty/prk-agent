import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import { useCallback } from "react";
import { createPortal } from "react-dom";
import { DetailSheet } from "./DetailSheet.tsx";
import "./list-page.css";

type SplitPageProps = Omit<ComponentProps<"div">, "children"> & {
  mobile: boolean; list: ReactNode; detail: (back: (() => void) | null) => ReactNode; sheetOpen: boolean; onCloseSheet: () => void; sheetId: string; backAction: string;
};

/**
 * Settings list | detail page (memory, plugins; tools and Skills build the same shell with more layers). Desktop shows
 * both; on phones the list fills the page and `detail(back)` slides over it in a sheet portalled into the modal frame.
 */
export function SplitPage({ mobile, list, detail, sheetOpen, onCloseSheet, sheetId, backAction, className = "", ...props }: SplitPageProps) {
  const [frame, setFrame] = useState<Element | null>(null);
  const rootRef = useCallback((node: HTMLDivElement | null) => setFrame(node?.closest(".mantine-Modal-content") ?? null), []);
  return <div ref={rootRef} className={`settings-list-page ${className}`} data-layout={mobile ? "stack" : "split"} {...props}>
    {list}
    {!mobile ? <div className="settings-detail-host">{detail(null)}</div> : null}
    {mobile && frame ? createPortal(<DetailSheet open={sheetOpen} onClose={onCloseSheet} closeAction={backAction} id={sheetId}>{detail(onCloseSheet)}</DetailSheet>, frame) : null}
  </div>;
}
