import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useQueueStore } from '@/features/check-in/queue-store';
import { colors } from '@/theme';

export function QueueStatus() {
  const { pending, confirmed, failed, isOnline, isSyncing } = useQueueStore();

  return (
    <View style={styles.container}>
      <View style={styles.connectionRow}>
        <View
          style={[
            styles.dot,
            { backgroundColor: isOnline ? colors.success : colors.warning },
          ]}
        />
        <Text style={styles.connectionText}>
          {isOnline ? 'Online' : 'Operação offline'}
        </Text>
        {isSyncing && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      <View style={styles.metrics}>
        <Metric label="Pendentes" value={pending} color={colors.warning} />
        <Metric label="Confirmados" value={confirmed} color={colors.success} />
        <Metric label="Falhas" value={failed} color={colors.danger} />
      </View>
    </View>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  connectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  connectionText: { color: colors.text, fontSize: 14, flex: 1 },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: {
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderRadius: 12,
    flex: 1,
    paddingVertical: 10,
  },
  metricValue: { fontSize: 20, fontWeight: '800' },
  metricLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
