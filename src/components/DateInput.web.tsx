import { Colors } from '@/constants/theme';

import type { DateInputProps } from './dateInputStyle';

/** The browser's own date picker (a calendar on desktop, a wheel or calendar sheet on phones). */
export function DateInput({ value, onChange, onCommit, max, invalid, accessibilityLabel }: DateInputProps) {
  return (
    <input
      type="date"
      value={value}
      max={max}
      aria-label={accessibilityLabel}
      onChange={(e) => {
        onChange(e.target.value);
        onCommit(e.target.value);
      }}
      style={{
        color: Colors.text,
        backgroundColor: Colors.surface,
        border: `1px solid ${invalid ? Colors.danger : Colors.border}`,
        borderRadius: 10,
        padding: '10px 12px',
        fontSize: 16,
        fontFamily: 'inherit',
        // Light calendar icon and picker on the dark background.
        colorScheme: 'dark',
        width: '100%',
        minHeight: 44,
        boxSizing: 'border-box',
        // Safari shows an empty date input as a blank box; keep it the same height as the others.
        WebkitAppearance: 'none',
        caretColor: Colors.accent,
      }}
    />
  );
}
