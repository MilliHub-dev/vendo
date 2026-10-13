import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { mapHtml, type MapState } from '@/lib/map-html';
import { radius, useTheme } from '@/theme';

import { RouteMap } from './RouteMap';

export type LiveMapProps = MapState & { pickupLabel: string; dropoffLabel: string; /** 0–1, used only by the drawn fallback */ progress?: number; height?: number };

/**
 * The tracking map: real streets with the pickup, drop-off, route and the rider's live position.
 * If the map can't load (no connection to the map service), the drawn route diagram is shown instead.
 */
export function LiveMap({ pickup, dropoff, rider, route, pickupLabel, dropoffLabel, progress, height = 260 }: LiveMapProps) {
  const { colors, scheme } = useTheme();
  const web = useRef<WebView>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  // the page is built once; later changes are sent to it, so the map never reloads or jumps
  const html = useMemo(() => mapHtml({ pickup, dropoff, rider, route }, { dark: scheme === 'dark', primary: colors.primary, pickupLabel, dropoffLabel }), [scheme]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status === 'ready') web.current?.injectJavaScript(`window.vendoMap&&window.vendoMap.update(${JSON.stringify({ rider: rider ?? null, route: route ?? null })});true;`);
  }, [status, rider?.lat, rider?.lng, route]); // eslint-disable-line react-hooks/exhaustive-deps

  // a map that hasn't appeared after a while isn't going to
  useEffect(() => {
    if (status !== 'loading') return;
    const t = setTimeout(() => setStatus((s) => (s === 'loading' ? 'failed' : s)), 15000);
    return () => clearTimeout(t);
  }, [status]);

  if (status === 'failed') return <RouteMap pickupLabel={pickupLabel} dropoffLabel={dropoffLabel} progress={progress} height={height} />;

  return (
    <View style={[styles.wrap, { height, backgroundColor: colors.surfaceAlt }]} accessibilityRole="image" accessibilityLabel={`Map of the route from ${pickupLabel} to ${dropoffLabel}`}>
      <WebView
        ref={web}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://vendoltd.com' }}
        style={styles.map}
        scrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        // links inside the map (attribution) must not take over the web view
        onShouldStartLoadWithRequest={(r) => r.url.startsWith('about:') || r.url.startsWith('https://vendoltd.com')}
        onMessage={(e) => {
          try {
            const m = JSON.parse(e.nativeEvent.data) as { type?: string };
            if (m.type === 'ready') setStatus('ready');
            if (m.type === 'error') setStatus('failed');
          } catch {
            // not one of ours
          }
        }}
        onError={() => setStatus('failed')}
      />
      {status === 'loading' ? <ActivityIndicator color={colors.primary} style={StyleSheet.absoluteFill} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.xl, overflow: 'hidden' },
  map: { flex: 1, backgroundColor: 'transparent' },
});
