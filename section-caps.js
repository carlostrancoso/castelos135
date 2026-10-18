import * as THREE from './vendor/three.module.js';

const EPS=1e-4;
function area(points){let sum=0;for(let i=0,j=points.length-1;i<points.length;j=i++)sum+=points[j].x*points[i].y-points[i].x*points[j].y;return sum/2;}
function contains(poly,p){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}

// Reconstruct closed cross-section contours per mesh, preserving nested voids.
export function buildSection(plane,triangles){
 const axis=Math.abs(plane.normal.x)>.9?'x':Math.abs(plane.normal.y)>.9?'y':'z';
 const [u,v]=axis==='x'?['y','z']:axis==='y'?['x','z']:['x','y'];
 const groups=new Map();const lines=[];const caps=[];let closedContours=0,openContours=0;
 for(const t of triangles){
  if(t.glass)continue;
  const ds=t.points.map(p=>plane.distanceToPoint(p));
  if(ds.every(d=>d>0)||ds.every(d=>d<0))continue;
  const hits=[];
  for(let i=0;i<3;i++){const j=(i+1)%3,da=ds[i],db=ds[j];if((da<0&&db>=0)||(db<0&&da>=0)){const p=t.points[i].clone().lerp(t.points[j],da/(da-db));if(!hits.some(h=>h.distanceToSquared(p)<EPS*EPS))hits.push(p);}}
  if(hits.length!==2||hits[0].distanceToSquared(hits[1])<EPS*EPS)continue;
  for(const p of hits)lines.push(...p.clone().addScaledVector(plane.normal,-.001).toArray());
  const id=(axis==='y'&&!t.floor?(t.solidId??t.meshId):t.meshId)??'default';if(!groups.has(id))groups.set(id,[]);groups.get(id).push(hits);
 }
 for(const segments of groups.values()){
  const nodes=new Map(),edges=[],seen=new Set();
  const buckets=new Map();
  const key=p=>{const ix=Math.floor(p[u]/EPS),iy=Math.floor(p[v]/EPS);for(let x=ix-1;x<=ix+1;x++)for(let y=iy-1;y<=iy+1;y++)for(const id of buckets.get(x+','+y)||[]){const q=nodes.get(id).point;if((q.x-p[u])**2+(q.y-p[v])**2<=EPS*EPS)return id;}const id=String(nodes.size);nodes.set(id,{point:new THREE.Vector2(p[u],p[v]),edges:[]});const cell=ix+','+iy;if(!buckets.has(cell))buckets.set(cell,[]);buckets.get(cell).push(id);return id;};
  for(const [a,b]of segments){const ka=key(a),kb=key(b);if(ka===kb)continue;const edgeKey=ka<kb?ka+'|'+kb:kb+'|'+ka;if(seen.has(edgeKey))continue;seen.add(edgeKey);for(const [k,p]of [[ka,a],[kb,b]])if(!nodes.has(k))nodes.set(k,{point:new THREE.Vector2(p[u],p[v]),edges:[]});const i=edges.length;edges.push([ka,kb]);nodes.get(ka).edges.push(i);nodes.get(kb).edges.push(i);}
  const used=new Set(),loops=[];
  for(let seed=0;seed<edges.length;seed++){
   if(used.has(seed))continue;let [start,current]=edges[seed];let previous=start;const path=[nodes.get(start).point];used.add(seed);let closed=false;
   for(let count=0;count<=edges.length;count++){
    if(current===start){closed=true;break;}const n=nodes.get(current);path.push(n.point);const candidates=n.edges.filter(i=>!used.has(i));if(!candidates.length)break;
    const incoming=n.point.clone().sub(nodes.get(previous).point);let next=candidates[0],best=Infinity;
    for(const i of candidates){const other=edges[i][0]===current?edges[i][1]:edges[i][0];const outgoing=nodes.get(other).point.clone().sub(n.point);const angle=Math.abs(Math.atan2(incoming.x*outgoing.y-incoming.y*outgoing.x,incoming.dot(outgoing)));if(angle<best){best=angle;next=i;}}
    used.add(next);previous=current;current=edges[next][0]===current?edges[next][1]:edges[next][0];
   }
   if((closed||(path.length>=3&&path[0].distanceTo(path[path.length-1])<=.5))&&path.length>=3&&Math.abs(area(path))>EPS*EPS){loops.push({points:path,size:Math.abs(area(path)),parent:-1,depth:0});closedContours++;}else openContours++;
  }
  loops.sort((a,b)=>b.size-a.size);
  for(let i=0;i<loops.length;i++){let size=Infinity;for(let j=0;j<i;j++)if(loops[j].size<size&&contains(loops[j].points,loops[i].points[0])){loops[i].parent=j;size=loops[j].size;}loops[i].depth=loops[i].parent<0?0:loops[loops[i].parent].depth+1;}
  for(let i=0;i<loops.length;i++){
   const loop=loops[i];if(loop.depth%2)continue;const holes=loops.filter(l=>l.parent===i&&l.depth%2).map(l=>l.points);const points=[...loop.points,...holes.flat()];const faces=THREE.ShapeUtils.triangulateShape(loop.points,holes);
   for(const face of faces)for(const index of face){const p=new THREE.Vector3();p[axis]=-plane.constant/plane.normal[axis];p[u]=points[index].x;p[v]=points[index].y;p.addScaledVector(plane.normal,-.0005);caps.push(...p.toArray());}
  }
 }
 return {caps,lines,closedContours,openContours};
}
