import { Bike, MapPin, Store } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { radius, shadows, useTheme } from '@/theme';

import { Text } from './ui';

// Route drawn in a 360×240 box: pickup bottom-left, drop-off top-right.
const POINTS: [number, number][] = [[64, 176], [64, 120], [196, 120], [196, 72], [296, 72]];
const SEGMENTS = POINTS.slice(1).map((p, i) => Math.hypot(p[0] - POINTS[i][0], p[1] - POINTS[i][1]));
const TOTAL = SEGMENTS.reduce((a, b) => a + b, 0);

function pointAt(progress: number): [number, number] {
  let left = Math.min(1, Math.max(0, progress)) * TOTAL;
  for (let i = 0; i < SEGMENTS.length; i++) {
    if (left <= SEGMENTS[i]) {
      const t = left / SEGMENTS[i];
      return [POINTS[i][0] + (POINTS[i + 1][0] - POINTS[i][0]) * t, POINTS[i][1] + (POINTS[i + 1][1] - POINTS[i][1]) * t];
    }
    left -= SEGMENTS[i];
  }
  return POINTS[POINTS.length - 1];
}

type Props = { pickupLabel: string; dropoffLabel: string; /** 0 = at pickup, 1 = delivered; omit to hide the rider */ progress?: number; height?: number };

/**
 * Stand-in for the live map: a drawn route with the rider moving along it.
 * It is a diagram, not real streets — it gets replaced by the Mapbox map
 * (@rnmapbox/maps) once the development build and access token exist.
 */
export function RouteMap({ pickupLabel, dropoffLabel, progress, height = 240 }: Props) {
  const { colors, scheme } = useTheme();
  const road = scheme === 'dark' ? '#22315A' : '#FFFFFF';
  const block = scheme === 'dark' ? '#16213B' : '#E3EAF5';
  const d = 'M' + POINTS.map((p) => p.join(',')).join(' L');
  const rider = progress === undefined ? null : pointAt(progress);
  const pct = (v: number, of: number) => `${(v / of) * 100}%` as const;

  return (
    <View style={[styles.wrap, { height, backgroundColor: colors.surfaceAlt }]} accessibilityRole="image" accessibilityLabel={`Route from ${pickupLabel} to ${dropoffLabel}`}>
      <Svg width="100%" height="100%" viewBox="0 0 360 240" preserveAspectRatio="xMidYMid slice">
        {[[18, 20, 110, 70], [150, 14, 90, 36], [262, 104, 86, 60], [100, 150, 70, 74], [210, 150, 40, 80], [16, 196, 28, 40], [262, 14, 86, 30]].map(([x, y, w, h]) => (
          <Rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={8} fill={block} />
        ))}
        <Path d="M0,120 H360 M64,0 V240 M196,0 V240 M0,72 H360 M0,176 H360 M296,0 V240" stroke={road} strokeWidth={14} />
        <Path d={d} stroke={colors.primary} strokeOpacity={0.25} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d={d} stroke={colors.primary} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Circle cx={POINTS[0][0]} cy={POINTS[0][1]} r={7} fill={colors.surface} stroke={colors.primary} strokeWidth={4} />
        <Circle cx={296} cy={72} r={7} fill={colors.primary} stroke={colors.surface} strokeWidth={3} />
      </Svg>

      <View style={[styles.label, shadows.card, { left: '6%', top: '80%', backgroundColor: colors.surface }]}>
        <Store size={14} color={colors.primary} />
        <Text variant="caption" color="heading" numberOfLines={1} style={{ maxWidth: 120 }}>
          {pickupLabel}
        </Text>
      </View>
      <View style={[styles.label, shadows.card, { right: '4%', top: '8%', backgroundColor: colors.surface }]}>
        <MapPin size={14} color={colors.primary} />
        <Text variant="caption" color="heading" numberOfLines={1} style={{ maxWidth: 120 }}>
          {dropoffLabel}
        </Text>
      </View>
      {rider ? (
        <View style={[styles.rider, shadows.primary, { left: pct(rider[0], 360), top: pct(rider[1], 240), backgroundColor: colors.primary, borderColor: colors.surface }]}>
          <Bike size={18} color={colors.onPrimary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.xl, overflow: 'hidden' },
  label: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  rider: { position: 'absolute', width: 40, height: 40, marginLeft: -20, marginTop: -20, borderRadius: 20, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
