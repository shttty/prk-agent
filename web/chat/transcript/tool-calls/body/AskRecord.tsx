import { Stack } from "@mantine/core";
import type { askRecord } from "../../../tool-text/ask-record.ts";

/** An `ask` call's questions and, once answered, what the user chose (from the result's structured record, not the raw JSON). */
export function AskRecord({ record }: { record: ReturnType<typeof askRecord> }) {
  return (
    <Stack gap={8} className="pi-ask-record" data-outcome={record.outcome}>
      {record.rows.map((row) => (
        <Stack key={row.id} gap={1} miw={0} data-ask-record={row.id} data-answered={row.answer?.answered ? "true" : "false"}>
          <div className="pi-ask-record-question">{row.label ? <strong>{row.label}</strong> : null}{row.question}</div>
          {row.answer ? (
            <div className="pi-ask-record-answer">
              {row.answer.answered
                ? <span>{[row.answer.selected.join("、"), row.answer.custom ? `“${row.answer.custom}”` : ""].filter(Boolean).join(" + ")}</span>
                : <span className="is-missing">未回答</span>}
              {row.answer.auto ? <span className="pi-ask-record-meta" data-auto="true">超时自动选择</span> : null}
              {row.answer.note ? <div className="pi-ask-record-note">备注：{row.answer.note}</div> : null}
            </div>
          ) : null}
        </Stack>
      ))}
      {record.outcome === "chat" ? <div className="pi-io-note" data-kind="ask-chat">未作答，先聊聊</div> : null}
      {record.outcome === "cancelled" ? <div className="pi-io-note" data-kind="ask-cancelled">已取消</div> : null}
    </Stack>
  );
}
