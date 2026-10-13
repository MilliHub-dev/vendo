import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { glassBarSpace, TabBar } from '@/components/TabBar';
import { TabBarSpace } from '@/components/ui';

/**
 * Tabs: Home · Send · Orders · Profile. The cart is not a tab — it's the raised button
 * in the bar that opens /cart on top.
 * The hidden <TabList> declares the routes; <TabBar> is the bar people actually see.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    // flex: 1 on both keeps the bar pinned to the bottom while screen content scrolls above it
    <Tabs style={{ flex: 1 }}>
      {/* with the floating glass bar (iOS 26+), screens scroll under it and leave room at the bottom */}
      <TabBarSpace.Provider value={glassBarSpace(insets.bottom)}>
        <TabSlot style={{ flex: 1 }} />
      </TabBarSpace.Provider>
      <TabList style={{ display: 'none' }}>
        <TabTrigger name="home" href="/" />
        <TabTrigger name="send" href="/send" />
        <TabTrigger name="orders" href="/orders" />
        <TabTrigger name="profile" href="/profile" />
      </TabList>
      <TabBar />
    </Tabs>
  );
}
