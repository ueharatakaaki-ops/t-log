// lib/daily-log/read-retry.ts の単体テスト（npm test で実行）。
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { DailyLogReadError, withReadRetry, type ReadResult } from "@/lib/daily-log/read-retry";

const NO_WAIT = [0, 0, 0];
const fail = { code: "57014", message: "canceling statement due to statement timeout" };

function sequence<T>(results: (ReadResult<T> | Error)[]) {
  let i = 0;
  const calls = { n: 0 };
  const run = () => {
    calls.n++;
    const r = results[Math.min(i++, results.length - 1)];
    return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
  };
  return { run, calls };
}

test("1回目で成功すれば、やり直さない", async () => {
  mock.method(console, "error", () => {});
  const { run, calls } = sequence([{ data: { id: 1 }, error: null }]);
  assert.deepEqual(await withReadRetry("t", run, NO_WAIT), { id: 1 });
  assert.equal(calls.n, 1);
});

test("一時的な失敗のあとに成功すれば、その結果を返す（記録なし = null も正しい結果）", async () => {
  mock.method(console, "error", () => {});
  const { run, calls } = sequence<null>([
    { data: null, error: fail },
    { data: null, error: fail },
    { data: null, error: null },
  ]);
  assert.equal(await withReadRetry("t", run, NO_WAIT), null);
  assert.equal(calls.n, 3);
});

test("例外（通信エラー等）もやり直しの対象にする", async () => {
  mock.method(console, "error", () => {});
  const { run, calls } = sequence([new Error("fetch failed"), { data: [1], error: null }]);
  assert.deepEqual(await withReadRetry("t", run, NO_WAIT), [1]);
  assert.equal(calls.n, 2);
});

test("最後まで失敗したら、空の結果ではなく例外にする（空のフォームで上書きさせない）", async () => {
  mock.method(console, "error", () => {});
  const { run, calls } = sequence([{ data: null, error: fail }]);
  await assert.rejects(withReadRetry("getTodaysDailyLog", run, NO_WAIT), (e: unknown) => {
    assert.ok(e instanceof DailyLogReadError);
    assert.match((e as Error).message, /getTodaysDailyLog failed \(57014\)/);
    return true;
  });
  assert.equal(calls.n, 3);
});
