// lib/marketing/homepage-content.ts の単体テスト（npm test で実行）。
// 操作デモ動画セクションを差し込むために本体HTMLを4つに分けたが、結合すると分割前と1文字も違わないことを確かめる。
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  MARKETING_WRAPPER_OPEN,
  MARKETING_BODY_HTML_BEFORE_DEMO,
  MARKETING_BODY_HTML_AFTER_DEMO,
  MARKETING_WRAPPER_CLOSE,
} from "@/lib/marketing/homepage-content";

// 分割前の MARKETING_BODY_HTML（84,738文字）の SHA-256
const ORIGINAL_SHA256 = "20fe62ea6a1b9dc1d18a9b748fa12cacf80a5db5315ff142a9780916dcd5fe30";

test("4つを結合すると、分割前の本体HTMLと完全に一致する", () => {
  const joined =
    MARKETING_WRAPPER_OPEN + MARKETING_BODY_HTML_BEFORE_DEMO + MARKETING_BODY_HTML_AFTER_DEMO + MARKETING_WRAPPER_CLOSE;
  assert.equal(joined.length, 84738);
  assert.equal(createHash("sha256").update(joined, "utf8").digest("hex"), ORIGINAL_SHA256);
});

test("前半は FEATURES で終わり、後半は FOR EVERYONE（#roles）から始まる", () => {
  assert.match(MARKETING_BODY_HTML_BEFORE_DEMO, /<section id="features"/);
  assert.doesNotMatch(MARKETING_BODY_HTML_BEFORE_DEMO, /<section id="roles"/);
  assert.ok(MARKETING_BODY_HTML_AFTER_DEMO.startsWith('  <!-- Roles -->\n  <section id="roles"'));
});

test("外枠の style は MarketingHomepage.tsx が描画する外枠と同じ", () => {
  assert.equal(MARKETING_WRAPPER_OPEN, '<div style="width: 100%; min-height: 100vh; --accent: #00A859;">');
  assert.equal(MARKETING_WRAPPER_CLOSE, "</div>");
});
