import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import type { Book } from '@/types';

import { COVER_ASPECT, Cover } from './Cover';

const TILE = 60;

interface Props {
  /** For the plain cover tile's colours. */
  book: Book;
  /** The chosen cover, or null for a plain one. */
  selected: string | null;
  /** Covers to choose from, best first. */
  options: string[];
  loading: boolean;
  onChoose: (url: string | null) => void;
  onUpload: () => void;
}

/** A row of cover thumbnails to pick from: plain, each one found, and the reader's own photo. */
export function CoverChoices({ book, selected, options, loading, onChoose, onUpload }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller} contentContainerStyle={styles.row}>
      <Tile selected={selected == null} label="Plain cover" onPress={() => onChoose(null)}>
        <Cover book={{ ...book, coverUrl: null }} width={TILE} />
      </Tile>
      {options.map((url) => (
        <Thumb key={url} url={url} selected={selected === url} onPress={() => onChoose(url)} />
      ))}
      {loading && (
        <View style={[styles.tile, styles.placeholder]}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      )}
      <Tile selected={false} label="Choose your own photo" onPress={onUpload}>
        <View style={[styles.tile, styles.placeholder]}>
          <Text style={styles.plus}>＋</Text>
          <Text style={styles.upload}>Your photo</Text>
        </View>
      </Tile>
    </ScrollView>
  );
}

function Thumb({ url, selected, onPress }: { url: string; selected: boolean; onPress: () => void }) {
  const [broken, setBroken] = useState(false);
  // Hide covers that fail to load, or that are Open Library's 1x1 "no cover" image.
  if (broken) return null;
  return (
    <Tile selected={selected} label="Cover option" onPress={onPress}>
      <Image
        source={url}
        style={styles.tile}
        contentFit="cover"
        transition={150}
        onError={() => setBroken(true)}
        onLoad={(e) => e.source.width < 10 && setBroken(true)}
      />
    </Tile>
  );
}

function Tile({ selected, label, onPress, children }: { selected: boolean; label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      style={[styles.frame, selected && styles.selected]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
  row: { gap: 10, paddingVertical: 4, paddingHorizontal: 2, alignItems: 'flex-start' },
  frame: { borderRadius: 6, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  selected: { borderColor: Colors.accent },
  tile: { width: TILE, height: TILE * COVER_ASPECT, borderRadius: 4 },
  placeholder: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  plus: { color: Colors.accent, fontSize: 20, fontWeight: '600' },
  upload: { color: Colors.textMuted, fontSize: 10, textAlign: 'center' },
});
