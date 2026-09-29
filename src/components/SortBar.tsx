import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { SORT_LABELS, type SortMode } from '@/shelf/grouping';
import { useUi } from '@/store/uiStore';
import { STATUS_LABELS, type ReadStatus } from '@/types';

import { Chip } from './Chip';

const SORT_MODES = Object.keys(SORT_LABELS) as SortMode[];
const STATUSES: ReadStatus[] = ['reading', 'read', 'owned', 'want', 'dnf'];

export function SortBar() {
  const { sortMode, setSortMode, statusFilter, toggleStatus, clearStatusFilter, layoutMode, setLayoutMode } = useUi();

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {SORT_MODES.map((mode) => (
          <Chip key={mode} label={SORT_LABELS[mode]} selected={sortMode === mode} onPress={() => setSortMode(mode)} />
        ))}
      </ScrollView>
      <View style={styles.filterLine}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          <Chip small label="All" selected={statusFilter.length === 0} onPress={clearStatusFilter} />
          {STATUSES.map((s) => (
            <Chip key={s} small label={STATUS_LABELS[s]} selected={statusFilter.includes(s)} onPress={() => toggleStatus(s)} />
          ))}
        </ScrollView>
        <Pressable
          onPress={() => setLayoutMode(layoutMode === 'row' ? 'wrap' : 'row')}
          accessibilityRole="button"
          accessibilityLabel={layoutMode === 'row' ? 'Wrap shelves to screen width' : 'One swipeable shelf per group'}
          style={styles.layoutToggle}>
          <Text style={styles.layoutText}>{layoutMode === 'row' ? '⇆ Swipe' : '▤ Wrap'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, paddingBottom: 10 },
  row: { gap: 8, paddingHorizontal: 16, alignItems: 'center' },
  filterLine: { flexDirection: 'row', alignItems: 'center' },
  layoutToggle: {
    marginRight: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  layoutText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
});
