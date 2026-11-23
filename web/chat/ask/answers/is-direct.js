
/** One single-select question has no review tab: its page submits. Several questions, or a multi-select one, review first. */
export const isDirect = (questions) => questions.length === 1 && questions[0].multi !== true;
