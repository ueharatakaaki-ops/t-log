/**
 * 「年齢からわかる医学的・フィジカル基準」欄用の定型文。
 * AI機能実装前の運用を可能にするため、年齢帯ごとの固定テンプレートとして用意する
 * （Phase0レビュー STEP8・STEP9準拠。医学的診断ではなく一般的な成長期の目安を示すもの）。
 */
export function getAgeBasedCommentary(age: number | null): string[] {
  if (age === null) {
    return ["生年月日が未登録のため、年齢に応じた成長期の目安は表示できません。"];
  }
  if (age <= 12) {
    return [
      "この年代はゴールデンエイジと呼ばれる神経系の発達が著しい時期にあたり、多様な動きの経験が将来の技術習得の土台になります。",
      "骨端線がまだ閉じていない時期のため、過度な同一動作の反復による負荷には注意が必要です。",
    ];
  }
  if (age <= 15) {
    return [
      "第二発育急進期（成長スパート）にあたる可能性がある年代で、身長の伸びに筋力・柔軟性の発達が追いつかず、フォームが崩れやすい時期です。",
      "骨端線閉鎖前の選手も多く、痛み・違和感の申告は軽視せず早めの確認が推奨されます。",
    ];
  }
  return [
    "身体的な成長がおおむね安定してくる年代で、より専門的な体力・技術トレーニングへの適応が進む時期です。",
    "この年代以降は、コンディション管理の主体を選手自身に移していく（セルフマネジメント）ことが重要になります。",
  ];
}

export function calculateAge(birthdate: string | null, asOf: Date = new Date()): number | null {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  let age = asOf.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    asOf.getMonth() > birth.getMonth() ||
    (asOf.getMonth() === birth.getMonth() && asOf.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}
