import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/theme';
import { migrate } from '@/db/migrations';
import { LibraryProvider } from '@/library/LibraryProvider';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.text,
    border: Colors.border,
    primary: Colors.accent,
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
      <ThemeProvider value={theme}>
        <Suspense>
          <SQLiteProvider databaseName="bookie.db" onInit={migrate} useSuspense>
            <LibraryProvider>
              <StatusBar style="light" />
              <Stack screenOptions={{ headerTintColor: Colors.accent, headerTitleStyle: { color: Colors.text } }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="book/[id]" options={{ title: '', presentation: 'modal' }} />
                <Stack.Screen name="settings" options={{ title: 'Settings', presentation: 'modal' }} />
                <Stack.Screen name="add/index" options={{ title: 'Add books', presentation: 'modal' }} />
                <Stack.Screen name="add/search" options={{ title: 'Search' }} />
                <Stack.Screen name="add/scan" options={{ title: 'Scan barcode' }} />
                <Stack.Screen name="add/manual" options={{ title: 'Book details' }} />
                <Stack.Screen name="add/import" options={{ title: 'Import from Goodreads' }} />
                <Stack.Screen name="add/goodreads" options={{ title: 'Goodreads' }} />
              </Stack>
            </LibraryProvider>
          </SQLiteProvider>
        </Suspense>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
