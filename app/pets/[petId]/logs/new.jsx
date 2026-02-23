import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, ErrorText, Field, Screen } from '@/components/pc/ui';
import { PetCareTheme, healthLogTags } from '@/constants/petcare-theme';
import { parseInputDateTime, toInputDateTime } from '@/lib/date-utils';
import { createHealthLog } from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

export default function NewLogRoute() {
  const params = useLocalSearchParams();
  const petId = Array.isArray(params.petId) ? params.petId[0] : params.petId;

  return (
    <AuthGate>
      <NewLogScreen petId={petId} />
    </AuthGate>
  );
}

function NewLogScreen({ petId }) {
  const { user } = useAuth();
  const [loggedAtInput, setLoggedAtInput] = useState(toInputDateTime(new Date()));
  const [note, setNote] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    const loggedAt = parseInputDateTime(loggedAtInput);
    if (!loggedAt) {
      setError('Tarih formatı YYYY-AA-GG SS:dd olmalı.');
      return;
    }

    if (!note.trim() && selectedTags.length === 0) {
      setError('En az bir not veya etiket gir.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await createHealthLog(user.uid, petId, {
        loggedAt,
        note: note.trim() || null,
        tags: selectedTags,
      });
      router.back();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Sağlık Notu Ekle" subtitle="Belirti, davranış ve günlük gözlemler">
      <Card>
        <Field
          label="Tarih"
          value={loggedAtInput}
          onChangeText={setLoggedAtInput}
          placeholder="2026-02-23 14:30"
        />
        <Text style={styles.label}>Etiketler</Text>
        <View style={styles.tags}>
          {healthLogTags.map((tag) => (
            <TagButton
              key={tag.key}
              label={tag.label}
              selected={selectedTags.includes(tag.key)}
              onPress={() => toggleTag(tag.key)}
            />
          ))}
        </View>
        <Field
          label="Not"
          value={note}
          onChangeText={setNote}
          placeholder="Örn. İştahı azaldı, su tüketimi normal."
          multiline
          autoCapitalize="sentences"
        />
        <ErrorText>{error}</ErrorText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="İptal" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
          <Button title="Kaydet" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
        </View>
      </Card>
    </Screen>
  );
}

function TagButton({ label, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tagButton,
        selected && styles.tagButtonSelected,
        pressed && { opacity: 0.85 },
      ]}>
      <Text style={[styles.tagText, selected && styles.tagTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    color: PetCareTheme.colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagButton: {
    borderWidth: 1,
    borderColor: PetCareTheme.colors.border,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagButtonSelected: {
    borderColor: PetCareTheme.colors.primary,
    backgroundColor: PetCareTheme.colors.primarySoft,
  },
  tagText: {
    color: PetCareTheme.colors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  tagTextSelected: {
    color: PetCareTheme.colors.primary,
  },
});
