-- 약속 지역 이름에서 가운데 점 빼기 (68-6, 화면 글에 · 로 잇지 않음) — '합정 · 망원' → '합정/망원'
update public.meetup_areas set name = replace(name, ' · ', '/') where name like '% · %';
