import { randomInt, randomUUID } from 'node:crypto';
import { questions } from './questions.mjs';

export const QUESTION_MS = 15000;
export const REVEAL_MS = 2000;
const reply = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const reject = message => { throw new Error(message); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Each student owns a question and deadline. Server deadlines survive reloads.
function advance(room, now) {
  if (room.phase !== 'running') return false;
  let changed = false;
  for (const player of room.players) {
    for (let i = 0; i < questions.length * 2; i++) {
      if (player.phase === 'question' && now >= player.deadline) {
        player.answers[player.question] = -1;
        player.phase = 'reveal';
        player.revealUntil = player.deadline + REVEAL_MS;
        changed = true;
      } else if (player.phase === 'reveal' && now >= player.revealUntil) {
        player.question++;
        player.phase = player.question >= questions.length ? 'finished' : 'question';
        player.deadline = player.revealUntil + QUESTION_MS;
        player.revealUntil = 0;
        changed = true;
      } else break;
    }
  }
  if (room.players.length && room.players.every(p => p.phase === 'finished')) {
    room.phase = 'finished';
    changed = true;
  }
  return changed;
}

// ETag comparison prevents concurrent phones from overwriting other answers.
async function update(store, code, transform, clock) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const entry = await store.getWithMetadata(code, { type: 'json', consistency: 'strong' });
    if (!entry || clock() - entry.data.created >= 86400000) reject('Xona topilmadi yoki muddati tugagan. Yangi xona oching.');
    const result = transform(entry.data, clock());
    if (result.unchanged) return result.value;
    const saved = await store.setJSON(code, entry.data, { onlyIfMatch: entry.etag });
    if (saved.modified) return result.value;
    await wait(10 + randomInt(Math.min(200, 20 + attempt * 8)));
  }
  reject('Xona band. Iltimos, yana bir marta urinib ko‘ring.');
}

function authenticate(room, b) {
  const host = typeof b.secret === 'string' && b.secret === room.secret;
  const player = room.players.find(p => p.id === b.id);
  if (!host && !player) reject('Avval xonaga kiring.');
  return { host, player };
}

export async function handle(request, store, clock = Date.now) {
  try {
    if (request.method !== 'POST') return reply({ error: 'POST so‘rovi kerak.' }, 405);
    const b = await request.json();
    if (!b || typeof b !== 'object' || Array.isArray(b)) reject('So‘rov noto‘g‘ri.');
    const action = new URL(request.url).pathname.split('/').filter(Boolean).pop();
    if (action === 'create') {
      for (let i = 0; i < 10; i++) {
        const code = String(randomInt(100000, 1000000));
        const secret = randomUUID();
        const result = await store.setJSON(code, { code, secret, created: clock(), phase: 'lobby', players: [] }, { onlyIfNew: true });
        if (result.modified) return reply({ code, secret });
      }
      reject('Xona yaratilmadi. Qayta urinib ko‘ring.');
    }
    const code = String(b.code || '');
    if (!/^\d{6}$/.test(code)) reject('6 xonali xona kodini yozing.');
    if (action === 'join') {
      const id = randomUUID();
      const name = String(b.name || '').trim().slice(0, 24);
      if (!name) reject('Taxallusingizni yozing.');
      return reply(await update(store, code, room => {
        if (room.phase !== 'lobby') reject('O‘yin boshlangan. O‘qituvchidan yangi xona ochishini so‘rang.');
        if (room.players.length >= 27) reject('Xonada 27 o‘quvchi bor.');
        if (room.players.some(p => p.name === name)) reject('Bu taxallus band. Boshqa taxallus yozing.');
        room.players.push({ id, name, phase: 'lobby', question: 0, deadline: 0, revealUntil: 0, answers: {} });
        return { value: { id, code, name } };
      }, clock));
    }
    if (action === 'control') {
      return reply(await update(store, code, (room, now) => {
        if (!authenticate(room, b).host) reject('Bu amal faqat o‘qituvchi uchun.');
        if (b.move !== 'start' || room.phase !== 'lobby') reject('O‘yin boshlangan. Savollar avtomatik o‘tadi.');
        if (!room.players.length) reject('Avval o‘quvchilarni taklif qiling.');
        room.phase = 'running';
        for (const p of room.players) { p.phase = 'question'; p.deadline = now + QUESTION_MS; }
        return { value: { ok: true } };
      }, clock));
    }
    if (action === 'answer') {
      return reply(await update(store, code, (room, now) => {
        const { player } = authenticate(room, b);
        if (!player) reject('Faqat o‘quvchi javob bera oladi.');
        if (!Number.isInteger(b.question) || b.question < 0 || b.question >= questions.length || !Number.isInteger(b.choice) || b.choice < 0 || b.choice > 3) reject('Javobni tanlang.');
        const changed = advance(room, now);
        if (Object.hasOwn(player.answers, b.question) && player.answers[b.question] >= 0) return { unchanged: !changed, value: { ok: true } };
        if (player.phase !== 'question' || now >= player.deadline || b.question !== player.question) {
          return { unchanged: !changed, value: { error: 'Javob berish vaqti tugagan.', expired: true } };
        }
        player.answers[player.question] = b.choice;
        player.phase = 'reveal';
        player.revealUntil = now + REVEAL_MS;
        return { value: { ok: true } };
      }, clock));
    }
    if (action !== 'state') reject('Noma’lum so‘rov.');
    const room = await update(store, code, (room, now) => {
      authenticate(room, b);
      const changed = advance(room, now);
      return { unchanged: !changed, value: room };
    }, clock);
    const { host, player } = authenticate(room, b);
    const scores = room.players.map(p => {
      const answered = Object.keys(p.answers).length;
      const correct = Object.entries(p.answers).filter(([i, choice]) => questions[Number(i)]?.[2] === choice).length;
      const missed = Object.values(p.answers).filter(choice => choice === -1).length;
      return { name: p.name, me: p.id === b.id, score: correct * 100, completed: answered, correct, wrong: answered - correct - missed, missed, index: p.question, phase: p.phase };
    }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    const phase = host ? room.phase : player.phase;
    const index = host ? 0 : player.question;
    const q = !host && phase !== 'finished' ? questions[index] : null;
    const visible = phase === 'reveal';
    return reply({ code, roomPhase: room.phase, phase, index, total: questions.length, deadline: player?.deadline || 0, revealUntil: player?.revealUntil || 0, serverNow: clock(), remaining: player ? Math.max(0, Math.ceil((player.deadline - clock()) / 1000)) : 0, count: room.players.length, finishedCount: room.players.filter(p => p.phase === 'finished').length, scores, mine: player?.answers[index] ?? null, question: q ? { text: q[0], options: q[1], ...(visible ? { correct: q[2], explanation: q[3] } : {}) } : null });
  } catch (error) {
    return reply({ error: error.message || 'So‘rovni bajarib bo‘lmadi.' }, 400);
  }
}
