import { useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, Text, View } from 'react-native';
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
      Alert.alert('GÃ¶rsel seÃ§ilemedi', err.message);
    }
  };

  const runPetUploadTest = async () => {
    if (!selectedAsset?.uri) {
      Alert.alert('Ã–nce gÃ¶rsel seÃ§in', 'Test iÃ§in galeriden bir gÃ¶rsel seÃ§melisiniz.');
      return;
    }

    try {
      setBusy('pet');
      setLastError('');
      const petId = `debug-${Date.now()}`;
      const result = await uploadPetPhoto({ uid: user.uid, petId, uri: selectedAsset.uri });
      setPetUploadResult({ ...result, petId, testedAt: new Date().toISOString() });
      Alert.alert('Pet upload testi baÅŸarÄ±lÄ±', 'Firebase Storage yÃ¼kleme tamamlandÄ±.');
    } catch (err) {
      setLastError(err.message || 'Bilinmeyen hata');
      Alert.alert('Pet upload testi baÅŸarÄ±sÄ±z', err.message);
    } finally {
      setBusy('');
    }
  };

  const runSocialUploadTest = async () => {
    if (!selectedAsset?.uri) {
      Alert.alert('Ã–nce gÃ¶rsel seÃ§in', 'Test iÃ§in galeriden bir gÃ¶rsel seÃ§melisiniz.');
      return;
    }

    try {
      setBusy('social');
      setLastError('');
      const result = await uploadSocialPostImage({ uid: user.uid, uri: selectedAsset.uri });
      setSocialUploadResult({ ...result, testedAt: new Date().toISOString() });
      Alert.alert('Sosyal upload testi baÅŸarÄ±lÄ±', 'Firebase Storage yÃ¼kleme tamamlandÄ±.');
    } catch (err) {
      setLastError(err.message || 'Bilinmeyen hata');
      Alert.alert('Sosyal upload testi baÅŸarÄ±sÄ±z', err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <Screen
      title="Storage Health Check"
      subtitle="Bucket ve upload akÄ±ÅŸÄ±nÄ± hÄ±zlÄ±ca doÄŸrulayÄ±n"
      right={<Button title="Kapat" variant="secondary" onPress={() => router.back()} />}>
      <ScrollView contentContainerStyle={{ gap: 12 }} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={{ fontWeight: '700' }}>Firebase Storage TanÄ±sÄ±</Text>
          <Text>UID: {user?.uid || '-'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label={`${bucketList.length} bucket adayÄ±`} />
            <Chip label={selectedAsset ? 'GÃ¶rsel seÃ§ili' : 'GÃ¶rsel seÃ§ilmedi'} tone={selectedAsset ? 'primary' : 'warning'} />
          </View>
          <FlatList
            data={bucketList}
            keyExtractor={(bucket) => bucket}
            renderItem={({ item: bucket }) => (
              <Text selectable>
                â€¢ {bucket}
              </Text>
            )}
            scrollEnabled={false}
            removeClippedSubviews
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        </Card>

        <Card>
          <Text style={{ fontWeight: '700' }}>Test GÃ¶rseli</Text>
          <Text numberOfLines={2} selectable>
            URI: {selectedAsset?.uri || '-'}
          </Text>
          <Button title="Galeriden GÃ¶rsel SeÃ§" onPress={handlePick} />
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

