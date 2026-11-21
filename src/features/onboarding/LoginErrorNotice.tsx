const LOGIN_ERROR_MESSAGE = "로그인에 실패했어요. 다시 시도해주세요.";

// 요청마다 다른 값(searchParams)은 여기서만 읽어 나머지 화면을 미리 그릴 수 있게 둔다
export async function LoginErrorNotice({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const { error } = await searchParams;
  // 우리 쪽 실패(login)든 인증 서버가 돌려보낸 실패(invalid_request 등)든 같은 안내 — 원인은 서버 로그에
  if (!error) return null;
  return (
    <p role="alert" className="pb-1 text-center text-meta text-danger">
      {LOGIN_ERROR_MESSAGE}
    </p>
  );
}
