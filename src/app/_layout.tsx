import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AccountProvider } from '@/account/AccountProvider';
import { BookFlight } from '@/components/BookFlight';
import { ScreenTransitions } from '@/components/ScreenTransitions';
import { StorageErrorBoundary } from '@/components/StorageError';
import { Colors } from '@/constants/theme';
import { migrate } from '@/db/migrations';
import '@/library/installPrompt';
import { LibraryProvider } from '@/library/LibraryProvider';
import { rememberSeasonPreview } from '@/library/season';

SplashScreen.preventAutoHideAsync();
// ?season=christmas on a preview or staging address dresses the hallway for that season, for this tab.
rememberSeasonPreview();

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
        <StorageErrorBoundary>
          <Suspense>
            <SQLiteProvider databaseName="bookie.db" onInit={migrate} useSuspense>
              <LibraryProvider>
                <AccountProvider>
                  <StatusBar style="light" />
                  {/* On iOS 26 the header is see-through and screens run underneath it, so each screen's main scroll view
                      uses contentInsetAdjustmentBehavior="automatic" to start below it. */}
                  <ScreenTransitions>
                    <Stack screenOptions={{ headerTintColor: Colors.accent, headerTitleStyle: { color: Colors.text } }}>
                      <Stack.Screen name="index" options={{ headerShown: false }} />
                      <Stack.Screen name="book/[id]" options={{ title: '', presentation: 'modal' }} />
                      <Stack.Screen name="settings" options={{ title: 'Settings', presentation: 'modal' }} />
                      <Stack.Screen name="account" options={{ title: 'Account', presentation: 'modal' }} />
                      <Stack.Screen name="friends/index" options={{ title: 'Friends', headerShown: false, presentation: 'fullScreenModal' }} />
                      {/* On the web the Friends hallway stays drawn under a friend's shelf, which fades in over it (see friends/[id]). */}
                      <Stack.Screen name="friends/[id]" options={{ title: '', animation: 'fade', presentation: Platform.OS === 'web' ? 'transparentModal' : undefined }} />
                      <Stack.Screen name="move-in" options={{ headerShown: false }} />
                      <Stack.Screen name="welcome" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
                      <Stack.Screen name="whats-to-come" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
                      <Stack.Screen name="add/index" options={{ title: 'Add books', presentation: 'modal' }} />
                      <Stack.Screen name="add/search" options={{ title: 'Search' }} />
                      <Stack.Screen name="add/scan" options={{ title: 'Scan barcode' }} />
                      <Stack.Screen name="add/manual" options={{ title: 'Book details' }} />
                      <Stack.Screen name="add/import" options={{ title: 'Import from Goodreads' }} />
                      <Stack.Screen name="add/goodreads" options={{ title: 'Goodreads' }} />
                    </Stack>
                  </ScreenTransitions>
                  <BookFlight />
                </AccountProvider>
              </LibraryProvider>
            </SQLiteProvider>
          </Suspense>
        </StorageErrorBoundary>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
