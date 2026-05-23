BEGIN;

ALTER TABLE inbox_threads
  DROP CONSTRAINT IF EXISTS inbox_threads_channel_check;

ALTER TABLE inbox_threads
  ADD CONSTRAINT inbox_threads_channel_check
  CHECK (
    channel IS NOT NULL
    AND btrim(channel) <> ''
    AND channel = lower(btrim(channel))
    AND channel IN (
      'facebook',
      'instagram',
      'messenger',
      'meta',
      'telegram',
      'voice',
      'webchat',
      'website',
      'whatsapp'
    )
  );

COMMIT;
