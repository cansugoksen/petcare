import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { PetCareTheme } from '@/constants/petcare-theme';
import { useAuth } from '@/providers/auth-provider';

export function AuthGate({ children }) {
  const { initializing, error, user } = useAuth();

  useEffect(() => {
    if (!initializing && !user) {
      router.replace('/auth');
    }
  }, [initializing, user]);

  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PetCareTheme.colors.primary} />
        <Text style={styles.text}>Oturum kontrol ediliyor...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Giris hatasi: {error.message}</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PetCareTheme.colors.primary} />
        <Text style={styles.text}>Giris ekranina yonlendiriliyor...</Text>
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: PetCareTheme.colors.bg,
    gap: 10,
  },
  text: {
    color: PetCareTheme.colors.textMuted,
  },
  error: {
    color: PetCareTheme.colors.danger,
    textAlign: 'center',
  },
});
