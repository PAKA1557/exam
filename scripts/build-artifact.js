// index.html 에서 Claude 아티팩트용 페이지를 만든다: node scripts/build-artifact.js
// 아티팩트는 게시할 때 <!doctype>·<head>·<body> 뼈대를 자동으로 씌우므로 그 부분을 걷어내고,
// 홈 화면 설치·오프라인 전용 블록(<!-- standalone:start --> ~ end)도 뺀다.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const out = src
  .replace(/<!-- standalone:start[\s\S]*?<!-- standalone:end -->\n?/g, '')
  .replace(/<!doctype html>\n?/i, '')
  .replace(/<\/?html[^>]*>\n?/gi, '')
  .replace(/<\/?head>\n?/gi, '')
  .replace(/<\/?body>\n?/gi, '')
  .replace(/<meta charset="utf-8">\n?/i, '')
  .replace(/<meta name="viewport"[^>]*>\n?/i, '')
  .trimStart();

const dir = path.join(root, 'build');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'artifact.html'), out);
console.log('build/artifact.html 작성');
