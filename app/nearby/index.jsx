import * as React from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, Chip, EmptyState, Screen } from '@/components/pc/ui';
import { PetCareTheme } from '@/constants/petcare-theme';
import {
  formatCoordsShort,
  getCurrentLocationSafe,
  searchNearbyParksOverpass,
  searchNearbyVetsOverpass,
} from '@/lib/nearby';

const RADIUS_OPTIONS = [5, 10, 20];
const CATEGORY_OPTIONS = [
  { key: 'vet', label: 'Veteriner', icon: 'local-hospital' },
  { key: 'park', label: 'Park', icon: 'park' },
];

const MOCK_VETS = [
  {
    id: 'v1',
    category: 'vet',
    name: 'Pati Veteriner Kliniği',
    distanceKm: 1.2,
    address: 'Kadıköy, İstanbul',
    phone: '+902161112233',
    openStatus: 'open',
    nightOpen: false,
    source: 'mock',
  },
  {
    id: 'v2',
    category: 'vet',
    name: 'Gece Açık Pet Polikliniği',
    distanceKm: 3.8,
    address: 'Ataşehir, İstanbul',
    phone: '+902165551100',
    openStatus: 'unknown',
    nightOpen: true,
    source: 'mock',
  },
  {
    id: 'v3',
    category: 'vet',
    name: 'Minik Dostlar Vet',
    distanceKm: 6.4,
    address: 'Üsküdar, İstanbul',
    phone: '+902163337799',
    openStatus: 'closed',
    nightOpen: false,
    source: 'mock',
  },
];

const MOCK_PARKS = [
  {
    id: 'p1',
    category: 'park',
    subtype: 'dog_park',
    name: 'Özgürlük Köpek Parkı',
    distanceKm: 1.6,
    address: 'Kadıköy, İstanbul',
    phone: null,
    openStatus: 'open',
    nightOpen: false,
    source: 'mock',
  },
  {
    id: 'p2',
    category: 'park',
    subtype: 'park',
    name: 'Fenerbahçe Parkı',
    distanceKm: 4.1,
    address: 'Kadıköy, İstanbul',
    phone: null,
    openStatus: 'open',
    nightOpen: false,
    source: 'mock',
  },
  {
    id: 'p3',
    category: 'park',
    subtype: 'dog_park',
    name: 'Sahil Pati Alanı',
    distanceKm: 7.9,
    address: 'Maltepe, İstanbul',
    phone: null,
    openStatus: 'unknown',
    nightOpen: false,
    source: 'mock',
  },
];

export default function NearbyRoute() {
  return (
    <AuthGate>
      <NearbyScreen />
    </AuthGate>
  );
}

