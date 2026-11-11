let session;
try { session = JSON.parse(localStorage.getItem('zc-session-v2')); } catch {}
let state, busy = false, posting = false, lastKey = '', receivedAt = 0, boundary = '';
const app = document.querySelector('#app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function api(action, data) {
  const response = await fetch('/api/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const value = await response.json();
  if (!response.ok || (value.error && !value.expired)) throw Error(value.error || 'Ulanishda xato');
  return value;
}
function error(e) { document.querySelector('#error').textContent = e?.message || ''; }
function save(value) { session = value; localStorage.setItem('zc-session-v2', JSON.stringify(value)); lastKey = ''; }

function home() {
  app.innerHTML = '<div class="eyebrow">LEARN IT. PLAY IT. REMEMBER IT.</div><h1>If you play,<br><span style="color:#27815f">you learn.</span></h1><p>Har kim o‘z tezligida ishlaydi. Boshqalarni kutmaysiz.<br>12 ta savol · har savolga 15 soniya · umumiy ballar jadvali.</p><div class="grid"><section class="card"><h2>O‘yinga qo‘shilish</h2><form id="join"><label for="code">XONA KODI</label><input id="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="6 xonali kod" required><label for="name">TAXALLUSINGIZ</label><input id="name" maxlength="24" placeholder="Masalan: Student 07" required><button class="wide">Qo‘shilish →</button></form></section><section class="card dark"><div class="eyebrow" style="color:#d9f07a">O‘QITUVCHI UCHUN</div><h2>Bitta sinf.<br>Alohida tezlik.</h2><p>Xona oching va o‘quvchilar kirgach o‘yinni boshlang. Keyin savollar har bir o‘quvchida avtomatik o‘tadi. Siz barcha ballarni kuzatasiz.</p><button id="create" class="wide">Yangi xona ochish +</button><p class="small">Taxalluslardan foydalaning. Xona 24 soat amal qiladi.</p></section></div><div class="notice"><b>Qoidalar:</b> to‘g‘ri javob — 100 ball; xato yoki vaqt tugashi — 0 ball. Javobdan so‘ng to‘g‘ri variant 2 soniya ko‘rinadi va keyingi savol ochiladi.</div>';
  document.querySelector('#code').value = new URLSearchParams(location.search).get('room') || '';
  document.querySelector('#join').onsubmit = async event => {
    event.preventDefault(); if (posting) return; posting = true;
    try { error(); save(await api('join', { code: document.querySelector('#code').value, name: document.querySelector('#name').value })); await poll(); }
    catch (e) { error(e); } finally { posting = false; }
  };
  document.querySelector('#create').onclick = async event => {
    event.target.disabled = true;
    try { error(); save(await api('create', {})); await poll(); }
    catch (e) { error(e); event.target.disabled = false; }
  };
}

function board() {
  return '<section class="card" style="margin-top:20px"><div class="stats"><h2>Umumiy ballar</h2><span class="pill">' + state.finishedCount + ' / ' + state.count + ' yakunladi</span></div><div class="table-wrap"><table><thead><tr><th>O‘quvchi</th><th>Holat</th><th>To‘g‘ri</th><th>Xato</th><th>Vaqt tugadi</th><th>Ball</th></tr></thead><tbody>' + state.scores.map((p, i) => '<tr class="' + (p.me ? 'me' : '') + '"><td>' + (i + 1) + '. ' + esc(p.name) + (p.me ? ' (siz)' : '') + '</td><td>' + (p.phase === 'finished' ? 'Yakunladi ✓' : p.phase === 'lobby' ? 'Tayyor' : (Math.min(p.index + 1, state.total) + '-savol · ' + p.completed + '/' + state.total)) + '</td><td>' + p.correct + '</td><td>' + p.wrong + '</td><td>' + p.missed + '</td><td><b>' + p.score + '</b></td></tr>').join('') + '</tbody></table></div></section>';
}

function render() {
  if (!session || !state) return;
  const s = state, host = !!session.secret;
  let out = '<div class="stats"><span class="eyebrow">' + (host ? 'O‘QITUVCHI PANELI' : 'SHAXSIY VIKTORINA') + '</span><button id="leave" class="secondary small">Bosh sahifa</button></div>';
  if (s.phase === 'lobby') {
    out += '<div class="grid"><section class="card dark"><span class="pill">XONA KODI</span><div class="code">' + s.code + '</div><p>Havolani guruhga yuboring. O‘quvchilar taxallus bilan kiradi.</p><button id="copy">Taklif havolasini nusxalash</button></section><section class="card"><span class="eyebrow">KUTISH XONASI</span><div class="wait">' + s.count + ' <small style="font-size:20px">/ 27</small></div><p>' + (host ? 'Hamma kirgach bir marta boshlang. Qolgan jarayon avtomatik.' : 'Siz kirdingiz! O‘qituvchi boshlashini kuting.') + '</p>' + (host ? '<button id="start" class="wide" ' + (!s.count ? 'disabled' : '') + '>O‘yinni boshlash →</button>' : '') + '</section></div>' + board();
  } else if (host && s.roomPhase === 'running') {
    out += '<section class="card" style="margin-top:24px"><span class="eyebrow">O‘YIN DAVOM ETMOQDA</span><h2>Har kim o‘z tezligida.</h2><p>O‘quvchi javobni belgilagach to‘g‘ri javob 2 soniya ko‘rinadi va keyingi savol ochiladi. Javob bermasa, 15 soniyadan so‘ng 0 ball yoziladi. Savollarni qo‘lda o‘tkazish shart emas.</p></section>' + board();
  } else if (s.phase === 'finished') {
    const complete = s.roomPhase === 'finished';
    const best = s.scores[0]?.score;
    const me = s.scores.find(p => p.me);
    out += '<section class="card" style="margin-top:24px"><div class="eyebrow">WELL PLAYED!</div><h1>' + (complete ? 'O‘yin yakunlandi.' : 'Siz yakunladingiz!') + '</h1>' + (!host && me ? '<h2>' + me.score + ' / 1200 ball</h2>' : '') + '<p>' + (complete ? 'G‘oliblar: <b>' + s.scores.filter(p => p.score === best).map(p => esc(p.name)).join(', ') + '</b>' : 'Qolgan o‘quvchilar davom etmoqda. Umumiy ballar avtomatik yangilanadi. Yakuniy g‘oliblar hamma tugatgach aniqlanadi.') + '</p><div class="notice">If + Present Simple, Present Simple.<br>Faktlar, tabiat qonunlari va odatlar uchun.</div></section>' + board();
  } else {
    const q = s.question, reveal = s.phase === 'reveal';
    const feedback = s.mine === -1 ? 'Vaqt tugadi — 0 ball.' : s.mine === q.correct ? 'To‘g‘ri! +100 ball.' : 'Xato javob — 0 ball.';
    out += '<progress value="' + (s.index + 1) + '" max="' + s.total + '"></progress><div class="stats"><b>SAVOL ' + (s.index + 1) + ' / ' + s.total + '</b><span id="timer" class="timer" aria-live="off"></span><span>' + (s.scores.find(p => p.me)?.score || 0) + ' ball</span></div><section class="card" style="margin-top:18px"><h2>' + esc(q.text) + '</h2><div class="options">' + q.options.map((option, i) => '<button class="option ' + (s.mine === i ? 'selected ' : '') + (reveal ? q.correct === i ? 'correct' : s.mine === i ? 'wrong' : '' : '') + '" data-choice="' + i + '" ' + (reveal || posting || s.remaining === 0 ? 'disabled' : '') + '><span class="badge">' + String.fromCharCode(65 + i) + '</span>' + esc(option) + '</button>').join('') + '</div>' + (reveal ? '<div class="notice" role="status"><b>' + feedback + '</b><br>To‘g‘ri javob: ' + String.fromCharCode(65 + q.correct) + ' — ' + esc(q.options[q.correct]) + '<br>' + esc(q.explanation) + '<br><span id="next-timer">Keyingi savol avtomatik ochiladi.</span></div>' : '<p class="muted">Javobni tanlang. Boshqa o‘quvchilarni kutmaysiz. Vaqt tugasa — 0 ball.</p>') + '</section>';
  }
  app.innerHTML = out;
  document.querySelector('#leave').onclick = () => {
    if (!confirm('Bosh sahifaga qaytasizmi? Davom etayotgan o‘yin vaqti to‘xtamaydi.')) return;
    session = null; state = null; localStorage.removeItem('zc-session-v2'); error(); home();
  };
  const copy = document.querySelector('#copy');
  if (copy) copy.onclick = async () => { const link = location.origin + '/?room=' + s.code; try { await navigator.clipboard.writeText(link); copy.textContent = 'Nusxalandi ✓'; } catch { prompt('Havolani nusxalang:', link); } };
  const start = document.querySelector('#start');
  if (start) start.onclick = async () => { if (posting) return; posting = true; start.disabled = true; try { await api('control', { ...session, move: 'start' }); await poll(); } catch (e) { error(e); start.disabled = false; } finally { posting = false; } };
  document.querySelectorAll('[data-choice]').forEach(button => button.onclick = async () => {
    if (posting || currentTime() >= s.deadline) { tick(); return; }
    posting = true; document.querySelectorAll('[data-choice]').forEach(b => b.disabled = true);
    try { error(); await api('answer', { ...session, question: s.index, choice: Number(button.dataset.choice) }); }
    catch (e) { error(e); }
    finally { posting = false; lastKey = ''; await poll(); }
  });
  tick();
}

function currentTime() { return state ? state.serverNow + (performance.now() - receivedAt) : 0; }
async function poll() {
  if (!session || busy) return;
  busy = true;
  const requestedSession = session;
  try {
    const value = await api('state', requestedSession);
    if (session !== requestedSession) return;
    state = value; receivedAt = performance.now(); error();
    const key = JSON.stringify({ ...value, remaining: undefined, serverNow: undefined });
    if (key !== lastKey) { lastKey = key; render(); }
    tick();
  } catch (e) { error(e); } finally { busy = false; }
}
function tick() {
  if (!state || !session) return;
  const timer = document.querySelector('#timer');
  if (!timer) return;
  const reveal = state.phase === 'reveal';
  const end = reveal ? state.revealUntil : state.deadline;
  const seconds = Math.max(0, Math.ceil((end - currentTime()) / 1000));
  timer.textContent = reveal ? 'Natija' : seconds + ' s';
  const next = document.querySelector('#next-timer');
  if (next) next.textContent = (state.index === state.total - 1 ? 'Shaxsiy natija' : 'Keyingi savol') + ' ' + seconds + ' soniyadan keyin ochiladi.';
  if (!seconds) {
    document.querySelectorAll('[data-choice]').forEach(b => b.disabled = true);
    const key = state.index + ':' + state.phase;
    if (boundary !== key) { boundary = key; poll(); }
  }
}
home(); if (session) poll();
setInterval(poll, 1000);
setInterval(tick, 100);
