import * as THREE from './vendor/three.module.js';

// Approximate urban massing interpreted from the supplied orbit / street video.
// Coordinates share the normalized GLB reference frame. This is not a survey.
export function makeSurroundings(){
  const group=new THREE.Group();group.name='Envolvente esquemática';
  const buildings=[];
  const pavement=material(0x989c91),asphalt=material(0x505b55),marking=material(0xc5c6b7);
  function material(color){return new THREE.MeshStandardMaterial({color,roughness:1});}
  function box(parent,x,y,z,w,h,d,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y+h/2,z);m.receiveShadow=true;parent.add(m);return m;}
  // Street at the entrance level; open rear gardens stay at the lower ground level.
  const streetY=2.65,streetZ=-25.5;
  box(group,0,streetY-.24,streetZ,100,.24,7.2,asphalt);
  box(group,0,streetY-.08,-21.15,100,.23,1.5,pavement);
  box(group,0,streetY-.08,-29.85,100,.23,1.5,pavement);
  // Kerbs, understated centre dashes and the crossing visible beside the property.
  for(const z of [-21.94,-29.06])box(group,0,streetY-.02,z,100,.17,.12,pavement);
  for(let x=-47;x<49;x+=6)box(group,x,streetY+.008,streetZ,2.5,.012,.10,marking);
  for(let z=-28.7;z<-22;z+=.95)box(group,-10,streetY+.014,z,3.2,.015,.45,marking);
  // Low garden boundaries alongside the row; no vegetation or street clutter.
  box(group,-15,streetY,-20.28,24,1.35,.22,pavement);
  box(group,-2.95,.03,0,.2,2.7,40,pavement);
  box(group,3,.03,12,.2,2.1,15,pavement);
  box(group,-14,-.12,0,21,.10,38,material(0x424f44));
  box(group,16,-.12,14,25,.10,20,material(0x424f44));

  function building({x,z,w,d,h,roof=1.8,base=streetY,color=0x8d978c,hip=true}){
    const g=new THREE.Group();g.name='Volume envolvente';group.add(g);
    const wall=material(color),top=material(0x727f73);wall.transparent=top.transparent=true;
    box(g,x,base,z,w,h,d,wall);
    if(roof>0){
      // Hipped roofs retain only the silhouette, deliberately omitting windows / tiles.
      const xa=x-w/2,xb=x+w/2,za=z-d/2,zb=z+d/2,y=base+h;
      const inset=hip?Math.min(w*.45,d*.23):0;
      const p=[[xa,y,za],[xb,y,za],[xb,y,zb],[xa,y,zb],[x,y+roof,za+inset],[x,y+roof,zb-inset]];
      const faces=[[0,1,4],[1,2,5],[1,5,4],[2,3,5],[3,0,4],[3,4,5]];
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(faces.flatMap(f=>f.flatMap(i=>p[i])),3));geo.computeVertexNormals();
      top.side=THREE.DoubleSide;g.add(new THREE.Mesh(geo,top));
    }
    g.updateMatrixWorld(true);buildings.push({group:g,box:new THREE.Box3().setFromObject(g),materials:[wall,top],opacity:1});
  }
  // Attached houses on one side, a detached villa / garden on the other.
  for(const b of [
    {x:6,z:-11.7,w:6.1,d:17,h:6.5},
    {x:12.8,z:-12.7,w:7.4,d:15,h:7.3},
    {x:20.3,z:-13.2,w:7.5,d:14,h:7},
    {x:28.2,z:-12,w:8.2,d:16.4,h:8.3},
    {x:36.5,z:-12.4,w:8.3,d:15.6,h:6.6},
    {x:-14,z:-5.3,w:14,d:15,h:6.8,roof:2.6},
    {x:-20,z:2.7,w:6,d:8,h:5.4,roof:1.4},
    {x:-32,z:-12,w:9,d:16.4,h:8,roof:2.2},
    {x:-41,z:-12.7,w:8.5,d:15,h:7.1},
    // Across the street, the larger low building and varied neighbouring houses.
    {x:-13,z:-39,w:15,d:17,h:6.4,roof:2.5},
    {x:2,z:-38,w:12,d:15,h:7.2,roof:0,color:0x9aa096},
    {x:14,z:-37.5,w:10,d:14,h:6.7,roof:2},
    {x:24,z:-38.5,w:9,d:16,h:8.7,roof:2.2},
    {x:34,z:-37.5,w:10,d:14,h:7.1},
    {x:-29,z:-38,w:13,d:15,h:7.3},
    {x:-42,z:-37,w:10,d:13,h:6.6},
    // Small rear annexes seen in the aerial sequence.
    {x:8,z:10,w:7,d:5,h:2.7,base:0,roof:1},
    {x:21,z:8,w:8,d:6,h:3.2,base:0,roof:1.1}
  ])building(b);

  // The GLB front boundary runs approximately from (-2.64, -19.98)
  // to (2.41, -15.75) in X/Z. Lot sides stay parallel to Z while
  // frontage and street follow this oblique line: NOT a rotated square grid.
  const streetSlope=.84,frontOffset=2.60;
  const oblique=new THREE.Matrix4().set(1,0,0,0, 0,1,0,0, streetSlope,0,1,frontOffset, 0,0,0,1);
  group.updateMatrixWorld(true);
  group.traverse(o=>{
    if(!o.isMesh)return;
    // Bake the common affine transform into world-space geometry, preserving
    // verticals and the parallel longitudinal boundaries of every plot.
    o.geometry.applyMatrix4(o.matrixWorld);
    o.geometry.applyMatrix4(oblique);
    o.position.set(0,0,0);o.rotation.set(0,0,0);o.scale.set(1,1,1);
    o.geometry.computeVertexNormals();o.geometry.computeBoundingSphere();
  });
  group.updateMatrixWorld(true);
  for(const b of buildings)b.box.setFromObject(b.group);

  const ray=new THREE.Ray(),hit=new THREE.Vector3();
  const targets=[new THREE.Vector3(0,5,-16),new THREE.Vector3(0,5,-5),new THREE.Vector3(0,2,8)];
  function update(camera){
    if(!group.visible)return;
    // Foreground massing fades when it hides the project, including when the
    // visitor orbits into a neighbouring volume. The building remains readable.
    for(const b of buildings){let obstructs=b.box.containsPoint(camera.position);
      for(const target of targets){if(obstructs)break;ray.set(camera.position,target.clone().sub(camera.position).normalize());if(ray.intersectBox(b.box,hit)&&hit.distanceTo(camera.position)<target.distanceTo(camera.position))obstructs=true;}
      const goal=obstructs?.12:1;b.opacity+=(goal-b.opacity)*.16;
      for(const m of b.materials){m.opacity=b.opacity;m.depthWrite=b.opacity>.98;}
    }
  }
  return {group,buildings,update};
}
