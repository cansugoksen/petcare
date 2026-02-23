import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';

import { PetCareTheme } from '@/constants/petcare-theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PetCareTheme.colors.primary,
        tabBarInactiveTintColor: PetCareTheme.colors.textMuted,
        tabBarStyle: {
          borderTopColor: PetCareTheme.colors.border,
          backgroundColor: '#fff',
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="home-filled" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="pets"
        options={{
          title: 'Petler',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="pets" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Sosyal',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="photo-library" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ayarlar',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="settings" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
