export const REPORT_REASONS = ["ad", "inappropriate", "fake", "harassment", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REASON_LABEL: Record<ReportReason, string> = {
  ad: "광고, 홍보",
  inappropriate: "불쾌한 사진이나 내용",
  fake: "가 보지 않고 쓴 평가",
  harassment: "욕설, 괴롭힘",
  other: "기타",
};
