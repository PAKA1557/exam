// 오프라인 캐시. 앱 파일을 설치 시점에 받아 두고, 인터넷이 없어도 문제를 풀 수 있게 한다.
// 앱 파일을 바꾸면 VERSION 을 올려야 휴대폰에 새 버전이 내려간다.
const VERSION = 'v3';
const CACHE = `exam-quiz-${VERSION}`;
const APP_FILES = [
  './',
  'index.html',
  'styles.css',
  'grade.js',
  'app.js',
  'data/finance.js',
  'data/insurance.js',
  'data/writing.js',
  'data/economics.js',
  'econ.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('exam-quiz-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 앱 파일: 네트워크를 먼저 시도해 최신 문제를 받고, 실패하면 캐시로 연다.
// 글꼴(Google Fonts): 한 번 받은 것은 캐시에서 쓴다.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
    );
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      }))
    );
  }
});
