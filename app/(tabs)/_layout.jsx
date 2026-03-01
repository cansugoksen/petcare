import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PetCareTheme } from '@/constants/petcare-theme';
import { useAuth } from '@/providers/auth-provider';

export default function TabLayout() {
  const { user, initializing } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!initializing && !user?.uid) {
      router.replace('/auth');
    }
  }, [initializing, user?.uid]);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: PetCareTheme.colors.primary,
          tabBarInactiveTintColor: PetCareTheme.colors.textMuted,
          tabBarStyle: {
            borderTopColor: PetCareTheme.colors.border,
            borderTopWidth: 1,
            backgroundColor: 'rgba(255,255,255,0.98)',
            height: 68 + Math.max(insets.bottom - 2, 0),
            paddingTop: 6,
            paddingBottom: Math.max(8, insets.bottom + 2),
            marginHorizontal: 12,
            marginBottom: 10,
            borderRadius: 18,
            position: 'absolute',
            shadowColor: '#112B3A',
            shadowOpacity: 0.08,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
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
      </Tabs>

      <Pressable
        onPress={() => router.push('/settings-drawer')}
        style={({ pressed }) => [
          styles.settingsLauncher,
          { bottom: 88 + Math.max(insets.bottom, 0) },
          pressed && { opacity: 0.88 },
        ]}>
        <MaterialIcons name="menu" size={18} color="#1E8E7E" />
        <Text style={styles.settingsLauncherText}>Menu</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  settingsLauncher: {
    position: 'absolute',
    left: 12,
    minWidth: 72,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CDE4DE',
    backgroundColor: '#F0FBF8',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    shadowColor: '#113344',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  settingsLauncherText: {
    color: '#1E8E7E',
    fontSize: 12,
    fontWeight: '700',
  },
});
