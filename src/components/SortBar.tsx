import { ScrollView, StyleSheet, View } from 'react-native';

import { SORT_LABELS, type SortMode } from '@/shelf/grouping';
import { useUi } from '@/store/uiStore';
import { STATUS_LABELS, type ReadStatus } from '@/types';

import { Chip } from './Chip';

const SORT_MODES = Object.keys(SORT_LABELS) as SortMode[];
const STATUSES: ReadStatus[] = ['reading', 'read', 'owned', 'want', 'dnf'];

export function SortBar() {
  const { sortMode, setSortMode, statusFilter, toggleStatus, clearStatusFilter } = useUi();

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {SORT_MODES.map((mode) => (
          <Chip key={mode} label={SORT_LABELS[mode]} selected={sortMode === mode} onPress={() => setSortMode(mode)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip small label="All" selected={statusFilter.length === 0} onPress={clearStatusFilter} />
        {STATUSES.map((s) => (
          <Chip key={s} small label={STATUS_LABELS[s]} selected={statusFilter.includes(s)} onPress={() => toggleStatus(s)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, paddingBottom: 10 },
  row: { gap: 8, paddingHorizontal: 16, alignItems: 'center' },
});
