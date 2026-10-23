// 시험 대비 문제풀이 — 화면 흐름과 상태 관리
// 기본 문제는 data/*.js (window.QUIZ_BANK), 직접 추가한 문제와 문항별 학습 기록은 localStorage 에 저장한다.
// 출제·기록 규칙은 adaptive.js 에 있다.
(function () {
  'use strict';

  const BANK = window.QUIZ_BANK;
  const { grade, checkRule } = window.QuizGrade;
  const Adaptive = window.Adaptive;
  const SUBJECTS = ['finance', 'insurance', 'writing', 'economics'];
  const STORE_KEY = 'exam-quiz.v1';
  const TYPE_LABEL = { blank: '빈칸 채우기', short: '단답형', ox: 'O/X', essay: '서술형', shift: '그래프 서술형' };
  const TYPE_SHORT = { blank: '빈칸', short: '단답', ox: 'O/X', essay: '서술', shift: '그래프' };
  const BUILDER_FIELDS = ['d', 's', 'price', 'qty'];
  const LEVEL = { 1: '기억', 2: '이해', 3: '적용' };

  // 경제학 2번(생성 문항)은 섹션 대신 수요·공급 변화 요인별로 집계한다. 문항 id 에 요인이 들어 있다.
  const ECON_FACTOR = {
    taxCut: ['수요 변화 요인', '소득세율 인하'], taxHike: ['수요 변화 요인', '소득세율 인상'],
    inferior: ['수요 변화 요인', '열등재와 소득 증가'], substituteUp: ['수요 변화 요인', '대체재 가격 상승'],
    complementUp: ['수요 변화 요인', '보완재 가격 상승'], complementDown: ['수요 변화 요인', '보완재 가격 하락'],
    tasteUp: ['수요 변화 요인', '기호 변화'], expectD: ['수요 변화 요인', '소비자의 가격 예상'],
    buyersUp: ['수요 변화 요인', '소비자 수 증가'],
    factorUp: ['공급 변화 요인', '요소가격 상승'], factorDown: ['공급 변화 요인', '요소가격 하락'],
    techUp: ['공급 변화 요인', '기술 진보'], sellersUp: ['공급 변화 요인', '생산자 수 증가'],
    expectS: ['공급 변화 요인', '생산자의 가격 예상'],
  };
  const SEP = '\u0001';
  // 문항이 속한 섹션 키 목록: '묶음 SEP 섹션'
  function sectionKeys(q) {
    if (q.sec) return [q.ch + SEP + q.sec];
    const m = /^eco-[sc]-(.+)$/.exec(q.id);
    if (m) return m[1].split('-').filter((f) => ECON_FACTOR[f]).map((f) => ECON_FACTOR[f].join(SEP));
    return [q.ch + SEP + (q.id.includes('-custom-') ? '직접 추가한 문제' : q.ch)];
  }

  const $ = (id) => document.getElementById(id);

  // ---------- 저장소 ----------
  // 저장이 막힌 환경(사생활 보호 모드 등)에서도 메모리 상태로 계속 동작한다.
  function emptyStore() {
    const s = { custom: {}, progress: {} };
    for (const subj of SUBJECTS) { s.custom[subj] = []; s.progress[subj] = {}; }
    return s;
  }
  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return emptyStore();
      const s = JSON.parse(raw);
      const base = emptyStore();
      for (const subj of SUBJECTS) {
        base.custom[subj] = Array.isArray(s.custom?.[subj]) ? s.custom[subj] : [];
        base.progress[subj] = Adaptive.merge({}, s.progress?.[subj]);
        // 이전 버전의 ‘틀린 목록’은 ‘방금 틀림’ 단계로 옮긴다.
        for (const id of Array.isArray(s.wrong?.[subj]) ? s.wrong[subj] : []) {
          if (typeof id === 'string' && !base.progress[subj][id]) base.progress[subj][id] = { st: 1, n: 1, c: 0, t: 0 };
        }
      }
      return base;
    } catch (e) {
      return emptyStore();
    }
  }
  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* 저장 불가: 무시 */ }
  }

  const store = loadStore();

  // ---------- 상태 ----------
  const state = {
    subject: null,
    session: null, // { queue, index, results: [{q, input, correct, outcome, prev, retry}], review }
  };

  function allQuestions(subj) {
    return BANK[subj].questions.concat(store.custom[subj]);
  }
  function chaptersOf(subj) {
    return [...new Set(allQuestions(subj).map((q) => q.ch))];
  }
  function records(subj) {
    return store.progress[subj];
  }
  // 약한 문제(단계 1~2) = 복습할 문제
  function weakQuestions(subj) {
    const recs = records(subj);
    return allQuestions(subj).filter((q) => Adaptive.group(recs[q.id]) === 'weak');
  }
  // 결과를 기록하고, 되돌릴 수 있게 이전 기록을 돌려준다.
  function recordResult(q, outcome) {
    const recs = records(state.subject);
    const prev = recs[q.id];
    recs[q.id] = Adaptive.update(prev, outcome, Date.now());
    saveStore();
    return prev;
  }
  function restoreRecord(q, prev) {
    const recs = records(state.subject);
    if (prev) recs[q.id] = prev;
    else delete recs[q.id];
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- 화면 전환 ----------
  function show(name) {
    for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== 'screen-' + name;
    window.scrollTo(0, 0);
    if (name === 'home') renderHome();
    if (name === 'setup') renderSetup();
    if (name === 'manage') renderManage();
  }

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) show(go.dataset.go);
  });

  // ---------- 시작 화면 ----------
  function renderHome() {
    $('app').removeAttribute('data-subject');
    const grid = $('subject-grid');
    grid.replaceChildren();
    for (const subj of SUBJECTS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'subject-card';
      btn.dataset.subject = subj;
      btn.innerHTML =
        '<span class="name"></span>' +
        '<span class="stats"><span>문제 <b class="n-all"></b></span><span>약한 문제 <b class="n-wrong"></b></span><span>익힘 <b class="n-known"></b></span></span>' +
        '<span class="mastery-slot"></span>' +
        '<span class="go">이 과목 풀기 →</span>';
      const qs = allQuestions(subj);
      const [st] = Adaptive.stats(qs, records(subj), () => 'all');
      btn.querySelector('.name').textContent = BANK[subj].title;
      btn.querySelector('.n-all').textContent = qs.length;
      btn.querySelector('.n-wrong').textContent = st.st[1] + st.st[2];
      btn.querySelector('.n-known').textContent = st.st[5];
      btn.querySelector('.mastery-slot').replaceWith(masteryBar(st));
      btn.addEventListener('click', () => {
        state.subject = subj;
        show('setup');
      });
      grid.appendChild(btn);
    }
  }

  // ---------- 출제 설정 ----------
  function selectedMode() {
    return document.querySelector('input[name="mode"]:checked').value;
  }

  function filteredPool() {
    const subj = state.subject;
    const mode = selectedMode();
    const ch = $('setup-chapter').value;
    const sec = $('setup-section').value;
    return allQuestions(subj).filter(
      (q) => (mode === 'mix' || q.type === mode) && (ch === '' || q.ch === ch) &&
        (sec === '' || sectionKeys(q).includes(sec))
    );
  }

  // 단원을 고르면 그 단원의 섹션만 고를 수 있게 한다. 경제학 요인은 단원과 묶음이 달라 전체 범위에서 고른다.
  function fillSections() {
    const subj = state.subject;
    const ch = $('setup-chapter').value;
    const sel = $('setup-section');
    const prev = sel.value;
    const keys = new Set();
    for (const q of allQuestions(subj)) {
      if (ch !== '' && q.ch !== ch) continue;
      for (const k of sectionKeys(q)) keys.add(k);
    }
    sel.replaceChildren(new Option('전체 섹션', ''));
    for (const k of keys) {
      const [group, name] = k.split(SEP);
      if (group === name) continue;
      sel.appendChild(new Option(ch === '' ? `${name} (${group})` : name, k));
    }
    sel.value = [...sel.options].some((o) => o.value === prev) ? prev : '';
    sel.disabled = sel.options.length <= 1;
  }

  function renderSetup() {
    const subj = state.subject;
    $('app').dataset.subject = subj;
    $('setup-title').textContent = BANK[subj].title;

    const qs = allQuestions(subj);
    const n = (t) => qs.filter((q) => q.type === t).length;
    const parts = Object.keys(TYPE_SHORT).filter((t) => n(t)).map((t) => `${TYPE_SHORT[t]} ${n(t)}`);
    $('setup-meta').textContent =
      `전체 ${qs.length}문제 · ${parts.join(' · ')}` +
      (store.custom[subj].length ? ` · 직접 추가 ${store.custom[subj].length}` : '');

    // 이 과목에 없는 형식은 고를 수 없게 숨긴다.
    for (const label of document.querySelectorAll('#setup-form .seg label[data-type]')) {
      const empty = n(label.dataset.type) === 0;
      label.hidden = empty;
      if (empty && label.querySelector('input').checked) $('mode-mix').checked = true;
    }

    const sel = $('setup-chapter');
    const prev = sel.value;
    sel.replaceChildren(new Option('전체 범위', ''));
    for (const ch of chaptersOf(subj)) sel.appendChild(new Option(ch, ch));
    sel.value = [...sel.options].some((o) => o.value === prev) ? prev : '';
    fillSections();

    updateAvail();
    renderStats();
  }

  function updateAvail() {
    const n = filteredPool().length;
    $('setup-avail').textContent = n ? `조건에 맞는 문제 ${n}개` : '조건에 맞는 문제가 없습니다. 형식이나 범위를 바꿔 보세요.';
    $('btn-start').disabled = n === 0;
    const w = weakQuestions(state.subject).length;
    $('btn-review').disabled = w === 0;
    $('btn-review').textContent = w ? `약한 문제만 풀기 (${w})` : '약한 문제 없음';
    const adaptive = document.querySelector('input[name="strategy"]:checked').value === 'adaptive';
    $('strategy-hint').textContent = adaptive
      ? '약한 문제 60%, 안 푼 문제 25%, 익힌 문제 15% 비율로 고르고, 덜 맞힌 섹션을 더 자주 냅니다.'
      : '조건에 맞는 문제를 기록과 상관없이 무작위로 냅니다.';
  }

  function buildSet(pool) {
    const count = $('setup-count').value === 'all' ? Infinity : Number($('setup-count').value);
    const strategy = document.querySelector('input[name="strategy"]:checked').value;
    if (strategy === 'random') return shuffle(pool).slice(0, count);
    return Adaptive.pick(pool, records(state.subject), count, {
      tagsOf: sectionKeys,
      all: allQuestions(state.subject),
    });
  }

  $('setup-form').addEventListener('change', (e) => {
    if (e.target.id === 'setup-chapter') fillSections();
    updateAvail();
  });
  $('setup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    startSession(buildSet(filteredPool()), false);
  });
  $('btn-review').addEventListener('click', () => {
    startSession(shuffle(weakQuestions(state.subject)), true);
  });

  // ---------- 학습 현황 (섹션·수준별 정답률) ----------
  const pct = (a) => (a == null ? '—' : `${Math.round(a * 100)}%`);

  // 익힘 단계 분포 막대: 안 푼 문제 / 약함(1~2) / 보통(3~4) / 익힘(5)
  function masteryBar(st) {
    const parts = [
      ['new', st.st[0], '안 푼 문제'],
      ['weak', st.st[1] + st.st[2], '약함'],
      ['mid', st.st[3] + st.st[4], '보통'],
      ['known', st.st[5], '익힘'],
    ];
    const wrap = document.createElement('span');
    wrap.className = 'mastery-bar';
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', parts.map(([, n, l]) => `${l} ${n}`).join(', '));
    for (const [cls, n] of parts) {
      if (!n) continue;
      const seg = document.createElement('span');
      seg.className = 'seg-' + cls;
      seg.style.flexGrow = n;
      wrap.appendChild(seg);
    }
    return wrap;
  }

  function accBar(acc) {
    const bar = document.createElement('span');
    bar.className = 'acc-bar';
    const fill = document.createElement('span');
    fill.className = 'acc-fill' + (acc == null ? '' : acc < 0.5 ? ' low' : acc < 0.8 ? ' mid' : ' high');
    fill.style.width = acc == null ? '0' : `${Math.round(acc * 100)}%`;
    bar.appendChild(fill);
    return bar;
  }

  // 섹션 하나만 바로 풀기
  function drillSection(key) {
    $('setup-chapter').value = '';
    fillSections();
    $('setup-section').value = key;
    $('mode-mix').checked = true;
    updateAvail();
    startSession(buildSet(filteredPool()), false);
  }

  function sectionRow(s, showGroup) {
    const [group, name] = s.key.split(SEP);
    const li = document.createElement('li');
    li.className = 'sec-row';
    li.innerHTML = '<div class="sec-head"><span class="sec-name"></span><span class="sec-acc"></span></div><div class="sec-sub"><span class="sec-meta"></span></div>';
    li.querySelector('.sec-name').textContent = showGroup ? `${name} · ${group}` : name;
    li.querySelector('.sec-acc').textContent = pct(s.acc);
    li.querySelector('.sec-sub').prepend(accBar(s.acc));
    li.querySelector('.sec-meta').textContent = `${s.total}문제 중 ${s.seen}문제 풀어 봄 · 약한 문제 ${s.st[1] + s.st[2]}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn ghost sec-go';
    btn.textContent = '풀기';
    btn.setAttribute('aria-label', `${name} 섹션 풀기`);
    btn.addEventListener('click', () => drillSection(s.key));
    li.querySelector('.sec-head').appendChild(btn);
    return li;
  }

  function renderStats() {
    const subj = state.subject;
    const qs = allQuestions(subj);
    const recs = records(subj);
    const [all] = Adaptive.stats(qs, recs, () => 'all');

    const mastery = $('stats-mastery');
    mastery.replaceChildren(masteryBar(all));
    const legend = document.createElement('p');
    legend.className = 'mastery-legend';
    const items = [['new', '안 푼 문제', all.st[0]], ['weak', '약함', all.st[1] + all.st[2]], ['mid', '보통', all.st[3] + all.st[4]], ['known', '익힘', all.st[5]]];
    for (const [cls, label, num] of items) {
      const it = document.createElement('span');
      it.className = 'legend-item';
      it.innerHTML = `<span class="dot seg-${cls}"></span>${label} <b></b>`;
      it.querySelector('b').textContent = num;
      legend.appendChild(it);
    }
    mastery.appendChild(legend);

    // 수준별 정답률 (경제학처럼 수준 표시가 없는 과목은 숨긴다)
    const levels = Adaptive.stats(qs.filter((q) => q.lv), recs, (q) => q.lv).sort((a, b) => a.key - b.key);
    const lv = $('stats-levels');
    lv.replaceChildren();
    lv.hidden = !levels.length;
    for (const s of levels) {
      const d = document.createElement('div');
      d.className = 'stat-chip';
      d.innerHTML = '<span class="chip-label"></span><b></b><span class="chip-sub"></span>';
      d.querySelector('.chip-label').textContent = LEVEL[s.key];
      d.querySelector('b').textContent = pct(s.acc);
      d.querySelector('.chip-sub').textContent = `${s.total}문제`;
      lv.appendChild(d);
    }

    const sections = Adaptive.stats(qs, recs, sectionKeys);
    // 약한 섹션: 3번 이상 풀어 본 섹션 중 정답률 낮은 순 3개
    const weak = sections.filter((s) => s.n >= 3 && s.acc < 0.8).sort((a, b) => a.acc - b.acc).slice(0, 3);
    const wb = $('stats-weak');
    wb.replaceChildren();
    const wt = document.createElement('p');
    wt.className = 'weak-title';
    if (weak.length) {
      wt.textContent = '약한 섹션';
      const ul = document.createElement('ul');
      ul.className = 'sec-list';
      for (const s of weak) ul.appendChild(sectionRow(s, true));
      wb.append(wt, ul);
    } else {
      wt.className = 'hint';
      wt.textContent = all.seen
        ? '아직 정답률이 80% 아래인 섹션이 없어요. 섹션마다 세 번 이상 풀면 약한 섹션을 찾아 드립니다.'
        : '문제를 풀면 섹션별 정답률과 약한 섹션이 여기에 나타납니다.';
      wb.appendChild(wt);
    }

    // 단원(묶음)별 섹션 정답률
    const box = $('stats-sections');
    box.replaceChildren();
    const groups = new Map();
    for (const s of sections) {
      const g = s.key.split(SEP)[0];
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(s);
    }
    for (const [g, list] of groups) {
      const det = document.createElement('details');
      det.className = 'sec-group';
      const sum = document.createElement('summary');
      const gs = list.reduce((a, s) => ({ n: a.n + s.n, c: a.c + s.c }), { n: 0, c: 0 });
      sum.innerHTML = '<span class="g-name"></span><span class="g-acc"></span>';
      sum.querySelector('.g-name').textContent = g;
      sum.querySelector('.g-acc').textContent = pct(gs.n ? gs.c / gs.n : null);
      const ul = document.createElement('ul');
      ul.className = 'sec-list';
      for (const s of list) ul.appendChild(sectionRow(s, false));
      det.append(sum, ul);
      box.appendChild(det);
    }
  }
  $('btn-manage').addEventListener('click', () => show('manage'));

  // ---------- 문제 풀이 ----------
  function startSession(queue, review) {
    if (!queue.length) return;
    state.session = { queue, index: 0, results: [], review };
    show('quiz');
    renderQuestion();
  }

  // 빈칸 문제의 ___ 를 밑줄 칸으로 바꿔 그린다. 정답은 넣지 않는다.
  function renderQuestionText(el, q) {
    el.replaceChildren();
    if (q.type !== 'blank') {
      el.textContent = q.q;
      return;
    }
    const parts = q.q.split(/_{3,}/);
    parts.forEach((part, i) => {
      el.appendChild(document.createTextNode(part));
      if (i < parts.length - 1) {
        const b = document.createElement('span');
        b.className = 'blank';
        b.setAttribute('aria-label', '빈칸');
        el.appendChild(b);
      }
    });
  }

  function renderQuestion() {
    const s = state.session;
    const q = s.queue[s.index];
    $('quiz-progress').textContent = `${s.index + 1} / ${s.queue.length}` + (q._retry ? ' · 다시 풀기' : s.review ? ' · 복습' : '');
    $('quiz-bar').style.width = `${(s.index / s.queue.length) * 100}%`;
    $('quiz-type').textContent = TYPE_LABEL[q.type];
    $('quiz-chapter').textContent = q.sec || q.ch;
    $('quiz-chapter').title = q.ch;
    $('quiz-level').hidden = !q.lv;
    $('quiz-level').textContent = q.lv ? LEVEL[q.lv] : '';
    renderQuestionText($('quiz-question'), q);
    $('quiz-given').hidden = !q.given;
    $('quiz-given').textContent = q.given || '';

    // O/X 는 버튼, 서술형은 여러 줄 칸, 나머지는 한 줄 입력칸으로 답한다.
    const isOx = q.type === 'ox';
    const isShift = q.type === 'shift';
    const isEssay = q.type === 'essay' || isShift;
    $('ox-buttons').hidden = !isOx;
    $('answer-form').hidden = isOx || isEssay;
    $('essay-form').hidden = !isEssay;
    $('builder').hidden = !isShift;
    if (isShift) resetBuilder();
    $('sketch-wrap').hidden = !q.sketch;
    if (q.sketch) sketchReset();
    const input = $('answer-input');
    input.value = '';
    input.disabled = isOx || isEssay;
    input.placeholder = q.type === 'blank' ? '빈칸에 들어갈 말' : '답을 입력하세요';
    const essay = $('essay-input');
    essay.value = '';
    essay.disabled = !isEssay;
    // 개요 문제는 칸을 크게 연다.
    essay.rows = /개요/.test(q.q) && !/요건/.test(q.q) ? 12 : isShift ? 6 : 5;
    essay.placeholder = isShift
      ? '첫째(어느 곡선이 이동하는지), 둘째(이유와 방향), 셋째(균형가격·거래량 변화) 순서로 쓰세요. 비워 두면 그래프만 채점합니다.'
      : '답안을 쓰세요';

    // 이전 문제의 정답이 남아 있지 않도록 비운다.
    $('feedback').hidden = true;
    $('retry-note').hidden = true;
    $('reveal-answer').replaceChildren();
    $('reveal-mine').textContent = '';
    $('reveal-why').textContent = '';
    $('essay-mine').textContent = '';
    $('essay-model').textContent = '';
    $('rubric-list').replaceChildren();
    $('model-graph').replaceChildren();
    if (isShift) $('builder-graph').scrollIntoView({ block: 'nearest' });
    else if (isEssay && !q.sketch) essay.focus();
    else if (!isOx) input.focus();
  }

  function submitAnswer(input) {
    const s = state.session;
    const q = s.queue[s.index];
    const correct = grade(q, input);
    finishAttempt(q, input, correct ? 'right' : 'wrong');
    showFeedback(q, input, correct);
  }

  // 결과를 기록하고, 틀렸으면 같은 세트 뒤쪽에 한 번 더 넣는다(다시 낸 문제는 또 넣지 않는다).
  function finishAttempt(q, input, outcome) {
    const s = state.session;
    const prev = recordResult(q, outcome);
    const res = { q, input, correct: outcome === 'right', outcome, prev, retry: !!q._retry };
    if (outcome !== 'right' && !q._retry) res.requeuedAt = Adaptive.requeue(s.queue, s.index);
    s.results.push(res);
    $('retry-note').hidden = res.requeuedAt == null;
    return res;
  }

  function showFeedback(q, input, correct) {
    $('answer-input').disabled = true;
    $('answer-form').hidden = true;
    $('ox-buttons').hidden = true;
    $('essay-review').hidden = true;
    $('reveal-answer-row').hidden = false;
    $('btn-confirm').hidden = true;
    $('btn-next').hidden = false;

    const fb = $('feedback');
    fb.className = 'feedback ' + (correct ? 'ok' : 'bad');
    $('verdict').textContent = correct ? '맞았어요' : (input.trim() ? '틀렸어요' : '정답을 확인하세요');

    const ans = $('reveal-answer');
    ans.textContent = q.a[0];
    if (q.a.length > 1) {
      const alias = document.createElement('span');
      alias.className = 'alias';
      alias.textContent = ` (${q.a.slice(1).join(', ')}도 정답)`;
      ans.appendChild(alias);
    }
    $('reveal-mine-row').hidden = !input.trim();
    $('reveal-mine').textContent = input;
    $('reveal-why-row').hidden = !q.why;
    $('reveal-why').textContent = q.why || '';
    // 표기만 다른 답을 직접 정답 처리할 수 있게 한다. O/X 는 표기 차이가 없으므로 제외.
    $('btn-override').hidden = correct || !input.trim() || q.type === 'ox';

    fb.hidden = false;
    $('btn-next').textContent = state.session.index + 1 < state.session.queue.length ? '다음 문제' : '결과 보기';
    $('btn-next').focus();
  }

  // ---------- 서술형 ----------
  // 제출하면 모범 답안과 채점 기준을 보여 주고, 사용자가 기준별로 체크해 확정한다.
  // answer: 그래프 서술형에서 고른 값 {d, s, price, qty}. skipped: ‘모범 답안 보기’로 넘어간 경우.
  function showEssayReview(q, input, answer, skipped) {
    state.pending = { input, answer, skipped };
    $('essay-input').disabled = true;
    $('essay-form').hidden = true;
    setBuilderDisabled(true);

    const fb = $('feedback');
    fb.className = 'feedback review';
    $('verdict').textContent = input.trim() ? '모범 답안과 비교해 채점하세요' : '모범 답안을 확인하세요';

    $('essay-mine-block').hidden = !input.trim();
    $('essay-mine').textContent = input;
    $('essay-model').textContent = q.model;
    $('model-graph-block').hidden = !q.graph;
    $('model-graph').innerHTML = q.graph ? window.EconGraph.render(q.graph) : '';

    const list = $('rubric-list');
    list.replaceChildren();
    q.rubric.forEach((r, i) => {
      const li = document.createElement('li');
      const id = `rubric-${i}`;
      li.innerHTML = '<input type="checkbox"><label></label>';
      const box = li.querySelector('input');
      const label = li.querySelector('label');
      box.id = id;
      label.htmlFor = id;
      label.textContent = r.label;
      const isField = !!(r.auto && r.auto.field);
      // 그래프 서술형에서 설명을 비워 두면 서술 기준은 빼고 그래프만 채점한다.
      const excluded = !!r.text && !input.trim();
      if (excluded) {
        li.classList.add('excluded');
        const tag = document.createElement('span');
        tag.className = 'auto';
        tag.textContent = '서술 안 함';
        label.appendChild(tag);
      } else if (r.auto && (input.trim() || isField) && !skipped) {
        const pass = checkRule(r.auto, input, answer);
        box.checked = pass;
        const tag = document.createElement('span');
        tag.className = 'auto ' + (pass ? 'pass' : 'fail');
        tag.textContent = pass ? '자동 ✓' : '자동 ✗';
        label.appendChild(tag);
      }
      // 그래프에서 고른 값은 객관식이라 직접 바꿀 수 없다. 답을 안 썼으면 체크할 것이 없다.
      box.disabled = excluded || isField || skipped || (q.type === 'essay' && !input.trim());
      li.addEventListener('change', updateRubricScore);
      list.appendChild(li);
    });
    updateRubricScore();

    $('reveal-answer-row').hidden = true;
    $('reveal-mine-row').hidden = true;
    $('reveal-why-row').hidden = !q.why;
    $('reveal-why').textContent = q.why || '';
    $('btn-override').hidden = true;
    $('essay-review').hidden = false;
    $('btn-confirm').hidden = false;
    $('btn-confirm').textContent = skipped || (q.type === 'essay' && !input.trim()) ? '틀린 문제로 두고 넘어가기' : '채점 확정';
    $('btn-next').hidden = true;
    fb.hidden = false;
    $('essay-review').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // 채점에 들어가는 기준만 (서술을 비워 빠진 기준 제외)
  function rubricBoxes() {
    return [...$('rubric-list').querySelectorAll('li:not(.excluded) input[type="checkbox"]')];
  }
  function updateRubricScore() {
    const boxes = rubricBoxes();
    const got = boxes.filter((b) => b.checked).length;
    $('rubric-score').textContent = `기준 ${boxes.length}개 중 ${got}개 충족 · 모두 충족해야 맞은 것으로 칩니다.`;
  }

  $('essay-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const s = state.session;
    const q = s.queue[s.index];
    const v = $('essay-input').value;
    if (q.type === 'shift') {
      const answer = builderAnswer();
      if (BUILDER_FIELDS.some((f) => !answer[f])) {
        setBuilderMsg('수요곡선, 공급곡선, 균형가격, 균형거래량을 모두 고르세요.', 'error');
        $('builder').scrollIntoView({ block: 'start', behavior: 'smooth' });
        return;
      }
      showEssayReview(q, v, answer, false);
      return;
    }
    if (!v.trim()) { $('essay-input').focus(); return; }
    showEssayReview(q, v, null, false);
  });
  $('btn-essay-skip').addEventListener('click', () => {
    const s = state.session;
    showEssayReview(s.queue[s.index], '', {}, true);
  });
  $('btn-confirm').addEventListener('click', () => {
    const s = state.session;
    const q = s.queue[s.index];
    const { input, skipped } = state.pending;
    const boxes = rubricBoxes();
    const got = boxes.filter((b) => b.checked).length;
    const answered = q.type === 'shift' ? !skipped : input.trim() !== '';
    const correct = answered && boxes.length > 0 && got === boxes.length;
    const textSkipped = q.type === 'shift' && !skipped && !input.trim();
    // 기준을 모두 충족하면 맞힘, 절반 이상이면 단계 유지, 그 아래는 틀림
    const outcome = correct ? 'right' : answered && boxes.length && got / boxes.length >= 0.5 ? 'partial' : 'wrong';
    finishAttempt(q, input, outcome);

    for (const b of boxes) b.disabled = true;
    $('feedback').className = 'feedback ' + (correct ? 'ok' : 'bad');
    $('verdict').textContent = (correct
      ? `기준을 모두 충족했어요 (${got}/${boxes.length})`
      : answered ? `보완이 필요해요 (${got}/${boxes.length})` : '약한 문제로 표시했어요')
      + (textSkipped ? ' · 서술은 채점하지 않았어요' : '');
    $('btn-confirm').hidden = true;
    $('btn-next').hidden = false;
    $('btn-next').textContent = s.index + 1 < s.queue.length ? '다음 문제' : '결과 보기';
    $('btn-next').focus();
  });

  $('answer-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('answer-input').value;
    if (!v.trim()) { $('answer-input').focus(); return; }
    submitAnswer(v);
  });
  $('btn-skip').addEventListener('click', () => submitAnswer(''));
  for (const b of document.querySelectorAll('.ox-btn')) {
    b.addEventListener('click', () => submitAnswer(b.dataset.ox));
  }
  // O/X 문제를 풀 때만 O·X 키를 받는다. 입력칸이나 다른 화면에서는 반응하지 않는다.
  document.addEventListener('keydown', (e) => {
    if ($('screen-quiz').hidden || $('ox-buttons').hidden) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const k = e.key.toLowerCase();
    if (k === 'o' || k === 'x') {
      e.preventDefault();
      submitAnswer(k.toUpperCase());
    }
  });
  // 표기만 달라 틀린 경우: 기록을 되돌린 뒤 맞힘으로 다시 기록하고, 다시 내려던 문제도 뺀다.
  $('btn-override').addEventListener('click', () => {
    const s = state.session;
    const last = s.results[s.results.length - 1];
    restoreRecord(last.q, last.prev);
    recordResult(last.q, 'right');
    last.correct = true;
    last.outcome = 'right';
    if (last.requeuedAt != null) {
      s.queue.splice(last.requeuedAt, 1);
      delete last.requeuedAt;
    }
    showFeedback(last.q, last.input, true);
    $('retry-note').hidden = true;
  });
  $('btn-next').addEventListener('click', nextQuestion);
  $('btn-quit').addEventListener('click', () => {
    if (state.session.results.length) showResult();
    else show('setup');
  });

  function nextQuestion() {
    const s = state.session;
    s.index += 1;
    if (s.index < s.queue.length) renderQuestion();
    else showResult();
  }

  // ---------- 결과 ----------
  function showResult() {
    const s = state.session;
    // 점수는 처음 푼 결과로 매기고, 다시 낸 문제는 따로 센다.
    const firsts = s.results.filter((r) => !r.retry);
    const retries = s.results.filter((r) => r.retry);
    const total = firsts.length;
    const right = firsts.filter((r) => r.correct).length;
    const missed = firsts.filter((r) => !r.correct);

    show('result');
    $('result-subject').textContent = BANK[state.subject].title + (s.review ? ' · 약한 문제 복습' : '');
    $('result-score').textContent = right;
    $('result-total').textContent = `/ ${total}`;
    const left = weakQuestions(state.subject).length;
    $('result-note').textContent = left ? `약한 문제가 ${left}개 남아 있어요. 다음 세트에 더 자주 나옵니다.` : '약한 문제가 없어요.';

    // 이번 세트에서 익힘 단계가 어떻게 바뀌었는지
    const recs = records(state.subject);
    // 처음 풀 때 맞혀 단계가 오른 문제 / 처음 풀 때 틀려 약한 문제가 된 문제
    let up = 0;
    for (const r of firsts) {
      const before = r.prev ? r.prev.st : 0;
      const after = recs[r.q.id] ? recs[r.q.id].st : 0;
      if (r.correct && after > before) up++;
    }
    const down = missed.length;
    const facts = $('result-facts');
    facts.replaceChildren();
    const fact = (t) => { const li = document.createElement('li'); li.textContent = t; facts.appendChild(li); };
    if (up) fact(`익힘 단계가 오른 문제 ${up}개`);
    if (down) fact(`틀려서 약한 문제로 표시된 문제 ${down}개`);
    if (retries.length) fact(`다시 낸 문제 ${retries.length}개 중 ${retries.filter((r) => r.correct).length}개를 맞혔어요`);

    $('btn-retry-wrong').hidden = missed.length === 0;
    $('result-list-label').hidden = missed.length === 0;
    const list = $('result-list');
    list.replaceChildren();
    for (const r of missed) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="q"></span><span class="a"></span><span class="mine"></span>';
      li.querySelector('.q').textContent = r.q.q.replace(/_{3,}/g, '(   )');
      if (r.q.model) {
        li.querySelector('.a').textContent = '모범 답안: ' + r.q.model.split('\n')[0] + (r.q.model.includes('\n') ? ' …' : '');
        const mine = r.input.trim();
        li.querySelector('.mine').textContent = mine ? '내 답안: ' + (mine.length > 80 ? mine.slice(0, 80) + '…' : mine) : '답안 없음';
      } else {
        li.querySelector('.a').textContent = '정답: ' + r.q.a[0];
        li.querySelector('.mine').textContent = r.input.trim() ? '내 답: ' + r.input : '모르겠어요';
      }
      list.appendChild(li);
    }
    s.missed = missed.map((r) => {
      const { _retry, ...q } = r.q;
      return q;
    });
  }

  $('btn-retry-wrong').addEventListener('click', () => {
    startSession(shuffle(state.session.missed), true);
  });

  // ---------- 그래프 그리기 (그래프 서술형) ----------
  function builderAnswer() {
    const a = {};
    for (const f of BUILDER_FIELDS) {
      const c = document.querySelector(`input[name="b-${f}"]:checked`);
      if (c) a[f] = c.value;
    }
    return a;
  }
  function drawBuilder() {
    const a = builderAnswer();
    $('builder-graph').innerHTML = window.EconGraph.render({ kind: 'shift', mode: 'builder', d: a.d || 'none', s: a.s || 'none' });
  }
  function setBuilderMsg(text, kind) {
    const m = $('builder-msg');
    m.textContent = text;
    m.className = 'form-msg ' + (kind || '');
  }
  function setBuilderDisabled(off) {
    for (const i of $('builder').querySelectorAll('input')) i.disabled = off;
  }
  function resetBuilder() {
    for (const i of $('builder').querySelectorAll('input')) { i.checked = false; i.disabled = false; }
    setBuilderMsg('곡선을 옮겨 보고, 균형가격과 거래량이 어떻게 되는지 고르세요.', '');
    drawBuilder();
  }
  $('builder').addEventListener('change', () => {
    drawBuilder();
    setBuilderMsg('', '');
  });

  // ---------- 손으로 그려 보기 (채점하지 않음) ----------
  // 획은 칸 크기에 대한 비율로 저장해, 화면 크기가 바뀌어도 다시 그릴 수 있게 한다.
  const sketch = { strokes: [], current: null };
  function sketchSize() {
    const c = $('sketch-canvas');
    const w = c.clientWidth;
    if (!w) return false;
    const dpr = window.devicePixelRatio || 1;
    c.style.height = Math.round(w * 0.8) + 'px';
    c.width = Math.round(w * dpr);
    c.height = Math.round(w * 0.8 * dpr);
    return true;
  }
  function sketchDraw() {
    const c = $('sketch-canvas');
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height, u = W / 400;
    const css = getComputedStyle(document.documentElement);
    ctx.clearRect(0, 0, W, H);
    // 축과 P, Q, O 표시
    ctx.strokeStyle = css.getPropertyValue('--muted').trim() || '#888';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    ctx.moveTo(40 * u, 14 * u); ctx.lineTo(40 * u, H - 30 * u); ctx.lineTo(W - 14 * u, H - 30 * u);
    ctx.stroke();
    ctx.font = `italic ${14 * u}px serif`;
    ctx.fillText('P', 22 * u, 24 * u);
    ctx.fillText('Q', W - 22 * u, H - 10 * u);
    ctx.fillText('O', 22 * u, H - 12 * u);
    ctx.strokeStyle = css.getPropertyValue('--fg').trim() || '#000';
    ctx.lineWidth = 2.4 * u;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const st of sketch.strokes.concat(sketch.current ? [sketch.current] : [])) {
      ctx.beginPath();
      st.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
      ctx.stroke();
    }
  }
  function sketchReset() {
    sketch.strokes = [];
    sketch.current = null;
    requestAnimationFrame(() => { if (sketchSize()) sketchDraw(); });
  }
  (function setupSketch() {
    const c = $('sketch-canvas');
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    };
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      sketch.current = [pos(e)];
      sketchDraw();
    });
    c.addEventListener('pointermove', (e) => {
      if (!sketch.current) return;
      sketch.current.push(pos(e));
      sketchDraw();
    });
    const end = () => {
      if (sketch.current && sketch.current.length > 1) sketch.strokes.push(sketch.current);
      sketch.current = null;
      sketchDraw();
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    $('sketch-undo').addEventListener('click', () => { sketch.strokes.pop(); sketchDraw(); });
    $('sketch-clear').addEventListener('click', () => { sketch.strokes = []; sketchDraw(); });
    $('sketch-wrap').addEventListener('toggle', () => { if (sketchSize()) sketchDraw(); });
    window.addEventListener('resize', () => { if (!$('sketch-wrap').hidden && sketchSize()) sketchDraw(); });
  })();

  // ---------- 문제 추가/관리 ----------
  function addType() {
    return document.querySelector('input[name="add-type"]:checked').value;
  }

  function syncAddForm() {
    const type = addType();
    $('add-question-label').textContent = { blank: '문장', short: '질문', ox: '진술', essay: '문제' }[type];
    $('add-question-hint').hidden = type !== 'blank';
    $('add-text-answer').hidden = type === 'ox' || type === 'essay';
    $('add-ox-answer').hidden = type !== 'ox';
    $('add-essay-fields').hidden = type !== 'essay';
    $('add-question').placeholder = {
      blank: '예: 이자·배당소득의 원천징수세율은 ___%다.',
      short: '예: 변동금리 대출의 대표 기준금리는?',
      ox: '예: DTI와 DSR은 높을수록 대출가능액이 커진다.',
      essay: '예: ‘저출산’을 주제 문장으로 고쳐 쓰시오.',
    }[type];
  }

  function renderManage() {
    const subj = state.subject;
    $('app').dataset.subject = subj;
    $('manage-title').textContent = BANK[subj].title + ' · 문제 추가';
    const dl = $('add-chapter-list');
    dl.replaceChildren(...chaptersOf(subj).map((ch) => new Option(ch)));
    syncAddForm();
    renderCustomList();
  }

  function renderCustomList() {
    const subj = state.subject;
    const list = $('custom-list');
    list.replaceChildren();
    const items = store.custom[subj];
    $('custom-label').textContent = `내가 추가한 문제 (${items.length})`;
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = '아직 추가한 문제가 없습니다. 위에서 첫 문제를 추가해 보세요.';
      list.appendChild(li);
      return;
    }
    for (const q of items) {
      const li = document.createElement('li');
      li.innerHTML =
        '<div class="row"><span class="q"></span><button type="button" class="btn ghost">삭제</button></div>' +
        '<span class="sub"></span>';
      li.querySelector('.q').textContent = q.q;
      li.querySelector('.sub').textContent = q.type === 'essay'
        ? `${TYPE_LABEL[q.type]} · ${q.ch} · 채점 기준 ${q.rubric.length}개`
        : `${TYPE_LABEL[q.type]} · ${q.ch} · 정답: ${q.a.join(', ')}`;
      const del = li.querySelector('button');
      del.setAttribute('aria-label', '이 문제 삭제');
      // confirm() 이 막힌 환경이라 두 번 눌러야 지워지게 한다.
      del.addEventListener('click', () => {
        if (del.dataset.armed) {
          store.custom[subj] = store.custom[subj].filter((x) => x.id !== q.id);
          delete store.progress[subj][q.id];
          saveStore();
          renderCustomList();
        } else {
          del.dataset.armed = '1';
          del.textContent = '한 번 더 누르면 삭제';
        }
      });
      list.appendChild(li);
    }
  }

  function setAddMsg(text, kind) {
    const m = $('add-msg');
    m.textContent = text;
    m.className = 'form-msg ' + (kind || '');
  }

  $('add-form').addEventListener('change', (e) => {
    if (e.target.name === 'add-type') syncAddForm();
  });
  $('add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = addType();
    const ch = $('add-chapter').value.trim() || '직접 추가';
    const qText = $('add-question').value.trim();
    const why = $('add-why').value.trim();
    const subj = state.subject;
    const id = `${subj}-custom-${Date.now().toString(36)}`;
    if (!qText) return setAddMsg(`${$('add-question-label').textContent}을 입력하세요.`, 'error');

    let q;
    if (type === 'essay') {
      const model = $('add-model').value.trim();
      const rubric = $('add-rubric').value.split('\n').map((s) => s.trim()).filter(Boolean).map((label) => ({ label }));
      if (!model) return setAddMsg('모범 답안을 입력하세요.', 'error');
      if (!rubric.length) return setAddMsg('채점 기준을 한 줄 이상 입력하세요.', 'error');
      q = { id, ch, type, q: qText, model, rubric };
    } else {
      const answer = type === 'ox'
        ? document.querySelector('input[name="add-ox"]:checked').value
        : $('add-answer').value.trim();
      const aliases = type === 'ox' ? [] : $('add-alias').value.split(',').map((s) => s.trim()).filter(Boolean);
      if (type === 'blank' && !/_{3,}/.test(qText)) return setAddMsg('빈칸 자리에 밑줄 세 개(___)를 넣어 주세요.', 'error');
      if (!answer) return setAddMsg('정답을 입력하세요.', 'error');
      q = { id, ch, type, q: qText, a: [answer, ...aliases] };
    }
    if (why) q.why = why;
    store.custom[subj].push(q);
    saveStore();

    $('add-question').value = '';
    $('add-answer').value = '';
    $('add-alias').value = '';
    $('add-why').value = '';
    $('add-model').value = '';
    $('add-rubric').value = '';
    setAddMsg('추가했어요. 다음 풀이부터 함께 출제됩니다.', 'ok');
    renderManage();
    $('add-question').focus();
  });

  // ---------- 백업과 복원 ----------
  function setBackupMsg(text, kind) {
    const m = $('backup-msg');
    m.textContent = text;
    m.className = 'form-msg ' + (kind || '');
  }

  $('btn-backup-copy').addEventListener('click', () => {
    const box = $('backup-text');
    box.value = JSON.stringify({ app: STORE_KEY, v: 2, ...store });
    const fallback = () => {
      box.select();
      setBackupMsg('복사가 막혀 있어요. 칸의 코드가 선택되어 있으니 직접 복사하세요.', 'error');
    };
    try {
      navigator.clipboard.writeText(box.value)
        .then(() => setBackupMsg('복사했어요. 다른 기기의 이 칸에 붙여넣으세요.', 'ok'), fallback);
    } catch (e) {
      fallback();
    }
  });

  // 덮어쓰지 않고 합친다: 추가 문제는 id 기준, 복습 목록은 합집합.
  $('btn-restore').addEventListener('click', () => {
    let data;
    try {
      data = JSON.parse($('backup-text').value);
    } catch (e) {
      return setBackupMsg('백업 코드를 읽을 수 없어요. 복사한 코드 전체를 붙여넣었는지 확인하세요.', 'error');
    }
    if (!data || data.app !== STORE_KEY) {
      return setBackupMsg('이 앱의 백업 코드가 아니에요.', 'error');
    }
    let added = 0;
    for (const subj of SUBJECTS) {
      const have = new Set(store.custom[subj].map((q) => q.id));
      for (const q of data.custom?.[subj] || []) {
        if (!q || have.has(q.id) || !q.q || !TYPE_LABEL[q.type]) continue;
        const item = { id: q.id, ch: q.ch || '직접 추가', type: q.type, q: q.q };
        if (q.type === 'essay') {
          if (typeof q.model !== 'string' || !Array.isArray(q.rubric) || !q.rubric.length) continue;
          item.model = q.model;
          item.rubric = q.rubric.filter((r) => r && r.label).map((r) => ({ label: String(r.label) }));
        } else {
          if (!Array.isArray(q.a)) continue;
          item.a = q.a.map(String);
        }
        if (typeof q.why === 'string' && q.why) item.why = q.why;
        store.custom[subj].push(item);
        added++;
      }
      // 학습 기록은 문항마다 더 최근에 푼 쪽을 쓴다. 이전 버전 백업의 ‘틀린 목록’도 받는다.
      store.progress[subj] = Adaptive.merge(store.progress[subj], data.progress?.[subj]);
      for (const id of data.wrong?.[subj] || []) {
        if (typeof id === 'string' && !store.progress[subj][id]) store.progress[subj][id] = { st: 1, n: 1, c: 0, t: 0 };
      }
    }
    saveStore();
    renderCustomList();
    setBackupMsg(`복원했어요. 추가 문제 ${added}개를 가져왔고 학습 기록을 합쳤습니다.`, 'ok');
  });

  show('home');
})();
