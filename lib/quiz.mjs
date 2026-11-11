import { randomInt, randomUUID } from 'node:crypto';
import { questions } from './questions.mjs';

const reply = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const reject = (message) => { throw new Error(message); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// An ETag comparison prevents simultaneous phones from overwriting each other.
async function update(store, code, transform) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const entry = await store.getWithMetadata(code, { type: 'json', consistency: 'strong' });
    if (!entry || Date.now() - entry.data.created >= 86400000) reject('Xona topilmadi yoki muddati tugagan.');
    const result = transform(entry.data);
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

export async function handle(request, store) {
  try {
    if (request.method !== 'POST') return reply({ error: 'POST so‘rovi kerak.' }, 405);
    const b = await request.json();
    if (!b || typeof b !== 'object' || Array.isArray(b)) reject('So‘rov noto‘g‘ri.');
    const action = new URL(request.url).pathname.split('/').filter(Boolean).pop();
    if (action === 'create') {
      for (let i = 0; i < 10; i++) {
        const code = String(randomInt(100000, 1000000));
        const secret = randomUUID();
        const result = await store.setJSON(code, { code, secret, created: Date.now(), phase: 'lobby', question: 0, deadline: 0, players: [], answers: {} }, { onlyIfNew: true });
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
        room.players.push({ id, name });
        return { value: { id, code, name } };
      }));
    }
    if (action === 'control') {
      if (!Number.isInteger(b.question)) reject('Sahifani yangilang.');
      return reply(await update(store, code, room => {
        if (!authenticate(room, b).host) reject('Bu amal faqat o‘qituvchi uchun.');
        if (room.question !== b.question) reject('Savol o‘zgargan. Sahifani yangilang.');
        if (b.move === 'start' && room.phase === 'lobby') {
          if (!room.players.length) reject('Avval o‘quvchilarni taklif qiling.');
          room.phase = 'question'; room.deadline = Date.now() + 30000;
        } else if (b.move === 'reveal' && room.phase === 'question') room.phase = 'reveal';
        else if (b.move === 'next' && room.phase === 'reveal') {
          room.question++;
          room.phase = room.question >= questions.length ? 'finished' : 'question';
          room.deadline = Date.now() + 30000;
        } else reject('Amal bajarilgan yoki o‘yin holati o‘zgargan.');
        return { value: { ok: true } };
      }));
    }
    if (action === 'answer') {
      return reply(await update(store, code, room => {
        const { player } = authenticate(room, b);
        if (!player || room.phase !== 'question' || Date.now() > room.deadline || b.question !== room.question) reject('Javob berish vaqti tugagan.');
        if (!Number.isInteger(b.choice) || b.choice < 0 || b.choice > 3) reject('Javobni tanlang.');
        const key = player.id + ':' + room.question;
        if (Object.hasOwn(room.answers, key)) return { unchanged: true, value: { ok: true } };
        room.answers[key] = b.choice;
        return { value: { ok: true } };
      }));
    }
    if (action !== 'state') reject('Noma’lum so‘rov.');
    const room = await store.get(code, { type: 'json', consistency: 'strong' });
    if (!room || Date.now() - room.created >= 86400000) reject('Xona topilmadi yoki 24 soatlik muddati tugagan.');
    authenticate(room, b);
    const visible = room.phase === 'reveal' || room.phase === 'finished';
    const scores = room.players.map(p => {
      let score = 0;
      for (let i = 0; i < questions.length; i++) if ((i < room.question || (visible && i === room.question)) && room.answers[p.id + ':' + i] === questions[i][2]) score += 100;
      return { name: p.name, me: p.id === b.id, score };
    }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    const q = questions[room.question];
    return reply({ code, phase: room.phase, index: room.question, total: questions.length, deadline: room.deadline, remaining: Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000)), count: room.players.length, scores, answered: room.players.filter(p => Object.hasOwn(room.answers, p.id + ':' + room.question)).length, mine: room.answers[b.id + ':' + room.question] ?? null, question: q ? { text: q[0], options: q[1], ...(visible ? { correct: q[2], explanation: q[3] } : {}) } : null });
  } catch (error) {
    return reply({ error: error.message || 'So‘rovni bajarib bo‘lmadi.' }, 400);
  }
}
