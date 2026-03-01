import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthGate } from '@/components/pc/auth-guard';
import { Chip } from '@/components/pc/ui';
import { getFirstAccessiblePetId } from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

const LAST_VIEWED_PET_KEY = 'petcare:lastViewedPetId';

export default function SettingsDrawerRoute() {
  return (
    <AuthGate>
      <SettingsDrawerScreen />
    </AuthGate>
  );
}

function SettingsDrawerScreen() {
  const { user, userProfile, authBusy, signOutUser } = useAuth();

  const displayName = userProfile?.displayName || user?.displayName || 'PetCare Kullanıcısı';
  const accountMeta = userProfile?.email || user?.email || 'Hesap oturumu aktif';
  const avatarLetter = (userProfile?.displayName || user?.displayName || userProfile?.email || user?.email || 'P')
    .slice(0, 2)
    .toUpperCase();

  const closeDrawer = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  const handleComingSoon = (title) => {
    Alert.alert(title, 'Bu alan MVP sonrası sürümlerde geliştirilecek.');
  };

  const handleSignOut = () => {
    Alert.alert('Çıkış yap', 'Hesap oturumu kapatılacak. Başlangıç ekranına yönlendirileceksiniz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOutUser();
            router.replace('/auth');
          } catch (err) {
            Alert.alert('Hata', err.message);
          }
        },
      },
    ]);
  };

  const openPetDigitalId = async () => {
    closeDrawer();
    try {
      const lastPetId = await AsyncStorage.getItem(LAST_VIEWED_PET_KEY);
      if (lastPetId) {
        router.push(`/pets/${lastPetId}/digital-id`);
        return;
      }
    } catch {}

    try {
      const firstPetId = await getFirstAccessiblePetId(user?.uid);
      if (firstPetId) {
        router.push(`/pets/${firstPetId}/digital-id`);
        return;
      }
    } catch {}

    router.push('/(tabs)/pets');
    setTimeout(() => {
      Alert.alert('Dijital Kimlik / QR Kart', 'Henüz pet bulunamadı. Önce bir pet ekleyin veya pet detayını açın.');
    }, 250);
  };

  const openMedicalDocuments = async () => {
    closeDrawer();
    try {
      const lastPetId = await AsyncStorage.getItem(LAST_VIEWED_PET_KEY);
      if (lastPetId) {
        router.push(`/pets/${lastPetId}/documents/index`);
        return;
      }
    } catch {}

    try {
      const firstPetId = await getFirstAccessiblePetId(user?.uid);
      if (firstPetId) {
        router.push(`/pets/${firstPetId}/documents/index`);
        return;
      }
    } catch {}

    router.push('/(tabs)/pets');
    setTimeout(() => {
      Alert.alert('Sağlık Belgeleri', 'Henüz pet bulunamadı. Önce bir pet ekleyin veya pet detayını açın.');
    }, 250);
  };

  const openNearby = () => {
    closeDrawer();
    router.push('/nearby');
  };

  const openProfileAccount = () => {
    closeDrawer();
    router.push('/auth');
  };

  const menuItems = [
    {
      key: 'home',
      icon: 'home-filled',
      label: 'Ana Sayfa',
      onPress: () => {
        closeDrawer();
        router.replace('/(tabs)');
      },
    },
    {
      key: 'pets',
      icon: 'pets',
      label: 'Petlerim',
      onPress: () => {
        closeDrawer();
        router.push('/(tabs)/pets');
      },
    },
    {
      key: 'pet-digital-id',
      icon: 'qr-code-2',
      label: 'Dijital Kimlik / QR Kart',
      onPress: openPetDigitalId,
    },
    {
      key: 'medical-docs',
      icon: 'folder-open',
      label: 'Sağlık Belgeleri',
      onPress: openMedicalDocuments,
    },
    {
      key: 'reminders',
      icon: 'notifications-none',
      label: 'Hatırlatıcılar',
      onPress: () => {
        closeDrawer();
        router.push('/(tabs)/pets');
      },
    },
    {
      key: 'nearby',
      icon: 'place',
      label: 'Yakınımda',
      onPress: openNearby,
    },
    {
      key: 'social',
      icon: 'photo-library',
      label: 'Sosyal',
      onPress: () => {
        closeDrawer();
        router.push('/(tabs)/social');
      },
    },
    {
      key: 'ai',
      icon: 'auto-awesome',
      label: 'AI Asistan',
      onPress: () => {
        closeDrawer();
        router.push('/ai');
      },
    },
    {
      key: 'help',
      icon: 'help-outline',
      label: 'Yardım',
      onPress: () => handleComingSoon('Yardım'),
    },
    {
      key: 'feedback',
      icon: 'feedback',
      label: 'Sorun Bildir',
      onPress: () => handleComingSoon('Geri Bildirim'),
    },
  ].filter((item) => !item.hidden);

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={closeDrawer} />

      <SafeAreaView style={styles.panel} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={openProfileAccount}
            style={({ pressed }) => [styles.accountIdentity, pressed && { opacity: 0.9 }]}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{avatarLetter}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>Merhaba,</Text>
              <Text style={styles.nameText} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.metaText} numberOfLines={1}>
                {accountMeta}
              </Text>
            </View>
            <View style={styles.accountChevron}>
              <MaterialIcons name="chevron-right" size={18} color="#C8D6E5" />
            </View>
          </Pressable>

          <Pressable onPress={closeDrawer} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.82 }]}>
            <MaterialIcons name="close" size={22} color="#D5DFEC" />
          </Pressable>
        </View>

        <View style={styles.headerStatusRow}>
          <Chip label="Hesaplı" tone="primary" />
          <Text style={styles.versionText}>PetCare MVP</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SectionDivider />

          <Text style={styles.sectionLabel}>Evcil Hayvanlarınız</Text>
          <Pressable
            onPress={() => {
              closeDrawer();
              router.push('/pets/new');
            }}
            style={({ pressed }) => [styles.addPetCard, pressed && { opacity: 0.9 }]}>
            <View style={styles.addPetCircle}>
              <MaterialIcons name="add" size={30} color="#D8E4F0" />
            </View>
            <Text style={styles.addPetText}>Yeni Ekle</Text>
          </Pressable>

          <SectionDivider />

          <FlatList
            data={menuItems}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => <MenuRow icon={item.icon} label={item.label} onPress={item.onPress} />}
            ItemSeparatorComponent={() => <View style={styles.menuListGap} />}
            scrollEnabled={false}
            removeClippedSubviews
            initialNumToRender={10}
            maxToRenderPerBatch={14}
            windowSize={6}
            contentContainerStyle={styles.menuListContent}
          />

          <SectionDivider />

          <MenuRow
            icon="power-settings-new"
            label={authBusy ? 'İşlem yapılıyor...' : 'Çıkış Yap'}
            onPress={authBusy ? () => {} : handleSignOut}
            danger
          />

          {__DEV__ ? (
            <>
              <SectionDivider />
              <MenuRow
                icon="build-circle"
                label="Push Test Aracı"
                onPress={() => {
                  closeDrawer();
                  router.push('/dev/push-test');
                }}
              />
              <MenuRow
                icon="cloud-upload"
                label="Storage Health Check"
                onPress={() => {
                  closeDrawer();
                  router.push('/dev/storage-health');
                }}
              />
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function MenuRow({ icon, label, onPress, danger }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}>
      <MaterialIcons name={icon} size={24} color={danger ? '#FF8F98' : '#E8EEF6'} style={{ width: 30 }} />
      <Text style={[styles.menuRowText, danger && styles.menuRowTextDanger]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function SectionDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 14, 22, 0.38)',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    width: '88%',
    maxWidth: 430,
    backgroundColor: '#273246',
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 6, height: 0 },
    elevation: 12,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  accountIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFB126',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  greeting: {
    color: '#C8D3E0',
    fontSize: 12,
  },
  nameText: {
    color: '#F4F7FB',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 1,
  },
  metaText: {
    color: '#AEBBCC',
    fontSize: 11,
    marginTop: 2,
  },
  accountChevron: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 8,
    gap: 10,
  },
  versionText: {
    color: '#9FB0C3',
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    gap: 10,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(210, 222, 238, 0.18)',
    marginVertical: 6,
  },
  sectionLabel: {
    color: '#E8EEF6',
    fontSize: 14,
    fontWeight: '700',
  },
  addPetCard: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 4,
  },
  addPetCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2,
    borderColor: '#A8B8CC',
    backgroundColor: '#1F2939',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPetText: {
    color: '#E8EEF6',
    fontSize: 12,
    fontWeight: '600',
  },
  menuListContent: {
    gap: 0,
  },
  menuListGap: {
    height: 4,
  },
  menuRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 2,
    borderRadius: 12,
  },
  menuRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  menuRowText: {
    color: '#F0F4FA',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  menuRowTextDanger: {
    color: '#FFD4D8',
  },
});




