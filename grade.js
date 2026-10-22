// 채점 로직. 화면 코드와 분리해 두어 node 로도 바로 시험해 볼 수 있다.
(function (root) {
  // 띄어쓰기, 문장부호, 대소문자 차이는 무시한다.
  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[−–—]/g, '-')
      .replace(/[\s.,·・/()\[\]{}'"“”‘’?!~:;]/g, '');
  }

  // q.a: 인정 정답 목록 / q.all: 순서 무관하게 모두 포함해야 하는 항목
  function grade(q, input) {
    const given = normalize(input);
    if (!given) return false;
    if (q.a.some((ans) => normalize(ans) === given)) return true;
    if (Array.isArray(q.all) && q.all.length) {
      return q.all.every((item) => given.includes(normalize(item)));
    }
    return false;
  }

  const api = { normalize, grade };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QuizGrade = api;
})(this);
