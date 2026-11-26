import { Button } from "@mantine/core";

type BrowsePathButtonProps = { mode: "directory" | "file"; connected: boolean; onBrowse: (mode: "directory" | "file") => void };

export function BrowsePathButton({ mode, connected, onBrowse }: BrowsePathButtonProps) {
  const id = mode === "file" ? "browse-target-python" : "browse-target-directory";
  return <Button id={id} variant="default" onClick={() => onBrowse(mode)} disabled={!connected}>浏览</Button>;
}
