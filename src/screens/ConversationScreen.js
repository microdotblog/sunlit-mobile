import React from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { observer } from 'mobx-react';
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Avatar from '../components/Avatar';
import { format_relative_date } from '../components/formatDate';
import HtmlText from '../components/HtmlText';
import { LoadingFooter, MessageState } from '../components/ListStates';
import PhotoCarousel from '../components/PhotoCarousel';
import PostRow from '../components/PostRow';
import { use_post_list } from '../components/usePostList';
import { build_post_actions, perform_post_action } from '../components/postActions';
import { build_reply_text, resolve_recipients } from '../components/replyText';
import { HeaderIconButton } from '../navigation/headers';
import { open_link } from '../navigation/links';
import ContextMenu from '../platform/ContextMenu';
import Icon from '../platform/Icon';
import AppStore from '../stores/App';
import Auth from '../stores/Auth';
import Posts from '../stores/Posts';
import ReplyDrafts from '../stores/ReplyDrafts';
import { conversation_key } from '../stores/createPostsStore';
import { use_theme } from '../theme/theme';

const EMOJI = ['🙂', '👍', '❤️', '😂', '😍', '😌', '🤔', '🙏', '🔥'];

function ConversationScreen({ navigation, route }) {
  const id = `${route.params?.id || ''}`.trim();

  if (!id) {
    return <MessageState message="This post could not be found." title="Nothing here" />;
  }

  return <Conversation id={id} navigation={navigation} />;
}

const Conversation = observer(function Conversation({ id, navigation }) {
  const theme = use_theme();
  const header_height = useHeaderHeight();
  const key = conversation_key(id);
  const list = use_post_list(key, { refresh_on_mount: true });
  const source_post = Posts.get_post(id);
  const thread = list ? list.posts() : [];
  const hero_post = thread.length > 0 ? thread[0] : source_post;
  const replies = thread.slice(1);

  React.useLayoutEffect(() => {
    if (!hero_post) {
      navigation.setOptions({ headerRight: undefined });
      return;
    }

    const actions = build_post_actions(hero_post, { include_conversation: false });

    navigation.setOptions({
      headerRight: () => (
        <ContextMenu
          actions={actions}
          on_action={action_id => perform_post_action(navigation, hero_post, action_id, { on_deleted: () => navigation.goBack() })}
          open_on_long_press={false}
        >
          {({ open_menu }) => <HeaderIconButton icon="more" label="More options" on_press={open_menu} />}
        </ContextMenu>
      ),
    });
  }, [navigation, hero_post, hero_post?.is_bookmark]);

  function render_header() {
    if (!hero_post) {
      return null;
    }

    return <ConversationHero navigation={navigation} post={hero_post} />;
  }

  function render_empty() {
    if (list?.error_message) {
      return <MessageState action_title="Try again" message={list.error_message} on_action={() => Posts.refresh(key)} />;
    }

    return <LoadingFooter is_loading={!list?.did_load} />;
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={header_height}
      style={[styles.screen, { backgroundColor: theme.colors.canvas }]}
    >
      <FlatList
        ListEmptyComponent={render_empty}
        ListHeaderComponent={render_header}
        data={replies}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={[theme.colors.accent]}
            onRefresh={() => Posts.refresh(key)}
            progressBackgroundColor={theme.colors.canvas}
            refreshing={Boolean(list?.is_refreshing)}
          />
        }
        renderItem={({ item }) => (
          <PostRow include_conversation_action={false} navigation={navigation} post={item} />
        )}
        style={styles.list}
      />
      {Auth.is_signed_in() && hero_post ? <ReplyBar posts={thread} reply_to_id={id} /> : null}
    </KeyboardAvoidingView>
  );
});

const ConversationHero = observer(function ConversationHero({ post, navigation }) {
  const theme = use_theme();
  const { width } = useWindowDimensions();

  return (
    <View style={[styles.hero, { borderBottomColor: theme.colors.line }]}>
      {post.has_media() ? (
        <PhotoCarousel
          on_press={index => navigation.push('ImageViewer', { id: post.id, index })}
          post={post}
          width={width}
        />
      ) : null}
      <View style={styles.hero_body}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.push('Profile', { username: post.author.username })}
          style={styles.hero_author}
        >
          <Avatar size={36} uri={post.author.avatar} />
          <View style={styles.hero_author_copy}>
            <Text numberOfLines={1} style={[styles.hero_name, { color: theme.colors.ink }]}>
              {post.author.display_name()}
            </Text>
            <Text numberOfLines={1} style={[styles.hero_meta, { color: theme.colors.ink_soft }]}>
              @{post.author.username} · {format_relative_date(post.date_published)}
            </Text>
          </View>
          {post.is_bookmark ? <Icon color={theme.colors.accent} name="bookmark" size={20} /> : null}
        </Pressable>
        {post.has_text() ? (
          <HtmlText on_link={href => open_link(navigation, href)} paragraphs={post.paragraphs} />
        ) : null}
      </View>
    </View>
  );
});

