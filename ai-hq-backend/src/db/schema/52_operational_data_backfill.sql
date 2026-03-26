-- ============================================================
-- operational data backfill
-- ============================================================

insert into tenant_voice_settings (
  tenant_id,
  enabled,
  provider,
  mode,
  display_name,
  default_language,
  supported_languages,
  instructions,
  operator_enabled,
  operator_phone,
  operator_label,
  transfer_strategy,
  callback_enabled,
  callback_mode,
  twilio_phone_number,
  twilio_config,
  meta
)
select
  t.id,
  case
    when lower(coalesce(t.meta #>> '{voice,enabled}', '')) in ('true', '1', 'yes', 'on') then true
    when btrim(coalesce(t.meta->>'twilio_phone', '')) <> '' then true
    when btrim(coalesce(t.meta->>'phone', '')) <> '' then true
    else false
  end,
  'twilio',
  case
    when lower(coalesce(t.meta #>> '{voice,mode}', '')) in ('assistant', 'ivr', 'hybrid', 'disabled')
      then lower(coalesce(t.meta #>> '{voice,mode}', ''))
    else 'assistant'
  end,
  coalesce(
    nullif(btrim(t.meta #>> '{voice,voiceProfile,assistantName}'), ''),
    nullif(btrim(t.company_name), ''),
    ''
  ),
  lower(coalesce(nullif(btrim(t.default_language), ''), 'en')),
  case
    when jsonb_typeof(coalesce(t.enabled_languages, '[]'::jsonb)) = 'array'
      then coalesce(t.enabled_languages, '[]'::jsonb)
    else '["en"]'::jsonb
  end,
  coalesce(
    nullif(btrim(t.meta #>> '{realtime,instructions}'), ''),
    nullif(btrim(t.meta #>> '{voice,instructions}'), ''),
    ''
  ),
  true,
  nullif(
    btrim(
      coalesce(
        t.meta #>> '{operator,phone}',
        t.meta->>'operator_phone',
        ''
      )
    ),
    ''
  ),
  coalesce(
    nullif(btrim(t.meta #>> '{operator,label}'), ''),
    'operator'
  ),
  case
    when lower(coalesce(t.meta #>> '{voice,voiceProfile,transferMode}', '')) in ('handoff', 'callback', 'schedule_callback', 'never')
      then lower(coalesce(t.meta #>> '{voice,voiceProfile,transferMode}', ''))
    else 'handoff'
  end,
  true,
  'lead_only',
  nullif(
    btrim(
      coalesce(
        t.meta->>'twilio_phone',
        t.meta->>'phone',
        ''
      )
    ),
    ''
  ),
  jsonb_strip_nulls(
    jsonb_build_object(
      'callerId',
      nullif(
        btrim(
          coalesce(
            t.meta #>> '{operator,callerId}',
            t.meta->>'twilio_caller_id',
            t.meta->>'twilio_phone',
            ''
          )
        ),
        ''
      )
    )
  ),
  jsonb_strip_nulls(
    jsonb_build_object(
      'realtimeModel',
      nullif(
        btrim(
          coalesce(
            t.meta #>> '{realtime,model}',
            t.meta #>> '{voice,realtimeModel}',
            ''
          )
        ),
        ''
      ),
      'realtimeVoice',
      nullif(
        btrim(
          coalesce(
            t.meta #>> '{realtime,voice}',
            t.meta #>> '{voice,realtimeVoice}',
            ''
          )
        ),
        ''
      ),
      'instructions',
      nullif(
        btrim(
          coalesce(
            t.meta #>> '{realtime,instructions}',
            t.meta #>> '{voice,instructions}',
            ''
          )
        ),
        ''
      ),
      'operatorRouting',
      coalesce(
        case
          when jsonb_typeof(t.meta #> '{operatorRouting}') = 'object'
            then t.meta #> '{operatorRouting}'
          when jsonb_typeof(t.meta #> '{operator_routing}') = 'object'
            then t.meta #> '{operator_routing}'
          else null
        end,
        '{}'::jsonb
      )
    )
  )
from tenants t
left join tenant_voice_settings tvs on tvs.tenant_id = t.id
where tvs.tenant_id is null
  and coalesce(t.active, false) = true;

update tenant_voice_settings tvs
set
  display_name = coalesce(nullif(btrim(tvs.display_name), ''), nullif(btrim(t.company_name), ''), ''),
  default_language = lower(coalesce(nullif(btrim(tvs.default_language), ''), nullif(btrim(t.default_language), ''), 'en')),
  supported_languages = case
    when jsonb_typeof(coalesce(tvs.supported_languages, '[]'::jsonb)) = 'array'
         and jsonb_array_length(coalesce(tvs.supported_languages, '[]'::jsonb)) > 0
      then tvs.supported_languages
    when jsonb_typeof(coalesce(t.enabled_languages, '[]'::jsonb)) = 'array'
         and jsonb_array_length(coalesce(t.enabled_languages, '[]'::jsonb)) > 0
      then t.enabled_languages
    else '["en"]'::jsonb
  end,
  operator_phone = coalesce(
    nullif(btrim(tvs.operator_phone), ''),
    nullif(btrim(coalesce(t.meta #>> '{operator,phone}', t.meta->>'operator_phone', '')), '')
  ),
  operator_label = coalesce(
    nullif(btrim(tvs.operator_label), ''),
    nullif(btrim(t.meta #>> '{operator,label}'), ''),
    'operator'
  ),
  twilio_phone_number = coalesce(
    nullif(btrim(tvs.twilio_phone_number), ''),
    nullif(btrim(coalesce(t.meta->>'twilio_phone', t.meta->>'phone', '')), '')
  ),
  twilio_config = coalesce(tvs.twilio_config, '{}'::jsonb) || jsonb_strip_nulls(
    jsonb_build_object(
      'callerId',
      nullif(
        btrim(
          coalesce(
            tvs.twilio_config->>'callerId',
            tvs.twilio_config->>'caller_id',
            t.meta #>> '{operator,callerId}',
            t.meta->>'twilio_caller_id',
            t.meta->>'twilio_phone',
            ''
          )
        ),
        ''
      )
    )
  ),
  meta = coalesce(tvs.meta, '{}'::jsonb) || jsonb_strip_nulls(
    jsonb_build_object(
      'realtimeModel',
      nullif(
        btrim(
          coalesce(
            tvs.meta->>'realtimeModel',
            tvs.meta->>'model',
            t.meta #>> '{realtime,model}',
            t.meta #>> '{voice,realtimeModel}',
            ''
          )
        ),
        ''
      ),
      'realtimeVoice',
      nullif(
        btrim(
          coalesce(
            tvs.meta->>'realtimeVoice',
            tvs.meta->>'voice',
            t.meta #>> '{realtime,voice}',
            t.meta #>> '{voice,realtimeVoice}',
            ''
          )
        ),
        ''
      ),
      'instructions',
      nullif(
        btrim(
          coalesce(
            tvs.meta->>'instructions',
            t.meta #>> '{realtime,instructions}',
            t.meta #>> '{voice,instructions}',
            ''
          )
        ),
        ''
      ),
      'operatorRouting',
      coalesce(
        case
          when jsonb_typeof(tvs.meta->'operatorRouting') = 'object'
            then tvs.meta->'operatorRouting'
          when jsonb_typeof(tvs.meta->'operator_routing') = 'object'
            then tvs.meta->'operator_routing'
          when jsonb_typeof(t.meta #> '{operatorRouting}') = 'object'
            then t.meta #> '{operatorRouting}'
          when jsonb_typeof(t.meta #> '{operator_routing}') = 'object'
            then t.meta #> '{operator_routing}'
          else null
        end,
        '{}'::jsonb
      )
    )
  ),
  updated_at = now()
from tenants t
where tvs.tenant_id = t.id
  and (
    btrim(coalesce(tvs.display_name, '')) = ''
    or btrim(coalesce(tvs.operator_label, '')) = ''
    or btrim(coalesce(tvs.twilio_phone_number, '')) = ''
    or btrim(coalesce(tvs.operator_phone, '')) = ''
    or jsonb_typeof(coalesce(tvs.meta, '{}'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(tvs.twilio_config, '{}'::jsonb)) <> 'object'
  );

update tenant_channels tc
set
  provider = lower(
    coalesce(
      nullif(btrim(tc.provider), ''),
      nullif(btrim(tc.config->>'provider'), ''),
      nullif(btrim(tc.secrets_ref), ''),
      'meta'
    )
  ),
  external_page_id = coalesce(
    nullif(btrim(tc.external_page_id), ''),
    nullif(btrim(coalesce(tc.config->>'pageId', tc.config->>'page_id', '')), '')
  ),
  external_user_id = coalesce(
    nullif(btrim(tc.external_user_id), ''),
    nullif(
      btrim(
        coalesce(
          tc.config->>'igUserId',
          tc.config->>'ig_user_id',
          tc.config->>'instagramBusinessAccountId',
          tc.config->>'instagram_business_account_id',
          ''
        )
      ),
      ''
    )
  ),
  external_account_id = coalesce(
    nullif(btrim(tc.external_account_id), ''),
    nullif(btrim(coalesce(tc.config->>'accountId', tc.config->>'account_id', '')), '')
  ),
  secrets_ref = coalesce(
    nullif(btrim(tc.secrets_ref), ''),
    nullif(btrim(tc.provider), ''),
    nullif(btrim(tc.config->>'provider'), '')
  ),
  updated_at = now()
where
  btrim(coalesce(tc.external_page_id, '')) = ''
  or btrim(coalesce(tc.external_user_id, '')) = ''
  or btrim(coalesce(tc.external_account_id, '')) = ''
  or btrim(coalesce(tc.secrets_ref, '')) = '';
