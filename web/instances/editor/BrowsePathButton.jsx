import { Button } from "@mantine/core";

export function BrowsePathButton({ mode, connected, onBrowse }) {
  const id = mode === "file" ? "browse-target-python" : "browse-target-directory";
  return <Button id={id} variant="default" onClick={() => onBrowse(mode)} disabled={!connected}>浏览</Button>;
}
