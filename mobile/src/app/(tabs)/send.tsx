import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowDownUp, CircleDot, Info, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { useMe } from '@/api/queries';
import type { PackageSize, Place } from '@/api/types';
import { AddressSheet, WhenPicker } from '@/components/sheets';
import { Button, Chip, Input, Screen, Text } from '@/components/ui';
import { normalisePhone } from '@/lib/photon';
import { packageSizes, useDispatchDraft } from '@/store/dispatch';
import { palette, radius, spacing, useTheme } from '@/theme';

/** Dispatch booking: pickup → drop-off → item → receiver → when, then the fare on the review screen. */
export default function SendScreen() {
  // a new key gives a fresh form: after a booking, or pre-filled by "Send again"
  const formId = useDispatchDraft((s) => s.formId);
  return <SendForm key={formId} />;
}

function SendForm() {
  const { colors } = useTheme();
  const router = useRouter();
  const me = useMe();
  const setDraft = useDispatchDraft((s) => s.setDraft);
  const [initial] = useState(() => useDispatchDraft.getState().prefill ?? {});

  const [pickup, setPickup] = useState<Place | null>(initial.pickup ?? null);
  const [dropoff, setDropoff] = useState<Place | null>(initial.dropoff ?? null);
  const [size, setSize] = useState<PackageSize>(initial.packageSize ?? 'small');
  const [note, setNote] = useState(initial.packageNote ?? '');
  const [fragile, setFragile] = useState(false);
  const [name, setName] = useState(initial.receiver?.name ?? '');
  const [phone, setPhone] = useState(initial.receiver?.phone.replace('+234', '0') ?? '');
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'pickup' | 'dropoff' | null>(null);
  const [touched, setTouched] = useState(false);

  const receiverPhone = normalisePhone(phone);
  const errors = {
    route: !pickup || !dropoff ? 'Choose a pickup and a drop-off address' : null,
    note: note.trim().length < 2 ? 'Tell the rider what they’re carrying' : null,
    name: name.trim().length < 2 ? 'Enter the receiver’s name' : null,
    phone: !receiverPhone ? 'Enter a valid Nigerian phone number' : null,
  };
  const valid = !Object.values(errors).some(Boolean);

  const submit = () => {
    setTouched(true);
    if (!valid || !pickup || !dropoff || !receiverPhone) return;
    setDraft({ pickup, dropoff, packageSize: size, packageNote: note.trim(), fragile, receiver: { name: name.trim(), phone: receiverPhone }, scheduledFor });
    router.push('/dispatch/review');
  };

  const place = (kind: 'pickup' | 'dropoff', value: Place | null) => (
    <Pressable accessibilityRole="button" accessibilityLabel={kind === 'pickup' ? 'Pickup address' : 'Drop-off address'} onPress={() => setSheet(kind)} style={styles.place}>
      {kind === 'pickup' ? <CircleDot size={20} color={colors.primary} /> : <MapPin size={20} color={colors.primary} />}
      <View style={{ flex: 1 }}>
        <Text variant="caption" color="subtle">
          {kind === 'pickup' ? 'Pick up from' : 'Deliver to'}
        </Text>
        <Text variant="bodyMedium" color={value ? 'heading' : 'subtle'} numberOfLines={2}>
          {value?.address ?? (kind === 'pickup' ? 'Choose pickup address' : 'Choose drop-off address')}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <Screen safeTop>
      <View style={[styles.hero, { backgroundColor: palette.blue }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="title" style={{ color: '#fff' }}>
            Send a package
          </Text>
          <Text variant="small" style={{ color: 'rgba(255,255,255,0.85)' }}>
            A rider picks it up and delivers it today. You see the price before you pay.
          </Text>
        </View>
        <Image source={require('@/assets/images/art-parcel.png')} style={{ width: 96, height: 96 }} contentFit="contain" />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: touched && errors.route ? colors.danger : colors.line }]}>
        {place('pickup', pickup)}
        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: colors.line }]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Swap pickup and drop-off"
            onPress={() => {
              setPickup(dropoff);
              setDropoff(pickup);
            }}
            hitSlop={8}
            style={[styles.swap, { backgroundColor: colors.surfaceAlt }]}>
            <ArrowDownUp size={16} color={colors.heading} />
          </Pressable>
        </View>
        {place('dropoff', dropoff)}
      </View>
      {touched && errors.route ? (
        <Text variant="small" color="danger">
          {errors.route}
        </Text>
      ) : null}

      <Text variant="heading">What are you sending?</Text>
      <View accessibilityRole="radiogroup" style={styles.sizes}>
        {packageSizes.map((s) => {
          const on = s.value === size;
          return (
            <Pressable key={s.value} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setSize(s.value)} style={[styles.size, { backgroundColor: on ? colors.primarySoft : colors.surface, borderColor: on ? colors.primary : colors.line }]}>
              <Text style={{ fontSize: 28, lineHeight: 34 }} maxFontSizeMultiplier={1}>
                {s.emoji}
              </Text>
              <Text variant="smallMedium" color="heading" center>
                {s.label}
              </Text>
              <Text variant="caption" color="muted" center>
                {s.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Input label="Describe the item" placeholder="e.g. a pair of shoes, signed contract" value={note} onChangeText={setNote} maxLength={120} error={touched ? errors.note : null} />
      <View style={[styles.toggle, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium">Fragile item</Text>
          <Text variant="small" color="muted">
            The rider will handle it with extra care
          </Text>
        </View>
        <Switch accessibilityLabel="Fragile item" value={fragile} onValueChange={setFragile} trackColor={{ true: colors.primary, false: colors.line }} thumbColor="#fff" />
      </View>

      <View style={styles.between}>
        <Text variant="heading">Who is receiving it?</Text>
        <Chip
          label="I’m the receiver"
          onPress={() => {
            if (!me.data) return;
            setName(me.data.name);
            setPhone(me.data.phone.replace('+234', '0'));
          }}
        />
      </View>
      <Input label="Receiver’s name" placeholder="Full name" value={name} onChangeText={setName} autoComplete="name" error={touched ? errors.name : null} />
      <Input label="Receiver’s phone number" placeholder="0803 000 0000" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" error={touched ? errors.phone : null} />

      <Text variant="heading">When?</Text>
      <WhenPicker value={scheduledFor} onChange={setScheduledFor} nowLabel="Send now" nowHint="We find the nearest rider right away" />

      <View style={[styles.notice, { backgroundColor: colors.surfaceAlt }]}>
        <Info size={18} color={colors.muted} />
        <Text variant="small" color="muted" style={{ flex: 1 }}>
          Don’t send cash, illegal items, weapons, live animals or anything that won’t fit a bike delivery box.
        </Text>
      </View>

      <Button title="See price" onPress={submit} />

      <AddressSheet visible={sheet !== null} title={sheet === 'pickup' ? 'Pick up from' : 'Deliver to'} onClose={() => setSheet(null)} onSelect={(p) => (sheet === 'pickup' ? setPickup(p) : setDropoff(p))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, overflow: 'hidden' },
  card: { borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing.lg },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 68, paddingVertical: spacing.md },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginLeft: 32 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth },
  swap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sizes: { flexDirection: 'row', gap: spacing.sm },
  size: { flex: 1, alignItems: 'center', gap: 2, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  notice: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
});
