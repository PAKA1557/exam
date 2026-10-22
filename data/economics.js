// 경제학입문 — 중간시험 서술형 문제 데이터
// 출처: 이범웅 교수 「경제학입문 강의안」 Ⅰ. 서론, Ⅱ. 수요공급이론(탄력성 제외), 2025·2026 중간시험 풀이
//
// 기출은 매번 같은 틀(1 효율성, 2 균형 변화, 3 조정과정, 4 기본원리, Bonus 법칙)에 조건만 바뀐다.
// 그래서 2번(균형 변화)은 강의안의 수요·공급 변화 요인을 조합해 문제와 모범 답안을 생성한다.
//
// type 'essay' — 형식은 data/writing.js 와 같다. graph: 모범 그래프, sketch: 손으로 그려 보는 칸을 보여 준다.
// type 'shift' — 그래프 서술형. 곡선 이동을 그래프에서 고르고(자동 채점) 3단계 설명을 쓴다.
//   expected: { d, s: 'right'|'left'|'none', price, qty: 'up'|'down'|'same'|'unclear' }
//   rubric 의 auto { field, equals } 는 그래프에서 고른 값과 비교한다. text: true 인 기준은 서술 기준이다.
window.QUIZ_BANK = window.QUIZ_BANK || {};

(function () {
  const C1 = '1. 시장 균형의 효율성';
  const C2A = '2-1) 수요 또는 공급의 변화';
  const C2B = '2-2) 수요·공급의 동시 변화';
  const C3 = '3. 균형으로의 조정과정';
  const C4 = '4. 경제학의 기본원리';
  const CB = 'Bonus. 수요·공급의 법칙';

  // 기출처럼 가상의 나라·재화·생산요소 이름을 쓴다. 문항 id 로 정해지므로 매번 같다.
  const NAMES = [
    { country: '아라키스', good: '멜란지', factor: '모래벌레', other: '스파이스커피' },
    { country: '동의민국', good: '효민원', factor: '정심정', other: '청람차' },
    { country: '칼라단', good: '해초빵', factor: '푸른해초', other: '바다소금' },
    { country: '은하공화국', good: '별사탕', factor: '운석가루', other: '달빛우유' },
  ];
  function pick(id) {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return NAMES[h % NAMES.length];
  }

  // ---------- 수요·공급 변화 요인 (강의안 Ⅱ-1-2), 3)) ----------
  // q: 문제에 넣을 조건(‘~하는’으로 끝남) / first: 풀이 첫째 문장의 원인 / second: 둘째 문장의 이유
  // kw: 서술 자동 판정에 쓸 핵심어
  const EVENTS = [
    { id: 'taxCut', side: 'D', dir: 1, kw: ['소득'],
      q: '정부가 경제활성화를 위하여 소득세율을 인하하는 정책을 시행하는',
      first: '소득세율 인하 정책이 시행되면 (가처분)소득이 증가하여',
      second: '(가처분)소득이 증가하면 {X}의 수요량이 증가하므로' },
    { id: 'taxHike', side: 'D', dir: -1, kw: ['소득'],
      q: '정부가 재정적자를 줄이기 위하여 소득세율을 인상하는 정책을 시행하는',
      first: '소득세율 인상 정책이 시행되면 (가처분)소득이 감소하여',
      second: '(가처분)소득이 감소하면 {X}의 수요량이 감소하므로' },
    { id: 'inferior', side: 'D', dir: -1, kw: ['열등재'],
      q: '{X|이} 열등재인 상황에서 소비자들의 소득이 증가하는',
      first: '소비자들의 소득이 증가하면',
      second: '소득이 증가할 때 열등재인 {X}의 수요량은 감소하므로' },
    { id: 'substituteUp', side: 'D', dir: 1, kw: ['대체재'],
      q: '{X}의 대체재인 {Z}의 가격이 상승하는',
      first: '대체재인 {Z}의 가격이 상승하면',
      second: '대체재인 {Z}의 가격이 상승하면 상대적으로 싸진 {X}의 수요량이 증가하므로' },
    { id: 'complementUp', side: 'D', dir: -1, kw: ['보완재'],
      q: '{X}의 보완재인 {Z}의 가격이 상승하는',
      first: '보완재인 {Z}의 가격이 상승하면',
      second: '보완재인 {Z}의 가격이 상승하면 함께 소비하는 {X}의 수요량이 감소하므로' },
    { id: 'complementDown', side: 'D', dir: 1, kw: ['보완재'],
      q: '{X}의 보완재인 {Z}의 가격이 하락하는',
      first: '보완재인 {Z}의 가격이 하락하면',
      second: '보완재인 {Z}의 가격이 하락하면 함께 소비하는 {X}의 수요량이 증가하므로' },
    { id: 'tasteUp', side: 'D', dir: 1, kw: ['기호'],
      q: '{X|이} 건강에 좋다는 연구 결과가 발표되어 소비자들의 기호가 높아지는',
      first: '소비자들의 기호가 높아지면',
      second: '{X|을} 더 좋아하게 된 소비자들이 모든 가격수준에서 더 많이 구입하려 하므로' },
    { id: 'expectD', side: 'D', dir: 1, kw: ['기대', '예상'],
      q: '소비자들이 다음 달부터 {X}의 가격이 오를 것으로 예상하는',
      first: '소비자들이 {X}의 가격 상승을 예상(기대)하면',
      second: '가격이 오르기 전에 사 두려는 소비자들로 인해 현재 {X}의 수요량이 증가하므로' },
    { id: 'buyersUp', side: 'D', dir: 1, kw: ['소비자'],
      q: '{X|을} 찾는 소비자의 수가 크게 늘어나는',
      first: '소비자의 수가 늘어나면',
      second: '소비자의 수가 늘어나면 모든 가격수준에서 {X}의 수요량이 증가하므로' },

    { id: 'factorUp', side: 'S', dir: -1, kw: ['요소가격', '생산요소'],
      q: '{X}의 생산요소인 {Y}의 가격이 상승하는',
      first: '생산요소인 {Y}의 가격이 상승하면',
      second: '요소가격이 상승하면 생산자들이 공급할 수 있는 {X}의 수량이 감소하므로' },
    { id: 'factorDown', side: 'S', dir: 1, kw: ['요소가격', '생산요소'],
      q: '{X}의 생산요소인 {Y}의 가격이 하락하는',
      first: '생산요소인 {Y}의 가격이 하락하면',
      second: '요소가격이 하락하면 생산자들이 공급할 수 있는 {X}의 수량이 증가하므로' },
    { id: 'techUp', side: 'S', dir: 1, kw: ['기술'],
      q: '{X}의 생산기술이 진보하는',
      first: '{X}의 생산기술이 진보하면',
      second: '기술이 진보하면 같은 비용으로 더 많이 생산할 수 있어 {X}의 공급량이 증가하므로' },
    { id: 'sellersUp', side: 'S', dir: 1, kw: ['생산자', '기업'],
      q: '{X|을} 생산하는 기업의 수가 늘어나는',
      first: '생산자의 수가 늘어나면',
      second: '생산자의 수가 늘어나면 모든 가격수준에서 {X}의 공급량이 증가하므로' },
    { id: 'expectS', side: 'S', dir: -1, kw: ['기대', '예상', '재고'],
      q: '생산자들이 앞으로 {X}의 가격이 오를 것으로 예상하는',
      first: '생산자들이 {X}의 가격 상승을 예상(기대)하면',
      second: '생산자들이 현재 생산량의 일부를 재고로 보관하여 현재 {X}의 공급량이 감소하므로' },
  ];

  // 받침에 따라 조사를 고른다: {X|이} → 「멜란지」가 / 「효민원」이
  const PARTICLE = { 이: ['이', '가'], 을: ['을', '를'], 은: ['은', '는'], 와: ['과', '와'] };
  function batchim(word) {
    const c = word.charCodeAt(word.length - 1);
    return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  }
  function fill(t, n) {
    const names = { X: n.good, Y: n.factor, Z: n.other };
    return t.replace(/\{([XYZ])(?:\|(이|을|은|와))?\}/g, (m, k, josa) => {
      const w = names[k];
      return `「${w}」` + (josa ? PARTICLE[josa][batchim(w) ? 0 : 1] : '');
    });
  }
  const side = (e) => (e.side === 'D' ? '수요' : '공급');
  const lr = (dir) => (dir > 0 ? '우측' : '좌측');
  const DIRNAME = { 1: 'right', '-1': 'left' };

  function single(e) {
    const id = `eco-s-${e.id}`;
    const n = pick(id);
    const X = `「${n.good}」`;
    const other = e.side === 'D' ? '공급' : '수요';
    // 수요 증가 → 가격↑ 거래량↑, 수요 감소 → ↓↓, 공급 증가 → 가격↓ 거래량↑, 공급 감소 → 가격↑ 거래량↓
    const pUp = e.side === 'D' ? e.dir > 0 : e.dir < 0;
    const qUp = e.dir > 0;
    const c = e.side === 'D' ? 'D' : 'S';
    const model = [
      `첫째, ${fill(e.first, n)} ${X}의 ${side(e)}에 영향을 미치므로 ${side(e)}곡선이 이동한다. 그러나 ${X}의 ${other}에는 영향을 미치지 않으므로 ${other}곡선은 변화하지 않는다.`,
      `둘째, ${fill(e.second, n)} ${side(e)}곡선은 ${lr(e.dir)}으로 이동한다.(${c}₀ → ${c}₁)`,
      `셋째, ${side(e)}곡선의 ${lr(e.dir)}이동으로 인해 ${X}의 균형가격은 P₀에서 P₁으로 ${pUp ? '상승' : '하락'}하고 균형거래량은 Q₀에서 Q₁으로 ${qUp ? '증가' : '감소'}한다.`,
    ].join('\n');
    const expected = {
      d: e.side === 'D' ? DIRNAME[e.dir] : 'none',
      s: e.side === 'S' ? DIRNAME[e.dir] : 'none',
      price: pUp ? 'up' : 'down',
      qty: qUp ? 'up' : 'down',
    };
    return {
      id, ch: C2A, type: 'shift',
      q: `『${n.country}』에서 ${fill(e.q, n)} 경우, ${X}시장의 균형가격과 거래량은 어떻게 변화하는지 설명하시오.(그래프 1개)`,
      model, expected,
      graph: { kind: 'shift', d: expected.d, s: expected.s },
      rubric: [
        ...graphRubric(expected),
        { label: `첫째: ${side(e)}곡선이 이동하고 ${other}곡선은 변하지 않음을 밝혔다`, auto: { all: ['수요곡선', '공급곡선'] }, text: true },
        { label: '둘째: 이동하는 이유와 방향을 썼다', auto: { any: e.kw }, text: true },
        { label: '셋째: 균형가격과 균형거래량의 변화를 썼다', auto: { all: ['균형가격', '균형거래량'] }, text: true },
      ],
    };
  }

  function combined(ed, es) {
    const id = `eco-c-${ed.id}-${es.id}`;
    const n = pick(id);
    const X = `「${n.good}」`;
    const dd = ed.dir, sd = es.dir;
    const inc = (dir) => (dir > 0 ? '증가' : '감소');
    // 수요 이동의 가격 효과는 dd, 공급 이동의 가격 효과는 -sd / 거래량 효과는 dd, sd
    const priceKnown = dd === -sd;
    const known = priceKnown
      ? `균형가격은 ${dd > 0 ? '상승' : '하락'}하지만 균형거래량의 변화는 불분명하다.`
      : `균형거래량은 ${dd > 0 ? '증가' : '감소'}하지만 균형가격의 변화는 불분명하다.`;
    // 불분명한 쪽: 수요 이동폭이 작으면 공급 효과, 크면 수요 효과를 따른다.
    // econ.js 와 같은 직선 모형: 수요 이동 k, 공급 이동 s 일 때의 균형
    const E = (k, s) => ({ q: 5 + (k + s) / 2, p: 5 + 0.4 * (k - s) });
    const e0 = E(0, 0), eS = E(dd * 1.2, sd * 2.5), eL = E(dd * 4.2, sd * 2.5);
    const word = (now, base, up, down) => (now > base ? up : down);
    const small = `수요곡선의 ${inc(dd)}폭이 공급곡선의 ${inc(sd)}폭보다 더 적으면(D₀ → D₁) 균형가격은 P₁으로 ${word(eS.p, e0.p, '상승', '하락')}하고 균형거래량은 Q₁으로 ${word(eS.q, e0.q, '증가', '감소')}한다.`;
    const large = `수요곡선의 ${inc(dd)}폭이 공급곡선의 ${inc(sd)}폭보다 더 크면(D₀ → D₃) 균형가격은 P₃로 ${word(eL.p, e0.p, '상승', '하락')}하고 균형거래량은 Q₃로 ${word(eL.q, e0.q, '증가', '감소')}한다.`;
    const model = [
      `첫째, ${fill(ed.first, n)} ${X}의 수요곡선이 이동하고, ${fill(es.first, n)} ${X}의 공급곡선이 이동한다.`,
      `둘째, ${fill(ed.second, n)} 수요곡선이 ${lr(dd)}으로 이동하고(D₀ → D₁, D₂, D₃), ${fill(es.second, n)} 공급곡선이 ${lr(sd)}으로 이동한다.(S₀ → S₁)`,
      `셋째, ${X}의 ${known} ${small} ${large}`,
    ].join('\n');
    const expected = {
      d: DIRNAME[dd], s: DIRNAME[sd],
      price: priceKnown ? (dd > 0 ? 'up' : 'down') : 'unclear',
      qty: priceKnown ? 'unclear' : (dd > 0 ? 'up' : 'down'),
    };
    return {
      id, ch: C2B, type: 'shift',
      q: `『${n.country}』에서 ${fill(ed.q, n)} 것과 함께 ${fill(es.q, n)} 경우, ${X}시장의 균형가격과 거래량은 어떻게 변화하는지 설명하시오.(그래프 1개)`,
      model, expected,
      graph: { kind: 'shift', d: expected.d, s: expected.s },
      why: '두 곡선이 함께 움직이면 가격과 거래량 중 하나는 방향이 정해지고, 나머지 하나는 두 곡선의 이동폭에 따라 달라진다(불분명). 기출 풀이처럼 수요곡선을 D₁·D₂·D₃ 세 경우로 그려 설명한다.',
      rubric: [
        ...graphRubric(expected),
        { label: '첫째: 수요곡선과 공급곡선이 모두 이동함을 밝혔다', auto: { all: ['수요곡선', '공급곡선'] }, text: true },
        { label: '둘째: 수요곡선이 이동하는 이유와 방향을 썼다', auto: { any: ed.kw }, text: true },
        { label: '둘째: 공급곡선이 이동하는 이유와 방향을 썼다', auto: { any: es.kw }, text: true },
        { label: '셋째: 방향이 정해지는 변수와 불분명한 변수를 구분했다', auto: { any: ['불분명'] }, text: true },
        { label: '셋째: 불분명한 쪽을 이동폭 비교로 두 경우로 나눠 설명했다', auto: { any: ['폭', '크면', '적으면'] }, text: true },
      ],
    };
  }

  const WORD = {
    right: '오른쪽으로 이동', left: '왼쪽으로 이동', none: '그대로',
    up: '상승', down: '하락', same: '불변', unclear: '불분명',
  };
  const QWORD = { up: '증가', down: '감소', same: '불변', unclear: '불분명' };
  function graphRubric(x) {
    return [
      { label: `그래프: 수요곡선 ${WORD[x.d]}`, auto: { field: 'd', equals: x.d } },
      { label: `그래프: 공급곡선 ${WORD[x.s]}`, auto: { field: 's', equals: x.s } },
      { label: `균형가격: ${WORD[x.price]}`, auto: { field: 'price', equals: x.price } },
      { label: `균형거래량: ${QWORD[x.qty]}`, auto: { field: 'qty', equals: x.qty } },
    ];
  }

  const generated = [];
  for (const e of EVENTS) generated.push(single(e));
  for (const ed of EVENTS.filter((e) => e.side === 'D')) {
    for (const es of EVENTS.filter((e) => e.side === 'S')) generated.push(combined(ed, es));
  }

  // ---------- 고정 서술형 (기출 1·3·4·Bonus) ----------
  const fixed = [
    {
      id: 'eco-e01', ch: C1, type: 'essay', sketch: true, graph: { kind: 'surplus' },
      q: '『아라키스』에서는 향신료인 「멜란지」의 거래가 활발해지고 있다. 「멜란지」가 거래되는 시장은 외부성이 없는 완전경쟁시장, 즉 이상적인 시장이라고 한다. 효율성 측면에서 「멜란지」시장의 균형의 성격에 대하여 논하시오.(32점, 그래프 1개)',
      model: [
        '자원배분의 결과 총잉여가 극대화되면 이러한 배분을 효율적이라 한다. 즉 효율성(efficiency)이란 사회구성원이 누리는 총잉여를 극대화시키는 자원배분의 속성을 의미한다.',
        '여기서 총잉여(사회적 후생)는 소비자잉여와 생산자잉여의 합을 의미한다. 소비자잉여는 총편익에서 실제 지불금액을 뺀 나머지이고, 생산자잉여는 실제 판매수입에서 총비용을 뺀 나머지이다. 그런데 소비자가 실제 지불한 금액과 생산자가 판매한 실제 금액은 동일하므로 총잉여는 총편익에서 총비용을 뺀 나머지가 된다.',
        '이상적인 시장인 「멜란지」시장에서 수요와 공급이 균형에 도달한 경우, 소비자의 한계편익과 생산자의 한계비용은 일치하고, 소비자잉여는 △P*bE이고 생산자잉여는 △aP*E이므로 총잉여는 △abE이다.',
        '균형거래량 Q*보다 더 적은 수량 Q₁만큼 「멜란지」가 거래되는 경우, 소비자의 한계편익이 생산자의 한계비용보다 더 크고 총잉여는 □abcd이다.',
        '또한 균형거래량 Q*보다 더 큰 수량 Q₂만큼 「멜란지」가 거래되는 경우, 소비자의 한계편익이 생산자의 한계비용보다 더 적고 총잉여는 △abE에서 △Efg를 뺀 것이다.',
        '결국 「멜란지」시장의 균형에서는 총잉여가 △abE로 극대화되므로 자원배분의 효율성이 달성된다.',
      ].join('\n'),
      rubric: [
        { label: '효율성 = 총잉여를 극대화하는 자원배분', auto: { all: ['총잉여', '극대'] } },
        { label: '총잉여 = 소비자잉여 + 생산자잉여', auto: { all: ['소비자잉여', '생산자잉여'] } },
        { label: '소비자잉여(총편익 − 지불금액), 생산자잉여(판매수입 − 총비용) 정의, 총잉여 = 총편익 − 총비용', auto: { all: ['총편익', '총비용'] } },
        { label: '균형에서 한계편익 = 한계비용, 총잉여 △abE', auto: { all: ['한계편익', '한계비용'] } },
        { label: 'Q₁(< Q*)에서 한계편익 > 한계비용, 총잉여 □abcd' },
        { label: 'Q₂(> Q*)에서 한계편익 < 한계비용, 총잉여 △abE − △Efg' },
        { label: '결론: 균형에서 총잉여가 극대화되어 효율성이 달성된다', auto: { any: ['효율성이달성', '효율적'] } },
        { label: '그래프: a·b·E·P*·Q*·Q₁·Q₂와 잉여 면적을 표시했다' },
      ],
    },
    {
      id: 'eco-e03', ch: C3, type: 'essay', sketch: true, graph: { kind: 'adjust' },
      q: '「멜란지」시장에서는 가격이 균형가격과 다를 경우에 조정과정을 거쳐 균형에 도달한다. 이러한 균형으로의 조정과정에 대하여 약술하시오.(20점, 그래프 1개)',
      model: [
        '만약 애초에 형성된 가격이 균형가격보다 높은 경우(P₁ > P*)에는 「멜란지」의 공급량이 수요량보다 더 큰데(Q_S¹ > Q_D¹), 이러한 상태를 초과공급(excess supply)이라 한다. 초과공급이 발생하면 「멜란지」의 재고가 쌓이게 되고 생산자들은 가격을 낮추어 재고를 줄이려 한다. 이에 따라 가격이 하락하고, 이러한 조정과정은 균형가격에 도달할 때까지 계속된다.',
        '만약 애초에 형성된 가격이 균형가격보다 낮은 경우(P₂ < P*)에는 「멜란지」의 수요량이 공급량보다 더 큰데(Q_D² > Q_S²), 이러한 상태를 초과수요(excess demand)라 한다. 초과수요가 발생하면 「멜란지」의 품귀현상이 발생하므로, 소비자들은 더 높은 가격을 지불하고서라도 구입하려고 한다. 이에 따라 가격이 상승하고, 이러한 조정과정은 균형가격에 도달할 때까지 계속된다.',
      ].join('\n'),
      rubric: [
        { label: 'P > P*: 공급량 > 수요량 = 초과공급', auto: { all: ['초과공급'] } },
        { label: '초과공급 → 재고 증가 → 생산자가 가격을 낮춤 → 가격 하락', auto: { any: ['재고'] } },
        { label: 'P < P*: 수요량 > 공급량 = 초과수요', auto: { all: ['초과수요'] } },
        { label: '초과수요 → 품귀 → 소비자가 더 높은 가격 지불 → 가격 상승', auto: { any: ['품귀', '더높은가격'] } },
        { label: '조정과정은 균형가격에 도달할 때까지 계속된다', auto: { any: ['균형가격에도달', '균형가격까지'] } },
        { label: '그래프: P₁·P₂·P*와 초과공급·초과수요 구간을 표시했다' },
      ],
    },
    {
      id: 'eco-e04', ch: C4, type: 'essay',
      q: 'N. G. Mankiw가 제시한 경제학의 기본원리 가운데 개별 경제주체의 의사결정(선택)과 (경제적) 상호작용, 국민경제의 작동에 관한 기본원리에 대하여 약술하시오.(20점)',
      model: [
        '개별 경제주체의 의사결정(선택)에 관한 기본원리는 4가지가 있다. 첫째, 모든 선택에는 대가가 있다.(기본원리 1) 둘째, 선택의 대가는 그것을 얻기 위해 포기한 그 무엇이다.(기본원리 2) 셋째, 합리적 판단은 한계적으로 이루어진다.(기본원리 3) 넷째, 사람들은 경제적 유인에 반응한다.(기본원리 4)',
        '개별 경제주체의 (경제적) 상호작용에 관한 기본원리는 3가지가 있다. 첫째, 자유거래는 사람을 이롭게 한다.(기본원리 5) 둘째, 일반적으로 시장은 경제활동을 조직하는 좋은 수단이다.(기본원리 6) 셋째, 경우에 따라 정부가 시장성과를 개선할 수 있다.(기본원리 7)',
        '국민경제의 작동에 관한 기본원리는 3가지가 있다. 첫째, 한 나라의 생활수준은 그 나라의 생산능력에 달려 있다.(기본원리 8) 둘째, 통화량이 지나치게 늘면 물가는 상승한다.(기본원리 9) 셋째, 단기적으로는 인플레이션과 실업 사이에 상충관계가 있다.(기본원리 10)',
      ].join('\n'),
      rubric: [
        { label: '의사결정 원리 1·2: 모든 선택에는 대가 / 대가는 포기한 그 무엇', auto: { all: ['대가', '포기'] } },
        { label: '의사결정 원리 3·4: 합리적 판단은 한계적 / 경제적 유인에 반응', auto: { all: ['한계적', '유인'] } },
        { label: '상호작용 원리 5·6·7: 자유거래 / 시장은 좋은 수단 / 정부가 시장성과 개선', auto: { all: ['자유거래', '시장', '정부'] } },
        { label: '국민경제 원리 8·9·10: 생산능력 / 통화량과 물가 / 인플레이션과 실업의 상충관계', auto: { all: ['생산능력', '통화량', '인플레이션', '실업'] } },
        { label: '세 묶음(4·3·3개)을 맞게 나눴다' },
      ],
    },
    {
      id: 'eco-e05', ch: C4, type: 'essay',
      q: 'N. G. Mankiw가 제시한 경제학의 기본원리 가운데 개별 경제주체의 의사결정(선택)에 관한 기본원리에 대하여 약술하시오.',
      model: '개별 경제주체의 의사결정(선택)에 관한 기본원리는 4가지가 있다. 첫째, 모든 선택에는 대가가 있다.(기본원리 1) 둘째, 선택의 대가는 그것을 얻기 위해 포기한 그 무엇이다.(기본원리 2) 셋째, 합리적 판단은 한계적으로 이루어진다.(기본원리 3) 넷째, 사람들은 경제적 유인에 반응한다.(기본원리 4)',
      why: '기본원리 2의 ‘선택의 대가’는 회계학적 비용이 아니라 기회비용, 즉 포기한 대안 중 가장 큰 이득이다.',
      rubric: [
        { label: '원리 1: 모든 선택에는 대가가 있다', auto: { all: ['대가'] } },
        { label: '원리 2: 선택의 대가는 그것을 얻기 위해 포기한 그 무엇이다', auto: { any: ['포기'] } },
        { label: '원리 3: 합리적 판단은 한계적으로 이루어진다', auto: { any: ['한계적'] } },
        { label: '원리 4: 사람들은 경제적 유인에 반응한다', auto: { any: ['유인'] } },
      ],
    },
    {
      id: 'eco-e06', ch: C4, type: 'essay',
      q: 'N. G. Mankiw가 제시한 경제학의 기본원리 가운데 개별 경제주체의 (경제적) 상호작용에 관한 기본원리와 국민경제의 작동에 관한 기본원리에 대하여 약술하시오.',
      model: [
        '개별 경제주체의 (경제적) 상호작용에 관한 기본원리는 3가지가 있다. 첫째, 자유거래는 사람을 이롭게 한다.(기본원리 5) 둘째, 일반적으로 시장은 경제활동을 조직하는 좋은 수단이다.(기본원리 6) 셋째, 경우에 따라 정부가 시장성과를 개선할 수 있다.(기본원리 7)',
        '국민경제의 작동에 관한 기본원리는 3가지가 있다. 첫째, 한 나라의 생활수준은 그 나라의 생산능력에 달려 있다.(기본원리 8) 둘째, 통화량이 지나치게 늘면 물가는 상승한다.(기본원리 9) 셋째, 단기적으로는 인플레이션과 실업 사이에 상충관계가 있다.(기본원리 10)',
      ].join('\n'),
      rubric: [
        { label: '원리 5: 자유거래는 사람을 이롭게 한다', auto: { any: ['자유거래'] } },
        { label: '원리 6: 일반적으로 시장은 경제활동을 조직하는 좋은 수단이다', auto: { any: ['좋은수단', '조직'] } },
        { label: '원리 7: 경우에 따라 정부가 시장성과를 개선할 수 있다', auto: { any: ['정부'] } },
        { label: '원리 8: 생활수준은 생산능력에 달려 있다', auto: { any: ['생산능력'] } },
        { label: '원리 9: 통화량이 지나치게 늘면 물가는 상승한다', auto: { any: ['통화량'] } },
        { label: '원리 10: 단기적으로 인플레이션과 실업 사이에 상충관계가 있다', auto: { all: ['인플레이션', '실업'] } },
      ],
    },
    {
      id: 'eco-e07', ch: CB, type: 'essay',
      q: '수요의 법칙(law of demand)과 공급의 법칙(law of supply)에 대하여 약술하시오.(6점)',
      model: [
        '수요의 법칙(law of demand)이란 가격과 수요량 사이의 負(-)의 상관관계, 즉 다른 조건이 불변일 때 어떤 재화의 가격이 상승(하락)하면 그 재화의 수요량이 감소(증가)하는 현상을 의미한다.',
        '공급의 법칙(law of supply)이란 가격과 공급량 사이의 正(+)의 상관관계, 즉 다른 조건이 불변일 때 어떤 재화의 가격이 상승(하락)하면 그 재화의 공급량이 증가(감소)하는 현상을 의미한다.',
      ].join('\n'),
      rubric: [
        { label: '수요의 법칙: 가격과 수요량의 負(-)의 관계 (가격↑ → 수요량↓)', auto: { all: ['수요량'] } },
        { label: '공급의 법칙: 가격과 공급량의 正(+)의 관계 (가격↑ → 공급량↑)', auto: { all: ['공급량'] } },
        { label: '‘다른 조건이 불변일 때’라는 전제를 썼다', auto: { any: ['다른조건', '불변', 'ceterisparibus'] } },
        { label: '‘수요’가 아니라 ‘수요량’, ‘공급’이 아니라 ‘공급량’으로 썼다' },
      ],
    },
  ];

  window.QUIZ_BANK.economics = {
    title: '경제학입문',
    questions: fixed.slice(0, 1).concat(generated, fixed.slice(1)),
  };
})();
