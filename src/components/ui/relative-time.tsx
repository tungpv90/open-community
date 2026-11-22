'use client';

import { useEffect, useState } from 'react';

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "just now", "5 minutes ago", "yesterday" within a week; a short date beyond that. */
function describe(time: number, now: number) {
  const seconds = Math.round((time - now) / 1000);
  const elapsed = Math.abs(seconds);
  if (elapsed < 45) return 'just now';
  if (elapsed < 7 * 86_400) {
    const [unit, size] = units.find(([, length]) => elapsed >= length) || units[2];
    return relative.format(Math.round(seconds / size) || -1, unit);
  }
  const date = new Date(time);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
  });
}

/**
 * Shows when something happened. The server and the first client render print the same UTC
 * date so hydration matches; after mounting it switches to the visitor's local, relative time.
 */
export function RelativeTime({ value }: { value?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const time = value ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(time)) return <>recently</>;

  if (now === null) {
    return (
      <time dateTime={value}>
        {new Date(time).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })}
      </time>
    );
  }

  return (
    <time
      dateTime={value}
      title={new Date(time).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
    >
      {describe(time, now)}
    </time>
  );
}
