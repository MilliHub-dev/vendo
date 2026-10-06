import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Building2, CalendarClock, CreditCard, MapPin, Search, Star, Wallet, Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
// Sheets with their own form state render an inner component only while open, so the
// state starts fresh each time without resetting it in an effect.
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { useWallet } from '@/api/queries';
import type { MenuItem, PaymentMethod, Place } from '@/api/types';
import { dayLabel, formatDateTime, formatTime, scheduleSlots } from '@/lib/dates';
import { formatNaira } from '@/lib/money';
import { useAddresses } from '@/store/addresses';
import { useCity } from '@/store/city';
import type { ItemChoice } from '@/store/cart';
import { radius, spacing, useTheme } from '@/theme';

import { Button, Chip, Input, OptionRow, Sheet, Stepper, Text, Thumb } from './ui';

// ---------------------------------------------------------------- item

/** Dish details with options (e.g. choice of protein), quantity and a note, as in the reference's "Add to cart" bar. */
type ItemSheetProps = { onClose: () => void; onAdd: (item: MenuItem, choice: ItemChoice) => void };

export function ItemSheet({ item, ...rest }: ItemSheetProps & { item: MenuItem | null }) {
  return item ? <ItemSheetOpen key={item.id} item={item} {...rest} /> : null;
}

function ItemSheetOpen({ item, onClose, onAdd }: ItemSheetProps & { item: MenuItem }) {
  const groups = item.optionGroups ?? [];
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (group: (typeof groups)[number], id: string) =>
    setPicked((now) => {
      const inGroup = group.options.map((o) => o.id);
      const mine = now.filter((x) => inGroup.includes(x));
      const others = now.filter((x) => !inGroup.includes(x));
      if (group.max === 1) return mine.includes(id) && group.min === 0 ? others : [...others, id]; // pick one: tapping another swaps
      if (mine.includes(id)) return now.filter((x) => x !== id);
      return mine.length >= group.max ? now : [...now, id];
    });
  const missing = groups.find((g) => g.options.filter((o) => picked.includes(o.id)).length < g.min);
  const unit = item.priceKobo + groups.flatMap((g) => g.options).reduce((sum, o) => sum + (picked.includes(o.id) ? o.priceKobo : 0), 0);

  return (
    <Sheet
      visible
      onClose={onClose}
      footer={
        <View style={styles.addBar}>
          <Stepper value={quantity} min={1} onChange={setQuantity} label={item.name} />
          <Button title={missing ? missing.name : `Add · ${formatNaira(unit * quantity)}`} disabled={!!missing} style={{ flex: 1 }} onPress={() => onAdd(item, { quantity, note: note.trim() || undefined, optionIds: picked })} />
        </View>
      }>
      <Thumb uri={item.imageUrl} emoji={item.emoji} size={120} emojiSize={72} rounded={radius.lg} style={{ alignSelf: 'center', width: '100%', height: item.imageUrl ? 190 : 150 }} />
      <Text variant="title">{item.name}</Text>
      <Text color="muted">{item.description}</Text>
      <Text variant="heading" color="primary">
        {formatNaira(item.priceKobo)}
      </Text>
      {groups.map((group) => (
        <View key={group.id} accessibilityRole="radiogroup" accessibilityLabel={group.name} style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <Text variant="bodyMedium" color="heading">
              {group.name}
            </Text>
            <Text variant="small" color="muted">
              {group.min > 0 ? (group.max === 1 ? 'Required' : `Choose ${group.min}–${group.max}`) : group.max === 1 ? 'Optional' : `Up to ${group.max}`}
            </Text>
          </View>
          {group.options.map((o) => (
            <OptionRow key={o.id} title={o.name} subtitle={o.priceKobo > 0 ? `+ ${formatNaira(o.priceKobo)}` : 'No extra cost'} selected={picked.includes(o.id)} onPress={() => toggle(group, o.id)} />
          ))}
        </View>
      ))}
      <Input label="Note for the kitchen (optional)" placeholder="e.g. no pepper, extra sauce" value={note} onChangeText={setNote} maxLength={120} />
    </Sheet>
  );
}

