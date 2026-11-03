import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = '/tmp/dispatra-compatibility';
await mkdir(output, { recursive:true });
const engines = { chromium, firefox, webkit };
const results = [];
const cases = [
 {name:'desktop',width:1440,height:960,touch:false,dpr:1},
 {name:'tablet',width:768,height:1024,touch:true,dpr:2},
 {name:'phone',width:390,height:844,touch:true,dpr:3},
 {name:'small-phone',width:320,height:740,touch:true,dpr:2},
 {name:'landscape',width:844,height:390,touch:true,dpr:2},
 {name:'reduced',width:390,height:844,touch:true,dpr:3,reduce:true},
];
for (const name of (process.env.BROWSERS || 'chromium,firefox,webkit').split(',')) {
 const browser = await engines[name].launch(name === 'chromium' ? {channel:'chrome',headless:true} : {headless:true});
 try {
  for (const test of cases) {
   const context = await browser.newContext({viewport:{width:test.width,height:test.height},hasTouch:test.touch,deviceScaleFactor:test.dpr,reducedMotion:test.reduce?'reduce':'no-preference'});
   await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin)return route.abort();
    if(url.pathname==='/api/v1/subscription/plan')return route.fulfill({json:{trial_enabled:true,trial_days:30,monthly_price:null,currency:'CAD'}});
    if(url.pathname.startsWith('/api/'))return route.fulfill({status:401,json:{detail:'Sign in'}});
    return route.continue();
   });
   const page=await context.newPage(), errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(origin,{waitUntil:'networkidle',timeout:90000});
   await page.evaluate(()=>document.fonts.ready);
   const section=page.locator('.home-stacked-features'), rows=section.locator('.feature');
   assert.equal(await rows.count(),5);
   assert.equal(await section.locator('.order-source').count(),4);
   assert.equal(await section.locator('.driver').count(),3);
   assert.equal(await section.locator('.home-eyebrow').textContent(),'How it works');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name}/${test.name}: horizontal fit`);
   const stacked=!test.reduce && test.height>700;
   assert.equal(await section.getAttribute('data-stacked'),String(stacked));
   const supervisor=section.locator('.supervisor-hub-icon');
   const hubStyle=await supervisor.evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,border:s.borderTopWidth};});
   assert.deepEqual(hubStyle,{background:'rgba(0, 0, 0, 0)',border:'1px'});
   if(stacked){
    const metrics=await section.evaluate(el=>({top:el.querySelector('.feature-stage').getBoundingClientRect().top+scrollY,pin:parseFloat(getComputedStyle(el).getPropertyValue('--stack-top')),stride:el.querySelector('.feature').offsetHeight}));
    const start=metrics.top-metrics.pin;
    if(test.name==='desktop') {
     const hero=page.locator('.home-hero');
     assert.equal(await hero.locator('h1').evaluate(el=>getComputedStyle(el).fontSize),'64px');
     const sample=async()=>{
      const top=await section.locator('.feature-stage').evaluate(el=>el.getBoundingClientRect().top+scrollY);
      await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),top-metrics.pin+240);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      return rows.evaluateAll(els=>els.map(el=>el.getBoundingClientRect().top));
     };
     const before=await sample();
     await hero.evaluate(el=>{el.style.paddingBlock='190px';el.querySelector('h1').style.fontSize='80px';});
     const after=await sample();
     for(let i=0;i<5;i++)assert.ok(Math.abs(before[i]-after[i])<2,`${name}: hero independence`);
     await hero.evaluate(el=>{el.style.paddingBlock='';el.querySelector('h1').style.fontSize='';});
    }

    const positions=[];
    for(const progress of [0,80,160,240,320,metrics.stride-58,2*(metrics.stride-58),4*(metrics.stride-58)]){
     await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),start+progress);
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     const sample=await rows.evaluateAll(els=>els.map(el=>el.getBoundingClientRect().top));
     if(!positions.length)positions.push(sample[0]);
     for(let index=0;index<5;index++)assert.ok(Math.abs(sample[index]-(positions[0]+Math.max(index*58,index*metrics.stride-progress)))<2,`${name}/${test.name}: row ${index}: ${JSON.stringify({progress,sample,metrics,first:positions[0]})}`);
    }
    const title=await section.getByRole('heading',{name:'Dispatra at work',exact:true}).boundingBox();
    assert.ok(title.y>=-1,`${name}/${test.name}: pinned title visible`);
    await page.screenshot({path:`${output}/${name}-${test.name}.png`,animations:'disabled'});
    const motionSamples=await section.evaluate(async el=>{
     const line=el.querySelector('.route-simple-line');
     const animation=line.getAnimations()[0];
     const original=animation.currentTime;
     animation.pause();animation.currentTime=0;
     const before=parseFloat(getComputedStyle(line).strokeDashoffset);
     animation.currentTime=6000;
     const after=parseFloat(getComputedStyle(line).strokeDashoffset);
     animation.currentTime=original;
     const svg=el.querySelector('.supervisor-connections'),circle=svg.querySelector('circle');
     const current=svg.getCurrentTime();svg.pauseAnimations();
     svg.setCurrentTime(1);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const first=circle.getCTM();
     svg.setCurrentTime(8);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const second=circle.getCTM();
     svg.setCurrentTime(current);
     return {before,after,first:{x:first.e,y:first.f},second:{x:second.e,y:second.f}};
    });
    assert.ok(motionSamples.before>motionSamples.after,`${name}/${test.name}: route draws`);
    assert.ok(Math.hypot(motionSamples.first.x-motionSamples.second.x,motionSamples.first.y-motionSamples.second.y)>1,`${name}/${test.name}: handoff moves along connector ${JSON.stringify(motionSamples)}`);
    // SVG motion and CSS animations must follow a live reduced-motion change.
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.querySelector('.home-stacked-features')?.dataset.stacked==='false');
    assert.equal(await section.getAttribute('data-stacked'),'false');
    const svgPaused=await section.locator('.supervisor-connections').evaluate(svg=>svg.animationsPaused());
    assert.equal(svgPaused,true,`${name}/${test.name}: SVG motion paused for reduced motion`);
    const running=await section.evaluate(el=>el.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').map(a=>({name:a.animationName,target:a.effect?.target?.className?.baseVal||a.effect?.target?.className})));
    assert.equal(running.length,0,`${name}/${test.name}: CSS motion disabled ${JSON.stringify(running)}`);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.waitForFunction(()=>document.querySelector('.home-stacked-features')?.dataset.stacked==='true');
    assert.equal(await section.getAttribute('data-stacked'),'true');
   }else{
    for(const row of await rows.all()){
     await row.scrollIntoViewIfNeeded();
     assert.equal(await row.evaluate(el=>getComputedStyle(el).position),'relative');
    }
    await page.screenshot({path:`${output}/${name}-${test.name}.png`,animations:'disabled'});
   }
   assert.deepEqual(errors,[],`${name}/${test.name}: no page errors`);
   results.push({browser:name,case:test.name,status:'pass'});
   console.log(`PASS ${name}/${test.name}`);
   await context.close();
  }
 }finally{await browser.close();}
}
await writeFile(`${output}/results-${process.env.BROWSERS || 'all'}.json`,JSON.stringify(results,null,2));
console.log(`PASS ${results.length} browser/platform scenarios`);
