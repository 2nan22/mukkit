-- 세부 업종 (51) — 업종 기본 그림을 고르는 데 쓴다. 가게 이름 + 카카오 업종 이름(category_path)에서 낱말로 판정,
-- 못 정하면 네이버 세부 업종 코드(category_path 3단계)로 — 코드 이름은 네이버가 주지 않아 가게 이름 표본으로 판정 (2026-11, 1000곳)
-- 규칙은 여기 한 곳에만 둔다 (화면 쪽은 이름 · 그림만: src/domain/foodKind.ts). 못 정하면 null → 업종(cuisine) 기본 그림
-- 이름 · 업종이 바뀌면 생성 열이라 저절로 다시 정해진다 (새벽 가게 정보 갱신 포함)
create function public.food_kind_of(p_name text, p_path text[], p_cuisine text)
returns text
language sql immutable parallel safe set search_path = '' as $$
  with h as (select lower(coalesce(p_name, '') || ' ' || array_to_string(coalesce(p_path, '{}'), ' ')) as t)
  select coalesce(case p_cuisine
    when 'korean' then case
      when t ~ '국밥|해장국|설렁탕|곰탕|순대|순댓국|감자탕|뼈해장|내장탕|갈비탕|육개장|추어탕|도가니' then 'gukbap'
      when t ~ '곱창|막창|대창' then 'gopchang'
      when t ~ '족발|보쌈' then 'jokbal'
      when t ~ '냉면|밀면' then 'naengmyeon'
      when t ~ '칼국수|국수|수제비|콩국수' then 'noodle'
      when t ~ '닭갈비|찜닭|삼계탕|닭한마리|백숙|닭요리|오리' then 'dak'
      when t ~ '찌개|전골|김치찜|닭볶음탕|짜글이' then 'jjigae'
      when t ~ '해물|생선|횟집|물회|막회|어시장|홍어|민어|수산|조개|낙지|쭈꾸미|주꾸미|아구|아귀|장어|대게|게장|해산물|매운탕|회센터' then 'seafood'
      when t ~ '삼겹|갈비|고기|목살|한우|숯불|정육|돼지|소고기|육류|생고기|오겹|화로|양념구이' then 'gogi'
      when t ~ '백반|한정식|가정식|기사식당|쌈밥|비빔밥|한식뷔페|정식' then 'baekban'
    end
    when 'japanese' then case
      when t ~ '라멘|라면' then 'ramen'
      when t ~ '돈까스|돈카츠|돈가스|카츠' then 'donkatsu'
      when t ~ '우동|소바|메밀' then 'udon'
      when t ~ '덮밥|규동|돈부리|텐동|카레' then 'donburi'
      when t ~ '초밥|스시|오마카세|사시미|횟집|참치' then 'sushi'
    end
    when 'chinese' then case
      when t ~ '마라|훠궈' then 'mala'
      when t ~ '양꼬치|꼬치' then 'yangkkochi'
      when t ~ '딤섬|만두|샤오롱' then 'dimsum'
      when t ~ '짜장|짬뽕|중화|반점|중국집|탕수육|중국요리' then 'jjajang'
    end
    when 'western' then case
      when t ~ '피자' then 'pizza'
      when t ~ '버거' then 'burger'
      when t ~ '스테이크|립' then 'steak'
      when t ~ '파스타|이탈리|트라토리아|리조또' then 'pasta'
      when t ~ '브런치|샌드위치|베이글' then 'brunch'
    end
    when 'asian' then case
      when t ~ '쌀국수|베트남|분짜|반미' then 'pho'
      when t ~ '태국|타이|팟타이|똠양' then 'thai'
      when t ~ '인도|커리|카레|탄두리' then 'curry'
    end
    when 'snack' then case
      when t ~ '김밥|주먹밥' then 'gimbap'
      when t ~ '떡볶이|어묵|튀김|분식' then 'tteokbokki'
    end
    when 'chicken' then 'chicken'
    when 'bar' then case
      when t ~ '와인' then 'wine'
      when t ~ '칵테일|위스키|하이볼' then 'cocktail'
      when t ~ '포차|포장마차|막걸리|전통주|이자카야|사케|선술집' then 'pocha'
      when t ~ '호프|맥주|비어|beer|pub|펍' then 'beer'
    end
    when 'cafe' then case
      when t ~ '아이스크림|젤라또|젤라토' then 'icecream'
      when t ~ '베이커리|빵|제과|브레드|베이글|도넛' then 'bakery'
      when t ~ '디저트|케이크|마카롱|와플|빙수|떡|타르트' then 'dessert'
      when t ~ '커피|카페|로스터|에스프레소|coffee' then 'coffee'
    end
  end, case p_path[3]
    when '220061' then 'gukbap' when '220067' then 'gukbap' when '220068' then 'gukbap' when '220069' then 'gukbap'
    when '220063' then 'naengmyeon' when '220065' then 'jjigae' when '220073' then 'noodle' when '220076' then 'seafood'
    when '220082' then 'donkatsu' when '220086' then 'udon' when '220087' then 'ramen' when '220089' then 'sushi' when '220090' then 'donburi'
    when '220091' then 'jjajang' when '220093' then 'yangkkochi'
    when '220103' then 'pho' when '220124' then 'thai'
    when '220136' then 'pizza' when '220138' then 'burger'
    when '220231' then 'tteokbokki' when '220245' then 'chicken'
    when '220553' then 'beer' when '220556' then 'pocha' when '220557' then 'pocha' when '220558' then 'pocha' when '220559' then 'pocha'
    when '220563' then 'coffee' when '220564' then 'bakery'
  end)
  from h
$$;

alter table public.places
  add column food_kind text generated always as (public.food_kind_of(name, category_path, cuisine)) stored;
