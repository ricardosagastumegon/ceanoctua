type Props = {
  steps: readonly string[];
  currentIdx: number;
  stepDates?: (string | null | undefined)[];
  size?: 'sm' | 'md';
};

export function StepTracker({ steps, currentIdx, stepDates = [], size = 'md' }: Props) {
  const dotSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const labelClass = size === 'sm' ? 'text-[10px]' : 'text-[11px]';
  return (
    <ol className="flex w-full items-start gap-1">
      {steps.map((label, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;
        const date = stepDates?.[i];
        const dotBg = isDone
          ? 'bg-gradient-to-br from-teal to-teal-d border-transparent'
          : isActive
            ? 'bg-white border-teal shadow-[0_0_0_3px_rgba(0,180,197,0.25)]'
            : 'bg-sand-l border-sand';
        const lineDone = i < currentIdx;
        return (
          <li key={label} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {i > 0 && (
                <span
                  className={`h-0.5 flex-1 ${lineDone ? 'bg-gradient-to-r from-teal to-teal-d' : 'bg-sand'}`}
                />
              )}
              <span
                aria-current={isActive ? 'step' : undefined}
                title={`${label}${date ? ` (${date})` : ''}`}
                className={`shrink-0 rounded-full border-2 ${dotSize} ${dotBg}`}
              />
              {i < steps.length - 1 && (
                <span
                  className={`h-0.5 flex-1 ${i < currentIdx ? 'bg-gradient-to-r from-teal to-teal-d' : 'bg-sand'}`}
                />
              )}
            </div>
            <span
              className={`${labelClass} mt-1 text-center font-semibold uppercase tracking-wider ${
                isActive ? 'text-teal-d' : isDone ? 'text-dark-2' : 'text-dark-3'
              }`}
            >
              {label}
            </span>
            {date && (
              <span className="text-[9px] text-dark-3">{date}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
