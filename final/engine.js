// 채점·선지 배치·실전 출제 로직. 화면 코드와 분리해 node 로도 점검한다(tests/final-check.js).
(function (root) {
  const EXAM_MIN = 50;
  const POINTS = { mc: 2, short: 4, essay: 8 };
  // 실전 1회분: 4지선다 20 · 단답 5 · 서술 5, 범위 분량 비례(약관 약 30%, 3편 약 70%)
  const QUOTA = {
    mc: { law: 6, ch7: 5, ch8: 9 },
    short: { law: 2, ch7: 1, ch8: 2 },
    essay: { law: 2, ch7: 1, ch8: 2 },
  };
  const TYPES = ['mc', 'short', 'essay'];
  const UNITS = ['law', 'ch7', 'ch8'];
  const UNIT_NAME = { law: '약관규제법', ch7: '제7장 생명보험의 개요', ch8: '제8장 생명보험 상품' };
  const UNIT_SHORT = { law: '약관', ch7: '7장', ch8: '8장' };
  const TYPE_NAME = { mc: '4지선다', short: '단답형', essay: '서술형' };
  const FIXED_ROUNDS = 3;

  // ---------- 난수 ----------
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = typeof seed === 'number' ? seed >>> 0 : hash(String(seed));
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(list, rand) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ---------- 선지 배치 ----------
  // 데이터에서는 정답을 첫 번째에 두고, 화면에서는 고정된 순서로 섞는다.
  // 4지선다를 데이터 순서대로 4개씩 묶어 묶음마다 정답 자리를 ①②③④ 한 번씩 배정하므로 정답 번호가 고르게 나온다.
  let layoutCache = null;
  function buildLayouts(bank) {
    const map = {};
    const mcs = bank.filter((q) => q.t === 'mc');
    let block = [];
    mcs.forEach((q, i) => {
      if (i % 4 === 0) block = shuffle([0, 1, 2, 3], rng('block-' + Math.floor(i / 4)));
      const pos = block[i % 4];
      const wrong = shuffle([1, 2, 3], rng('wrong-' + q.id));
      const order = wrong.slice();
      order.splice(pos, 0, 0);
      map[q.id] = order; // order[화면 자리] = 데이터 선지 번호
    });
    return map;
  }
  function choiceOrder(bank, q) {
    if (!layoutCache || layoutCache.bank !== bank) layoutCache = { bank, map: buildLayouts(bank) };
    return layoutCache.map[q.id];
  }
  function answerPos(bank, q) { return choiceOrder(bank, q).indexOf(0); }

  // ---------- 단답 채점 ----------
  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[\s.,·・()\[\]{}'"“”‘’?!~:;「」『』<>㉠㉡]/g, '');
  }
  function gradeShort(q, input) {
    const given = normalize(input);
    if (!given) return false;
    if ((q.a || []).some((ans) => normalize(ans) === given)) return true;
    if (Array.isArray(q.all) && q.all.length) {
      return q.all.every((group) => group.some((w) => given.includes(normalize(w))));
    }
    return false;
  }

  // ---------- 서술형: 핵심어로 미리 체크(참고용, 최종 판단은 사용자) ----------
  function rubricHints(q, text) {
    const t = normalize(text);
    return q.rubric.map((r) => !!t && (r.kw || []).some((k) => t.includes(normalize(k))));
  }
  function rubricMax(q) { return q.rubric.reduce((s, r) => s + r.p, 0); }

  // ---------- 실전 출제 ----------
  // 묶음(유형×단원)마다 문항 풀의 A급 비율만큼 A급을 넣는다. 고정 회차는 A급 몫을 세 회차에 고르게 나눈다.
  function bucket(bank, t, u) { return bank.filter((q) => q.t === t && q.u === u); }

  function splitLevels(items, rand) {
    return { b: shuffle(items.filter((q) => q.lv === 'B'), rand), a: shuffle(items.filter((q) => q.lv === 'A'), rand) };
  }

  // 고정 회차: rounds 개 회차에 n 문항씩, 서로 겹치지 않게
  function dealFixed(items, n, rounds, key) {
    const { b, a } = splitLevels(items, rng('fixed-' + key));
    let aTotal = Math.round((n * rounds * a.length) / items.length);
    aTotal = Math.min(a.length, Math.max(aTotal, n * rounds - b.length));
    const offset = hash(key) % rounds;
    const out = [];
    for (let r = 0; r < rounds; r++) {
      const extra = (r - offset + rounds) % rounds < aTotal % rounds ? 1 : 0;
      const na = Math.floor(aTotal / rounds) + extra;
      out.push(a.splice(0, na).concat(b.splice(0, n - na)));
    }
    return out;
  }

  function dealRandom(items, n, rand) {
    const { b, a } = splitLevels(items, rand);
    const want = (n * a.length) / items.length;
    let na = Math.floor(want) + (rand() < want - Math.floor(want) ? 1 : 0);
    na = Math.min(a.length, Math.max(na, n - b.length));
    return a.slice(0, na).concat(b.slice(0, n - na));
  }

  function sortExam(bank, list) {
    const idx = new Map(bank.map((q, i) => [q.id, i]));
    return list.sort((x, y) => TYPES.indexOf(x.t) - TYPES.indexOf(y.t) || UNITS.indexOf(x.u) - UNITS.indexOf(y.u) || idx.get(x.id) - idx.get(y.id));
  }

  // round: 1~3 고정 회차(서로 겹치지 않음) / 'random' + seed
  function buildExam(bank, round, seed) {
    const picked = [];
    for (const t of TYPES) {
      for (const u of UNITS) {
        const n = QUOTA[t][u];
        if (round === 'random') {
          picked.push(...dealRandom(bucket(bank, t, u), n, rng('random-' + seed + t + u)));
        } else {
          picked.push(...dealFixed(bucket(bank, t, u), n, FIXED_ROUNDS, t + u)[round - 1]);
        }
      }
    }
    return sortExam(bank, picked).map((q) => q.id);
  }

  function examMax() {
    return TYPES.reduce((s, t) => s + UNITS.reduce((x, u) => x + QUOTA[t][u], 0) * POINTS[t], 0);
  }

  const api = { EXAM_MIN, POINTS, QUOTA, TYPES, UNITS, UNIT_NAME, UNIT_SHORT, TYPE_NAME, FIXED_ROUNDS,
    rng, shuffle, hash, choiceOrder, answerPos, normalize, gradeShort, rubricHints, rubricMax, buildExam, examMax };
  root.FinalEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
