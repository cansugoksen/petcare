import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Button, Card, ErrorText, Field, Screen } from '@/components/pc/ui';
import { PetCareTheme, reminderTypeLabels, repeatTypeLabels } from '@/constants/petcare-theme';
import { parseInputDateTime, toInputDateTime } from '@/lib/date-utils';
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

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.uid || !petId) {
        return;
      }

      try {
        const pet = await getPet(user.uid, petId);
        if (!mounted) {
          return;
        }
        setPetName(pet?.name || '');

        if (mode === 'edit' && reminderId) {
          const reminder = await getReminder(user.uid, petId, reminderId);
          if (!mounted) {
            return;
          }
          if (reminder) {
            setTitle(reminder.title || '');
            setType(reminder.type || 'vaccine');
            setDueInput(toInputDateTime(reminder.dueDate));
            setRepeatType(reminder.repeatType || 'none');
            setCustomDaysInterval(
              reminder.customDaysInterval ? String(reminder.customDaysInterval) : ''
            );
            setActive(Boolean(reminder.active));
            setLastNotifiedAt(reminder.lastNotifiedAt ?? null);
          } else {
            setError('Hatırlatma bulunamadı.');
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [mode, petId, reminderId, user?.uid]);

  const validate = () => {
    if (!title.trim()) {
      return 'Başlık zorunlu.';
    }

    if (!REMINDER_TYPES.includes(type)) {
      return 'Hatırlatma tipi geçersiz.';
    }

    const dueDate = parseInputDateTime(dueInput);
    if (!dueDate) {
      return 'Tarih formatı YYYY-AA-GG SS:dd olmalı.';
    }

    if (!REPEAT_TYPES.includes(repeatType)) {
      return 'Tekrar tipi geçersiz.';
    }

    if (repeatType === 'customDays') {
      const num = Number(customDaysInterval);
      if (Number.isNaN(num) || num < 1) {
        return 'Özel gün aralığı en az 1 olmalı.';
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

    const dueDate = parseInputDateTime(dueInput);

    const payload = {
      uid: user.uid,
      petId,
      petName,
      title: title.trim(),
      type,
      dueDate,
      repeatType,
      customDaysInterval:
        repeatType === 'customDays' ? Number(customDaysInterval) || null : null,
      active,
    };

    try {
      setSaving(true);
      if (mode === 'create') {
        await createReminder(user.uid, petId, { ...payload, lastNotifiedAt: null });
      } else {
        await updateReminder(user.uid, petId, reminderId, {
          ...payload,
          lastNotifiedAt,
        });
      }
      router.back();
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
      <Card>
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
            <SelectChip
              key={key}
              label={reminderTypeLabels[key]}
              selected={type === key}
              onPress={() => setType(key)}
            />
          ))}
        </View>

        <Field
          label="Tarih (YYYY-AA-GG SS:dd)"
          value={dueInput}
          onChangeText={setDueInput}
          placeholder="2026-02-23 19:30"
        />

        <Text style={styles.label}>Tekrar</Text>
        <View style={styles.grid}>
          {REPEAT_TYPES.map((key) => (
            <SelectChip
              key={key}
              label={repeatTypeLabels[key]}
              selected={repeatType === key}
              onPress={() => setRepeatType(key)}
            />
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
          <Pressable
            onPress={() => setActive((prev) => !prev)}
            style={[styles.toggle, active && styles.toggleActive]}>
            <View style={[styles.toggleThumb, active && styles.toggleThumbActive]} />
          </Pressable>
        </View>

        <ErrorText>{error}</ErrorText>

        <View style={styles.footerRow}>
          <Button title="İptal" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
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
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectChip,
        selected && styles.selectChipSelected,
        pressed && { opacity: 0.85 },
      ]}>
      <Text style={[styles.selectChipText, selected && styles.selectChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    borderColor: PetCareTheme.colors.border,
    backgroundColor: '#fff',
    borderRadius: 999,
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#D8E3EA',
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
  },
});
