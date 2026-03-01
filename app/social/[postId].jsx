import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, Field, Screen } from '@/components/pc/ui';
import { PetCareTheme } from '@/constants/petcare-theme';
import { formatDateTime } from '@/lib/date-utils';
import {
  createPostComment,
  subscribePostComments,
  subscribePostLikeState,
  subscribeSocialPost,
  togglePostLike,
} from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

export default function SocialPostDetailRoute() {
  return (
    <AuthGate>
      <SocialPostDetailScreen />
    </AuthGate>
  );
}

function SocialPostDetailScreen() {
  const { postId } = useLocalSearchParams();
  const id = String(postId || '');
  const { user } = useAuth();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('GÃ¶nderi bulunamadÄ±.');
      setLoading(false);
      return undefined;
    }

    return subscribeSocialPost(
      id,
      (row) => {
        setPost(row);
        setLoading(false);
        setError(row ? '' : 'GÃ¶nderi bulunamadÄ±.');
      },
      (err) => {
        setError(err.message || 'GÃ¶nderi alÄ±namadÄ±.');
        setLoading(false);
      }
    );
  }, [id]);

  useEffect(() => {
    if (!id) return undefined;
    return subscribePostComments(id, setComments, () => {});
  }, [id]);

  useEffect(() => {
    if (!id || !user?.uid) {
      setLiked(false);
      return undefined;
    }
    return subscribePostLikeState(id, user.uid, setLiked, () => {});
  }, [id, user?.uid]);

  const subtitle = useMemo(() => {
    if (loading) return 'YÃ¼kleniyor...';
    return `${comments.length} yorum`;
  }, [loading, comments.length]);

  const handleToggleLike = async () => {
    if (!user?.uid || !id || !post || likeBusy) return;

    try {
      setLikeBusy(true);
      await togglePostLike(id, user.uid);
    } catch (err) {
      Alert.alert('BeÄŸeni hatasÄ±', err.message);
    } finally {
      setLikeBusy(false);
    }
  };

  const handleSendComment = async () => {
    if (!user?.uid || !id || !post || commentBusy) return;

    const text = commentText.trim();
    if (!text) {
      Alert.alert('Yorum gerekli', 'LÃ¼tfen yorum alanÄ±nÄ± doldurun.');
      return;
    }

    try {
      setCommentBusy(true);
      await createPostComment(id, user.uid, {
        userName: user.displayName || `KullanÄ±cÄ± ${String(user.uid || '').slice(0, 6)}`,
        text,
      });
      setCommentText('');
    } catch (err) {
      Alert.alert('Yorum gÃ¶nderilemedi', err.message);
    } finally {
      setCommentBusy(false);
    }
  };

  return (
    <Screen title="GÃ¶nderi DetayÄ±" subtitle={subtitle} scroll>
      {error ? (
        <Card style={styles.errorCard}>
          <View style={styles.errorRow}>
            <MaterialIcons name="error-outline" size={18} color={PetCareTheme.colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </Card>
      ) : null}

      {post ? (
        <Card style={styles.postCard}>
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
                  {post.ownerName || 'PetCare KullanÄ±cÄ±sÄ±'}
                </Text>
                {post.petName ? (
                  <View style={styles.petChip}>
                    <MaterialIcons name="pets" size={12} color="#4E7BA0" />
                    <Text style={styles.petChipText}>{post.petName}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.postMeta}>{formatDateTime(post.createdAt)}</Text>
            </View>
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
                <MaterialIcons name="image-not-supported" size={22} color="#7291A8" />
              </View>
              <Text style={styles.imagePlaceholderTitle}>FotoÄŸraf yok</Text>
              <Text style={styles.imagePlaceholderText}>Bu gÃ¶nderi ÅŸu an gÃ¶rselsiz paylaÅŸÄ±ldÄ±.</Text>
            </View>
          )}

          {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}

          <View style={styles.metaStatsRow}>
            <MetaStat icon="favorite" value={post.likeCount || 0} label="beÄŸeni" tone="rose" />
            <MetaStat icon="chat-bubble-outline" value={post.commentCount || 0} label="yorum" tone="sky" />
          </View>

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
              <Text style={[styles.actionText, liked && styles.actionTextLiked]}>{liked ? 'BeÄŸenildi' : 'BeÄŸen'}</Text>
            </Pressable>

            <View style={[styles.actionBtn, styles.secondaryActionBtn]}>
              <MaterialIcons name="chat-bubble-outline" size={18} color="#2C5E86" />
              <Text style={styles.actionText}>Yorumlar</Text>
            </View>
          </View>
        </Card>
      ) : null}

      <Card style={styles.commentComposerCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionIconWrap}>
            <MaterialIcons name="chat" size={16} color="#3C6D93" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Yorum Yaz</Text>
            <Text style={styles.sectionSub}>GÃ¶nderiyle ilgili kÄ±sa bir not veya gÃ¶rÃ¼ÅŸ paylaÅŸÄ±n.</Text>
          </View>
        </View>

        <Field
          label="Yorum"
          value={commentText}
          onChangeText={setCommentText}
          placeholder="PaylaÅŸÄ±m hakkÄ±nda dÃ¼ÅŸÃ¼ncenizi yazÄ±n..."
          multiline
          autoCapitalize="sentences"
        />

        <View style={styles.commentComposerFooter}>
          <Text style={styles.commentHint}>Yorumlar toplulukta herkes tarafÄ±ndan gÃ¶rÃ¼ntÃ¼lenir.</Text>
          <Button title="Yorumu GÃ¶nder" onPress={handleSendComment} loading={commentBusy} disabled={!post} />
        </View>
      </Card>

      <Card style={styles.commentListHeaderCard}>
        <View style={styles.commentListHeaderRow}>
          <Text style={styles.commentListTitle}>Yorumlar</Text>
          <View style={styles.commentCountBadge}>
            <Text style={styles.commentCountText}>{comments.length}</Text>
          </View>
        </View>
      </Card>

      {comments.length === 0 ? (
        <Card style={styles.emptyCommentsCard}>
          <View style={styles.emptyCommentsIcon}>
            <MaterialIcons name="forum" size={20} color="#5A84A6" />
          </View>
          <Text style={styles.emptyCommentsTitle}>HenÃ¼z yorum yok</Text>
          <Text style={styles.emptyCommentsText}>Ä°lk yorumu yazarak sohbeti baÅŸlatabilirsiniz.</Text>
        </Card>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(comment) => comment.id}
          renderItem={({ item: comment }) => (
            <Card style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <View style={styles.commentAvatar}>
                  <MaterialIcons name="person" size={14} color="#5E86A8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.commentOwner}>{comment.userName || 'PetCare Kullanıcısı'}</Text>
                  <Text style={styles.commentMeta}>{formatDateTime(comment.createdAt)}</Text>
                </View>
              </View>
              <Text style={styles.commentText}>{comment.text}</Text>
            </Card>
          )}
          ItemSeparatorComponent={() => <View style={styles.commentListGap} />}
          scrollEnabled={false}
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={14}
          windowSize={6}
          contentContainerStyle={styles.commentListContent}
        />
      )}
    </Screen>
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

