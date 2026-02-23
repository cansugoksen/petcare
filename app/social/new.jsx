import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, ErrorText, Field, Screen } from '@/components/pc/ui';
import { PetCareTheme } from '@/constants/petcare-theme';
import { pickImageFromLibrary, uploadSocialPostImage } from '@/lib/media';
import { createSocialPost } from '@/lib/petcare-db';
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
  const [saving, setSaving] = useState(false);
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
      Alert.alert('Fotograf secilemedi', err.message);
    }
  };

  const handleSubmit = async () => {
    if (!imageUri) {
      setError('Paylasim icin fotograf secmelisiniz.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const uploaded = await uploadSocialPostImage({
        uid: user.uid,
        uri: imageUri,
      });

      await createSocialPost(user.uid, {
        ownerName: `Kullanici ${String(user.uid || '').slice(0, 6)}`,
        petName: petName.trim() || null,
        imageUrl: uploaded.photoUrl,
        imagePath: uploaded.photoPath,
        caption: caption.trim(),
      });

      closeScreen();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Paylasim Olustur" subtitle="Pet fotografini sosyal alanda paylas" scroll>
      <Card>
        <Text style={styles.label}>Fotograf</Text>
        <Pressable onPress={handlePickImage} style={styles.imagePickerBox}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" />
          ) : (
            <View style={styles.placeholderWrap}>
              <Text style={styles.placeholderTitle}>Fotograf sec</Text>
              <Text style={styles.placeholderText}>Pet paylasiminiz icin bir gorsel secin</Text>
            </View>
          )}
        </Pressable>
        <Button title="Galeriden Sec" variant="secondary" onPress={handlePickImage} />
      </Card>

      <Card>
        <Field
          label="Pet adi (opsiyonel)"
          value={petName}
          onChangeText={setPetName}
          placeholder="Orn. Minnos"
          autoCapitalize="words"
        />
        <Field
          label="Aciklama"
          value={caption}
          onChangeText={setCaption}
          placeholder="Paylasiminiz hakkinda kisa bir not..."
          multiline
          autoCapitalize="sentences"
        />
        <ErrorText>{error}</ErrorText>
        <View style={styles.footerRow}>
          <Button title="Iptal" variant="secondary" onPress={closeScreen} style={{ flex: 1 }} />
          <Button title="Paylas" onPress={handleSubmit} loading={saving} style={{ flex: 1 }} />
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
  footerRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
