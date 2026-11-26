import type { DirEntry } from "../file-paths/path-types.ts";
import type { FileActionId, FileActionView } from "./file-action-types.ts";
import { IconFile } from "@tabler/icons-react";
import { IconFilePlus } from "@tabler/icons-react";
import { IconFolderPlus } from "@tabler/icons-react";
import { IconUpload } from "@tabler/icons-react";
import { IconClipboard } from "@tabler/icons-react";
import { IconPencil } from "@tabler/icons-react";
import { IconCopyPlus } from "@tabler/icons-react";
import { IconCopy } from "@tabler/icons-react";
import { IconCut } from "@tabler/icons-react";
import { IconLink } from "@tabler/icons-react";
import { IconDownload } from "@tabler/icons-react";
import { IconEye } from "@tabler/icons-react";
import { IconEyeOff } from "@tabler/icons-react";
import { IconRefresh } from "@tabler/icons-react";
import { IconTrash } from "@tabler/icons-react";
export const ACTIONS: Record<FileActionId, FileActionView> = {
  open: { label: "打开", icon: IconFile },
  newFile: { label: "新建文件", short: "新文件", icon: IconFilePlus },
  newFolder: { label: "新建文件夹", short: "新文件夹", icon: IconFolderPlus },
  upload: { label: "上传", icon: IconUpload },
  paste: { label: "粘贴", icon: IconClipboard },
  rename: { label: "重命名", icon: IconPencil },
  duplicate: { label: "创建副本", short: "副本", icon: IconCopyPlus },
  copy: { label: "复制", icon: IconCopy },
  cut: { label: "剪切", icon: IconCut },
  copyPath: { label: "复制路径", short: "路径", icon: IconLink },
  download: { label: "下载", icon: IconDownload },
  toggleHidden: { label: "显示隐藏文件", short: "显示隐藏", activeLabel: "隐藏点文件", activeShort: "隐藏点文件", icon: IconEye, activeIcon: IconEyeOff },
  refresh: { label: "刷新", icon: IconRefresh },
  delete: { label: "删除", icon: IconTrash, danger: true },
};

export function fileActionGroups(entry: DirEntry | null, canPaste: boolean): FileActionId[][] {
  const paste: FileActionId[] = canPaste ? ["paste"] : [];
  if (!entry) return [["newFile", "newFolder", "upload", ...paste], ["toggleHidden", "refresh"]];
  if (entry.type === "directory") return [["newFile", "newFolder", ...paste], ["rename", "duplicate", "copy", "cut", "copyPath"], ["delete"]];
  return [["open", "rename", "duplicate"], ["copy", "cut", "copyPath", "download"], ["delete"]];
}
