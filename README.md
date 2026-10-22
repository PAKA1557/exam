# 시험 대비 문제풀이

금융경영의 이해·보험의 이해 중간고사 대비용 빈칸 채우기/단답형 문제풀이 앱입니다.

- 실행: `index.html`을 브라우저로 열면 됩니다. 빌드 과정은 없습니다.
- 점검: `node tests/check.js` (데이터 형식, 대표 정답 채점, 채점 규칙)
- 설계와 데이터 형식: [DESIGN.md](DESIGN.md)

`index.html`은 Claude 아티팩트 형식이라 `<!doctype>`과 `<head>`가 없습니다. 게시할 때 그 부분이 자동으로 붙습니다. 파일을 직접 열어도 동작합니다.

## 문제 추가
- 앱 안: 과목 화면 → "문제 직접 추가하기"
- 파일: `data/finance.js`, `data/insurance.js`에 같은 형식으로 추가한 뒤 `node tests/check.js` 실행
