-- 같은 네이버 리스트를 다시 가져와도 리스트가 하나만 생기게
create unique index lists_owner_source_key on public.lists (owner_id, source, source_list_id)
  where source is not null;
