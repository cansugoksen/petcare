import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, Screen } from '@/components/pc/ui';
import { PetCareTheme } from '@/constants/petcare-theme';
import { formatDateTime } from '@/lib/date-utils';
import { subscribePostLikeState, subscribeSocialFeed, togglePostLike } from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

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

  useEffect(() => {
    const unsub = subscribeSocialFeed(
      (rows) => {
        setPosts(rows.slice(0, 30));
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

  return (
    <Screen title="Sosyal" subtitle="Paylaşımları keşfet, beğen ve yorumlarla etkileşime geç." right={<Button title="+ Paylaş" onPress={() => router.push('/social/new')} />}>
      <Card style={styles.heroCard}>
        <View style={styles.heroGlowA} />
        <View style={styles.heroGlowB} />

        <View style={styles.heroTopRow}>
          <View style={styles.heroIconBox}>
            <MaterialIcons name="photo-library" size={20} color="#315F86" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Topluluk Akışı</Text>
            <Text style={styles.heroText}>Gönderi detayında yorumları görebilir, beğeni bırakabilir ve etkileşime geçebilirsiniz.</Text>
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <StatPill icon="grid-view" label="Gönderi" value={stats.posts} tone="sky" />
          <StatPill icon="favorite" label="Beğeni" value={stats.likes} tone="rose" />
          <StatPill icon="chat-bubble" label="Yorum" value={stats.comments} tone="mint" />
        </View>

        <View style={styles.filterRow}>
          <FilterPill label="Tümü" active />
          <FilterPill label="Yeni" />
          <FilterPill label="Benim Paylaşımlarım" />
        </View>
      </Card>

      <Card style={styles.noticeCard}>
        <View style={styles.noticeRow}>
          <View style={styles.noticeIconWrap}>
            <MaterialIcons name="build-circle" size={18} color="#956500" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>Fotoğraf paylaşımı bakımda</Text>
            <Text style={styles.noticeText}>Sosyal gönderi fotoğraf yükleme geçici olarak kapalı. Feed görüntüleme, beğeni ve yorum akışı çalışır.</Text>
          </View>
        </View>
      </Card>

      {error ? (
        <Card style={styles.errorCard}>
          <View style={styles.errorRow}>
            <MaterialIcons name="error-outline" size={18} color={PetCareTheme.colors.danger} />
            <Text style={styles.errorText}>Paylaşımlar alınamadı: {error.message}</Text>
          </View>
        </Card>
      ) : null}

      {posts.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyBadge}>
            <MaterialIcons name="pets" size={28} color="#4E7A9E" />
          </View>
          <Text style={styles.emptyTitle}>Henüz paylaşım yok</Text>
          <Text style={styles.emptyText}>
            Sosyal alanı başlatmak için ilk paylaşımı oluşturabilirsiniz. Fotoğraf yükleme bakımda olduğu için şu an metin odaklı paylaşım önerilir.
          </Text>
          <Button title="Paylaşım Oluştur" onPress={() => router.push('/social/new')} />
        </Card>
      ) : (
        posts.map((post) => <SocialPostCard key={post.id} post={post} currentUid={user?.uid} />)
      )}
    </Screen>
  );
}

function SocialPostCard({ post, currentUid }) {
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
    <Card style={styles.postCard}>
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
              <Text style={styles.ownerName} numberOfLines={1}>
                {ownerName}
              </Text>
              {post.petName ? (
                <View style={styles.petChip}>
                  <MaterialIcons name="pets" size={12} color="#4E7BA0" />
                  <Text style={styles.petChipText} numberOfLines={1}>
                    {post.petName}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.postMeta}>{formatDateTime(post.createdAt)}</Text>
          </View>

          <Pressable
            onPress={() => Alert.alert('Yakında', 'Gönderi menüsü sonraki aşamada eklenecek.')}
            style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.85 }]}>
            <MaterialIcons name="more-horiz" size={18} color="#6E8EA5" />
          </Pressable>
        </View>

        {post.imageUrl ? (
          <View style={styles.imageShell}>
            <Image source={{ uri: post.imageUrl }} style={styles.postImage} contentFit="cover" />
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
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
          {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
          <View style={styles.metaStatsRow}>
            <MetaStat icon="favorite" value={post.likeCount || 0} label="beğeni" tone="rose" />
            <MetaStat icon="chat-bubble-outline" value={post.commentCount || 0} label="yorum" tone="sky" />
          </View>
        </View>
      </Pressable>

      <View style={styles.actionsRow}>
        <Pressable
          onPress={handleToggleLike}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.primaryActionBtn,
            liked && styles.primaryActionBtnLiked,
            pressed && { opacity: 0.9 },
          ]}>
          <MaterialIcons name={liked ? 'favorite' : 'favorite-border'} size={18} color={liked ? '#C63A48' : '#2C5E86'} />
          <Text style={[styles.actionText, liked && styles.actionTextLiked]}>{liked ? 'Beğenildi' : 'Beğen'}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push(`/social/${post.id}`)}
          style={({ pressed }) => [styles.actionBtn, styles.secondaryActionBtn, pressed && { opacity: 0.9 }]}>
          <MaterialIcons name="chat-bubble-outline" size={18} color="#2C5E86" />
          <Text style={styles.actionText}>Yorumlar</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function StatPill({ icon, label, value, tone = 'sky' }) {
  const palette = statPillTones[tone] || statPillTones.sky;
  return (
    <View style={[styles.statPill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <MaterialIcons name={icon} size={14} color={palette.icon} />
      <Text style={[styles.statValue, { color: palette.value }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: palette.label }]}>{label}</Text>
    </View>
  );
}

function FilterPill({ label, active }) {
  return (
    <Pressable onPress={() => {}} style={({ pressed }) => [styles.filterPill, active && styles.filterPillActive, pressed && { opacity: 0.88 }]}>
      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function MetaStat({ icon, value, label, tone = 'sky' }) {
  const palette = metaStatTones[tone] || metaStatTones.sky;
  return (
    <View style={[styles.metaStatPill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <MaterialIcons name={icon} size={13} color={palette.icon} />
      <Text style={[styles.metaStatText, { color: palette.text }]}>
        {value} {label}
      </Text>
    </View>
  );
}

const statPillTones = {
  sky: { bg: '#F3F9FF', border: '#DCEAF8', icon: '#4A799D', value: '#27567B', label: '#6E8EA7' },
  rose: { bg: '#FFF5F7', border: '#F2D5DC', icon: '#C15A6D', value: '#9C3348', label: '#A46D79' },
  mint: { bg: '#F1FBF6', border: '#D7EEDF', icon: '#3A9A79', value: '#23694F', label: '#5E8876' },
};

const metaStatTones = {
  sky: { bg: '#F5F9FC', border: '#E3ECF3', icon: '#6E8EA6', text: '#6F8EA7' },
  rose: { bg: '#FFF5F7', border: '#F2D6DC', icon: '#C15A6D', text: '#A2606F' },
};

const styles = StyleSheet.create({
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
  heroTopRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  heroIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#E4F0FC',
    borderWidth: 1,
    borderColor: '#D0E3F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#27567B',
    fontSize: 14,
    fontWeight: '700',
  },
  heroText: {
    color: '#6D8DA7',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    minHeight: 34,
  },
  statValue: {
    fontWeight: '700',
    fontSize: 12,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
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
  noticeCard: {
    backgroundColor: '#FFF9EE',
    borderColor: '#F0E0BF',
  },
  noticeRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  noticeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF0CC',
    borderWidth: 1,
    borderColor: '#EEDCB3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeTitle: {
    color: '#785606',
    fontSize: 13,
    fontWeight: '700',
  },
  noticeText: {
    color: '#8A6A27',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
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
    width: 38,
    height: 38,
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
    height: 240,
    backgroundColor: '#EEF3F7',
  },
  imagePlaceholder: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DFE9F2',
    backgroundColor: '#F8FBFE',
    minHeight: 170,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    position: 'relative',
    overflow: 'hidden',
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
