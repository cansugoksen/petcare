import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';

import DateTimePicker from '@/components/pc/date-time-picker';
import { Button, Card, ErrorText, Field, Label, Screen } from '@/components/pc/ui';
import { petGenderOptions, petSpeciesOptions, PetCareTheme } from '@/constants/petcare-theme';
import { formatDateOnly, parseInputDateTime, toDate } from '@/lib/date-utils';
import { pickImageFromCamera, pickImageFromLibrary, uploadPetPhoto } from '@/lib/media';
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
  const [breed, setBreed] = useState('');
  const [gender, setGender] = useState('unknown');
  const [birthDateInput, setBirthDateInput] = useState('');
  const [birthDateDraft, setBirthDateDraft] = useState(null);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [currentWeightInput, setCurrentWeightInput] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPath, setPhotoPath] = useState('');
  const [localPhotoUri, setLocalPhotoUri] = useState('');
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const speciesLabel = petSpeciesOptions.find((option) => option.key === species)?.label || 'Pet';
  const genderLabel = petGenderOptions.find((option) => option.key === gender)?.label || 'Bilinmiyor';

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
          setError('Pet bulunamadı.');
          return;
        }

        setName(pet.name || '');
        setSpecies(pet.species || 'dog');
        setBreed(pet.breed || '');
        setGender(pet.gender || 'unknown');
        setBirthDateInput(toBirthDateInput(pet.birthDate));
        setCurrentWeightInput(pet.currentWeight ? String(pet.currentWeight) : '');
        setPhotoUrl(pet.photoUrl || pet.photoLocalUri || '');
        setPhotoPath(pet.photoPath || pet.photoLocalPath || '');
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
      Alert.alert('Fotoğraf seçilemedi', err.message);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const asset = await pickImageFromCamera();
      if (!asset) {
        return;
      }
      setLocalPhotoUri(asset.uri);
      setPhotoUrl(asset.uri);
    } catch (err) {
      Alert.alert('Kamera açılamadı', err.message);
    }
  };

  const handleBirthDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowBirthDatePicker(false);
    }

    if (event?.type === 'dismissed' || !selectedDate) {
      return;
    }

    if (Platform.OS === 'ios') {
      setBirthDateDraft(selectedDate);
      return;
    }

    setBirthDateInput(toBirthDateInput(selectedDate));
  };

  const openBirthDatePicker = () => {
    setBirthDateDraft(parseBirthDate(birthDateInput) || new Date());
    setShowBirthDatePicker(true);
  };

  const cancelBirthDatePicker = () => {
    setBirthDateDraft(null);
    setShowBirthDatePicker(false);
  };

  const confirmBirthDatePicker = () => {
    const selected = birthDateDraft || parseBirthDate(birthDateInput) || new Date();
    setBirthDateInput(toBirthDateInput(selected));
    setBirthDateDraft(null);
    setShowBirthDatePicker(false);
  };

  const validate = () => {
    if (!name.trim()) {
      return 'Pet adı zorunludur.';
    }

    if (!petSpeciesOptions.some((option) => option.key === species)) {
      return 'Tür seçimi geçersiz.';
    }

    if (!petGenderOptions.some((option) => option.key === gender)) {
      return 'Cinsiyet seçimi geçersiz.';
    }

    if (birthDateInput.trim() && !parseBirthDate(birthDateInput)) {
      return 'Doğum tarihi formatı YYYY-AA-GG olmalıdır.';
    }

    if (currentWeightInput.trim()) {
      const n = Number(currentWeightInput.replace(',', '.'));
      if (Number.isNaN(n) || n <= 0) {
        return 'Kilo alanı pozitif sayı olmalıdır.';
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
        breed: breed.trim() || null,
        gender,
        birthDate: parseBirthDate(birthDateInput),
        currentWeight: currentWeightInput.trim() ? Number(currentWeightInput.replace(',', '.')) : null,
        photoUrl: mode === 'edit' ? persistedPhotoUrl : null,
        photoPath: mode === 'edit' ? photoPath || null : null,
        photoLocalUri: null,
        photoLocalPath: null,
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
          setPhotoPath(uploaded.photoPath || '');
          setPhotoUrl(uploaded.photoUrl || '');
          await updatePet(user.uid, targetPetId, {
            photoUrl: uploaded.photoUrl || null,
            photoPath: uploaded.photoPath || null,
            photoLocalUri: null,
            photoLocalPath: null,
          });
        } catch (photoErr) {
          photoUploadWarning = photoErr.message || 'Fotoğraf cloud depoya yüklenemedi.';
        }
      }

      if (photoUploadWarning) {
        Alert.alert('Pet kaydedildi', `Pet kaydı oluşturuldu ancak fotoğraf yüklemesi başarısız.\n\n${photoUploadWarning}`);
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
      title={mode === 'create' ? 'Pet Ekle' : 'Pet Düzenle'}
      subtitle={mode === 'create' ? 'Fotoğraf, temel bilgiler ve mevcut kilo kaydı' : 'Profil bilgilerini güncelleyin'}
      scroll>
      <Card style={styles.heroCard}>
        <View style={styles.heroGlowBlue} />
        <View style={styles.heroGlowMint} />
        <View style={styles.heroRow}>
          <View style={styles.heroIconWrap}>
            <MaterialIcons name="pets" size={18} color="#4E7FA6" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroModeChip}>
                <Text style={styles.heroModeChipText}>{mode === 'create' ? 'Yeni profil' : 'Düzenleme'}</Text>
              </View>
              <View style={styles.heroMetaDot}>
                <MaterialIcons name="auto-awesome" size={12} color="#5C87AA" />
              </View>
            </View>
            <Text style={styles.heroTitle}>{mode === 'create' ? 'Profil oluşturun' : 'Profili düzenleyin'}</Text>
            <Text style={styles.heroText}>
              Tür, cinsiyet ve sağlık başlangıç bilgileri hatırlatma deneyimini daha düzenli hale getirir.
            </Text>
          </View>
        </View>
        <View style={styles.heroStatsRow}>
          <MiniInfoChip label={speciesLabel} tone="blue" />
          <MiniInfoChip label={genderLabel} tone="green" />
          <MiniInfoChip label={photoUrl ? 'Fotoğraf hazır' : 'Fotoğraf opsiyonel'} />
          <MiniInfoChip label={birthDateInput ? 'Doğum tarihi var' : 'Doğum tarihi opsiyonel'} />
        </View>
      </Card>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <MaterialIcons name="photo-camera" size={16} color="#5A83A3" />
          <Text style={styles.sectionTitle}>Fotoğraf</Text>
        </View>
        <Pressable onPress={handlePickPhoto} style={styles.photoBox}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photo} contentFit="cover" />
          ) : (
            <View style={styles.photoPlaceholderWrap}>
              <View style={styles.photoPlaceholderIconWrap}>
                <MaterialIcons name="add-a-photo" size={22} color="#5E88AB" />
              </View>
              <Text style={styles.photoPlaceholderTitle}>Fotoğraf Seç</Text>
              <Text style={styles.photoPlaceholderText}>Profil görselini galeriden seçin veya kamerayla çekin.</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.inlineRow}>
          <Button title="Galeriden Seç" variant="secondary" onPress={handlePickPhoto} style={{ flex: 1 }} />
          <Button title="Kamera ile Çek" variant="secondary" onPress={handleTakePhoto} style={{ flex: 1 }} />
        </View>
        <View style={styles.hintChipRow}>
          <MiniInfoChip label="Kare kırpma açık" />
          <MiniInfoChip label="Profilde görünür" tone="blue" />
        </View>
      </Card>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <MaterialIcons name="badge" size={16} color="#5A83A3" />
          <Text style={styles.sectionTitle}>Temel Profil</Text>
        </View>
        <Field
          label="Pet adı"
          value={name}
          onChangeText={setName}
          placeholder="Örn. Minnoş"
          autoCapitalize="words"
        />

        <View style={styles.speciesRow}>
          {petSpeciesOptions.map((option) => (
            <SpeciesButton
              key={option.key}
              speciesKey={option.key}
              label={option.label}
              selected={species === option.key}
              onPress={() => setSpecies(option.key)}
            />
          ))}
        </View>

        <Field
          label={getBreedFieldLabel(species)}
          value={breed}
          onChangeText={setBreed}
          placeholder={getBreedPlaceholder(species)}
          autoCapitalize="words"
        />
      </Card>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <MaterialIcons name="wc" size={16} color="#5A83A3" />
          <Text style={styles.sectionTitle}>Cinsiyet</Text>
        </View>
        <Text style={styles.sectionHelper}>Profil kartında ve sağlık kayıtlarında görünür.</Text>
        <View style={styles.genderBlock}>
          <Label>Cinsiyet</Label>
          <View style={styles.genderRow}>
            {petGenderOptions.map((option) => (
              <GenderButton
                key={option.key}
                genderKey={option.key}
                label={option.label}
                selected={gender === option.key}
                onPress={() => setGender(option.key)}
              />
            ))}
          </View>
        </View>
      </Card>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <MaterialIcons name="monitor-heart" size={16} color="#5A83A3" />
          <Text style={styles.sectionTitle}>Sağlık Başlangıcı</Text>
        </View>
        <Text style={styles.sectionHelper}>
          Doğum tarihi ve kilo alanları opsiyoneldir. Daha sonra pet detayından güncelleyebilirsiniz.
        </Text>
        {Platform.OS === 'web' ? (
          <Field
            label="Doğum tarihi (opsiyonel)"
            value={birthDateInput}
            onChangeText={setBirthDateInput}
            placeholder="YYYY-AA-GG"
          />
        ) : (
          <View style={styles.birthDateFieldWrap}>
            <Label>Doğum tarihi (opsiyonel)</Label>
            <View style={styles.datePickerTrigger}>
              <Text style={[styles.datePickerText, !birthDateInput && styles.datePickerPlaceholder]}>
                {birthDateInput ? formatDateOnly(parseBirthDate(birthDateInput)) : 'Tarih seçilmedi'}
              </Text>
            </View>

            <View style={styles.inlineRow}>
              <Button title="Tarih Seç" variant="secondary" onPress={openBirthDatePicker} style={{ flex: 1 }} />
              {birthDateInput ? (
                <Button
                  title="Temizle"
                  variant="secondary"
                  onPress={() => setBirthDateInput('')}
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>

            {showBirthDatePicker ? (
              <View style={styles.nativePickerWrap}>
                <DateTimePicker
                  value={birthDateDraft || parseBirthDate(birthDateInput) || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={handleBirthDateChange}
                  maximumDate={new Date()}
                  textColor={PetCareTheme.colors.text}
                  locale="tr_TR"
                  themeVariant="light"
                />
                {Platform.OS === 'ios' ? (
                  <View style={styles.pickerFooterRow}>
                    <Button title="Vazgeç" variant="secondary" onPress={cancelBirthDatePicker} style={{ flex: 1 }} />
                    <Button title="Seç" onPress={confirmBirthDatePicker} style={{ flex: 1 }} />
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        )}

        <Field
          label="Güncel kilo (kg, opsiyonel)"
          value={currentWeightInput}
          onChangeText={setCurrentWeightInput}
          placeholder="Örn. 6.3"
          keyboardType="decimal-pad"
        />
        <View style={styles.hintChipRow}>
          <MiniInfoChip label={birthDateInput ? 'Doğum tarihi eklendi' : 'Doğum tarihi boş'} tone="blue" />
          <MiniInfoChip label={currentWeightInput.trim() ? 'Kilo girildi' : 'Kilo opsiyonel'} tone="green" />
        </View>
      </Card>

      <Card style={[styles.sectionCard, styles.footerCard]}>
        <View style={styles.footerInfoRow}>
          <View style={styles.footerInfoIcon}>
            <MaterialIcons name="verified-user" size={14} color="#366A93" />
          </View>
          <Text style={styles.footerInfoText}>
            Kaydedilen bilgiler profil kartı ve hatırlatma akışında kullanılır.
          </Text>
        </View>
        <ErrorText>{error}</ErrorText>
        <View style={styles.footerRow}>
          <Button title="İptal" variant="secondary" onPress={closeForm} style={{ flex: 1 }} />
          <Button
            title={mode === 'create' ? 'Kaydet' : 'Güncelle'}
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

function getBreedFieldLabel(species) {
  if (species === 'cat') {
    return 'Kedi cinsi (opsiyonel)';
  }
  if (species === 'dog') {
    return 'Köpek cinsi (opsiyonel)';
  }
  if (species === 'bird') {
    return 'Kuş cinsi (opsiyonel)';
  }
  return 'Cins (opsiyonel)';
}

function getBreedPlaceholder(species) {
  if (species === 'cat') {
    return 'Örn. British Shorthair';
  }
  if (species === 'dog') {
    return 'Örn. Golden Retriever';
  }
  if (species === 'bird') {
    return 'Örn. Muhabbet Kuşu';
  }
  return 'Örn. Cins bilgisi';
}

function SpeciesButton({ speciesKey, label, selected, onPress }) {
  const visual = getSpeciesButtonVisual(speciesKey);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.speciesButton,
        selected && styles.speciesButtonSelected,
        pressed && { opacity: 0.88 },
      ]}>
      <View style={[styles.speciesButtonIconWrap, { backgroundColor: selected ? visual.bgActive : visual.bg }]}>
        <MaterialCommunityIcons name={visual.icon} size={16} color={selected ? visual.colorActive : visual.color} />
      </View>
      <Text style={[styles.speciesButtonText, selected && styles.speciesButtonTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function MiniInfoChip({ label, tone = 'default' }) {
  const palette =
    tone === 'blue'
      ? { bg: '#EAF4FF', border: '#D7E8FA', text: '#44759B' }
      : tone === 'green'
        ? { bg: '#ECFBF3', border: '#D7F1E3', text: '#317B61' }
        : { bg: '#F3F7FB', border: '#E2EAF2', text: '#667F95' };

  return (
    <View style={[styles.miniChip, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.miniChipText, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

function GenderButton({ genderKey, label, selected, onPress }) {
  const visual = getGenderVisual(genderKey);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.genderButton,
        selected && styles.genderButtonSelected,
        pressed && { opacity: 0.9 },
      ]}>
      <View style={[styles.genderIconBadge, { backgroundColor: selected ? visual.badgeActive : visual.badge }]}>
        <Text style={[styles.genderButtonIcon, { color: selected ? visual.colorActive : visual.color }]}>
          {visual.symbol}
        </Text>
      </View>
      <Text style={[styles.genderButtonText, selected && styles.genderButtonTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function getGenderVisual(genderKey) {
  if (genderKey === 'female') {
    return {
      symbol: '♀',
      badge: '#FCEAF1',
      badgeActive: '#F8D6E5',
      color: '#C05A88',
      colorActive: '#A93D6E',
    };
  }
  if (genderKey === 'male') {
    return {
      symbol: '♂',
      badge: '#EAF2FE',
      badgeActive: '#D6E7FD',
      color: '#4E7ECF',
      colorActive: '#2F64BC',
    };
  }
  return {
    symbol: '•',
    badge: '#EDF1F5',
    badgeActive: '#E2E8EF',
    color: '#73879A',
    colorActive: '#566C80',
  };
}

function getSpeciesButtonVisual(speciesKey) {
  if (speciesKey === 'cat') {
    return {
      icon: 'cat',
      bg: '#EEF6FF',
      bgActive: '#DDEFFF',
      color: '#4A759B',
      colorActive: '#275B84',
    };
  }
  if (speciesKey === 'bird') {
    return {
      icon: 'bird',
      bg: '#FFF7E9',
      bgActive: '#FFEBC8',
      color: '#A27628',
      colorActive: '#8D6218',
    };
  }
  return {
    icon: 'dog-side',
    bg: '#EEF9F3',
    bgActive: '#DDF5E8',
    color: '#347B63',
    colorActive: '#236A52',
  };
}

const styles = StyleSheet.create({
  heroCard: {
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D5E7F7',
    backgroundColor: '#F7FBFF',
    shadowColor: '#8CB5D8',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  heroGlowBlue: {
    position: 'absolute',
    top: -24,
    right: -14,
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: 'rgba(121, 181, 233, 0.18)',
  },
  heroGlowMint: {
    position: 'absolute',
    left: -18,
    bottom: -28,
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(116, 219, 186, 0.12)',
  },
  heroRow: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCEAF5',
    backgroundColor: '#F4FAFF',
    padding: 10,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  heroIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F4FE',
    borderWidth: 1,
    borderColor: '#D5E8FA',
  },
  heroTitle: {
    color: '#28577D',
    fontSize: 13,
    fontWeight: '700',
  },
  heroText: {
    color: '#6D8EA7',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  heroModeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D7EAF9',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  heroModeChipText: {
    color: '#4B779B',
    fontSize: 11,
    fontWeight: '700',
  },
  heroMetaDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D7EAF9',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  heroStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E1EBF4',
    backgroundColor: '#FFFFFF',
    shadowColor: '#95ACC0',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: PetCareTheme.colors.text,
  },
  sectionHelper: {
    color: '#7A96AD',
    fontSize: 12,
    lineHeight: 17,
    marginTop: -2,
  },
  photoBox: {
    width: '100%',
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PetCareTheme.colors.border,
    backgroundColor: PetCareTheme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholderWrap: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  photoPlaceholderIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF3FB',
    borderWidth: 1,
    borderColor: '#D8E7F4',
  },
  photoPlaceholderTitle: {
    color: '#476E8D',
    fontWeight: '700',
    fontSize: 13,
  },
  photoPlaceholderText: {
    color: PetCareTheme.colors.textMuted,
    fontWeight: '500',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 8,
  },
  hintChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  miniChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  miniChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  speciesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  speciesButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PetCareTheme.colors.border,
    backgroundColor: '#fff',
  },
  speciesButtonIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
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
  genderBlock: {
    gap: 6,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderButton: {
    flexDirection: 'row',
    gap: 6,
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PetCareTheme.colors.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderButtonSelected: {
    borderColor: PetCareTheme.colors.primary,
    backgroundColor: PetCareTheme.colors.primarySoft,
  },
  genderIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderButtonText: {
    color: PetCareTheme.colors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  genderButtonIcon: {
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 15,
  },
  genderButtonTextSelected: {
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
    fontWeight: '600',
  },
  datePickerPlaceholder: {
    color: PetCareTheme.colors.textMuted,
  },
  nativePickerWrap: {
    gap: 8,
  },
  pickerFooterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  footerCard: {
    gap: 8,
    borderColor: '#DCEAF7',
    backgroundColor: '#F9FCFF',
  },
  footerInfoRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCEAF7',
    backgroundColor: '#EFF7FF',
    padding: 10,
  },
  footerInfoIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E1F0FD',
  },
  footerInfoText: {
    flex: 1,
    color: '#557C9D',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
});

