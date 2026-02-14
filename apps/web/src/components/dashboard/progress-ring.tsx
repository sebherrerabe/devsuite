import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface ProgressRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
}

export function ProgressRing({
  value,
  max,
  size = 48,
  strokeWidth = 4,
  className,
  trackClassName,
  fillClassName,
}: ProgressRingProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference - percentage * circumference;

  return (
    <svg
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className={cn('stroke-muted', trackClassName)}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={mounted ? offset : circumference}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className={cn(
          'stroke-primary transition-[stroke-dashoffset] duration-700 ease-out',
          fillClassName
        )}
      />
    </svg>
  );
}
