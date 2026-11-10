import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Alert.alert, but working on web too, where react-native-web's Alert is a no-op.
 * On web, one button becomes window.alert and several become window.confirm:
 * OK runs the last non-cancel button, Cancel runs the cancel (or first) button.
 */
export function alert(title: string, message?: string, buttons: AlertButton[] = []): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  if (buttons.length <= 1) {
    window.alert(text);
    buttons[0]?.onPress?.();
    return;
  }
  const ok = buttons.findLast((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];
  const cancel = buttons.find((b) => b.style === 'cancel') ?? buttons.find((b) => b !== ok);
  (window.confirm(text) ? ok : cancel)?.onPress?.();
}
