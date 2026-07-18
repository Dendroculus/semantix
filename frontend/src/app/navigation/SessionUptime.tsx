import { useEffect, useState } from "react";

export function SessionUptime(): JSX.Element {
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [startedAt]);

  const totalSeconds = Math.floor(elapsed / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="shrink-0 text-right">
      <p className="ui-label text-(--text-faint)">Session uptime</p>
      <time className="font-data mt-1 block text-[10px] text-(--text-soft)">
        {hours.toString().padStart(2, "0")}:
        {minutes.toString().padStart(2, "0")}:
        {seconds.toString().padStart(2, "0")}
      </time>
    </div>
  );
}
