import { useState } from "react";
import { Tooltip } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { IconCopy } from "@tabler/icons-react";
import { copyLiteral } from "../../clipboard/copy-literal.js";
import { useFeedback } from "./use-feedback.js";
export function CodeHeader({ language, code }) {
  const [feedback, setFeedback] = useFeedback();
  const [copySucceeded, setCopySucceeded] = useState(null);
  const copy = async () => {
    const success = await copyLiteral(code);
    setCopySucceeded(success);
    setFeedback(success ? "已复制" : "复制失败，请手动复制");
  };
  return (
    <div className="code-toolbar">
      <span className="code-language">{language || "text"}</span>
      <Tooltip opened={Boolean(feedback)} label={<span className="code-copy-feedback" data-state={copySucceeded === false ? "failure" : "success"} role="status" aria-live="polite">{feedback}</span>} position="left" withinPortal={false} color={copySucceeded === false ? "red" : undefined}><ActionIcon className="code-copy" data-action="copy-code" variant="subtle" size="sm" onClick={() => void copy()} aria-label={`复制 ${language || "text"} 代码`} title={`复制 ${language || "text"} 代码`}><IconCopy size={15} /></ActionIcon></Tooltip>
    </div>
  );
}
