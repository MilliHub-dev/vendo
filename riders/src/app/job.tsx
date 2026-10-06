import { Redirect, useRouter } from 'expo-router';
import { CircleDot, MapPin, MessageCircle, Navigation, Phone } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useAdvanceJob, useJob, useMessages } from '@/api/queries';
import type { Job, Place } from '@/api/types';
import { RouteMap } from '@/components/RouteMap';
import { Badge, Button, Card, IconButton, Row, Screen, Sheet, Text } from '@/components/ui';
import { formatDistance } from '@/lib/geo';
import { formatNaira } from '@/lib/money';
import { useChatSeen } from '@/store/chat';
import { confirm } from '@/store/confirm';
import { radius, spacing, useTheme } from '@/theme';

import { SUPPORT_WHATSAPP } from './application';

/** Opens the phone's own maps app with directions — the in-app map is only an overview. */
const navigateTo = (place: Place) =>
  Linking.openURL(Platform.OS === 'ios' ? `http://maps.apple.com/?daddr=${place.lat},${place.lng}&dirflg=d` : `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=driving`);

const sizeLabel = { document: 'Document', small: 'Small parcel', large: 'Large parcel' };

/** The delivery in progress: go to pickup → picked up → on the way → delivered (with the receiver's code for dispatch). */
export default function JobScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const job = useJob();
  const advance = useAdvanceJob();
  const [codeSheet, setCodeSheet] = useState(false);
  const chat = useMessages(!!job.data);
  const seen = useChatSeen((s) => (job.data ? (s.seen[job.data.id] ?? 0) : 0));
  const unread = Math.max(0, (chat.data?.filter((m) => m.from === 'customer').length ?? 0) - seen);

  if (job.isPending) return <Screen scroll={false}><ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} /></Screen>;
  if (!job.data) return advance.isSuccess ? null : <Redirect href="/" />;

  const j = job.data;
  // food orders don't share the customer's name or number with the rider; chat is the way to reach them
  const who = j.contact?.name ?? (j.type === 'food' ? 'the customer' : 'the receiver');
  const toPickup = j.status === 'rider_assigned';
  const target = toPickup ? j.pickup : j.dropoff;
  const finished = (done: Job) => router.replace({ pathname: '/job-done', params: { earning: done.earningKobo === undefined ? '' : String(done.earningKobo), title: done.vendorName ?? done.contact?.name ?? 'Delivery', code: done.code } });

  const step = {
    rider_assigned: { title: 'Go to the pickup', hint: j.type === 'food' ? `Collect the order from ${j.vendorName}.` : 'Collect the package from the sender.', button: 'I’ve picked it up', action: () => advance.mutate({ action: 'picked_up' }) },
    picked_up: { title: 'Picked up', hint: 'Check you have everything, then start the delivery.', button: 'Start delivery', action: () => advance.mutate({ action: 'on_the_way' }) },
    on_the_way: j.requiresCode
      ? { title: `Deliver to ${who}`, hint: 'Ask the receiver for their 4-digit delivery code before you hand over the package.', button: 'Enter delivery code', action: () => setCodeSheet(true) }
      : {
          title: `Deliver to ${who}`,
          hint: 'Hand over the order, then mark it delivered.',
          button: 'Mark as delivered',
          action: () => confirm({ title: 'Order handed over?', message: `Confirm you’ve given the order to ${who}.`, confirmLabel: 'Yes, delivered', cancelLabel: 'Not yet', onConfirm: () => advance.mutate({ action: 'delivered' }, { onSuccess: finished }) }),
        },
    delivered: { title: 'Delivered', hint: '', button: 'Done', action: () => router.replace('/') },
    cancelled: { title: 'Order cancelled', hint: 'The customer cancelled this order.', button: 'Back to home', action: () => router.replace('/') },
  }[j.status];

  return (
    <Screen footer={<Button title={step.button} loading={advance.isPending && !codeSheet} onPress={step.action} />}>
      <RouteMap pickupLabel={j.vendorName ?? 'Pickup'} dropoffLabel={j.contact?.name ?? 'Drop-off'} progress={j.status === 'rider_assigned' ? 0 : j.status === 'picked_up' ? 0.04 : 0.55} height={200} />

      <View style={{ gap: 2 }}>
        <View style={styles.titleRow}>
          <Text variant="title" style={{ flex: 1 }}>
            {step.title}
          </Text>
          <Badge label={j.code} tone="muted" />
        </View>
        <Text color="muted">{step.hint}</Text>
      </View>

      <Card style={{ gap: spacing.md }}>
        <View style={styles.stop}>
          {toPickup ? <CircleDot size={20} color={colors.primary} /> : <MapPin size={20} color={colors.primary} />}
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="subtle">
              {toPickup ? 'PICK UP FROM' : 'DELIVER TO'}
            </Text>
            <Text variant="bodyMedium" color="heading">
              {target.address}
            </Text>
            {target.note ? (
              <Text variant="small" color="muted">
                {target.note}
              </Text>
            ) : null}
          </View>
        </View>
        <Button title="Navigate" variant="secondary" icon={<Navigation size={18} color={colors.heading} />} onPress={() => navigateTo(target)} />
      </Card>

      <Card style={styles.contact}>
        <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
          <Text variant="heading" color="primary">
            {(j.contact?.name ?? (j.type === 'food' ? 'C' : 'R')).slice(0, 1)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium" color="heading">
            {j.contact?.name ?? (j.type === 'food' ? 'Customer' : 'Receiver')}
          </Text>
          <Text variant="small" color="muted">
            {j.contact ? (j.type === 'food' ? 'Customer' : 'Receiver') : 'Message them in the chat'}
          </Text>
        </View>
        {j.contact ? <IconButton icon={Phone} label={`Call ${j.contact.name}`} tone="soft" onPress={() => Linking.openURL(`tel:${j.contact!.phone}`)} /> : null}
        <View>
          <IconButton icon={MessageCircle} label={unread ? `Chat, ${unread} new message${unread === 1 ? '' : 's'}` : 'Chat'} tone="soft" onPress={() => router.push('/chat')} />
          {unread > 0 ? (
            <View style={[styles.unread, { backgroundColor: colors.danger, borderColor: colors.surface }]}>
              <Text variant="caption" style={{ color: '#fff', fontSize: 11, lineHeight: 14 }} maxFontSizeMultiplier={1}>
                {unread > 9 ? '9+' : unread}
              </Text>
            </View>
          ) : null}
        </View>
      </Card>

      <Card>
        {j.items?.map((i) => <Row key={i.name} label={`${i.quantity} × ${i.name}`} value="" />)}
        {j.package ? (
          <>
            <Row label="Package" value={sizeLabel[j.package.size] + (j.package.fragile ? ' · fragile' : '')} />
            <Row label="Contents" value={j.package.description} />
          </>
        ) : null}
        <View style={[styles.rule, { backgroundColor: colors.line }]} />
        <Row label="Trip distance" value={formatDistance(j.tripDistanceM)} />
        {j.earningKobo !== undefined ? <Row label="You earn" value={formatNaira(j.earningKobo)} strong /> : <Row label="Your earning" value="Added after delivery" />}
      </Card>

      {advance.isError && !codeSheet ? <Text color="danger">{advance.error.message}</Text> : null}

      {codeSheet ? (
        <CodeSheet
          job={j}
          error={advance.isError ? advance.error.message : null}
          loading={advance.isPending}
          onClose={() => {
            setCodeSheet(false);
            advance.reset();
          }}
          onSubmit={(code) => advance.mutate({ code }, { onSuccess: finished })}
        />
      ) : null}
    </Screen>
  );
}

