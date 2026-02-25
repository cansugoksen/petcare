import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, ErrorText, Field, Screen } from '@/components/pc/ui';
import { PetCareTheme } from '@/constants/petcare-theme';
import { pickImageFromLibrary } from '@/lib/media';
import { useAuth } from '@/providers/auth-provider';

export default function NewSocialPostRoute() {
  return (
    <AuthGate>
      <NewSocialPostScreen />
    </AuthGate>
  );
}

function NewSocialPostScreen() {
  const { user } = useAuth();
  const [imageUri, setImageUri] = useState('');
  const [caption, setCaption] = useState('');
  const [petName, setPetName] = useState('');
  const [error, setError] = useState('');

  const closeScreen = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/social');
  };

  const handlePickImage = async () => {
    try {
      const asset = await pickImageFromLibrary();
      if (!asset) {
        return;
      }
      setImageUri(asset.uri);
    } catch (err) {
      Alert.alert('Fotoğraf seçilemedi', err.message);
    }
  };

  const handleSubmit = async () => {
    if (!imageUri) {
      setError('Paylaşım için fotoğraf seçmelisiniz.');
      return;
    }

    const ownerNamePreview = user?.displayName || `Kullanıcı ${String(user?.uid || '').slice(0, 6)}`;

    setError(
      `Sosyal fotoğraf paylaşımı geçici olarak bakımda. Gönderi sahibi adı hazır: ${ownerNamePreview}. Firebase Storage düzelince paylaşım akışı yeniden açılacak.`
    );
  };

  const ownerLabel =
    user?.displayName || (user?.isAnonymous ? 'Anonim Kullanıcı' : user?.email || 'PetCare Kullanıcısı');

  const ownerBadgeText = (user?.displayName || user?.email || 'P').slice(0, 1).toUpperCase();

  return (
    <Screen title="Paylaşım Oluştur" subtitle="Pet fotoğrafını sosyal alanda paylaş" scroll>
      <Card>
        <Text style={styles.label}>Fotoğraf</Text>
        <Pressable onPress={handlePickImage} style={styles.imagePickerBox}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" />
          ) : (
            <View style={styles.placeholderWrap}>
              <Text style={styles.placeholderTitle}>Fotoğraf seç</Text>
              <Text style={styles.placeholderText}>Pet paylaşımınız için bir görsel seçin</Text>
            </View>
          )}
        </Pressable>
        <Button title="Galeriden Seç" variant="secondary" onPress={handlePickImage} />
      </Card>

      <Card>
        <View style={styles.ownerPreviewRow}>
          <View style={styles.ownerPreviewBadge}>
            <Text style={styles.ownerPreviewBadgeText}>{ownerBadgeText}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ownerPreviewTitle}>Paylaşım sahibi</Text>
            <Text style={styles.ownerPreviewValue}>{ownerLabel}</Text>
          </View>
        </View>

        <Field
          label="Pet adı (opsiyonel)"
          value={petName}
          onChangeText={setPetName}
          placeholder="Örn. Minnoş"
          autoCapitalize="words"
        />
        <Field
          label="Açıklama"
          value={caption}
          onChangeText={setCaption}
          placeholder="Paylaşımınız hakkında kısa bir not..."
          multiline
          autoCapitalize="sentences"
        />
        <ErrorText>{error}</ErrorText>
        <Text style={styles.helperNotice}>
          Not: Sosyal paylaşımlar için görsel yükleme geçici olarak kapalı. Profil fotoğrafları çalışmaya devam eder.
        </Text>
        <View style={styles.footerRow}>
          <Button title="İptal" variant="secondary" onPress={closeScreen} style={{ flex: 1 }} />
          <Button title="Paylaş" onPress={handleSubmit} style={{ flex: 1 }} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  imagePickerBox: {
    minHeight: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PetCareTheme.colors.border,
    backgroundColor: PetCareTheme.colors.surfaceAlt,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 220,
  },
  placeholderWrap: {
    alignItems: 'center',
    padding: 20,
    gap: 6,
  },
  placeholderTitle: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
  },
  placeholderText: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  ownerPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  ownerPreviewBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#EAF4FD',
    borderWidth: 1,
    borderColor: '#D7E8F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerPreviewBadgeText: {
    color: '#2C5E86',
    fontWeight: '700',
    fontSize: 14,
  },
  ownerPreviewTitle: {
    color: '#6F8EA6',
    fontSize: 11,
    fontWeight: '600',
  },
  ownerPreviewValue: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  helperNotice: {
    color: '#7A95AB',
    fontSize: 12,
    lineHeight: 17,
  },
});

