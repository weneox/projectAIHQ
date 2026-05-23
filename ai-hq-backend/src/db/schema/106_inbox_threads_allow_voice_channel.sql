BEGIN;

UPDATE inbox_threads
SET channel = lower(btrim(channel))
WHERE channel IS NOT NULL
  AND channel <> lower(btrim(channel));

DO $$
DECLARE
  allowed_channels text;
BEGIN
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
        ('voice'),
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
      '''facebook'', ''instagram'', ''messenger'', ''meta'', ''telegram'', ''voice'', ''webchat'', ''website'', ''whatsapp''';
  END IF;

  ALTER TABLE inbox_threads
    DROP CONSTRAINT IF EXISTS inbox_threads_channel_check;

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
