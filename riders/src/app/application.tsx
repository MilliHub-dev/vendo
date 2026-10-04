import { useQueryClient } from '@tanstack/react-query';
import { Bike, Camera, Car, CircleCheck, Clock, FileText, IdCard, LogOut, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { useCities, useRegisterRider, useRider, useSubmitApplication, useUploadDocument } from '@/api/queries';
import type { DocumentKind, Rider, VehicleType } from '@/api/types';
import { Badge, Button, Card, Chip, Input, OptionRow, Screen, Text } from '@/components/ui';
import { confirm } from '@/store/confirm';
import { useSession } from '@/store/session';
import { radius, spacing, useTheme } from '@/theme';

export const SUPPORT_WHATSAPP = 'https://wa.me/2348144461726';

export const documentInfo: Record<DocumentKind, { title: string; hint: string; icon: LucideIcon }> = {
  gov_id: { title: 'Government ID', hint: 'NIN slip, driver’s licence, voter’s card or passport', icon: IdCard },
  bike_registration: { title: 'Vehicle registration', hint: 'The papers for the vehicle you’ll ride', icon: FileText },
  photo: { title: 'Profile photo', hint: 'A clear photo of your face, no cap or sunglasses', icon: Camera },
};

/** The rider application, one step at a time: vehicle → documents → review. Shown until the rider is approved. */
export default function ApplicationScreen() {
  const { colors } = useTheme();
  const rider = useRider();
  const step = !rider.data ? 1 : rider.data.approval === 'pending' || rider.data.approval === 'rejected' ? 2 : 3;

  if (rider.isPending) return <Screen safeTop scroll={false}><ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} /></Screen>;

  return (
    <Screen safeTop>
      <View style={styles.header}>
        <Text variant="eyebrow" style={{ flex: 1 }}>
          Rider application · Step {step} of 3
        </Text>
        <LogoutLink />
      </View>
      <View style={styles.progress}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[styles.progressBar, { backgroundColor: n <= step ? colors.primary : colors.line }]} />
        ))}
      </View>
      {!rider.data ? <VehicleStep /> : step === 2 ? <DocumentsStep rider={rider.data} /> : <ReviewStep rider={rider.data} />}
    </Screen>
  );
}

function LogoutLink() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const signOut = useSession((s) => s.signOut);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Log out"
      hitSlop={10}
      onPress={() =>
        confirm({
          title: 'Log out?',
          message: 'Your application is saved. Sign in again with the same phone number to continue.',
          confirmLabel: 'Log out',
          cancelLabel: 'Stay',
          destructive: true,
          onConfirm: () => {
            queryClient.clear();
            signOut();
          },
        })
      }>
      <LogOut size={20} color={colors.muted} />
    </Pressable>
  );
}

const vehicles: { value: VehicleType; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'motorcycle', label: 'Motorcycle', hint: 'Fuel or electric', icon: Bike },
  { value: 'bicycle', label: 'Bicycle', hint: 'Short trips only', icon: Bike },
  { value: 'car', label: 'Car', hint: 'For larger parcels', icon: Car },
];

function VehicleStep() {
  const { colors } = useTheme();
  const cities = useCities();
  const register = useRegisterRider();
  const [cityId, setCityId] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>('motorcycle');
  const [plate, setPlate] = useState('');
  const [touched, setTouched] = useState(false);
  const needsPlate = vehicleType !== 'bicycle';
  const plateOk = !needsPlate || plate.trim().length >= 5;

  const submit = () => {
    setTouched(true);
    if (cityId && plateOk) register.mutate({ cityId, vehicleType, plateNumber: needsPlate ? plate : 'BICYCLE' });
  };

  return (
    <>
      <View style={{ gap: spacing.xs }}>
        <Text variant="display">Your vehicle</Text>
        <Text color="muted">Tell us where you’ll ride and what you’ll ride.</Text>
      </View>

      <Text variant="heading">City</Text>
      <View style={styles.wrap}>
        {cities.data?.map((c) => (
          <Chip key={c.id} label={c.name} selected={cityId === c.id} onPress={() => setCityId(c.id)} />
        ))}
      </View>
      {touched && !cityId ? (
        <Text variant="small" color="danger">
          Choose the city you’ll work in
        </Text>
      ) : null}

      <Text variant="heading">Vehicle</Text>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        {vehicles.map(({ value, label, hint, icon: Icon }) => (
          <OptionRow
            key={value}
            title={label}
            subtitle={hint}
            selected={vehicleType === value}
            onPress={() => setVehicleType(value)}
            left={
              <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
                <Icon size={18} color={colors.primary} />
              </View>
            }
          />
        ))}
      </View>
      {needsPlate ? <Input label="Plate number" placeholder="e.g. KAD 482 QR" value={plate} onChangeText={setPlate} autoCapitalize="characters" autoCorrect={false} maxLength={12} error={touched && !plateOk ? 'Enter the plate number on your vehicle' : null} /> : null}
      {register.isError ? <Text color="danger">{register.error.message}</Text> : null}
      <Button title="Continue" loading={register.isPending} onPress={submit} />
    </>
  );
}

