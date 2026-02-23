import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, Chip, Screen } from '@/components/pc/ui';
import { formatDateTime } from '@/lib/date-utils';
import { saveDeviceToken, subscribeDeviceTokens } from '@/lib/petcare-db';
import { registerNativePushToken } from '@/lib/notifications';
import { useAuth } from '@/providers/auth-provider';

export default function DevPushTestRoute() {
  return (
    <AuthGate>
      <DevPushTestScreen />
    </AuthGate>
  );
}

function DevPushTestScreen() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    const unsub = subscribeDeviceTokens(
      user.uid,
      (rows) => {
        setTokens(rows);
        setError(null);
      },
      (err) => setError(err)
    );

    return unsub;
  }, [user?.uid]);

  const latestToken = tokens[0] || null;

  const handleRegisterToken = async () => {
    try {
      setLoading(true);
      const tokenData = await registerNativePushToken();
      await saveDeviceToken(user.uid, tokenData);
      Alert.alert('Tamam', 'Cihaz tokeni kaydedildi.');
    } catch (err) {
      Alert.alert('Push test kaydi basarisiz', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      title="Push Test (Gelistirici)"
      subtitle="Token kaydi ve push test hazirlik kontrolu"
      right={<Button title="Kapat" variant="secondary" onPress={() => router.back()} />}>
      <Card>
        <Text style={{ fontWeight: '700' }}>Cihaz Tokeni</Text>
        <Text>UID: {user?.uid || '-'}</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Chip label={tokens.length ? 'Token kayitli' : 'Token yok'} tone={tokens.length ? 'primary' : 'warning'} />
          <Chip label={`${tokens.length} kayit`} />
        </View>
        <Button
          title={loading ? 'Kaydediliyor...' : 'Cihaz Tokenini Kaydet'}
          onPress={handleRegisterToken}
          loading={loading}
          disabled={loading}
        />
      </Card>

      <Card>
        <Text style={{ fontWeight: '700' }}>Son Token Bilgisi</Text>
        <Text>Platform: {latestToken?.platform || '-'}</Text>
        <Text>Provider: {latestToken?.provider || '-'}</Text>
        <Text>Son guncelleme: {latestToken?.updatedAt ? formatDateTime(latestToken.updatedAt) : '-'}</Text>
        {latestToken?.token ? (
          <Text selectable numberOfLines={3}>
            Token: {latestToken.token}
          </Text>
        ) : null}
        {error ? <Text style={{ color: '#C73E4C' }}>Okuma hatasi: {error.message}</Text> : null}
      </Card>

      <Card>
        <Text style={{ fontWeight: '700' }}>Test Adimlari</Text>
        <Text>1. Bu ekrandan token kaydet.</Text>
        <Text>2. 2-5 dakika sonraya reminder olustur.</Text>
        <Text>3. Uygulamayi tamamen kapat.</Text>
        <Text>4. Functions + Scheduler deploy sonrasi push bekle.</Text>
      </Card>
    </Screen>
  );
}
