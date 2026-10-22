// 문제 데이터와 채점 로직 점검: node tests/check.js
const assert = require('assert');
const path = require('path');
const { grade, normalize } = require(path.join(__dirname, '..', 'grade.js'));

global.window = {};
require(path.join(__dirname, '..', 'data', 'finance.js'));
require(path.join(__dirname, '..', 'data', 'insurance.js'));
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
      assert.ok(['blank', 'short'].includes(q.type), 'type 은 blank/short');
      assert.ok(q.ch && q.q, '단원과 문제 필요');
      assert.ok(Array.isArray(q.a) && q.a.length, '정답 필요');
      if (q.type === 'blank') assert.ok(/_{3,}/.test(q.q), '빈칸(___) 없음');
    });
    check(`${q.id} 대표 정답으로 채점`, () => assert.ok(grade(q, q.a[0])));
    check(`${q.id} 빈 답은 오답`, () => assert.ok(!grade(q, '')));
  }
}

// 채점 규칙
const multi = { a: ['예금성, 대출성, 투자성, 보장성'], all: ['예금성', '대출성', '투자성', '보장성'] };
check('띄어쓰기·부호 무시', () => assert.strictEqual(normalize(' 대출금리 − 예금금리. '), '대출금리-예금금리'));
check('여러 항목은 순서 무관', () => assert.ok(grade(multi, '보장성 투자성 예금성 대출성')));
check('여러 항목 일부만 쓰면 오답', () => assert.ok(!grade(multi, '예금성, 대출성')));
check('대소문자 무시', () => assert.ok(grade({ a: ['COFIX'] }, 'cofix')));

const counts = Object.entries(BANK).map(([s, b]) => `${s} ${b.questions.length}`).join(', ');
if (failures) {
  console.error(`\n실패 ${failures}건`);
  process.exit(1);
}
console.log(`모두 통과 (${counts})`);
