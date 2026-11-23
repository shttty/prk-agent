import { useState } from "react";
import { EMPTY_DIRECTORY } from "../../../instances/directory-picker/empty-directory.js";
import { useRef } from "react";
import { useEffect } from "react";
import { text } from "../../sidebar/text.js";
import { browseDirectory } from "../../../instances/directory-picker/browse-directory.js";
import { isAbsolutePath } from "../../../instances/directory-picker/is-absolute-path.js";
import { useWorkbench } from "../../../workbench/subscription/use-workbench.js";
/** The chosen instance's stored config, the session's working directory and the directory picker for Create/Retarget. */
export function useSessionEnvironment(actions, targetName, { create = false, sessionRow, setLabel }) {
  const [targetConfig, setTargetConfig] = useState(null);
  const [cwd, setCwd] = useState("");
  const [loading, setLoading] = useState(create && Boolean(targetName));
  const [error, setError] = useState("");
  const [directory, setDirectory] = useState(EMPTY_DIRECTORY);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const configurationIssue = useWorkbench((state) => state.targets.find((item) => item.id === targetName)?.configurationIssue);
  const requestRef = useRef(0);
  const browseSerial = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
    requestRef.current += 1;
    browseSerial.current += 1;
  }, []);
  useEffect(() => {
    const request = ++requestRef.current;
    browseSerial.current += 1;
    if (!targetName) {
      if (create) setLoading(false);
      setError(create ? "实例不存在或已被删除。" : "没有可用的实例，请先在“实例”中添加。");
      return undefined;
    }
    setLoading(true);
    setError("");
    setTargetConfig(null);
    if (create) {
      setLabel("");
      setCwd("");
      setDirectory(EMPTY_DIRECTORY);
      setDirectoryOpen(false);
    }
    actions.getTarget(targetName).then((config) => {
      if (request !== requestRef.current) return;
      // Moving a session starts from its own cwd while it stays on its instance; otherwise from the instance's.
      const sameTarget = !create && targetName === sessionRow?.target;
      setTargetConfig(config);
      setCwd((sameTarget && text(sessionRow?.cwd).trim()) || text(config?.cwd).trim());
      setDirectory(EMPTY_DIRECTORY);
    }).catch((cause) => {
      if (request === requestRef.current) setError(cause instanceof Error ? cause.message : "读取实例配置失败。");
    }).finally(() => {
      if (request === requestRef.current) setLoading(false);
    });
    return () => { requestRef.current += 1; };
  }, [actions, targetName, create, setLabel, sessionRow?.target, sessionRow?.cwd]);
  const local = targetConfig?.local === true;
  const sshCommand = text(targetConfig?.sshCommand);
  async function browse(path) {
    if (!local && !sshCommand.trim()) {
      setDirectory((current) => ({ ...current, error: "该实例还没有连接命令，请先在实例设置中补全。" }));
      return;
    }
    await browseDirectory(actions, { local, ...(local ? {} : { sshCommand }) }, path, setDirectory, mountedRef, browseSerial);
  }
  // The picker starts in the current cwd.
  async function openDirectory() {
    setDirectoryOpen(true);
    if (!isAbsolutePath(cwd)) {
      setDirectory({ ...EMPTY_DIRECTORY, error: "实例未设置绝对路径的工作目录。" });
      return;
    }
    await browse(cwd);
  }
  return { targetConfig, configurationIssue, cwd, setCwd, loading, error, setError, directory, directoryOpen, setDirectoryOpen, browse, openDirectory, mountedRef };
}
