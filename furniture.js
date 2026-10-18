import * as T from './vendor/three.module.js';
// Schematic volumes traced from sheet 03 of the supplied PDF; no product dimensions inferred.
export function makeFurniture(){const group=new T.Group();const objects=[];const scale=28.35;function addRect(floor,x0,y0,x1,y1,height,color=0xc7a777){const base=floor==='rc'?3.25:0;const midY=floor==='rc'?419:674;const width=Math.abs(y1-y0)/scale,depth=Math.abs(x1-x0)/scale;const mesh=new T.Mesh(new T.BoxGeometry(width,height,depth),new T.MeshStandardMaterial({color,roughness:.9}));mesh.position.set(((y0+y1)/2-midY)/scale,base+height/2+.02,19.03-((x0+x1)/2-127)/scale);mesh.userData.floor=floor;mesh.userData.furniture=true;group.add(mesh);objects.push(mesh);const edge=new T.LineSegments(new T.EdgesGeometry(mesh.geometry),new T.LineBasicMaterial({color:0x423b2c}));mesh.add(edge);return mesh;}
addRect('rc',600,373,647,426,.9); // central worktop
addRect('rc',682,369,752,395,.9); // kitchen counter
addRect('rc',590,450,626,470,.74);addRect('rc',603,473,618,482,.44); // desk and seat
addRect('rc',678,445,738,470,.42,0x9da68c);addRect('rc',678,445,738,450,.76,0x9da68c); // sofa
addRect('rc',871,356,928,385,.74);addRect('rc',945,373,956,388,.44);addRect('rc',958,365,977,400,.6); // furniture in front room
for(let i=0;i<4;i++){addRect('cave',725,641+i*17.25,749,658+i*17.25,.45,0xc7bb98);addRect('cave',770,641+i*17.25,794,658+i*17.25,.45,0xc7bb98)}
return {group,objects};}
