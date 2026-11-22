'use client';

import { isHexColor } from '@/lib/community-settings';

export function ColorField({
  label,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const picker = (
    <input
      type="color"
      aria-label={compact ? label : `${label} picker`}
      value={isHexColor(value) ? value : '#000000'}
      onChange={(event) => onChange(event.target.value)}
    />
  );
  if (compact) return picker;

  return (
    <label>
      <span>{label}</span>
      <div className="color-field">
        {picker}
        <input
          aria-label={`${label} hex value`}
          value={value}
          pattern="#[0-9a-fA-F]{6}"
          maxLength={7}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="admin-toggle">
      <span>
        {label}
        {description ? <small>{description}</small> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
