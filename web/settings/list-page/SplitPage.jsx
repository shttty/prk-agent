import { useState } from "react";
import { useCallback } from "react";
import { createPortal } from "react-dom";
import { DetailSheet } from "./DetailSheet.jsx";
import "./list-page.css";

/**
 * Settings list | detail page (memory, plugins; tools and Skills build the same shell with more layers). Desktop shows
 * both; on phones the list fills the page and `detail(back)` slides over it in a sheet portalled into the modal frame.
 */
export function SplitPage({ mobile, list, detail, sheetOpen, onCloseSheet, sheetId, backAction, className = "", ...props }) {
  const [frame, setFrame] = useState(null);
  const rootRef = useCallback((node) => setFrame(node?.closest(".mantine-Modal-content") ?? null), []);
  return <div ref={rootRef} className={`settings-list-page ${className}`} data-layout={mobile ? "stack" : "split"} {...props}>
    {list}
    {!mobile ? <div className="settings-detail-host">{detail(null)}</div> : null}
    {mobile && frame ? createPortal(<DetailSheet open={sheetOpen} onClose={onCloseSheet} closeAction={backAction} id={sheetId}>{detail(onCloseSheet)}</DetailSheet>, frame) : null}
  </div>;
}
