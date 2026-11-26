import type { Icon } from "@tabler/icons-react";
import { IconSparkles } from "@tabler/icons-react";
import { IconSettings } from "@tabler/icons-react";
import { IconServer2 } from "@tabler/icons-react";
import { IconGitBranch } from "@tabler/icons-react";
import { IconTool } from "@tabler/icons-react";
import { IconPackage } from "@tabler/icons-react";
import { IconPuzzle } from "@tabler/icons-react";
import { IconBook2 } from "@tabler/icons-react";
import { IconNotes } from "@tabler/icons-react";
import { IconArchive } from "@tabler/icons-react";
import { IconUserHeart } from "@tabler/icons-react";
type Section = { id: string; label: string; Icon: Icon; hook: string };

export const sections: Section[] = [
  { id: "general", label: "通用", Icon: IconSettings, hook: "open-general" },
  { id: "visual-effects", label: "视觉效果", Icon: IconSparkles, hook: "open-visual-effects" },
  { id: "targets", label: "实例", Icon: IconServer2, hook: "open-targets" },
  { id: "subsessions", label: "子会话", Icon: IconGitBranch, hook: "open-subsessions" },
  { id: "tools", label: "工具", Icon: IconTool, hook: "open-tool-library" },
  { id: "artifacts", label: "远程工具", Icon: IconPackage, hook: "open-artifacts" },
  { id: "plugins", label: "插件", Icon: IconPuzzle, hook: "open-plugins" },
  { id: "skills", label: "Skills", Icon: IconBook2, hook: "open-skill-library" },
  { id: "memory", label: "记忆", Icon: IconNotes, hook: "open-memory" },
  { id: "soul", label: "人格", Icon: IconUserHeart, hook: "open-soul" },
  { id: "archive", label: "归档", Icon: IconArchive, hook: "open-archive" },
];
