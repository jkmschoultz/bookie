import type { DocumentPickerAsset } from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Text of a file from DocumentPicker. expo-file-system has no web implementation, so web reads the browser File. */
export async function readPickedText(asset: DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web') return asset.file ? asset.file.text() : (await fetch(asset.uri)).text();
  return new File(asset.uri).text();
}

/**
 * Hand a JSON file to the user. Native opens the share sheet (save to Files, Drive, mail…).
 * Web uses the Web Share API where it can share files (iOS home-screen apps), otherwise downloads it.
 */
export async function saveJsonFile(name: string, text: string): Promise<void> {
  const mimeType = 'application/json';
  if (Platform.OS === 'web') {
    const file = new globalThis.File([text], name, { type: mimeType });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType, UTI: 'public.json', dialogTitle: 'Save your Bookie backup' });
}
