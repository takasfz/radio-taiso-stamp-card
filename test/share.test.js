import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { shareFileName, chooseShareMethod, buildCardSvg } from "../src/share.js";

describe("shareFileName", () => {
  test("年入りのpngファイル名を作る", () => {
    assert.equal(shareFileName(2026), "radio-taiso-card-2026.png");
  });
});

describe("chooseShareMethod", () => {
  const file = { name: "x.png" };
  test("navigator.share と canShare が使えれば share", () => {
    const nav = { share: () => {}, canShare: () => true };
    assert.equal(chooseShareMethod(nav, file), "share");
  });
  test("canShare がファイル共有を拒否したら download", () => {
    const nav = { share: () => {}, canShare: () => false };
    assert.equal(chooseShareMethod(nav, file), "download");
  });
  test("share が無ければ download", () => {
    assert.equal(chooseShareMethod({}, file), "download");
  });
  test("canShare が無ければ download(古い実装は安全側に倒す)", () => {
    const nav = { share: () => {} };
    assert.equal(chooseShareMethod(nav, file), "download");
  });
  test("canShare が例外を投げても download に倒れる", () => {
    const nav = { share: () => {}, canShare: () => { throw new TypeError("nope"); } };
    assert.equal(chooseShareMethod(nav, file), "download");
  });
});

describe("buildCardSvg", () => {
  const base = { width: 900, height: 1200, css: ".card{color:red}", html: "<div>なかみ</div>" };

  test("ルート svg に SVG の xmlns が付く", () => {
    const svg = buildCardSvg(base);
    assert.match(svg, /^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });
  test("指定した width / height が svg の属性に出る", () => {
    const svg = buildCardSvg(base);
    assert.match(svg, /<svg[^>]*width="900"/);
    assert.match(svg, /<svg[^>]*height="1200"/);
  });
  test("css は style 要素の CDATA 内に入る", () => {
    const svg = buildCardSvg(base);
    assert.match(svg, /<style><!\[CDATA\[.*\.card\{color:red\}.*\]\]><\/style>/s);
  });
  test("html は foreignObject 内の xhtml div ラッパーに入る", () => {
    const svg = buildCardSvg(base);
    assert.match(
      svg,
      /<foreignObject[^>]*><div xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"><div>なかみ<\/div><\/div><\/foreignObject>/
    );
  });
  test("foreignObject は全面(100%)に広がる", () => {
    const svg = buildCardSvg(base);
    assert.match(svg, /<foreignObject[^>]*width="100%"[^>]*height="100%"/);
  });
  test("css 内の < や & で XML が壊れない(CDATA のままエスケープしない)", () => {
    const css = '.a>b{content:"<&"}';
    const svg = buildCardSvg({ ...base, css });
    assert.ok(svg.includes(css), "CSSが原文のままCDATAに入ること");
  });
  test("css に ]]> が入っても CDATA が途中で閉じない", () => {
    const css = '.a{content:"]]>"}';
    const svg = buildCardSvg({ ...base, css });
    const styleBody = svg.slice(svg.indexOf("<style>") + "<style>".length, svg.indexOf("</style>"));
    // 標準的な分割エスケープ: ]]> → ]]]]><![CDATA[>
    assert.ok(styleBody.includes("]]]]><![CDATA[>"), `styleBody=${styleBody}`);
    // CDATA を連結し直すと元の css に戻る(情報が失われない)
    const rebuilt = styleBody
      .replace(/^<!\[CDATA\[/, "")
      .replace(/\]\]>$/, "")
      .replaceAll("]]]]><![CDATA[>", "]]>");
    assert.equal(rebuilt, css);
  });
});
