// 적응형 출제: 문항별 익힘 단계를 기록하고, 약한 문제 위주로 세트를 고른다.
// 화면 코드와 분리해 두어 node 에서 시뮬레이션으로 검증할 수 있다(tests/check.js).
//
// 기록(record): { st, n, c, t }
//   st: 익힘 단계 0~5 (0 안 푼 문제, 1 방금 틀림, 2 약함, 3 보통, 4 거의 익힘, 5 익힘)
//   n: 푼 횟수, c: 맞힌 횟수, t: 마지막으로 푼 시각(ms)
(function (root) {
  const MAX = 5;

  // 결과: 'right' | 'partial'(서술형 기준 절반 이상) | 'wrong'
  function update(rec, outcome, now) {
    const r = rec ? { ...rec } : { st: 0, n: 0, c: 0, t: 0 };
    r.n += 1;
    r.t = now;
    if (outcome === 'right') {
      r.c += 1;
      // 처음 보자마자 맞힌 문제는 ‘보통’에서 시작한다. 이후 한 번 맞힐 때마다 한 단계씩.
      r.st = r.st === 0 ? 3 : Math.min(MAX, r.st + 1);
    } else if (outcome === 'partial') {
      r.st = r.st === 0 ? 2 : Math.max(2, r.st);
    } else {
      r.st = 1;
    }
    return r;
  }

  function group(rec) {
    const st = rec ? rec.st : 0;
    if (st === 0) return 'new';
    if (st <= 2) return 'weak';
    return 'known';
  }

  // 한 세트의 묶음별 비율
  const QUOTA = { weak: 0.6, new: 0.25, known: 0.15 };

  // 섹션(태그)별 정답률 → 가중치 보정. 덜 맞힌 섹션일수록 최대 2배까지.
  function tagBoosts(questions, records, tagsOf) {
    const acc = {};
    for (const q of questions) {
      const r = records[q.id];
      if (!r || !r.n) continue;
      for (const tag of tagsOf(q)) {
        const a = acc[tag] || (acc[tag] = { n: 0, c: 0 });
        a.n += r.n;
        a.c += r.c;
      }
    }
    const boost = {};
    for (const [tag, a] of Object.entries(acc)) {
      // 세 번 이상 풀어 본 섹션만 보정한다(한두 번으로 판단하지 않는다).
      boost[tag] = a.n >= 3 ? 1 + (1 - a.c / a.n) : 1;
    }
    return boost;
  }

  // 가중치 비복원 추출
  function weightedTake(items, k, weightOf, rng) {
    const pool = items.map((it) => ({ it, w: Math.max(weightOf(it), 1e-6) }));
    const out = [];
    while (out.length < k && pool.length) {
      let total = 0;
      for (const p of pool) total += p.w;
      let x = rng() * total;
      let i = 0;
      for (; i < pool.length - 1; i++) {
        x -= pool[i].w;
        if (x <= 0) break;
      }
      out.push(pool[i].it);
      pool.splice(i, 1);
    }
    return out;
  }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 세트 고르기
  //   pool: 형식·범위 조건으로 걸러진 문제들 / count: 문항 수 (Infinity 면 전부)
  //   opts.tagsOf(q): 섹션 태그 목록 / opts.all: 섹션 정답률 계산에 쓸 과목 전체 문제
  function pick(pool, records, count, opts = {}) {
    const rng = opts.rng || Math.random;
    const now = opts.now || Date.now();
    const tagsOf = opts.tagsOf || (() => []);
    const n = Math.min(count, pool.length);
    const boosts = tagBoosts(opts.all || pool, records, tagsOf);
    const tagBoost = (q) => {
      const tags = tagsOf(q);
      if (!tags.length) return 1;
      return tags.reduce((s, t) => s + (boosts[t] || 1), 0) / tags.length;
    };

    const groups = { weak: [], new: [], known: [] };
    for (const q of pool) groups[group(records[q.id])].push(q);

    const want = {
      weak: Math.round(n * QUOTA.weak),
      new: Math.round(n * QUOTA.new),
    };
    want.known = n - want.weak - want.new;

    const weight = {
      // 방금 틀린 문제(1)를 약한 문제(2)보다 2배 자주
      weak: (q) => (records[q.id].st === 1 ? 2 : 1) * tagBoost(q),
      new: (q) => tagBoost(q),
      // 익힌 문제는 오래 안 본 것부터, 단계가 낮을수록 조금 더 자주
      known: (q) => {
        const r = records[q.id];
        const days = Math.max(0, (now - r.t) / 86400000);
        return (1 + days) * (MAX + 1 - r.st) * tagBoost(q);
      },
    };

    const chosen = { weak: [], new: [], known: [] };
    for (const g of ['weak', 'new', 'known']) {
      chosen[g] = weightedTake(groups[g], Math.min(want[g], groups[g].length), weight[g], rng);
    }
    // 모자란 몫은 약한 문제 → 안 푼 문제 → 익힌 문제 순으로 채운다.
    let missing = n - chosen.weak.length - chosen.new.length - chosen.known.length;
    for (const g of ['weak', 'new', 'known']) {
      if (missing <= 0) break;
      const rest = groups[g].filter((q) => !chosen[g].includes(q));
      const extra = weightedTake(rest, missing, weight[g], rng);
      chosen[g] = chosen[g].concat(extra);
      missing -= extra.length;
    }
    return shuffle(chosen.weak.concat(chosen.new, chosen.known), rng);
  }

  // 틀린 문제를 같은 세트 안에서 3~5문제 뒤에 한 번 더 낸다. 다시 낸 문제는 또 틀려도 다시 넣지 않는다.
  function requeue(queue, index, rng) {
    const gap = 3 + Math.floor((rng || Math.random)() * 3);
    const at = Math.min(queue.length, index + 1 + gap);
    const item = { ...queue[index], _retry: true };
    queue.splice(at, 0, item);
    return at;
  }

  // 단원·섹션·수준별 집계
  function stats(questions, records, keyOf) {
    const out = new Map();
    for (const q of questions) {
      for (const key of [].concat(keyOf(q))) {
        if (key == null) continue;
        let s = out.get(key);
        if (!s) out.set(key, (s = { key, total: 0, seen: 0, n: 0, c: 0, st: [0, 0, 0, 0, 0, 0] }));
        const r = records[q.id];
        s.total += 1;
        s.st[r ? r.st : 0] += 1;
        if (r && r.n) {
          s.seen += 1;
          s.n += r.n;
          s.c += r.c;
        }
      }
    }
    for (const s of out.values()) s.acc = s.n ? s.c / s.n : null;
    return [...out.values()];
  }

  // 두 기기의 기록 합치기: 문항마다 더 최근에 푼 쪽
  function merge(a, b) {
    const out = { ...a };
    for (const [id, r] of Object.entries(b || {})) {
      if (!r || typeof r.st !== 'number') continue;
      if (!out[id] || (r.t || 0) > (out[id].t || 0)) out[id] = { st: r.st, n: r.n || 0, c: r.c || 0, t: r.t || 0 };
    }
    return out;
  }

  const api = { update, group, pick, requeue, stats, merge, tagBoosts, QUOTA, MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Adaptive = api;
})(this);
