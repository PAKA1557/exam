// 기말 대비 앱 화면. 모드: B급 문제집 · N제(B+A) · 실전 모의고사(50분) · 오답노트
// 정답과 해설은 확인(연습) 또는 제출(실전) 뒤에만 DOM 에 그린다.
(function () {
  const BANK = window.FINAL_Q;
  const E = window.FinalEngine;
  const BY_ID = new Map(BANK.map((q) => [q.id, q]));
  const app = document.getElementById('app');
  const NUMS = ['①', '②', '③', '④'];
  const SCALES = [0.9, 1, 1.12, 1.25];
  const SCALE_NAME = ['작게', '보통', '크게', '아주 크게'];
  const KEY = 'final-exam.v1';

  // ---------- 저장 ----------
  const blank = () => ({ wrong: {}, stat: {}, records: [], live: null, last: null, scale: 1 });
  let S = blank();
  try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 저장이 막힌 환경 */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 메모리로만 동작 */ } }

  // ---------- 도우미 ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (c, n) => (n ? Math.round((c / n) * 100) : 0);
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const minText = (ms) => { const m = Math.round(ms / 60000); return `${m}분`; };
  const lvTag = (q) => `<span class="tag lv-${q.lv}">${q.lv}급</span>`;
  const unitTag = (q) => `<span class="tag">${esc(E.UNIT_SHORT[q.u])} · ${esc(q.sec)}</span>`;
  const typeTag = (q) => `<span class="tag">${E.TYPE_NAME[q.t]}</span>`;
  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
  }
  function display(q) { return E.choiceOrder(BANK, q).map((k) => q.ch[k]); }
  function correctText(q) {
    if (q.t === 'mc') { const p = E.answerPos(BANK, q); return `${NUMS[p]} ${q.ch[0]}`; }
    if (q.t === 'short') return q.a[0];
    return '';
  }
  function record(id, ok) {
    const s = S.stat[id] || [0, 0];
    s[0]++; if (ok) s[1]++;
    S.stat[id] = s;
    if (ok) delete S.wrong[id]; else S.wrong[id] = 1;
  }

  // ---------- 글자 크기 ----------
  function applyScale() {
    document.documentElement.style.setProperty('--scale', SCALES[S.scale]);
    document.getElementById('font-label').textContent = SCALE_NAME[S.scale];
    measureTop();
  }
  function measureTop() {
    const tb = document.querySelector('.topbar');
    document.documentElement.style.setProperty('--tb', tb.offsetHeight + 'px');
  }
  window.addEventListener('resize', measureTop);

  // ---------- 화면 상태 ----------
  let view = 'home';
  let setup = null;   // 연습 설정
  let P = null;       // 연습 진행
  let X = null;       // 실전 화면 상태(문항표 열림, 제출 확인)
  let timer = null;

  function go(name) {
    view = name;
    if (name !== 'exam') { clearInterval(timer); timer = null; }
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    const fn = { home: renderHome, setup: renderSetup, practice: renderPractice, presult: renderPResult,
      examIntro: renderExamIntro, exam: renderExam, eresult: renderEResult, wrong: renderWrong }[view];
    app.innerHTML = fn();
    if (view === 'exam') startTimer();
    const auto = app.querySelector('[data-autofocus]');
    if (auto && window.matchMedia('(min-width: 1000px)').matches) auto.focus({ preventScroll: true });
  }

  // ===================== 홈 =====================
  function unitStats() {
    return E.UNITS.map((u) => {
      let n = 0, c = 0, seen = 0;
      const qs = BANK.filter((q) => q.u === u);
      qs.forEach((q) => { const s = S.stat[q.id]; if (s) { n += s[0]; c += s[1]; seen++; } });
      return { u, n, c, seen, total: qs.length };
    });
  }
  function renderHome() {
    const nB = BANK.filter((q) => q.lv === 'B').length;
    const nW = Object.keys(S.wrong).filter((id) => BY_ID.has(id)).length;
    const live = S.live && !S.live.done ? S.live : null;
    const recs = S.records.slice(-5).reverse();
    return `<div class="wrap home">
      <header class="home-head">
        <p class="eyebrow">금융보험의 이해 · 2026 2학기 기말 대비</p>
        <h1>약관규제법 · 생명보험(제3편)</h1>
        <p class="lede">강의자료 「약관의 규제에 관한 법률」과 「생명보험이란 무엇인가 2026」 제7·8장(251~281쪽). 형광펜·필기 강조 부분 위주로 냈습니다.</p>
      </header>
      ${live ? `<div class="panel resume"><div><b>실전 ${esc(live.label)} 진행 중</b> <span class="muted">· 남은 시간 ${mmss(live.deadline - Date.now())}</span></div><span class="spacer"></span>
        <button class="btn" data-act="exam-resume">이어서 풀기</button><button class="btn plain" data-act="exam-abandon">그만두기</button></div>` : ''}
      <div class="modes">
        <button class="mode" data-act="mode" data-mode="B">
          <span class="tag lv-B">B급</span><h2>B급 문제집</h2>
          <p class="mode-meta">정의·용어·구분을 묻는 기본 문제 ${nB}문항. 단원·유형별로 골라 바로 채점합니다.</p>
          <span class="mode-go">풀기 →</span></button>
        <button class="mode" data-act="mode" data-mode="N">
          <span class="tags"><span class="tag lv-B">B급</span><span class="tag lv-A">A급</span></span><h2>N제</h2>
          <p class="mode-meta">B급과 A급 전체 ${BANK.length}문항. A급은 사례 판단, 짝 개념 함정, 두 자료를 잇는 문제입니다.</p>
          <span class="mode-go">풀기 →</span></button>
        <button class="mode exam" data-act="exam-intro">
          <span class="tag">50분 · 100점</span><h2>실전 모의고사</h2>
          <p class="mode-meta">4지선다 20 · 단답형 5 · 서술형 5. 고정 3회분과 무작위 회차.</p>
          <span class="mode-go">시험 보기 →</span></button>
      </div>
      <div class="two">
        <section class="panel">
          <div class="row"><h2 style="font-size:1.15rem">오답노트</h2><span class="spacer"></span><span class="muted">${nW}문항</span></div>
          <p class="muted small" style="margin:.4rem 0 .9rem">틀리거나 서술형에서 만점이 아닌 문제가 쌓이고, 다시 맞히면 빠집니다.</p>
          <button class="btn ${nW ? '' : 'plain'}" data-act="wrong" ${nW ? '' : 'disabled'}>오답노트 열기</button>
        </section>
        <section class="panel">
          <h2 style="font-size:1.15rem">단원별 정답률</h2>
          <table class="stat-table"><tbody>
          ${unitStats().map((s) => `<tr><td>${esc(E.UNIT_NAME[s.u])}<div class="muted small">${s.seen}/${s.total}문항 풀어 봄</div></td>
            <td style="width:30%"><div class="bar"><i style="width:${pct(s.c, s.n)}%"></i></div></td>
            <td class="num">${s.n ? pct(s.c, s.n) + '%' : '–'}</td></tr>`).join('')}
          </tbody></table>
        </section>
      </div>
      ${recs.length ? `<section class="panel"><h2 style="font-size:1.15rem">최근 실전 기록</h2>
        <table class="stat-table"><tbody>${recs.map((r) => `<tr><td>${esc(r.label)} <span class="muted small">${esc(r.date)}</span></td>
          <td class="num">${r.score}점${r.pending ? ` <span class="muted small">(서술 ${r.pending}개 채점 전)</span>` : ''}</td><td class="num muted">${minText(r.used)}</td></tr>`).join('')}</tbody></table>
        ${S.last ? '<div style="margin-top:.75rem"><button class="link" data-act="eresult">마지막 시험 결과 다시 보기 →</button></div>' : ''}</section>` : ''}
    </div>`;
  }

  // ===================== 연습 설정 =====================
  function newSetup(mode) {
    return { mode, units: E.UNITS.slice(), types: E.TYPES.slice(), lv: mode === 'B' ? 'B' : 'all', order: 'book', onlyWrong: false };
  }
  function pool(st) {
    return BANK.filter((q) => st.units.includes(q.u) && st.types.includes(q.t)
      && (st.lv === 'all' || q.lv === st.lv) && (!st.onlyWrong || S.wrong[q.id]));
  }
  function chip(act, val, on, label, n) {
    return `<button type="button" class="chip" data-act="${act}" data-val="${val}" aria-pressed="${on}">${label}${n != null ? `<span class="n">${n}</span>` : ''}</button>`;
  }
  function renderSetup() {
    const st = setup;
    const base = BANK.filter((q) => st.lv === 'all' || q.lv === st.lv);
    const list = pool(st);
    return `<div class="wrap">
      <button class="link" data-act="home">← 처음으로</button>
      <header class="home-head"><p class="eyebrow">${st.mode === 'B' ? 'B급만' : 'B급 + A급'}</p><h1>${st.mode === 'B' ? 'B급 문제집' : 'N제'}</h1></header>
      <div class="field"><span class="label">단원</span><div class="chips">
        ${E.UNITS.map((u) => chip('set-unit', u, st.units.includes(u), esc(E.UNIT_NAME[u]), base.filter((q) => q.u === u).length)).join('')}</div></div>
      <div class="field"><span class="label">유형</span><div class="chips">
        ${E.TYPES.map((t) => chip('set-type', t, st.types.includes(t), E.TYPE_NAME[t], base.filter((q) => q.t === t && st.units.includes(q.u)).length)).join('')}</div></div>
      ${st.mode === 'N' ? `<div class="field"><span class="label">난이도</span><div class="chips">
        ${[['all', '전체'], ['B', 'B급만'], ['A', 'A급만']].map(([v, l]) => chip('set-lv', v, st.lv === v, l)).join('')}</div></div>` : ''}
      <div class="field"><span class="label">순서</span><div class="chips">
        ${chip('set-order', 'book', st.order === 'book', '교재 순서')}${chip('set-order', 'shuffle', st.order === 'shuffle', '섞어서')}
        ${chip('set-wrong', '1', st.onlyWrong, '오답노트에 있는 것만')}</div></div>
      <div class="row"><button class="btn big" data-act="start" ${list.length ? '' : 'disabled'}>${list.length}문항 풀기</button>
        ${list.length ? '' : '<span class="muted">고른 조건에 맞는 문항이 없습니다.</span>'}</div>
    </div>`;
  }

  // ===================== 연습 진행 =====================
  function startPractice(ids, label) {
    P = { label, ids, i: 0, res: {}, phase: 'answer', sel: null, input: '', checks: null };
    go('practice');
  }
  function curQ() { return BY_ID.get(P.ids[P.i]); }

  function renderPractice() {
    const q = curQ();
    const n = P.ids.length;
    const done = P.phase === 'done';
    const opts = q.t === 'mc' ? display(q) : [];
    let body = '';
    if (q.t === 'mc') {
      const ans = E.answerPos(BANK, q);
      body = `<div class="choices" role="group" aria-label="선지">${opts.map((c, k) => {
        let cls = '';
        if (done) { if (k === ans) cls = 'right'; else if (k === P.sel) cls = 'wrong'; } else if (k === P.sel) cls = 'sel';
        return `<button type="button" class="choice ${cls}" data-act="pick" data-k="${k}" ${done ? 'disabled' : ''}><span class="cn">${k + 1}</span><span>${esc(c)}</span></button>`;
      }).join('')}</div>`;
    } else if (q.t === 'short') {
      body = `<input class="text-in" id="ans" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
        placeholder="답을 입력하세요" value="${esc(P.input)}" ${done ? 'disabled' : 'data-autofocus'}>`;
    } else {
      body = P.phase === 'answer'
        ? `<textarea class="text-in" id="ans" placeholder="답안을 쓰거나, 종이에 쓴 뒤 바로 '모범답안과 비교'를 누르세요." data-autofocus>${esc(P.input)}</textarea>`
        : `<div class="mine ${P.input.trim() ? '' : 'empty'}">${P.input.trim() ? esc(P.input) : '(답안을 쓰지 않음)'}</div>`;
    }

    let action = '';
    let fb = '';
    if (P.phase === 'answer') {
      action = q.t === 'essay'
        ? `<button class="btn big" data-act="essay-open">모범답안과 비교</button>`
        : `<button class="btn big" data-act="check" ${q.t === 'mc' && P.sel == null ? 'disabled' : ''}>확인</button>`;
      action += `<button class="btn plain" data-act="dontknow">모르겠어요</button>`;
    } else if (P.phase === 'grade') {
      fb = essayGradeBlock(q, P.checks, 'pr');
      action = `<button class="btn big" data-act="essay-done">채점 완료</button>`;
    } else {
      fb = feedbackBlock(q);
      action = `<button class="btn big" data-act="next" data-autofocus>${P.i + 1 < n ? '다음 문제 →' : '결과 보기'}</button>`;
    }

    return `<div class="wrap">
      <div class="qhead"><button class="link" data-act="quit">← 그만하기</button>
        <div class="progress"><div class="bar"><i style="width:${pct(P.i + (done ? 1 : 0), n)}%"></i></div></div>
        <span class="muted small">${P.i + 1} / ${n}</span></div>
      <article class="card">
        <div class="tags">${lvTag(q)}${typeTag(q)}${unitTag(q)}</div>
        <p class="qtext">${esc(q.q)}</p>
        ${q.given ? `<div class="given">${esc(q.given)}</div>` : ''}
        ${body}
        ${fb}
        <div class="row">${action}</div>
      </article>
      ${q.t === 'mc' && !done ? '<p class="hint">모니터: 숫자키 1~4로 고르고 Enter로 확인</p>' : ''}
    </div>`;
  }

  function feedbackBlock(q) {
    const r = P.res[q.id];
    if (q.t === 'essay') {
      const cls = r.score === 8 ? 'ok' : r.score >= 4 ? 'part' : 'bad';
      return `<div class="fb ${cls}"><p class="verdict">${r.score} / 8점</p>
        ${r.score < 8 ? '<p class="small">만점이 아니라 오답노트에 넣었습니다.</p>' : ''}
        <p class="src">근거: ${esc(q.src)}</p></div>`;
    }
    const cls = r.ok ? 'ok' : 'bad';
    return `<div class="fb ${cls}">
      <p class="verdict">${r.ok ? '정답' : r.skip ? '모르는 문제로 표시' : '오답'}</p>
      ${r.ok && !r.over ? '' : `<p><b>정답</b> ${esc(correctText(q))}${q.t === 'short' && q.a.length > 1 ? ` <span class="muted small">(인정: ${q.a.slice(1).map(esc).join(', ')})</span>` : ''}</p>`}
      ${q.why ? `<p>${esc(q.why)}</p>` : ''}
      <p class="src">근거: ${esc(q.src)}</p>
      ${q.t === 'short' && !r.ok && !r.skip && P.input.trim() ? '<div><button class="btn ghost" data-act="override">표기만 다릅니다 · 맞은 걸로 할게요</button></div>' : ''}
    </div>`;
  }

  function essayGradeBlock(q, checks, scope) {
    const total = q.rubric.reduce((s, r, i) => s + (checks[i] ? r.p : 0), 0);
    return `<div class="field"><span class="label">모범답안</span><div class="model">${esc(q.model)}</div></div>
      <div class="field"><span class="label">채점 기준 <span class="muted small">(핵심어가 보이는 기준은 미리 체크했습니다. 내용을 보고 직접 고치세요)</span></span>
      <div class="rubric">${q.rubric.map((r, i) => `<label class="rub ${checks[i] ? 'on' : ''}">
        <input type="checkbox" data-act="rub" data-scope="${scope}" data-id="${q.id}" data-i="${i}" ${checks[i] ? 'checked' : ''}>
        <span>${esc(r.l)}</span><span class="pts">${r.p}점</span></label>`).join('')}</div>
      <p class="rub-total">합계 ${total} / 8점</p></div>`;
  }

  function checkPractice(skip) {
    const q = curQ();
    let ok = false;
    if (!skip) {
      if (q.t === 'mc') ok = P.sel === E.answerPos(BANK, q);
      else ok = E.gradeShort(q, P.input);
    }
    P.res[q.id] = { ok, skip: !!skip };
    record(q.id, ok);
    save();
    P.phase = 'done';
    render();
  }

  // ===================== 연습 결과 =====================
  function renderPResult() {
    const ids = P.ids;
    const res = ids.map((id) => ({ q: BY_ID.get(id), r: P.res[id] })).filter((x) => x.r);
    const okOf = (x) => (x.q.t === 'essay' ? x.r.score === 8 : x.r.ok);
    const ok = res.filter(okOf).length;
    const wrong = res.filter((x) => !okOf(x));
    const byUnit = E.UNITS.map((u) => { const l = res.filter((x) => x.q.u === u); return { u, n: l.length, c: l.filter(okOf).length }; }).filter((x) => x.n);
    return `<div class="wrap">
      <header class="home-head"><p class="eyebrow">${esc(P.label)}</p><h1>결과</h1></header>
      <div class="panel"><p class="score-big">${ok}<small> / ${res.length}문항 맞힘</small></p>
        <div class="kpis" style="margin-top:1rem">${byUnit.map((x) => `<div class="kpi"><div class="k">${esc(E.UNIT_NAME[x.u])}</div><div class="v">${x.c} / ${x.n}</div></div>`).join('')}</div></div>
      ${wrong.length ? `<section class="panel"><h2 style="font-size:1.15rem">틀린 문제 ${wrong.length}개</h2>
        ${wrong.map((x) => `<div class="list-item"><div class="grow"><div class="tags">${lvTag(x.q)}${typeTag(x.q)}</div><p style="margin-top:.3rem">${esc(x.q.q)}</p></div></div>`).join('')}</section>` : ''}
      <div class="row">
        ${wrong.length ? '<button class="btn big" data-act="retry-wrong">틀린 문제 다시 풀기</button>' : ''}
        <button class="btn plain big" data-act="home">처음으로</button></div>
    </div>`;
  }

  // ===================== 오답노트 =====================
  function renderWrong() {
    const ids = BANK.filter((q) => S.wrong[q.id]).map((q) => q.id);
    return `<div class="wrap">
      <button class="link" data-act="home">← 처음으로</button>
      <header class="home-head"><h1>오답노트</h1><p class="lede">${ids.length}문항. 다시 맞히면 자동으로 빠집니다.</p></header>
      ${ids.length ? `<div class="row"><button class="btn big" data-act="wrong-start">${ids.length}문항 다시 풀기</button></div>` : ''}
      ${E.UNITS.map((u) => {
        const l = ids.map((id) => BY_ID.get(id)).filter((q) => q.u === u);
        if (!l.length) return '';
        return `<section class="panel"><h2 style="font-size:1.1rem">${esc(E.UNIT_NAME[u])} <span class="muted small">${l.length}</span></h2>
          ${l.map((q) => `<div class="list-item"><div class="grow"><div class="tags">${lvTag(q)}${typeTag(q)}<span class="tag">${esc(q.sec)}</span></div>
            <p style="margin-top:.3rem">${esc(q.q)}</p></div><button class="btn plain" data-act="wrong-remove" data-id="${q.id}">빼기</button></div>`).join('')}</section>`;
      }).join('')}
    </div>`;
  }

  // ===================== 실전 =====================
  function renderExamIntro() {
    const best = (label) => {
      const l = S.records.filter((r) => r.label === label);
      return l.length ? Math.max(...l.map((r) => r.score)) : null;
    };
    const rounds = [1, 2, 3].map((r) => ({ r, label: `${r}회`, best: best(`${r}회`) }));
    return `<div class="wrap">
      <button class="link" data-act="home">← 처음으로</button>
      <header class="home-head"><p class="eyebrow">실전 모의고사</p><h1>50분 · 100점</h1></header>
      <div class="panel soft"><ul style="margin:0;padding-left:1.2rem;display:flex;flex-direction:column;gap:.3rem">
        <li>4지선다 20문항 × 2점, 단답형 5문항 × 4점, 서술형 5문항 × 8점</li>
        <li>범위 비율은 약관규제법 약 30%, 제3편 약 70%. B급과 A급이 섞여 나옵니다.</li>
        <li>시간이 끝나면 자동으로 제출됩니다. 실수로 창을 닫아도 남은 시간 그대로 이어서 풀 수 있습니다.</li>
        <li>4지선다·단답형은 자동 채점하고, 서술형은 제출 뒤 모범답안과 채점 기준을 보고 직접 채점합니다.</li>
      </ul></div>
      <div class="modes">
        ${rounds.map((x) => `<button class="mode" data-act="exam-start" data-round="${x.r}"><h2>실전 ${x.label}</h2>
          <p class="mode-meta">고정 문항. 세 회차는 서로 겹치지 않습니다.${x.best != null ? `<br>최고 ${x.best}점` : ''}</p><span class="mode-go">시작 →</span></button>`).join('')}
      </div>
      <button class="mode" data-act="exam-start" data-round="random"><h2>무작위 회차</h2>
        <p class="mode-meta">전체 문항에서 같은 비율로 새로 뽑습니다. 고정 회차를 다 푼 뒤에 쓰세요.</p><span class="mode-go">시작 →</span></button>
    </div>`;
  }

  function startExam(round) {
    const seed = Date.now();
    const ids = E.buildExam(BANK, round === 'random' ? 'random' : Number(round), seed);
    const now = Date.now();
    S.live = { round, label: round === 'random' ? '무작위' : `${round}회`, ids, ans: {}, flag: {}, cur: 0,
      start: now, deadline: now + E.EXAM_MIN * 60000, warned: {}, done: false };
    save();
    X = { nav: false, confirm: false };
    go('exam');
  }

  function answered(id) {
    const v = S.live.ans[id];
    return v != null && String(v).trim() !== '';
  }

  function renderExam() {
    const L = S.live;
    X = X || { nav: false, confirm: false };
    const q = BY_ID.get(L.ids[L.cur]);
    const no = L.cur + 1;
    const nAns = L.ids.filter(answered).length;
    const left = L.deadline - Date.now();
    let body = '';
    const v = L.ans[q.id];
    if (q.t === 'mc') {
      body = `<div class="choices">${display(q).map((c, k) => `<button type="button" class="choice ${v === k ? 'sel' : ''}" data-act="xpick" data-k="${k}">
        <span class="cn">${k + 1}</span><span>${esc(c)}</span></button>`).join('')}</div>`;
    } else if (q.t === 'short') {
      body = `<input class="text-in" id="xans" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="답을 입력하세요" value="${esc(v || '')}">`;
    } else {
      body = `<textarea class="text-in" id="xans" placeholder="답안을 쓰세요." style="min-height:14rem">${esc(v || '')}</textarea>`;
    }
    const section = (t, from, to) => `<div><h3>${E.TYPE_NAME[t]} ${from}~${to}</h3><div class="navgrid">${L.ids.slice(from - 1, to).map((id, k) => {
      const i = from - 1 + k;
      return `<button type="button" class="nb ${answered(id) ? 'done' : ''} ${i === L.cur ? 'cur' : ''} ${L.flag[id] ? 'flag' : ''}" data-act="xgo" data-i="${i}" aria-label="${i + 1}번">${i + 1}</button>`;
    }).join('')}</div></div>`;
    const cnt = (t) => L.ids.filter((id) => BY_ID.get(id).t === t).length;
    const a = cnt('mc'), b = a + cnt('short'), c = b + cnt('essay');
    const unanswered = L.ids.length - nAns;
    const flagged = Object.keys(L.flag).length;
    return `<div class="exam-bar" style="max-width:67rem;margin:0 auto">
        <b>실전 ${esc(L.label)}</b>
        <span class="timer ${left < 300000 ? 'danger' : left < 600000 ? 'warn' : ''}" id="timer" aria-label="남은 시간">${mmss(left)}</span>
        <span class="muted small">답한 문항 ${nAns} / ${L.ids.length}</span>
        <span class="spacer"></span>
        <button class="btn plain navtoggle" data-act="xnav">문항표</button>
        <button class="btn" data-act="xsubmit">제출</button>
      </div>
      <div class="exam-layout" style="margin-top:1rem">
        <aside class="qnav ${X.nav ? 'open' : ''}">
          ${section('mc', 1, a)}${section('short', a + 1, b)}${section('essay', b + 1, c)}
          <div class="legend"><span>■ 회색: 답함</span><span style="color:var(--warn)">● 나중에 보기</span></div>
        </aside>
        <div class="exam-main">
          ${X.confirm ? `<div class="confirm"><b>제출할까요?</b>
            <p>${unanswered ? `안 푼 문항이 <b>${unanswered}개</b> 있습니다. ` : '모든 문항에 답했습니다. '}${flagged ? `나중에 보기로 표시한 문항이 ${flagged}개 있습니다. ` : ''}제출하면 답을 고칠 수 없습니다.</p>
            <div class="row"><button class="btn danger" data-act="xsubmit-yes">제출하기</button><button class="btn plain" data-act="xsubmit-no">계속 풀기</button></div></div>` : ''}
          <article class="card">
            <div class="row"><span class="qnum" style="font-size:1.2rem">${no}.</span><span class="tag">${E.TYPE_NAME[q.t]} · ${E.POINTS[q.t]}점</span>
              <span class="spacer"></span><button class="btn plain" data-act="xflag" aria-pressed="${!!L.flag[q.id]}">${L.flag[q.id] ? '● 나중에 보기 해제' : '○ 나중에 보기'}</button></div>
            <p class="qtext">${esc(q.q)}</p>
            ${q.given ? `<div class="given">${esc(q.given)}</div>` : ''}
            ${body}
          </article>
          <div class="exam-foot">
            <button class="btn plain big" data-act="xprev" ${L.cur === 0 ? 'disabled' : ''}>← 이전</button>
            <button class="btn ghost big" data-act="xnext" ${L.cur === L.ids.length - 1 ? 'disabled' : ''}>다음 →</button>
          </div>
        </div>
      </div>`;
  }

  function startTimer() {
    clearInterval(timer);
    timer = setInterval(tick, 1000);
  }
  function tick() {
    const L = S.live;
    if (!L || L.done) { clearInterval(timer); return; }
    const left = L.deadline - Date.now();
    const el = document.getElementById('timer');
    if (el) {
      el.textContent = mmss(left);
      el.className = 'timer ' + (left < 300000 ? 'danger' : left < 600000 ? 'warn' : '');
    }
    for (const m of [10, 5, 1]) {
      if (left <= m * 60000 && !L.warned[m]) { L.warned[m] = 1; save(); toast(`남은 시간 ${m}분`); }
    }
    if (left <= 0) { submitExam(true); }
  }

  function submitExam(auto) {
    const L = S.live;
    if (!L || L.done) return;
    clearInterval(timer); timer = null;
    const end = Math.min(Date.now(), L.deadline);
    L.done = true;
    const grades = {};
    L.ids.forEach((id) => {
      const q = BY_ID.get(id);
      if (q.t === 'essay') grades[id] = E.rubricHints(q, L.ans[id] || '');
    });
    S.last = { key: L.start, label: L.label, ids: L.ids, ans: L.ans, used: end - L.start, grades, gradedIds: {}, over: {},
      date: new Date(L.start).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) };
    L.ids.forEach((id) => {
      const q = BY_ID.get(id);
      if (q.t !== 'essay') record(id, examOk(q));
    });
    S.live = null;
    syncRecord();
    save();
    X = null;
    if (auto) toast('시간이 끝나 자동으로 제출했습니다.');
    go('eresult');
  }

  function examOk(q) {
    const R = S.last;
    const v = R.ans[q.id];
    if (q.t === 'mc') return v === E.answerPos(BANK, q);
    if (q.t === 'short') return !!R.over[q.id] || E.gradeShort(q, v || '');
    return false;
  }
  function essayScore(q) { const g = S.last.grades[q.id]; return q.rubric.reduce((s, r, i) => s + (g[i] ? r.p : 0), 0); }
  function examScore() {
    const R = S.last;
    let mc = 0, sh = 0, es = 0, pending = 0;
    R.ids.forEach((id) => {
      const q = BY_ID.get(id);
      if (q.t === 'mc') mc += examOk(q) ? E.POINTS.mc : 0;
      else if (q.t === 'short') sh += examOk(q) ? E.POINTS.short : 0;
      else { es += essayScore(q); if (!R.gradedIds[id]) pending++; }
    });
    return { mc, sh, es, total: mc + sh + es, pending };
  }
  function syncRecord() {
    const R = S.last;
    const s = examScore();
    const rec = { key: R.key, label: R.label, score: s.total, max: 100, used: R.used, date: R.date, pending: s.pending };
    const i = S.records.findIndex((r) => r.key === R.key);
    if (i >= 0) S.records[i] = rec; else S.records.push(rec);
    if (S.records.length > 50) S.records = S.records.slice(-50);
  }

  function renderEResult() {
    const R = S.last;
    if (!R) return renderHome();
    const s = examScore();
    const qs = R.ids.map((id) => BY_ID.get(id));
    const byUnit = E.UNITS.map((u) => {
      const l = qs.filter((q) => q.u === u);
      const got = l.reduce((t, q) => t + (q.t === 'essay' ? essayScore(q) : examOk(q) ? E.POINTS[q.t] : 0), 0);
      const max = l.reduce((t, q) => t + E.POINTS[q.t], 0);
      return { u, got, max };
    });
    const essays = qs.filter((q) => q.t === 'essay');
    return `<div class="wrap">
      <header class="home-head"><p class="eyebrow">실전 ${esc(R.label)} · ${esc(R.date)}</p><h1>시험 결과</h1></header>
      <div class="panel">
        <p class="score-big">${s.total}<small> / 100점</small></p>
        ${s.pending ? `<p class="muted" style="margin-top:.4rem">서술형 ${s.pending}문항이 아직 채점 전입니다. 아래에서 채점하면 점수에 반영됩니다(지금은 핵심어 자동 체크 기준).</p>` : ''}
        <div class="kpis" style="margin-top:1rem">
          <div class="kpi"><div class="k">4지선다</div><div class="v">${s.mc} / 40</div></div>
          <div class="kpi"><div class="k">단답형</div><div class="v">${s.sh} / 20</div></div>
          <div class="kpi"><div class="k">서술형</div><div class="v">${s.es} / 40</div></div>
          <div class="kpi"><div class="k">걸린 시간</div><div class="v">${minText(R.used)}</div></div>
        </div>
        <table class="stat-table" style="margin-top:1rem"><tbody>${byUnit.map((x) => `<tr><td>${esc(E.UNIT_NAME[x.u])}</td>
          <td style="width:35%"><div class="bar"><i style="width:${pct(x.got, x.max)}%"></i></div></td><td class="num">${x.got} / ${x.max}</td></tr>`).join('')}</tbody></table>
      </div>

      <section class="field"><h2 style="font-size:1.3rem">서술형 채점</h2>
        ${essays.map((q) => {
          const no = R.ids.indexOf(q.id) + 1;
          const sc = essayScore(q);
          return `<div class="ritem ${sc === 8 ? 'ok' : sc >= 4 ? 'part' : 'bad'}">
            <div class="row"><span class="qnum">${no}.</span>${lvTag(q)}${unitTag(q)}<span class="spacer"></span>
              ${R.gradedIds[q.id] ? '<span class="tag">채점함</span>' : '<span class="tag" style="color:var(--warn)">채점 전</span>'}</div>
            <p class="rq">${esc(q.q)}</p>${q.given ? `<div class="given">${esc(q.given)}</div>` : ''}
            <div class="field"><span class="label">내 답안</span><div class="mine ${(R.ans[q.id] || '').trim() ? '' : 'empty'}">${(R.ans[q.id] || '').trim() ? esc(R.ans[q.id]) : '(쓰지 않음)'}</div></div>
            ${essayGradeBlock(q, R.grades[q.id], 'ex')}
            <p class="src">근거: ${esc(q.src)}</p>
          </div>`;
        }).join('')}
      </section>

      <section class="field"><div class="row"><h2 style="font-size:1.3rem">4지선다 · 단답형 확인</h2><span class="spacer"></span>
        <button class="chip" data-act="xr-filter" aria-pressed="${!!(X && X.onlyWrong)}">틀린 것만</button></div>
        <div class="review">${qs.filter((q) => q.t !== 'essay').filter((q) => !(X && X.onlyWrong) || !examOk(q)).map((q) => reviewItem(q)).join('')}</div>
      </section>
      <div class="row"><button class="btn big" data-act="exam-intro">다른 회차 보기</button><button class="btn plain big" data-act="home">처음으로</button></div>
    </div>`;
  }

  function reviewItem(q) {
    const R = S.last;
    const no = R.ids.indexOf(q.id) + 1;
    const ok = examOk(q);
    const v = R.ans[q.id];
    let mine = '';
    if (q.t === 'mc') mine = v == null ? '(고르지 않음)' : `${NUMS[v]} ${display(q)[v]}`;
    else mine = (v || '').trim() || '(쓰지 않음)';
    return `<div class="ritem ${ok ? 'ok' : 'bad'}">
      <div class="row"><span class="qnum">${no}.</span><span class="mark ${ok ? 'ok' : 'bad'}">${ok ? '맞음' : '틀림'}</span>${lvTag(q)}${unitTag(q)}</div>
      <p class="rq">${esc(q.q)}</p>
      ${q.t === 'mc' ? `<div class="choices">${display(q).map((c, k) => {
        const ans = E.answerPos(BANK, q);
        const cls = k === ans ? 'right' : k === v ? 'wrong' : '';
        return `<button type="button" class="choice ${cls}" disabled><span class="cn">${k + 1}</span><span>${esc(c)}</span></button>`;
      }).join('')}</div>` : `<p><b>내 답</b> ${esc(mine)}</p><p><b>정답</b> ${esc(correctText(q))}${q.a.length > 1 ? ` <span class="muted small">(인정: ${q.a.slice(1).map(esc).join(', ')})</span>` : ''}</p>`}
      <details ${ok ? '' : 'open'}><summary>해설</summary><p>${esc(q.why || '')}</p><p class="src">근거: ${esc(q.src)}</p></details>
      ${q.t === 'short' && !ok && (v || '').trim() ? `<div><button class="btn ghost" data-act="xr-over" data-id="${q.id}">표기만 다릅니다 · 맞은 걸로 할게요</button></div>` : ''}
    </div>`;
  }

  // ===================== 이벤트 =====================
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const act = el.dataset.act;
    if (act === 'rub') return; // 체크박스는 change 에서
    ev.preventDefault();
    switch (act) {
      case 'home': return go('home');
      case 'font-down': if (S.scale > 0) { S.scale--; save(); applyScale(); } return;
      case 'font-up': if (S.scale < SCALES.length - 1) { S.scale++; save(); applyScale(); } return;
      case 'mode': setup = newSetup(el.dataset.mode); return go('setup');
      case 'set-unit': case 'set-type': {
        const key = act === 'set-unit' ? 'units' : 'types';
        const v = el.dataset.val; const l = setup[key];
        if (l.includes(v)) { if (l.length > 1) l.splice(l.indexOf(v), 1); } else l.push(v);
        return render();
      }
      case 'set-lv': setup.lv = el.dataset.val; return render();
      case 'set-order': setup.order = el.dataset.val; return render();
      case 'set-wrong': setup.onlyWrong = !setup.onlyWrong; return render();
      case 'start': {
        let ids = pool(setup).map((q) => q.id);
        if (setup.order === 'shuffle') ids = E.shuffle(ids, Math.random);
        return startPractice(ids, setup.mode === 'B' ? 'B급 문제집' : 'N제');
      }
      case 'pick': P.sel = Number(el.dataset.k); return render();
      case 'check': return checkPractice(false);
      case 'dontknow': {
        const q = curQ();
        if (q.t === 'essay') { P.checks = q.rubric.map(() => false); P.phase = 'grade'; return render(); }
        return checkPractice(true);
      }
      case 'essay-open': { const q = curQ(); P.checks = E.rubricHints(q, P.input); P.phase = 'grade'; return render(); }
      case 'essay-done': {
        const q = curQ();
        const score = q.rubric.reduce((s, r, i) => s + (P.checks[i] ? r.p : 0), 0);
        P.res[q.id] = { score, ok: score === 8 };
        record(q.id, score === 8); save();
        P.phase = 'done'; return render();
      }
      case 'override': {
        const q = curQ(); P.res[q.id] = { ok: true, over: true };
        const s = S.stat[q.id]; if (s) s[1]++; delete S.wrong[q.id]; save();
        return render();
      }
      case 'next':
        if (P.i + 1 < P.ids.length) { P.i++; P.phase = 'answer'; P.sel = null; P.input = ''; P.checks = null; render(); window.scrollTo(0, 0); return; }
        return go('presult');
      case 'quit': return Object.keys(P.res).length ? go('presult') : go('home');
      case 'retry-wrong': {
        const ids = P.ids.filter((id) => { const r = P.res[id]; return r && !(r.ok); });
        return startPractice(ids, P.label + ' · 틀린 문제');
      }
      case 'wrong': return go('wrong');
      case 'wrong-start': return startPractice(BANK.filter((q) => S.wrong[q.id]).map((q) => q.id), '오답노트');
      case 'wrong-remove': delete S.wrong[el.dataset.id]; save(); return render();
      case 'exam-intro': return go('examIntro');
      case 'exam-start': return startExam(el.dataset.round);
      case 'exam-resume':
        X = { nav: false, confirm: false };
        if (S.live.deadline <= Date.now()) return submitExam(true);
        return go('exam');
      case 'exam-abandon':
        if (el.dataset.sure) { S.live = null; save(); return go('home'); }
        el.dataset.sure = '1'; el.textContent = '정말 그만두기(기록 없음)'; el.classList.add('danger'); return;
      case 'xpick': { const q = BY_ID.get(S.live.ids[S.live.cur]); const k = Number(el.dataset.k); S.live.ans[q.id] = S.live.ans[q.id] === k ? null : k; save(); return render(); }
      case 'xgo': S.live.cur = Number(el.dataset.i); X.nav = false; save(); render(); return scrollToQ();
      case 'xprev': if (S.live.cur > 0) { S.live.cur--; save(); render(); scrollToQ(); } return;
      case 'xnext': if (S.live.cur < S.live.ids.length - 1) { S.live.cur++; save(); render(); scrollToQ(); } return;
      case 'xflag': { const id = S.live.ids[S.live.cur]; if (S.live.flag[id]) delete S.live.flag[id]; else S.live.flag[id] = 1; save(); return render(); }
      case 'xnav': X.nav = !X.nav; return render();
      case 'xsubmit': X.confirm = true; render(); return window.scrollTo(0, 0);
      case 'xsubmit-no': X.confirm = false; return render();
      case 'xsubmit-yes': return submitExam(false);
      case 'eresult': X = null; return go('eresult');
      case 'xr-filter': X = X || {}; X.onlyWrong = !X.onlyWrong; return render();
      case 'xr-over': {
        const id = el.dataset.id; S.last.over[id] = 1;
        const s = S.stat[id]; if (s) s[1]++; delete S.wrong[id];
        syncRecord(); save(); return render();
      }
      default:
    }
  });

  function scrollToQ() {
    const card = app.querySelector('.exam-main');
    if (card && card.getBoundingClientRect().top < 0) window.scrollTo(0, 0);
  }

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.act !== 'rub') return;
    const i = Number(el.dataset.i);
    if (el.dataset.scope === 'pr') {
      P.checks[i] = el.checked;
    } else {
      const id = el.dataset.id;
      S.last.grades[id][i] = el.checked;
      S.last.gradedIds[id] = 1;
      const q = BY_ID.get(id);
      const sc = essayScore(q);
      const st = S.stat[id] || [0, 0];
      if (!S.last.counted) S.last.counted = {};
      if (!S.last.counted[id]) { st[0]++; S.last.counted[id] = 1; }
      S.stat[id] = st;
      if (sc === 8) delete S.wrong[id]; else S.wrong[id] = 1;
      syncRecord(); save();
    }
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  });

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.id === 'ans' && P) {
      P.input = el.value;
      const btn = app.querySelector('[data-act="check"]');
      if (btn && curQ().t !== 'mc') btn.disabled = false;
    }
    if (el.id === 'xans' && S.live) {
      const id = S.live.ids[S.live.cur];
      S.live.ans[id] = el.value;
      saveSoon();
      const nAns = S.live.ids.filter(answered).length;
      const span = app.querySelector('.exam-bar .muted');
      if (span) span.textContent = `답한 문항 ${nAns} / ${S.live.ids.length}`;
    }
  });
  let saveT = null;
  function saveSoon() { clearTimeout(saveT); saveT = setTimeout(save, 400); }

  document.addEventListener('keydown', (ev) => {
    if (ev.isComposing || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const tag = (ev.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea';
    if (view === 'practice' && P) {
      const q = curQ();
      if (!typing && q.t === 'mc' && P.phase === 'answer' && /^[1-4]$/.test(ev.key)) { P.sel = Number(ev.key) - 1; render(); return; }
      if (ev.key === 'Enter' && !(typing && tag === 'textarea')) {
        if (P.phase === 'answer' && q.t !== 'essay' && (q.t !== 'mc' || P.sel != null) && (q.t !== 'short' || P.input.trim())) { ev.preventDefault(); checkPractice(false); return; }
        if (P.phase === 'done' && !(ev.target.closest && ev.target.closest('button'))) { ev.preventDefault(); app.querySelector('[data-act="next"]').click(); }
      }
    }
    if (view === 'exam' && S.live && !typing) {
      const q = BY_ID.get(S.live.ids[S.live.cur]);
      if (q.t === 'mc' && /^[1-4]$/.test(ev.key)) { S.live.ans[q.id] = Number(ev.key) - 1; save(); render(); return; }
      if (ev.key === 'ArrowRight') app.querySelector('[data-act="xnext"]').click();
      if (ev.key === 'ArrowLeft') app.querySelector('[data-act="xprev"]').click();
    }
  });

  // ---------- 시작 ----------
  // 오프라인 캐시: 저장소 루트의 sw.js 를 쓴다(https·localhost 에서만)
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
  }
  applyScale();
  if (S.live && !S.live.done && S.live.deadline <= Date.now()) {
    submitExam(true);
  } else {
    render();
  }
})();
