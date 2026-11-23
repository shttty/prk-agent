import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { issueLabel } from "./issue-label.js";
/** In the session dialogs: the chosen instance cannot run anything until its settings are completed. */
export function ConfigurationIssueNotice({ issue }) {
  if (!issue) return null;
  return <InlineAlert color="yellow" size="sm" data-configuration-issue={issue.code}>{issueLabel(issue)}：在侧栏该实例的「待补」标记或「实例」设置中补全后才能执行。</InlineAlert>;
}
