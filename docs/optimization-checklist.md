# PetCare Optimizasyon Uygulama Checklist'i

Bu liste `docs/optimization-report.md` temel alınarak hazırlanmıştır.

## Faz 1 - P0 Stabilizasyon (Önce)

- [ ] 1. Global encoding temizliği
  - Hedef: Kullanıcıya görünen metinlerde mojibake (`Ã`, `Ä`, `Å`) kalmaması
  - Dosyalar (öncelik):
    - `app/pets/[petId].jsx`
    - `app/(tabs)/social.jsx`
    - `functions/index.js`
  - Kabul kriteri:
    - `rg -n "[ÃÄÅ]" app features lib providers constants functions` çıktısı boş

- [ ] 2. `Pet Detayı` dosyasını parçalama (ilk adım)
  - Hedef: `app/pets/[petId].jsx` içindeki section'ları ayırmak
  - Yeni yapılar:
    - `features/pet-detail/sections/TimelineSection.jsx`
    - `features/pet-detail/sections/RemindersSection.jsx`
    - `features/pet-detail/sections/WeightsSection.jsx`
    - `features/pet-detail/sections/LogsSection.jsx`
    - `features/pet-detail/sections/ExpensesSection.jsx`
  - Kabul kriteri:
    - Ana dosya boyutu ve karmaşıklığı belirgin azalır
    - Davranış değişmeden lint/test temiz

- [ ] 3. Liste ekranlarında virtualization
  - Hedef: `ScrollView + map` yerine `FlatList/SectionList`
  - Öncelik ekranları:
    - `app/(tabs)/social.jsx`
    - `app/pets/[petId].jsx` timeline ve uzun listeler
  - Kabul kriteri:
    - Büyük veri setinde kaydırma akıcı
    - Lint temiz

## Faz 2 - P1 Performans + Mimari

- [ ] 4. `lib/petcare-db.js` modüler bölünme
  - Hedef: veri katmanını feature bazlı ayırmak
  - Önerilen dosyalar:
    - `lib/db/pets.js`
    - `lib/db/reminders.js`
    - `lib/db/social.js`
    - `lib/db/documents.js`
    - `lib/db/shared-pets.js`
  - Kabul kriteri:
    - Tüm importlar çalışır
    - Lint temiz

- [ ] 5. Sosyal feed performans iyileştirmesi
  - Hedef: büyük listede render yükünü düşürmek
  - İşler:
    - `PostCard` ve benzeri alt bileşenleri `React.memo`
    - Filtre/sort hesaplarını memoize ve stabil hale getirme
  - Kabul kriteri:
    - Filtre değişiminde gereksiz tüm kartlar rerender olmaz

- [ ] 6. Ortak loading/skeleton standardı
  - Hedef: tüm ekranlarda tutarlı yükleniyor deneyimi
  - Eklenecekler:
    - `components/pc/skeleton-card.jsx`
    - `components/pc/list-skeleton.jsx`
  - Kabul kriteri:
    - Ana liste ekranlarında loading sırasında skeleton görünür

## Faz 3 - P2 UI/UX Kalite

- [ ] 7. UI sistem standardizasyonu
  - Hedef: kart/buton/chip dilini net sabitlemek
  - İşler:
    - `Hero / Section / Item` kart tiplerini belgelemek
    - `Primary / Secondary` buton kurallarını netlemek
  - Çıktı:
    - `docs/design-tokens.md`

- [ ] 8. Placeholder ve "yakında" metinlerini prod tonuna çekme
  - Hedef: kullanıcıya daha profesyonel dil
  - Örnek dönüşüm:
    - "Bakımda" -> "Bu özellik geliştirme aşamasında"

- [ ] 9. Erişilebilirlik (a11y) turu
  - Hedef: dokunma alanı + ekran okuyucu uyumu
  - İşler:
    - kritik `Pressable` bileşenlerine `accessibilityLabel`
    - min 44x44 dokunma hedefi

## Sürekli Kontrol (Her PR)

- [ ] `npm run lint` temiz
- [ ] Bozuk karakter taraması temiz
- [ ] Kritik akış testi:
  - Pet ekle/düzenle
  - Hatırlatma oluştur
  - Pet detayı sekmeleri
  - Sosyal akış ve yorum
  - Belge kasası temel işlemler

## Önerilen Uygulama Sırası

1. Faz 1 / Madde 1 (encoding cleanup)
2. Faz 1 / Madde 3 (virtualization)
3. Faz 1 / Madde 2 (pet detail bölme)
4. Faz 2 / Madde 4-5
5. Faz 2 / Madde 6
6. Faz 3 maddeleri