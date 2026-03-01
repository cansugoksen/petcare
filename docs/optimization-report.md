# PetCare Optimizasyon Raporu

Hazırlanma tarihi: 2026-02-28
Kapsam: `app/`, `features/`, `components/`, `lib/`, `providers/`, `functions/`, `scripts/`

## Özet
Genel durum iyi; temel akışlar çalışır durumda. En kritik iyileştirme alanları:
- Kullanıcıya görünen metinlerde **encoding bozulmaları**
- Çok büyük ekran dosyaları nedeniyle **bakım/perf riski**
- Büyük listelerin `ScrollView + map` ile render edilmesi (virtualization yok)
- UI tutarlılığı (özellikle sosyal, pet detay, menü) ve erişilebilirlik

## Önceliklendirilmiş Bulgular

## P0 - Kritikte düzelt

### 1) Encoding/Mojibake kullanıcı metinleri
Etkisi: Güven/kalite algısını düşürüyor, bazı ekranlar profesyonel görünmüyor.

Örnek dosyalar:
- `app/pets/[petId].jsx`
- `app/(tabs)/social.jsx`
- `functions/index.js` (yorum/metinlerde)

Öneri:
- Tüm kullanıcı metinlerini tek tur UTF-8 temizlikten geçir.
- Sonrasında metinleri merkezi dosyaya taşı (`i18n` veya `constants/strings-tr.js`).
- CI kontrolü: mojibake karakterleri için pre-commit tarama (`rg "[ÃÄÅ]"`).

### 2) `app/pets/[petId].jsx` aşırı büyük ve çok sorumluluklu
Boyut: ~63KB, tek dosyada birden fazla modül (timeline, reminders, weights, logs, expenses, album).

Risk:
- Render maliyeti artar
- Regresyon riski yüksek
- Kod okunabilirliği düşük

Öneri:
- Dosyayı feature tabanlı parçalara böl:
  - `features/pet-detail/sections/TimelineSection.jsx`
  - `.../RemindersSection.jsx`
  - `.../ExpensesSection.jsx`
  - `.../AlbumSection.jsx`
- Hesaplama fonksiyonlarını `lib/pet-detail-analytics.js` içine taşı.

### 3) Büyük listelerde virtualization eksik
Durum:
- Birçok ekranda `ScrollView` içinde `.map()` ile uzun liste render ediliyor.

Etkisi:
- Orta/düşük cihazlarda jank
- bellek tüketimi artışı

Öneri:
- Feed/timeline/liste ekranlarında `FlatList` veya `SectionList` kullan.
- `keyExtractor`, `getItemLayout` (mümkünse), `initialNumToRender`, `windowSize` ayarla.

---

## P1 - Yüksek değerli iyileştirmeler

### 4) Sosyal feed filtre/sıralama optimizasyonu
Dosya: `app/(tabs)/social.jsx`

Durum:
- `popular` filtresi render sırasında tüm diziyi sort ediyor.

Öneri:
- `useMemo` içinde stabil kopya/sort tamam, ancak dataset büyüyünce server-side sıralamaya geç.
- Firestore query ile `orderBy(likeCount)` alternatifini ayrı endpoint ile düşün.
- Kartları `React.memo` ile sarmala (`PostCard`, `StoryBubble`).

### 5) Data katmanında tek dosya yoğunluğu
Dosya: `lib/petcare-db.js` (~26KB)

Durum:
- Pet, social, docs, qr, events tek dosyada.

Öneri:
- Böl:
  - `lib/db/pets.js`
  - `lib/db/reminders.js`
  - `lib/db/social.js`
  - `lib/db/documents.js`
  - `lib/db/shared-pets.js`

### 6) UI bileşeni `Screen` her yerde `ScrollView`
Dosya: `components/pc/ui.jsx`

Durum:
- `Screen` default `ScrollView`; listelerde yanlış abstraction.

Öneri:
- `Screen` sadece layout/header için kalsın.
- Liste ekranları `FlatListScreen` varyantına taşınsın.
- Form ekranları `FormScreen` varyantı ile keyboard offset standardize edilsin.

### 7) Accessiblity eksikleri
Durum:
- Pressable öğelerde `accessibilityLabel`, `accessibilityRole`, `hitSlop` tutarsız.

Öneri:
- Menü satırları, ikon butonlar, kart aksiyonlarına a11y label ekle.
- Dokunma alanı min 44x44 kuralı uygula.

---

## P2 - UI/UX kalite ve sürdürülebilirlik

### 8) Tasarım dili parçalı
Durum:
- Son sprintlerde birçok ekran hızlıca yenilendi; kart yoğunluğu bazı ekranlarda fazla.

Öneri:
- Görsel sistem kilitle:
  - 3 kart tipi (`Hero`, `Section`, `Item`)
  - 2 buton hiyerarşisi (`Primary`, `Secondary`)
  - Chip renkleri sınırlı set
- `design tokens` dokümanı ekle (`docs/design-tokens.md`).

### 9) Placeholder / bakım metinleri prod görünümünü düşürüyor
Örnekler:
- Sosyalde foto bakım metni
- Belgelerde OCR “yakında”
- Nearby mock fallback metinleri

Öneri:
- Feature flag ile dev/prod mesajlarını ayır.
- Prod’da daha nötr metin: “Bu özellik geliştirme aşamasında”.

### 10) Loading / skeleton standardı yok
Durum:
- Ekranlarda loading davranışı heterojen.

Öneri:
- Ortak `SkeletonCard` ve `ListSkeleton` bileşeni ekle.
- İlk render algısı iyileşir.

---

## Performans odaklı teknik öneriler

## Hızlı kazanımlar (1-2 gün)
1. `app/pets/[petId].jsx` ve `app/(tabs)/social.jsx` içindeki bozuk metinlerin tamamen temizlenmesi.
2. Sosyal feed ve timeline için `FlatList/SectionList` geçişi.
3. Ağır kart bileşenlerinde `React.memo`.
4. Gereksiz inline fonksiyonların stabilize edilmesi (özellikle liste item action’larında).

## Orta vadeli (3-5 gün)
1. `petcare-db.js` modüler bölünme.
2. `pet detail` ekranının section component’lere ayrılması.
3. Ortak loading/skeleton sistemi.

## Uzun vadeli (1-2 sprint)
1. i18n altyapısı + merkezi metin yönetimi.
2. UI audit checklist + görsel regresyon testleri.
3. Analytics bazlı ekran performans ölçümü (render süresi, drop frame).

---

## Riskler
- Hızlı feature ekleme nedeniyle dosya şişmesi devam ederse bakım maliyeti artar.
- Mixed encoding tekrar oluşursa kullanıcı metinlerinde kalite sorunu sürekli geri gelir.
- Shared model migration tamamlanmadan bazı akışlar karışık kalabilir.

---

## Önerilen Uygulama Planı

### Sprint O-1 (stabilizasyon)
- Encoding cleanup (global)
- `Pet Detail` kritik refactor başlangıcı
- Social feed virtualization

### Sprint O-2 (performans + tasarım)
- `lib/db` modüler bölünme
- UI component standardizasyonu
- Skeleton/loading standardı

### Sprint O-3 (sürdürülebilirlik)
- i18n + metin merkezi yönetimi
- a11y iyileştirmeleri
- CI kalite kontrolleri (encoding, lint, style)

---

## Not
Bu rapor kod tabanındaki mevcut durum üzerinden hazırlanmıştır. Önce P0/P1 maddeleri uygulanırsa hem kullanıcı algısı hem geliştirme hızı belirgin iyileşir.