-- ============================================================
-- Mojibake repair (best effort, encoding-portable)
-- ============================================================

create or replace function pg_temp.repair_mojibake_text(input_value text)
returns text
language plpgsql
as $$
declare
  repaired text;
begin
  if input_value is null or btrim(input_value) = '' then
    return input_value;
  end if;

  begin
    repaired := convert_from(convert_to(input_value, 'LATIN1'), 'UTF8');
  exception when others then
    return input_value;
  end;

  if repaired is null or repaired = input_value then
    return input_value;
  end if;

  return repaired;
end;
$$;

do $$
begin
  begin
    update messages
       set content = pg_temp.repair_mojibake_text(content)
     where content is not null
       and pg_temp.repair_mojibake_text(content) is distinct from content;
  exception when others then
    null;
  end;

  begin
    update proposals
       set title = pg_temp.repair_mojibake_text(title)
     where title is not null
       and pg_temp.repair_mojibake_text(title) is distinct from title;
  exception when others then
    null;
  end;

  begin
    update notifications
       set title = pg_temp.repair_mojibake_text(title)
     where title is not null
       and pg_temp.repair_mojibake_text(title) is distinct from title;
  exception when others then
    null;
  end;

  begin
    update notifications
       set body = pg_temp.repair_mojibake_text(body)
     where body is not null
       and pg_temp.repair_mojibake_text(body) is distinct from body;
  exception when others then
    null;
  end;

  begin
    update inbox_messages
       set text = pg_temp.repair_mojibake_text(text)
     where text is not null
       and pg_temp.repair_mojibake_text(text) is distinct from text;
  exception when others then
    null;
  end;

  begin
    update leads
       set full_name = pg_temp.repair_mojibake_text(full_name)
     where full_name is not null
       and pg_temp.repair_mojibake_text(full_name) is distinct from full_name;
  exception when others then
    null;
  end;

  begin
    update comments
       set text = pg_temp.repair_mojibake_text(text)
     where text is not null
       and pg_temp.repair_mojibake_text(text) is distinct from text;
  exception when others then
    null;
  end;

  begin
    update content_items
       set title = pg_temp.repair_mojibake_text(title)
     where title is not null
       and pg_temp.repair_mojibake_text(title) is distinct from title;
  exception when others then
    null;
  end;

  begin
    update content_items
       set caption = pg_temp.repair_mojibake_text(caption)
     where caption is not null
       and pg_temp.repair_mojibake_text(caption) is distinct from caption;
  exception when others then
    null;
  end;

  begin
    update voice_calls
       set transcript = pg_temp.repair_mojibake_text(transcript)
     where transcript is not null
       and pg_temp.repair_mojibake_text(transcript) is distinct from transcript;
  exception when others then
    null;
  end;

  begin
    update voice_calls
       set summary = pg_temp.repair_mojibake_text(summary)
     where summary is not null
       and pg_temp.repair_mojibake_text(summary) is distinct from summary;
  exception when others then
    null;
  end;
exception when others then
  null;
end
$$;