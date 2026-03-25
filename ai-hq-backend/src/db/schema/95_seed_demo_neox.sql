-- ============================================================
-- demo seed tenant: NEOX
-- demo/example only, not runtime default logic
-- ============================================================

do $$
declare
  v_tenant_id uuid;
begin
  insert into tenants (
    tenant_key,
    company_name,
    legal_name,
    industry_key,
    country_code,
    timezone,
    default_language,
    enabled_languages,
    market_region,
    plan_key,
    status,
    active,
    onboarding_completed_at
  )
  values (
    'neox',
    'NEOX',
    'NEOX',
    'technology',
    'AZ',
    'Asia/Baku',
    'az',
    '["az","en","tr","ru"]'::jsonb,
    'azerbaijan',
    'enterprise',
    'active',
    true,
    now()
  )
  on conflict (tenant_key) do update
    set company_name = excluded.company_name,
        legal_name = excluded.legal_name,
        industry_key = excluded.industry_key,
        country_code = excluded.country_code,
        timezone = excluded.timezone,
        default_language = excluded.default_language,
        enabled_languages = excluded.enabled_languages,
        market_region = excluded.market_region,
        plan_key = excluded.plan_key,
        status = excluded.status,
        active = excluded.active
  returning id into v_tenant_id;

  if v_tenant_id is null then
    select id into v_tenant_id from tenants where tenant_key = 'neox';
  end if;

  insert into tenant_profiles (
    tenant_id,
    brand_name,
    website_url,
    public_email,
    public_phone,
    audience_summary,
    services_summary,
    value_proposition,
    brand_summary,
    tone_of_voice,
    preferred_cta,
    banned_phrases,
    communication_rules,
    visual_style,
    extra_context
  )
  values (
    v_tenant_id,
    'NEOX',
    'https://neox.az',
    'info@neox.az',
    '+994518005577',
    'Azerbaijan and regional companies seeking AI automation, websites, content systems, and digital growth.',
    'AI automation, websites, voice and chat assistants, operational dashboards, content systems.',
    'Premium AI-powered business growth and automation systems.',
    'NEOX is a premium AI automation and digital systems company.',
    'premium_modern_confident',
    'Əlaqə saxlayın',
    '[]'::jsonb,
    jsonb_build_object(
      'languages', jsonb_build_array('az','en','tr','ru'),
      'formalLevel', 'semi_formal',
      'replyStyle', 'clear_and_actionable'
    ),
    jsonb_build_object(
      'theme', 'premium_dark',
      'mood', 'futuristic_clean',
      'contrast', 'high'
    ),
    '{}'::jsonb
  )
  on conflict (tenant_id) do update
    set brand_name = excluded.brand_name,
        website_url = excluded.website_url,
        public_email = excluded.public_email,
        public_phone = excluded.public_phone,
        audience_summary = excluded.audience_summary,
        services_summary = excluded.services_summary,
        value_proposition = excluded.value_proposition,
        brand_summary = excluded.brand_summary,
        tone_of_voice = excluded.tone_of_voice,
        preferred_cta = excluded.preferred_cta,
        banned_phrases = excluded.banned_phrases,
        communication_rules = excluded.communication_rules,
        visual_style = excluded.visual_style,
        extra_context = excluded.extra_context;

  insert into tenant_ai_policies (
    tenant_id,
    auto_reply_enabled,
    suppress_ai_during_handoff,
    mark_seen_enabled,
    typing_indicator_enabled,
    create_lead_enabled,
    approval_required_content,
    approval_required_publish,
    quiet_hours_enabled,
    quiet_hours,
    inbox_policy,
    comment_policy,
    content_policy,
    escalation_rules,
    risk_rules,
    lead_scoring_rules,
    publish_policy
  )
  values (
    v_tenant_id,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    jsonb_build_object('startHour',0,'endHour',0),
    jsonb_build_object(
      'allowedChannels', jsonb_build_array('instagram','facebook','whatsapp'),
      'handoffEnabled', true,
      'autoReleaseOnOperatorReply', false,
      'humanKeywords', jsonb_build_array(
        'operator','menecer','manager','human',
        'adamla danışım','adamla danisim',
        'real adam','zəng edin','zeng edin',
        'call me','əlaqə','elaqe'
      )
    ),
    jsonb_build_object(
      'autoReplyEnabled', true,
      'escalateToxic', true
    ),
    jsonb_build_object(
      'draftApprovalRequired', true,
      'publishApprovalRequired', true
    ),
    jsonb_build_object(
      'urgentLeadCreatesHandoff', true
    ),
    jsonb_build_object(
      'highRiskTopics', jsonb_build_array('legal','medical','financial_commitment')
    ),
    jsonb_build_object(
      'pricingIntent', 25,
      'serviceInterest', 20,
      'humanRequest', 30,
      'urgency', 20
    ),
    jsonb_build_object(
      'allowedPlatforms', jsonb_build_array('instagram')
    )
  )
  on conflict (tenant_id) do update
    set auto_reply_enabled = excluded.auto_reply_enabled,
        suppress_ai_during_handoff = excluded.suppress_ai_during_handoff,
        mark_seen_enabled = excluded.mark_seen_enabled,
        typing_indicator_enabled = excluded.typing_indicator_enabled,
        create_lead_enabled = excluded.create_lead_enabled,
        approval_required_content = excluded.approval_required_content,
        approval_required_publish = excluded.approval_required_publish,
        quiet_hours_enabled = excluded.quiet_hours_enabled,
        quiet_hours = excluded.quiet_hours,
        inbox_policy = excluded.inbox_policy,
        comment_policy = excluded.comment_policy,
        content_policy = excluded.content_policy,
        escalation_rules = excluded.escalation_rules,
        risk_rules = excluded.risk_rules,
        lead_scoring_rules = excluded.lead_scoring_rules,
        publish_policy = excluded.publish_policy;

  insert into tenant_channels (
    tenant_id,
    channel_type,
    provider,
    display_name,
    external_page_id,
    external_user_id,
    external_username,
    status,
    is_primary,
    config,
    health
  )
  values (
    v_tenant_id,
    'instagram',
    'meta',
    'NEOX Instagram',
    '1034647199727587',
    '17841473956986087',
    'neox.az',
    'connected',
    true,
    '{}'::jsonb,
    '{}'::jsonb
  )
  on conflict do nothing;

  insert into tenant_agent_configs (
    tenant_id, agent_key, display_name, role_summary, enabled, model, temperature, prompt_overrides, tool_access, limits
  ) values
    (v_tenant_id, 'orion', 'Orion', 'Strategic planner and high-level business thinker.', true, 'gpt-5', 0.40, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
    (v_tenant_id, 'nova',  'Nova',  'Creative and content generation specialist.', true, 'gpt-5', 0.80, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
    (v_tenant_id, 'atlas', 'Atlas', 'Sales, operations, CRM and inbox specialist.', true, 'gpt-5', 0.50, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
    (v_tenant_id, 'echo',  'Echo',  'Analytics, QA and insight specialist.', true, 'gpt-5', 0.30, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)
  on conflict (tenant_id, agent_key) do update
    set display_name = excluded.display_name,
        role_summary = excluded.role_summary,
        enabled = excluded.enabled,
        model = excluded.model,
        temperature = excluded.temperature,
        prompt_overrides = excluded.prompt_overrides,
        tool_access = excluded.tool_access,
        limits = excluded.limits;

  if not exists (
    select 1 from tenant_users
    where tenant_id = v_tenant_id
      and lower(user_email) = lower('owner@neox.az')
  ) then
    insert into tenant_users (
      tenant_id,
      user_email,
      full_name,
      role,
      status,
      password_hash,
      auth_provider,
      email_verified,
      session_version,
      permissions,
      meta
    )
    values (
      v_tenant_id,
      'owner@neox.az',
      'NEOX Owner',
      'owner',
      'active',
      null,
      'local',
      true,
      1,
      '{}'::jsonb,
      '{}'::jsonb
    );
  end if;
exception when others then null;
end$$;