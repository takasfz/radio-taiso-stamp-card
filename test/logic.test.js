import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  pad2,
  dateKey,
  monthCells,
  calcStreak,
  STAMP_KINDS,
  pickStamp,
  parseStoredData,
  yearLabel,
  PRAISES,
  pickPraise,
} from "../src/logic.js";

describe("pad2", () => {
  test("1桁は0埋めする", () => {
    assert.equal(pad2(1), "01");
  });
  test("2桁はそのまま", () => {
    assert.equal(pad2(10), "10");
  });
});

describe("dateKey", () => {
  test("YYYY-MM-DD 形式のキーを作る", () => {
    assert.equal(dateKey(2026, 7, 4), "2026-07-04");
  });
  test("月日が2桁ならそのまま", () => {
    assert.equal(dateKey(2026, 12, 31), "2026-12-31");
  });
});

describe("monthCells", () => {
  test("2026年7月は水曜始まりなので先頭に3つ空きがある", () => {
    const { leading } = monthCells(2026, 7);
    assert.equal(leading, 3);
  });
  test("2026年7月は31日ある", () => {
    const { days } = monthCells(2026, 7);
    assert.equal(days.length, 31);
    assert.equal(days[0].d, 1);
    assert.equal(days[30].d, 31);
  });
  test("各日に曜日(0=日曜)が入る", () => {
    const { days } = monthCells(2026, 7);
    assert.equal(days[0].dow, 3); // 7/1 は水曜
    assert.equal(days[4].dow, 0); // 7/5 は日曜
  });
  test("2026年8月は土曜始まり", () => {
    const { leading, days } = monthCells(2026, 8);
    assert.equal(leading, 6);
    assert.equal(days.length, 31);
  });
  test("各日に日付キーが入る", () => {
    const { days } = monthCells(2026, 7);
    assert.equal(days[3].key, "2026-07-04");
  });
});

describe("calcStreak", () => {
  const today = { y: 2026, m: 7, d: 4 };
  test("スタンプがなければ0", () => {
    assert.equal(calcStreak({}, today), 0);
  });
  test("今日だけ押してあれば1", () => {
    assert.equal(calcStreak({ "2026-07-04": {} }, today), 1);
  });
  test("今日から3日連続なら3", () => {
    const stamps = { "2026-07-04": {}, "2026-07-03": {}, "2026-07-02": {} };
    assert.equal(calcStreak(stamps, today), 3);
  });
  test("途中が抜けていたらそこで止まる", () => {
    const stamps = { "2026-07-04": {}, "2026-07-02": {}, "2026-07-01": {} };
    assert.equal(calcStreak(stamps, today), 1);
  });
  test("今日まだ押していなければ昨日からさかのぼる", () => {
    const stamps = { "2026-07-03": {}, "2026-07-02": {} };
    assert.equal(calcStreak(stamps, today), 2);
  });
  test("月をまたいで数えられる", () => {
    const stamps = { "2026-08-01": {}, "2026-07-31": {}, "2026-07-30": {} };
    assert.equal(calcStreak(stamps, { y: 2026, m: 8, d: 1 }), 3);
  });
});

describe("pickStamp", () => {
  test("rng=0 なら最初の種類・傾き-12度", () => {
    const stamp = pickStamp(() => 0);
    assert.equal(stamp.kind, STAMP_KINDS[0]);
    assert.equal(stamp.rot, -12);
  });
  test("rng が最大に近ければ最後の種類・傾き+12度", () => {
    const stamp = pickStamp(() => 0.999999);
    assert.equal(stamp.kind, STAMP_KINDS[STAMP_KINDS.length - 1]);
    assert.equal(stamp.rot, 12);
  });
  test("種類は3種類ある", () => {
    assert.equal(STAMP_KINDS.length, 3);
  });
  test("傾きは常に±12度の範囲", () => {
    for (let i = 0; i < 50; i++) {
      const { rot } = pickStamp(Math.random);
      assert.ok(rot >= -12 && rot <= 12, `rot=${rot}`);
    }
  });
});

describe("parseStoredData", () => {
  test("正常なデータはそのまま返す", () => {
    const raw = JSON.stringify({ name: "たろう", stamps: { "2026-07-04": { kind: "stamp-sun", rot: 3 } } });
    const data = parseStoredData(raw);
    assert.equal(data.name, "たろう");
    assert.deepEqual(Object.keys(data.stamps), ["2026-07-04"]);
  });
  test("null(未保存)ならデフォルトを返す", () => {
    assert.deepEqual(parseStoredData(null), { name: "", stamps: {} });
  });
  test("壊れたJSONならデフォルトを返す", () => {
    assert.deepEqual(parseStoredData("{oops"), { name: "", stamps: {} });
  });
  test("stamps が無いオブジェクトならデフォルトを返す", () => {
    assert.deepEqual(parseStoredData(JSON.stringify({ name: "x" })), { name: "", stamps: {} });
  });
});

describe("yearLabel", () => {
  test("西暦と令和を併記する", () => {
    assert.equal(yearLabel(2026), "2026年(令和8年)");
  });
});

describe("pickPraise", () => {
  test("ほめことばの中から選ぶ", () => {
    assert.ok(PRAISES.includes(pickPraise(() => 0)));
    assert.equal(pickPraise(() => 0), PRAISES[0]);
    assert.equal(pickPraise(() => 0.999999), PRAISES[PRAISES.length - 1]);
  });
});
