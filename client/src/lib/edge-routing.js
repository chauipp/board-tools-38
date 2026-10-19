const EPS = 1e-7;
const validRect = r => r && ['cx', 'cy', 'w', 'h'].every(k => Number.isFinite(r[k]) && Math.abs(r[k]) <= 1e9) && r.w > 0 && r.h > 0;
const bounds = (r, pad = 0) => ({ x: r.cx-r.w/2-pad, y: r.cy-r.h/2-pad, w:r.w+2*pad, h:r.h+2*pad });
const distance = (a,b) => Math.hypot(b.x-a.x,b.y-a.y);
const lerp = (a,b,t) => ({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const xy = p => `${p.x} ${p.y}`;

function intersects(a,b,r) {
  let lo=0, hi=1;
  for (const [key,width] of [['x','w'],['y','h']]) {
    const delta=b[key]-a[key];
    if (delta===0) { if(a[key]<r[key] || a[key]>r[key]+r[width]) return false; }
    else {
      const t1=(r[key]-a[key])/delta, t2=(r[key]+r[width]-a[key])/delta;
      lo=Math.max(lo,Math.min(t1,t2)); hi=Math.min(hi,Math.max(t1,t2));
      if(lo>hi) return false;
    }
  }
  return true;
}

export function routeIntersectsRect(route, rect) {
  if (!route?.points?.length || !rect || !['x','y','w','h'].every(k=>Number.isFinite(rect[k]))) return false;
  const r={x:Math.min(rect.x,rect.x+rect.w),y:Math.min(rect.y,rect.y+rect.h),w:Math.abs(rect.w),h:Math.abs(rect.h)};
  const b=route.bounds;
  if(b && (b.maxX<r.x || b.minX>r.x+r.w || b.maxY<r.y || b.minY>r.y+r.h))return false;
  return route.points.some((p,i)=>intersects(i ? route.points[i-1] : p,p,r));
}

function finish(d,points,endAngle) {
  const lengths=points.slice(1).map((p,i)=>distance(points[i],p));
  const length=lengths.reduce((sum,n)=>sum+n,0);
  let remaining=length/2, label=points[0];
  for(let i=0;i<lengths.length;i++) {
    if(lengths[i] && remaining<=lengths[i]) {label=lerp(points[i],points[i+1],remaining/lengths[i]);break;}
    remaining-=lengths[i];
  }
  const bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(const p of points) {
    bounds.minX=Math.min(bounds.minX,p.x);bounds.minY=Math.min(bounds.minY,p.y);
    bounds.maxX=Math.max(bounds.maxX,p.x);bounds.maxY=Math.max(bounds.maxY,p.y);
  }
  return {d,points,start:points[0],end:points.at(-1),label,length,endAngle,bounds};
}

function cubic(start,c1,c2,end,angle) {
  const count=Math.min(2048,Math.max(32,Math.ceil((distance(start,c1)+distance(c1,c2)+distance(c2,end))/2)));
  const points=[start];
  for(let i=1;i<count;i++) {
    const t=i/count;
    points.push(lerp(lerp(lerp(start,c1,t),lerp(c1,c2,t),t),lerp(lerp(c1,c2,t),lerp(c2,end,t),t),t));
  }
  points.push(end);
  return finish(`M ${xy(start)} C ${xy(c1)} ${xy(c2)} ${xy(end)}`,points,angle);
}

function rounded(path,angle) {
  const simple=[];
  for(const p of path) {
    if(simple.length && distance(simple.at(-1),p)<EPS) continue;
    while(simple.length>1) {
      const a=simple.at(-2),b=simple.at(-1);
      if((b.x-a.x)*(p.y-b.y)!==(b.y-a.y)*(p.x-b.x)) break;
      simple.pop();
    }
    simple.push(p);
  }
  const points=[simple[0]];let d=`M ${xy(simple[0])}`;
  for(let i=1;i<simple.length-1;i++) {
    const a=simple[i-1],b=simple[i],c=simple[i+1];
    const radius=Math.min(4,distance(a,b)/3,distance(b,c)/3);
    const entry=lerp(b,a,radius/distance(a,b)),exit=lerp(b,c,radius/distance(b,c));
    d+=` L ${xy(entry)} Q ${xy(b)} ${xy(exit)}`;
    points.push(entry);
    for(let j=1;j<=8;j++) points.push(lerp(lerp(entry,b,j/8),lerp(b,exit,j/8),j/8));
  }
  d+=` L ${xy(simple.at(-1))}`;points.push(simple.at(-1));
  return finish(d,points,angle);
}

function visibility(start,end,obstacles) {
  if(obstacles.length>50) return null;
  const xs=[start.x,end.x],ys=[start.y,end.y];
  for(const r of obstacles) { xs.push(r.x-8,r.x+r.w+8);ys.push(r.y-8,r.y+r.h+8); }
  const x=[...new Set(xs)].sort((a,b)=>a-b),y=[...new Set(ys)].sort((a,b)=>a-b);
  const width=x.length,total=width*y.length;
  const point=i=>({x:x[i%width],y:y[Math.floor(i/width)]});
  const index=p=>y.indexOf(p.y)*width+x.indexOf(p.x);
  const source=index(start),target=index(end);
  const costs=new Float64Array(total).fill(Infinity),previous=new Int32Array(total).fill(-1),closed=new Uint8Array(total);
  const heap=[];
  function push(item) {
    heap.push(item);let i=heap.length-1;
    while(i) {const parent=(i-1)>>1;if(heap[parent][0]<=item[0])break;heap[i]=heap[parent];i=parent;}heap[i]=item;
  }
  function pop() {
    const first=heap[0],last=heap.pop();
    if(heap.length) {let i=0;while(i*2+1<heap.length) {let child=i*2+1;if(child+1<heap.length && heap[child+1][0]<heap[child][0])child++;if(heap[child][0]>=last[0])break;heap[i]=heap[child];i=child;}heap[i]=last;}
    return first[1];
  }
  costs[source]=0;push([0,source]);
  while(heap.length) {
    const i=pop();if(closed[i])continue;if(i===target) {
      const path=[];for(let j=i;j!==-1;j=previous[j])path.push(point(j));return path.reverse();
    }
    closed[i]=1;const a=point(i),col=i%width,row=Math.floor(i/width);
    const neighbors=[col>0?i-1:-1,col<width-1?i+1:-1,row>0?i-width:-1,row<y.length-1?i+width:-1];
    for(const j of neighbors) {
      if(j<0 || closed[j])continue;
      const b=point(j),cost=costs[i]+distance(a,b);
      if(cost>=costs[j] || obstacles.some(r=>intersects(a,b,r)))continue;
      costs[j]=cost;previous[j]=i;push([cost+distance(b,end),j]);
    }
  }
  return null;
}

export function routeEdge(fromRect,toRect,obstacleRects=[]) {
  const a=validRect(fromRect)?fromRect:{cx:0,cy:0,w:1,h:1};
  const b=validRect(toRect)?toRect:{cx:0,cy:0,w:1,h:1};
  const dx=b.cx-a.cx,dy=b.cy-a.cy;
  const horizontal=Math.abs(dx)>=(a.w+b.w)/2 || (Math.abs(dy)<(a.h+b.h)/2 && Math.abs(dx)>=Math.abs(dy));
  const sign=(horizontal?dx:dy)<0?-1:1;
  const normal=horizontal?{x:sign,y:0}:{x:0,y:sign};
  const start={x:a.cx+normal.x*a.w/2,y:a.cy+normal.y*a.h/2};
  const end={x:b.cx-normal.x*b.w/2,y:b.cy-normal.y*b.h/2};
  const gap=horizontal?Math.abs(end.x-start.x):Math.abs(end.y-start.y);
  const handle=Math.max(0.0001,Math.min(120,gap/2));
  const c1={x:start.x+normal.x*handle,y:start.y+normal.y*handle};
  const c2={x:end.x-normal.x*handle,y:end.y-normal.y*handle};
  const angle=Math.atan2(normal.y,normal.x);
  const candidate=cubic(start,c1,c2,end,angle);
  const obstacles=[a,b,...(Array.isArray(obstacleRects)?obstacleRects.filter(validRect):[])].map(r=>bounds(r,-EPS));
  if(!obstacles.some(r=>routeIntersectsRect(candidate,r)))return candidate;
  const stub=Math.min(12,handle);
  const s={x:start.x+normal.x*stub,y:start.y+normal.y*stub},t={x:end.x-normal.x*stub,y:end.y-normal.y*stub};
  if(obstacles.some(r=>intersects(start,s,r)||intersects(t,end,r)))return candidate;
  const active=new Set(obstacles.filter(r=>routeIntersectsRect(candidate,r)));
  active.add(obstacles[0]);active.add(obstacles[1]);
  while(active.size<=50) {
    const path=visibility(s,t,[...active]);
    if(!path)return candidate;
    const result=rounded([start,...path,end],angle);
    const blocked=obstacles.filter(r=>routeIntersectsRect(result,r));
    if(!blocked.length)return result;
    const previousSize=active.size;
    blocked.forEach(r=>active.add(r));
    if(active.size===previousSize)return candidate;
  }
  return candidate;
}

export function buildEdgeRoutes(edges,nodeById,groupById,sizeOf) {
  const nodes=nodeById instanceof Map?nodeById:new Map((nodeById||[]).map(n=>[n.id,n]));
  const groups=groupById instanceof Map?groupById:new Map((groupById||[]).map(g=>[g.id,g]));
  const nodeRects=new Map(),groupRects=new Map();
  function toRect(item,size) {
    if(!item || !size || !Number.isFinite(item.x) || !Number.isFinite(item.y))return null;
    const r={cx:item.x+size.w/2,cy:item.y+size.h/2,w:size.w,h:size.h};return validRect(r)?r:null;
  }
  for(const [id,n] of nodes) {
    try {const r=toRect(n,sizeOf(id));if(r)nodeRects.set(id,r);} catch {continue;}
  }
  for(const [id,g] of groups) {const r=toRect(g,g);if(r)groupRects.set(id,r);}
  const contains=(g,n)=>n.cx-n.w/2>=g.cx-g.w/2 && n.cx+n.w/2<=g.cx+g.w/2 && n.cy-n.h/2>=g.cy-g.h/2 && n.cy+n.h/2<=g.cy+g.h/2;
  const routes=new Map();
  for(const edge of edges||[]) {
    if(!edge || edge.id==null)continue;
    const fromKind=edge.fromKind||'node',toKind=edge.toKind||'node';
    if(!['node','group'].includes(fromKind)||!['node','group'].includes(toKind))continue;
    const a=(fromKind==='group'?groupRects:nodeRects).get(edge.from),b=(toKind==='group'?groupRects:nodeRects).get(edge.to);
    if(!a||!b)continue;
    const obstacles=[...nodeRects.values()].filter(n=>n!==a && n!==b && !(fromKind==='group' && contains(a,n)) && !(toKind==='group' && contains(b,n)));
    routes.set(edge.id,routeEdge(a,b,obstacles));
  }
  return routes;
}
