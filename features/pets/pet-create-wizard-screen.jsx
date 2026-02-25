import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';

import DateTimePicker from '@/components/pc/date-time-picker';
import { Button, Card, ErrorText, Field, Label, Screen } from '@/components/pc/ui';
import {
  getPetGenderLabel,
  getPetSpeciesLabel,
  petGenderOptions,
  petSpeciesOptions,
  PetCareTheme,
} from '@/constants/petcare-theme';
import { formatDateOnly, parseInputDateTime, toDate } from '@/lib/date-utils';
import { pickImageFromCamera, pickImageFromLibrary, savePetPhotoLocal } from '@/lib/media';
import { createPet, updatePet } from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

const WIZARD_STEPS = [
  { key: 'species', title: 'Tür Seçimi', icon: 'pets' },
  { key: 'name', title: 'İsim', icon: 'drive-file-rename-outline' },
  { key: 'breed', title: 'Cins', icon: 'category' },
  { key: 'gender', title: 'Cinsiyet', icon: 'wc' },
  { key: 'dates', title: 'Tarihler', icon: 'event' },
  { key: 'photo', title: 'Fotoğraf', icon: 'photo-camera' },
  { key: 'summary', title: 'Özet', icon: 'fact-check' },
];

const SPECIES_PICKER_CARDS = [
  { key: 'cat', label: 'Kedi' },
  { key: 'dog', label: 'Köpek' },
  { key: 'bird', label: 'Kuş' },
  { key: 'other', label: 'Diğer', disabled: true },
];

const BREED_PRESETS = {
  cat: [
    'Tekir',
    'British Shorthair',
    'Scottish Fold',
    'Van Kedisi',
    'Sarman',
    'Persian',
    'Siyam',
    'Maine Coon',
    'Bengal',
    'Ragdoll',
  ],
  dog: [
    'Golden Retriever',
    'Labrador',
    'Poodle',
    'Husky',
    'Pomeranian',
    'Kangal',
    'French Bulldog',
    'German Shepherd',
    'Cocker Spaniel',
    'Beagle',
  ],
  bird: [
    'Muhabbet Kuşu',
    'Kanarya',
    'Sultan Papağanı',
    'Jako',
    'Lovebird',
    'Hint Bülbülü',
    'Forpus',
    'Conure',
    'Papağan',
    'İskete',
  ],
};

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

