import { ScrollView, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { SORT_LABELS, type SortMode } from '@/shelf/grouping';
import { useUi } from '@/store/uiStore';
import { STATUS_LABELS, type ReadStatus } from '@/types';

import { Chip } from './Chip';

const SORT_MODES = Object.keys(SORT_LABELS) as SortMode[];
const STATUSES: ReadStatus[] = ['reading', 'read', 'owned', 'want', 'dnf'];

export function SortBar() {
  const { sortMode, setSortMode, statusFilter, toggleStatus, ownedFilter, setOwnedFilter, clearFilters } = useUi();

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {SORT_MODES.map((mode) => (
          <Chip key={mode} label={SORT_LABELS[mode]} selected={sortMode === mode} onPress={() => setSortMode(mode)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip small label="All" selected={statusFilter.length === 0 && ownedFilter === null} onPress={clearFilters} />
        {STATUSES.map((s) => (
          <Chip key={s} small label={STATUS_LABELS[s]} selected={statusFilter.includes(s)} onPress={() => toggleStatus(s)} />
        ))}
        {/* Ownership is a separate filter that combines with the status ones; tap the lit chip again to clear it. */}
        <View style={styles.divider} />
        <Chip small label="On my shelf" selected={ownedFilter === true} onPress={() => setOwnedFilter(ownedFilter === true ? null : true)} />
        <Chip small label="Not owned" selected={ownedFilter === false} onPress={() => setOwnedFilter(ownedFilter === false ? null : false)} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, paddingBottom: 10 },
  row: { gap: 8, paddingHorizontal: 16, alignItems: 'center' },
  divider: { width: 1, height: 16, backgroundColor: Colors.border },
});
