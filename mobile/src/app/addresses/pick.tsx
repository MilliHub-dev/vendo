import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { MapPin, Search } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Place } from '@/api/types';
import { PlaceResults, usePlaceSearch } from '@/components/sheets';
import { Button, Chip, Input, Screen, Text } from '@/components/ui';
import { useAddresses } from '@/store/addresses';
import { radius, spacing, useTheme } from '@/theme';

const labels = ['Home', 'Office', 'Other'];

/** Add a saved address: find it, then name it and add a landmark for the rider. */
export default function AddAddressScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const add = useAddresses((s) => s.add);
  const [query, setQuery] = useState('');
  const results = usePlaceSearch(query);
  const [place, setPlace] = useState<Place | null>(null);
  const [label, setLabel] = useState('Home');
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  const name = label === 'Other' ? custom.trim() : label;
  const save = useMutation({ mutationFn: () => add(name, { ...place!, note: note.trim() || undefined }) });

  if (!place) {
    return (
      <Screen>
        <Input placeholder="Search street, area or landmark" value={query} onChangeText={setQuery} autoFocus autoCorrect={false} left={<Search size={18} color={colors.subtle} />} />
        {query.trim().length >= 3 ? (
          <PlaceResults {...results} onSelect={setPlace} />
        ) : (
          <Text color="muted">Type at least 3 letters. If your street isn’t listed, search for a nearby landmark or main road — you can add directions in the next step.</Text>
        )}
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          title="Save address"
          disabled={!name}
          loading={save.isPending}
          onPress={() => save.mutate(undefined, { onSuccess: () => router.back() })}
        />
      }>
      <View style={[styles.place, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <MapPin size={20} color={colors.primary} />
        <Text variant="bodyMedium" style={{ flex: 1 }}>
          {place.address}
        </Text>
        <Chip label="Change" onPress={() => setPlace(null)} />
      </View>
      <Text variant="heading">Save as</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {labels.map((l) => (
          <Chip key={l} label={l} selected={label === l} onPress={() => setLabel(l)} />
        ))}
      </View>
      {label === 'Other' ? <Input label="Name" placeholder="e.g. Mum’s house" value={custom} onChangeText={setCustom} maxLength={30} /> : null}
      <Input label="Landmark or directions for the rider" placeholder="e.g. blue gate, opposite the mosque" value={note} onChangeText={setNote} multiline maxLength={140} />
      {save.isError ? <Text color="danger">{save.error.message}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
});
