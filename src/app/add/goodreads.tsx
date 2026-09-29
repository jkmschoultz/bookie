import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { ImportStatus } from '@/components/ImportStatus';
import { Colors } from '@/constants/theme';
import { useGoodreadsImport } from '@/library/useGoodreadsImport';
import { isExportDownload, isSignInPage } from '@/services/import/goodreadsCsv';

const EXPORT_PAGE = 'https://www.goodreads.com/review/import';

/** Runs inside the page, so the request carries the user's Goodreads login. */
function fetchScript(url: string): string {
  return `
    fetch(${JSON.stringify(url)}, { credentials: 'include' })
      .then(function (r) { if (!r.ok) throw new Error('Goodreads returned ' + r.status); return r.text(); })
      .then(function (text) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'csv', text: text })); })
      .catch(function (e) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: String(e) })); });
    true;
  `;
}

/**
 * Goodreads' export page in a built-in browser. When the user taps the export
 * link, the CSV is fetched straight into Bookie instead of being downloaded.
 */
export default function GoodreadsWebImport() {
  const web = useRef<WebView>(null);
  const [capturing, setCapturing] = useState(false);
  /** Set while the user is signing in, so we can take them back to the export page afterwards. */
  const signingIn = useRef(false);
  const { phase, importCsv, fail } = useGoodreadsImport();

  const capture = (url: string) => {
    if (capturing) return;
    setCapturing(true);
    web.current?.injectJavaScript(fetchScript(url));
  };

  const onShouldStart = (req: ShouldStartLoadRequest) => {
    if (isExportDownload(req.url)) {
      capture(req.url);
      return false;
    }
    // Keep the user in the page rather than bouncing out to the Goodreads app.
    return req.url.startsWith('https://') || req.url.startsWith('http://') || req.url === 'about:blank';
  };

  const onLoadEnd = (url: string) => {
    if (isSignInPage(url)) {
      signingIn.current = true;
    } else if (signingIn.current) {
      // Signed in: Goodreads lands on its home page, so head back to the export page.
      signingIn.current = false;
      if (!url.startsWith(EXPORT_PAGE)) {
        web.current?.injectJavaScript(`window.location.href = ${JSON.stringify(EXPORT_PAGE)}; true;`);
      }
    }
  };

  const onMessage = (e: WebViewMessageEvent) => {
    const msg = JSON.parse(e.nativeEvent.data) as { type: 'csv'; text: string } | { type: 'error'; message: string };
    if (msg.type === 'csv') importCsv(msg.text);
    else {
      setCapturing(false);
      fail(`Couldn't fetch the export: ${msg.message}`);
    }
  };

  if (phase.kind === 'enriching' || phase.kind === 'done') {
    return (
      <ScrollView contentContainerStyle={styles.status}>
        <ImportStatus phase={phase} />
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.banner}>
        {capturing && phase.kind !== 'error' ? (
          <View style={styles.row}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={styles.bannerText}>Fetching your export…</Text>
          </View>
        ) : phase.kind === 'error' ? (
          <Text style={[styles.bannerText, { color: Colors.danger }]}>{phase.message}</Text>
        ) : (
          <Text style={styles.bannerText}>
            Sign in, tap “Export Library”, then tap the export link when it appears. Use email, Amazon or Apple to sign in; Google
            sign-in doesn’t work inside apps.
          </Text>
        )}
      </View>
      <WebView
        ref={web}
        source={{ uri: EXPORT_PAGE }}
        onShouldStartLoadWithRequest={onShouldStart}
        onFileDownload={(e) => capture(e.nativeEvent.downloadUrl)}
        onOpenWindow={(e) => {
          // Links that open a new window: grab the export, load anything else in place.
          const url = e.nativeEvent.targetUrl;
          if (isExportDownload(url)) capture(url);
          else web.current?.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`);
        }}
        onMessage={onMessage}
        onLoadEnd={(e) => onLoadEnd(e.nativeEvent.url)}
        sharedCookiesEnabled
        startInLoadingState
        renderLoading={() => <ActivityIndicator color={Colors.accent} style={StyleSheet.absoluteFill} />}
        style={{ flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { padding: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  bannerText: { color: Colors.textMuted, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  status: { padding: 20, gap: 16 },
});
