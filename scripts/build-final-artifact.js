// final/ 기말 대비 앱을 Claude 아티팩트용 한 장짜리 HTML로 묶는다: node scripts/build-final-artifact.js
// 아티팩트는 <!doctype>·<head>·<body> 뼈대를 자동으로 씌우고, 외부 스타일시트는 Google Fonts 만 허용한다.
// 그래서 CSS·JS 를 인라인으로 넣고, Pretendard(jsDelivr) 대신 Google Fonts 의 IBM Plex Sans KR 을 쓴다.
// 서비스 워커는 아티팩트에서 동작하지 않으므로 등록 코드를 뺀다.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'final');
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const safe = (js) => js.replace(/<\/script/gi, '<\\/script');

let css = read('style.css')
  .replace("--font: 'Pretendard Variable', Pretendard,", "--font: 'IBM Plex Sans KR', 'Pretendard Variable', Pretendard,");
css += `
/* 아티팩트: 휴대폰 상단 안전 영역을 흰색으로 덮어 스크롤된 내용이 비치지 않게 */
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 30; background: var(--bg); }
.topbar { top: env(safe-area-inset-top, 0px); }
`;

const app = read('app.js').replace(/  \/\/ 오프라인 캐시:[\s\S]*?\n  }\n/, '');
if (app.includes('serviceWorker')) throw new Error('서비스 워커 등록 코드를 빼지 못했습니다');

const body = read('index.html')
  .match(/<body>([\s\S]*?)<script src="questions\.js"><\/script>/)[1]
  .trim();

const out = `<title>기말 대비 문제풀이</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">
<style>
${css}
</style>
${body}
<script>
${safe(read('questions.js'))}
</script>
<script>
${safe(read('engine.js'))}
</script>
<script>
${safe(app)}
</script>
`;

const outDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'final-artifact.html'), out);
console.log(`build/final-artifact.html 작성 (${Math.round(out.length / 1024)}KB)`);
