import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useCities, useRider, useUploadDocument } from '@/api/queries';
import type { DocumentStatus } from '@/api/types';
import { Badge, Button, Card, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

import { documentInfo } from './application';

const tone: Record<DocumentStatus, 'success' | 'warning' | 'danger' | 'muted'> = { approved: 'success', submitted: 'warning', rejected: 'danger', missing: 'muted' };
const label: Record<DocumentStatus, string> = { approved: 'Approved', submitted: 'In review', rejected: 'Re-upload needed', missing: 'Missing' };
const vehicleLabel = { motorcycle: 'Motorcycle', bicycle: 'Bicycle', car: 'Car' };

export default function VehicleScreen() {
  const { colors } = useTheme();
  const rider = useRider();
  const cities = useCities();
  const upload = useUploadDocument();
  const r = rider.data;
  if (!r) return <Screen scroll={false}><ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} /></Screen>;

  return (
    <Screen>
      <SectionHeader title="Vehicle" />
      <Card>
        <Row label="Type" value={vehicleLabel[r.vehicleType]} />
        <Row label="Plate number" value={r.plateNumber} />
        <Row label="City" value={cities.data?.find((c) => c.id === r.cityId)?.name ?? '—'} />
      </Card>
      <Text variant="small" color="subtle">
        Changed your vehicle? Message Vendo operations from your profile so the team can update and re-check it.
      </Text>

      <SectionHeader title="Documents" />
      {r.documents.map((doc) => {
        const info = documentInfo[doc.kind];
        return (
          <View key={doc.kind} style={[styles.doc, { backgroundColor: colors.surface, borderColor: doc.status === 'rejected' ? colors.danger : colors.line }]}>
            <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
              <info.icon size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="bodyMedium" color="heading">
                {info.title}
              </Text>
              <Badge label={label[doc.status]} tone={tone[doc.status]} />
              {doc.note ? (
                <Text variant="small" color="danger">
                  {doc.note}
                </Text>
              ) : null}
            </View>
            {doc.status === 'rejected' || doc.status === 'missing' ? <Button title="Upload" variant="secondary" loading={upload.isPending && upload.variables === doc.kind} onPress={() => upload.mutate(doc.kind)} style={{ minHeight: 44 }} /> : null}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  doc: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
