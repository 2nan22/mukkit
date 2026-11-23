-- 세부 업종 판정 — 가게 이름 · 카카오 업종 이름 낱말로, 못 정하면 null
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select is(public.food_kind_of('여의도버섯칼국수', '{220036,220037}', 'korean'), 'noodle', '네이버 — 이름의 칼국수');
select is(public.food_kind_of('더딤섬', '{음식점,중식}', 'chinese'), 'dimsum', '카카오 — 이름의 딤섬');
select is(public.food_kind_of('엉터리 해장국(서여의도점)', '{}', 'korean'), 'gukbap', '해장국은 국밥');
select is(public.food_kind_of('마포갈비탕', '{}', 'korean'), 'gukbap', '갈비탕은 고기구이보다 국밥 먼저');
select is(public.food_kind_of('물고기', '{음식점,일식,초밥,롤}', 'japanese'), 'sushi', '카카오 업종 이름의 초밥');
select is(public.food_kind_of('코오모라멘', '{}', 'japanese'), 'ramen', '라멘');
select is(public.food_kind_of('보드람치킨', '{}', 'chicken'), 'chicken', '치킨은 늘 치킨');
select is(public.food_kind_of('어느 식당', '{}', 'korean'), null, '못 정하면 null');
select is(public.food_kind_of('청강호', '{220036,220037,220076}', 'korean'), 'seafood', '이름으로 못 정하면 네이버 세부 코드');
select is(public.food_kind_of('카페 피자', '{}', 'cafe'), 'coffee', '업종 안에서만 판정');

insert into public.places (source, source_place_id, name, lat, lng, cuisine) values ('naver', 'fk-1', '을지로 족발', 37.5, 127, 'korean');
select is((select food_kind from public.places where source_place_id = 'fk-1'), 'jokbal', '장소에 저절로 채워짐');

select * from finish();
rollback;
