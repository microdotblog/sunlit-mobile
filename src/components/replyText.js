export function resolve_recipients(posts, own_username) {
  const usernames = posts.flatMap(post => post.mentioned_usernames());

  return [...new Set(usernames)].filter(username => username && username !== own_username);
}

export function build_reply_text(usernames, text) {
  const prefix = usernames.map(username => `@${username}`).join(' ');
  const trimmed_text = text.trim();

  if (prefix) {
    return `${prefix} ${trimmed_text}`;
  } else {
    return trimmed_text;
  }
}
