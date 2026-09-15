async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const base = page.url();
  const evidence = [];
  await page.locator('#no-cost').uncheck();
  for (const algo of ['dfs', 'bfs']) {
    await page.locator(`[data-algo="${algo}"]`).click();
    await page.locator('#example').selectOption('uploaded');
    await page.waitForFunction(() => !document.querySelector('#next').disabled);
    const trace = await (await page.request.get(`${base}data/${algo}-uploaded-0.json`)).json();
    const arrivals = trace.stops.filter(i => {
      const state = trace.states[trace.events[i].state];
      return trace.events[i].line > 0 && JSON.stringify(state.current) === '[5,7]';
    });
    check(arrivals.length > 0, 'destination must be popped');
    await page.locator('#seek').evaluate((el, i) => { el.value=i; el.dispatchEvent(new Event('input', {bubbles:true})); }, arrivals[0]);
    const firstCost = await page.locator('#goal-cost').innerText();
    check(firstCost === (algo === 'dfs' ? '108' : '81'), 'first destination cost');
    check(await page.locator('#next').isEnabled(), 'must continue after destination');
    await page.locator('#next').click();
    check(Number(await page.locator('#seek').inputValue()) === arrivals[0]+1, 'next line after destination');
    await page.locator('#last').click();
    check(await page.locator('#goal-cost').innerText() === '81', 'independent optimal cost');
    check(await page.locator('#queue-count').innerText() === '0개', 'must drain frontier');
    check((await page.locator('#result-summary').innerText()).includes('21칸 · 총 비용 81'), 'valid final path');
    evidence.push({algo, firstCost, finalCost:81, drained:true});
  }
  for (const [algo, expected] of [['greedy',11],['astar',5]]) {
    await page.locator(`[data-algo="${algo}"]`).click();
    await page.locator('#example').selectOption('basic');
    await page.waitForFunction(() => !document.querySelector('#next').disabled);
    await page.locator('#last').click();
    check(await page.locator('#goal-cost').innerText() === String(expected), `${algo} expected cost`);
    evidence.push({algo, finalCost:expected});
  }
  return {time:new Date().toISOString(), url:base, evidence};
}
