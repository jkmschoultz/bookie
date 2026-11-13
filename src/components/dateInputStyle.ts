import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';

export interface DateInputProps {
  /** YYYY-MM-DD, or '' for no date. */
  value: string;
  onChange: (value: string) => void;
  /** When the value is final: on blur when typed, straight away when picked from a calendar. */
  onCommit: (value: string) => void;
  /** Latest date that can be picked, YYYY-MM-DD. */
  max?: string;
  invalid?: boolean;
  accessibilityLabel?: string;
}

export const dateInputStyle = StyleSheet.create({
  input: {
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  invalid: { borderColor: Colors.danger },
});
