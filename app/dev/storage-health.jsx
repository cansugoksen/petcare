import { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, Chip, Screen } from '@/components/pc/ui';
import { storageBucketCandidates } from '@/lib/firebase';
import { pickImageFromLibrary, uploadPetPhoto, uploadSocialPostImage } from '@/lib/media';
import { useAuth } from '@/providers/auth-provider';

export default function DevStorageHealthRoute() {
  return (
    <AuthGate>
      <DevStorageHealthScreen />
    </AuthGate>
  );
}

function DevStorageHealthScreen() {
  const { user } = useAuth();
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [petUploadResult, setPetUploadResult] = useState(null);
  const [socialUploadResult, setSocialUploadResult] = useState(null);
  const [lastError, setLastError] = useState('');
  const [busy, setBusy] = useState('');

  const bucketList = useMemo(() => storageBucketCandidates.filter(Boolean), []);

  const handlePick = async () => {
    try {
      const asset = await pickImageFromLibrary();
      if (!asset) return;
      setSelectedAsset(asset);
      setLastError('');
    } catch (err) {
      Alert.alert('Görsel seçilemedi', err.message);
    }
  };

  const runPetUploadTest = async () => {
    if (!selectedAsset?.uri) {
      Alert.alert('Önce görsel seçin', 'Test için galeriden bir görsel seçmelisiniz.');
      return;
    }

    try {
      setBusy('pet');
      setLastError('');
      const petId = `debug-${Date.now()}`;
      const result = await uploadPetPhoto({ uid: user.uid, petId, uri: selectedAsset.uri });
      setPetUploadResult({ ...result, petId, testedAt: new Date().toISOString() });
      Alert.alert('Pet upload testi başarılı', 'Firebase Storage yükleme tamamlandı.');
    } catch (err) {
      setLastError(err.message || 'Bilinmeyen hata');
      Alert.alert('Pet upload testi başarısız', err.message);
    } finally {
      setBusy('');
    }
  };

  const runSocialUploadTest = async () => {
    if (!selectedAsset?.uri) {
      Alert.alert('Önce görsel seçin', 'Test için galeriden bir görsel seçmelisiniz.');
      return;
    }

    try {
      setBusy('social');
      setLastError('');
      const result = await uploadSocialPostImage({ uid: user.uid, uri: selectedAsset.uri });
      setSocialUploadResult({ ...result, testedAt: new Date().toISOString() });
      Alert.alert('Sosyal upload testi başarılı', 'Firebase Storage yükleme tamamlandı.');
    } catch (err) {
      setLastError(err.message || 'Bilinmeyen hata');
      Alert.alert('Sosyal upload testi başarısız', err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <Screen
      title="Storage Health Check"
      subtitle="Bucket ve upload akışını hızlıca doğrulayın"
      right={<Button title="Kapat" variant="secondary" onPress={() => router.back()} />}>
      <ScrollView contentContainerStyle={{ gap: 12 }} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={{ fontWeight: '700' }}>Firebase Storage Tanısı</Text>
          <Text>UID: {user?.uid || '-'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label={`${bucketList.length} bucket adayı`} />
            <Chip label={selectedAsset ? 'Görsel seçili' : 'Görsel seçilmedi'} tone={selectedAsset ? 'primary' : 'warning'} />
          </View>
          {bucketList.map((bucket) => (
            <Text key={bucket} selectable>
              • {bucket}
            </Text>
          ))}
        </Card>

        <Card>
          <Text style={{ fontWeight: '700' }}>Test Görseli</Text>
          <Text numberOfLines={2} selectable>
            URI: {selectedAsset?.uri || '-'}
          </Text>
          <Button title="Galeriden Görsel Seç" onPress={handlePick} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title={busy === 'pet' ? 'Test ediliyor...' : 'Pet Upload Testi'}
              onPress={runPetUploadTest}
              loading={busy === 'pet'}
              disabled={!!busy}
              style={{ flex: 1 }}
            />
            <Button
              title={busy === 'social' ? 'Test ediliyor...' : 'Sosyal Upload Testi'}
              variant="secondary"
              onPress={runSocialUploadTest}
              loading={busy === 'social'}
              disabled={!!busy}
              style={{ flex: 1 }}
            />
          </View>
        </Card>

        {petUploadResult ? (
          <Card>
            <Text style={{ fontWeight: '700' }}>Pet Upload Sonucu</Text>
            <Text selectable numberOfLines={3}>Path: {petUploadResult.photoPath || '-'}</Text>
            <Text selectable numberOfLines={3}>URL: {petUploadResult.photoUrl || '-'}</Text>
            <Text>Debug petId: {petUploadResult.petId}</Text>
          </Card>
        ) : null}

        {socialUploadResult ? (
          <Card>
            <Text style={{ fontWeight: '700' }}>Sosyal Upload Sonucu</Text>
            <Text selectable numberOfLines={3}>Path: {socialUploadResult.photoPath || '-'}</Text>
            <Text selectable numberOfLines={3}>URL: {socialUploadResult.photoUrl || '-'}</Text>
          </Card>
        ) : null}

        {lastError ? (
          <Card style={{ borderColor: '#F2D0D5', backgroundColor: '#FFF5F6' }}>
            <Text style={{ fontWeight: '700', color: '#B63745' }}>Son Hata</Text>
            <Text selectable style={{ color: '#B63745' }}>
              {lastError}
            </Text>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
