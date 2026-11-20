import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { liveHarness } from './test-support/live-harness.js';

async function studioHarness() {
  const h=await liveHarness();
  h.elements.get('toggleCloud').onclick();
  const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
  for(const match of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    if(h.elements.has(match[2]))continue;
    const el=new h.Element(match[1],match[2]);
    el.value=match[0].match(/\bvalue="([^"]*)"/)?.[1]||'';
    el.type=match[0].match(/\btype="([^"]*)"/)?.[1]||el.type;
    el.checked=/\bchecked\b/.test(match[0]);h.elements.set(el.id,el);
  }
  for(const match of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const el=h.elements.get(match[1]);
    el.options=[...match[2].matchAll(/<option\b[^>]*\bvalue="([^"]*)"[^>]*>/g)].map(m=>({value:m[1],selected:/\bselected\b/.test(m[0])}));
    el.value=(el.options.find(o=>o.selected)||el.options[0])?.value||'';
  }
  h.document.querySelectorAll=selector=>selector==='.family'?h.elements.get('families').children:
    [...h.elements.values()].filter(el=>['INPUT','SELECT'].includes(el.tagName));
  for(const id of ['art','motionCanvas','imageEditor'])h.elements.get(id).width=h.elements.get(id).height=1024;
  h.sandbox.addEventListener=()=>{};
  vm.runInContext(await readFile(new URL('./studio-1.js',import.meta.url),'utf8'),h.context);
  vm.runInContext(await readFile(new URL('./thread-motion.js',import.meta.url),'utf8'),h.context);
  return h;
}

test('live settings skip studio drawing, refresh labels, and redraw the current composition on return',async()=>{
  const h=await studioHarness();const revision=h.sandbox.loomFrame.revision;
  h.elements.get('toggleCloud').onclick();
  h.elements.get('density').value='38';h.elements.get('density').dispatchEvent(new Event('input'));h.tick(34);
  assert.equal(h.sandbox.loomFrame.revision,revision);assert.equal(h.elements.get('densityVal').textContent,38);
  h.elements.get('toggleCloud').onclick();assert.ok(h.sandbox.loomFrame.revision>revision);assert.equal(h.sandbox.loomFrame.cells.length,38*38);
  h.cleanup();
});

test('explicit snapshots render the latest studio state even when the live canvas is active',async()=>{
  const h=await studioHarness();h.elements.get('toggleCloud').onclick();h.elements.get('density').value='40';
  h.sandbox.loom.render();const revision=h.sandbox.loomFrame.revision;
  h.sandbox.loom.render(true);assert.ok(h.sandbox.loomFrame.revision>revision);assert.equal(h.sandbox.loomFrame.cells.length,1600);h.cleanup();
});

test('motion can seek, loop, change settings and finish without CPU canvas readback',async()=>{
  const h=await studioHarness();let events=0;h.document.addEventListener('loommotion',()=>events++);
  const {loomMotion}=h.sandbox;
  for(const p of [0,.2,.5,.8,.1,.6,.99,1,0,.7]) {
    const result=loomMotion.drawAt(p);
    assert.equal(result.total,96*96);assert.ok(result.active>=0&&result.active<=result.total);
    assert.ok(result.complete>=0&&result.complete<=result.total);
    if(p===1)assert.equal(result.active,0);
  }
  assert.equal(events,1);assert.equal(h.readbacks,0);
  h.elements.get('motionDirection').value='left';assert.ok(loomMotion.drawAt(.5).active>0);
  h.cleanup();
});
