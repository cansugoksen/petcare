export const PetCareTheme = {
  colors: {
    bg: '#F3F7FB',
    bgSoft: '#F8FBFE',
    surface: '#FFFFFF',
    surfaceAlt: '#EEF4F9',
    border: '#DCE7EF',
    borderStrong: '#CCDCE7',
    text: '#112532',
    textMuted: '#5F788A',
    textSoft: '#7C95A6',
    primary: '#1E8E7E',
    primaryDark: '#167266',
    primarySoft: '#E2F6F1',
    danger: '#C73E4C',
    warning: '#B97400',
    info: '#2C6FA7',
    chipBg: '#EEF4F8',
  },
  radius: {
    sm: 12,
    md: 16,
    lg: 22,
    xl: 26,
  },
  spacing: (n) => n * 8,
};

export const reminderTypeLabels = {
  vaccine: 'Aşı',
  medication: 'İlaç',
  vetVisit: 'Veteriner',
};

export const repeatTypeLabels = {
  none: 'Tek sefer',
  weekly: 'Haftalık',
  monthly: 'Aylık',
  yearly: 'Yıllık',
  customDays: 'Özel gün aralığı',
};

export const healthLogTags = [
  { key: 'appetite', label: 'İştah' },
  { key: 'vomiting', label: 'Kusma' },
  { key: 'lethargy', label: 'Halsizlik' },
  { key: 'behavior', label: 'Davranış' },
];

export const petSpeciesOptions = [
  { key: 'dog', label: 'Köpek' },
  { key: 'cat', label: 'Kedi' },
  { key: 'bird', label: 'Kuş' },
];

export const petSpeciesLabels = {
  dog: 'Köpek',
  cat: 'Kedi',
  bird: 'Kuş',
};

export function getPetSpeciesLabel(species) {
  return petSpeciesLabels[species] || 'Pet';
}

export const petGenderOptions = [
  { key: 'female', label: 'Dişi' },
  { key: 'male', label: 'Erkek' },
  { key: 'unknown', label: 'Bilinmiyor' },
];

export const petGenderLabels = {
  female: 'Dişi',
  male: 'Erkek',
  unknown: 'Bilinmiyor',
};

export function getPetGenderLabel(gender) {
  return petGenderLabels[gender] || 'Bilinmiyor';
}
