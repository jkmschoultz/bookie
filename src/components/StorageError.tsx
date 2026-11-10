import * as SplashScreen from 'expo-splash-screen';
import { Component, useEffect, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

/**
 * Catches the library database failing to open, which on web happens when the browser won't give Bookie storage:
 * private windows in Safari and Firefox, or a page that isn't served over https. Shows why instead of a blank page.
 */
export class StorageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    return this.state.error ? <StorageErrorScreen error={this.state.error} /> : this.props.children;
  }
}

function StorageErrorScreen({ error }: { error: Error }) {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  const web = Platform.OS === 'web';
  const insecure = web && !window.isSecureContext;
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Bookie can’t open your library here</Text>
      <Text style={styles.body}>
        {insecure
          ? 'Bookie needs a secure (https) address to store your books on this device. Open it from its https link instead.'
          : web
            ? 'This browser isn’t letting Bookie store anything, which usually means it’s a private or incognito window. Open Bookie in a normal browser window instead.'
            : 'Something went wrong opening the library on this device. Closing and reopening Bookie may help.'}
      </Text>
      <Pressable style={styles.button} onPress={() => (web ? window.location.reload() : undefined)} disabled={!web}>
        <Text style={styles.buttonText}>{web ? 'Try again' : 'Close and reopen Bookie'}</Text>
      </Pressable>
      <Text style={styles.detail}>{error.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', padding: 32, gap: 16 },
  title: { color: Colors.text, fontSize: 22, fontFamily: Fonts.serif, fontWeight: '700' },
  body: { color: Colors.textMuted, fontSize: 16, lineHeight: 23 },
  button: { alignSelf: 'flex-start', backgroundColor: Colors.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  buttonText: { color: Colors.accentText, fontWeight: '700', fontSize: 16 },
  detail: { color: Colors.border, fontSize: 12, marginTop: 8 },
});
