import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useApp } from '@/providers/AppProvider';

function TabIcon({ name, color }: { name: string; color: string }) {
  const iconColor = String(color);
  const s = 24;
  const strokeProps = { stroke: iconColor, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24">
      {name === 'letters' && (
        <>
          <Path d="M4 6.5 C4 5 5 4 6.5 4 H17.5 C19 4 20 5 20 6.5 V15 C20 16.5 19 17.5 17.5 17.5 H6.5 C5 17.5 4 16.5 4 15 Z" {...strokeProps} />
          <Path d="M4.5 6 L12 12 L19.5 6" {...strokeProps} />
        </>
      )}
      {name === 'companion' && (
        <>
          <Path d="M12 21 C7 21 4.5 17 5.5 12.5 C6.3 9 9 7 12 7 C15 7 17.7 9 18.5 12.5 C19.5 17 17 21 12 21 Z" {...strokeProps} />
          <Path d="M12 7 Q11 4 12 2" {...strokeProps} />
          <Path d="M12 5 Q8.5 3.5 7 5 Q9 7.5 12 6.5 Z" {...strokeProps} />
          <Path d="M12 5 Q15.5 3.5 17 5 Q15 7.5 12 6.5 Z" {...strokeProps} />
          <Circle cx="9.5" cy="13" r="0.6" fill={color} />
          <Circle cx="14.5" cy="13" r="0.6" fill={color} />
        </>
      )}
      {name === 'moods' && (
        <>
          <Circle cx="12" cy="12" r="8.5" {...strokeProps} />
          <Path d="M8.5 14 Q12 17 15.5 14" {...strokeProps} />
          <Circle cx="9" cy="10" r="0.6" fill={color} />
          <Circle cx="15" cy="10" r="0.6" fill={color} />
        </>
      )}
      {name === 'settings' && (
        <>
          <Circle cx="12" cy="12" r="3" {...strokeProps} />
          <Path d="M12 3.5 V6 M12 18 V20.5 M3.5 12 H6 M18 12 H20.5 M6 6 L7.8 7.8 M16.2 16.2 L18 18 M18 6 L16.2 7.8 M7.8 16.2 L6 18" {...strokeProps} />
        </>
      )}
    </Svg>
  );
}

export default function TabsLayout() {
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.inkFaint,
        tabBarStyle: {
          backgroundColor: theme.mode === 'moonlit' ? theme.bgDeep : theme.surface,
          borderTopColor: theme.line,
          height: 84 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Letters', tabBarIcon: ({ color }) => <TabIcon name="letters" color={String(color)} /> }}
      />
      <Tabs.Screen
        name="companion"
        options={{ title: 'Lumi', tabBarIcon: ({ color }) => <TabIcon name="companion" color={String(color)} /> }}
      />
      <Tabs.Screen
        name="moods"
        options={{ title: 'Us', tabBarIcon: ({ color }) => <TabIcon name="moods" color={String(color)} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ color }) => <TabIcon name="settings" color={String(color)} /> }}
      />
    </Tabs>
  );
}
