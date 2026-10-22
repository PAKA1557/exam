// 경제학 그래프: 수요·공급 그래프를 SVG 문자열로 그린다.
// 색은 CSS 클래스(g-*)로 주므로 라이트/다크 테마를 따른다. 화면 코드와 분리해 둔다.
//
// 좌표: 가로 Q, 세로 P 모두 0~10 단위. 직선 수요곡선 P = 9 - 0.8(Q - k), 공급곡선 P = 1 + 0.8(Q - s)
// (k, s 는 곡선의 가로 이동량. 오른쪽 +, 왼쪽 -). 기울기 크기가 같아서
// 두 곡선이 같은 폭으로 움직이면 '불분명'한 쪽 변수가 그대로인 경우가 된다.
(function (root) {
  const W = 400, H = 320;
  const X0 = 44, Y0 = 286;          // 원점(O)의 화면 좌표
  const PW = 330, PH = 262;         // 그림 영역
  const sx = (q) => X0 + (q / 10) * PW;
  const sy = (p) => Y0 - (p / 10) * PH;
  const f1 = (n) => Math.round(n * 10) / 10;

  const SHIFT = 2;                  // 한 곡선만 움직일 때의 이동량
  const BOTH_S = 2.5;               // 두 곡선이 함께 움직일 때 공급곡선 이동량
  const CASES = [1.2, 2.5, 4.2];    // 그때 수요곡선 이동량(공급보다 작음·같음·큼)

  const dP = (q, k) => 9 - 0.8 * (q - k);
  const sP = (q, s) => 1 + 0.8 * (q - s);
  const eq = (k, s) => ({ q: 5 + (k + s) / 2, p: 5 + 0.4 * (k - s) });

  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }
  // 'P*', 'Q1', 'D0' 같은 이름을 아래첨자/위첨자로 그린다.
  function lab(name) {
    const m = /^([A-Za-z]+)(.*)$/.exec(name);
    if (!m || !m[2]) return esc(name);
    const sup = m[2] === '*';
    return `${esc(m[1])}<tspan class="g-sub" dy="${sup ? -5 : 4}">${esc(m[2])}</tspan>`;
  }
  function text(x, y, name, cls = 'g-label', anchor = 'start') {
    return `<text x="${f1(x)}" y="${f1(y)}" class="${cls}" text-anchor="${anchor}">${lab(name)}</text>`;
  }
  function line(x1, y1, x2, y2, cls) {
    return `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" class="${cls}"/>`;
  }
  function dot(x, y) {
    return `<circle cx="${f1(x)}" cy="${f1(y)}" r="3.6" class="g-dot"/>`;
  }

  function axes() {
    return (
      line(X0, Y0, X0, Y0 - PH - 8, 'g-axis') +
      line(X0, Y0, X0 + PW + 10, Y0, 'g-axis') +
      text(X0 - 8, Y0 - PH - 10, 'P', 'g-axis-label', 'end') +
      text(X0 + PW + 12, Y0 + 18, 'Q', 'g-axis-label', 'end') +
      text(X0 - 8, Y0 + 18, 'O', 'g-axis-label', 'end')
    );
  }

  // 축 눈금 이름이 겹치지 않게 간격을 벌린다.
  function spread(items, key, gap) {
    items.sort((a, b) => a[key] - b[key]);
    for (let i = 1; i < items.length; i++) {
      if (items[i][key] - items[i - 1][key] < gap) items[i][key] = items[i - 1][key] + gap;
    }
    return items;
  }
  // 균형점에서 두 축으로 점선을 긋고 축에 이름을 단다.
  function guides(points) {
    let out = '';
    const pl = [], ql = [];
    for (const pt of points) {
      out += line(X0, sy(pt.p), sx(pt.q), sy(pt.p), 'g-guide') + line(sx(pt.q), sy(pt.p), sx(pt.q), Y0, 'g-guide');
      if (pt.pName) pl.push({ y: sy(pt.p) + 4, name: pt.pName });
      if (pt.qName) ql.push({ x: sx(pt.q), name: pt.qName });
    }
    // 화면 y 는 아래로 갈수록 크다. 위에서부터 벌린다.
    for (const l of spread(pl, 'y', 12)) out += text(X0 - 6, l.y, l.name, 'g-tick', 'end');
    for (const l of spread(ql, 'x', 17)) out += text(l.x, Y0 + 17, l.name, 'g-tick', 'middle');
    return out;
  }

  // 수요/공급 직선. 화면 밖으로 나가지 않게 Q 범위를 자른다.
  function curve(kind, shift, name, cls) {
    const fn = kind === 'D' ? (q) => dP(q, shift) : (q) => sP(q, shift);
    let qa = 1 + shift, qb = 9 + shift;
    qa = Math.max(qa, 0.3); qb = Math.min(qb, 9.8);
    // P 가 0.4~9.8 사이에 들도록 다시 자른다.
    const clampQ = (q) => {
      const p = fn(q);
      if (p > 9.8) return kind === 'D' ? q + (p - 9.8) / 0.8 : q - (p - 9.8) / 0.8;
      if (p < 0.4) return kind === 'D' ? q - (0.4 - p) / 0.8 : q + (0.4 - p) / 0.8;
      return q;
    };
    qa = clampQ(qa); qb = clampQ(qb);
    const x1 = sx(qa), y1 = sy(fn(qa)), x2 = sx(qb), y2 = sy(fn(qb));
    // 이름: 수요곡선은 오른쪽 아래 끝, 공급곡선은 오른쪽 위 끝
    const lx = x2 + 4, ly = kind === 'D' ? y2 + 4 : y2 - 2;
    return line(x1, y1, x2, y2, `g-curve ${kind === 'D' ? 'g-d' : 'g-s'} ${cls || ''}`) + text(lx, ly, name, `g-curve-label ${kind === 'D' ? 'g-d-text' : 'g-s-text'}`);
  }

  // 곡선 이동 방향 화살표 (그림 위쪽 여백에 가로로)
  function shiftArrow(kind, shift) {
    const p = kind === 'D' ? 7.4 : 7.6;
    const q0 = kind === 'D' ? (9 - p) / 0.8 : (p - 1) / 0.8;
    const x1 = sx(q0), x2 = sx(q0 + shift * 0.82), y = sy(p);
    const dir = shift > 0 ? 1 : -1;
    return line(x1, y, x2, y, 'g-arrow') +
      `<path d="M${f1(x2)},${f1(y)} l${-7 * dir},-4 v8 z" class="g-arrow-head"/>`;
  }

  const DIR = { right: 1, left: -1, none: 0 };

  // 균형 변화 그래프
  //   d, s: 'right' | 'left' | 'none'
  //   mode: 'builder' — 사용자가 고른 곡선만 그린다(새 균형점은 그리지 않는다)
  //         'model'   — 모범 그래프. 두 곡선이 함께 움직이면 D1·D2·D3 세 경우를 그린다.
  function shift({ d = 'none', s = 'none', mode = 'model' } = {}) {
    const dd = DIR[d], ds = DIR[s];
    let body = axes();
    const e0 = eq(0, 0);
    const pts = [{ ...e0, pName: 'P0', qName: 'Q0' }];
    const both = dd !== 0 && ds !== 0;
    const old = dd || ds ? 'g-old' : '';

    body += curve('D', 0, 'D0', dd ? old : '');
    body += curve('S', 0, 'S0', ds ? old : '');

    if (mode === 'builder') {
      if (dd) body += curve('D', dd * SHIFT, 'D1') + shiftArrow('D', dd * SHIFT);
      if (ds) body += curve('S', ds * SHIFT, 'S1') + shiftArrow('S', ds * SHIFT);
      return wrap(guides(pts) + body + dot(sx(e0.q), sy(e0.p)) + text(sx(e0.q) + 7, sy(e0.p) - 7, 'E0', 'g-point'),
        '수요·공급 그래프');
    }

    let marks = '';
    if (!both) {
      const k = dd * SHIFT, sv = ds * SHIFT;
      if (dd) body += curve('D', k, 'D1');
      if (ds) body += curve('S', sv, 'S1');
      if (dd || ds) {
        const e1 = eq(k, sv);
        pts.push({ ...e1, pName: 'P1', qName: 'Q1' });
        marks += dot(sx(e1.q), sy(e1.p)) + text(sx(e1.q) + 7, sy(e1.p) - 7, 'E1', 'g-point');
      }
    } else {
      const sv = ds * BOTH_S;
      body += curve('S', sv, 'S1');
      CASES.forEach((m, i) => {
        const k = dd * m;
        body += curve('D', k, `D${i + 1}`);
        const e = eq(k, sv);
        const same = (a, b) => Math.abs(a - b) < 0.01;
        pts.push({ ...e, pName: same(e.p, e0.p) ? null : `P${i + 1}`, qName: same(e.q, e0.q) ? null : `Q${i + 1}` });
        marks += dot(sx(e.q), sy(e.p)) + text(sx(e.q) + 7, sy(e.p) - 6, `E${i + 1}`, 'g-point');
      });
    }
    marks += dot(sx(e0.q), sy(e0.p)) + text(sx(e0.q) + 7, sy(e0.p) + 15, 'E0', 'g-point');
    return wrap(guides(pts) + body + marks, '균형 변화 모범 그래프');
  }

  // 1번: 시장 균형의 효율성 (소비자잉여·생산자잉여)
  function surplus() {
    const D = (q) => 9 - 0.8 * q, S = (q) => 1 + 0.8 * q;
    const q1 = 2.5, qs = 5, q2 = 7.5;
    let b = axes();
    const poly = (pts, cls) => `<polygon points="${pts.map(([q, p]) => `${f1(sx(q))},${f1(sy(p))}`).join(' ')}" class="${cls}"/>`;
    b += poly([[0, 5], [0, 9], [5, 5]], 'g-cs') + poly([[0, 1], [0, 5], [5, 5]], 'g-ps');
    b += line(sx(0), sy(9), sx(9.5), sy(D(9.5)), 'g-curve g-d') + text(sx(9.5) + 4, sy(D(9.5)) + 4, 'D', 'g-curve-label g-d-text');
    b += line(sx(0), sy(1), sx(9.5), sy(S(9.5)), 'g-curve g-s') + text(sx(9.5) + 4, sy(S(9.5)) - 2, 'S', 'g-curve-label g-s-text');
    b += line(X0, sy(5), sx(qs), sy(5), 'g-guide');
    for (const q of [q1, qs, q2]) b += line(sx(q), Y0, sx(q), sy(Math.max(D(q), S(q))), 'g-guide');
    b += text(sx(q1), Y0 + 17, 'Q1', 'g-tick', 'middle') + text(sx(qs), Y0 + 17, 'Q*', 'g-tick', 'middle') + text(sx(q2), Y0 + 17, 'Q2', 'g-tick', 'middle');
    b += text(X0 - 6, sy(5) + 4, 'P*', 'g-tick', 'end');
    b += text(X0 - 6, sy(9) + 4, 'b', 'g-point', 'end') + text(X0 - 6, sy(1) + 4, 'a', 'g-point', 'end');
    b += text(sx(q1) + 4, sy(D(q1)) - 6, 'c', 'g-point') + text(sx(q1) + 5, sy(S(q1)) + 14, 'd', 'g-point');
    b += text(sx(q2) - 4, sy(S(q2)) - 7, 'f', 'g-point', 'end') + text(sx(q2) + 5, sy(D(q2)) + 14, 'g', 'g-point');
    b += dot(sx(qs), sy(5)) + text(sx(qs), sy(5) - 9, 'E', 'g-point', 'middle');
    // 범례
    b += `<rect x="${X0 + 196}" y="14" width="12" height="12" class="g-cs"/>` + `<text x="${X0 + 213}" y="24" class="g-legend">소비자잉여</text>`;
    b += `<rect x="${X0 + 196}" y="32" width="12" height="12" class="g-ps"/>` + `<text x="${X0 + 213}" y="42" class="g-legend">생산자잉여</text>`;
    return wrap(b, '소비자잉여와 생산자잉여 그래프');
  }

  // 3번: 균형으로의 조정과정 (초과공급·초과수요)
  // 축 이름이 겹치지 않도록 공급곡선 기울기를 수요곡선과 다르게 둔다.
  function adjust() {
    const D = (q) => 9 - 0.8 * q, S = (q) => 2 + 0.6 * q;
    const Dq = (p) => (9 - p) / 0.8, Sq = (p) => (p - 2) / 0.6;
    const ps = 6, p1 = 7.6, p2 = 4.4;
    let b = axes();
    b += line(sx(0.6), sy(D(0.6)), sx(9.4), sy(D(9.4)), 'g-curve g-d') + text(sx(9.4) + 4, sy(D(9.4)) + 4, 'D', 'g-curve-label g-d-text');
    b += line(sx(0.4), sy(S(0.4)), sx(9.6), sy(S(9.6)), 'g-curve g-s') + text(sx(9.6) + 4, sy(S(9.6)) - 2, 'S', 'g-curve-label g-s-text');
    const arrow = (qa, qb, p) => {
      const y = sy(p), xa = sx(qa), xb = sx(qb);
      return line(xa, y, xb, y, 'g-arrow') +
        `<path d="M${f1(xa)},${f1(y)} l7,-4 v8 z M${f1(xb)},${f1(y)} l-7,-4 v8 z" class="g-arrow-head"/>`;
    };
    // P1 > P*: 초과공급
    b += line(X0, sy(p1), sx(Math.max(Dq(p1), Sq(p1))), sy(p1), 'g-guide');
    b += arrow(Dq(p1), Sq(p1), p1) + `<text x="${f1((sx(Dq(p1)) + sx(Sq(p1))) / 2)}" y="${f1(sy(p1) - 8)}" class="g-legend" text-anchor="middle">초과공급</text>`;
    // P2 < P*: 초과수요
    b += line(X0, sy(p2), sx(Math.max(Dq(p2), Sq(p2))), sy(p2), 'g-guide');
    b += arrow(Sq(p2), Dq(p2), p2) + `<text x="${f1((sx(Sq(p2)) + sx(Dq(p2))) / 2)}" y="${f1(sy(p2) + 16)}" class="g-legend" text-anchor="middle">초과수요</text>`;
    b += line(X0, sy(ps), sx(5), sy(ps), 'g-guide');
    const qs = [
      [Dq(p1), 'QD1'], [Sq(p2), 'QS2'], [5, 'Q*'], [Dq(p2), 'QD2'], [Sq(p1), 'QS1'],
    ];
    for (const [q, name] of qs) b += line(sx(q), Y0, sx(q), sy(Math.max(D(q), S(q), q === 5 ? ps : 0)), 'g-guide');
    for (const l of spread(qs.map(([q, name]) => ({ x: sx(q), name })), 'x', 22)) b += text(l.x, Y0 + 17, l.name, 'g-tick', 'middle');
    b += text(X0 - 6, sy(p1) + 4, 'P1', 'g-tick', 'end') + text(X0 - 6, sy(ps) + 4, 'P*', 'g-tick', 'end') + text(X0 - 6, sy(p2) + 4, 'P2', 'g-tick', 'end');
    b += dot(sx(5), sy(ps)) + text(sx(5) + 8, sy(ps) + 4, 'E', 'g-point');
    return wrap(b, '초과공급과 초과수요 그래프');
  }

  function wrap(inner, title) {
    return `<svg viewBox="0 0 ${W} ${H}" class="econ-graph" role="img" aria-label="${esc(title)}">${inner}</svg>`;
  }

  function render(spec) {
    if (!spec) return '';
    if (spec.kind === 'shift') return shift(spec);
    if (spec.kind === 'surplus') return surplus();
    if (spec.kind === 'adjust') return adjust();
    return '';
  }

  const api = { render, eq, SHIFT, BOTH_S, CASES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EconGraph = api;
})(this);
