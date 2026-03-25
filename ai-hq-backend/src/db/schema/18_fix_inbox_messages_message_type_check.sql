BEGIN;

ALTER TABLE inbox_messages
DROP CONSTRAINT IF EXISTS inbox_messages_message_type_check;

UPDATE inbox_messages
SET message_type = CASE
  WHEN message_type IS NULL OR btrim(message_type) = '' THEN 'text'

  WHEN lower(btrim(message_type)) IN (
    'text',
    'image',
    'video',
    'audio',
    'file',
    'document',
    'voice',
    'sticker',
    'gif',
    'location',
    'contact',
    'story_reply',
    'reaction',
    'button',
    'interactive',
    'system',
    'other'
  ) THEN lower(btrim(message_type))

  WHEN lower(btrim(message_type)) IN ('attachment', 'attachments', 'doc') THEN 'file'
  WHEN lower(btrim(message_type)) IN ('voice_note', 'voice-message', 'voice_message') THEN 'voice'
  WHEN lower(btrim(message_type)) IN ('story-reply', 'storyreply') THEN 'story_reply'

  WHEN lower(btrim(message_type)) IN (
    'template',
    'template_message',
    'template-message',
    'quick_reply',
    'quick-reply',
    'carousel',
    'list'
  ) THEN 'interactive'

  WHEN lower(btrim(message_type)) IN (
    'typing_on',
    'typing_off',
    'mark_seen',
    'typing',
    'typing_start',
    'typing-start',
    'typingon',
    'typing-on',
    'typing_stop',
    'typing-stop',
    'typingoff',
    'typing-off',
    'seen',
    'read',
    'markseen',
    'mark-seen'
  ) THEN 'system'

  WHEN lower(btrim(message_type)) IN ('unknown', 'unsupported') THEN 'other'

  ELSE 'other'
END;

ALTER TABLE inbox_messages
ALTER COLUMN message_type SET DEFAULT 'text';

UPDATE inbox_messages
SET message_type = 'text'
WHERE message_type IS NULL OR btrim(message_type) = '';

ALTER TABLE inbox_messages
ALTER COLUMN message_type SET NOT NULL;

ALTER TABLE inbox_messages
ADD CONSTRAINT inbox_messages_message_type_check
CHECK (
  message_type IN (
    'text',
    'image',
    'video',
    'audio',
    'file',
    'document',
    'voice',
    'sticker',
    'gif',
    'location',
    'contact',
    'story_reply',
    'reaction',
    'button',
    'interactive',
    'system',
    'other'
  )
);

COMMIT;