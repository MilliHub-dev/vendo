import { Stack } from 'expo-router';
import { Phone, Send } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useJob, useMessages, useSendMessage } from '@/api/queries';
import type { ChatMessage } from '@/api/types';
import { Chip, IconButton, Text } from '@/components/ui';
import { formatTime } from '@/lib/dates';
import { useChatSeen } from '@/store/chat';
import { fonts, radius, spacing, useTheme } from '@/theme';

const quickReplies = ['I’ve arrived', 'I’m 5 minutes away', 'Please come outside', 'I can’t find the address'];

/** Chat with the customer (or receiver) on the current delivery. Open only while the job is active. */
export default function ChatScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: job } = useJob();
  const messages = useMessages(!!job);
  const send = useSendMessage();
  const markSeen = useChatSeen((s) => s.markSeen);
  const [text, setText] = useState('');

  const list = messages.data ?? [];
  const fromCustomer = list.filter((m) => m.from === 'customer').length;
  const jobId = job?.id;
  useEffect(() => {
    if (jobId) markSeen(jobId, fromCustomer);
  }, [jobId, fromCustomer, markSeen]);

  const open = !!job;
  const rider = job ? { name: job.contact?.name ?? (job.type === 'food' ? 'Customer' : 'Receiver'), phone: job.contact?.phone ?? '', plateNumber: job.code } : undefined;

  const submit = (value: string) => {
    const body = value.trim();
    if (!body || send.isPending) return;
    send.mutate(body, { onSuccess: () => setText('') });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: rider ? rider.name : 'Chat',
          headerRight: () =>
            rider && open ? (
              // the web header has no side padding of its own
              <View style={Platform.OS === 'web' ? { marginRight: spacing.lg } : undefined}>
                <IconButton icon={Phone} label={`Call ${rider.name}`} tone="soft" size={38} onPress={() => Linking.openURL(`tel:${rider.phone}`)} />
              </View>
            ) : null,
        }}
      />

      {!rider ? (
        <View style={styles.center}>
          <Text color="muted" center>
            This chat closed when the delivery ended.
          </Text>
        </View>
      ) : messages.isPending ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          // newest at the bottom, and it stays there as messages arrive
          inverted
          data={[...list].reverse()}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <Bubble message={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text color="muted" center style={{ transform: [{ scaleY: -1 }], marginTop: spacing.xl }}>
              No messages yet. Let {rider.name.split(' ')[0]} know when you’re close.
            </Text>
          }
          ListFooterComponent={
            <Text variant="caption" color="subtle" center style={{ marginBottom: spacing.md }}>
              Messages are about this delivery only · {rider.plateNumber}
            </Text>
          }
        />
      )}

      {rider ? (
        <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.line, paddingBottom: insets.bottom + spacing.sm }]}>
          {open ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.quick}>
                {quickReplies.map((q) => (
                  <Chip key={q} label={q} onPress={() => submit(q)} />
                ))}
              </ScrollView>
              <View style={styles.inputRow}>
                <TextInput
                  accessibilityLabel="Message"
                  placeholder={`Message ${rider.name.split(' ')[0]}…`}
                  placeholderTextColor={colors.subtle}
                  value={text}
                  onChangeText={setText}
                  multiline
                  maxLength={500}
                  maxFontSizeMultiplier={1.4}
                  style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  accessibilityState={{ disabled: !text.trim() }}
                  disabled={!text.trim() || send.isPending}
                  onPress={() => submit(text)}
                  style={[styles.send, { backgroundColor: colors.primary }, !text.trim() && { opacity: 0.4 }]}>
                  <Send size={20} color={colors.onPrimary} />
                </Pressable>
              </View>
              {send.isError ? (
                <Text variant="small" color="danger" style={{ paddingHorizontal: spacing.lg }}>
                  Couldn’t send: {send.error.message}. Try again.
                </Text>
              ) : null}
            </>
          ) : (
            <Text variant="small" color="muted" center style={{ padding: spacing.md }}>
              This chat closed when the delivery ended.
            </Text>
          )}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const { colors } = useTheme();
  const mine = message.from === 'rider';
  return (
    <View style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
      <View
        accessible
        accessibilityLabel={`${mine ? 'You' : 'Customer'}: ${message.text}, ${formatTime(new Date(message.createdAt))}`}
        style={[styles.bubble, mine ? { backgroundColor: colors.primary, borderBottomRightRadius: 6 } : { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderBottomLeftRadius: 6 }]}>
        <Text style={{ color: mine ? colors.onPrimary : colors.text }}>{message.text}</Text>
        <Text variant="caption" style={{ color: mine ? 'rgba(255,255,255,0.75)' : colors.subtle, alignSelf: 'flex-end' }}>
          {formatTime(new Date(message.createdAt))}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '80%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, gap: 2 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: spacing.sm },
  quick: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.lg },
  input: { flex: 1, minHeight: 46, maxHeight: 120, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 16, ...({ outlineStyle: 'none' } as object) },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
