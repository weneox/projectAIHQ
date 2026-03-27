-- ============================================================
-- operational data backfill correction
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
    when lower(coalesce(tp.extra_context #>> '{voice,enabled}', '')) in ('true', '1', 'yes', 'on') then true
    when btrim(coalesce(tp.extra_context->>'twilio_phone', '')) <> '' then true
    when btrim(coalesce(tp.extra_context->>'phone', tp.public_phone, '')) <> '' then true
    else false
  end,
  'twilio',
  case
    when lower(coalesce(tp.extra_context #>> '{voice,mode}', '')) in ('assistant', 'ivr', 'hybrid', 'disabled')
      then lower(coalesce(tp.extra_context #>> '{voice,mode}', ''))
    else 'assistant'
  end,
  coalesce(
    nullif(btrim(tp.extra_context #>> '{voice,voiceProfile,assistantName}'), ''),
    nullif(btrim(tp.brand_name), ''),
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
    nullif(btrim(tp.extra_context #>> '{realtime,instructions}'), ''),
    nullif(btrim(tp.extra_context #>> '{voice,instructions}'), ''),
    ''
  ),
  true,
  nullif(
    btrim(
      coalesce(
        tp.extra_context #>> '{operator,phone}',
        tp.extra_context->>'operator_phone',
        ''
      )
    ),
    ''
  ),
  coalesce(
    nullif(btrim(tp.extra_context #>> '{operator,label}'), ''),
    'operator'
  ),
  case
    when lower(coalesce(tp.extra_context #>> '{voice,voiceProfile,transferMode}', '')) in ('handoff', 'callback', 'schedule_callback', 'never')
      then lower(coalesce(tp.extra_context #>> '{voice,voiceProfile,transferMode}', ''))
    else 'handoff'
  end,
  true,
  'lead_only',
  nullif(
    btrim(
      coalesce(
        tp.extra_context->>'twilio_phone',
        tp.extra_context->>'phone',
        tp.public_phone,
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
            tp.extra_context #>> '{operator,callerId}',
            tp.extra_context->>'twilio_caller_id',
            tp.extra_context->>'twilio_phone',
            tp.public_phone,
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
            tp.extra_context #>> '{realtime,model}',
            tp.extra_context #>> '{voice,realtimeModel}',
            ''
          )
        ),
        ''
      ),
      'realtimeVoice',
      nullif(
        btrim(
          coalesce(
            tp.extra_context #>> '{realtime,voice}',
            tp.extra_context #>> '{voice,realtimeVoice}',
            ''
          )
        ),
        ''
      ),
      'instructions',
      nullif(
        btrim(
          coalesce(
            tp.extra_context #>> '{realtime,instructions}',
            tp.extra_context #>> '{voice,instructions}',
            ''
          )
        ),
        ''
      ),
      'operatorRouting',
      coalesce(
        case
          when jsonb_typeof(tp.extra_context #> '{operatorRouting}') = 'object'
            then tp.extra_context #> '{operatorRouting}'
          when jsonb_typeof(tp.extra_context #> '{operator_routing}') = 'object'
            then tp.extra_context #> '{operator_routing}'
          else null
        end,
        '{}'::jsonb
      )
    )
  )
from tenants t
left join tenant_profiles tp on tp.tenant_id = t.id
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
    nullif(btrim(coalesce(tp.extra_context #>> '{operator,phone}', tp.extra_context->>'operator_phone', '')), '')
  ),
  operator_label = coalesce(
    nullif(btrim(tvs.operator_label), ''),
    nullif(btrim(tp.extra_context #>> '{operator,label}'), ''),
    'operator'
  ),
  twilio_phone_number = coalesce(
    nullif(btrim(tvs.twilio_phone_number), ''),
    nullif(btrim(coalesce(tp.extra_context->>'twilio_phone', tp.extra_context->>'phone', tp.public_phone, '')), '')
  ),
  twilio_config = coalesce(tvs.twilio_config, '{}'::jsonb) || jsonb_strip_nulls(
    jsonb_build_object(
      'callerId',
      nullif(
        btrim(
          coalesce(
            tvs.twilio_config->>'callerId',
            tvs.twilio_config->>'caller_id',
            tp.extra_context #>> '{operator,callerId}',
            tp.extra_context->>'twilio_caller_id',
            tp.extra_context->>'twilio_phone',
            tp.public_phone,
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
            tp.extra_context #>> '{realtime,model}',
            tp.extra_context #>> '{voice,realtimeModel}',
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
            tp.extra_context #>> '{realtime,voice}',
            tp.extra_context #>> '{voice,realtimeVoice}',
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
            tp.extra_context #>> '{realtime,instructions}',
            tp.extra_context #>> '{voice,instructions}',
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
          when jsonb_typeof(tp.extra_context #> '{operatorRouting}') = 'object'
            then tp.extra_context #> '{operatorRouting}'
          when jsonb_typeof(tp.extra_context #> '{operator_routing}') = 'object'
            then tp.extra_context #> '{operator_routing}'
          else null
        end,
        '{}'::jsonb
      )
    )
  ),
  updated_at = now()
from tenants t
left join tenant_profiles tp on tp.tenant_id = t.id
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
