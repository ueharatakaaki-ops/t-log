// lib/client/resilient-post.ts の単体テスト（npm test で実行）。
// 時間はモックタイマーで進めるため、「止まる」通信のテストも実時間を待たない。
import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { resilientPostJson, type ResilientPostOutcome } from "@/lib/client/resilient-post";

beforeEach(() => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
});
afterEach(() => {
  mock.timers.reset();
});

// 応答しない（止まる）通信。本物の fetch と同じく、打ち切られたら AbortError で失敗する
function hangingResponse(init?: RequestInit): Promise<Response> {
  return new Promise((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });
}

function jsonResponse(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

// 結果が出るまで仮想時間を進め、かかった仮想時間（ミリ秒）も返す
async function runWithClock<T>(promise: Promise<ResilientPostOutcome<T>>) {
  let outcome: ResilientPostOutcome<T> | undefined;
  promise.then((o) => (outcome = o));
  let elapsed = 0;
  while (outcome === undefined) {
    await new Promise((r) => setImmediate(r));
    if (outcome !== undefined) break;
    mock.timers.tick(100);
    elapsed += 100;
    if (elapsed > 120_000) throw new Error("結果が返らない");
  }
  return { outcome, elapsed };
}

test("1回目が応答せず止まり、2回目で成功 → 成功になる", async () => {
  let calls = 0;
  const onAttempt: number[] = [];
  const fetchImpl = ((_url: string, init?: RequestInit) => {
    calls++;
    return calls === 1 ? hangingResponse(init) : jsonResponse(200, { ok: true });
  }) as typeof fetch;

  const { outcome, elapsed } = await runWithClock(
    resilientPostJson("/api/daily-log", { a: 1 }, { fetchImpl, onAttempt: (n) => onAttempt.push(n) })
  );

  assert.equal(outcome.kind, "ok");
  assert.equal(calls, 2);
  assert.deepEqual(onAttempt, [1, 2]);
  assert.deepEqual(
    outcome.attempts.map((a) => a.result),
    ["timeout", "ok"]
  );
  // 8秒で打ち切り → 1秒待って再試行
  assert.ok(elapsed >= 9_000 && elapsed <= 10_000, `elapsed=${elapsed}`);
});

test("3回とも止まる → 失敗（gave_up）として扱い、約30秒以内に結果が返る", async () => {
  let calls = 0;
  const fetchImpl = ((_url: string, init?: RequestInit) => {
    calls++;
    return hangingResponse(init);
  }) as typeof fetch;

  const { outcome, elapsed } = await runWithClock(resilientPostJson("/api/daily-log", {}, { fetchImpl }));

  assert.equal(outcome.kind, "gave_up");
  assert.equal(calls, 3);
  assert.deepEqual(
    outcome.attempts.map((a) => a.result),
    ["timeout", "timeout", "timeout"]
  );
  // 8秒×3 + 待ち 0+1+3秒 = 28秒
  assert.ok(elapsed <= 30_000, `elapsed=${elapsed}`);
  assert.ok(elapsed >= 28_000, `elapsed=${elapsed}`);
});

for (const status of [400, 401, 403, 409]) {
  test(`${status} は再試行せず、サーバーのメッセージを返す`, async () => {
    let calls = 0;
    const fetchImpl = (() => {
      calls++;
      return jsonResponse(status, { ok: false, error: `エラー${status}` });
    }) as typeof fetch;

    const { outcome } = await runWithClock(resilientPostJson<{ error: string }>("/api/daily-log", {}, { fetchImpl }));

    assert.equal(calls, 1);
    assert.equal(outcome.kind, "http_error");
    if (outcome.kind === "http_error") {
      assert.equal(outcome.status, status);
      assert.equal(outcome.data?.error, `エラー${status}`);
    }
  });
}

for (const status of [500, 502, 503, 408, 429]) {
  test(`${status} は再試行する（3回目で成功）`, async () => {
    let calls = 0;
    const fetchImpl = (() => {
      calls++;
      return calls < 3 ? jsonResponse(status, { ok: false }) : jsonResponse(200, { ok: true });
    }) as typeof fetch;

    const { outcome } = await runWithClock(resilientPostJson("/api/daily-log", {}, { fetchImpl }));

    assert.equal(calls, 3);
    assert.equal(outcome.kind, "ok");
    assert.deepEqual(
      outcome.attempts.map((a) => a.result),
      [`http_${status}`, `http_${status}`, "ok"]
    );
  });
}

test("5xx が3回続くと gave_up になる", async () => {
  const fetchImpl = (() => jsonResponse(500, { ok: false })) as typeof fetch;
  const { outcome } = await runWithClock(resilientPostJson("/api/daily-log", {}, { fetchImpl }));
  assert.equal(outcome.kind, "gave_up");
  assert.equal(outcome.attempts.length, 3);
});

test("ネットワークエラー（fetch が失敗）は再試行する", async () => {
  let calls = 0;
  const fetchImpl = (() => {
    calls++;
    return calls === 1 ? Promise.reject(new TypeError("Failed to fetch")) : jsonResponse(200, { ok: true });
  }) as typeof fetch;

  const { outcome } = await runWithClock(resilientPostJson("/api/daily-log", {}, { fetchImpl }));
  assert.equal(outcome.kind, "ok");
  assert.deepEqual(
    outcome.attempts.map((a) => a.result),
    ["network_error", "ok"]
  );
});

test("JSON でない応答（HTMLのエラーページ等）でもステータスで判定する", async () => {
  const fetchImpl = (() => Promise.resolve(new Response("<html>Bad Gateway</html>", { status: 502 }))) as typeof fetch;
  const { outcome } = await runWithClock(resilientPostJson("/api/daily-log", {}, { fetchImpl }));
  assert.equal(outcome.kind, "gave_up");
});

test("fetch には cache: no-store・POST・JSON 本文が渡る", async () => {
  let seen: RequestInit | undefined;
  const fetchImpl = ((_url: string, init?: RequestInit) => {
    seen = init;
    return jsonResponse(200, { ok: true });
  }) as typeof fetch;
  await runWithClock(resilientPostJson("/api/daily-log", { x: 1 }, { fetchImpl }));
  assert.equal(seen?.cache, "no-store");
  assert.equal(seen?.method, "POST");
  assert.equal(seen?.body, JSON.stringify({ x: 1 }));
  assert.equal(seen?.credentials, undefined); // 同一オリジン既定のまま
});