export function PetCreateWizardScreen() {
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('dog');
  const [breed, setBreed] = useState('');
  const [breedSelection, setBreedSelection] = useState('');
  const [customBreedInput, setCustomBreedInput] = useState('');
  const [gender, setGender] = useState('unknown');
  const [birthDateInput, setBirthDateInput] = useState('');
  const [birthDateDraft, setBirthDateDraft] = useState(null);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [adoptionDateInput, setAdoptionDateInput] = useState('');
  const [adoptionDateDraft, setAdoptionDateDraft] = useState(null);
  const [showAdoptionDatePicker, setShowAdoptionDatePicker] = useState(false);
  const [currentWeightInput, setCurrentWeightInput] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [localPhotoUri, setLocalPhotoUri] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState(null);
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTranslateY = useRef(new Animated.Value(0)).current;

  const step = WIZARD_STEPS[stepIndex];
  const totalSteps = WIZARD_STEPS.length;
  const progress = (stepIndex + 1) / totalSteps;
  const resolvedBreed = breedSelection === 'other' ? customBreedInput.trim() : breedSelection || breed.trim();

  const summaryRows = useMemo(
    () => [
      ['Tür', getPetSpeciesLabel(species)],
      ['İsim', name.trim() || '-'],
      ['Cins', resolvedBreed || '-'],
      ['Sahiplenme tarihi', adoptionDateInput ? formatDateOnly(parseBirthDate(adoptionDateInput)) : '-'],
      ['Cinsiyet', getPetGenderLabel(gender)],
      ['Doğum tarihi', birthDateInput ? formatDateOnly(parseBirthDate(birthDateInput)) : '-'],
      ['Kilo', currentWeightInput.trim() ? `${currentWeightInput} kg` : '-'],
      ['Fotoğraf', photoUrl ? 'Eklendi' : 'Eklenmedi'],
    ],
    [species, name, breed, resolvedBreed, gender, birthDateInput, adoptionDateInput, currentWeightInput, photoUrl]
  );

  useEffect(() => {
    stepOpacity.setValue(0);
    stepTranslateY.setValue(10);
    Animated.parallel([
      Animated.timing(stepOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(stepTranslateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [stepIndex, stepOpacity, stepTranslateY]);

  const closeWizard = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/pets');
  };

  const jumpToStep = (stepKey) => {
    const idx = WIZARD_STEPS.findIndex((item) => item.key === stepKey);
    if (idx < 0) return;
    setError('');
    setStepIndex(idx);
  };

  const goToSavedPetDetail = () => {
    if (!successResult?.petId) {
      closeWizard();
      return;
    }
    router.replace(`/pets/${successResult.petId}`);
  };

  const handlePickPhoto = async () => {
    try {
      const asset = await pickImageFromLibrary();
      if (!asset) {
        return;
      }
      setLocalPhotoUri(asset.uri);
      setPhotoUrl(asset.uri);
      setError('');
    } catch (err) {
      Alert.alert('Fotoğraf seçilemedi', err.message);
    }
  };

  const openBirthDatePicker = () => {
    setBirthDateDraft(parseBirthDate(birthDateInput) || new Date());
    setShowBirthDatePicker(true);
  };

  const openAdoptionDatePicker = () => {
    setAdoptionDateDraft(parseBirthDate(adoptionDateInput) || new Date());
    setShowAdoptionDatePicker(true);
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

  const handleAdoptionDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowAdoptionDatePicker(false);
    }

    if (event?.type === 'dismissed' || !selectedDate) {
      return;
    }

    if (Platform.OS === 'ios') {
      setAdoptionDateDraft(selectedDate);
      return;
    }

    setAdoptionDateInput(toBirthDateInput(selectedDate));
  };

  const cancelBirthDatePicker = () => {
    setBirthDateDraft(null);
    setShowBirthDatePicker(false);
  };

  const cancelAdoptionDatePicker = () => {
    setAdoptionDateDraft(null);
    setShowAdoptionDatePicker(false);
  };

  const confirmBirthDatePicker = () => {
    const selected = birthDateDraft || parseBirthDate(birthDateInput) || new Date();
    setBirthDateInput(toBirthDateInput(selected));
    setBirthDateDraft(null);
    setShowBirthDatePicker(false);
  };

  const confirmAdoptionDatePicker = () => {
    const selected = adoptionDateDraft || parseBirthDate(adoptionDateInput) || new Date();
    setAdoptionDateInput(toBirthDateInput(selected));
    setAdoptionDateDraft(null);
    setShowAdoptionDatePicker(false);
  };

  const validateNameStep = () => {
    if (!name.trim()) {
      return 'Pet adı zorunludur.';
    }
    return '';
  };

  const validateBreedStep = () => {
    if (!resolvedBreed) {
      return 'Lütfen bir cins seçin.';
    }
    if (breedSelection === 'other' && !customBreedInput.trim()) {
      return 'Diğer seçeneğinde cins adını girin.';
    }
    return '';
  };

  const validateGenderStep = () => {
    if (!petGenderOptions.some((option) => option.key === gender)) {
      return 'Cinsiyet seçimi geçersiz.';
    }
    return '';
  };

  const validateDatesStep = () => {
    if (birthDateInput.trim() && !parseBirthDate(birthDateInput)) {
      return 'Doğum tarihi formatı YYYY-AA-GG olmalıdır.';
    }

    if (adoptionDateInput.trim() && !parseBirthDate(adoptionDateInput)) {
      return 'Sahiplenme tarihi formatı YYYY-AA-GG olmalıdır.';
    }

    if (currentWeightInput.trim()) {
      const n = Number(currentWeightInput.replace(',', '.'));
      if (Number.isNaN(n) || n <= 0) {
        return 'Kilo alanı pozitif sayı olmalıdır.';
      }
    }

    return '';
  };

  const validateAll = () => {
    if (!petSpeciesOptions.some((option) => option.key === species)) {
      return 'Tür seçimi geçersiz.';
    }

    return validateNameStep() || validateBreedStep() || validateGenderStep() || validateDatesStep();
  };

  const handleTakePhoto = async () => {
    try {
      const asset = await pickImageFromCamera();
      if (!asset) {
        return;
      }
      setLocalPhotoUri(asset.uri);
      setPhotoUrl(asset.uri);
      setError('');
    } catch (err) {
      Alert.alert('Kamera açılamadı', err.message);
    }
  };

  const getCurrentStepValidationError = () => {
    if (step.key === 'species') {
      return petSpeciesOptions.some((option) => option.key === species) ? '' : 'Tür seçimi geçersiz.';
    }
    if (step.key === 'name') {
      return validateNameStep();
    }
    if (step.key === 'breed') {
      return validateBreedStep();
    }
    if (step.key === 'gender') {
      return validateGenderStep();
    }
    if (step.key === 'dates') {
      return validateDatesStep();
    }
    return '';
  };

  const nextStepDisabled = step.key !== 'summary' && Boolean(getCurrentStepValidationError());

  const goNext = () => {
    let stepError = '';

    if (step.key === 'name') {
      stepError = validateNameStep();
    } else if (step.key === 'breed') {
      stepError = validateBreedStep();
    } else if (step.key === 'gender') {
      stepError = validateGenderStep();
    } else if (step.key === 'dates') {
      stepError = validateDatesStep();
    }

    setError(stepError);
    if (stepError) {
      return;
    }

    setStepIndex((prev) => Math.min(totalSteps - 1, prev + 1));
  };

  const goBack = () => {
    if (stepIndex === 0) {
      closeWizard();
      return;
    }
    setError('');
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleSubmit = async () => {
    const validationError = validateAll();
    setError(validationError);
    if (validationError) {
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: name.trim(),
        species,
        breed: resolvedBreed || null,
        gender,
        birthDate: parseBirthDate(birthDateInput),
        adoptionDate: parseBirthDate(adoptionDateInput),
        currentWeight: currentWeightInput.trim() ? Number(currentWeightInput.replace(',', '.')) : null,
        photoUrl: null,
        photoPath: null,
        photoLocalUri: null,
        photoLocalPath: null,
      };

      const petId = await createPet(user.uid, payload);

      let photoUploadWarning = '';
      if (localPhotoUri) {
        try {
          const uploaded = await savePetPhotoLocal({
            uid: user.uid,
            petId,
            uri: localPhotoUri,
          });
          await updatePet(user.uid, petId, uploaded);
        } catch (photoErr) {
          photoUploadWarning = photoErr.message || 'Fotoğraf cihaz içine kaydedilemedi.';
        }
      }

      setSuccessResult({
        petId,
        name: payload.name,
        speciesLabel: getPetSpeciesLabel(species),
        genderLabel: getPetGenderLabel(gender),
        breed: payload.breed || '',
        weightText: payload.currentWeight ? `${payload.currentWeight} kg` : '',
        birthDateText: payload.birthDate ? formatDateOnly(payload.birthDate) : '',
        adoptionDateText: payload.adoptionDate ? formatDateOnly(payload.adoptionDate) : '',
        photoUrl: localPhotoUri || '',
        warning: photoUploadWarning || '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (successResult) {
    return (
      <Screen title="Pet Eklendi" subtitle="Profil başarıyla oluşturuldu" scroll={false}>
        <Card style={styles.successCard}>
          <View style={styles.successIconWrap}>
            <MaterialIcons name="check-circle" size={34} color="#2BA06F" />
          </View>
          <Text style={styles.successTitle}>Profil hazır</Text>
          <Text style={styles.successText}>
            {successResult.name || 'Pet'} için profil oluşturuldu. Hatırlatma eklemeye hemen başlayabilirsiniz.
          </Text>

          <View style={styles.successPreviewCard}>
            <View style={styles.successPreviewPhotoWrap}>
              {successResult.photoUrl ? (
                <Image source={{ uri: successResult.photoUrl }} style={styles.successPreviewPhoto} contentFit="cover" />
              ) : (
                <View style={styles.successPreviewPhotoFallback}>
                  <MaterialCommunityIcons
                    name={getSpeciesCardUi(species).icon}
                    size={24}
                    color={getSpeciesCardUi(species).color}
                  />
                </View>
              )}
            </View>
            <View style={styles.successPreviewInfo}>
              <Text style={styles.successPreviewName}>{successResult.name || 'İsimsiz pet'}</Text>
              <Text style={styles.successPreviewSpecies}>{successResult.speciesLabel}</Text>
              <View style={styles.successChipRow}>
                <InfoChip label={successResult.genderLabel} tone="blue" />
                {successResult.breed ? <InfoChip label={successResult.breed} /> : null}
                {successResult.weightText ? <InfoChip label={successResult.weightText} tone="green" /> : null}
              </View>
              {successResult.birthDateText ? (
                <Text style={styles.successMetaLine}>Doğum tarihi: {successResult.birthDateText}</Text>
              ) : null}
              {successResult.adoptionDateText ? (
                <Text style={styles.successMetaLine}>Sahiplenme tarihi: {successResult.adoptionDateText}</Text>
              ) : null}
            </View>
          </View>

          {successResult.warning ? (
            <View style={styles.successWarningBox}>
              <MaterialIcons name="warning-amber" size={18} color="#B07A19" />
              <Text style={styles.successWarningText}>
                Profil kaydedildi ancak fotoğraf yüklenemedi. Dilerseniz daha sonra düzenleme ekranından tekrar deneyin.
              </Text>
            </View>
          ) : null}

          <View style={styles.successActionCol}>
            <Button title="Pet Detayına Git" onPress={goToSavedPetDetail} />
            <Button title="Petlerime Dön" variant="secondary" onPress={closeWizard} />
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title={step.title}
      subtitle={`${stepIndex + 1}/${totalSteps}`}
      scroll>
      <Card style={styles.progressCard}>
        <View style={styles.progressSimpleRow}>
          <Text style={styles.progressSimpleLabel}>İlerleme</Text>
          <Text style={styles.progressSimpleValue}>
            {stepIndex + 1}/{totalSteps}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </Card>

      <Animated.View
        style={{
          opacity: stepOpacity,
          transform: [{ translateY: stepTranslateY }],
        }}>
      {step.key === 'species' ? (
        <Card>
          <Text style={styles.sectionTitle}>Tür seçimi</Text>
          <View style={styles.speciesWizardGrid}>
            {SPECIES_PICKER_CARDS.map((option) => (
              <SpeciesWizardCard
                key={option.key}
                option={option}
                selected={species === option.key}
                onPress={() => {
                  if (option.disabled) {
                    Alert.alert('Yakında', 'Diğer tür desteği yakında eklenecek.');
                    return;
                  }
                  setSpecies(option.key);
                  setBreedSelection('');
                  setCustomBreedInput('');
                  setBreed('');
                  setError('');
                }}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {step.key === 'name' ? (
        <Card>
          <View style={styles.nameModalCard}>
            <View style={styles.nameModalIconWrap}>
              <MaterialIcons name="drive-file-rename-outline" size={20} color="#4F7FA4" />
            </View>
            <Text style={styles.nameModalTitle}>Pet adını belirleyin</Text>
            <Text style={styles.nameModalText}>Kısa ve kolay hatırlanır bir isim kullanın.</Text>
            <Field
              label="Pet adı"
              value={name}
              onChangeText={setName}
              placeholder="Örn. Minnoş"
              autoCapitalize="words"
            />
          </View>
        </Card>
      ) : null}

      {step.key === 'breed' ? (
        <Card>
          <Text style={styles.sectionTitle}>Cins seçimi</Text>
          <Text style={styles.sectionHelper}>{getBreedFieldLabel(species)} için bir seçenek belirleyin.</Text>
          <View style={styles.breedGrid}>
            {getBreedOptionsForSpecies(species).map((item) => (
              <BreedOptionCard
                key={item.key}
                item={item}
                selected={breedSelection === item.key}
                onPress={() => {
                  setBreedSelection(item.key);
                  if (item.key !== 'other') {
                    setCustomBreedInput('');
                  }
                  setError('');
                }}
              />
            ))}
          </View>
          {breedSelection === 'other' ? (
            <Field
              label="Cins adı"
              value={customBreedInput}
              onChangeText={setCustomBreedInput}
              placeholder={getBreedPlaceholder(species)}
              autoCapitalize="words"
            />
          ) : null}
        </Card>
      ) : null}

      {step.key === 'gender' ? (
        <Card>
          <Text style={styles.sectionTitle}>Cinsiyet seçimi</Text>
          <Text style={styles.sectionHelper}>Profil kartında ve sağlık kayıtlarında görünür.</Text>
          <View style={styles.genderStepGrid}>
            {petGenderOptions.map((option) => (
              <GenderStepCard
                key={option.key}
                genderKey={option.key}
                label={option.label}
                selected={gender === option.key}
                onPress={() => {
                  setGender(option.key);
                  setError('');
                }}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {step.key === 'dates' ? (
        <Card>
          <View style={styles.formGroupBox}>
            <View style={styles.formGroupHeader}>
              <MaterialIcons name="calendar-month" size={16} color="#5A83A3" />
              <Text style={styles.formGroupTitle}>Doğum tarihi</Text>
            </View>
            <Text style={styles.formGroupHelper}>
              Tam tarihi bilmiyorsanız bu alanı boş bırakabilirsiniz. Daha sonra güncelleyebilirsiniz.
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

                <View style={styles.inlineActionRow}>
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
          </View>

          <View style={styles.formGroupBox}>
            <View style={styles.formGroupHeader}>
              <MaterialIcons name="event-available" size={16} color="#5A83A3" />
              <Text style={styles.formGroupTitle}>Sahiplenme tarihi</Text>
            </View>
            <Text style={styles.formGroupHelper}>
              Peti sahiplendiğiniz tarihi ekleyerek geçmiş kayıtları daha düzenli tutabilirsiniz.
            </Text>
            {Platform.OS === 'web' ? (
              <Field
                label="Sahiplenme tarihi (opsiyonel)"
                value={adoptionDateInput}
                onChangeText={setAdoptionDateInput}
                placeholder="YYYY-AA-GG"
              />
            ) : (
              <View style={styles.birthDateFieldWrap}>
                <Label>Sahiplenme tarihi (opsiyonel)</Label>
                <View style={styles.datePickerTrigger}>
                  <Text style={[styles.datePickerText, !adoptionDateInput && styles.datePickerPlaceholder]}>
                    {adoptionDateInput ? formatDateOnly(parseBirthDate(adoptionDateInput)) : 'Tarih seçilmedi'}
                  </Text>
                </View>

                <View style={styles.inlineActionRow}>
                  <Button title="Tarih Seç" variant="secondary" onPress={openAdoptionDatePicker} style={{ flex: 1 }} />
                  {adoptionDateInput ? (
                    <Button
                      title="Temizle"
                      variant="secondary"
                      onPress={() => setAdoptionDateInput('')}
                      style={{ flex: 1 }}
                    />
                  ) : null}
                </View>

                {showAdoptionDatePicker ? (
                  <View style={styles.nativePickerWrap}>
                    <DateTimePicker
                      value={adoptionDateDraft || parseBirthDate(adoptionDateInput) || new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={handleAdoptionDateChange}
                      maximumDate={new Date()}
                      textColor={PetCareTheme.colors.text}
                      locale="tr_TR"
                      themeVariant="light"
                    />
                    {Platform.OS === 'ios' ? (
                      <View style={styles.pickerFooterRow}>
                        <Button
                          title="Vazgeç"
                          variant="secondary"
                          onPress={cancelAdoptionDatePicker}
                          style={{ flex: 1 }}
                        />
                        <Button title="Seç" onPress={confirmAdoptionDatePicker} style={{ flex: 1 }} />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            )}
          </View>

          <View style={styles.formGroupBox}>
            <View style={styles.formGroupHeader}>
              <MaterialIcons name="scale" size={16} color="#5A83A3" />
              <Text style={styles.formGroupTitle}>Başlangıç kilosu</Text>
            </View>
            <Text style={styles.formGroupHelper}>
              İlk kayıt için opsiyoneldir. Düzenli kilo girişi ile geçmiş takibi yapabilirsiniz.
            </Text>
            <Field
              label="Güncel kilo (kg, opsiyonel)"
              value={currentWeightInput}
              onChangeText={setCurrentWeightInput}
              placeholder="Örn. 6.3"
              keyboardType="decimal-pad"
            />
            <View style={styles.healthHintRow}>
              <InfoChip label={birthDateInput ? 'Doğum tarihi eklendi' : 'Doğum tarihi boş'} tone="blue" />
              <InfoChip label={currentWeightInput.trim() ? 'Kilo girildi' : 'Kilo opsiyonel'} tone="green" />
            </View>
          </View>
        </Card>
      ) : null}

      {step.key === 'photo' ? (
        <Card>
          <Text style={styles.sectionTitle}>Profil fotoğrafı</Text>
          <Pressable onPress={handlePickPhoto} style={styles.photoBox}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={styles.photoPlaceholderWrap}>
                <View style={styles.photoPlaceholderIconWrap}>
                  <MaterialIcons name="add-a-photo" size={24} color="#5E88AB" />
                </View>
                <Text style={styles.photoPlaceholderTitle}>Fotoğraf Seç</Text>
                <Text style={styles.photoPlaceholderText}>Kare profil görseli için galeri veya kamerayı kullanın.</Text>
              </View>
            )}
          </Pressable>
          <View style={styles.photoHintRow}>
            <InfoChip label="Kare kırpma açık" />
            <InfoChip label="Profilde gösterilir" tone="blue" />
          </View>
          <View style={styles.photoActionRow}>
            <Button title="Galeriden Seç" variant="secondary" onPress={handlePickPhoto} style={{ flex: 1 }} />
            <Button title="Kamera ile Çek" variant="secondary" onPress={handleTakePhoto} style={{ flex: 1 }} />
          </View>
          <Text style={styles.helperText}>Bu adımı isterseniz boş bırakabilirsiniz.</Text>
        </Card>
      ) : null}

      {step.key === 'summary' ? (
        <Card>
          <Text style={styles.sectionTitle}>Kaydetmeden önce kontrol edin</Text>
          <View style={styles.summaryJumpRow}>
            <SummaryJumpChip label="Tür" icon="pets" onPress={() => jumpToStep('species')} />
            <SummaryJumpChip label="İsim" icon="drive-file-rename-outline" onPress={() => jumpToStep('name')} />
            <SummaryJumpChip label="Cins" icon="category" onPress={() => jumpToStep('breed')} />
            <SummaryJumpChip label="Cinsiyet" icon="wc" onPress={() => jumpToStep('gender')} />
            <SummaryJumpChip label="Tarihler" icon="event" onPress={() => jumpToStep('dates')} />
            <SummaryJumpChip label="Fotoğraf" icon="photo-camera" onPress={() => jumpToStep('photo')} />
          </View>
          <View style={styles.previewCard}>
            <View style={styles.previewPhotoWrap}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.previewPhoto} contentFit="cover" />
              ) : (
                <View style={styles.previewPhotoFallback}>
                  <MaterialCommunityIcons
                    name={getSpeciesCardUi(species).icon}
                    size={26}
                    color={getSpeciesCardUi(species).color}
                  />
                </View>
              )}
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.previewName}>{name.trim() || 'İsimsiz pet'}</Text>
              <Text style={styles.previewSpecies}>{getPetSpeciesLabel(species)}</Text>
              <View style={styles.previewChipRow}>
                <InfoChip label={getPetGenderLabel(gender)} tone="blue" />
                {resolvedBreed ? <InfoChip label={resolvedBreed} /> : null}
                {currentWeightInput.trim() ? (
                  <InfoChip label={`${currentWeightInput.trim()} kg`} tone="green" />
                ) : null}
              </View>
            </View>
          </View>
          <View style={styles.summaryList}>
            {summaryRows.map(([label, value]) => (
              <View key={label} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{label}</Text>
                <Text style={styles.summaryValue}>{value}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
      </Animated.View>

      <Card style={styles.footerCard}>
        <ErrorText>{error}</ErrorText>
        {!error && nextStepDisabled ? (
          <Text style={styles.footerHint}>{getCurrentStepValidationError()}</Text>
        ) : null}
        <View style={styles.footerRow}>
          <Button title={stepIndex === 0 ? 'Vazgeç' : 'Geri'} variant="secondary" onPress={goBack} style={{ flex: 1 }} />
          {step.key === 'summary' ? (
            <Button title="Kaydet" onPress={handleSubmit} loading={saving} style={{ flex: 1 }} />
          ) : (
            <Button title="İleri" onPress={goNext} disabled={nextStepDisabled} style={{ flex: 1 }} />
          )}
        </View>
      </Card>
    </Screen>
  );
}

function SpeciesWizardCard({ option, selected, onPress }) {
  const ui = getSpeciesPickerCardUi(option.key);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.speciesWizardCard,
        selected && styles.speciesWizardCardSelected,
        option.disabled && styles.speciesWizardCardDisabled,
        selected && styles.speciesWizardCardRaised,
        pressed && { opacity: 0.95, transform: [{ scale: selected ? 0.995 : 0.99 }] },
      ]}>
      <View style={[styles.speciesTileIconArea, { backgroundColor: ui.panelBg }]}>
        <View style={[styles.speciesTileIconCircle, { backgroundColor: ui.iconBg }]}>
          <MaterialCommunityIcons name={ui.icon} size={36} color={ui.iconColor} />
        </View>
        {selected ? <View style={[styles.speciesTileAccent, { backgroundColor: ui.accent }]} /> : null}
      </View>

      <View style={styles.speciesTileFooter}>
        <Text style={[styles.speciesTileLabel, selected && styles.speciesTileLabelSelected]}>{option.label}</Text>
        {option.disabled ? <Text style={styles.speciesTileSubLabel}>Yakında</Text> : null}
      </View>

      {selected ? (
        <View style={styles.speciesSelectedCorner}>
          <MaterialIcons name="check-circle" size={18} color={PetCareTheme.colors.primary} />
        </View>
      ) : null}
    </Pressable>
  );
}

function InfoChip({ label, tone = 'neutral' }) {
  const palette =
    tone === 'blue'
      ? { bg: '#EAF4FF', border: '#D8EAF9', text: '#2E6E9A' }
      : tone === 'green'
        ? { bg: '#ECFBF3', border: '#D8F2E4', text: '#2C7A5F' }
        : { bg: '#F5F8FB', border: '#E3EBF2', text: '#607C93' };

  return (
    <View style={[styles.infoChip, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.infoChipText, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

function SummaryJumpChip({ label, icon, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.summaryJumpChip, pressed && { opacity: 0.85 }]}>
      <MaterialIcons name={icon} size={14} color="#4F7EA1" />
      <Text style={styles.summaryJumpChipText}>{label}</Text>
      <MaterialIcons name="chevron-right" size={14} color="#7DA0BB" />
    </Pressable>
  );
}

function BreedOptionCard({ item, selected, onPress }) {
  const visual = getBreedCardVisual(item.key);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.breedCard,
        selected && styles.breedCardSelected,
        pressed && { opacity: 0.9 },
      ]}>
      <View style={[styles.breedCardIconWrap, { backgroundColor: selected ? visual.bgActive : visual.bg }]}>
        <MaterialCommunityIcons name={visual.icon} size={16} color={selected ? visual.colorActive : visual.color} />
      </View>
      <Text style={[styles.breedCardLabel, selected && styles.breedCardLabelSelected]} numberOfLines={2}>
        {item.label}
      </Text>
    </Pressable>
  );
}

function GenderStepCard({ genderKey, label, selected, onPress }) {
  const visual = getGenderVisual(genderKey);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.genderStepCard,
        selected && styles.genderStepCardSelected,
        pressed && { opacity: 0.94 },
      ]}>
      <View style={[styles.genderStepIconBadge, { backgroundColor: selected ? visual.badgeActive : visual.badge }]}>
        <Text style={[styles.genderStepIcon, { color: selected ? visual.colorActive : visual.color }]}>
          {visual.symbol}
        </Text>
      </View>
      <Text style={[styles.genderStepLabel, selected && styles.genderStepLabelSelected]}>{label}</Text>
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

function getSpeciesCardUi(species) {
  if (species === 'cat') {
    return {
      icon: 'cat',
      bg: '#EAF4FF',
      color: '#356F9B',
      accent: '#8EC7F2',
      artBg: '#F4FAFF',
      artBlob: '#DDEFFF',
      artGround: '#EAF7F1',
      decorLeft: 'fish',
      decorRight: 'paw',
      tag: 'Kedi profili',
      tagBg: '#F0F7FF',
      tagColor: '#3A739E',
      useCase: 'Aşı ve kilo takibini hızlı başlat',
      text: 'Aşı, ilaç ve kilo takibini kedi profiliyle başlatın.',
    };
  }
  if (species === 'bird') {
    return {
      icon: 'bird',
      bg: '#FFF6E7',
      color: '#9A6E1F',
      accent: '#F2CF84',
      artBg: '#FFF9EF',
      artBlob: '#FFEBCD',
      artGround: '#F2FAF2',
      decorLeft: 'feather',
      decorRight: 'seed',
      tag: 'Kuş bakımı',
      tagBg: '#FFF8ED',
      tagColor: '#9A6E1F',
      useCase: 'Bakım rutinleri için ideal başlangıç',
      text: 'Kuş bakım rutinlerini ve veteriner kontrollerini yönetin.',
    };
  }
  return {
    icon: 'dog-side',
    bg: '#ECFBF3',
    color: '#2B7B5F',
    accent: '#94DDC0',
    artBg: '#F3FCF8',
    artBlob: '#DDF6EC',
    artGround: '#EEF8FF',
    decorLeft: 'bone',
    decorRight: 'paw',
    tag: 'Köpek takibi',
    tagBg: '#EFFCF5',
    tagColor: '#2D7A60',
    useCase: 'İlaç ve veteriner planlarını düzenle',
    text: 'Köpek sağlığı için hatırlatmaları ve kayıtları düzenleyin.',
  };
}

function getSpeciesPickerCardUi(species) {
  if (species === 'cat') {
    return {
      icon: 'cat',
      panelBg: '#F3F9FF',
      iconBg: '#E6F2FF',
      iconColor: '#3D74A1',
      accent: '#7FB7E5',
    };
  }
  if (species === 'bird') {
    return {
      icon: 'bird',
      panelBg: '#FFF9EF',
      iconBg: '#FFF0D7',
      iconColor: '#A6782B',
      accent: '#E7C46E',
    };
  }
  if (species === 'other') {
    return {
      icon: 'paw',
      panelBg: '#F6F7FA',
      iconBg: '#ECEFF4',
      iconColor: '#6E8194',
      accent: '#C9D3DD',
    };
  }
  return {
    icon: 'dog-side',
    panelBg: '#F2FBF7',
    iconBg: '#E4F5EE',
    iconColor: '#2F7A61',
    accent: '#82D1B1',
  };
}

function getBreedOptionsForSpecies(species) {
  const rows = (BREED_PRESETS[species] || []).map((label) => ({ key: label, label }));
  rows.push({ key: 'other', label: 'Diğer' });
  return rows;
}

function getBreedCardVisual(key) {
  if (key === 'other') {
    return {
      icon: 'dots-horizontal-circle-outline',
      bg: '#F4F7FB',
      bgActive: '#EAF1F8',
      color: '#6B8296',
      colorActive: '#4A6984',
    };
  }
  return {
    icon: 'paw',
    bg: '#F2F8FD',
    bgActive: '#E5F1FC',
    color: '#5E86A8',
    colorActive: '#386A95',
  };
}

function getBreedFieldLabel(species) {
  if (species === 'cat') return 'Kedi cinsi (opsiyonel)';
  if (species === 'dog') return 'Köpek cinsi (opsiyonel)';
  if (species === 'bird') return 'Kuş cinsi (opsiyonel)';
  return 'Cins (opsiyonel)';
}

function getBreedPlaceholder(species) {
  if (species === 'cat') return 'Örn. British Shorthair';
  if (species === 'dog') return 'Örn. Golden Retriever';
  if (species === 'bird') return 'Örn. Muhabbet Kuşu';
  return 'Örn. Cins bilgisi';
}

const styles = StyleSheet.create({
  progressCard: {
    backgroundColor: '#EEF7FF',
    borderColor: '#D7E8F6',
    gap: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#214F73',
  },
  progressSub: {
    marginTop: 2,
    color: '#6E8DA6',
    fontSize: 12,
    lineHeight: 17,
  },
  remainingText: {
    color: '#5D82A0',
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#DCEBF7',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#67B6F2',
  },
  progressSimpleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressSimpleLabel: {
    color: '#6D8EA7',
    fontSize: 12,
    fontWeight: '600',
  },
  progressSimpleValue: {
    color: '#27577D',
    fontSize: 12,
    fontWeight: '700',
  },
  stepPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D9E9F6',
    backgroundColor: '#F7FBFF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  stepPillActive: {
    borderColor: '#A8D5F6',
    backgroundColor: '#EFF7FF',
  },
  stepPillDone: {
    borderColor: '#BCE6D6',
    backgroundColor: '#F1FBF6',
  },
  stepPillDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E4EEF6',
  },
  stepPillDotActive: {
    backgroundColor: '#67B6F2',
  },
  stepPillDotDone: {
    backgroundColor: '#5FC89E',
  },
  stepPillDotText: {
    color: '#5E7E97',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  stepPillDotTextActive: {
    color: '#fff',
  },
  stepPillLabel: {
    color: '#6A889F',
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 90,
  },
  stepPillInlineIcon: {
    marginRight: 4,
  },
  stepPillLabelActive: {
    color: '#24577D',
    fontWeight: '700',
  },
  stepPillLabelDone: {
    color: '#3F7F68',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: PetCareTheme.colors.text,
  },
  nameModalCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DFEAF4',
    backgroundColor: '#F9FBFE',
    padding: 14,
    gap: 10,
  },
  nameModalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#EAF3FB',
    borderWidth: 1,
    borderColor: '#D7E7F4',
  },
  nameModalTitle: {
    textAlign: 'center',
    color: '#295A80',
    fontSize: 15,
    fontWeight: '700',
  },
  nameModalText: {
    textAlign: 'center',
    color: '#738FA6',
    fontSize: 12,
    lineHeight: 17,
  },
  speciesStepHero: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCEAF5',
    backgroundColor: '#F4FAFF',
    padding: 10,
  },
  speciesStepHeroIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F4FE',
    borderWidth: 1,
    borderColor: '#D6E9FA',
  },
  speciesStepHeroTitle: {
    color: '#27577D',
    fontWeight: '700',
    fontSize: 13,
  },
  speciesStepHeroText: {
    color: '#6D8EA7',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  speciesWizardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  speciesWizardCard: {
    position: 'relative',
    width: '48.5%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE8F1',
    backgroundColor: '#FBFDFF',
    padding: 10,
    gap: 8,
  },
  speciesWizardCardSelected: {
    borderColor: '#9FD1F5',
    backgroundColor: '#F1F8FF',
  },
  speciesWizardCardDisabled: {
    opacity: 0.85,
  },
  speciesWizardCardRaised: {
    shadowColor: '#4E83A8',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  speciesTileIconArea: {
    height: 92,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4EDF5',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  speciesTileIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDE8F2',
    backgroundColor: '#fff',
  },
  speciesTileAccent: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    height: 5,
    borderRadius: 999,
    opacity: 0.9,
  },
  speciesTileFooter: {
    minHeight: 34,
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 2,
  },
  speciesTileLabel: {
    color: '#214F73',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  speciesTileLabelSelected: {
    color: PetCareTheme.colors.primary,
  },
  speciesTileSubLabel: {
    color: '#7B95AA',
    fontSize: 10,
    fontWeight: '600',
  },
  speciesCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  speciesArtwork: {
    height: 88,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5EEF5',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 0,
  },
  speciesArtworkSelected: {
    borderColor: '#C7E4F8',
  },
  speciesArtworkBlobLarge: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    top: -24,
    left: -10,
    opacity: 0.95,
  },
  speciesArtworkBlobSmall: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    right: 14,
    top: 8,
    opacity: 0.9,
  },
  speciesArtworkGround: {
    position: 'absolute',
    left: -6,
    right: -6,
    bottom: -20,
    height: 46,
    borderRadius: 26,
  },
  speciesArtworkDecorLeft: {
    position: 'absolute',
    top: 10,
    left: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFFA0',
  },
  speciesArtworkDecorRight: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E3ECF3',
  },
  speciesArtworkAnimalWrap: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E4EDF5',
    shadowColor: '#5B7C97',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  speciesArtworkAnimalWrapSelected: {
    transform: [{ scale: 1.05 }],
  },
  speciesArtworkHalo: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    opacity: 0.35,
  },
  speciesHeroIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speciesMiniTag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  speciesMiniTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  speciesAccentBar: {
    height: 5,
    borderRadius: 999,
    width: '42%',
  },
  speciesWizardTitle: {
    color: '#214F73',
    fontWeight: '700',
    fontSize: 14,
  },
  speciesWizardText: {
    color: '#6F8FA8',
    fontSize: 11,
    lineHeight: 15,
  },
  speciesUseCasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#EFF6FC',
    borderWidth: 1,
    borderColor: '#DFEBF4',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  speciesUseCaseText: {
    color: '#5B83A3',
    fontSize: 10,
    fontWeight: '600',
  },
  speciesMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  speciesMetaText: {
    color: '#7A95AB',
    fontSize: 10,
    fontWeight: '600',
  },
  speciesSelectedCorner: {
    position: 'absolute',
    right: 10,
    top: 10,
    backgroundColor: '#fff',
    borderRadius: 999,
  },
  speciesSelectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#E4F6F0',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  speciesSelectedText: {
    color: PetCareTheme.colors.primary,
    fontWeight: '700',
    fontSize: 11,
  },
  genderBlock: {
    gap: 6,
  },
  formGroupBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E1EBF3',
    backgroundColor: '#FAFCFE',
    padding: 10,
    gap: 8,
  },
  breedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  breedCard: {
    width: '48.5%',
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DEE8F1',
    backgroundColor: '#FBFDFF',
    padding: 10,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breedCardSelected: {
    borderColor: '#A7D2F4',
    backgroundColor: '#F1F8FF',
  },
  breedCardIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breedCardLabel: {
    color: '#355F7F',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  breedCardLabelSelected: {
    color: PetCareTheme.colors.primary,
  },
  genderStepGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  genderStepCard: {
    flex: 1,
    minHeight: 104,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DFE8F1',
    backgroundColor: '#FBFDFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
  },
  genderStepCardSelected: {
    borderColor: '#A7D2F4',
    backgroundColor: '#F2F8FF',
  },
  genderStepIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderStepIcon: {
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 24,
  },
  genderStepLabel: {
    color: '#345F80',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  genderStepLabelSelected: {
    color: PetCareTheme.colors.primary,
  },
  formGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  formGroupTitle: {
    color: '#315F84',
    fontWeight: '700',
    fontSize: 13,
  },
  formGroupHelper: {
    color: '#7A97AE',
    fontSize: 12,
    lineHeight: 16,
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
  birthDateFieldWrap: {
    gap: 6,
  },
  inlineActionRow: {
    flexDirection: 'row',
    gap: 8,
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
  healthHintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  photoStepHero: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0EBF4',
    backgroundColor: '#F7FBFE',
    padding: 10,
  },
  photoStepHeroIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF4FD',
    borderWidth: 1,
    borderColor: '#D8E9F8',
  },
  photoStepHeroTitle: {
    color: '#2A587C',
    fontWeight: '700',
    fontSize: 13,
  },
  photoStepHeroText: {
    color: '#728FA6',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  photoBox: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PetCareTheme.colors.border,
    backgroundColor: '#F4F8FB',
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
  photoHintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  photoActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  helperText: {
    color: '#6E8EA7',
    fontSize: 12,
  },
  previewCard: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: '#DFEAF4',
    backgroundColor: '#F8FBFE',
    borderRadius: 16,
    padding: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  summaryJumpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
    marginBottom: 2,
  },
  summaryJumpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DDE9F3',
    backgroundColor: '#F5FAFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  summaryJumpChipText: {
    color: '#4F7EA1',
    fontSize: 12,
    fontWeight: '700',
  },
  previewPhotoWrap: {
    width: 72,
    height: 72,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DCE8F1',
    backgroundColor: '#EFF6FB',
  },
  previewPhoto: {
    width: '100%',
    height: '100%',
  },
  previewPhotoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInfo: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  previewName: {
    color: '#214F73',
    fontSize: 15,
    fontWeight: '700',
  },
  previewSpecies: {
    color: '#6D8DA5',
    fontSize: 12,
    fontWeight: '600',
  },
  previewChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 3,
  },
  infoChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  infoChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  summaryList: {
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F6',
  },
  summaryLabel: {
    color: '#6E8EA7',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryValue: {
    color: '#214F73',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  successCard: {
    gap: 12,
    marginTop: 6,
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#ECFBF3',
    borderWidth: 1,
    borderColor: '#D3F2E3',
  },
  successTitle: {
    textAlign: 'center',
    color: '#214F73',
    fontSize: 18,
    fontWeight: '700',
  },
  successText: {
    textAlign: 'center',
    color: '#6E8EA7',
    fontSize: 13,
    lineHeight: 19,
  },
  successPreviewCard: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: '#DFEAF4',
    backgroundColor: '#F8FBFE',
    borderRadius: 16,
    padding: 10,
  },
  successPreviewPhotoWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DBE8F2',
    backgroundColor: '#EFF6FB',
  },
  successPreviewPhoto: {
    width: '100%',
    height: '100%',
  },
  successPreviewPhotoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successPreviewInfo: {
    flex: 1,
    gap: 3,
    justifyContent: 'center',
  },
  successPreviewName: {
    color: '#214F73',
    fontSize: 14,
    fontWeight: '700',
  },
  successPreviewSpecies: {
    color: '#6F8EA7',
    fontSize: 12,
    fontWeight: '600',
  },
  successChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  successMetaLine: {
    color: '#7B96AC',
    fontSize: 11,
    marginTop: 3,
  },
  successWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1DFC0',
    backgroundColor: '#FFF8EA',
    padding: 10,
  },
  successWarningText: {
    flex: 1,
    color: '#8C6A23',
    fontSize: 12,
    lineHeight: 17,
  },
  successActionCol: {
    gap: 8,
  },
  footerCard: {
    gap: 8,
  },
  footerHint: {
    color: '#6D8DA5',
    fontSize: 12,
    lineHeight: 17,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 8,
  },
});

