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
