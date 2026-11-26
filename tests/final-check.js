// 기말 대비 앱(final/) 문항 데이터와 출제 점검: node tests/final-check.js
const assert = require('assert');
const path = require('path');
const BANK = require(path.join(__dirname, '..', 'final', 'questions.js'));
const E = require(path.join(__dirname, '..', 'final', 'engine.js'));

let failures = 0;
function check(name, fn) {
  try { fn(); } catch (e) { failures++; console.error(`✗ ${name}: ${e.message}`); }
}

// 형식
const ids = new Set();
for (const q of BANK) {
  check(`${q.id} 형식`, () => {
    assert.ok(!ids.has(q.id), '중복 id');
    ids.add(q.id);
    assert.ok(E.UNITS.includes(q.u), '단원 u');
    assert.ok(E.TYPES.includes(q.t), '유형 t');
    assert.ok(['A', 'B'].includes(q.lv), '수준 lv');
    assert.ok(q.sec && q.q && q.src, 'sec·q·src 필요');
    const prefix = { law: 'l', ch7: 'c', ch8: 'p' }[q.u] + q.lv.toLowerCase() + '-' + { mc: 'm', short: 's', essay: 'e' }[q.t];
    assert.ok(q.id.startsWith(prefix), `id 머리 ${prefix}`);
    if (q.t === 'mc') {
      assert.strictEqual(q.ch.length, 4, '선지 4개');
      assert.strictEqual(new Set(q.ch).size, 4, '선지 중복');
      assert.ok(q.why, '해설');
    }
    if (q.t === 'short') {
      assert.ok(q.a && q.a.length, '정답 a');
      assert.ok(E.gradeShort(q, q.a[0]), '대표 정답이 채점을 통과');
      assert.ok(!E.gradeShort(q, '모르겠음'), '엉뚱한 답이 통과');
    }
    if (q.t === 'essay') {
      assert.ok(q.model, '모범답안');
      assert.strictEqual(E.rubricMax(q), E.POINTS.essay, '채점 기준 배점 합 8');
      const hints = E.rubricHints(q, q.model);
      hints.forEach((h, i) => assert.ok(h, `모범답안이 기준 ${i + 1}(${q.rubric[i].l})의 핵심어를 포함`));
    }
  });
}

// 출제 기준: 연도·날짜는 묻지 않는다
check('연도·날짜 문항 없음', () => {
  for (const q of BANK) {
    const text = q.q + ' ' + (q.ch || []).join(' ') + ' ' + (q.a || []).join(' ');
    assert.ok(!/(19|20)\d\d년/.test(text), `${q.id}에 연도`);
  }
});

// 구성
const count = {};
for (const q of BANK) {
  const k = `${q.t}-${q.lv}`;
  count[k] = (count[k] || 0) + 1;
}
console.log('문항 수', BANK.length, count);

// 정답 번호 분포
check('정답 번호 분포', () => {
  const pos = [0, 0, 0, 0];
  for (const q of BANK.filter((x) => x.t === 'mc')) {
    const order = E.choiceOrder(BANK, q);
    assert.deepStrictEqual(order.slice().sort(), [0, 1, 2, 3], `${q.id} 선지 배치`);
    pos[E.answerPos(BANK, q)]++;
  }
  console.log('정답 번호 ①~④', pos.join(' / '));
  assert.ok(Math.max(...pos) - Math.min(...pos) <= 1, '정답 번호가 고르지 않음');
});

// 단답 채점 규칙
check('단답 채점', () => {
  const find = (id) => BANK.find((q) => q.id === id);
  assert.ok(E.gradeShort(find('lb-s01'), '효율성, 일방성, 표준화'));
  assert.ok(E.gradeShort(find('lb-s02'), '작성자 불이익 원칙'));
  assert.ok(E.gradeShort(find('pb-s08'), 'DB, DC, IRP'));
  assert.ok(E.gradeShort(find('pb-s08'), '확정급여형 확정기여형 개인형퇴직연금'));
  assert.ok(!E.gradeShort(find('pb-s08'), 'DB, DC'));
  assert.ok(E.gradeShort(find('pa-s03'), '1/12'));
  assert.ok(!E.gradeShort(find('pa-s03'), '12'));
  assert.ok(E.gradeShort(find('pa-s04'), '㉠ 판매자격 ㉡ 적합성'));
});

// 실전 회차
check('실전 고정 회차', () => {
  const seen = new Set();
  for (let r = 1; r <= E.FIXED_ROUNDS; r++) {
    const exam = E.buildExam(BANK, r).map((id) => BANK.find((q) => q.id === id));
    const byType = (t) => exam.filter((q) => q.t === t).length;
    assert.strictEqual(byType('mc'), 20, `${r}회 4지선다 20`);
    assert.strictEqual(byType('short'), 5, `${r}회 단답 5`);
    assert.strictEqual(byType('essay'), 5, `${r}회 서술 5`);
    for (const q of exam) { assert.ok(!seen.has(q.id), `${r}회 ${q.id} 다른 회차와 겹침`); seen.add(q.id); }
    const a = exam.filter((q) => q.lv === 'A').length;
    console.log(`${r}회: A급 ${a} / 30`);
    assert.ok(a >= 8 && a <= 16, `${r}회 A급 비율`);
  }
  assert.strictEqual(E.examMax(), 100, '만점 100');
});

check('실전 무작위 회차', () => {
  for (let s = 0; s < 30; s++) {
    const ids = E.buildExam(BANK, 'random', s);
    assert.strictEqual(ids.length, 30);
    assert.strictEqual(new Set(ids).size, 30, '중복');
  }
});

if (failures) { console.error(`\n실패 ${failures}건`); process.exit(1); }
console.log('\n모두 통과');
