const LOGIN_ERROR_MESSAGE = "로그인에 실패했어요. 다시 시도해주세요.";

// 요청마다 다른 값(searchParams)은 여기서만 읽어 나머지 화면을 미리 그릴 수 있게 둔다
export async function LoginErrorNotice({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const { error } = await searchParams;
  if (error !== "login") return null;
  return (
    <p role="alert" className="pb-1 text-center text-meta text-[#c4320a]">
      {LOGIN_ERROR_MESSAGE}
    </p>
  );
}
