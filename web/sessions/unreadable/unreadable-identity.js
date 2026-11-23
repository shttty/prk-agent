/** What a session whose data cannot be read is called: its title when the Gateway still knows one, else its native id; "" when it has none (file-only diagnostic). */
export const unreadableIdentity = (issue) => issue.label || issue.sessionId;
