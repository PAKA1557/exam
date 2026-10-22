// 시험 대비 문제풀이 — 화면 흐름과 상태 관리
// 기본 문제는 data/*.js (window.QUIZ_BANK), 직접 추가한 문제와 오답 목록은 localStorage 에 저장한다.
(function () {
  'use strict';

  const BANK = window.QUIZ_BANK;
  const { grade } = window.QuizGrade;
  const SUBJECTS = ['finance', 'insurance'];
  const STORE_KEY = 'exam-quiz.v1';
  const TYPE_LABEL = { blank: '빈칸 채우기', short: '단답형', ox: 'O/X' };

  const $ = (id) => document.getElementById(id);

  // ---------- 저장소 ----------
  // 저장이 막힌 환경(사생활 보호 모드 등)에서도 메모리 상태로 계속 동작한다.
  function emptyStore() {
    return { custom: { finance: [], insurance: [] }, wrong: { finance: [], insurance: [] } };
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
    $('setup-meta').textContent =
      `전체 ${qs.length}문제 · 빈칸 ${n('blank')} · 단답 ${n('short')} · O/X ${n('ox')}` +
      (store.custom[subj].length ? ` · 직접 추가 ${store.custom[subj].length}` : '');

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

    // O/X 는 버튼으로, 나머지는 입력칸으로 답한다.
    const isOx = q.type === 'ox';
    $('ox-buttons').hidden = !isOx;
    $('answer-form').hidden = isOx;
    const input = $('answer-input');
    input.value = '';
    input.disabled = isOx;
    input.placeholder = q.type === 'blank' ? '빈칸에 들어갈 말' : '답을 입력하세요';

    // 이전 문제의 정답이 남아 있지 않도록 비운다.
    $('feedback').hidden = true;
    $('reveal-answer').replaceChildren();
    $('reveal-mine').textContent = '';
    $('reveal-why').textContent = '';
    if (!isOx) input.focus();
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
      li.querySelector('.a').textContent = '정답: ' + r.q.a[0];
      li.querySelector('.mine').textContent = r.input.trim() ? '내 답: ' + r.input : '모르겠어요';
      list.appendChild(li);
    }
    s.missed = missed.map((r) => r.q);
  }

  $('btn-retry-wrong').addEventListener('click', () => {
    startSession(shuffle(state.session.missed), true);
  });

  // ---------- 문제 추가/관리 ----------
  function addType() {
    return document.querySelector('input[name="add-type"]:checked').value;
  }

  function syncAddForm() {
    const type = addType();
    $('add-question-label').textContent = type === 'short' ? '질문' : type === 'ox' ? '진술' : '문장';
    $('add-question-hint').hidden = type !== 'blank';
    $('add-text-answer').hidden = type === 'ox';
    $('add-ox-answer').hidden = type !== 'ox';
    $('add-question').placeholder = {
      blank: '예: 이자·배당소득의 원천징수세율은 ___%다.',
      short: '예: 변동금리 대출의 대표 기준금리는?',
      ox: '예: DTI와 DSR은 높을수록 대출가능액이 커진다.',
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
      li.querySelector('.sub').textContent = `${TYPE_LABEL[q.type]} · ${q.ch} · 정답: ${q.a.join(', ')}`;
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
    const answer = type === 'ox'
      ? document.querySelector('input[name="add-ox"]:checked').value
      : $('add-answer').value.trim();
    const aliases = type === 'ox' ? [] : $('add-alias').value.split(',').map((s) => s.trim()).filter(Boolean);

    if (!qText) return setAddMsg(`${$('add-question-label').textContent}을 입력하세요.`, 'error');
    if (type === 'blank' && !/_{3,}/.test(qText)) return setAddMsg('빈칸 자리에 밑줄 세 개(___)를 넣어 주세요.', 'error');
    if (!answer) return setAddMsg('정답을 입력하세요.', 'error');

    const subj = state.subject;
    const q = { id: `${subj}-custom-${Date.now().toString(36)}`, ch, type, q: qText, a: [answer, ...aliases] };
    if (why) q.why = why;
    store.custom[subj].push(q);
    saveStore();

    $('add-question').value = '';
    $('add-answer').value = '';
    $('add-alias').value = '';
    $('add-why').value = '';
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
        if (!q || have.has(q.id) || !q.q || !Array.isArray(q.a) || !TYPE_LABEL[q.type]) continue;
        const item = { id: q.id, ch: q.ch || '직접 추가', type: q.type, q: q.q, a: q.a.map(String) };
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
