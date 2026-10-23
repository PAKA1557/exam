// 문제 데이터와 채점 로직 점검: node tests/check.js
const assert = require('assert');
const path = require('path');
const { grade, normalize, checkRule, isKnownRule } = require(path.join(__dirname, '..', 'grade.js'));

global.window = {};
require(path.join(__dirname, '..', 'data', 'finance.js'));
require(path.join(__dirname, '..', 'data', 'insurance.js'));
require(path.join(__dirname, '..', 'data', 'writing.js'));
require(path.join(__dirname, '..', 'data', 'economics.js'));
const EconGraph = require(path.join(__dirname, '..', 'econ.js'));
const Adaptive = require(path.join(__dirname, '..', 'adaptive.js'));
const BANK = window.QUIZ_BANK;

let failures = 0;
function check(name, fn) {
  try { fn(); } catch (e) { failures++; console.error(`✗ ${name}: ${e.message}`); }
}

// 데이터 형식
const ids = new Set();
for (const [subj, { title, questions }] of Object.entries(BANK)) {
  check(`${subj} 제목`, () => assert.ok(title));
  for (const q of questions) {
    check(`${q.id} 형식`, () => {
      assert.ok(!ids.has(q.id), '중복 id');
      ids.add(q.id);
      assert.ok(['blank', 'short', 'ox', 'essay', 'shift'].includes(q.type), 'type 은 blank/short/ox/essay/shift');
      assert.ok(q.ch && q.q, '단원과 문제 필요');
      assert.ok(!/\{[XYZ]/.test(q.q + (q.model || '')), '채우지 않은 이름 자리표시자');
      // 경제학 외 과목은 섹션과 지식 수준(1 기억, 2 이해, 3 적용)이 있어야 섹션별 정답률을 낼 수 있다.
      if (subj !== 'economics') {
        assert.ok(typeof q.sec === 'string' && q.sec, '섹션(sec) 필요');
        assert.ok([1, 2, 3].includes(q.lv), '수준(lv)은 1·2·3');
      }
      if (q.type === 'shift') {
        const x = q.expected;
        assert.ok(x && ['right', 'left', 'none'].includes(x.d) && ['right', 'left', 'none'].includes(x.s), 'expected 곡선 방향');
        assert.ok(['up', 'down', 'same', 'unclear'].includes(x.price) && ['up', 'down', 'same', 'unclear'].includes(x.qty), 'expected 결과');
        assert.ok(EconGraph.render(q.graph).startsWith('<svg'), '모범 그래프');
      }
      if (q.type === 'essay' || q.type === 'shift') {
        assert.ok(q.model, '모범 답안 필요');
        assert.ok(Array.isArray(q.rubric) && q.rubric.length, '채점 기준 필요');
        for (const r of q.rubric) {
          assert.ok(r.label, '기준 이름 필요');
          if (r.auto) {
            assert.ok(isKnownRule(r.auto), `알 수 없는 자동 기준: ${JSON.stringify(r.auto)}`);
            // 모범 답안이 자동 기준에 걸리면 기준이 너무 엄격한 것이다.
            assert.ok(checkRule(r.auto, q.model, q.expected), `모범 답안이 자동 기준 「${r.label}」을 통과하지 못함`);
          }
        }
        return;
      }
      assert.ok(Array.isArray(q.a) && q.a.length, '정답 필요');
      if (q.type === 'blank') assert.ok(/_{3,}/.test(q.q), '빈칸(___) 없음');
      if (q.type === 'ox') assert.ok(q.a.length === 1 && ['O', 'X'].includes(q.a[0]), "O/X 정답은 ['O'] 또는 ['X']");
    });
    if (q.type === 'essay' || q.type === 'shift') continue;
    check(`${q.id} 대표 정답으로 채점`, () => assert.ok(grade(q, q.a[0])));
    check(`${q.id} 빈 답은 오답`, () => assert.ok(!grade(q, '')));
  }
}

// 채점 규칙
const multi = { a: ['예금성, 대출성, 투자성, 보장성'], all: ['예금성', '대출성', '투자성', '보장성'] };
check('띄어쓰기·부호 무시', () => assert.strictEqual(normalize(' 대출금리 − 예금금리. '), '대출금리-예금금리'));
check('여러 항목은 순서 무관', () => assert.ok(grade(multi, '보장성 투자성 예금성 대출성')));
check('여러 항목 일부만 쓰면 오답', () => assert.ok(!grade(multi, '예금성, 대출성')));
check('O/X 는 반대 답이면 오답', () => assert.ok(!grade({ type: 'ox', a: ['O'] }, 'X')));
check('순서 있는 항목은 순서가 바뀌면 오답', () => assert.ok(!grade({ a: ['x'], all: ['원인', '해결'], ordered: true }, '해결 다음 원인')));

// 서술형 자동 판정: 교재의 좋은/나쁜 주제 문장 예시
const good = '패스트푸드 섭취는 청소년의 건강을 위협하는 주요 원인이다.';
check('좋은 주제 문장은 형태 기준 통과', () => {
  for (const r of ['complete', 'declarative', 'noFigurative', 'singleSentence']) assert.ok(checkRule(r, good), r);
});
check('의문문은 평서문 기준 탈락', () => assert.ok(!checkRule('declarative', '청소년은 왜 패스트푸드에 몰입할까?')));
check('비유문은 비유 기준 탈락', () => assert.ok(!checkRule('noFigurative', '패스트푸드는 청소년에게 마치 달콤한 독과 같다.')));
check('단어만 쓰면 완성 문장 기준 탈락', () => assert.ok(!checkRule('complete', '환경 문제')));
check('두 문장은 한 문장 기준 탈락', () => assert.ok(!checkRule('singleSentence', '첫 문장이다. 둘째 문장이다.')));
check('번호 위계 없는 개요는 탈락', () => assert.ok(!checkRule('numbered', '서론 원인 해결 결론')));
check('순서가 뒤바뀐 개요는 탈락', () => assert.ok(!checkRule({ order: [['원인'], ['해결']] }, '해결 방안을 먼저 쓰고 원인은 나중에')));
// 경제학: 균형 변화 모범 답안이 경제 이론과 맞는지 (수요 증가 → 가격↑ 거래량↑ 등)
check('균형 변화 기대값이 교과서 요약표와 일치', () => {
  const table = { // [수요, 공급] → [가격, 거래량]
    'right,none': ['up', 'up'], 'left,none': ['down', 'down'], 'none,right': ['down', 'up'], 'none,left': ['up', 'down'],
    'right,right': ['unclear', 'up'], 'right,left': ['up', 'unclear'], 'left,right': ['down', 'unclear'], 'left,left': ['unclear', 'down'],
  };
  for (const q of BANK.economics.questions.filter((x) => x.type === 'shift')) {
    const want = table[`${q.expected.d},${q.expected.s}`];
    assert.deepStrictEqual([q.expected.price, q.expected.qty], want, q.id);
  }
});
check('조사 처리', () => {
  const qs = BANK.economics.questions.map((q) => q.q).join('\n');
  assert.ok(!/「효민원」가|「멜란지」이 |「해초빵」를|「별사탕」를/.test(qs));
});
check('대소문자 무시', () => assert.ok(grade({ a: ['COFIX'] }, 'cofix')));

// ---------- 적응형 출제 ----------
check('익힘 단계 규칙', () => {
  const at = (st, outcome) => Adaptive.update({ st, n: 1, c: 0, t: 0 }, outcome, 1).st;
  assert.strictEqual(Adaptive.update(undefined, 'right', 1).st, 3, '처음 맞히면 보통(3)');
  assert.strictEqual(Adaptive.update(undefined, 'wrong', 1).st, 1, '처음 틀리면 1');
  assert.strictEqual(at(4, 'right'), 5);
  assert.strictEqual(at(5, 'right'), 5, '최대 5');
  assert.strictEqual(at(5, 'wrong'), 1, '익힌 문제도 틀리면 1로');
  assert.strictEqual(at(4, 'partial'), 4, '서술형 절반 이상은 유지');
  assert.strictEqual(at(1, 'partial'), 2);
});
check('기록 합치기는 더 최근 기록', () => {
  const m = Adaptive.merge({ a: { st: 5, n: 3, c: 3, t: 10 } }, { a: { st: 1, n: 4, c: 3, t: 20 }, b: { st: 2, n: 1, c: 0, t: 5 } });
  assert.strictEqual(m.a.st, 1);
  assert.strictEqual(m.b.st, 2);
});
check('같은 세트 재출제는 3~5문제 뒤', () => {
  for (let i = 0; i < 20; i++) {
    const q = Array.from({ length: 10 }, (_, k) => ({ id: 'q' + k }));
    const at = Adaptive.requeue(q, 2);
    assert.ok(at >= 6 && at <= 8 && q[at].id === 'q2' && q[at]._retry && q.length === 11);
  }
  const short = [{ id: 'a' }, { id: 'b' }];
  assert.strictEqual(Adaptive.requeue(short, 1), 2, '세트 끝을 넘지 않는다');
});

// 가상 학습자: 어려운 문제(정답 확률 30%) 20개, 쉬운 문제(90%) 40개를 10문제씩 40세트 푼다.
function simulate(strategy) {
  let seed = 12345;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const qs = Array.from({ length: 60 }, (_, i) => ({ id: 'q' + i, hard: i < 20, sec: i < 20 ? '어려움' : '쉬움' }));
  const recs = {};
  const seen = Object.fromEntries(qs.map((q) => [q.id, 0]));
  let now = 0;
  for (let set = 0; set < 40; set++) {
    now += 86400000;
    const picked = strategy === 'adaptive'
      ? Adaptive.pick(qs, recs, 10, { rng, now, tagsOf: (q) => [q.sec] })
      : qs.slice().sort(() => rng() - 0.5).slice(0, 10);
    assert.strictEqual(new Set(picked.map((q) => q.id)).size, 10, '한 세트에 같은 문제 중복 없음');
    for (const q of picked) {
      seen[q.id]++;
      recs[q.id] = Adaptive.update(recs[q.id], rng() < (q.hard ? 0.3 : 0.9) ? 'right' : 'wrong', now);
    }
  }
  const avg = (f) => { const xs = qs.filter(f).map((q) => seen[q.id]); return xs.reduce((a, b) => a + b, 0) / xs.length; };
  return { hard: avg((q) => q.hard), easy: avg((q) => !q.hard), unseen: qs.filter((q) => !seen[q.id]).length };
}
check('적응형: 어려운 문제가 쉬운 문제보다 훨씬 자주 나온다', () => {
  const a = simulate('adaptive'), r = simulate('random');
  assert.ok(a.hard > a.easy * 2, `적응형 어려움 ${a.hard.toFixed(1)}회 / 쉬움 ${a.easy.toFixed(1)}회`);
  assert.ok(r.hard < r.easy * 1.5, '무작위는 차이가 작아야 비교가 된다');
  assert.strictEqual(a.unseen, 0, '모든 문제가 적어도 한 번은 나온다');
});
check('적응형: 익힌 문제도 가끔 다시 나온다', () => {
  const qs = Array.from({ length: 30 }, (_, i) => ({ id: 'k' + i }));
  const recs = Object.fromEntries(qs.map((q) => [q.id, { st: 5, n: 5, c: 5, t: 0 }]));
  recs.k0 = { st: 1, n: 1, c: 0, t: 0 };
  const set = Adaptive.pick(qs, recs, 10, { now: 86400000 * 3 });
  assert.strictEqual(set.length, 10);
  assert.ok(set.some((q) => q.id === 'k0'), '약한 문제는 반드시 포함');
});

const counts = Object.entries(BANK).map(([s, b]) => {
  const ox = b.questions.filter((q) => q.type === 'ox').length;
  const essay = b.questions.filter((q) => q.type === 'essay').length;
  const shift = b.questions.filter((q) => q.type === 'shift').length;
  return `${s} ${b.questions.length} (O/X ${ox}${essay ? `, 서술형 ${essay}` : ''}${shift ? `, 그래프 ${shift}` : ''})`;
}).join(', ');
if (failures) {
  console.error(`\n실패 ${failures}건`);
  process.exit(1);
}
console.log(`모두 통과 (${counts})`);
