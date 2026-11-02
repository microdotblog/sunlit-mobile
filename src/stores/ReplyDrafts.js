import { File, Paths } from 'expo-file-system';
import { applySnapshot, flow, types } from 'mobx-state-tree';

const DRAFTS_FILE_NAME = 'reply-drafts.json';
const PERSIST_DELAY_MS = 400;

const ReplyDrafts = types
  .model('ReplyDrafts', {
    drafts: types.map(types.string),
  })
  .volatile(() => ({
    did_hydrate: false,
    persist_timeout_id: null,
  }))
  .actions(self => ({
    hydrate: flow(function* () {
      if (self.did_hydrate) {
        return;
      }

      try {
        const file = drafts_file();

        if (file.exists) {
          const text = yield file.text();
          applySnapshot(self, { drafts: JSON.parse(text) });
        }
      } catch (error) {
        applySnapshot(self, {});
      }

      self.did_hydrate = true;
    }),

    set_draft(post_id, text = '') {
      if (text.trim()) {
        self.drafts.set(post_id, text);
      } else {
        self.drafts.delete(post_id);
      }

      self.schedule_persist();
    },

    clear_draft(post_id) {
      self.set_draft(post_id, '');
    },

    schedule_persist() {
      if (self.persist_timeout_id) {
        clearTimeout(self.persist_timeout_id);
      }

      self.persist_timeout_id = setTimeout(() => {
        self.persist();
      }, PERSIST_DELAY_MS);
    },

    persist() {
      self.persist_timeout_id = null;

      try {
        drafts_file().write(JSON.stringify(self.drafts.toJSON()));
      } catch (error) {
        console.error('Could not save reply drafts.', error);
      }
    },

    reset() {
      if (self.persist_timeout_id) {
        clearTimeout(self.persist_timeout_id);
      }

      applySnapshot(self, {});

      try {
        const file = drafts_file();

        if (file.exists) {
          file.delete();
        }
      } catch (error) {
        console.error('Could not remove reply drafts.', error);
      }
    },
  }))
  .views(self => ({
    get_draft(post_id) {
      return self.drafts.get(post_id) || '';
    },
  }))
  .create();

function drafts_file() {
  return new File(Paths.document, DRAFTS_FILE_NAME);
}

export default ReplyDrafts;
