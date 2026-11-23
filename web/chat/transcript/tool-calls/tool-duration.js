
export function toolDuration(milliseconds) {
  if (milliseconds === null) return "时长不可用";
  const seconds = milliseconds / 1000;
  return `${seconds < 10 ? seconds.toFixed(2) : seconds.toFixed(1)}s`;
}
