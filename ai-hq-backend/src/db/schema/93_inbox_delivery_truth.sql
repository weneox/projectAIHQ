-- src/db/schema/93_inbox_delivery_truth.sql

alter table inbox_messages
  alter column sent_at drop not null;

update inbox_messages m
set sent_at = null
where m.direction = 'outbound'
  and exists (
    select 1
    from inbox_outbound_attempts a
    where a.message_id = m.id
  )
  and not exists (
    select 1
    from inbox_outbound_attempts a
    where a.message_id = m.id
      and a.status = 'sent'
  );
