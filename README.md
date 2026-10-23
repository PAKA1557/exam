# 시험 대비 문제풀이

금융경영의 이해·보험의 이해·AI시대의 사고와 표현·경제학입문 시험 대비용 문제풀이 앱입니다. 빈칸 채우기·단답형·O/X·서술형(채점 기준표로 자가 채점)·그래프 서술형(수요·공급 곡선 이동)을 지원하고, 휴대폰에서도 쓸 수 있습니다.

- 실행: `index.html`을 브라우저로 열면 됩니다. 빌드 과정은 없습니다.
- 점검: `node tests/check.js` (데이터 형식, 대표 정답 채점, 채점 규칙, 적응형 출제 시뮬레이션)
- 약한 문제가 더 자주 나오고(적응형), 섹션별·수준별 정답률을 과목 화면에서 볼 수 있습니다.
- 설계와 데이터 형식: [DESIGN.md](DESIGN.md)

## 휴대폰에서 쓰기
웹 주소로 올리면 휴대폰 브라우저에서 열리고, 홈 화면에 추가하면 앱처럼 전체 화면으로 열립니다. 한 번 열어 두면 인터넷 없이도 풀 수 있습니다.

GitHub Pages로 올리는 법:
1. 저장소 **Settings → Pages**에서 Source를 **Deploy from a branch**, 브랜치 `main`, 폴더 `/ (root)`로 저장합니다.
   - 비공개 저장소는 GitHub Pro 이상에서만 Pages를 쓸 수 있습니다. 무료 계정이면 저장소를 공개(public)로 바꿔야 합니다.
2. 1~2분 뒤 `https://paka1557.github.io/exam/` 이 열립니다.
3. 휴대폰에서 그 주소를 열고 홈 화면에 추가합니다.
   - 아이폰(Safari): 공유 버튼 → **홈 화면에 추가**
   - 안드로이드(Chrome): 메뉴 ⋮ → **홈 화면에 추가** 또는 **앱 설치**

앱 파일을 고친 뒤에는 `sw.js`의 `VERSION`을 올려야 설치된 앱에도 새 버전이 내려갑니다.

## Claude 아티팩트로 게시
아티팩트는 `<!doctype>`·`<head>` 뼈대를 자동으로 씌우므로, `node scripts/build-artifact.js`로 `build/artifact.html`을 만들어 그 파일을 게시합니다.

## 문제 추가
- 앱 안: 과목 화면 → "문제 직접 추가하기"
- 파일: `data/finance.js`, `data/insurance.js`, `data/writing.js`, `data/economics.js`에 같은 형식으로 추가한 뒤 `node tests/check.js` 실행
