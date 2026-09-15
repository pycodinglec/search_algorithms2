async(page)=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#example').selectOption('uploaded');
  await page.waitForFunction(()=>!document.querySelector('#next').disabled);
  if(await page.locator('#example option:checked').innerText()!=='복잡한 지도 8 × 12')throw Error('Map name');
  await page.evaluate(()=>window.scrollTo(0,document.querySelector('.workspace').offsetTop-150));
  const map=page.locator('.visual-column'),code=page.locator('.code-panel'),separator=page.locator('#pane-divider');
  const before=(await map.boundingBox()).width,codeBefore=(await code.boundingBox()).width;
  const box=await separator.boundingBox();const y=Math.max(200,box.y+20);
  await page.mouse.move(box.x+box.width/2,y);await page.mouse.down();await page.mouse.move(box.x+box.width/2+400,y,{steps:10});await page.mouse.up();
  const after=(await map.boundingBox()).width;
  if(after<before+380||(await code.boundingBox()).width>codeBefore-380)throw Error('Drag did not resize both panes');
  if(!await page.locator('.grid-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth+1))throw Error('Map should fit when expanded');
  const step=await page.locator('#seek').inputValue();await separator.focus();await page.keyboard.press('ArrowLeft');
  if((await map.boundingBox()).width>after-19)throw Error('Keyboard resize');
  if(await page.locator('#seek').inputValue()!==step)throw Error('Resize key changed execution step');
  const retained=(await map.boundingBox()).width;
  await page.locator('[data-algo="bfs"]').click();await page.waitForFunction(()=>!document.querySelector('#next').disabled);
  if(Math.abs((await map.boundingBox()).width-retained)>1)throw Error('Selection reset user size');
  await page.locator('#last').click();if(!(await page.locator('#result-summary').innerText()).includes('총 비용 81'))throw Error('Result');
  await page.screenshot({path:'output/playwright/resizable-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  if(await separator.isVisible())throw Error('Mobile separator');
  if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('Mobile overflow');
  await page.setViewportSize({width:1440,height:1000});
  return {time:new Date().toISOString(),url:page.url(),before,after,drag:true,keyboard:true,preservesSelection:true,mobile:true};
}
