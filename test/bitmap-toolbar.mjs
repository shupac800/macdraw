// Verify screenshots of actual toolbar glyphs against archived FONT bits.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const glyphs = JSON.parse(await readFile(new URL('../assets/bitmaps/macdraw-1.9-tools.json',import.meta.url)));
const origin = process.env.MACDRAW_TEST_ORIGIN || 'http://127.0.0.1:5174';
const output = new URL('../output/bitmap-qa/',import.meta.url); await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true,channel:'chrome'});
let checks = 0;
try {
  for (const dpr of [1,1.25,1.5,2]) {
    const context = await browser.newContext({viewport:{width:1800,height:1200},deviceScaleFactor:dpr});
    const page = await context.newPage(); await page.goto(origin);
    await page.waitForFunction(()=>!!window.app);
    await page.evaluate(()=>{app.doc.showRulers=true;app._handleResize();});
    await page.locator('.toolbar-btn img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
    assert.equal(await page.locator('.toolbar-btn svg').count(),0);
    for (const scale of [1,2,3]) {
      await page.evaluate(scale=>app.screen.setScale(String(scale)),scale);
      for (const active of [false,true]) for (const [id,glyph] of Object.entries(glyphs)) {
        await page.evaluate(({id,active})=>app.toolManager.chooseTool(active?id:(id==='select'?'rect':'select')),{id,active});
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const bounds = await page.locator(`[data-tool="${id}"] img`).boundingBox();
        assert.ok(Math.abs(bounds.x*dpr-Math.round(bounds.x*dpr))<0.02,`${id} horizontal pixel alignment`);
        assert.ok(Math.abs(bounds.y*dpr-Math.round(bounds.y*dpr))<0.02,`${id} vertical pixel alignment`);
        const shot = await page.screenshot();
        const failures = await page.evaluate(async ({url,x,y,scale,rows,active,width,height})=>{
          const image = new Image(); image.src=url; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width=image.width; canvas.height=image.height;
          const ctx=canvas.getContext('2d'); ctx.drawImage(image,0,0);
          const pixels=ctx.getImageData(x,y,width*scale,height*scale).data;
          let bad=0;
          for(let yy=0;yy<height*scale;yy++)for(let xx=0;xx<width*scale;xx++){
            const ink=rows[Math.floor(yy/scale)][Math.floor(xx/scale)]==='1';
            const expected=ink===active?255:0,index=(yy*width*scale+xx)*4;
            if(pixels[index]!==expected||pixels[index+1]!==expected||pixels[index+2]!==expected||pixels[index+3]!==255)bad++;
          }
          return bad;
        },{url:`data:image/png;base64,${shot.toString('base64')}`,x:Math.round(bounds.x*dpr),y:Math.round(bounds.y*dpr),scale,rows:glyph.rows,active,width:glyph.width,height:glyph.height});
        assert.equal(failures,0,`${id}, DPR ${dpr}, scale ${scale}, active ${active}: changed source bits`); checks++;
      }
      if(dpr===1&&scale===2)await page.screenshot({path:new URL('toolbar-and-rulers.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
    }
    await context.close();
  }
  const result={checks,browser:await browser.version(),devicePixelRatios:[1,1.25,1.5,2],displayScales:[1,2,3],states:['normal','selected'],glyphs:Object.keys(glyphs)};
  await writeFile(new URL('results.json',output),JSON.stringify(result,null,2));
  console.log(`${checks} screenshot bitmap checks passed`);
} finally {await browser.close();}
