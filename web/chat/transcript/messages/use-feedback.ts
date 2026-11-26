import { useState } from "react";
import { useEffect } from "react";
export function useFeedback(): [string, (text: string) => void] {
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(""), 2200);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  return [feedback, setFeedback];
}
