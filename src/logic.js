/* カードの純粋ロジック(DOM・localStorage に依存しない) */

export const STAMP_KINDS = ["stamp-sun", "stamp-flower", "stamp-star"];

export const PRAISES = [
  "たいへん よくできました!",
  "きょうも はやおき えらい!",
  "いい あせ かいたね!",
  "その ちょうし!",
  "あしたも まってるよ!",
];

export const pad2 = (n) => String(n).padStart(2, "0");

export const dateKey = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;

/** 月のカレンダー情報。leading: 1日より前の空きマス数(日曜始まり) */
export function monthCells(year, month) {
  const leading = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      d,
      dow: new Date(year, month - 1, d).getDay(),
      key: dateKey(year, month, d),
    });
  }
  return { leading, days };
}

/** 今日(未押印なら昨日)からさかのぼった連続押印日数 */
export function calcStreak(stamps, today) {
  let streak = 0;
  const cursor = new Date(today.y, today.m - 1, today.d);
  if (!stamps[dateKey(today.y, today.m, today.d)]) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (stamps[dateKey(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate())]) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** ハンコの種類と傾き(±12度)を選ぶ。rng は 0以上1未満 */
export function pickStamp(rng = Math.random) {
  return {
    kind: STAMP_KINDS[Math.floor(rng() * STAMP_KINDS.length)],
    rot: Math.round(rng() * 24 - 12),
  };
}

/** localStorage の生文字列を検証つきで読む。不正ならデフォルト */
export function parseStoredData(raw) {
  const fallback = { name: "", stamps: {} };
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw);
    if (data && typeof data === "object" && data.stamps && typeof data.stamps === "object") {
      return { name: typeof data.name === "string" ? data.name : "", stamps: data.stamps };
    }
  } catch (_) {
    /* 壊れていたら作り直す */
  }
  return fallback;
}

export function yearLabel(year) {
  return `${year}年(令和${year - 2018}年)`;
}

export function pickPraise(rng = Math.random) {
  return PRAISES[Math.floor(rng() * PRAISES.length)];
}
