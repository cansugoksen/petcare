export const PetCareTheme = {
  colors: {
    bg: '#F5F8FA',
    surface: '#FFFFFF',
    surfaceAlt: '#EDF3F7',
    border: '#D8E3EA',
    text: '#10222E',
    textMuted: '#5D7484',
    primary: '#1E8E7E',
    primarySoft: '#DFF4EF',
    danger: '#C73E4C',
    warning: '#B97400',
    info: '#2C6FA7',
    chipBg: '#EEF4F8',
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 20,
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
