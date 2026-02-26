import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import DateTimePicker from '@/components/pc/date-time-picker';
import { Button, Card, ErrorText, Field, Label, Screen } from '@/components/pc/ui';
import { PetCareTheme, reminderTypeLabels, repeatTypeLabels } from '@/constants/petcare-theme';
import { formatDateTime, parseInputDateTime, toInputDateTime } from '@/lib/date-utils';
import { createReminder, getPet, getReminder, updateReminder } from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

const REMINDER_TYPES = Object.keys(reminderTypeLabels);
const REPEAT_TYPES = Object.keys(repeatTypeLabels);

export function ReminderFormScreen({ mode = 'create', petId, reminderId }) {
  const { user } = useAuth();
  const [petName, setPetName] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('vaccine');
  const [dueInput, setDueInput] = useState(toInputDateTime(new Date()));
  const [repeatType, setRepeatType] = useState('none');
  const [customDaysInterval, setCustomDaysInterval] = useState('');
  const [active, setActive] = useState(true);
  const [lastNotifiedAt, setLastNotifiedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [showDueTimePicker, setShowDueTimePicker] = useState(false);

  const closeForm = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (petId) {
      router.replace(`/pets/${petId}`);
      return;
    }
    router.replace('/(tabs)');
  };

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user?.uid || !petId) return;

      try {
        const pet = await getPet(user.uid, petId);
        if (!mounted) return;

        setPetName(pet?.name || '');

        if (mode === 'edit' && reminderId) {
          const reminder = await getReminder(user.uid, petId, reminderId);
          if (!mounted) return;

          if (!reminder) {
            setError('Hatırlatma bulunamadı.');
            return;
          }

          setTitle(reminder.title || '');
          setType(reminder.type || 'vaccine');
          setDueInput(toInputDateTime(reminder.dueDate));
          setRepeatType(reminder.repeatType || 'none');
          setCustomDaysInterval(reminder.customDaysInterval ? String(reminder.customDaysInterval) : '');
          setActive(Boolean(reminder.active));
          setLastNotifiedAt(reminder.lastNotifiedAt ?? null);
        }
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [mode, petId, reminderId, user?.uid]);

  const validate = () => {
    if (!title.trim()) return 'Başlık zorunlu.';
    if (!REMINDER_TYPES.includes(type)) return 'Hatırlatma tipi geçersiz.';

    const dueDate = parseInputDateTime(dueInput);
    if (!dueDate) return 'Tarih formatı YYYY-AA-GG SS:dd olmalı.';

    if (!REPEAT_TYPES.includes(repeatType)) return 'Tekrar tipi geçersiz.';

    if (repeatType === 'customDays') {
      const num = Number(customDaysInterval);
      if (Number.isNaN(num) || num < 1) return 'Özel gün aralığı en az 1 olmalı.';
    }

    return '';
  };

  const getDueDateValue = () => parseInputDateTime(dueInput) || new Date();

  const setDueDatePart = (selectedDate) => {
    const current = getDueDateValue();
    const next = new Date(current);
    next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    setDueInput(toInputDateTime(next));
  };

  const setDueTimePart = (selectedDate) => {
    const current = getDueDateValue();
    const next = new Date(current);
    next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    setDueInput(toInputDateTime(next));
  };

  const handleDueDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowDueDatePicker(false);
    if (event?.type === 'dismissed' || !selectedDate) return;
    setDueDatePart(selectedDate);
  };

  const handleDueTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowDueTimePicker(false);
    if (event?.type === 'dismissed' || !selectedDate) return;
    setDueTimePart(selectedDate);
  };

  const handleSubmit = async () => {
    const validationError = validate();
    setError(validationError);
    if (validationError) return;

    const dueDate = parseInputDateTime(dueInput);
    const payload = {
      uid: user.uid,
      petId,
      petName,
      title: title.trim(),
      type,
      dueDate,
      repeatType,
      customDaysInterval: repeatType === 'customDays' ? Number(customDaysInterval) || null : null,
      active,
    };

    try {
      setSaving(true);
      if (mode === 'create') {
        await createReminder(user.uid, petId, { ...payload, lastNotifiedAt: null });
      } else {
        await updateReminder(user.uid, petId, reminderId, { ...payload, lastNotifiedAt });
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
      title={mode === 'create' ? 'Hatırlatma Ekle' : 'Hatırlatma Düzenle'}
      subtitle={petName ? `${petName} için` : 'Pet hatırlatma formu'}>
      <Card style={styles.formCard}>
        <View style={styles.heroStrip}>
          <View style={styles.heroStripIcon}>
            <MaterialIcons name="notifications-active" size={16} color="#2F709F" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroStripTitle}>Hatırlatma Ayarları</Text>
            <Text style={styles.heroStripText}>Tür, tarih ve tekrar seçerek düzenli bir plan oluşturun.</Text>
          </View>
        </View>

        <View style={styles.sectionPanel}>
          <Text style={styles.panelTitle}>Temel Bilgiler</Text>
          <Field
            label="Başlık"
            value={title}
            onChangeText={setTitle}
            placeholder="Örn. Karma aşı, antibiyotik, kontrol randevusu"
            autoCapitalize="sentences"
          />

          <Text style={styles.label}>Tip</Text>
          <View style={styles.grid}>
            {REMINDER_TYPES.map((key) => (
              <SelectChip key={key} label={reminderTypeLabels[key]} selected={type === key} onPress={() => setType(key)} />
            ))}
          </View>
        </View>

        {Platform.OS === 'web' ? (
          <View style={styles.sectionPanel}>
            <Text style={styles.panelTitle}>Tarih ve Saat</Text>
            <Field
              label="Tarih (YYYY-AA-GG SS:dd)"
              value={dueInput}
              onChangeText={setDueInput}
              placeholder="2026-02-23 19:30"
            />
          </View>
        ) : (
          <View style={[styles.sectionPanel, styles.dateTimeFieldWrap]}>
            <Text style={styles.panelTitle}>Tarih ve Saat</Text>
            <Label>Tarih ve saat</Label>
            <Pressable onPress={() => setShowDueDatePicker(true)} style={({ pressed }) => [styles.datePickerTrigger, pressed && { opacity: 0.92 }]}>
              <Text style={styles.datePickerText}>{formatDateTime(getDueDateValue())}</Text>
            </Pressable>

            <View style={styles.inlineActions}>
              <Button title="Tarih Seç" variant="secondary" onPress={() => setShowDueDatePicker(true)} style={{ flex: 1 }} />
              <Button title="Saat Seç" variant="secondary" onPress={() => setShowDueTimePicker(true)} style={{ flex: 1 }} />
            </View>

            {showDueDatePicker ? (
              <View style={styles.nativePickerWrap}>
                <DateTimePicker
                  value={getDueDateValue()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDueDateChange}
                  textColor={PetCareTheme.colors.text}
                />
                {Platform.OS === 'ios' ? (
                  <Button title="Tarih Seçiciyi Kapat" variant="secondary" onPress={() => setShowDueDatePicker(false)} />
                ) : null}
              </View>
            ) : null}

            {showDueTimePicker ? (
              <View style={styles.nativePickerWrap}>
                <DateTimePicker
                  value={getDueDateValue()}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDueTimeChange}
                  textColor={PetCareTheme.colors.text}
                />
                {Platform.OS === 'ios' ? (
                  <Button title="Saat Seçiciyi Kapat" variant="secondary" onPress={() => setShowDueTimePicker(false)} />
                ) : null}
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.sectionPanel}>
          <Text style={styles.panelTitle}>Tekrar ve Durum</Text>
          <Text style={styles.label}>Tekrar</Text>
          <View style={styles.grid}>
            {REPEAT_TYPES.map((key) => (
              <SelectChip key={key} label={repeatTypeLabels[key]} selected={repeatType === key} onPress={() => setRepeatType(key)} />
            ))}
          </View>

          {repeatType === 'customDays' ? (
            <Field
              label="Kaç günde bir?"
              value={customDaysInterval}
              onChangeText={setCustomDaysInterval}
              keyboardType="number-pad"
              placeholder="Örn. 3"
            />
          ) : null}

          <View style={styles.toggleRow}>
            <Text style={styles.label}>Aktif</Text>
            <Pressable onPress={() => setActive((prev) => !prev)} style={[styles.toggle, active && styles.toggleActive]}>
              <View style={[styles.toggleThumb, active && styles.toggleThumbActive]} />
            </Pressable>
          </View>
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

function SelectChip({ label, selected, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.selectChip, selected && styles.selectChipSelected, pressed && { opacity: 0.85 }]}>
      <Text style={[styles.selectChipText, selected && styles.selectChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  formCard: {
    gap: 12,
    borderColor: '#DFEAF2',
    backgroundColor: '#FFFFFF',
  },
  heroStrip: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#D9E8F6',
    backgroundColor: '#F3F9FF',
    borderRadius: 14,
    padding: 10,
  },
  heroStripIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#E7F2FD',
    borderWidth: 1,
    borderColor: '#D4E6F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStripTitle: {
    color: '#285A80',
    fontSize: 13,
    fontWeight: '700',
  },
  heroStripText: {
    marginTop: 1,
    color: '#6E8EA7',
    fontSize: 11,
    lineHeight: 16,
  },
  sectionPanel: {
    borderWidth: 1,
    borderColor: '#E1EAF2',
    backgroundColor: '#FBFDFF',
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  panelTitle: {
    color: '#2B5D84',
    fontWeight: '700',
    fontSize: 12,
  },
  label: {
    color: PetCareTheme.colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectChip: {
    borderWidth: 1,
    borderColor: '#DCE8F1',
    backgroundColor: '#FBFDFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectChipSelected: {
    borderColor: PetCareTheme.colors.primary,
    backgroundColor: PetCareTheme.colors.primarySoft,
  },
  selectChipText: {
    color: PetCareTheme.colors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  selectChipTextSelected: {
    color: PetCareTheme.colors.primary,
  },
  dateTimeFieldWrap: {
    gap: 6,
  },
  datePickerTrigger: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE8F1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  datePickerText: {
    color: PetCareTheme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 8,
  },
  nativePickerWrap: {
    gap: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#D7E4ED',
    padding: 3,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#AEE6D9',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
    backgroundColor: PetCareTheme.colors.primary,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
});