/** The receiver reads out their code. The server locks the delivery after too many wrong tries. */
function CodeSheet({ job, error, loading, onClose, onSubmit }: { job: Job; error: string | null; loading: boolean; onClose: () => void; onSubmit: (code: string) => void }) {
  const { colors } = useTheme();
  const input = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const locked = job.codeAttemptsLeft !== undefined && job.codeAttemptsLeft <= 0;

  return (
    <Sheet visible onClose={onClose} title="Delivery code" footer={locked ? <Button title="Message support on WhatsApp" onPress={() => Linking.openURL(SUPPORT_WHATSAPP)} /> : <Button title="Complete delivery" disabled={code.length < 4} loading={loading} onPress={() => onSubmit(code)} />}>
      <Text color="muted">{locked ? 'This delivery is locked after three wrong codes. Keep the package with you and contact Vendo support.' : `Ask ${job.contact?.name ?? 'the receiver'} for the 4-digit code the sender shared with them.`}</Text>
      {!locked ? (
        <Pressable accessibilityLabel="Delivery code" onPress={() => input.current?.focus()} style={styles.boxes}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.box, { backgroundColor: colors.surfaceAlt, borderColor: error ? colors.danger : i === code.length ? colors.primary : colors.line }]}>
              <Text variant="display">{code[i] ?? ''}</Text>
            </View>
          ))}
          <TextInput ref={input} value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" autoFocus maxLength={4} caretHidden style={[StyleSheet.absoluteFill, { opacity: 0.01 }]} />
        </Pressable>
      ) : null}
      {error ? <Text color="danger">{error}</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  contact: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  unread: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  boxes: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center', paddingVertical: spacing.sm },
  box: { width: 60, height: 72, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
