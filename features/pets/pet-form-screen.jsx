import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import DateTimePicker from '@/components/pc/date-time-picker';
import { Button, Card, ErrorText, Field, Label, Screen } from '@/components/pc/ui';
import { petSpeciesOptions, PetCareTheme } from '@/constants/petcare-theme';
import { formatDateOnly, parseInputDateTime, toDate } from '@/lib/date-utils';
import { pickImageFromLibrary, uploadPetPhoto } from '@/lib/media';
import { createPet, getPet, updatePet } from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

function toBirthDateInput(value) {
  const date = toDate(value);
  if (!date) {
    return '';
  }

  const pad = (n) => `${n}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseBirthDate(value) {
  const text = value.trim();
  if (!text) {
    return null;
  }

  return parseInputDateTime(`${text} 00:00`);
}

function isLocalImageUri(uri) {
  return typeof uri === 'string' && (uri.startsWith('file:') || uri.startsWith('content:'));
}

export function PetFormScreen({ mode = 'create', petId }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('dog');
  const [birthDateInput, setBirthDateInput] = useState('');
  const [currentWeightInput, setCurrentWeightInput] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPath, setPhotoPath] = useState('');
  const [localPhotoUri, setLocalPhotoUri] = useState('');
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);

  const closeForm = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/pets');
  };

  useEffect(() => {
    if (mode !== 'edit' || !petId || !user?.uid) {
      setLoading(false);
      return;
    }

    let mounted = true;

    getPet(user.uid, petId)
      .then((pet) => {
        if (!mounted) {
          return;
        }

        if (!pet) {
          setError('Pet bulunamadi.');
          return;
        }

        setName(pet.name || '');
        setSpecies(pet.species || 'dog');
        setBirthDateInput(toBirthDateInput(pet.birthDate));
        setCurrentWeightInput(pet.currentWeight ? String(pet.currentWeight) : '');
        setPhotoUrl(pet.photoUrl || '');
        setPhotoPath(pet.photoPath || '');
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [mode, petId, user?.uid]);

  const handlePickPhoto = async () => {
    try {
      const asset = await pickImageFromLibrary();
      if (!asset) {
        return;
      }
      setLocalPhotoUri(asset.uri);
      setPhotoUrl(asset.uri);
    } catch (err) {
      Alert.alert('Fotograf secilemedi', err.message);
    }
  };

  const handleBirthDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowBirthDatePicker(false);
    }

    if (event?.type === 'dismissed' || !selectedDate) {
      return;
    }

    setBirthDateInput(toBirthDateInput(selectedDate));
  };

  const validate = () => {
    if (!name.trim()) {
      return 'Pet adi zorunludur.';
    }

    if (!petSpeciesOptions.some((option) => option.key === species)) {
      return 'Tur secimi gecersiz.';
    }

    if (birthDateInput.trim() && !parseBirthDate(birthDateInput)) {
      return 'Dogum tarihi formati YYYY-AA-GG olmalidir.';
    }

    if (currentWeightInput.trim()) {
      const n = Number(currentWeightInput.replace(',', '.'));
      if (Number.isNaN(n) || n <= 0) {
        return 'Kilo alani pozitif sayi olmalidir.';
      }
    }

    return '';
  };

  const handleSubmit = async () => {
    const validationError = validate();
    setError(validationError);
    if (validationError) {
      return;
    }

    try {
      setSaving(true);

      const persistedPhotoUrl =
        mode === 'edit' && !localPhotoUri && photoUrl
          ? photoUrl
          : mode === 'edit' && !isLocalImageUri(photoUrl)
            ? photoUrl
            : null;

      const payload = {
        name: name.trim(),
        species,
        birthDate: parseBirthDate(birthDateInput),
        currentWeight: currentWeightInput.trim()
          ? Number(currentWeightInput.replace(',', '.'))
          : null,
        photoUrl: mode === 'edit' ? persistedPhotoUrl : null,
        photoPath: mode === 'edit' ? photoPath || null : null,
      };

      let targetPetId = petId;
      if (mode === 'create') {
        targetPetId = await createPet(user.uid, payload);
      } else {
        await updatePet(user.uid, petId, payload);
      }

      let photoUploadWarning = '';

      if (localPhotoUri) {
        try {
          const uploaded = await uploadPetPhoto({
            uid: user.uid,
            petId: targetPetId,
            uri: localPhotoUri,
          });
          setPhotoPath(uploaded.photoPath);
          await updatePet(user.uid, targetPetId, uploaded);
        } catch (photoErr) {
          photoUploadWarning = photoErr.message || 'Fotograf yuklenemedi.';
        }
      }

      if (photoUploadWarning) {
        Alert.alert(
          'Pet kaydedildi',
          `Pet kaydi olusturuldu ancak fotograf yuklenemedi.\n\n${photoUploadWarning}`
        );
      }

      closeForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      title={mode === 'create' ? 'Pet Ekle' : 'Pet Duzenle'}
      subtitle="Fotograf, temel bilgiler ve mevcut kilo kaydi"
      scroll>
      <Card>
        <Text style={styles.sectionTitle}>Fotograf</Text>
        <Pressable onPress={handlePickPhoto} style={styles.photoBox}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photo} contentFit="cover" />
          ) : (
            <Text style={styles.photoPlaceholder}>Fotograf Sec</Text>
          )}
        </Pressable>
        <Button title="Galeriden Sec" variant="secondary" onPress={handlePickPhoto} />
      </Card>

      <Card>
        <Field
          label="Pet adi"
          value={name}
          onChangeText={setName}
          placeholder="Orn. Minnos"
          autoCapitalize="words"
        />

        <View style={styles.speciesRow}>
          {petSpeciesOptions.map((option) => (
            <SpeciesButton
              key={option.key}
              label={option.label}
              selected={species === option.key}
              onPress={() => setSpecies(option.key)}
            />
          ))}
        </View>

        {Platform.OS === 'web' ? (
          <Field
            label="Dogum tarihi (opsiyonel)"
            value={birthDateInput}
            onChangeText={setBirthDateInput}
            placeholder="YYYY-AA-GG"
          />
        ) : (
          <View style={styles.birthDateFieldWrap}>
            <Label>Dogum tarihi (opsiyonel)</Label>
            <Pressable
              onPress={() => setShowBirthDatePicker(true)}
              style={({ pressed }) => [styles.datePickerTrigger, pressed && { opacity: 0.9 }]}>
              <Text style={[styles.datePickerText, !birthDateInput && styles.datePickerPlaceholder]}>
                {birthDateInput ? formatDateOnly(parseBirthDate(birthDateInput)) : 'Tarih sec'}
              </Text>
            </Pressable>
            {birthDateInput ? (
              <Button title="Tarihi Temizle" variant="secondary" onPress={() => setBirthDateInput('')} />
            ) : null}

            {showBirthDatePicker ? (
              <View style={styles.nativePickerWrap}>
                <DateTimePicker
                  value={parseBirthDate(birthDateInput) || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleBirthDateChange}
                  maximumDate={new Date()}
                  textColor={PetCareTheme.colors.text}
                />
                {Platform.OS === 'ios' ? (
                  <Button title="Kapat" variant="secondary" onPress={() => setShowBirthDatePicker(false)} />
                ) : null}
              </View>
            ) : null}
          </View>
        )}

        <Field
          label="Guncel kilo (kg, opsiyonel)"
          value={currentWeightInput}
          onChangeText={setCurrentWeightInput}
          placeholder="Orn. 6.3"
          keyboardType="decimal-pad"
        />

        <ErrorText>{error}</ErrorText>

        <View style={styles.footerRow}>
          <Button title="Iptal" variant="secondary" onPress={closeForm} style={{ flex: 1 }} />
          <Button
            title={mode === 'create' ? 'Kaydet' : 'Guncelle'}
            onPress={handleSubmit}
            loading={saving || loading}
            disabled={loading}
            style={{ flex: 1 }}
          />
        </View>
      </Card>

    </Screen>
  );
}

function SpeciesButton({ label, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.speciesButton,
        selected && styles.speciesButtonSelected,
        pressed && { opacity: 0.88 },
      ]}>
      <Text style={[styles.speciesButtonText, selected && styles.speciesButtonTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: PetCareTheme.colors.text,
  },
  photoBox: {
    width: 120,
    height: 120,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PetCareTheme.colors.border,
    backgroundColor: PetCareTheme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    color: PetCareTheme.colors.textMuted,
    fontWeight: '600',
  },
  speciesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  speciesButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PetCareTheme.colors.border,
    backgroundColor: '#fff',
  },
  speciesButtonSelected: {
    borderColor: PetCareTheme.colors.primary,
    backgroundColor: PetCareTheme.colors.primarySoft,
  },
  speciesButtonText: {
    color: PetCareTheme.colors.text,
    fontWeight: '600',
  },
  speciesButtonTextSelected: {
    color: PetCareTheme.colors.primary,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  birthDateFieldWrap: {
    gap: 6,
  },
  datePickerTrigger: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PetCareTheme.colors.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  datePickerText: {
    color: PetCareTheme.colors.text,
    fontSize: 14,
  },
  datePickerPlaceholder: {
    color: PetCareTheme.colors.textMuted,
  },
  nativePickerWrap: {
    gap: 8,
  },
});
