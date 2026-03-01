import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, Chip, Screen } from '@/components/pc/ui';
import { PetCareTheme } from '@/constants/petcare-theme';
import { formatDateTime } from '@/lib/date-utils';
import { subscribePostLikeState, subscribeSocialFeed, togglePostLike } from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

const FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'new', label: 'Yeni' },
  { key: 'mine', label: 'Benim' },
  { key: 'popular', label: 'Popüler' },
];

export default function SocialTab() {
  return (
    <AuthGate>
      <SocialTabContent />
    </AuthGate>
  );
}

function SocialTabContent() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    const unsub = subscribeSocialFeed(
      (rows) => {
        setPosts(rows.slice(0, 60));
        setError(null);
      },
      (err) => setError(err)
    );
    return unsub;
  }, []);

  const stats = useMemo(() => {
    const totalLikes = posts.reduce((sum, post) => sum + (post.likeCount || 0), 0);
    const totalComments = posts.reduce((sum, post) => sum + (post.commentCount || 0), 0);
    return { posts: posts.length, likes: totalLikes, comments: totalComments };
  }, [posts]);

  const storyItems = useMemo(() => {
    const seen = new Set();
    const items = [];
    posts.forEach((post) => {
      const label = post.petName || post.ownerName || 'Topluluk';
      const key = `${post.ownerUid || 'owner'}:${label}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({
        id: key,
        label,
        subtitle: post.petName ? 'Pet' : 'Kullanıcı',
        imageUrl: post.imageUrl || null,
      });
    });
    return items.slice(0, 10);
  }, [posts]);
  const storyFeedItems = useMemo(() => [{ id: '__new', type: 'new' }, ...storyItems.map((item) => ({ ...item, type: 'story' }))], [storyItems]);

  const visiblePosts = useMemo(() => {
    const rows = [...posts];
    if (activeFilter === 'mine') {
      return rows.filter((post) => post.ownerUid && user?.uid && post.ownerUid === user.uid);
    }
    if (activeFilter === 'popular') {
      return rows.sort((a, b) => (b.likeCount || 0) + (b.commentCount || 0) - ((a.likeCount || 0) + (a.commentCount || 0)));
    }
    return rows;
  }, [activeFilter, posts, user?.uid]);

  const featuredPost = visiblePosts[0] || null;
  const feedPosts = visiblePosts.slice(featuredPost ? 1 : 0);

  const listHeader = (
    <View style={styles.listHeaderStack}>
      <Card style={styles.heroCard}>
        <View style={styles.heroGlowA} />
        <View style={styles.heroGlowB} />

        <View style={styles.heroHeader}>
          <View style={styles.heroIconWrap}>
            <MaterialIcons name="hub" size={20} color="#2C5E86" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Topluluk Akışı</Text>
            <Text style={styles.heroSubtitle}>Paylaşımları keşfedin, yorum bırakın ve diğer pet sahipleriyle etkileşime geçin.</Text>
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <HeroStat label="Gönderi" value={stats.posts} icon="grid-view" tone="blue" />
          <HeroStat label="Beğeni" value={stats.likes} icon="favorite" tone="rose" />
          <HeroStat label="Yorum" value={stats.comments} icon="chat-bubble" tone="mint" />
        </View>
      </Card>

      <Card style={styles.composerCard}>
        <View style={styles.composerTopRow}>
          <Pressable onPress={() => router.push('/social/new')} style={({ pressed }) => [styles.composerInputFake, pressed && { opacity: 0.9 }]}> 
            <View style={styles.composerAvatarFake}>
              <MaterialIcons name="pets" size={16} color="#2B6089" />
            </View>
            <Text style={styles.composerPlaceholder}>Bugün petinizle ilgili bir şey paylaşın...</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/social/new')} style={({ pressed }) => [styles.composeFab, pressed && { opacity: 0.88 }]}> 
            <MaterialIcons name="add" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={styles.composerFooter}>
          <Chip label="Fotoğraf yükleme bakımda" tone="warning" />
          <Text style={styles.composerFooterText}>Metin odaklı gönderi paylaşabilirsiniz.</Text>
        </View>
      </Card>

      <View style={styles.storiesSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Hikâyeler</Text>
          <Pressable onPress={() => Alert.alert('Yakında', 'Hikâye özelliği sonraki aşamada eklenecek.')}>
            <Text style={styles.sectionLink}>Tümünü Gör</Text>
          </Pressable>
        </View>
        <FlatList
          data={storyFeedItems}
          horizontal
          keyExtractor={(item) => item.id}
          renderItem={({ item }) =>
            item.type === 'new' ? <StoryBubbleNew onPress={() => router.push('/social/new')} /> : <StoryBubble item={item} />
          }
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storyRowWrap}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      </View>

      <View style={styles.filtersSection}>
        <View style={styles.filterRow}>
          {FILTERS.map((filter) => (
            <Pressable
              key={filter.key}
              onPress={() => setActiveFilter(filter.key)}
              style={({ pressed }) => [styles.filterPill, activeFilter === filter.key && styles.filterPillActive, pressed && { opacity: 0.88 }]}> 
              <Text style={[styles.filterPillText, activeFilter === filter.key && styles.filterPillTextActive]}>{filter.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <View style={styles.errorRow}>
            <MaterialIcons name="error-outline" size={18} color={PetCareTheme.colors.danger} />
            <Text style={styles.errorText}>Paylaşımlar alınamadı: {error.message}</Text>
          </View>
        </Card>
      ) : null}

      {featuredPost ? <FeaturedPostCard post={featuredPost} currentUid={user?.uid} /> : null}
    </View>
  );

  return (
    <Screen
      title="Sosyal"
      subtitle="Paylaşımları keşfet, beğen ve yorumlarla etkileşime geç."
      right={<Button title="+ Paylaş" onPress={() => router.push('/social/new')} />}
      scroll={false}
      contentStyle={styles.screenContent}
    >
      <FlatList
        data={feedPosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SocialPostCard post={item} currentUid={user?.uid} compact />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          visiblePosts.length === 0 ? (
            <Card style={styles.emptyCard}>
              <View style={styles.emptyBadge}>
                <MaterialIcons name="diversity-3" size={28} color="#4E7A9E" />
              </View>
              <Text style={styles.emptyTitle}>Henüz paylaşım yok</Text>
              <Text style={styles.emptyText}>Topluluk akışını başlatmak için ilk gönderiyi siz oluşturabilirsiniz.</Text>
              <Button title="Paylaşım Oluştur" onPress={() => router.push('/social/new')} />
            </Card>
          ) : null
        }
        contentContainerStyle={styles.feedListContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={5}
        maxToRenderPerBatch={8}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews
      />
    </Screen>
  );
}

function StoryBubbleNew({ onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.storyBubbleWrap, pressed && { opacity: 0.88 }]}> 
      <View style={[styles.storyRing, styles.storyRingNew]}>
        <View style={[styles.storyInner, styles.storyInnerNew]}>
          <MaterialIcons name="add" size={20} color="#2C5E86" />
        </View>
      </View>
      <Text style={styles.storyLabel} numberOfLines={1}>Yeni</Text>
      <Text style={styles.storySub} numberOfLines={1}>Paylaş</Text>
    </Pressable>
  );
}

function StoryBubble({ item }) {
  return (
    <Pressable onPress={() => Alert.alert('Yakında', 'Hikâye detayı sonraki aşamada eklenecek.')} style={({ pressed }) => [styles.storyBubbleWrap, pressed && { opacity: 0.88 }]}> 
      <View style={styles.storyRing}>
        <View style={styles.storyInner}>
          {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.storyImage} contentFit="cover" /> : <MaterialIcons name="pets" size={18} color="#3D6B93" />}
        </View>
      </View>
      <Text style={styles.storyLabel} numberOfLines={1}>{item.label}</Text>
      <Text style={styles.storySub} numberOfLines={1}>{item.subtitle}</Text>
    </Pressable>
  );
}

function FeaturedPostCard({ post, currentUid }) {
  return <SocialPostCard post={post} currentUid={currentUid} featured />;
}

function SocialPostCard({ post, currentUid, compact = false, featured = false }) {
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  useEffect(() => {
    if (!currentUid) return undefined;
    return subscribePostLikeState(post.id, currentUid, setLiked, () => {});
  }, [post.id, currentUid]);

  const handleToggleLike = async () => {
    if (!currentUid || likeBusy) return;
    try {
      setLikeBusy(true);
      await togglePostLike(post.id, currentUid);
    } catch (err) {
      Alert.alert('Beğeni hatası', err.message);
    } finally {
      setLikeBusy(false);
    }
  };

  const ownerName = post.ownerName || 'PetCare Kullanıcısı';

  return (
    <Card style={[styles.postCard, featured && styles.postCardFeatured, compact && styles.postCardCompact]}>
      <Pressable onPress={() => router.push(`/social/${post.id}`)} style={({ pressed }) => [styles.postPressArea, pressed && { opacity: 0.97 }]}> 
        <View style={styles.postHeader}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarGlow} />
            <View style={styles.avatarInner}>
              <MaterialIcons name="pets" size={17} color="#2D638F" />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.ownerRow}>
              <Text style={styles.ownerName} numberOfLines={1}>{ownerName}</Text>
              {post.petName ? (
                <View style={styles.petChip}>
                  <MaterialIcons name="pets" size={12} color="#4E7BA0" />
                  <Text style={styles.petChipText} numberOfLines={1}>{post.petName}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.postMeta}>{formatDateTime(post.createdAt)}</Text>
          </View>

          <Pressable onPress={() => Alert.alert('Yakında', 'Gönderi menüsü sonraki aşamada eklenecek.')} style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.85 }]}> 
            <MaterialIcons name="more-horiz" size={18} color="#6E8EA5" />
          </Pressable>
        </View>

        {post.imageUrl ? (
          <View style={styles.imageShell}>
            <Image source={{ uri: post.imageUrl }} style={[styles.postImage, compact && styles.postImageCompact, featured && styles.postImageFeatured]} contentFit="cover" />
          </View>
        ) : (
          <View style={[styles.imagePlaceholder, compact && styles.imagePlaceholderCompact, featured && styles.imagePlaceholderFeatured]}>
            <View style={styles.imagePlaceholderGlowA} />
            <View style={styles.imagePlaceholderGlowB} />
            <View style={styles.imagePlaceholderIcon}>
              <MaterialIcons name="image-not-supported" size={22} color="#7191A9" />
            </View>
            <Text style={styles.imagePlaceholderTitle}>Fotoğraf yok</Text>
            <Text style={styles.imagePlaceholderText}>Bu gönderi şimdilik metin odaklı paylaşıldı.</Text>
          </View>
        )}

        <View style={styles.postBody}>
          {post.caption ? <Text style={[styles.caption, featured && styles.captionFeatured]}>{post.caption}</Text> : null}
          <View style={styles.metaStatsRow}>
            <MetaStat icon="favorite" value={post.likeCount || 0} label="beğeni" tone="rose" />
            <MetaStat icon="chat-bubble-outline" value={post.commentCount || 0} label="yorum" tone="sky" />
          </View>
        </View>
      </Pressable>

      <View style={styles.actionsRow}>
        <Pressable onPress={handleToggleLike} style={({ pressed }) => [styles.actionBtn, styles.primaryActionBtn, liked && styles.primaryActionBtnLiked, pressed && { opacity: 0.9 }]}> 
          <MaterialIcons name={liked ? 'favorite' : 'favorite-border'} size={18} color={liked ? '#C63A48' : '#2C5E86'} />
          <Text style={[styles.actionText, liked && styles.actionTextLiked]}>{liked ? 'Beğenildi' : 'Beğen'}</Text>
        </Pressable>

        <Pressable onPress={() => router.push(`/social/${post.id}`)} style={({ pressed }) => [styles.actionBtn, styles.secondaryActionBtn, pressed && { opacity: 0.9 }]}> 
          <MaterialIcons name="chat-bubble-outline" size={18} color="#2C5E86" />
          <Text style={styles.actionText}>Yorumlar</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function HeroStat({ icon, label, value, tone }) {
  const tones = {
    blue: { bg: '#EEF6FF', border: '#DCEAF8', icon: '#47759A', text: '#2B5D84', sub: '#7390A6' },
    rose: { bg: '#FFF4F7', border: '#F2D6DE', icon: '#C25A6F', text: '#9E3850', sub: '#A67683' },
    mint: { bg: '#F2FBF7', border: '#D9EEE4', icon: '#2E9673', text: '#22664E', sub: '#628C79' },
  };
  const t = tones[tone] || tones.blue;
  return (
    <View style={[styles.heroStatCard, { backgroundColor: t.bg, borderColor: t.border }]}> 
      <MaterialIcons name={icon} size={14} color={t.icon} />
      <Text style={[styles.heroStatValue, { color: t.text }]}>{value}</Text>
      <Text style={[styles.heroStatLabel, { color: t.sub }]}>{label}</Text>
    </View>
  );
}

function MetaStat({ icon, value, label, tone = 'sky' }) {
  const palette = metaStatTones[tone] || metaStatTones.sky;
  return (
    <View style={[styles.metaStatPill, { backgroundColor: palette.bg, borderColor: palette.border }]}> 
      <MaterialIcons name={icon} size={13} color={palette.icon} />
      <Text style={[styles.metaStatText, { color: palette.text }]}>{value} {label}</Text>
    </View>
  );
}

const metaStatTones = {
  sky: { bg: '#F5F9FC', border: '#E3ECF3', icon: '#6E8EA6', text: '#6F8EA7' },
  rose: { bg: '#FFF5F7', border: '#F2D6DC', icon: '#C15A6D', text: '#A2606F' },
};

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    paddingBottom: 0,
    gap: 0,
  },
  feedListContent: {
    gap: 14,
    paddingBottom: 20,
  },
  listHeaderStack: {
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#F3F9FF',
    borderColor: '#D9E9F6',
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlowA: {
    position: 'absolute',
    top: -34,
    right: -18,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: 'rgba(122, 186, 247, 0.16)',
  },
  heroGlowB: {
    position: 'absolute',
    bottom: -34,
    left: -18,
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 158, 180, 0.10)',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#E6F1FB',
    borderWidth: 1,
    borderColor: '#D2E4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#285A81',
    fontSize: 15,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#6B8BA4',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  heroStatCard: {
    flex: 1,
    minHeight: 60,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  composerCard: {
    gap: 10,
    borderColor: '#E0EAF3',
  },
  composerTopRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  composerInputFake: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDE8F2',
    backgroundColor: '#F9FBFD',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  composerAvatarFake: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#E9F3FD',
    borderWidth: 1,
    borderColor: '#D6E7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerPlaceholder: {
    color: '#6E8EA7',
    fontSize: 12,
    flex: 1,
  },
  composeFab: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: PetCareTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  composerFooter: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  composerFooterText: {
    color: '#7A98AD',
    fontSize: 11,
    fontWeight: '600',
  },
  storiesSection: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#295A80',
    fontSize: 14,
    fontWeight: '800',
  },
  sectionLink: {
    color: PetCareTheme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  storyRowWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingRight: 6,
  },
  storyBubbleWrap: {
    width: 68,
    alignItems: 'center',
    gap: 4,
  },
  storyRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 2,
    backgroundColor: '#E4EEF7',
    borderWidth: 1,
    borderColor: '#D5E6F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRingNew: {
    backgroundColor: '#EAF5FF',
    borderColor: '#CFE4F7',
  },
  storyInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F8FBFE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E1EBF3',
    overflow: 'hidden',
  },
  storyInnerNew: {
    backgroundColor: '#F2F8FD',
  },
  storyImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EDF3F8',
  },
  storyLabel: {
    color: '#305E84',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  storySub: {
    color: '#7A96AA',
    fontSize: 10,
    textAlign: 'center',
  },
  filtersSection: {
    gap: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterPill: {
    borderWidth: 1,
    borderColor: '#DCE8F2',
    backgroundColor: '#FBFDFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  filterPillActive: {
    backgroundColor: '#EAF4FD',
    borderColor: '#CDE1F2',
  },
  filterPillText: {
    color: '#6D8CA5',
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#2E628E',
  },
  errorCard: {
    borderColor: '#F2D0D5',
    backgroundColor: '#FFF4F6',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: PetCareTheme.colors.danger,
    lineHeight: 18,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  emptyBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#D8E7F4',
    backgroundColor: '#ECF4FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#2C5D84',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: '#6E8EA7',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  postCard: {
    gap: 10,
    borderRadius: 18,
    borderColor: '#E0EAF3',
    backgroundColor: '#FFFFFF',
  },
  postCardFeatured: {
    borderColor: '#D4E6F8',
    backgroundColor: '#FBFDFF',
  },
  postCardCompact: {
    gap: 8,
  },
  postPressArea: {
    gap: 10,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 14,
    backgroundColor: '#E7F2FD',
    borderWidth: 1,
    borderColor: '#D3E5F6',
  },
  avatarInner: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: '#F6FBFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0EDF8',
  },
  ownerRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  ownerName: {
    color: '#214F73',
    fontWeight: '700',
    fontSize: 14,
    flexShrink: 1,
  },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDF5FD',
    borderWidth: 1,
    borderColor: '#D9E8F5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  petChipText: {
    color: '#4E7AA0',
    fontSize: 11,
    fontWeight: '700',
  },
  postMeta: {
    color: '#6F8EA7',
    fontSize: 12,
    marginTop: 1,
  },
  menuBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F8FB',
    borderWidth: 1,
    borderColor: '#E2EBF2',
  },
  imageShell: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DFE9F2',
    backgroundColor: '#F4F8FB',
  },
  postImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#EEF3F7',
  },
  postImageCompact: {
    height: 180,
  },
  postImageFeatured: {
    height: 250,
  },
  imagePlaceholder: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DFE9F2',
    backgroundColor: '#F8FBFE',
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  imagePlaceholderCompact: {
    minHeight: 130,
  },
  imagePlaceholderFeatured: {
    minHeight: 180,
  },
  imagePlaceholderGlowA: {
    position: 'absolute',
    top: -14,
    right: -10,
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: 'rgba(120, 186, 246, 0.12)',
  },
  imagePlaceholderGlowB: {
    position: 'absolute',
    bottom: -18,
    left: -8,
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 165, 188, 0.10)',
  },
  imagePlaceholderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECF4FB',
    borderWidth: 1,
    borderColor: '#DCEAF5',
  },
  imagePlaceholderTitle: {
    color: '#2B5A7F',
    fontSize: 13,
    fontWeight: '700',
  },
  imagePlaceholderText: {
    color: '#6F8EA7',
    fontSize: 12,
    textAlign: 'center',
  },
  postBody: {
    gap: 8,
  },
  caption: {
    color: PetCareTheme.colors.text,
    lineHeight: 19,
    fontSize: 13,
  },
  captionFeatured: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaStatsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  metaStatText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryActionBtn: {
    backgroundColor: '#F3F9FF',
    borderColor: '#D9E8F6',
  },
  primaryActionBtnLiked: {
    backgroundColor: '#FFF3F5',
    borderColor: '#F0D2D9',
  },
  secondaryActionBtn: {
    backgroundColor: '#F7FBFF',
    borderColor: '#DCEAF8',
  },
  actionText: {
    color: '#2C5E86',
    fontSize: 12,
    fontWeight: '700',
  },
  actionTextLiked: {
    color: '#B83C4D',
  },
});
