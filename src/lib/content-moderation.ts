const SENSITIVE_WORDS = [
  "自杀",
  "炸弹",
  "恐怖袭击",
  "毒品",
  "代开发票",
  "赌博",
  "色情",
  "辱骂",
  "诈骗",
];

export function assertContentSafe(...chunks: Array<string | undefined>) {
  const fullText = chunks
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hit = SENSITIVE_WORDS.find((word) => fullText.includes(word.toLowerCase()));
  if (hit) {
    throw new Error("内容包含违规信息，请修改");
  }
}