function NearbyScreen() {
  const [activeCategory, setActiveCategory] = React.useState('vet');
  const [radiusKm, setRadiusKm] = React.useState(10);
  const [onlyNightOpen, setOnlyNightOpen] = React.useState(false);
  const [locationReady, setLocationReady] = React.useState(false);
  const [locationBusy, setLocationBusy] = React.useState(false);
  const [coords, setCoords] = React.useState(null);
  const [locationMessage, setLocationMessage] = React.useState('');
  const [searchBusy, setSearchBusy] = React.useState(false);
  const [searchError, setSearchError] = React.useState('');
  const [livePlaces, setLivePlaces] = React.useState([]);
  const [dataSource, setDataSource] = React.useState('mock');

  const runLiveSearch = React.useCallback(async () => {
    if (!coords) return;
    setSearchBusy(true);
    setSearchError('');

    try {
      const rows =
        activeCategory === 'park'
          ? await searchNearbyParksOverpass({
              latitude: coords.latitude,
              longitude: coords.longitude,
              radiusKm,
              limit: 24,
            })
          : await searchNearbyVetsOverpass({
              latitude: coords.latitude,
              longitude: coords.longitude,
              radiusKm,
              limit: 24,
            });

      setLivePlaces(rows);
      setDataSource(rows.length ? 'osm' : 'mock');
      if (!rows.length) {
        setSearchError(
          activeCategory === 'park'
            ? 'Yakındaki park bulunamadı. Mock liste gösteriliyor.'
            : 'Yakındaki veteriner bulunamadı. Mock liste gösteriliyor.'
        );
      }
    } catch (err) {
      setSearchError(err?.message || 'Canlı arama yapılamadı. Mock liste gösteriliyor.');
      setDataSource('mock');
      setLivePlaces([]);
    } finally {
      setSearchBusy(false);
    }
  }, [activeCategory, coords, radiusKm]);

  React.useEffect(() => {
    if (locationReady && coords) {
      runLiveSearch();
    }
  }, [locationReady, coords, radiusKm, activeCategory, runLiveSearch]);

  React.useEffect(() => {
    if (activeCategory !== 'vet' && onlyNightOpen) {
      setOnlyNightOpen(false);
    }
  }, [activeCategory, onlyNightOpen]);

  const baseRows = React.useMemo(() => {
    if (dataSource === 'osm' && livePlaces.length) return livePlaces;
    return activeCategory === 'park' ? MOCK_PARKS : MOCK_VETS;
  }, [activeCategory, dataSource, livePlaces]);

  const results = React.useMemo(() => {
    return baseRows
      .filter((item) => item.distanceKm <= radiusKm)
      .filter((item) =>
        activeCategory === 'vet' && onlyNightOpen
          ? item.nightOpen || item.openStatus === 'open'
          : true
      );
  }, [activeCategory, baseRows, radiusKm, onlyNightOpen]);

  const requestLocation = async () => {
    setLocationBusy(true);
    const result = await getCurrentLocationSafe();
    setLocationBusy(false);

    if (!result.ok) {
      setLocationReady(false);
      setLocationMessage(result.message || 'Konum alınamadı.');

      if (result.reason === 'module_missing') {
        Alert.alert(
          'Konum modülü eksik',
          'expo-location paketi henüz kurulu değil. Şimdilik mock veri ile devam edilir.'
        );
        return;
      }

      if (result.reason === 'permission_denied') {
        Alert.alert(
          'Konum izni gerekli',
          'Yakındaki hizmetleri mesafeye göre sıralamak için konum izni verin.'
        );
        return;
      }

      Alert.alert('Konum alınamadı', result.message || 'Lütfen tekrar deneyin.');
      return;
    }

    setCoords(result.coords);
    setLocationReady(true);
    setLocationMessage(
      activeCategory === 'park'
        ? 'Konum alındı. Yakındaki parklar canlı olarak aranıyor...'
        : 'Konum alındı. Yakındaki veterinerler canlı olarak aranıyor...'
    );
  };

  return (
    <Screen
      title="Yakınımda"
      subtitle="Veterinerler ve pet dostu parklar için yakın çevre araması"
      right={<Chip label="LOC-1B" />}>
      <Card style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="place" size={24} color="#246B9A" />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={styles.heroTitle}>Yakındaki Hizmetler</Text>
            <Text style={styles.heroText}>
              Konum alındığında canlı OSM araması denenir. Sonuç alınamazsa uygulama mock liste ile
              çalışmaya devam eder.
            </Text>
          </View>
        </View>

        <View style={styles.heroActions}>
          <Button
            title={locationReady ? 'Konumu Güncelle' : 'Konum İznini Başlat'}
            onPress={requestLocation}
            loading={locationBusy}
          />
          <Button
            title={searchBusy ? 'Aranıyor...' : 'Canlı Ara'}
            variant="secondary"
            onPress={runLiveSearch}
            disabled={!coords || searchBusy}
            loading={searchBusy}
          />
        </View>

        <View style={styles.locationInfoCard}>
          <View style={styles.locationInfoRow}>
            <MaterialIcons
              name={locationReady ? 'my-location' : 'location-disabled'}
              size={16}
              color={locationReady ? '#2C8C67' : '#7A8E9D'}
            />
            <Text style={styles.locationInfoText}>
              {locationReady ? 'Konum hazır' : 'Konum henüz alınmadı'}
            </Text>
            <Chip label={dataSource === 'osm' ? 'Canlı OSM' : 'Mock veri'} />
          </View>
          <Text style={styles.locationInfoSub}>{formatCoordsShort(coords)}</Text>
          {locationMessage ? <Text style={styles.locationInfoHint}>{locationMessage}</Text> : null}
          {searchError ? <Text style={styles.errorHint}>{searchError}</Text> : null}
        </View>
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Filtreler</Text>
          <Chip label={`${results.length} sonuç`} />
        </View>

        <View style={styles.rowWrap}>
          {CATEGORY_OPTIONS.map((option) => {
            const selected = activeCategory === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setActiveCategory(option.key)}
                style={({ pressed }) => [
                  styles.categoryChip,
                  selected && styles.categoryChipActive,
                  pressed && { opacity: 0.9 },
                ]}>
                <MaterialIcons
                  name={option.icon}
                  size={14}
                  color={selected ? '#1F618F' : '#607B8D'}
                />
                <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.rowWrap}>
          {RADIUS_OPTIONS.map((km) => {
            const selected = radiusKm === km;
            return (
              <Pressable
                key={String(km)}
                onPress={() => setRadiusKm(km)}
                style={({ pressed }) => [
                  styles.filterChip,
                  selected && styles.filterChipActive,
                  pressed && { opacity: 0.9 },
                ]}>
                <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                  {km} km
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeCategory === 'vet' ? (
          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>Gece açık / nöbetçi öncelikli</Text>
            <Button
              title={onlyNightOpen ? 'Açık' : 'Kapalı'}
              variant={onlyNightOpen ? 'primary' : 'secondary'}
              onPress={() => setOnlyNightOpen((v) => !v)}
              style={styles.smallBtn}
            />
          </View>
        ) : (
          <View style={styles.noteBox}>
            <MaterialIcons name="park" size={16} color="#4E7F57" />
            <Text style={styles.noteText}>
              Park aramasında mesafe filtresi uygulanır. Açık/kapalı bilgisi çoğu parkta veri
              kaynağında yer almayabilir.
            </Text>
          </View>
        )}

        <View style={styles.noteBox}>
          <MaterialIcons name="info-outline" size={16} color="#6E8191" />
          <Text style={styles.noteText}>
            Açık/kapalı ve gece açık bilgileri veri kaynağına göre değişebilir. OSM tarafında
            çalışma saati bilgisi her kayıtta bulunmayabilir.
          </Text>
        </View>
      </Card>

      {results.length === 0 ? (
        <EmptyState
          title="Sonuç bulunamadı"
          description={
            activeCategory === 'park'
              ? 'Mesafeyi artırarak tekrar deneyin.'
              : 'Filtreleri genişletin veya gece açık filtresini kapatın.'
          }
        />
      ) : (
        <View style={styles.listWrap}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <NearbyPlaceCard item={item} />}
            ItemSeparatorComponent={() => <View style={styles.nearbyListGap} />}
            scrollEnabled={false}
            removeClippedSubviews
            initialNumToRender={8}
            maxToRenderPerBatch={12}
            windowSize={5}
            contentContainerStyle={styles.nearbyListContent}
          />
        </View>
      )}

      <Card style={styles.footerCard}>
        <Text style={styles.sectionTitle}>Yakında gelecek</Text>
        <View style={styles.futureList}>
          <Chip label="Gece açık parser iyileştirme" />
          <Chip label="Acil nöbetçi listesi" />
          <Chip label="Harita görünümü" />
          <Chip label="Favoriler" />
        </View>
      </Card>
    </Screen>
  );
}

function NearbyPlaceCard({ item }) {
  const isPark = item.category === 'park';
  const status = isPark
    ? getParkStatusUi(item.openStatus, item.subtype)
    : getVetStatusUi(item.openStatus, item.nightOpen);

  const handleCall = async () => {
    if (!item.phone) return;
    const url = `tel:${item.phone}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Arama açılamadı', item.phone);
      return;
    }
    Linking.openURL(url).catch(() => {});
  };

  const handleDirections = async () => {
    const q = encodeURIComponent(`${item.name}, ${item.address}`);
    const url = `https://www.google.com/maps/search/?api=1&query=${q}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Yol tarifi açılamadı', item.address);
      return;
    }
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemTopRow}>
        <View style={[styles.itemIconWrap, isPark && styles.itemIconWrapPark]}>
          <MaterialIcons
            name={isPark ? 'park' : 'local-hospital'}
            size={18}
            color={isPark ? '#2F7A4F' : '#2A6D9A'}
          />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.itemTitle}>{item.name}</Text>
          <Text style={styles.itemSub}>{item.address}</Text>
        </View>
        <Text style={styles.distanceText}>{item.distanceKm.toFixed(1)} km</Text>
      </View>

      <View style={styles.metaRow}>
        <Chip label={status.label} tone={status.tone} />
        {!isPark && item.nightOpen ? <Chip label="Gece açık" tone="warning" /> : null}
        {isPark && item.subtype === 'dog_park' ? <Chip label="Köpek parkı" tone="primary" /> : null}
        {item.source === 'osm' ? <Chip label="OSM" /> : <Chip label="Mock" />}
        {!isPark && item.phone ? <Chip label={formatPhoneShort(item.phone)} /> : null}
      </View>

      <View style={styles.actionRow}>
        {!isPark ? (
          <Button title="Ara" variant="secondary" onPress={handleCall} style={styles.actionBtn} />
        ) : null}
        <Button
          title="Yol Tarifi"
          onPress={handleDirections}
          style={!isPark ? styles.actionBtn : undefined}
          variant={isPark ? 'secondary' : 'primary'}
        />
      </View>
    </Card>
  );
}

