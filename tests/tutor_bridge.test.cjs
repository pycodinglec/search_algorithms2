const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto, createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'data/astar-blocked-1.json')));
const responses = [], listeners = {}, elements = new Map();
const parent = { postMessage: (message, origin) => responses.push({message, origin}) };
const context = vm.createContext({
  TextEncoder, crypto: webcrypto, clearInterval, setInterval,
  window: {parent, addEventListener: (type, handler) => listeners[type] = handler},
  document: {
    documentElement: {dataset: {}},
    getElementById(id) { if (!elements.has(id)) elements.set(id, {value: 'blocked', checked: true, setAttribute(){}}); return elements.get(id); },
    querySelectorAll: () => [], querySelector: () => ({scrollLeft: 0})
  },
  fetch: async () => ({ok: true, json: async () => fixture})
});
// Run the actual protocol/load implementation; rendering is separately browser-tested.
vm.runInContext(source.slice(0, source.indexOf('function startAndGoal()')) + '\nfunction startAndGoal(){return [[0,0],[2,2]]} function render(){}', context);
const run = expression => vm.runInContext(expression, context);
function request(overrides = {}) {
  listeners.message({source: parent, origin: 'https://duri.sehwa.hs.kr',
    data: {type:'sehwa-search:request',version:1,requestId:'test_1'}, ...overrides});
  return responses.at(-1)?.message.snapshot;
}
(async () => {
  const themeData = theme => ({type:'sehwa-search:theme',version:1,theme});
  assert.equal(context.document.documentElement.dataset.hostTheme, undefined);
  request({data:themeData('dark')});
  assert.equal(context.document.documentElement.dataset.hostTheme,'dark');
  for (const overrides of [{origin:'https://evil.example'}, {source:{}}, {data:themeData('unknown')}, {data:{...themeData('light'),version:2}}]) request({data:themeData('light'),...overrides});
  assert.equal(context.document.documentElement.dataset.hostTheme,'dark');
  request({data:themeData('light')});
  assert.equal(context.document.documentElement.dataset.hostTheme,'light');
  request(); assert.equal(responses.at(-1).message.snapshot, null);
  await run('load()');
  const first = request();
  assert.equal(first.sourceSha256, createHash('sha256').update(fixture.source).digest('hex'));
  assert.equal(first.line, fixture.events[fixture.searchStart].line);
  assert.deepEqual(JSON.parse(first.variablesJson), fixture.events[fixture.searchStart].vars);
  assert.deepEqual(JSON.parse(first.stateJson), fixture.states[fixture.events[fixture.searchStart].state]);
  run('index += 1'); assert.equal(request().eventIndex, first.eventIndex + 1);
  run('index -= 1'); assert.equal(request().eventIndex, first.eventIndex);
  assert.equal(responses.at(-1).origin, 'https://duri.sehwa.hs.kr');
  const before = responses.length;
  for (const origin of ['https://evil.example', 'https://duri.sehwa.hs.kr.evil.example', 'null', 'file://', 'http://localhost.evil:3000']) request({origin});
  request({source: {postMessage(){throw Error('wrong source')}}});
  for (const requestId of ['', 'x'.repeat(81), '<script>', 2]) request({data:{type:'sehwa-search:request',version:1,requestId}});
  request({data:{type:'sehwa-search:request',version:2,requestId:'ok'}});
  assert.equal(responses.length, before);
  request({origin:'http://localhost:3000'}); request({origin:'http://127.0.0.1:8794'});
  assert.equal(responses.length, before + 2);
  run('index = trace.events.length - 1'); assert.equal(request().line, 0);
  run('trace.events[index].vars = {oversized: "한".repeat(6000)}'); assert.equal(request(), null);
  run('trace.events[index].vars = {}');
  let resolveFetch;
  context.fetch = () => new Promise(resolve => { resolveFetch = resolve; });
  run('algorithm = "bfs"'); const pending = run('load()');
  assert.equal(request(), null);
  // Selecting cached A* while BFS is pending must prevent late BFS data taking over.
  run('algorithm = "astar"'); await run('load()');
  resolveFetch({ok:true,json:async()=>fixture}); await pending;
  assert.equal(request().algorithm, 'astar');
  assert.equal(request().eventIndex, fixture.searchStart);
  assert.equal(responses.at(-1).message.requestId, 'test_1');
  console.log('PASS: snapshot hash, state/line, step/rewind, terminal, bounds, origins/source/request IDs, loading and stale load');
})().catch(error => {console.error(error);process.exitCode=1;});
