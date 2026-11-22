export const REPORT_REASONS = ["ad", "inappropriate", "fake", "harassment", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REASON_LABEL: Record<ReportReason, string> = {
  ad: "광고 · 홍보",
  inappropriate: "부적절한 사진 · 내용",
  fake: "가 보지 않은 거짓 평가",
  harassment: "욕설 · 괴롭힘",
  other: "기타",
};
