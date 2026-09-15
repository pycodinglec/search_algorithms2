async (page) => {
  const checks=[];
  for (const width of [320,390,600,768,900,901,1024,1280,1350,1440,1512,1728,1920]) {
    await page.setViewportSize({width,height:1000});
    for (const algo of ['dfs','bfs','greedy','astar']) {
      await page.locator(`[data-algo="${algo}"]`).click();
      for (const example of ['maze','uploaded']) {
      await page.locator('#example').selectOption(example);
      await page.waitForFunction(()=>!document.querySelector('#next').disabled);
      for (const stage of ['start','result']) {
        if(stage==='result') await page.locator('#last').click();
        const geometry=await page.locator('#grid').evaluate(grid=>{
          const bounds=grid.getBoundingClientRect();
          const cells=[...grid.querySelectorAll('button')].map(el=>({y:Number(el.dataset.y),x:Number(el.dataset.x),r:el.getBoundingClientRect(),overflow:el.scrollWidth>el.clientWidth}));
          const overlaps=[];
          for(const a of cells)for(const b of cells)if(a.y===b.y&&a.x+1===b.x&&a.r.right>b.r.left+.1)overlaps.push([a.y,a.x,b.x]);
          return {overlaps,outside:cells.some(c=>c.r.right>bounds.right+.5||c.r.left<bounds.left-.5),textOverflow:cells.some(c=>c.overflow),cellWidth:cells[0].r.width};
        });
        if(geometry.overlaps.length||geometry.outside||geometry.textOverflow)throw new Error(JSON.stringify({width,algo,stage,...geometry}));
        checks.push({width,algo,example,stage,...geometry});
      }
      }
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#search-start').click();
  await page.locator('.map-panel').screenshot({path:'output/playwright/maze-layout-fixed.png'});
  return {time:new Date().toISOString(),url:page.url(),cases:checks.length,checks};
}
