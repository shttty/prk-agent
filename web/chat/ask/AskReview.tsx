import { Stack, Text, UnstyledButton } from "@mantine/core";
import { AnswerSummary } from "./AnswerSummary.tsx";
import { isAnswered } from "./answers/is-answered.ts";
import { tabLabel } from "./answers/tab-label.ts";
import type { AskQuestion, EffectiveAnswer } from "./ask-types.ts";

type AskReviewProps = { questions: readonly AskQuestion[]; answers: readonly EffectiveAnswer[]; unanswered: number; onOpen: (position: number) => void };

/** The review tab: every question with what it will answer, each a button back to its page. */
export function AskReview({ questions, answers, unanswered, onOpen }: AskReviewProps) {
  return <Stack gap={4} className="pi-ask-panel pi-ask-review" role="tabpanel" data-ask-unanswered={unanswered}>
    {questions.map((item, position) => {
      const answer = answers[position];
      return <UnstyledButton key={item.id} className="pi-ask-review-row" w="100%" px={10} py={7} data-ask-review={position} data-answered={answer && isAnswered(answer) ? "true" : "false"} onClick={() => onOpen(position)}>
        <Stack gap={1}>
          <span className="pi-ask-review-question">{tabLabel(item, position)}</span>
          {answer && isAnswered(answer) ? <AnswerSummary question={item} answer={answer} /> : <span className="pi-ask-review-answer is-missing">未回答</span>}
        </Stack>
      </UnstyledButton>;
    })}
    {unanswered ? <Text className="pi-ask-review-warning" size="xs" c="dimmed">{unanswered} 题未回答</Text> : null}
  </Stack>;
}
