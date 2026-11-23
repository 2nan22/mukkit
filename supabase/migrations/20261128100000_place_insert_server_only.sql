-- 장소 · 출처 연결은 서버(서비스 키)만 만든다
-- 로그인 사용자가 실제 가게 id 로 가짜 이름 · 좌표를 먼저 넣으면 이후 가져오는 사람이 그 행을 쓰게 되던 문제
-- 서버는 네이버 · 카카오에서 직접 받았거나 카카오로 다시 확인한 값만 넣는다 (upsertPlaces)
drop policy "로그인 사용자는 장소 추가" on public.places;
drop policy "로그인 사용자는 출처 연결 추가" on public.place_sources;
revoke insert, update, delete on public.places from anon, authenticated;
revoke insert, update, delete on public.place_sources from anon, authenticated;
