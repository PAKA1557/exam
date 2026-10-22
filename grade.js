// 채점 로직. 화면 코드와 분리해 두어 node 로도 바로 시험해 볼 수 있다.
(function (root) {
  // 띄어쓰기, 문장부호, 대소문자 차이는 무시한다.
  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[−–—]/g, '-')
      .replace(/[\s.,·・/()\[\]{}'"“”‘’?!~:;]/g, '');
  }

  // q.a: 인정 정답 목록 / q.all: 모두 포함해야 하는 항목 (q.ordered 면 그 순서대로)
  function grade(q, input) {
    const given = normalize(input);
    if (!given) return false;
    if (q.a.some((ans) => normalize(ans) === given)) return true;
    if (Array.isArray(q.all) && q.all.length) {
      if (q.ordered) return inOrder(given, q.all.map((item) => [item]));
      return q.all.every((item) => given.includes(normalize(item)));
    }
    return false;
  }

  // groups: [[대안어...], [대안어...]] — 각 묶음의 단어가 앞 묶음 다음에 나오는지
  function inOrder(normText, groups) {
    let pos = 0;
    for (const group of groups) {
      let best = -1;
      for (const word of group) {
        const i = normText.indexOf(normalize(word), pos);
        if (i !== -1 && (best === -1 || i < best)) best = i;
      }
      if (best === -1) return false;
      pos = best + 1;
    }
    return true;
  }

  // ---------- 서술형 자동 판정 ----------
  // 문장 형태와 핵심어만 보는 참고용 판정이다. 최종 판단은 사용자가 체크박스로 한다.
  function stripEnd(text) {
    return String(text || '').trim().replace(/["'”’」』)\s]+$/, '');
  }
  const SENTENCE_RULES = {
    // 평서문: 물음표가 없고 '~다.'로 끝난다.
    declarative(text) {
      const t = stripEnd(text);
      return t.length > 0 && !/[?？]/.test(t) && /다\.?$/.test(t) && !/(까|니|나요|까요)\.?$/.test(t);
    },
    // 완성된 문장: 주어 조사(은/는/이/가)가 있고 서술어 '~다'로 끝난다.
    complete(text) {
      const t = stripEnd(text);
      return /[가-힣A-Za-z0-9](은|는|이|가)\s/.test(t) && /다\.?$/.test(t);
    },
    // 비유 표현이 없다.
    noFigurative(text) {
      return !/(마치|처럼|[과와]\s*같|같다|같은\s*존재|듯)/.test(String(text || ''));
    },
    // 한 문장이다.
    singleSentence(text) {
      const parts = String(text || '').trim().split(/(?<=[.?!？])\s+|\n+/).filter((s) => s.trim());
      return parts.length === 1;
    },
    // 개요 번호의 위계가 두 단계 이상이다 (1. 아래 2.1. 또는 1) 등).
    numbered(text) {
      const t = String(text || '');
      const top = /^\s*(\d+\.|[ⅠⅡⅢⅣⅤ]+\.)\s/m.test(t);
      const sub = /^\s*(\d+\.\d+|\d+\))/m.test(t);
      return top && sub;
    },
  };

  const RULE_HINT = {
    declarative: '평서문(~다.)으로 끝나고 물음표가 없음',
    complete: '주어(은/는/이/가)와 서술어(~다)가 있음',
    noFigurative: '“마치·처럼·같다” 같은 비유 표현 없음',
    singleSentence: '한 문장',
    numbered: '번호 위계가 두 단계 이상',
  };

  // rule: 'declarative' 같은 이름, 또는 {any:[...]}, {all:[...]}, {order:[[...],[...]]}
  //       {field, equals}: 글이 아니라 그래프에서 고른 값(answer[field])과 비교한다.
  function checkRule(rule, text, answer) {
    if (typeof rule === 'string') return SENTENCE_RULES[rule] ? SENTENCE_RULES[rule](text) : false;
    if (rule.field) return !!answer && answer[rule.field] === rule.equals;
    const n = normalize(text);
    if (rule.any) return rule.any.some((w) => n.includes(normalize(w)));
    if (rule.all) return rule.all.every((w) => n.includes(normalize(w)));
    if (rule.order) return inOrder(n, rule.order);
    return false;
  }

  function isKnownRule(rule) {
    if (typeof rule === 'string') return rule in SENTENCE_RULES;
    return !!rule && (Array.isArray(rule.any) || Array.isArray(rule.all) || Array.isArray(rule.order) || (typeof rule.field === 'string' && 'equals' in rule));
  }

  const api = { normalize, grade, checkRule, isKnownRule, RULE_HINT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QuizGrade = api;
})(this);