// ---------------------------------------------------------------- payment

export const paymentLabels: Record<PaymentMethod, string> = { wallet: 'Vendo Wallet', card: 'Debit card', transfer: 'Bank transfer' };

type PaymentSheetProps = { value: PaymentMethod; totalKobo?: number; onClose: () => void; onChange: (m: PaymentMethod) => void };

export function PaymentSheet({ visible, ...rest }: PaymentSheetProps & { visible: boolean }) {
  return visible ? <PaymentSheetOpen {...rest} /> : null;
}

function PaymentSheetOpen({ value, totalKobo, onClose, onChange }: PaymentSheetProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const wallet = useWallet();
  const [choice, setChoice] = useState(value);
  const balance = wallet.data?.balanceKobo ?? 0;
  const short = totalKobo !== undefined && balance < totalKobo;
  const icon = (Icon: typeof Wallet) => (
    <View style={[styles.payIcon, { backgroundColor: colors.primarySoft }]}>
      <Icon size={18} color={colors.primary} />
    </View>
  );

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Payment method"
      footer={
        <Button
          title="Confirm"
          onPress={() => {
            onChange(choice);
            onClose();
          }}
        />
      }>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        <OptionRow title="Vendo Wallet" subtitle={`Balance ${formatNaira(balance)}${short ? ' — not enough for this order' : ''}`} selected={choice === 'wallet'} onPress={() => setChoice('wallet')} left={icon(Wallet)} />
        <OptionRow title="Debit card" subtitle="Pay securely with Paystack" selected={choice === 'card'} onPress={() => setChoice('card')} left={icon(CreditCard)} />
        <OptionRow title="Bank transfer" subtitle="Transfer to a one-time account number" selected={choice === 'transfer'} onPress={() => setChoice('transfer')} left={icon(Building2)} />
      </View>
      {short && choice === 'wallet' ? (
        <Button
          title="Top up wallet"
          variant="secondary"
          onPress={() => {
            onClose();
            router.push('/wallet/top-up');
          }}
        />
      ) : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------- address

/** Pick a place: saved addresses first, or search the city. */
type AddressSheetProps = { title: string; onClose: () => void; onSelect: (place: Place) => void };

export function AddressSheet({ visible, ...rest }: AddressSheetProps & { visible: boolean }) {
  return visible ? <AddressSheetOpen {...rest} /> : null;
}

function AddressSheetOpen({ title, onClose, onSelect }: AddressSheetProps) {
  const { colors } = useTheme();
  const saved = useAddresses((s) => s.addresses);
  const [query, setQuery] = useState('');
  const results = usePlaceSearch(query);

  const choose = (place: Place) => {
    onSelect(place);
    onClose();
  };

  return (
    <Sheet visible onClose={onClose} title={title}>
      <Input placeholder="Search street, area or landmark" value={query} onChangeText={setQuery} autoCorrect={false} left={<Search size={18} color={colors.subtle} />} />
      {query.trim().length >= 3 ? (
        <PlaceResults {...results} onSelect={choose} />
      ) : (
        <>
          <Text variant="eyebrow">Saved addresses</Text>
          {saved.length === 0 ? <Text color="muted">No saved addresses yet. Search above to find a place.</Text> : null}
          {saved.map((a) => (
            <PlaceRow key={a.id} title={a.label} subtitle={a.address} onPress={() => choose(a)} />
          ))}
        </>
      )}
    </Sheet>
  );
}

export function usePlaceSearch(query: string) {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);
  const cityId = useCity((c) => c.city?.id);
  // searched on our server, inside the customer's city
  return useQuery({ queryKey: ['places', cityId, debounced], queryFn: () => api.searchPlaces(debounced), enabled: debounced.length >= 3 && !!cityId, staleTime: 300_000 });
}

export function PlaceResults({ data, isFetching, isError, onSelect }: { data?: Place[]; isFetching: boolean; isError: boolean; onSelect: (p: Place) => void }) {
  const { colors } = useTheme();
  if (isError) return <Text color="danger">Address search isn’t available right now. Check your connection and try again.</Text>;
  if (!data && isFetching) return <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />;
  if (data && data.length === 0) return <Text color="muted">No places found. Try a nearby landmark or a main road.</Text>;
  return (
    <>
      {data?.map((p, i) => {
        const [first, ...rest] = p.address.split(', ');
        return <PlaceRow key={`${p.lat},${p.lng},${i}`} title={first} subtitle={rest.join(', ')} onPress={() => onSelect(p)} />;
      })}
    </>
  );
}

function PlaceRow({ title, subtitle, onPress }: { title: string; subtitle?: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.place, { borderColor: colors.line }, pressed && { opacity: 0.7 }]}>
      <View style={[styles.payIcon, { backgroundColor: colors.primarySoft }]}>
        <MapPin size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium">{title}</Text>
        {subtitle ? (
          <Text variant="small" color="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------- schedule

/** "Now" or "Schedule" option cards plus the sheet for choosing a day and time. */
export function WhenPicker({ value, onChange, nowLabel, nowHint }: { value: string | null; onChange: (iso: string | null) => void; nowLabel: string; nowHint: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const days = scheduleSlots();
  const [day, setDay] = useState(0);
  const icon = (Icon: typeof Zap) => (
    <View style={[styles.payIcon, { backgroundColor: colors.primarySoft }]}>
      <Icon size={18} color={colors.primary} />
    </View>
  );
  return (
    <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
      <OptionRow title={nowLabel} subtitle={nowHint} selected={value === null} onPress={() => onChange(null)} left={icon(Zap)} />
      <OptionRow title="Schedule" subtitle={value ? formatDateTime(value) : 'Pick a day and time'} selected={value !== null} onPress={() => setOpen(true)} left={icon(CalendarClock)} />
      <Sheet visible={open} onClose={() => setOpen(false)} title="Schedule for later">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {days.map((d, i) => (
            <Chip key={d.day} label={d.day} selected={i === day} onPress={() => setDay(i)} />
          ))}
        </ScrollView>
        <View style={styles.slots}>
          {days[day]?.slots.map((slot) => {
            const iso = slot.toISOString();
            return (
              <Chip
                key={iso}
                label={formatTime(slot)}
                selected={value === iso}
                onPress={() => {
                  onChange(iso);
                  setOpen(false);
                }}
              />
            );
          })}
        </View>
        <Text variant="small" color="subtle">
          We start finding a rider about 15 minutes before {days[day] ? dayLabel(days[day].slots[0]).toLowerCase() : 'the'} pickup time.
        </Text>
      </Sheet>
    </View>
  );
}

// ---------------------------------------------------------------- rating

export function RatingSheet({ visible, riderName, loading, onClose, onSubmit }: { visible: boolean; riderName?: string; loading?: boolean; onClose: () => void; onSubmit: (rating: number, comment: string) => void }) {
  const { colors } = useTheme();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  return (
    <Sheet visible={visible} onClose={onClose} title="Rate your delivery" footer={<Button title="Submit rating" disabled={rating === 0} loading={loading} onPress={() => onSubmit(rating, comment.trim())} />}>
      <Text color="muted">How was {riderName ?? 'your rider'}?</Text>
      <View accessibilityRole="radiogroup" style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} accessibilityRole="radio" accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`} accessibilityState={{ selected: rating === n }} onPress={() => setRating(n)} hitSlop={6}>
            <Star size={40} color={colors.warning} fill={n <= rating ? colors.warning : 'transparent'} />
          </Pressable>
        ))}
      </View>
      <Input label="Anything to add? (optional)" placeholder="Tell us what went well or what didn’t" value={comment} onChangeText={setComment} multiline maxLength={300} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  addBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  payIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
});
