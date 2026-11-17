import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { alert } from '@/components/alert';
import { Colors } from '@/constants/theme';
import { cameraAllowedBefore, cameraGate, rememberCameraAllowed } from '@/library/cameraAccess';
import { useLibrary } from '@/library/LibraryProvider';
import { lookupIsbn } from '@/services/metadata/lookup';
import { emptyDraft } from '@/types';
import { useUi } from '@/store/uiStore';

/** Book barcodes are EAN-13 codes starting with the "Bookland" prefix 978/979. */
const isBookBarcode = (code: string) => /^97[89]\d{10}$/.test(code);

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  // Whether the camera has worked here before, and whether starting it straight away just failed.
  const [allowedBefore, setAllowedBefore] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const busy = useRef(false);
  const setDraft = useUi((s) => s.setDraft);
  const { findByIsbn } = useLibrary();

  useEffect(() => {
    cameraAllowedBefore().then(setAllowedBefore);
  }, []);

  const reset = () => {
    busy.current = false;
    setStatus(null);
  };

  const onScanned = async ({ data }: BarcodeScanningResult) => {
    if (busy.current || !isBookBarcode(data)) return;
    busy.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const existing = findByIsbn(data);
    if (existing) {
      alert('Already on your shelves', existing.title, [
        { text: 'Scan another', onPress: reset },
        { text: 'Open', onPress: () => router.replace({ pathname: '/book/[id]', params: { id: String(existing.id) } }) },
      ]);
      return;
    }

    setStatus(`Looking up ${data}…`);
    const draft = await lookupIsbn(data).catch(() => null);
    if (draft) {
      setDraft(draft);
      router.replace('/add/manual');
      return;
    }
    alert('Book not found', `No details found for ISBN ${data}. You can enter them yourself.`, [
      { text: 'Scan again', onPress: reset },
      {
        text: 'Enter manually',
        onPress: () => {
          setDraft({ ...emptyDraft(), isbn13: data });
          router.replace('/add/manual');
        },
      },
    ]);
  };

  const gate = cameraGate(permission, allowedBefore, failed);
  if (gate === 'wait') return <View style={styles.center} />;
  if (gate !== 'camera') {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>
          {gate === 'blocked'
            ? 'Camera access is turned off for Bookie. Turn it back on in your browser or phone settings to scan ISBN barcodes.'
            : 'Bookie needs the camera to scan ISBN barcodes.'}
        </Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>{gate === 'blocked' ? 'Try again' : 'Allow camera'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
        onBarcodeScanned={onScanned}
        onCameraReady={() => rememberCameraAllowed(true)}
        onMountError={() => {
          // Refused, or no camera after all: forget it worked, and ask in the usual way.
          rememberCameraAllowed(false);
          setFailed(true);
        }}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
        <Text style={styles.hint}>{status ?? 'Line up the barcode on the back cover'}</Text>
        {status && <ActivityIndicator color={Colors.accent} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  text: { color: Colors.text, fontSize: 16, textAlign: 'center' },
  button: { backgroundColor: Colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  buttonText: { color: Colors.accentText, fontWeight: '700' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 18 },
  frame: { width: 280, height: 140, borderWidth: 2, borderColor: Colors.accent, borderRadius: 12 },
  hint: {
    color: '#fff',
    fontSize: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
