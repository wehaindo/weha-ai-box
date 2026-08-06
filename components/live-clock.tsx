'use client';

import { useState, useEffect } from 'react';

export function LiveClock() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const dateStr = time.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <>
      <div className="text-7xl sm:text-8xl font-bold text-slate-900 tabular-nums tracking-tight">
        {timeStr}
      </div>
      <div className="text-xl sm:text-2xl text-slate-500 font-medium">
        {dateStr}
      </div>
    </>
  );
}
