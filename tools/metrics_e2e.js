async (page) => {
  const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
  const round=n=>Number(n.toFixed(2)).toString();
  const results=[];
  for(const algo of ['dfs','bfs','greedy','astar']) {
    await page.locator(`[data-algo="${algo}"]`).click();
    for(const example of ['basic','maze','uploaded','blocked']) {
      await page.locator('#example').selectOption(example);
      for(const mode of [false,true]) {
        await page.locator('#no-cost').setChecked(mode);
        await page.waitForFunction(()=>!document.querySelector('#next').disabled);
        const data=await(await page.request.get(`${page.url()}data/${algo}-${example}-${Number(mode)}.json`)).json();
        let goal;data.example.map.forEach((r,y)=>[...r].forEach((k,x)=>{if(k==='d')goal=[y,x];}));
        for(const i of [0,data.searchStart,...data.stops.slice(1,3),data.events.length-1]) {
          await page.locator('#seek').evaluate((el,i)=>{el.value=i;el.dispatchEvent(new Event('input'));},i);
          const state=data.states[data.events[i].state];
          const cells=await page.locator('.cell').evaluateAll(els=>els.map(el=>({y:+el.dataset.y,x:+el.dataset.x,metric:el.querySelector('.cell-priority').textContent,marker:el.querySelector('.cell-marker')?.textContent,small:el.querySelector('small').textContent,label:el.getAttribute('aria-label')})));
          for(const cell of cells){
            const {y,x}=cell,kind=data.example.map[y][x];if(kind==='1'){check(cell.metric==='▨','wall');continue;}
            const g=state.board[y]?.[x]?.[0],h=Math.hypot(y-goal[0],x-goal[1]);
            const expected=algo==='astar'?`f ${typeof g==='number'?round(g+h):'∞'}`:algo==='greedy'?`h ${round(h)}`:'';
            check(cell.metric===expected,`${algo}/${example}/${i}/${y},${x}: ${cell.metric} != ${expected}`);
            check(cell.small===`진입 ${mode?1:data.example.cost[y][x]}`,'entry cost');
            check(cell.marker===(['s','d'].includes(kind)?kind:undefined),'endpoint');
            check(!expected||cell.label.includes(expected),'accessible metric');
          }
        }
        results.push(`${algo}/${example}/${mode}`);
      }
    }
  }
  return {combinations:results.length,statesPerCombination:5};
}
