import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, Chip, ErrorText, Field, Screen } from '@/components/pc/ui';
import { PetCareTheme } from '@/constants/petcare-theme';
import {
  acceptPetInviteCode,
  createPetInviteCode,
  subscribePet,
  subscribeSharedPet,
  subscribeSharedPetMembers,
} from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

const ROLE_OPTIONS = [
  { key: 'family', label: 'Family', hint: 'Düzenleyebilir' },
  { key: 'viewer', label: 'Viewer', hint: 'Sadece görüntüler' },
];

export default function FamilyAccessRoute() {
  const params = useLocalSearchParams();
  const petId = Array.isArray(params.petId) ? params.petId[0] : params.petId;

  return (
    <AuthGate>
      <FamilyAccessScreen petId={petId} />
    </AuthGate>
  );
}

function FamilyAccessScreen({ petId }) {
  const { user } = useAuth();
  const [legacyPet, setLegacyPet] = useState(null);
  const [sharedPet, setSharedPet] = useState(null);
  const [members, setMembers] = useState([]);
  const [inviteRole, setInviteRole] = useState('family');
  const [generatedCode, setGeneratedCode] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.uid || !petId) return undefined;
    return subscribePet(user.uid, petId, setLegacyPet, () => {});
  }, [petId, user?.uid]);

  useEffect(() => {
    if (!petId) return undefined;
    const unsubs = [subscribeSharedPet(petId, setSharedPet, () => {}), subscribeSharedPetMembers(petId, setMembers, () => {})];
    return () => unsubs.forEach((u) => u?.());
  }, [petId]);

  const isSharedReady = !!sharedPet;
  const petName = sharedPet?.name || legacyPet?.name || 'Pet';
  const ownerMember = useMemo(() => members.find((m) => m.role === 'owner'), [members]);

  const showMigrationHelp = () => {
    Alert.alert(
      'Migration Nasıl Yapılır?',
      [
        '1. Dry-run çalıştırın:',
        'npm run migrate:shared-pets -- --dry-run',
        '',
        '2. Çıktı doğruysa gerçek migration:',
        'npm run migrate:shared-pets',
        '',
        '3. Firestore rules deploy edin:',
        'firebase deploy --only firestore:rules',
      ].join('\n')
    );
  };

  const handleCreateInvite = async () => {
    if (!isSharedReady) {
      Alert.alert('Shared pet hazır değil', 'Bu pet henüz shared modele taşınmamış görünüyor. Önce migration çalıştırın.');
      return;
    }
    try {
      setBusyAction('createInvite');
      setError('');
      const res = await createPetInviteCode({
        petId,
        createdByUid: user.uid,
        role: inviteRole,
      });
      setGeneratedCode(res.code);
      Alert.alert('Davet kodu oluşturuldu', `Kod: ${res.code}`);
    } catch (err) {
      setError(err.message || 'Davet kodu oluşturulamadı.');
    } finally {
      setBusyAction('');
    }
  };

  const handleJoinByCode = async () => {
    if (!inviteCodeInput.trim()) {
      setError('Davet kodu girin.');
      return;
    }
    try {
      setBusyAction('joinInvite');
      setError('');
      await acceptPetInviteCode({
        uid: user.uid,
        inviteCode: inviteCodeInput,
        displayName: user.displayName || null,
      });
      Alert.alert('Katılım başarılı', 'Pet erişimi hesabınıza eklendi.');
      setInviteCodeInput('');
    } catch (err) {
      setError(err.message || 'Davet kodu kullanılamadı.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <Screen
      title="Aile & Erişim"
      subtitle={`${petName} için ortak sahiplik ve davet yönetimi`}
      right={<Button title="Kapat" variant="secondary" onPress={() => router.back()} />}>
      {!isSharedReady ? (
        <Card style={styles.warningCard}>
          <View style={styles.infoRow}>
            <MaterialIcons name="info-outline" size={18} color="#946C1A" />
            <Text style={styles.warningTitle}>Shared model henüz aktif değil</Text>
          </View>
          <Text style={styles.warningText}>
            Bu pet şu an eski veri modelinde görünüyor. Aile erişimi için `shared pets migration` sonrası bu ekran aktifleşir.
          </Text>
          <View style={styles.warningChips}>
            <Chip label="V2.1 Draft" tone="warning" />
            {legacyPet ? <Chip label={`Pet: ${legacyPet.name || 'Pet'}`} /> : null}
          </View>
          <Button title="Migration Nasıl Yapılır?" variant="secondary" onPress={showMigrationHelp} />
        </Card>
      ) : null}

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Üyeler</Text>
          <Chip label={`${members.length} kişi`} />
        </View>

        {members.length === 0 ? (
          <Text style={styles.emptyText}>Henüz üye görünmüyor. Migration sonrası owner üyesi burada listelenir.</Text>
        ) : (
          <View style={styles.memberList}>
            {members.map((member) => (
              <View key={member.id} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{(member.displayName || member.uid || '?').slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{member.displayName || member.uid || 'Üye'}</Text>
                  <Text style={styles.memberSub}>
                    {member.uid === ownerMember?.uid ? 'Sahip' : 'Ortak kullanıcı'} •{' '}
                    {member.notificationsEnabled === false ? 'Bildirim kapalı' : 'Bildirim açık'}
                  </Text>
                </View>
                <RoleBadge role={member.role} />
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Davet Kodu Oluştur</Text>
          <MaterialIcons name="group-add" size={18} color="#5C7D92" />
        </View>

        <Text style={styles.helperText}>Owner rolündeki kullanıcılar family veya viewer davet kodu oluşturabilir.</Text>

        <View style={styles.roleOptionWrap}>
          {ROLE_OPTIONS.map((role) => {
            const selected = inviteRole === role.key;
            return (
              <Pressable
                key={role.key}
                onPress={() => setInviteRole(role.key)}
                style={({ pressed }) => [styles.roleOption, selected && styles.roleOptionActive, pressed && { opacity: 0.9 }]}>
                <Text style={[styles.roleOptionTitle, selected && styles.roleOptionTitleActive]}>{role.label}</Text>
                <Text style={[styles.roleOptionHint, selected && styles.roleOptionHintActive]}>{role.hint}</Text>
              </Pressable>
            );
          })}
        </View>

        {generatedCode ? (
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Son oluşturulan kod</Text>
            <Text selectable style={styles.codeText}>
              {generatedCode}
            </Text>
          </View>
        ) : null}

        <Button
          title={busyAction === 'createInvite' ? 'Kod oluşturuluyor...' : 'Davet Kodu Oluştur'}
          onPress={handleCreateInvite}
          loading={busyAction === 'createInvite'}
          disabled={busyAction === 'joinInvite'}
        />
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Davet Koduyla Katıl</Text>
          <MaterialIcons name="vpn-key" size={18} color="#5C7D92" />
        </View>
        <Field
          label="Davet kodu"
          value={inviteCodeInput}
          onChangeText={(v) => setInviteCodeInput(v.toUpperCase())}
          placeholder="Örn. AB12CD34"
          autoCapitalize="characters"
        />
        <Button
          title={busyAction === 'joinInvite' ? 'Katılım kontrol ediliyor...' : 'Koda Katıl'}
          variant="secondary"
          onPress={handleJoinByCode}
          loading={busyAction === 'joinInvite'}
          disabled={busyAction === 'createInvite'}
        />
      </Card>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

function RoleBadge({ role }) {
  const map = {
    owner: { label: 'Owner', tone: 'primary' },
    family: { label: 'Family', tone: 'warning' },
    viewer: { label: 'Viewer', tone: 'default' },
  };
  const item = map[role] || map.viewer;
  return <Chip label={item.label} tone={item.tone} />;
}

const styles = StyleSheet.create({
  warningCard: {
    borderColor: '#F2DFBD',
    backgroundColor: '#FFF8EB',
    gap: 8,
  },
  warningChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningTitle: {
    color: '#845D12',
    fontWeight: '700',
    fontSize: 13,
  },
  warningText: {
    color: '#8F733C',
    fontSize: 12,
    lineHeight: 17,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  helperText: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  emptyText: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  memberList: {
    gap: 10,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E0EAF2',
    borderRadius: 12,
    backgroundColor: '#FBFDFF',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#EAF2FA',
    borderWidth: 1,
    borderColor: '#DAE7F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: '#2C5F86',
    fontWeight: '700',
    fontSize: 12,
  },
  memberName: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  memberSub: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  roleOptionWrap: {
    flexDirection: 'row',
    gap: 8,
  },
  roleOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DCE8F2',
    borderRadius: 12,
    backgroundColor: '#FBFDFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 3,
  },
  roleOptionActive: {
    borderColor: '#BDE2D7',
    backgroundColor: '#EEF9F4',
  },
  roleOptionTitle: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 12,
  },
  roleOptionTitleActive: {
    color: PetCareTheme.colors.primary,
  },
  roleOptionHint: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 11,
  },
  roleOptionHintActive: {
    color: '#4D7D6B',
  },
  codeBox: {
    borderWidth: 1,
    borderColor: '#DBE7F1',
    backgroundColor: '#F7FBFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 2,
  },
  codeLabel: {
    color: '#5C7E96',
    fontSize: 11,
    fontWeight: '600',
  },
  codeText: {
    color: '#1F5782',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 1.4,
  },
});
