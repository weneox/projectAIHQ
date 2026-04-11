BEGIN;

-- Normalize any stored channel values before re-adding the check.
UPDATE inbox_threads
SET channel = lower(btrim(channel))
WHERE channel IS NOT NULL
  AND channel <> lower(btrim(channel));

DO $$
DECLARE
  allowed_channels text;
BEGIN
  -- Build a safe allowlist from:
  -- 1) known platform channels we want to support
  -- 2) any existing rows already present in inbox_threads
  SELECT string_agg(quote_literal(channel), ', ' ORDER BY channel)
    INTO allowed_channels
  FROM (
    SELECT channel
    FROM (
      VALUES
        ('facebook'),
        ('instagram'),
        ('messenger'),
        ('meta'),
        ('telegram'),
        ('webchat'),
        ('website'),
        ('whatsapp')
    ) AS baseline(channel)

    UNION

    SELECT DISTINCT lower(btrim(channel)) AS channel
    FROM inbox_threads
    WHERE channel IS NOT NULL
      AND btrim(channel) <> ''
  ) s;

  IF allowed_channels IS NULL OR btrim(allowed_channels) = '' THEN
    allowed_channels :=
      '''facebook'', ''instagram'', ''messenger'', ''meta'', ''telegram'', ''webchat'', ''website'', ''whatsapp''';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t
      ON t.oid = c.conrelid
    JOIN pg_namespace n
      ON n.oid = t.relnamespace
    WHERE t.relname = 'inbox_threads'
      AND c.conname = 'inbox_threads_channel_check'
  ) THEN
    ALTER TABLE inbox_threads
      DROP CONSTRAINT inbox_threads_channel_check;
  END IF;

  EXECUTE format(
    'ALTER TABLE inbox_threads
       ADD CONSTRAINT inbox_threads_channel_check
       CHECK (
         channel IS NOT NULL
         AND btrim(channel) <> ''''
         AND channel = lower(btrim(channel))
         AND channel IN (%s)
       )',
    allowed_channels
  );
END $$;

COMMIT;