import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { mapHtml } from '@/lib/map-html';
import { radius, useTheme } from '@/theme';

import type { LiveMapProps } from './LiveMap';
import { RouteMap } from './RouteMap';

/** Web build of the tracking map: the same map page, in an iframe. */
export function LiveMap({ pickup, dropoff, rider, route, pickupLabel, dropoffLabel, progress, height = 260 }: LiveMapProps) {
  const { colors, scheme } = useTheme();
  const frame = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  // Served to the frame from a blob address: the map's background workers don't start in a frame written inline (srcdoc).
  const src = useMemo(() => URL.createObjectURL(new Blob([mapHtml({ pickup, dropoff, rider, route }, { dark: scheme === 'dark', primary: colors.primary, pickupLabel, dropoffLabel })], { type: 'text/html' })), [scheme]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return;
      try {
        const m = JSON.parse(e.data) as { type?: string };
        if (m.type === 'ready') setStatus('ready');
        if (m.type === 'error') setStatus('failed');
      } catch {
        // not one of ours
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  useEffect(() => {
    if (status === 'ready') frame.current?.contentWindow?.postMessage({ type: 'vendo-map', state: { rider: rider ?? null, route: route ?? null } }, '*');
  }, [status, rider?.lat, rider?.lng, route]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'failed') return <RouteMap pickupLabel={pickupLabel} dropoffLabel={dropoffLabel} progress={progress} height={height} />;
  return (
    <View style={[styles.wrap, { height, backgroundColor: colors.surfaceAlt }]}>
      {createElement('iframe', { ref: frame, src, title: `Map of the route from ${pickupLabel} to ${dropoffLabel}`, style: { border: 0, width: '100%', height: '100%' } })}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { borderRadius: radius.xl, overflow: 'hidden' } });
