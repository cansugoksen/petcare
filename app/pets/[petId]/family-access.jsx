import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
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
  { key: 'family', label: 'Family', hint: 'DÃ¼zenleyebilir' },
  { key: 'viewer', label: 'Viewer', hint: 'Sadece gÃ¶rÃ¼ntÃ¼ler' },
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
    const unsubs = [
      subscribeSharedPet(petId, setSharedPet, () => {}),
      subscribeSharedPetMembers(petId, setMembers, () => {}),
    ];
    return () => unsubs.forEach((u) => u?.());
  }, [petId]);

  const isSharedReady = !!sharedPet;
  const petName = sharedPet?.name || legacyPet?.name || 'Pet';
  const ownerMember = useMemo(() => members.find((m) => m.role === 'owner'), [members]);

  const handleCreateInvite = async () => {
    if (!isSharedReady) {
      Alert.alert('Shared pet hazÄ±r deÄŸil', 'Bu pet henÃ¼z shared modele taÅŸÄ±nmamÄ±ÅŸ gÃ¶rÃ¼nÃ¼yor. Ã–nce migration Ã§alÄ±ÅŸtÄ±rÄ±n.');
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
      Alert.alert('Davet kodu oluÅŸturuldu', `Kod: ${res.code}`);
    } catch (err) {
      setError(err.message || 'Davet kodu oluÅŸturulamadÄ±.');
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
      Alert.alert('KatÄ±lÄ±m baÅŸarÄ±lÄ±', 'Pet eriÅŸimi hesabÄ±nÄ±za eklendi.');
      setInviteCodeInput('');
    } catch (err) {
      setError(err.message || 'Davet kodu kullanÄ±lamadÄ±.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <Screen
      title="Aile & EriÅŸim"
      subtitle={`${petName} iÃ§in ortak sahiplik ve davet yÃ¶netimi`}
      right={<Button title="Kapat" variant="secondary" onPress={() => router.back()} />}>
      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ãœyeler</Text>
          <Chip label={`${members.length} kiÅŸi`} />
        </View>

        {members.length === 0 ? (
          <Text style={styles.emptyText}>HenÃ¼z Ã¼ye gÃ¶rÃ¼nmÃ¼yor. Migration sonrasÄ± owner Ã¼yesi burada listelenir.</Text>
        ) : (
          <FlatList
            data={members}
            keyExtractor={(member) => member.id}
            renderItem={({ item: member }) => (
              <View style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {(member.displayName || member.uid || '?').slice(0, 2).toUpperCase()}
                  </Text>
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
            )}
            ItemSeparatorComponent={() => <View style={styles.memberListGap} />}
            scrollEnabled={false}
            removeClippedSubviews
            initialNumToRender={8}
            maxToRenderPerBatch={12}
            windowSize={5}
            contentContainerStyle={styles.memberListContent}
          />
        )}
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Davet Kodu OluÅŸtur</Text>
          <MaterialIcons name="group-add" size={18} color="#5C7D92" />
        </View>

        <Text style={styles.helperText}>Owner rolÃ¼ndeki kullanÄ±cÄ±lar family veya viewer davet kodu oluÅŸturabilir.</Text>

        <View style={styles.roleOptionWrap}>
          {ROLE_OPTIONS.map((role) => {
            const selected = inviteRole === role.key;
            return (
              <Pressable
                key={role.key}
                onPress={() => setInviteRole(role.key)}
                style={({ pressed }) => [
                  styles.roleOption,
                  selected && styles.roleOptionActive,
                  pressed && { opacity: 0.9 },
                ]}>
                <Text style={[styles.roleOptionTitle, selected && styles.roleOptionTitleActive]}>{role.label}</Text>
                <Text style={[styles.roleOptionHint, selected && styles.roleOptionHintActive]}>{role.hint}</Text>
              </Pressable>
            );
          })}
        </View>

        {generatedCode ? (
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Son oluÅŸturulan kod</Text>
            <Text selectable style={styles.codeText}>
              {generatedCode}
            </Text>
          </View>
        ) : null}

        <Button
          title={busyAction === 'createInvite' ? 'Kod oluÅŸturuluyor...' : 'Davet Kodu OluÅŸtur'}
          onPress={handleCreateInvite}
          loading={busyAction === 'createInvite'}
          disabled={busyAction === 'joinInvite'}
        />
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Davet Koduyla KatÄ±l</Text>
          <MaterialIcons name="vpn-key" size={18} color="#5C7D92" />
        </View>
        <Field
          label="Davet kodu"
          value={inviteCodeInput}
          onChangeText={(v) => setInviteCodeInput(v.toUpperCase())}
          placeholder="Ã–rn. AB12CD34"
          autoCapitalize="characters"
        />
        <Button
          title={busyAction === 'joinInvite' ? 'KatÄ±lÄ±m kontrol ediliyor...' : 'Koda KatÄ±l'}
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
  memberListContent: {
    gap: 0,
  },
  memberListGap: {
    height: 10,
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

