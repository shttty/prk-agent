import { MessageImagesSetting } from "./MessageImagesSetting.tsx";
import { NoAnimationSetting } from "./NoAnimationSetting.tsx";
import { TerminalCursorBlinkSetting } from "./TerminalCursorBlinkSetting.tsx";
import { TurnFoldSetting } from "./TurnFoldSetting.tsx";
import { TranscriptEffectsSettings } from "./TranscriptEffectsSettings.tsx";

export function VisualEffectsSettings({ setShowImages }: { setShowImages: (enabled: boolean) => void }) {
  return <div className="pi-settings-body">
    <section className="settings-section" data-section="conversation-display">
      <h3 className="pi-settings-heading">对话</h3>
      <div className="pi-settings-group">
        <TurnFoldSetting />
        <TranscriptEffectsSettings />
        <MessageImagesSetting setShowImages={setShowImages} />
      </div>
    </section>
    <section className="settings-section" data-section="interface-motion">
      <h3 className="pi-settings-heading">动效</h3>
      <div className="pi-settings-group"><NoAnimationSetting /><TerminalCursorBlinkSetting /></div>
    </section>
  </div>;
}
