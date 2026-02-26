import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, ErrorText, Field, Screen } from '@/components/pc/ui';
import { PetCareTheme, healthLogTags } from '@/constants/petcare-theme';
import { parseInputDateTime, toInputDateTime } from '@/lib/date-utils';
import { getHealthLog, updateHealthLog } from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

export default function EditLogRoute() {
  const params = useLocalSearchParams();
  const petId = Array.isArray(params.petId) ? params.petId[0] : params.petId;
  const logId = Array.isArray(params.logId) ? params.logId[0] : params.logId;

  return (
    <AuthGate>
      <EditLogScreen petId={petId} logId={logId} />
    </AuthGate>
  );
}

function EditLogScreen({ petId, logId }) {
  const { user } = useAuth();
  const [loggedAtInput, setLoggedAtInput] = useState(toInputDateTime(new Date()));
  const [note, setNote] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const row = await getHealthLog(user.uid, petId, logId);
        if (!mounted) return;
        if (!row) {
          setError('Sağlık notu bulunamadı.');
          return;
        }
        setLoggedAtInput(toInputDateTime(row.loggedAt || new Date()));
        setNote(row.note || '');
        setSelectedTags(Array.isArray(row.tags) ? row.tags : []);
        setError('');
      } catch (err) {
        if (mounted) setError(err.message || 'Sağlık notu yüklenemedi.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (user?.uid && petId && logId) load();
    return () => {
      mounted = false;
    };
  }, [logId, petId, user?.uid]);

  const toggleTag = (tag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  const handleSave = async () => {
    const loggedAt = parseInputDateTime(loggedAtInput);
    if (!loggedAt) {
      setError('Tarih formatı YYYY-AA-GG SS:dd olmalı.');
      return;
    }
    if (!note.trim() && selectedTags.length === 0) {
      setError('En az bir not veya etiket girin.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await updateHealthLog(user.uid, petId, logId, {
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
    <Screen title="Sağlık Notu Düzenle" subtitle="Belirti ve gözlem kayıtlarını güncelleyebilirsiniz.">
      <Card style={styles.formCard}>
        <View style={styles.heroStrip}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="fact-check" size={16} color="#2C8E6B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Günlük Gözlem</Text>
            <Text style={styles.heroText}>Etiket ve notları düzenleyerek sağlık zaman akışını daha doğru tutun.</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Kayıt Zamanı</Text>
          <Field label="Tarih" value={loggedAtInput} onChangeText={setLoggedAtInput} placeholder="2026-02-23 14:30" />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Etiketler</Text>
          <View style={styles.tags}>
            {healthLogTags.map((tag) => (
              <TagButton key={tag.key} label={tag.label} selected={selectedTags.includes(tag.key)} onPress={() => toggleTag(tag.key)} />
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Not</Text>
          <Field label="Açıklama" value={note} onChangeText={setNote} placeholder="Örn. İştahı azaldı, su tüketimi normal." multiline autoCapitalize="sentences" />
        </View>

        <ErrorText>{error}</ErrorText>

        <View style={styles.footerRow}>
          <Button title="İptal" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
          <Button title="Güncelle" onPress={handleSave} loading={saving} disabled={loading} style={{ flex: 1 }} />
        </View>
      </Card>
    </Screen>
  );
}

function TagButton({ label, selected, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tagButton, selected && styles.tagButtonSelected, pressed && { opacity: 0.88 }]}>
      {selected ? <MaterialIcons name="check-circle" size={14} color={PetCareTheme.colors.primary} /> : null}
      <Text style={[styles.tagText, selected && styles.tagTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  formCard: { gap: 12, borderColor: '#DFEAF2' },
  heroStrip: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#D6EEDF',
    backgroundColor: '#F3FBF7',
    borderRadius: 14,
    padding: 10,
  },
  heroIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#E4F8EE',
    borderWidth: 1,
    borderColor: '#D5EEDF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { color: '#257657', fontWeight: '700', fontSize: 13 },
  heroText: { marginTop: 1, color: '#5F8A77', fontSize: 11, lineHeight: 16 },
  panel: {
    borderWidth: 1,
    borderColor: '#E1EAF2',
    backgroundColor: '#FBFDFF',
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  panelTitle: { color: '#2C5F86', fontWeight: '700', fontSize: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagButton: {
    borderWidth: 1,
    borderColor: '#DCE8F1',
    backgroundColor: '#FBFDFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tagButtonSelected: {
    borderColor: '#BEE6DA',
    backgroundColor: PetCareTheme.colors.primarySoft,
  },
  tagText: { color: PetCareTheme.colors.text, fontWeight: '600', fontSize: 12 },
  tagTextSelected: { color: PetCareTheme.colors.primary },
  footerRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
});
