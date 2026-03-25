-- ============================================================
-- Mojibake repair (best effort)
-- ============================================================

do $$
begin
  begin
    update messages
      set content = convert_from(convert_to(content, 'LATIN1'), 'UTF8')
    where content is not null and content ~ 'Ã.|Â.|â€|â€™|â€œ|â€�|â€“|â€”|â€¦';
  exception when others then null;
  end;

  begin
    update proposals
      set title = convert_from(convert_to(title, 'LATIN1'), 'UTF8')
    where title is not null and title ~ 'Ã.|Â.|â€|â€™|â€œ|â€�|â€“|â€”|â€¦';
  exception when others then null;
  end;

  begin
    update notifications
      set title = convert_from(convert_to(title, 'LATIN1'), 'UTF8')
    where title is not null and title ~ 'Ã.|Â.|â€|â€™|â€œ|â€�|â€“|â€”|â€¦';
  exception when others then null;
  end;

  begin
    update notifications
      set body = convert_from(convert_to(body, 'LATIN1'), 'UTF8')
    where body is not null and body ~ 'Ã.|Â.|â€|â€™|â€œ|â€�|â€“|â€”|â€¦';
  exception when others then null;
  end;

  begin
    update inbox_messages
      set text = convert_from(convert_to(text, 'LATIN1'), 'UTF8')
    where text is not null and text ~ 'Ã.|Â.|â€|â€™|â€œ|â€�|â€“|â€”|â€¦';
  exception when others then null;
  end;

  begin
    update leads
      set full_name = convert_from(convert_to(full_name, 'LATIN1'), 'UTF8')
    where full_name is not null and full_name ~ 'Ã.|Â.|â€|â€™|â€œ|â€�|â€“|â€”|â€¦';
  exception when others then null;
  end;

  begin
    update comments
      set text = convert_from(convert_to(text, 'LATIN1'), 'UTF8')
    where text is not null and text ~ 'Ã.|Â.|â€|â€™|â€œ|â€�|â€“|â€”|â€¦';
  exception when others then null;
  end;

  begin
    update content_items
      set title = convert_from(convert_to(title, 'LATIN1'), 'UTF8')
    where title is not null and title ~ 'Ã.|Â.|â€|â€™|â€œ|â€�|â€“|â€”|â€¦';
  exception when others then null;
  end;

  begin
    update content_items
      set caption = convert_from(convert_to(caption, 'LATIN1'), 'UTF8')
    where caption is not null and caption ~ 'Ã.|Â.|â€|â€™|â€œ|â€�|â€“|â€”|â€¦';
  exception when others then null;
  end;

  begin
    update voice_calls
      set transcript = convert_from(convert_to(transcript, 'LATIN1'), 'UTF8')
    where transcript is not null and transcript ~ 'Ã.|Â.|â€|â€™|â€œ|â€�|â€“|â€”|â€¦';
  exception when others then null;
  end;

  begin
    update voice_calls
      set summary = convert_from(convert_to(summary, 'LATIN1'), 'UTF8')
    where summary is not null and summary ~ 'Ã.|Â.|â€|â€™|â€œ|â€�|â€“|â€”|â€¦';
  exception when others then null;
  end;
exception when others then null;
end$$;