const ReplyBar = observer(function ReplyBar({ reply_to_id, posts }) {
  const theme = use_theme();
  const insets = useSafeAreaInsets();
  const [text, set_text] = React.useState(() => ReplyDrafts.get_draft(reply_to_id));
  const is_keyboard_visible = useKeyboardState(state => state.isVisible);
  const [is_sending, set_is_sending] = React.useState(false);
  const [excluded_usernames, set_excluded_usernames] = React.useState([]);
  const recipients = resolve_recipients(posts, Auth.profile_username);
  const selected_recipients = recipients.filter(username => !excluded_usernames.includes(username));
  const can_send = text.trim().length > 0 && !is_sending;

  function update_text(next_text) {
    set_text(next_text);
    ReplyDrafts.set_draft(reply_to_id, next_text);
  }

  function toggle_recipient(username) {
    if (excluded_usernames.includes(username)) {
      set_excluded_usernames(excluded_usernames.filter(excluded => excluded !== username));
    } else {
      set_excluded_usernames([...excluded_usernames, username]);
    }
  }

  async function send() {
    set_is_sending(true);

    try {
      await Posts.send_reply(reply_to_id, build_reply_text(selected_recipients, text));
      ReplyDrafts.clear_draft(reply_to_id);
      set_text('');
      AppStore.show_toast('Reply sent');
    } catch (error) {
      AppStore.show_toast('Could not send your reply');
    } finally {
      set_is_sending(false);
    }
  }

  return (
    <View
      style={[
        styles.reply_bar,
        {
          backgroundColor: theme.colors.canvas,
          borderTopColor: theme.colors.line,
          paddingBottom: is_keyboard_visible ? 8 : insets.bottom + 8,
        },
      ]}
    >
      {recipients.length > 0 && (is_keyboard_visible || text) ? (
        <View style={styles.recipients}>
          {recipients.map(username => {
            const is_selected = selected_recipients.includes(username);

            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: is_selected }}
                key={username}
                onPress={() => toggle_recipient(username)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: is_selected ? theme.colors.accent_soft : theme.colors.canvas,
                    borderColor: is_selected ? theme.colors.accent : theme.colors.line,
                  },
                ]}
              >
                <Text style={[styles.chip_label, { color: is_selected ? theme.colors.accent : theme.colors.ink_soft }]}>
                  @{username}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <View style={styles.reply_row}>
        <TextInput
          multiline
          onChangeText={update_text}
          placeholder="Reply…"
          placeholderTextColor={theme.colors.ink_soft}
          style={[styles.reply_input, { backgroundColor: theme.colors.surface, color: theme.colors.ink }]}
          value={text}
        />
        <Pressable
          accessibilityLabel="Send reply"
          accessibilityRole="button"
          disabled={!can_send}
          onPress={send}
          style={[styles.send_button, { opacity: can_send ? 1 : 0.4 }]}
        >
          {is_sending ? (
            <ActivityIndicator color={theme.colors.accent} />
          ) : (
            <Icon color={theme.colors.accent} name="send" size={24} />
          )}
        </Pressable>
      </View>
      {is_keyboard_visible ? (
        <View style={styles.emoji_row}>
          {EMOJI.map(emoji => (
            <Pressable
              accessibilityLabel={`Insert ${emoji}`}
              android_ripple={{ borderless: true, color: theme.colors.selection, radius: 20 }}
              key={emoji}
              onPress={() => update_text(`${text}${emoji}`)}
              style={styles.emoji_button}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  hero: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hero_body: {
    gap: 12,
    padding: 16,
  },
  hero_author: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  hero_author_copy: {
    flex: 1,
  },
  hero_name: {
    fontSize: 16,
    fontWeight: '600',
  },
  hero_meta: {
    fontSize: 13,
  },
  reply_bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  recipients: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chip_label: {
    fontSize: 13,
    fontWeight: '500',
  },
  reply_row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  reply_input: {
    borderRadius: 20,
    flex: 1,
    fontSize: 16,
    maxHeight: 140,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  send_button: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  emoji_row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emoji_button: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 36,
  },
  emoji: {
    fontSize: 22,
  },
});

export default observer(ConversationScreen);
