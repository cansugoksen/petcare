import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AppProviders } from '@/providers/app-providers';

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="pets/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pets/[petId]" />
        <Stack.Screen name="pets/[petId]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pets/[petId]/reminders/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pets/[petId]/reminders/[reminderId]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pets/[petId]/weights/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pets/[petId]/logs/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="social/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="dev/push-test" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="dark" />
    </AppProviders>
  );
}
