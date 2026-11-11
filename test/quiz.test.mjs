import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../lib/quiz.mjs';
import {questions} from '../lib/questions.mjs';

// Implements the documented Blob API, including atomic ETag preconditions.
class MemoryStore {
  entries=new Map(); version=0; conflicts=0;
  async getWithMetadata(key) {
    const item=this.entries.get(key);
    await new Promise(resolve=>setImmediate(resolve));
    return item?structuredClone(item):null;
  }
  async get(key){return (await this.getWithMetadata(key))?.data??null;}
  async setJSON(key,data,options={}) {
    const old=this.entries.get(key);
    if((options.onlyIfNew&&old)||(options.onlyIfMatch&&old?.etag!==options.onlyIfMatch)) {this.conflicts++;return {modified:false};}
    const etag='"'+(++this.version)+'"';
    this.entries.set(key,{data:structuredClone(data),etag});return {modified:true,etag};
  }
}
async function call(store,action,body,expected=200){
  const response=await handle(new Request('https://example.netlify.app/.netlify/functions/api/'+action,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),store);
  const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));return data;
}

test('27 simultaneous players and 324 answers preserve scores and permissions',async()=>{
 const store=new MemoryStore();const host=await call(store,'create',{});
 await call(store,'state',{code:host.code},400);
 const people=await Promise.all(Array.from({length:27},(_,i)=>call(store,'join',{code:host.code,name:'Student '+i})));
 assert.ok(store.conflicts>0,'Parallel writes exercise ETag retry logic');
 await call(store,'join',{code:host.code,name:'Extra'},400);
 await call(store,'control',{...people[0],move:'start',question:0},400);
 await call(store,'control',{...host,move:'start',question:0});
 await call(store,'join',{code:host.code,name:'Late'},400);
 for(let question=0;question<12;question++){
   const before=await call(store,'state',people[0]);assert.equal(before.question.correct,undefined);
   await Promise.all(people.map(p=>call(store,'answer',{...p,question,choice:questions[question][2]})));
   await call(store,'answer',{...people[0],question,choice:(questions[question][2]+1)%4});
   const answered=await call(store,'state',host);assert.equal(answered.answered,27);
   await call(store,'control',{...host,move:'reveal',question});
   const revealed=await call(store,'state',people[0]);assert.equal(revealed.question.correct,questions[question][2]);
   assert.ok(revealed.scores.every(p=>p.score===(question+1)*100));
   await call(store,'answer',{...people[0],question,choice:0},400);
   await call(store,'control',{...host,move:'next',question});
   await call(store,'control',{...host,move:'next',question},400);
 }
 const result=await call(store,'state',host);assert.equal(result.phase,'finished');assert.equal(result.scores.length,27);assert.ok(result.scores.every(p=>p.score===1200));
});

test('duplicate names, expiration, invalid choices, wrong answers, and deadlines',async()=>{
 const store=new MemoryStore();const host=await call(store,'create',{});
 const p=await call(store,'join',{code:host.code,name:'A'});
 await call(store,'join',{code:host.code,name:'A'},400);
 await call(store,'control',{...host,move:'start',question:0});
 await call(store,'answer',{...p,question:0,choice:8},400);
 await call(store,'answer',{...p,question:1,choice:0},400);
 await call(store,'answer',{...p,question:0,choice:0});
 await call(store,'control',{...host,move:'reveal',question:0});
 assert.equal((await call(store,'state',p)).scores[0].score,0);
 await call(store,'control',{...host,move:'next',question:0});
 store.entries.get(host.code).data.deadline=Date.now()-1;
 await call(store,'answer',{...p,question:1,choice:2},400);
 store.entries.get(host.code).data.created=Date.now()-86400001;
 await call(store,'state',host,400);
});
