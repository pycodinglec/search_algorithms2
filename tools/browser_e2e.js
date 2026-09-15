async (page) => {
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  const base=page.url();
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const loadReady=async()=>{await page.locator('#next').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#next').disabled && !document.querySelector('#status').classList.contains('error'));};
  const results=[];
  for(const algo of ['dfs','bfs','greedy','astar']) {
    await page.locator(`[data-algo="${algo}"]`).click();
    for(const example of ['basic','maze','uploaded','blocked']) {
      await page.locator('#example').selectOption(example);
      for(const mode of [false,true]) {
        await page.locator('#no-cost').setChecked(mode);
        await loadReady();
        const data=await (await page.request.get(`${base}data/${algo}-${example}-${Number(mode)}.json`)).json();
        const code=await page.locator('.code-line>span:last-child').allTextContents();
        check(code.map(s=>s===' '?'':s).join('\n')===data.source.trimEnd(),`${algo} displayed source mismatch`);
        await page.locator('#first').click();
        check((await page.locator('#step-count').innerText()).startsWith('1 /'), 'first step');
        await page.locator('#next').click();
        check((await page.locator('#step-count').innerText()).startsWith('2 /'),'next line');
        await page.locator('#previous').click();
        check((await page.locator('#step-count').innerText()).startsWith('1 /'),'previous line');
        const eventIndices=[data.searchStart,...data.stops.slice(1,4),data.events.findIndex(e=>e.vars.새비용!==undefined)].filter(i=>i>=0 && data.events[i].line>0);
        for(const i of eventIndices){
          await page.locator('#seek').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},i);
          const event=data.events[i],state=data.states[event.state];
          check(await page.locator(`#line-${event.line}`).getAttribute('class')==='code-line active','line highlight');
          check(await page.locator('#queue-count').innerText()===`${state.queue.length}개`,'queue count');
          check(await page.locator('#visits').innerText()===String(state.order.length),'visit count');
          const activeVisible=await page.locator('.code-line.active').evaluate(el=>{const p=el.closest('#code').getBoundingClientRect(),r=el.getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom;});
          check(activeVisible,'active line must be scrolled into code pane');
        }
        await page.locator('#step-mode').selectOption('node');
        await page.locator('#search-start').click();
        await page.locator('#next').click();
        check((await page.locator('#step-count').innerText()).startsWith(`${data.stops[1]+1} /`),'node step');
        await page.locator('#step-mode').selectOption('line');
        await page.locator('#last').click();
        const expected=data.states.at(-1);
        check(await page.locator('#console').textContent()===expected.output,'console differs from actual Python');
        check(await page.locator('.cell.path').count()===expected.path.length,'final path cells');
        check(await page.locator('#next').isDisabled(),'end next disabled');
        const summary=await page.locator('#result-summary').innerText();
        check(example==='blocked'?summary.includes('탐색 실패'):summary.includes('총 비용'),'result summary');
        results.push({algo,example,mode,result:summary.split('\n')[0]});
      }
    }
  }
  await page.locator('[data-algo="astar"]').click();
  await page.locator('#example').selectOption('basic');
  await page.locator('#no-cost').uncheck();
  await loadReady();
  await page.locator('#speed').selectOption('120');
  const before=await page.locator('#seek').inputValue();
  await page.locator('#play').click();
  await page.waitForFunction(i=>Number(document.querySelector('#seek').value)>Number(i)+2,before);
  await page.locator('#play').click();
  const paused=await page.locator('#seek').inputValue();
  await page.waitForTimeout(300);
  check(await page.locator('#seek').inputValue()===paused,'pause must stop playback');
  await page.locator('#input-toggle').click();
  check(await page.locator('#map-input').isVisible(),'input toggle');
  await page.locator('#input-toggle').click();
  await page.locator('#grid button[data-y="1"][data-x="1"]').click();
  check((await page.locator('#cell-detail').innerText()).includes('(1, 1)'),'cell selection');
  await page.locator('#search-start').click();
  await page.locator('#code').focus();
  const keyboardStart=await page.locator('#seek').inputValue();
  await page.keyboard.press('ArrowRight');
  check(Number(await page.locator('#seek').inputValue())===Number(keyboardStart)+1,'keyboard forward');
  await page.keyboard.press('ArrowLeft');
  check(await page.locator('#seek').inputValue()===keyboardStart,'keyboard back');
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#last').click();
  await page.screenshot({path:'output/playwright/desktop-result.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-algo="bfs"]').click();
  await loadReady();
  await page.locator('#last').click();
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile horizontal overflow');
  check((await page.locator('#result-summary').innerText()).includes('총 비용 5'),'mobile result');
  await page.screenshot({path:'output/playwright/mobile-result.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-algo="astar"]').click();
  await loadReady();
  check(errors.length===0,`browser errors: ${errors}`);
  return {url:base,time:new Date().toISOString(),cases:results.length,results,interactionChecks:'line/node/seek/back/start/end/autoplay/pause/input/cell/keyboard/mobile/source/console',errors};
}