function DocumentsStep({ rider }: { rider: Rider }) {
  const { colors } = useTheme();
  const upload = useUploadDocument();
  const submit = useSubmitApplication();
  const ready = rider.documents.every((d) => d.status === 'submitted' || d.status === 'approved');

  return (
    <>
      <View style={{ gap: spacing.xs }}>
        <Text variant="display">Your documents</Text>
        <Text color="muted">Only the Vendo team sees these. Take clear photos in good light.</Text>
      </View>
      {rider.approval === 'rejected' ? (
        <Card style={{ borderColor: colors.danger }}>
          <Text variant="bodyMedium" color="danger">
            We couldn’t approve your application
          </Text>
          <Text color="muted">{rider.approvalNote ?? 'Please re-upload the documents marked below and submit again.'}</Text>
        </Card>
      ) : null}

      {rider.documents.map((doc) => {
        const info = documentInfo[doc.kind];
        const done = doc.status === 'submitted' || doc.status === 'approved';
        const busy = upload.isPending && upload.variables === doc.kind;
        return (
          <Pressable
            key={doc.kind}
            accessibilityRole="button"
            accessibilityLabel={`${info.title}, ${done ? 'added' : 'not added yet'}`}
            disabled={upload.isPending}
            onPress={() => upload.mutate(doc.kind)}
            style={[styles.doc, { backgroundColor: colors.surface, borderColor: doc.status === 'rejected' ? colors.danger : done ? colors.primary : colors.line }]}>
            <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
              <info.icon size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" color="heading">
                {info.title}
              </Text>
              <Text variant="small" color={doc.status === 'rejected' ? 'danger' : 'muted'}>
                {doc.status === 'rejected' ? (doc.note ?? 'Needs a clearer photo') : info.hint}
              </Text>
            </View>
            {busy ? <ActivityIndicator color={colors.primary} /> : done ? <CircleCheck size={22} color={colors.success} /> : <Badge label={doc.status === 'rejected' ? 'Re-upload' : 'Add'} />}
          </Pressable>
        );
      })}
      {submit.isError ? <Text color="danger">{submit.error.message}</Text> : null}
      <Button title="Submit application" disabled={!ready} loading={submit.isPending} onPress={() => submit.mutate()} />
      <Text variant="small" color="subtle" center>
        Tap a document to add it. You can replace it by tapping again.
      </Text>
    </>
  );
}

function ReviewStep({ rider }: { rider: Rider }) {
  const { colors } = useTheme();
  if (rider.approval === 'suspended') {
    return (
      <>
        <Text variant="display">Account suspended</Text>
        <Text color="muted">{rider.approvalNote ?? 'Your rider account has been suspended. Contact the Vendo team to find out why and what to do next.'}</Text>
        <Button title="Message support on WhatsApp" onPress={() => Linking.openURL(SUPPORT_WHATSAPP)} />
      </>
    );
  }
  return (
    <>
      <View style={[styles.clock, { backgroundColor: colors.primarySoft }]}>
        <Clock size={34} color={colors.primary} />
      </View>
      <Text variant="display" center>
        We’re reviewing your application
      </Text>
      <Text color="muted" center>
        The Vendo team is checking your documents. You’ll get a notification and an SMS as soon as you’re approved — this screen updates by itself.
      </Text>
      <Card>
        {[
          ['Application sent', true],
          ['Documents under review', true],
          ['Approved — start delivering', false],
        ].map(([label, done]) => (
          <View key={String(label)} style={styles.timeline}>
            <CircleCheck size={20} color={done ? colors.success : colors.line} />
            <Text color={done ? 'heading' : 'subtle'}>{label}</Text>
          </View>
        ))}
      </Card>
      <Card>
        <Text variant="small" color="muted">
          {rider.vehicleType === 'bicycle' ? 'Bicycle' : `${rider.vehicleType === 'car' ? 'Car' : 'Motorcycle'} · ${rider.plateNumber}`}
        </Text>
      </Card>
      <Button title="Questions? Message support" variant="secondary" onPress={() => Linking.openURL(SUPPORT_WHATSAPP)} />
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  progress: { flexDirection: 'row', gap: 6 },
  progressBar: { flex: 1, height: 4, borderRadius: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  doc: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 76, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1.5 },
  clock: { alignSelf: 'center', width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl },
  timeline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
});
