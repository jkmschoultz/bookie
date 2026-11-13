import { TextInput } from 'react-native';

import { Colors } from '@/constants/theme';
import { formatDateTyping } from '@/library/fields';

import { dateInputStyle, type DateInputProps } from './dateInputStyle';

/** A YYYY-MM-DD date typed on the number pad, dashes added as you go. The web version uses the browser's date picker. */
export function DateInput({ value, onChange, onCommit, invalid, accessibilityLabel }: DateInputProps) {
  return (
    <TextInput
      value={value}
      onChangeText={(t) => onChange(formatDateTyping(t))}
      onBlur={() => onCommit(value)}
      placeholder="YYYY-MM-DD"
      placeholderTextColor={Colors.border}
      keyboardType="number-pad"
      maxLength={10}
      accessibilityLabel={accessibilityLabel}
      style={[dateInputStyle.input, invalid && dateInputStyle.invalid]}
    />
  );
}
