// 시험 대비 문제풀이 — 화면 흐름과 상태 관리
// 기본 문제는 data/*.js (window.QUIZ_BANK), 직접 추가한 문제와 오답 목록은 localStorage 에 저장한다.
(function () {
  'use strict';

  const BANK = window.QUIZ_BANK;
  const { grade, checkRule } = window.QuizGrade;
  const SUBJECTS = ['finance', 'insurance', 'writing', 'economics'];
  const STORE_KEY = 'exam-quiz.v1';
  const TYPE_LABEL = { blank: '빈칸 채우기', short: '단답형', ox: 'O/X', essay: '서술형', shift: '그래프 서술형' };
  const TYPE_SHORT = { blank: '빈칸', short: '단답', ox: 'O/X', essay: '서술', shift: '그래프' };
  const BUILDER_FIELDS = ['d', 's', 'price', 'qty'];

  const $ = (id) => document.getElementById(id);

  // ---------- 저장소 ----------
  // 저장이 막힌 환경(사생활 보호 모드 등)에서도 메모리 상태로 계속 동작한다.
  function emptyStore() {
    const s = { custom: {}, wrong: {} };
    for (const subj of SUBJECTS) { s.custom[subj] = []; s.wrong[subj] = []; }
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
        base.wrong[subj] = Array.isArray(s.wrong?.[subj]) ? s.wrong[subj] : [];
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
    session: null, // { queue, index, results: [{q, input, correct}], review }
  };

  function allQuestions(subj) {
    return BANK[subj].questions.concat(store.custom[subj]);
  }
  function chaptersOf(subj) {
    return [...new Set(allQuestions(subj).map((q) => q.ch))];
  }
  function wrongQuestions(subj) {
    const ids = new Set(store.wrong[subj]);
    return allQuestions(subj).filter((q) => ids.has(q.id));
  }
  function markWrong(subj, id, isWrong) {
    const list = store.wrong[subj];
    const at = list.indexOf(id);
    if (isWrong && at === -1) list.push(id);
    if (!isWrong && at !== -1) list.splice(at, 1);
    saveStore();
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
        '<span class="stats"><span>문제 <b class="n-all"></b></span><span>복습할 문제 <b class="n-wrong"></b></span></span>' +
        '<span class="go">이 과목 풀기 →</span>';
      btn.querySelector('.name').textContent = BANK[subj].title;
      btn.querySelector('.n-all').textContent = allQuestions(subj).length;
      btn.querySelector('.n-wrong').textContent = store.wrong[subj].length;
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
    return allQuestions(subj).filter(
      (q) => (mode === 'mix' || q.type === mode) && (ch === '' || q.ch === ch)
    );
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

    updateAvail();
  }

  function updateAvail() {
    const n = filteredPool().length;
    $('setup-avail').textContent = n ? `조건에 맞는 문제 ${n}개` : '조건에 맞는 문제가 없습니다. 형식이나 범위를 바꿔 보세요.';
    $('btn-start').disabled = n === 0;
    const w = store.wrong[state.subject].length;
    $('btn-review').disabled = w === 0;
    $('btn-review').textContent = w ? `틀린 문제만 풀기 (${w})` : '틀린 문제 없음';
  }

  $('setup-form').addEventListener('change', updateAvail);
  $('setup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const pool = shuffle(filteredPool());
    const count = $('setup-count').value;
    startSession(count === 'all' ? pool : pool.slice(0, Number(count)), false);
  });
  $('btn-review').addEventListener('click', () => {
    startSession(shuffle(wrongQuestions(state.subject)), true);
  });
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
    $('quiz-progress').textContent = `${s.index + 1} / ${s.queue.length}` + (s.review ? ' · 복습' : '');
    $('quiz-bar').style.width = `${(s.index / s.queue.length) * 100}%`;
    $('quiz-type').textContent = TYPE_LABEL[q.type];
    $('quiz-chapter').textContent = q.ch;
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
    s.results.push({ q, input, correct });
    markWrong(state.subject, q.id, !correct);
    showFeedback(q, input, correct);
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
    s.results.push({ q, input, correct });
    markWrong(state.subject, q.id, !correct);

    for (const b of boxes) b.disabled = true;
    $('feedback').className = 'feedback ' + (correct ? 'ok' : 'bad');
    $('verdict').textContent = (correct
      ? `기준을 모두 충족했어요 (${got}/${boxes.length})`
      : answered ? `보완이 필요해요 (${got}/${boxes.length}) · 복습 목록에 넣었어요` : '복습 목록에 넣었어요')
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
  $('btn-override').addEventListener('click', () => {
    const s = state.session;
    const last = s.results[s.results.length - 1];
    last.correct = true;
    markWrong(state.subject, last.q.id, false);
    showFeedback(last.q, last.input, true);
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
    const total = s.results.length;
    const right = s.results.filter((r) => r.correct).length;
    const missed = s.results.filter((r) => !r.correct);

    show('result');
    $('result-subject').textContent = BANK[state.subject].title + (s.review ? ' · 오답 복습' : '');
    $('result-score').textContent = right;
    $('result-total').textContent = `/ ${total}`;
    const left = store.wrong[state.subject].length;
    $('result-note').textContent = left ? `복습할 문제가 ${left}개 남아 있어요.` : '복습할 문제가 없어요.';

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
    s.missed = missed.map((r) => r.q);
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
          markWrong(subj, q.id, false);
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
    box.value = JSON.stringify({ app: STORE_KEY, ...store });
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
      for (const id of data.wrong?.[subj] || []) {
        if (typeof id === 'string' && !store.wrong[subj].includes(id)) store.wrong[subj].push(id);
      }
    }
    saveStore();
    renderCustomList();
    setBackupMsg(`복원했어요. 추가 문제 ${added}개를 가져왔고 복습 목록을 합쳤습니다.`, 'ok');
  });

  show('home');
})();