const metaStatTones = {
  sky: { bg: '#F5F9FC', border: '#E3ECF3', icon: '#6E8EA6', text: '#6F8EA7' },
  rose: { bg: '#FFF5F7', border: '#F2D6DC', icon: '#C15A6D', text: '#A2606F' },
};

const styles = StyleSheet.create({
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
    color: PetCareTheme.colors.danger,
    lineHeight: 18,
    flex: 1,
  },
  postCard: {
    gap: 10,
    borderRadius: 18,
    borderColor: '#E0EAF3',
    backgroundColor: '#FFFFFF',
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
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
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
  imageShell: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DFE9F2',
    backgroundColor: '#F4F8FB',
  },
  postImage: {
    width: '100%',
    height: 260,
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
    borderColor: '#DCE8F2',
    backgroundColor: '#F8FBFF',
  },
  primaryActionBtnLiked: {
    borderColor: '#F2CED5',
    backgroundColor: '#FFF3F5',
  },
  secondaryActionBtn: {
    borderColor: '#DCE8F2',
    backgroundColor: '#FFFFFF',
  },
  actionText: {
    color: '#2D5F87',
    fontSize: 12,
    fontWeight: '700',
  },
  actionTextLiked: {
    color: '#C63A48',
  },
  commentComposerCard: {
    gap: 10,
    borderColor: '#DFE9F2',
    backgroundColor: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#EAF4FD',
    borderWidth: 1,
    borderColor: '#D5E7F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: '#2A587D',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionSub: {
    color: '#6E8EA7',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
  commentComposerFooter: {
    gap: 8,
  },
  commentHint: {
    color: '#7C97AB',
    fontSize: 11,
  },
  commentListHeaderCard: {
    backgroundColor: '#F7FBFF',
    borderColor: '#E1EBF4',
    paddingVertical: 10,
  },
  commentListHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentListTitle: {
    color: '#2A587D',
    fontSize: 14,
    fontWeight: '700',
  },
  commentCountBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F3FD',
    borderWidth: 1,
    borderColor: '#D5E7F8',
  },
  commentCountText: {
    color: '#3A6B92',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyCommentsCard: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  emptyCommentsIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF5FD',
    borderWidth: 1,
    borderColor: '#DAE8F5',
  },
  emptyCommentsTitle: {
    color: '#29587D',
    fontWeight: '700',
  },
  emptyCommentsText: {
    color: '#6F8EA6',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  commentListContent: {
    gap: 0,
  },
  commentListGap: {
    height: 12,
  },
  commentCard: {
    gap: 8,
    borderColor: '#E2EBF3',
    backgroundColor: '#FFFFFF',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#EEF4FA',
    borderWidth: 1,
    borderColor: '#DEE8F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentOwner: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  commentMeta: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 11,
  },
  commentText: {
    color: PetCareTheme.colors.text,
    lineHeight: 19,
    fontSize: 13,
  },
});