function getVetStatusUi(openStatus, nightOpen) {
  if (nightOpen) return { label: 'Gece açık olabilir', tone: 'warning' };
  if (openStatus === 'open') return { label: 'Açık', tone: 'primary' };
  if (openStatus === 'closed') return { label: 'Kapalı', tone: 'default' };
  return { label: 'Durum bilinmiyor', tone: 'default' };
}

function getParkStatusUi(openStatus, subtype) {
  if (openStatus === 'open') {
    return { label: subtype === 'dog_park' ? 'Köpek parkı' : 'Park alanı', tone: 'primary' };
  }
  return { label: 'Park / açık alan', tone: 'default' };
}

function formatPhoneShort(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return phone;
  return `...${digits.slice(-4)}`;
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#F4FAFF',
    borderColor: '#DCEAF8',
    gap: 10,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7E8F4',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: PetCareTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  heroText: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  heroActions: {
    gap: 8,
  },
  locationInfoCard: {
    borderWidth: 1,
    borderColor: '#E1ECF5',
    backgroundColor: '#FBFDFF',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  locationInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  locationInfoText: {
    color: PetCareTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  locationInfoSub: {
    color: '#4A718C',
    fontSize: 12,
  },
  locationInfoHint: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  errorHint: {
    color: PetCareTheme.colors.danger,
    fontSize: 11,
    lineHeight: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    color: PetCareTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#DDE8EF',
    backgroundColor: '#F8FBFD',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChipActive: {
    backgroundColor: '#EAF6FF',
    borderColor: '#CFE4F5',
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#DDE8EF',
    backgroundColor: '#F8FBFD',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: '#EAF6FF',
    borderColor: '#CFE4F5',
  },
  filterChipText: {
    color: '#516F85',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#1F618F',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2EBF2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FBFDFF',
  },
  toggleText: {
    flex: 1,
    color: PetCareTheme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  smallBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
  },
  noteBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#F8FBFE',
    borderColor: '#E2EDF5',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  noteText: {
    flex: 1,
    color: '#6B7F8F',
    fontSize: 12,
    lineHeight: 17,
  },
  listWrap: {
    gap: 10,
  },
  nearbyListContent: {
    gap: 0,
  },
  nearbyListGap: {
    height: 10,
  },
  itemCard: {
    gap: 10,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9E9F5',
    backgroundColor: '#F3F9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconWrapPark: {
    borderColor: '#DCEEDC',
    backgroundColor: '#F3FBF4',
  },
  itemTitle: {
    color: PetCareTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  itemSub: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
  },
  distanceText: {
    color: '#2E6F9C',
    fontSize: 12,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
  },
  footerCard: {
    backgroundColor: '#FBFDFF',
    borderColor: '#E2EDF5',
    gap: 10,
  },
  futureList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
