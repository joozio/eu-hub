import { cn } from '@/lib/utils';

const variants: Record<string, string> = {
  legislation: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  news: 'bg-violet-50 text-violet-700 border-violet-200',
  proposal: 'bg-amber-50 text-amber-700 border-amber-200',
  statistic: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  live: 'bg-red-50 text-red-600 border-red-200',
  ai: 'bg-blue-50 text-blue-600 border-blue-200',
  default: 'bg-gray-50 text-gray-600 border-gray-200',
};

const dotColors: Record<string, string> = {
  legislation: 'bg-indigo-500',
  news: 'bg-violet-500',
  proposal: 'bg-amber-500',
  statistic: 'bg-emerald-500',
  live: 'bg-red-500',
  ai: 'bg-blue-500',
  default: 'bg-gray-500',
};

export function Badge({
  variant = 'default',
  children,
  dot = false,
  pulse = false,
  className,
}: {
  variant?: string;
  children: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  const v = variants[variant] || variants.default;
  const d = dotColors[variant] || dotColors.default;

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border',
      v,
      className
    )}>
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping', d)} />}
          <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', d)} />
        </span>
      )}
      {children}
    </span>
  );
}
