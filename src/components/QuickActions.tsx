import * as Haptics from 'expo-haptics';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useLibrary } from '@/library/LibraryProvider';
import { STATUS_LABELS, type Book, type ReadStatus } from '@/types';

import { Chip } from './Chip';

interface Props {
  book: Book | null;
  onClose: () => void;
  onOpen: (book: Book) => void;
}

const STATUSES: ReadStatus[] = ['reading', 'read', 'owned', 'want', 'dnf'];

/** Long-press sheet: change status or remove without leaving the shelf. */
export function QuickActions({ book, onClose, onOpen }: Props) {
  const { setStatus, removeBook } = useLibrary();
  const insets = useSafeAreaInsets();

  const confirmRemove = (b: Book) =>
    Alert.alert('Remove book?', `“${b.title}” will be taken off your shelves.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          onClose();
          await removeBook(b.id);
        },
      },
    ]);

  return (
    <Modal visible={!!book} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      {book && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.title} numberOfLines={2}>
            {book.title}
          </Text>
          <Text style={styles.author}>{book.authors.join(', ')}</Text>
          <View style={styles.statuses}>
            {STATUSES.map((s) => (
              <Chip
                key={s}
                label={STATUS_LABELS[s]}
                selected={book.status === s}
                onPress={async () => {
                  Haptics.selectionAsync();
                  await setStatus(book.id, s);
                  onClose();
                }}
              />
            ))}
          </View>
          <View style={styles.actions}>
            <Pressable
              style={styles.action}
              onPress={() => {
                onClose();
                onOpen(book);
              }}>
              <Text style={styles.actionText}>Open details</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={() => confirmRemove(book)}>
              <Text style={[styles.actionText, { color: Colors.danger }]}>Remove</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    gap: 6,
  },
  title: { color: Colors.text, fontSize: 20, fontWeight: '700' },
  author: { color: Colors.textMuted, fontSize: 15, marginBottom: 12 },
  statuses: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  action: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
  },
  actionText: { color: Colors.text, fontWeight: '600', fontSize: 15 },
});
