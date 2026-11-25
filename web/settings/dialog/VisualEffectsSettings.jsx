import { MessageImagesSetting } from "./MessageImagesSetting.jsx";
import { NoAnimationSetting } from "./NoAnimationSetting.jsx";
import { TerminalCursorBlinkSetting } from "./TerminalCursorBlinkSetting.jsx";
import { TurnFoldSetting } from "./TurnFoldSetting.jsx";
import { TranscriptEffectsSettings } from "./TranscriptEffectsSettings.jsx";

export function VisualEffectsSettings({ setShowImages }) {
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
