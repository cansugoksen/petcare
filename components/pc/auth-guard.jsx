import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PetCareTheme } from '@/constants/petcare-theme';
import { useAuth } from '@/providers/auth-provider';

export function AuthGate({ children }) {
  const { initializing, error, user } = useAuth();

  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PetCareTheme.colors.primary} />
        <Text style={styles.text}>Anonim giriş hazırlanıyor...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Giriş hatası: {error.message}</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Kullanıcı oturumu başlatılamadı.</Text>
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
