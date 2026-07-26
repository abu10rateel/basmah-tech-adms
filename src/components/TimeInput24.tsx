import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface TimeInput24Props {
  value: string; // e.g. "08:00" or "17:30"
  onChange: (val: string) => void;
  className?: string;
  focusColor?: 'emerald' | 'rose';
  required?: boolean;
}

export const TimeInput24: React.FC<TimeInput24Props> = ({
  value,
  onChange,
  className = '',
  focusColor = 'emerald',
  required = false,
}) => {
  const [hours, setHours] = useState('08');
  const [minutes, setMinutes] = useState('00');

  useEffect(() => {
    if (value && value.includes(':')) {
      const parts = value.split(':');
      let h = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      if (isNaN(h)) h = 0;
      if (isNaN(m)) m = 0;
      if (h < 0) h = 0;
      if (h > 23) h = 23;
      if (m < 0) m = 0;
      if (m > 59) m = 59;
      setHours(String(h).padStart(2, '0'));
      setMinutes(String(m).padStart(2, '0'));
    }
  }, [value]);

  const handleHourChange = (newH: string) => {
    setHours(newH);
    onChange(`${newH}:${minutes}`);
  };

  const handleMinuteChange = (newM: string) => {
    setMinutes(newM);
    onChange(`${hours}:${newM}`);
  };

  const activeBorderClass = focusColor === 'rose'
    ? 'focus-within:border-rose-500'
    : 'focus-within:border-emerald-500';

  return (
    <div className={`flex items-center justify-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-100 text-xs font-mono transition-colors ${activeBorderClass} ${className}`}>
      <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      <div className="flex items-center gap-0.5 dir-ltr">
        <select
          value={hours}
          onChange={(e) => handleHourChange(e.target.value)}
          className="bg-transparent text-center font-mono font-bold text-slate-100 focus:outline-none cursor-pointer py-0.5 hover:text-emerald-400"
          required={required}
        >
          {Array.from({ length: 24 }).map((_, i) => {
            const hStr = String(i).padStart(2, '0');
            return (
              <option key={hStr} value={hStr} className="bg-slate-900 text-slate-100 font-mono">
                {hStr}
              </option>
            );
          })}
        </select>
        <span className="text-slate-500 font-bold">:</span>
        <select
          value={minutes}
          onChange={(e) => handleMinuteChange(e.target.value)}
          className="bg-transparent text-center font-mono font-bold text-slate-100 focus:outline-none cursor-pointer py-0.5 hover:text-emerald-400"
          required={required}
        >
          {Array.from({ length: 60 }).map((_, i) => {
            const mStr = String(i).padStart(2, '0');
            return (
              <option key={mStr} value={mStr} className="bg-slate-900 text-slate-100 font-mono">
                {mStr}
              </option>
            );
          })}
        </select>
      </div>
      <span className="text-[9px] text-slate-500 font-sans font-bold bg-slate-950 px-1 py-0.5 rounded border border-slate-800 mr-auto">24h</span>
    </div>
  );
};
