import test from 'node:test';
import assert from 'node:assert/strict';

const api = await import('./edge-routing.js').catch(e => {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
  return {};
});
const rect = (cx, cy, w = 100, h = 60) => ({ cx, cy, w, h });
const box = r => ({ x: r.cx-r.w/2+1e-5, y: r.cy-r.h/2+1e-5, w:r.w-2e-5, h:r.h-2e-5 });
function route(...args) {
  assert.equal(typeof api.routeEdge, 'function', 'routeEdge export exists');
  return api.routeEdge(...args);
}
function valid(r) {
  assert.match(r.d, /^M/);
  assert.ok(!/NaN|Infinity/.test(r.d));
  assert.deepEqual(r.points[0], r.start);
  assert.deepEqual(r.points.at(-1), r.end);
  assert.ok(r.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
  assert.ok(Number.isFinite(r.length) && Number.isFinite(r.endAngle));
  let length = 0;
  const lengths = r.points.slice(1).map((p,i) => {
    const d = Math.hypot(p.x-r.points[i].x,p.y-r.points[i].y); length += d; return d;
  });
  assert.ok(Math.abs(length-r.length)<1e-6);
  let remaining = length/2;
  for (let i=0;i<lengths.length;i++) {
    if (remaining <= lengths[i] && lengths[i]) {
      const t=remaining/lengths[i], a=r.points[i], b=r.points[i+1];
      assert.ok(Math.hypot(r.label.x-a.x-(b.x-a.x)*t,r.label.y-a.y-(b.y-a.y)*t)<1e-6);
      break;
    }
    remaining -= lengths[i];
  }
}
function avoids(r, obstacles) {
  for (const o of obstacles) {
    const b=box(o);
    assert.ok(r.points.every(p => !(p.x>b.x && p.x<b.x+b.w && p.y>b.y && p.y<b.y+b.h)), 'sample enters obstacle');
    assert.equal(api.routeIntersectsRect(r,b),false,'segment enters obstacle');
  }
}
for (const [name,to,start,end,angle] of [
  ['right',rect(300,400),{x:50,y:0},{x:250,y:400},0],
  ['left',rect(-300,400),{x:-50,y:0},{x:-250,y:400},Math.PI],
  ['down',rect(20,300),{x:0,y:30},{x:20,y:270},Math.PI/2],
  ['up',rect(20,-300),{x:0,y:-30},{x:20,y:-270},-Math.PI/2],
]) test(`facing midpoint and normal tangent: ${name}`,()=>{
  const r=route(rect(0,0),to); valid(r);
  assert.deepEqual(r.start,start); assert.deepEqual(r.end,end);
  assert.ok(Math.abs(Math.cos(r.endAngle)-Math.cos(angle))<1e-9);
  assert.ok(Math.abs(Math.sin(r.endAngle)-Math.sin(angle))<1e-9);
  assert.match(r.d,/C/); avoids(r,[rect(0,0),to]);
});
test('seven-child fanout stays out of all card interiors across 70px gap',()=>{
  const root=rect(265,447,210,74);
  const children=[97,249,357,487,617,747,877].map((y,i)=>rect(545,y,210,[74,98,82,110,90,102,74][i]));
  for(const child of children) {
    const r=route(root,child,children.filter(c=>c!==child)); valid(r);
    assert.deepEqual(r.start,{x:370,y:447}); assert.deepEqual(r.end,{x:440,y:child.cy});
    avoids(r,[root,...children]);
  }
});
test('blocking card forces rounded detour with normal endpoint segments',()=>{
  const a=rect(0,0),b=rect(400,0),obstacle=rect(200,0,100,160);
  const r=route(a,b,[obstacle]); valid(r); avoids(r,[a,b,obstacle]); assert.match(r.d,/Q/);
  assert.equal(r.points[1].y,0); assert.ok(r.points[1].x>50);
  assert.equal(r.points.at(-2).y,0); assert.ok(r.points.at(-2).x<350);
});
test('group backgrounds ignored; endpoint members ignored; other cards block',()=>{
  assert.equal(typeof api.buildEdgeRoutes,'function');
  const nodes=new Map([['member',{id:'member',x:0,y:0}],['target',{id:'target',x:400,y:0}],['block',{id:'block',x:200,y:-50}]]);
  const groups=new Map([['g',{id:'g',x:-20,y:-20,w:140,h:100}],['background',{id:'background',x:130,y:-200,w:250,h:400}]]);
  const sizeOf=()=>({w:100,h:60});
  const edge={id:'e',from:'g',fromKind:'group',to:'target'};
  const r=api.buildEdgeRoutes([edge],nodes,groups,sizeOf).get('e'); valid(r);
  assert.deepEqual(r.start,{x:120,y:30}); avoids(r,[rect(250,-20)]);
  const withoutMember=api.buildEdgeRoutes([edge],new Map([...nodes].filter(([id])=>id!=='member')),new Map([['g',groups.get('g')]]),sizeOf).get('e');
  assert.deepEqual(r,withoutMember);
});
test('malformed and missing endpoints are skipped without throwing',()=>{
  assert.equal(typeof api.buildEdgeRoutes,'function');
  const nodes=new Map([['a',{x:0,y:0}],['b',{x:200,y:0}],['bad',{x:NaN,y:0}],['size',{x:0,y:0}]]);
  const edges=[null,{}, {id:'missing',from:'a',to:'none'},{id:'bad',from:'bad',to:'a'},{id:'size',from:'size',to:'a'},{id:'ok',from:'a',to:'b'}];
  const routes=api.buildEdgeRoutes(edges,nodes,new Map(),id=>id==='size'?null:{w:100,h:60});
  assert.deepEqual([...routes.keys()],['ok']);
});
test('negative, near-touching, overlapping and trapped geometry stays finite and deterministic',()=>{
  for (const [a,b,obs] of [[rect(-400,-300),rect(-200,-100),[]],[rect(0,0),rect(100.001,0),[]],[rect(0,0),rect(10,10),[]],[rect(0,0),rect(0,0),[]],[rect(0,0),rect(400,0),[rect(0,0,1000,1000)]]]) {
    const r=route(a,b,obs);valid(r);assert.deepEqual(r,route(a,b,obs));assert.ok(r.points.length<=4097);
  }
});
test('dense impossible layout has bounded work',()=>{
  const obs=Array.from({length:300},(_,i)=>rect(150+i,0,200,400));
  const start=performance.now();const r=route(rect(0,0),rect(700,0),obs);valid(r);
  assert.ok(performance.now()-start<2000); assert.deepEqual(r,route(rect(0,0),rect(700,0),obs));
});
test('distant cards do not disable routing around a local blocker on a large board',()=>{
  const a=rect(0,0),b=rect(400,0),block=rect(200,0,100,160);
  const distant=Array.from({length:100},(_,i)=>rect(1000+i*150,1000));
  const r=route(a,b,[block,...distant]);
  valid(r); avoids(r,[a,b,block,...distant]);
});
test('marquee follows curve rather than endpoint chord and includes boundary contact',()=>{
  const r=route(rect(0,0),rect(400,300));
  assert.equal(api.routeIntersectsRect(r,{x:123,y:73,w:4,h:4}),false);
  const p=r.points[Math.floor(r.points.length/4)];
  assert.equal(api.routeIntersectsRect(r,{x:p.x-2,y:p.y-2,w:4,h:4}),true);
  assert.equal(api.routeIntersectsRect(r,{x:50,y:0,w:0,h:0}),true);
  assert.equal(api.routeIntersectsRect(r,{x:-1000,y:-1000,w:1,h:1}),false);
});
