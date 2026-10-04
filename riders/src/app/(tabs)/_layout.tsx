import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';

import { TabBar } from '@/components/TabBar';

/** The hidden <TabList> declares the routes; <TabBar> is the bar riders see. */
export default function TabsLayout() {
  return (
    <Tabs style={{ flex: 1 }}>
      <TabSlot style={{ flex: 1 }} />
      <TabList style={{ display: 'none' }}>
        <TabTrigger name="home" href="/" />
        <TabTrigger name="trips" href="/trips" />
        <TabTrigger name="earnings" href="/earnings" />
        <TabTrigger name="profile" href="/profile" />
      </TabList>
      <TabBar />
    </Tabs>
  );
}
