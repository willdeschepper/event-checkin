import type { BarcodeScanningResult } from 'expo-camera';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { QueueStatus } from '@/components/queue-status';
import { queueCheckIn } from '@/features/check-in/controller';
import type { CheckInCommand, CheckInMethod } from '@/features/check-in/model';
import { colors } from '@/theme';

type Feedback = {
  tone: 'success' | 'warning' | 'danger';
  title: string;
  message: string;
};

export default function CheckInScreen() {
  const { eventId, eventName } = useLocalSearchParams<{
    eventId: string;
    eventName?: string;
  }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState('');
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const scanLock = useRef(false);

  const presentResult = async (
    command: CheckInCommand,
    duplicate: boolean,
  ) => {
    if (command.status === 'confirmed') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFeedback({
        tone: 'success',
        title: duplicate ? 'Participante já confirmado' : 'Check-in confirmado',
        message: `Comprovante ${command.receiptId || command.idempotencyKey.slice(0, 8)}`,
      });
      return;
    }

    if (command.status === 'failed') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFeedback({
        tone: 'danger',
        title: 'Check-in rejeitado',
        message: command.lastError || 'Revise os dados do participante.',
      });
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setFeedback({
      tone: 'warning',
      title: duplicate ? 'Check-in já está na fila' : 'Check-in salvo no dispositivo',
      message: 'A confirmação será reconciliada automaticamente quando a conexão estiver disponível.',
    });
  };

  const submit = async (attendeeCode: string, method: CheckInMethod) => {
    const normalized = attendeeCode.trim();
    if (!normalized || processing) return;

    setProcessing(true);
    setFeedback(null);
    try {
      const result = await queueCheckIn({ eventId, attendeeCode: normalized, method });
      await presentResult(result.command, result.duplicate);
      setManualCode('');
      setCameraEnabled(false);
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFeedback({
        tone: 'danger',
        title: 'Não foi possível registrar',
        message: error instanceof Error ? error.message : 'Erro inesperado',
      });
    } finally {
      setProcessing(false);
      setTimeout(() => {
        scanLock.current = false;
      }, 1200);
    }
  };

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (scanLock.current || processing) return;
    scanLock.current = true;
    void submit(result.data, 'qr');
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const response = await requestPermission();
      if (!response.granted) {
        setFeedback({
          tone: 'danger',
          title: 'Câmera não autorizada',
          message: 'Libere a câmera nas configurações ou use o código manual.',
        });
        return;
      }
    }
    setFeedback(null);
    setCameraEnabled(true);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.eyebrow}>EVENTO</Text>
          <Text style={styles.title}>{eventName || 'Operação de check-in'}</Text>
          <Text style={styles.subtitle}>
            O registro é persistido antes do envio para evitar perda durante instabilidade.
          </Text>
        </View>

        <QueueStatus />

        {cameraEnabled ? (
          <View style={styles.cameraFrame}>
            <CameraView
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcode}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.scanTarget} />
            <Pressable style={styles.closeCamera} onPress={() => setCameraEnabled(false)}>
              <Text style={styles.closeCameraText}>Fechar câmera</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={openCamera}
            style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}
          >
            <Text style={styles.scanButtonIcon}>⌗</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanButtonTitle}>Ler QR Code</Text>
              <Text style={styles.scanButtonCaption}>Use a câmera do dispositivo</Text>
            </View>
            <Text style={styles.scanButtonChevron}>›</Text>
          </Pressable>
        )}

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OU DIGITE O CÓDIGO</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.manualCard}>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!processing}
            onChangeText={setManualCode}
            onSubmitEditing={() => submit(manualCode, 'manual')}
            placeholder="Ex.: EVT-8F31A2"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            style={styles.input}
            testID="manual-code-input"
            value={manualCode}
          />
          <Pressable
            disabled={!manualCode.trim() || processing}
            onPress={() => submit(manualCode, 'manual')}
            testID="confirm-check-in-button"
            style={({ pressed }) => [
              styles.confirmButton,
              (!manualCode.trim() || processing) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {processing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.confirmButtonText}>Confirmar entrada</Text>
            )}
          </Pressable>
        </View>

        {feedback && <FeedbackCard feedback={feedback} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FeedbackCard({ feedback }: { feedback: Feedback }) {
  const toneColor = {
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
  }[feedback.tone];

  return (
    <View
      style={[styles.feedback, { borderColor: toneColor }]}
      testID="check-in-feedback"
    >
      <View style={[styles.feedbackDot, { backgroundColor: toneColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.feedbackTitle, { color: toneColor }]}>{feedback.title}</Text>
        <Text style={styles.feedbackMessage}>{feedback.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48, gap: 18 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.text, fontSize: 27, fontWeight: '900', marginTop: 6 },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  scanButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 14,
    padding: 18,
  },
  scanButtonIcon: { color: colors.white, fontSize: 32, fontWeight: '300' },
  scanButtonTitle: { color: colors.white, fontSize: 17, fontWeight: '800' },
  scanButtonCaption: { color: '#FFE3D7', fontSize: 12, marginTop: 3 },
  scanButtonChevron: { color: colors.white, fontSize: 30 },
  cameraFrame: {
    backgroundColor: '#000',
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    height: 360,
    overflow: 'hidden',
  },
  scanTarget: {
    alignSelf: 'center',
    borderColor: colors.primary,
    borderRadius: 20,
    borderWidth: 3,
    height: 210,
    marginTop: 58,
    width: 210,
  },
  closeCamera: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 999,
    bottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'absolute',
  },
  closeCameraText: { color: colors.white, fontWeight: '700' },
  dividerRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  divider: { backgroundColor: colors.border, flex: 1, height: 1 },
  dividerText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  manualCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  input: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 14,
    paddingVertical: 15,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 13,
    minHeight: 52,
    justifyContent: 'center',
  },
  confirmButtonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78 },
  feedback: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  feedbackDot: { borderRadius: 6, height: 11, marginTop: 4, width: 11 },
  feedbackTitle: { fontSize: 15, fontWeight: '800' },
  feedbackMessage: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
});
