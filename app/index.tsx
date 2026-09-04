import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchEvents } from '@/api/events';
import { QueueStatus } from '@/components/queue-status';
import { env } from '@/config/env';
import { synchronizeCheckIns } from '@/features/check-in/controller';
import type { EventSummary } from '@/features/events/model';
import { colors } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const events = useQuery({ queryKey: ['events'], queryFn: fetchEvents });

  const refresh = async () => {
    await Promise.all([events.refetch(), synchronizeCheckIns()]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={events.isRefetching}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>OPERAÇÃO DE ENTRADA</Text>
          <Text style={styles.title}>Event Check-in</Text>
          <Text style={styles.subtitle}>
            Leitura rápida, operação offline e confirmação segura.
          </Text>
          {env.demoMode && <Text style={styles.demoBadge}>MODO DEMONSTRAÇÃO</Text>}
        </View>

        <QueueStatus />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Eventos</Text>
          <Text style={styles.sectionCaption}>Selecione a operação</Text>
        </View>

        {events.isLoading && (
          <ActivityIndicator size="large" color={colors.primary} />
        )}

        {events.isError && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Não foi possível carregar os eventos</Text>
            <Pressable style={styles.retryButton} onPress={() => events.refetch()}>
              <Text style={styles.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        )}

        {events.data?.map(event => (
          <EventCard
            event={event}
            key={event.id}
            onPress={() =>
              router.push({
                pathname: '/check-in/[eventId]',
                params: { eventId: event.id, eventName: event.name },
              })
            }
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function EventCard({
  event,
  onPress,
}: {
  event: EventSummary;
  onPress: () => void;
}) {
  const date = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(event.startsAt));

  return (
    <Pressable
      onPress={onPress}
      testID={`event-card-${event.id}`}
      style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]}
    >
      <View style={styles.eventIcon}>
        <Text style={styles.eventIconText}>QR</Text>
      </View>
      <View style={styles.eventInfo}>
        <Text style={styles.eventName}>{event.name}</Text>
        <Text style={styles.eventMeta}>{date} · {event.venue}</Text>
        <Text style={styles.eventCapacity}>
          {event.expectedAttendees.toLocaleString('pt-BR')} participantes esperados
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  hero: { paddingTop: 24, paddingBottom: 8 },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  title: { color: colors.text, fontSize: 36, fontWeight: '900', marginTop: 8 },
  subtitle: { color: colors.textMuted, fontSize: 16, lineHeight: 23, marginTop: 8 },
  demoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2A1E16',
    borderColor: '#5C3522',
    borderRadius: 999,
    borderWidth: 1,
    color: '#FDBA74',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 14,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sectionHeader: { marginTop: 14 },
  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  sectionCaption: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  eventCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  eventIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  eventIconText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  eventInfo: { flex: 1 },
  eventName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  eventMeta: { color: colors.textMuted, fontSize: 12, marginTop: 5 },
  eventCapacity: { color: colors.success, fontSize: 11, marginTop: 5 },
  chevron: { color: colors.textMuted, fontSize: 30, fontWeight: '300' },
  errorCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    gap: 12,
    paddingVertical: 24,
  },
  errorTitle: { color: colors.danger, fontSize: 14 },
  retryButton: { backgroundColor: colors.primary, borderRadius: 10, padding: 10 },
  retryText: { color: colors.white, fontWeight: '700' },
});
