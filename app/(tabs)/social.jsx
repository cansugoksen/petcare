import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, EmptyState, Screen } from '@/components/pc/ui';
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

  return (
    <Screen
      title="Sosyal"
      subtitle="Pet fotoğraflarını paylaş, diğer kullanıcıların paylaşımlarını keşfet."
      right={<Button title="+ Paylaş" onPress={() => router.push('/social/new')} />}>
      {error ? (
        <Card>
          <Text style={{ color: PetCareTheme.colors.danger }}>Feed alınamadı: {error.message}</Text>
        </Card>
      ) : null}

      {posts.length === 0 ? (
        <EmptyState
          title="Henüz paylaşım yok"
          description="İlk pet fotoğrafını paylaşarak sosyal alanı başlat."
        />
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
    if (!currentUid) {
      return undefined;
    }

    return subscribePostLikeState(post.id, currentUid, setLiked, () => {});
  }, [post.id, currentUid]);

  const handleToggleLike = async () => {
    if (!currentUid || likeBusy) {
      return;
    }

    try {
      setLikeBusy(true);
      await togglePostLike(post.id, currentUid);
    } catch (err) {
      Alert.alert('Beğeni hatası', err.message);
    } finally {
      setLikeBusy(false);
    }
  };

  return (
    <Card>
      <View style={styles.postHeader}>
        <View style={styles.avatar}>
          <MaterialIcons name="pets" size={16} color={PetCareTheme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.postOwner}>{post.ownerName || 'PetCare Kullanıcısı'}</Text>
          <Text style={styles.postMeta}>
            {post.petName ? `${post.petName} • ` : ''}
            {formatDateTime(post.createdAt)}
          </Text>
        </View>
      </View>

      {post.imageUrl ? (
        <Image source={{ uri: post.imageUrl }} style={styles.postImage} contentFit="cover" />
      ) : null}

      {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}

      <View style={styles.actionsRow}>
        <Pressable onPress={handleToggleLike} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}>
          <MaterialIcons
            name={liked ? 'favorite' : 'favorite-border'}
            size={18}
            color={liked ? '#D23B4A' : PetCareTheme.colors.text}
          />
          <Text style={styles.actionText}>Beğeni ({post.likeCount || 0})</Text>
        </Pressable>

        <Pressable
          onPress={() => Alert.alert('Yakında', 'Yorum ekranını sonraki adımda ekleyeceğiz.')}
          style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}>
          <MaterialIcons name="chat-bubble-outline" size={18} color={PetCareTheme.colors.text} />
          <Text style={styles.actionText}>Yorum ({post.commentCount || 0})</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PetCareTheme.colors.primarySoft,
  },
  postOwner: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  postMeta: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
  },
  postImage: {
    width: '100%',
    height: 240,
    borderRadius: 14,
    backgroundColor: PetCareTheme.colors.surfaceAlt,
  },
  caption: {
    color: PetCareTheme.colors.text,
    lineHeight: 19,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: PetCareTheme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  actionText: {
    color: PetCareTheme.colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
});
