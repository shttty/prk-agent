/** The sidebar group of unreadable sessions whose active/archived location is unknown (e.g. their archive metadata is itself invalid); never an instance, project or archive. */
export const unknownLocationGroup = (items) => ({ id: "unreadable-unknown", name: "无法读取", target: null, sessions: items });
