create index if not exists idx_inbox_messages_thread_latest
  on inbox_messages(thread_id, tenant_key, sent_at desc, created_at desc);
