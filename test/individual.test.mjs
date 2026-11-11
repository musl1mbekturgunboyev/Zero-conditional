import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { handle, QUESTION_MS, REVEAL_MS } from '../lib/game.mjs';
import { questions } from '../lib/questions.mjs';

class MemoryStore {
  entries = new Map(); version = 0; conflicts = 0;
  async getWithMetadata(key) {
    const item = this.entries.get(key);
    await new Promise(resolve => setImmediate(resolve));
    return item ? structuredClone(item) : null;
  }
  async setJSON(key, data, options = {}) {
    const old = this.entries.get(key);
    if ((options.onlyIfNew && old) || (options.onlyIfMatch && old?.etag !== options.onlyIfMatch)) { this.conflicts++; return { modified: false }; }
    const etag = '"' + (++this.version) + '"';
    this.entries.set(key, { data: structuredClone(data), etag }); return { modified: true, etag };
  }
}
function harness() {
  const store = new MemoryStore(); let now = 1800000000000;
  return { store, step(ms) { now += ms; }, async call(action, body, expected = 200) {
    const response = await handle(new Request('https://example.netlify.app/.netlify/functions/api/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), store, () => now);
    const data = await response.json(); assert.equal(response.status, expected, JSON.stringify(data)); return data;
  } };
}

test('each student advances independently; timeout and own feedback do not reveal another student’s answer', async () => {
  const h = harness(), host = await h.call('create', {});
  const a = await h.call('join', { code: host.code, name: 'A' });
  const b = await h.call('join', { code: host.code, name: 'B' });
  await h.call('control', { ...host, move: 'start' });
  h.step(1000);
  await h.call('answer', { ...a, question: 0, choice: 1 });
  let sa = await h.call('state', a), sb = await h.call('state', b);
  assert.equal(sa.phase, 'reveal'); assert.equal(sa.question.correct, 1);
  assert.equal(sb.phase, 'question'); assert.equal(sb.question.correct, undefined);
  await h.call('answer', { ...a, question: 0, choice: 0 });
  assert.equal((await h.call('state', a)).mine, 1);
  h.step(REVEAL_MS);
  sa = await h.call('state', a); sb = await h.call('state', b);
  assert.equal(sa.index, 1); assert.equal(sa.remaining, 15);
  assert.equal(sb.index, 0); assert.equal(sb.remaining, 12);
  h.step(12000);
  sb = await h.call('state', b); sa = await h.call('state', a);
  assert.equal(sb.phase, 'reveal'); assert.equal(sb.mine, -1); assert.equal(sb.question.correct, 1);
  assert.equal(sb.scores.find(p => p.me).score, 0); assert.equal(sb.scores.find(p => p.me).missed, 1);
  assert.equal(sa.index, 1); assert.equal(sa.phase, 'question'); assert.equal(sa.remaining, 3);
  assert.equal((await h.call('answer', { ...b, question: 0, choice: 1 })).expired, true);
  h.step(REVEAL_MS);
  sb = await h.call('state', b); sa = await h.call('state', a);
  assert.equal(sb.index, 1); assert.equal(sb.remaining, 15); assert.equal(sa.remaining, 1);
  const dashboard = await h.call('state', host);
  assert.equal(dashboard.question, null); assert.equal(dashboard.phase, 'running');
  assert.equal(dashboard.scores.find(p => p.name === 'A').score, 100);
  assert.equal(dashboard.scores.find(p => p.name === 'B').missed, 1);
});

test('27 concurrent players, 324 answers, shared scores, immutable choices, and automatic completion', async () => {
  const h = harness(), host = await h.call('create', {});
  await h.call('state', { code: host.code }, 400);
  const people = await Promise.all(Array.from({ length: 27 }, (_, i) => h.call('join', { code: host.code, name: 'Student ' + i })));
  assert.ok(h.store.conflicts > 0);
  await h.call('join', { code: host.code, name: 'Extra' }, 400);
  await h.call('control', { ...people[0], move: 'start' }, 400);
  await h.call('control', { ...host, move: 'start' });
  await h.call('join', { code: host.code, name: 'Late' }, 400);
  for (let question = 0; question < 12; question++) {
    const before = await h.call('state', people[0]);
    assert.equal(before.index, question); assert.equal(before.question.correct, undefined);
    assert.equal(before.remaining, QUESTION_MS / 1000);
    await Promise.all(people.map(p => h.call('answer', { ...p, question, choice: questions[question][2] })));
    await h.call('answer', { ...people[0], question, choice: (questions[question][2] + 1) % 4 });
    const revealed = await h.call('state', people[0]);
    assert.equal(revealed.question.correct, questions[question][2]);
    assert.ok(revealed.scores.every(p => p.score === (question + 1) * 100));
    await h.call('control', { ...host, move: 'next' }, 400);
    h.step(REVEAL_MS);
    // Any student's poll can persist a transition; the teacher need not click.
    await Promise.all(people.map(p => h.call('state', p)));
  }
  const result = await h.call('state', host);
  assert.equal(result.phase, 'finished'); assert.equal(result.finishedCount, 27);
  assert.ok(result.scores.every(p => p.score === 1200 && p.completed === 12));
});

test('all 12 unanswered questions time out and late tabs cannot reset their clocks', async () => {
  const h = harness(), host = await h.call('create', {});
  const p = await h.call('join', { code: host.code, name: 'No answer' });
  await h.call('join', { code: host.code, name: 'No answer' }, 400);
  await h.call('control', { ...host, move: 'start' });
  await h.call('answer', { ...p, question: 0, choice: 8 }, 400);
  h.step(QUESTION_MS);
  let s = await h.call('state', p);
  assert.equal(s.phase, 'reveal'); assert.equal(s.mine, -1);
  assert.equal((await h.call('answer', { ...p, question: 0, choice: 1 })).expired, true);
  h.step(REVEAL_MS + (QUESTION_MS + REVEAL_MS) * 11);
  s = await h.call('state', p);
  assert.equal(s.phase, 'finished'); assert.equal(s.roomPhase, 'finished');
  assert.equal(s.scores[0].score, 0); assert.equal(s.scores[0].missed, 12);
  assert.equal(s.scores[0].completed, 12);
  h.step(86400001); await h.call('state', host, 400);
});

test('an early finisher sees provisional shared scores while another student keeps playing', async () => {
  const h = harness(), host = await h.call('create', {});
  const a = await h.call('join', { code: host.code, name: 'Fast' });
  const b = await h.call('join', { code: host.code, name: 'Slow' });
  await h.call('control', { ...host, move: 'start' });
  for (let i = 0; i < 12; i++) {
    await h.call('answer', { ...a, question: i, choice: questions[i][2] });
    h.step(REVEAL_MS); await h.call('state', a);
  }
  const sa = await h.call('state', a), sb = await h.call('state', b);
  assert.equal(sa.phase, 'finished'); assert.equal(sa.roomPhase, 'running');
  assert.equal(sa.finishedCount, 1); assert.equal(sa.scores[0].score, 1200);
  assert.equal(sb.phase, 'question'); assert.equal(sb.index, 1);
});

test('frontend renders independent question, timeout feedback, host table, and provisional finish', async () => {
  const nodes = new Map();
  const node = selector => { if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', value: '' }); return nodes.get(selector); };
  const context = vm.createContext({ document: { querySelector: node, querySelectorAll: () => [] }, localStorage: { getItem: () => null }, location: { search: '' }, URLSearchParams, performance: { now: () => 0 }, setInterval: () => 0, console });
  vm.runInContext(readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'), context);
  const h = harness(), host = await h.call('create', {});
  const a = await h.call('join', { code: host.code, name: '<Fast>' });
  const b = await h.call('join', { code: host.code, name: 'Slow' });
  await h.call('control', { ...host, move: 'start' });
  const draw = async identity => {
    const s = await h.call('state', identity);
    context.payload = s; context.identity = identity;
    vm.runInContext('session=identity;state=payload;receivedAt=0;render();', context);
    return node('#app').innerHTML;
  };
  assert.match(await draw(a), /SAVOL 1 \/ 12/);
  const panel = await draw(host);
  assert.match(panel, /Umumiy ballar/); assert.match(panel, /&lt;Fast&gt;/); assert.doesNotMatch(panel, /id="control"/);
  h.step(QUESTION_MS);
  assert.match(await draw(b), /Vaqt tugadi — 0 ball/);
  h.step(REVEAL_MS);
  assert.match(await draw(a), /SAVOL 2 \/ 12/);
});
