import type { ManualStatus } from '../constants/serviceMeta';
import { MANUAL_STATUSES, MANUAL_STATUS_COLORS } from '../constants/serviceMeta';

type Props = {
  value: ManualStatus;
  onChange: (v: ManualStatus) => void;
  disabled?: boolean;
};

// Dropdown compacto para cambiar el workflow manual del viaje.
// Paridad con ttManualStatusSelectHTML del HTML.
export function ManualStatusSelect({ value, onChange, disabled }: Props) {
  const c = MANUAL_STATUS_COLORS[value];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ManualStatus)}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      style={{ backgroundColor: c.bg, color: c.fg }}
      className="cursor-pointer rounded-full border-0 py-1 pl-3 pr-7 text-[10px] font-extrabold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
    >
      {MANUAL_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
