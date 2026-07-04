/* 画像シェアのロジック(判定・SVG組み立ては純粋関数、キャプチャはDOMに薄く依存) */

export function shareFileName(year) {
  return `radio-taiso-card-${year}.png`;
}

/** Web Share API(ファイル対応)が使えるかで share / download を選ぶ */
export function chooseShareMethod(nav, file) {
  try {
    if (typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
      return "share";
    }
  } catch (_) {
    /* canShare 未対応・例外は安全側に */
  }
  return "download";
}

/* ---- SVG foreignObject キャプチャ ---- */

/** CDATA 内に安全に文字列を埋める。]]> は標準の分割エスケープで逃がす */
function wrapCdata(text) {
  return `<![CDATA[${String(text).replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

/**
 * 表示中の DOM をそのまま画像化するための foreignObject 入り SVG 文字列を組み立てる。
 * css は <style> の CDATA に、html は xhtml 名前空間の div ラッパーに入る純粋関数。
 */
export function buildCardSvg({ width, height, css, html }) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<style>${wrapCdata(css)}</style>` +
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml">${html}</div>` +
    `</foreignObject>` +
    `</svg>`
  );
}

/* ---- ここから下はブラウザ薄層(DOM 依存) ---- */

const CAPTURE_PADDING = 24; // 画像のまわりの余白(px)
const CAPTURE_SCALE = 2;    // 出力解像度(固定2x)

/** document.styleSheets から読める CSS を全部つなげる(same-origin 前提) */
function collectCss(doc) {
  let css = "";
  for (const sheet of doc.styleSheets) {
    try {
      for (const rule of sheet.cssRules) css += rule.cssText + "\n";
    } catch (_) {
      /* 読めないシート(cross-origin)はスキップ */
    }
  }
  return css;
}

/**
 * 表示中のカード UI をそのまま canvas にキャプチャする。
 * - [data-share-exclude] の要素は画像に含めない
 * - ページ先頭の隠し SVG(ハンコ・マスコットの defs)も含めて <use> の参照切れを防ぐ
 */
export function captureCardImage(cardEl, doc = document) {
  const win = doc.defaultView || window;
  const rect = cardEl.getBoundingClientRect();
  const width = Math.ceil(rect.width + CAPTURE_PADDING * 2);
  const height = Math.ceil(rect.height + CAPTURE_PADDING * 2);
  // 余白の塗り色: body の背景色。グラデーション背景等で透明なら、カード自身の背景色に倒す
  const isTransparent = (c) => !c || c === "transparent" || c === "rgba(0, 0, 0, 0)";
  let bg = win.getComputedStyle(doc.body).backgroundColor;
  if (isTransparent(bg)) bg = win.getComputedStyle(cardEl).backgroundColor;
  if (isTransparent(bg)) bg = "#ffffff";

  const clone = cardEl.cloneNode(true);
  for (const el of clone.querySelectorAll("[data-share-exclude]")) el.remove();

  // 入力中のなまえは属性に反映しないと serialize で消える
  const liveName = cardEl.querySelector("#name-input");
  const cloneName = clone.querySelector("#name-input");
  if (liveName && cloneName) cloneName.setAttribute("value", liveName.value);

  // 余白つきのラッパーに、defs 用の隠し SVG とカードのクローンを入れる
  const wrapper = doc.createElement("div");
  wrapper.style.cssText =
    `box-sizing:border-box;width:${width}px;height:${height}px;` +
    `padding:${CAPTURE_PADDING}px;background:${bg};`;
  const defsSvg = doc.querySelector('body > svg[aria-hidden="true"]');
  if (defsSvg) wrapper.appendChild(defsSvg.cloneNode(true));
  wrapper.appendChild(clone);

  const html = new win.XMLSerializer().serializeToString(wrapper);
  const svg = buildCardSvg({ width, height, css: collectCss(doc), html });

  return new Promise((resolve, reject) => {
    const img = new win.Image();
    img.onload = () => {
      const canvas = doc.createElement("canvas");
      canvas.width = width * CAPTURE_SCALE;
      canvas.height = height * CAPTURE_SCALE;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(CAPTURE_SCALE, CAPTURE_SCALE);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("カード画像の読み込みに失敗しました"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}
