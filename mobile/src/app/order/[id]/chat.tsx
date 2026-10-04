import { Stack, useLocalSearchParams } from 'expo-router';
import { Phone, Send } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMessages, useOrder, useSendMessage } from '@/api/queries';
import type { ChatMessage } from '@/api/types';
import { Chip, IconButton, Text } from '@/components/ui';
import { formatTime } from '@/lib/dates';
import { canChat } from '@/lib/order-status';
import { useChatSeen } from '@/store/chat';
import { fonts, radius, spacing, useTheme } from '@/theme';

const quickReplies = ['I’m at the gate', 'Please call me when you arrive', 'Leave it with security', 'I’m coming out now'];

/** Chat with the rider on one order. Replaces sharing phone numbers on WhatsApp. */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: order } = useOrder(id);
  const messages = useMessages(id, !!order?.rider);
  const send = useSendMessage(id);
  const markSeen = useChatSeen((s) => s.markSeen);
  const [text, setText] = useState('');

  const list = messages.data ?? [];
  const fromRider = list.filter((m) => m.from === 'rider').length;
  useEffect(() => markSeen(id, fromRider), [id, fromRider, markSeen]);

  const open = !!order && canChat(order.status);
  const rider = order?.rider;

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
            You can message your rider here as soon as one is assigned.
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
          ListFooterComponent={
            <Text variant="caption" color="subtle" center style={{ marginBottom: spacing.md }}>
              Messages are about this delivery only. {rider.name.split(' ')[0]} · {rider.plateNumber}
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
              This chat closed when the order ended. For help, contact Vendo support from your profile.
            </Text>
          )}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const { colors } = useTheme();
  const mine = message.from === 'customer';
  return (
    <View style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
      <View
        accessible
        accessibilityLabel={`${mine ? 'You' : 'Rider'}: ${message.text}, ${formatTime(new Date(message.createdAt))}`}
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
