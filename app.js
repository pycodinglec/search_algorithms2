'use strict';
const $ = id => document.getElementById(id);
const settings = {
  dfs: {tag:'스택 · pop(-1)', rule:'마지막 후보를 먼저 꺼냅니다. 더 싼 길을 찾으면 다시 후보에 넣고, 후보가 모두 없어질 때까지 비용을 갱신합니다.', queue:'왼쪽이 리스트의 처음, 오른쪽이 끝입니다. 다음에는 맨 오른쪽을 꺼냅니다.'},
  bfs: {tag:'큐 · pop(0)', rule:'처음 후보를 먼저 꺼냅니다. 더 싼 길을 찾으면 다시 후보에 넣고, 후보가 모두 없어질 때까지 비용을 갱신합니다.', queue:'왼쪽이 리스트의 처음, 오른쪽이 끝입니다. 다음에는 맨 왼쪽을 꺼냅니다.'},
  greedy: {tag:'f = h', rule:'도착점까지의 직선거리 h가 가장 작은 후보를 꺼냅니다. 도착점을 꺼내면 끝나며, 최소 비용을 보장하지 않습니다.', queue:'h가 작은 순서로 정렬합니다. 다음에는 맨 왼쪽을 꺼냅니다. 정렬 줄 실행 전에는 잠시 순서가 달라질 수 있습니다.'},
  astar: {tag:'f = g + h', rule:'지금까지의 비용 g와 남은 직선거리 h의 합이 가장 작은 후보를 꺼냅니다. 이 예제의 양의 정수 비용에서는 최소 비용을 찾습니다.', queue:'f = g + h가 작은 순서로 정렬합니다. 다음에는 맨 왼쪽을 꺼냅니다. 정렬 줄 실행 전에는 잠시 순서가 달라질 수 있습니다.'}
};
let algorithm = 'astar', trace = null, index = 0, timer = null, loadVersion = 0, selected = [0,0];
const cache = new Map();
let sourceSha256 = null;
const SNAPSHOT_JSON_MAX_BYTES = 16000;
function snapshotJson(value) {
  const json = JSON.stringify(value);
  if (typeof json !== 'string' || new TextEncoder().encode(json).length > SNAPSHOT_JSON_MAX_BYTES) throw new Error('Snapshot too large');
  return json;
}
function tutorSnapshot() {
  if (!trace || !sourceSha256) return null;
  try {
    const event = trace.events[index];
    return {
      version: 1, algorithm, example: $('example').value, noCost: trace.noCost,
      eventIndex: index, line: event.line || 0, functionName: event.fn,
      sourceSha256, variablesJson: snapshotJson(event.vars),
      stateJson: snapshotJson(trace.states[event.state])
    };
  } catch { return null; }
}
window.addEventListener('message', event => {
  if (window.parent === window || event.source !== window.parent) return;
  if (event.origin !== 'https://duri.sehwa.hs.kr' && !/^http:\/\/(?:localhost|127\.0\.0\.1):[0-9]{1,5}$/.test(event.origin)) return;
  const data = event.data;
  if (!data || data.type !== 'sehwa-search:request' || data.version !== 1 ||
      typeof data.requestId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(data.requestId)) return;
  event.source.postMessage({type: 'sehwa-search:snapshot', version: 1,
    requestId: data.requestId, snapshot: tutorSnapshot()}, event.origin);
});
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => typeof value === 'number' ? Number(value.toFixed(3)).toString() : String(value ?? '—');
const position = p => p ? `(${p[0]}, ${p[1]})` : '—';
const same = (a,b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
const valueText = v => Array.isArray(v) ? `(${v.map(valueText).join(', ')})` : v && typeof v === 'object' ? `{${Object.entries(v).map(([k,x]) => `${k}: ${valueText(x)}`).join(', ')}}` : fmt(v);
function highlight(line) {
  return line.split(/(""".*?"""|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:def|return|if|elif|else|for|in|not|and|or|while|with|as|break|continue|raise|True|False)\b|\b\d+\b)/g).map(part => {
    const cls = /^['"]/.test(part) ? 'string' : /^(def|return|if|elif|else|for|in|not|and|or|while|with|as|break|continue|raise|True|False)$/.test(part) ? 'keyword' : /^\d+$/.test(part) ? 'number' : '';
    return cls ? `<span class="${cls}">${esc(part)}</span>` : esc(part);
  }).join('');
}
function pause() { clearInterval(timer); timer = null; $('play').textContent = '▶ 자동 재생'; }
function step(direction) {
  if (!trace) return;
  let next = index + direction;
  if ($('step-mode').value === 'node') {
    next = direction > 0 ? (trace.stops.find(i => i > index) ?? trace.events.length - 1) : ([...trace.stops].reverse().find(i => i < index) ?? 0);
  }
  go(next);
}
function go(next) {
  index = Math.max(0, Math.min(trace.events.length - 1, next));
  render();
  if (index === trace.events.length - 1) pause();
}
function play() {
  if (timer) { pause(); return; }
  if (!trace) return;
  if (index === trace.events.length - 1) go(trace.searchStart);
  $('play').textContent = 'Ⅱ 일시 정지';
  timer = setInterval(() => step(1), Number($('speed').value));
}
async function load() {
  pause();
  const version = ++loadVersion;
  trace = null;
  sourceSha256 = null;
  $('status').className = '';
  $('status').textContent = '실행 기록을 불러오는 중입니다.';
  document.querySelectorAll('.transport button, .transport input, .transport select').forEach(el => el.disabled = true);
  document.querySelectorAll('[data-algo]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.algo === algorithm)));
  const key = `${algorithm}-${$('example').value}-${Number($('no-cost').checked)}`;
  try {
    if (!cache.has(key)) {
      const response = await fetch(`data/${key}.json`);
      if (!response.ok) throw new Error(`실행 기록 HTTP ${response.status}`);
      cache.set(key, await response.json());
    }
    if (version !== loadVersion) return;
    const loadedTrace = cache.get(key);
    let digest = null;
    try {
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(loadedTrace.source));
      digest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    } catch { /* The simulator remains usable if secure-context hashing is unavailable. */ }
    if (version !== loadVersion) return;
    trace = loadedTrace;
    sourceSha256 = digest;
    index = trace.searchStart;
    selected = startAndGoal()[0];
    $('code').innerHTML = trace.source.trimEnd().split('\n').map((line, i) => `<div class="code-line" id="line-${i+1}"><span class="line-number">${i+1}</span><span>${highlight(line) || ' '}</span></div>`).join('');
    $('filename').textContent = trace.filename;
    $('download').href = trace.filename;
    $('download').download = trace.filename;
    $('rule-tag').textContent = settings[algorithm].tag;
    $('rule').textContent = settings[algorithm].rule;
    $('queue-rule').textContent = settings[algorithm].queue;
    $('seek').max = trace.events.length - 1;
    $('map-input').textContent = trace.example.map.join('\n');
    $('cost-input').textContent = trace.example.cost.join('\n');
    $('input-note').textContent = trace.noCost ? 'NO_COST_MODE = True로 실행한 기록입니다. 비용 파일의 모양은 유지하고 모든 비용을 1로 읽습니다.' : 'NO_COST_MODE = False로 실행한 기록입니다. 비용 파일의 숫자를 그대로 읽습니다.';
    $('status').textContent = '실제 Python 실행 기록 · 입력 준비를 마친 탐색 함수부터 시작합니다. 전체 과정은 ‘처음’을 누르세요.';
    document.querySelectorAll('.transport button, .transport input, .transport select').forEach(el => el.disabled = false);
    render();
    const viewport = document.querySelector('.grid-scroll');
    viewport.scrollLeft = 0;
    if (trace.example.map[0].length > 5) {
      const cell = $('grid').querySelector('.selected');
      viewport.scrollLeft = cell.getBoundingClientRect().left - viewport.getBoundingClientRect().left - viewport.clientWidth / 2 + cell.clientWidth / 2;
    }
  } catch (error) {
    if (version !== loadVersion) return;
    trace = null;
    sourceSha256 = null;
    $('status').className = 'error';
    $('status').textContent = `실행 기록을 읽지 못했습니다. 다른 알고리즘을 선택하거나 새로고침해 주세요. (${error.message})`;
  }
}
function startAndGoal() {
  let start, goal;
  trace.example.map.forEach((row,y) => [...row].forEach((v,x) => {if (v === 's') start=[y,x]; if(v === 'd') goal=[y,x];}));
  return [start,goal];
}
function explain(event) {
  if (!event.line) return '모든 실행이 끝났습니다. 복원 경로와 Python 출력을 비교해 보세요.';
  const line = trace.source.split('\n')[event.line-1].trim();
  const v = event.vars;
  if (line.includes('후보.pop')) return algorithm === 'dfs' ? '스택의 끝에서 후보 하나를 꺼내 현재위치에 저장합니다.' : '후보 목록의 맨 앞에서 하나를 꺼내 현재위치에 저장합니다.';
  if (line === '행, 열 = 현재위치') return `${position(v.현재위치)}를 꺼냈습니다. 좌표를 행과 열로 나눠 저장합니다.`;
  if (line.includes('탐색순서.append')) return '현재 칸을 꺼낸 기록을 추가합니다. 같은 칸도 비용이 개선되면 다시 등장할 수 있습니다.';
  if (line.includes('if 현재위치 == 도착점')) return `꺼낸 칸 ${position(v.현재위치)}이 도착점 ${position(v.도착점)}인지 확인합니다.`;
  if (line.includes('if 새비용')) return `새비용 ${fmt(v.새비용)}와 기존 g ${fmt(v.이웃칸?.g)}를 비교합니다. 같거나 더 비싸면 이 이웃을 건너뜁니다.`;
  if (line.startsWith('새비용 =')) return `현재 g ${fmt(v.현재칸?.g)} + 이웃 진입 비용 ${fmt(v.이웃칸?.노드진입비용)}를 계산합니다.`;
  if (line.includes('["g"] = 새비용')) return `${position([v.다음행,v.다음열])}의 g를 더 저렴한 ${fmt(v.새비용)}로 갱신합니다.`;
  if (line.includes('["직전"] = 화살표')) return `이웃 칸에 ${v.화살표 ?? '화살표'}를 저장합니다. 현재 칸으로 되돌아오기 위한 표시입니다.`;
  if (line.startsWith('if not (0 <=')) return `다음 좌표 ${position([v.다음행,v.다음열])}가 지도 안에 있는지 확인합니다.`;
  if (line.includes('if 이웃칸["벽"]')) return '이웃이 벽이면 통과할 수 없으므로 건너뜁니다.';
  if (line.startsWith('for (행변화')) return '위 → 오른쪽 → 아래 → 왼쪽 순서로 다음 이웃을 확인합니다.';
  if (line.includes('후보.sort')) return '우선순위가 작은 순서로 후보를 정렬합니다. 같은 값은 기존 순서를 유지합니다.';
  if (line.includes('후보.append')) return '아직 후보 목록에 없는 위치를 맨 끝에 추가합니다.';
  if (line.includes('후보[순번] =')) return '이미 후보인 칸의 우선순위를 새 값으로 바꿉니다.';
  if (line.includes('if 후보위치 == 위치')) return '넣으려는 위치가 이미 후보 목록에 있는지 비교합니다.';
  if (line.includes('if not 일치노드찾음')) return '중복 후보를 추가하지 않도록, 목록에 같은 위치가 없을 때만 추가합니다.';
  if (line.startsWith('넣기또는갱신(')) return '함수를 호출해 후보를 넣거나 갱신합니다. 다음 줄부터 함수 안으로 들어갑니다.';
  if (line.startsWith('while 후보')) return '후보가 남았으면 탐색을 계속합니다. 비었으면 반복을 끝냅니다.';
  if (line === 'continue') return '남은 이웃 처리 코드를 건너뛰고 다음 이웃으로 넘어갑니다.';
  if (line === 'break') return event.fn === '탐색' ? '도착점을 꺼냈으므로 탐색 반복을 끝냅니다.' : '일치하는 후보를 찾았으므로 후보 검색 반복을 끝냅니다.';
  if (event.fn === 'h') return '현재 위치와 도착점 사이의 유클리드 직선거리를 계산합니다.';
  if (event.fn === 'g') return '이 칸에 기록된 누적 비용 g를 읽습니다.';
  if (event.fn === 'f') return 'g와 h를 더해 후보의 우선순위를 구합니다.';
  if (event.fn === '<lambda>') return '정렬 기준 함수가 이 후보의 우선순위 값을 꺼냅니다.';
  if (event.fn === '경로복원') return '도착점에서 직전 화살표를 따라 출발점으로 거슬러 갑니다. 마지막에 순서를 뒤집습니다.';
  if (line.startsWith('print(')) return 'Python 출력에 결과를 추가합니다. 왼쪽 ‘Python 출력 보기’에서 확인할 수 있습니다.';
  if (event.fn === '벽과공간획득') return '지도 파일을 열고 각 글자를 한 칸으로 읽습니다.';
  if (event.fn === '비용획득') return '비용 파일을 읽습니다. 비용 무시 모드에서는 각 칸을 1로 만듭니다.';
  if (event.fn === '정보통합') return '벽·진입 비용·g·직전 정보를 묶고 출발점과 도착점을 찾습니다. 처음 g는 무한대입니다.';
  if (line.includes('["g"] = 지도')) return '출발 칸의 g를 자신의 진입 비용으로 설정합니다. 출발 비용도 총비용에 포함합니다.';
  if (line.startsWith('return')) return '이 함수의 결과를 호출한 곳으로 돌려줍니다.';
  if (event.fn === 'main') return '입력 읽기 → 지도 구성 → 탐색 → 결과 표시 순서로 함수를 호출합니다.';
  return `‘${line}’를 실행합니다. 다음 단계에서 변수와 지도의 변화를 확인하세요.`;
}
function render() {
  const event = trace.events[index], state = trace.states[event.state];
  const done = index === trace.events.length - 1;
  const [start,goal] = startAndGoal();
  const costs = trace.example.cost.map(row => [...row].map(Number));
  if (trace.noCost) costs.forEach(row => row.fill(1));
  const queue = state.queue.map(item => Array.isArray(item[0]) ? {p:item[0], priority:item[1]} : {p:item});
  $('step-count').textContent = `${index + 1} / ${trace.events.length} 단계`;
  $('seek').value = index;
  $('first').disabled = $('previous').disabled = index === 0;
  $('next').disabled = $('last').disabled = done;
  $('phase').textContent = done ? '실행 완료' : `${event.fn} · ${event.line}행`;
  $('explanation').textContent = explain(event);
  $('metric-guide').textContent = (algorithm==='astar'?'큰 값 f = g + h: 기록된 누적 비용과 도착점까지의 직선거리를 더합니다. g가 아직 ∞인 칸은 f도 ∞입니다.':algorithm==='greedy'?'큰 값 h: 도착점까지의 직선거리입니다. 지도 입력으로 계산하므로 발견 전 칸에도 표시됩니다.':'깊이·너비우선은 후보를 넣은 순서로 선택하므로 큰 우선순위 숫자를 표시하지 않습니다.');
  $('map-size').textContent = `${trace.example.map.length}행 × ${trace.example.map[0].length}열`;
  const grid = $('grid');
  const columns = trace.example.map[0].length;
  grid.classList.toggle('wide-grid', columns > 3);
  grid.style.minWidth = columns > 3 ? `${18 + columns * 76}px` : '';
  $('wide-map-hint').hidden = columns <= 3;
  grid.style.gridTemplateColumns = `18px repeat(${trace.example.map[0].length}, minmax(0,1fr))`;
  let cells = '<span></span>' + [...trace.example.map[0]].map((_,x) => `<span class="axis">${x}</span>`).join('');
  trace.example.map.forEach((row,y) => {
    cells += `<span class="axis">${y}</span>`;
    [...row].forEach((kind,x) => {
      const p=[y,x], cell=state.board[y]?.[x], g=cell?.[0] ?? '∞', prev=cell?.[1] ?? '';
      const wall=kind==='1';
      const flags=[state.order.some(q=>same(q,p))?'seen':'',queue.some(q=>same(q.p,p))?'queued':'',same(state.current,p)&&!done?'current':'',state.path.some(q=>same(q,p))?'path':'',wall?'wall':'',same(selected,p)?'selected':''].join(' ');
      const h=Math.hypot(y-goal[0],x-goal[1]);
      const metric=algorithm==='astar'?`f ${typeof g==='number'?fmt(g+h):'∞'}`:algorithm==='greedy'?`h ${fmt(h)}`:'';
      const marker=kind==='s'?'s':kind==='d'?'d':'';
      const label=wall?'벽':`${marker==='s'?'출발, ':marker==='d'?'도착, ':''}진입 비용 ${costs[y][x]}, g ${fmt(g)}${metric?`, ${metric}`:''}`;
      cells += `<button class="cell ${flags}" data-y="${y}" data-x="${x}" aria-label="${y}행 ${x}열, ${label}" aria-pressed="${same(selected,p)}">${marker?`<span class="cell-marker" aria-hidden="true">${marker}</span>`:''}<strong class="cell-priority${metric.length>7?' long-priority':''}" aria-hidden="true">${wall?'▨':metric}</strong>${wall?'<small>벽</small>':`<span class="cell-g">g ${fmt(g)}</span><small>진입 ${costs[y][x]}</small>`}<span class="arrow" aria-hidden="true">${esc(prev==='0'?'':prev)}</span></button>`;
    });
  });
  const focusedCell = document.activeElement?.closest('#grid button');
  const restorePosition = focusedCell ? [focusedCell.dataset.y, focusedCell.dataset.x] : null;
  grid.innerHTML = cells;
  if (restorePosition) grid.querySelector(`[data-y="${restorePosition[0]}"][data-x="${restorePosition[1]}"]`)?.focus({preventScroll:true});
  const [sy,sx]=selected, selectedCell=state.board[sy]?.[sx];
  const h=Math.hypot(sy-goal[0],sx-goal[1]), sg=selectedCell?.[0]??'∞';
  $('cell-detail').textContent = trace.example.map[sy][sx]==='1' ? `${position(selected)} · 벽입니다. 탐색 후보에 넣지 않습니다.` : `${position(selected)} · 진입 비용 ${costs[sy][sx]} · g ${fmt(sg)}${algorithm==='astar'?` · h ${fmt(h)} · f = g + h ${typeof sg==='number'?fmt(sg+h):'∞'}`:algorithm==='greedy'?` · h ${fmt(h)} (거리 우선순위)`:' · 우선순위 숫자 없음 (후보 순서로 선택)'} · 직전 ${selectedCell?.[1] || '없음'}`;
  $('queue-count').textContent = `${queue.length}개`;
  $('queue').innerHTML = queue.length ? queue.map((q,i)=>`<span class="queue-node ${i===(algorithm==='dfs'?queue.length-1:0)?'next':''}"><b>${position(q.p)}</b>${q.priority!==undefined?`<small>${algorithm==='greedy'?'h':'f'} ${fmt(q.priority)}</small>`:''}${i===(algorithm==='dfs'?queue.length-1:0)?'<small>꺼낼 자리</small>':''}</span>`).join('') : '<span class="queue-empty">후보 목록이 비어 있습니다.</span>';
  $('visits').textContent = state.order.length;
  const total=state.board[goal[0]]?.[goal[1]]?.[0]??'∞';
  $('goal-cost').textContent = fmt(total);
  $('order').textContent = state.order.map(position).join(' → ') || '아직 꺼낸 후보가 없습니다.';
  $('result-state').textContent = done?'종료':'진행 중';
  $('result-summary').textContent = done ? state.path.length ? `최종 경로 ${state.path.length}칸 · 총 비용 ${fmt(total)} (출발 칸 포함)\n${state.path.map(position).join(' → ')}` : '탐색 실패 · 출발점에서 도착점으로 갈 수 있는 경로가 없습니다.' : state.path.length ? '직전 화살표를 따라 경로를 복원하고 있습니다.' : '도착 칸의 비용도 탐색 중에 더 작아질 수 있습니다.';
  $('result-summary').style.whiteSpace='pre-line';
  $('console').textContent=state.output || '아직 출력이 없습니다.';
  $('function-name').textContent=event.fn;
  $('variables').innerHTML=Object.entries(event.vars).map(([k,v])=>`<span class="var"><b>${esc(k)}</b>${esc(valueText(v))}</span>`).join('') || `<span class="muted">${done?'함수 실행이 끝났습니다.':'아직 저장된 변수가 없습니다.'}</span>`;
  $('stack').textContent=event.stack.join(' → ') || '완료';
  $('code').querySelector('.active')?.classList.remove('active');
  const active=$(`line-${event.line || trace.events[index-1]?.line}`);
  if (active) {
    if (!done) active.classList.add('active');
    const top=active.offsetTop-$('code').offsetTop;
    if(top<$('code').scrollTop+35 || top>$('code').scrollTop+$('code').clientHeight-55) $('code').scrollTop=Math.max(0,top-90);
  }
}
document.querySelectorAll('[data-algo]').forEach(el=>el.addEventListener('click',()=>{algorithm=el.dataset.algo;load();}));
$('example').addEventListener('change',load);
$('no-cost').addEventListener('change',load);
$('first').addEventListener('click',()=>{pause();go(0);});
$('search-start').addEventListener('click',()=>{pause();go(trace.searchStart);});
$('last').addEventListener('click',()=>{pause();go(trace.events.length-1);});
$('next').addEventListener('click',()=>{pause();step(1);});
$('previous').addEventListener('click',()=>{pause();step(-1);});
$('play').addEventListener('click',play);
$('seek').addEventListener('input',()=>{pause();go(Number($('seek').value));});
$('step-mode').addEventListener('change',pause);
$('speed').addEventListener('change',()=>{if(timer){pause();play();}});
$('grid').addEventListener('click',e=>{const b=e.target.closest('button');if(b&&trace){selected=[Number(b.dataset.y),Number(b.dataset.x)];render();}});
$('input-toggle').addEventListener('click',()=>{const open=$('inputs').hidden;$('inputs').hidden=!open;$('input-toggle').setAttribute('aria-expanded',String(open));$('input-toggle').textContent=open?'입력 파일 닫기':'입력 파일 보기';});
document.addEventListener('keydown',e=>{
  if(!trace||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||['INPUT','SELECT','BUTTON','SUMMARY','A','TEXTAREA'].includes(e.target.tagName))return;
  if(e.key==='ArrowRight'){e.preventDefault();pause();step(1);}
  if(e.key==='ArrowLeft'){e.preventDefault();pause();step(-1);}
  if(e.code==='Space'){e.preventDefault();play();}
});
load();

const divider = $('pane-divider');
const workspace = document.querySelector('.workspace');
function resizePane(pixels) {
  const available = workspace.clientWidth - 32;
  const width = Math.max(250, Math.min(available - 250, pixels));
  workspace.style.setProperty('--map-width', `${width / workspace.clientWidth * 100}%`);
  divider.setAttribute('aria-valuenow', Math.round(width / available * 100));
  divider.setAttribute('aria-valuetext', `지도 ${Math.round(width)}픽셀, 코드 ${Math.round(available - width)}픽셀`);
}
divider.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  event.preventDefault();
  divider.setPointerCapture(event.pointerId);
  divider.classList.add('dragging');
  workspace.classList.add('resizing');
});
divider.addEventListener('pointermove', event => {
  if (!divider.hasPointerCapture(event.pointerId)) return;
  resizePane(event.clientX - workspace.getBoundingClientRect().left - 10);
});
function stopResize() { divider.classList.remove('dragging'); workspace.classList.remove('resizing'); }
divider.addEventListener('pointerup', event => { if(divider.hasPointerCapture(event.pointerId))divider.releasePointerCapture(event.pointerId);stopResize(); });
divider.addEventListener('lostpointercapture', stopResize);
divider.addEventListener('keydown', event => {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault();event.stopPropagation();
  const current = document.querySelector('.visual-column').getBoundingClientRect().width;
  resizePane(event.key === 'Home' ? 250 : event.key === 'End' ? workspace.clientWidth : current + (event.key === 'ArrowRight' ? 20 : -20));
});
