import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {makeFurniture} from './furniture.js';
import publishedViews from './view-presets.js';
import {buildSection} from './section-caps.js';
import {makeSurroundings} from './surroundings.js';
import {makePlanting} from './planting.js';
import {applyMetalGrating, gratingDoorProxy} from './metal-grating.js';
const $=id=>document.getElementById(id);
const stage=$('stage');const scene=new THREE.Scene();scene.background=new THREE.Color('#303c35');
let renderer,camera,controls,perspective,ortho,model,ground,ready=false,isPlan=false,tween=null,activeView=0,frameSize=42,mode="perspective",furniture,planPaper,surroundings,planting;
const modelMeshes=[],edgeObjects=[],triangles=[],sectionObjects=[],markers=[];let bounds,center,worldMatrix;
let sectionAxis='x';
let clipMotion=null,activePlanes=[];
const cuts={y:{title:'Altura',enabled:false,flip:false,value:6.2,min:-.3,max:12},x:{title:'Longitudinal',enabled:false,flip:false,value:0,min:-5,max:5},z:{title:'Transversal',enabled:false,flip:false,value:0,min:-22,max:22}};
const views=[
 {name:'Conjunto',short:'Conjunto',overview:true},
 {name:'Entrada',short:'Entrada',pos:[-2.8,4.7,-21.5],target:[-1.35,4.7,-13],pin:[-2,4.2,-13.4]},
 {name:'Quarto - R/C',short:'Quarto - R/C',pos:[1.5,4.85,.2],target:[2.65,4.85,6.2],pin:[1.5,4.1,.2]},
 {name:'Fachada Tardoz',short:'Fachada Tardoz',pos:[4.3,4.7,12.8],target:[2.35,4.7,4.8],pin:[4,4.1,11]},
 {name:'Sala/Cozinha',short:'Sala/Cozinha',pos:[2.15,1.65,1],target:[3.15,1.65,6.5],pin:[2.15,1,1]},
 {name:'Quarto - Cave',short:'Quarto - Cave',pos:[3.2,4.65,7.7],target:[2.4,4.65,3],pin:[3.2,3.9,7.7]}
];
const renders = {
  1: {src: './assets/render-01.jpg', alt: 'Fachada da entrada com grelha metálica e bicicletas'},
  4: {src: './assets/render-04.png', alt: 'Vista da cozinha para o pátio com oliveira'},
  5: {src: './assets/render-05.png', alt: 'Banheira com vista para o pátio com ácer japonês'},
};
const renderDialog = $('render-dialog');
const renderImage = $('render-image');
const renderError = $('render-error');
renderImage.addEventListener('load', () => { renderError.hidden = true; });
renderImage.addEventListener('error', () => { renderError.hidden = false; });

const cameraButtons = views.map((view, i) => {
  const number = String(i).padStart(2, '0');
  const cell = document.createElement('div');
  cell.className = 'camera-cell';
  const button = document.createElement('button');
  button.innerHTML = '<span>' + number + '</span>' + view.short;
  button.onclick = () => goView(i);
  button.disabled = true;
  cell.append(button);

  const render = renders[i];
  if (render) {
    const renderButton = document.createElement('button');
    renderButton.className = 'render-button';
    renderButton.textContent = 'Ver render';
    renderButton.setAttribute('aria-label', 'Ver render · ' + view.name);
    renderButton.setAttribute('aria-haspopup', 'dialog');
    renderButton.onclick = () => {
      $('render-title').textContent = number + ' · ' + view.name;
      renderError.hidden = true;
      renderImage.alt = render.alt;
      renderImage.src = render.src;
      renderDialog.showModal();
    };
    cell.append(renderButton);
  }

  $('camera-list').append(cell);
  return button;
});
for(const axis of ['x','z']){const c=cuts[axis];const row=document.createElement('div');row.className='cut';row.id='cut-'+axis;row.hidden=true;row.innerHTML=`<div class="cut-head"><label for="range-${axis}">${c.title}</label><button id="flip-${axis}" aria-label="Inverter corte ${c.title.toLowerCase()}" title="Inverter lado visível">⇄</button></div><div class="slider-line"><input id="range-${axis}" aria-label="Posição do corte ${c.title.toLowerCase()}" type="range" min="${c.min}" max="${c.max}" step="0.02" value="${c.value}" disabled><output id="value-${axis}"></output></div>`;$('sliders').append(row);$('range-'+axis).onpointerdown=stopClipping;$('range-'+axis).oninput=e=>{stopClipping();c.value=+e.target.value;applyCuts()};$('flip-'+axis).onclick=()=>{if(!c.enabled)return;stopClipping();c.flip=!c.flip;applyCuts()}}

function status(text){$('status').textContent=text}
function syncCutUI(){for(const a of ['x','z']){const c=cuts[a];$('range-'+a).disabled=!c.enabled;$('range-'+a).value=c.value;$('range-'+a).min=c.min;$('range-'+a).max=c.max;$('value-'+a).value=c.value.toFixed(2)+' m';$('cut-'+a).hidden=!c.enabled;$('flip-'+a).setAttribute('aria-pressed',String(c.flip));$('flip-'+a).style.background=c.flip?'#ad815b44':''}for(const b of document.querySelectorAll('[data-cut]')){const selected=b.dataset.cut==='long'?cuts.x.enabled:b.dataset.cut==='cross'?cuts.z.enabled:!cuts.x.enabled&&!cuts.z.enabled;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected))}}

function planeFor(axis,c){const n=new THREE.Vector3();n[axis]=c.flip?1:-1;return new THREE.Plane(n,c.flip?-c.value:c.value)}
let sectionFrame;
function applyCuts(){syncCutUI();if(!ready)return;const planes=Object.entries(cuts).filter(([,c])=>c.enabled).map(([a,c])=>planeFor(a,c));activePlanes=planes;for(const mesh of modelMeshes){mesh.material.clippingPlanes=planes;mesh.material.needsUpdate=true}for(const e of edgeObjects){e.material.clippingPlanes=planes;e.material.needsUpdate=true}cancelAnimationFrame(sectionFrame);sectionFrame=requestAnimationFrame(()=>updateSections(planes));status(planes.length?planes.length+' corte'+(planes.length>1?'s ativos':' ativo')+' · ajuste os sliders':'Modelo completo');}
function updateSections(planes){for(const o of sectionObjects){scene.remove(o);o.geometry.dispose();o.material.dispose()}sectionObjects.length=0;for(const plane of planes){const section=buildSection(plane,triangles);const otherPlanes=planes.filter(p=>p!==plane);const visible=!(isPlan&&$('plan-source').value==='pdf');for(const [positions,isCap]of [[section.caps,true],[section.lines,false]]){if(!positions.length)continue;const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const options={color:0x000000,clippingPlanes:otherPlanes,depthTest:true,toneMapped:false};const mat=isCap?new THREE.MeshBasicMaterial({...options,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}):new THREE.LineBasicMaterial(options);const object=isCap?new THREE.Mesh(geo,mat):new THREE.LineSegments(geo,mat);object.renderOrder=isCap?3:4;object.visible=visible;scene.add(object);sectionObjects.push(object)}}}

function cameraMode(plan){isPlan=plan;tween=null;const previousTarget=controls?.target.clone()||center?.clone()||new THREE.Vector3();controls?.dispose();camera=plan?ortho:perspective;controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(previousTarget);controls.enableDamping=true;controls.dampingFactor=.1;controls.minDistance=.15;controls.maxDistance=140;controls.minZoom=.25;controls.maxZoom=30;controls.enableRotate=!plan;controls.screenSpacePanning=true;controls.minPolarAngle=plan?0:.38;controls.maxPolarAngle=plan?Math.PI:2.65;if(plan){controls.mouseButtons.LEFT=THREE.MOUSE.PAN;controls.touches.ONE=THREE.TOUCH.PAN}controls.addEventListener('start',()=>{tween=null});$('plan').classList.toggle('active',plan);$('perspective').classList.toggle('active',!plan);$('plan').setAttribute('aria-pressed',String(plan));$('perspective').setAttribute('aria-pressed',String(!plan));$('plan-options').hidden=!plan;$('projection-name').textContent=plan?'PLANTA ORTOGRÁFICA':'PERSPETIVA';resize();}
function overviewPosition(){const mobile=stage.clientWidth<500;return new THREE.Vector3(mobile?38:30,mobile?34:27,mobile?-40:-32)}
function fly(pos,target){remindInteraction();tween={start:performance.now(),from:camera.position.clone(),to:pos.clone(),fromTarget:controls.target.clone(),target:target.clone(),duration:matchMedia('(prefers-reduced-motion:reduce)').matches?0:1100}}
function highlight(i){activeView=i;cameraButtons.forEach((b,j)=>{b.classList.toggle('active',j===i);b.setAttribute('aria-pressed',String(j===i))});markers.forEach(m=>m.el.classList.toggle('active',m.index===i))}
function resetCuts(){stopClipping();for(const c of Object.values(cuts)){c.enabled=false;c.flip=false}applyCuts()}
function setMode(next){mode=next;cameraMode(next==='plan');$('sections').classList.toggle('active',next==='sections');$('perspective').classList.toggle('active',next==='perspective');$('cut-section').hidden=next!=='sections';$('projection-name').textContent=next==='plan'?'PLANTA':next==='sections'?'CORTE PERSPETIVADO':'PERSPETIVA';showPlanContent();}
function goView(i){if(!ready)return;setMode('perspective');resetCuts();const v=views[i];highlight(i);$('view-name').textContent=v.name;const cfg=v.defaultConfig;perspective.fov=cfg.fov;perspective.updateProjectionMatrix();fly(new THREE.Vector3(...cfg.position),new THREE.Vector3(...cfg.target));status('R/C + cave · sem cortes');}
function showPlanContent(){if(!ready)return;syncSurroundings();const paper=isPlan&&$('plan-source').value==='pdf';model.visible=!paper;planting.visible=mode==='perspective';ground.visible=!paper;furniture.group.visible=isPlan&&!paper;furniture.objects.forEach(o=>o.visible=o.userData.floor===$('plan-floor').value);if(planPaper){planPaper.visible=paper;planPaper.material.map=paperTextures[$('plan-floor').value];planPaper.material.needsUpdate=true;}scene.background.set(paper?'#e4e6df':'#303c35');for(const o of sectionObjects)o.visible=!paper;resize();}
function planView(){if(!ready)return;setMode('plan');resetCuts();cuts.y.enabled=true;cuts.y.value=$('plan-floor').value==='cave'?1.4:4.5;applyCuts();highlight(-1);ortho.zoom=1;const target=new THREE.Vector3(0,0,0);ortho.position.set(0,70,0);controls.target.copy(target);orientPlan();ortho.lookAt(target);ortho.updateProjectionMatrix();$('view-name').textContent='Planta · '+$('plan-floor').selectedOptions[0].textContent;controls.update();showPlanContent();status($('plan-source').value==='pdf'?'Planta mobilada original · folha 03 do PDF':'Mobiliário esquemático baseado na planta do PDF');remindInteraction();}
function orientPlan(){ortho.up.set(...(stage.clientWidth>640?[-1,0,0]:[0,0,-1]));}
function sectionPosition(){return sectionAxis==='z'?new THREE.Vector3(0,10,-38):new THREE.Vector3(39,11,-7)}
function stopClipping(){const wasMoving=clipMotion!==null;clipMotion=null;if(wasMoving&&ready)status("Corte manual · ajuste o slider");}
function startClipping(axis){let min=Infinity,max=-Infinity;for(const t of triangles)for(const p of t.points){min=Math.min(min,p[axis]);max=Math.max(max,p[axis])}min+=.05;max-=.05;if(axis==='x')max=Math.min(max,2.2);cuts[axis].value=axis==='z'?min:max;applyCuts();clipMotion={axis,min,max,start:performance.now()+1100,period:40000,lastSection:0};status('Varrimento automático · mova o slider para parar');}
function animateClipping(now){if(!clipMotion||mode!=='sections')return;const motion=clipMotion;if(motion.pausedAt||now-motion.lastSection<33)return;const elapsed=Math.max(0,now-motion.start),phase=(elapsed%motion.period)/motion.period;const wave=(1-Math.cos(phase*Math.PI*2))/2;const c=cuts[motion.axis];c.value=motion.axis==='z'?motion.min+(motion.max-motion.min)*wave:motion.max-(motion.max-motion.min)*wave;for(const p of activePlanes)if(p.normal[motion.axis]!==0)p.constant=c.flip?-c.value:c.value;$('range-'+motion.axis).value=c.value;$('value-'+motion.axis).value=c.value.toFixed(2)+' m';updateSections(activePlanes);motion.lastSection=now;}
document.addEventListener('visibilitychange',()=>{if(!clipMotion)return;if(document.hidden)clipMotion.pausedAt=performance.now();else if(clipMotion.pausedAt){clipMotion.start+=performance.now()-clipMotion.pausedAt;clipMotion.pausedAt=null}});
function completeView(){stopClipping();setMode('sections');resetCuts();highlight(0);$('view-name').textContent='Conjunto';const cfg=views[0].defaultConfig;perspective.fov=cfg.fov;perspective.updateProjectionMatrix();fly(new THREE.Vector3(...cfg.position),new THREE.Vector3(...cfg.target));status('Vista completa · fachada principal');}
function sectionsView(axis='x'){if(!ready)return;sectionAxis=axis;setMode('sections');resetCuts();cuts[axis].enabled=true;cuts[axis].flip=axis==='z';cuts[axis].value=axis==='z'?Math.min(cuts.z.max,cuts.z.min+.25):0;applyCuts();highlight(-1);perspective.fov=45;perspective.updateProjectionMatrix();const pos=sectionPosition();fly(pos,new THREE.Vector3(0,2.7,0));$('view-name').textContent=axis==='z'?'Corte transversal':'Corte longitudinal';startClipping(axis);}
function fit(){if(!ready)return;if(isPlan){ortho.zoom=1;ortho.position.set(0,70,0);controls.target.set(0,0,0);orientPlan();ortho.updateProjectionMatrix()}else if(mode==='sections'&&(cuts.x.enabled||cuts.z.enabled)){fly(sectionPosition(),new THREE.Vector3(0,2.7,0));}else{highlight(0);$('view-name').textContent='Conjunto';const cfg=views[0].defaultConfig;perspective.fov=cfg.fov;perspective.updateProjectionMatrix();fly(new THREE.Vector3(...cfg.position),new THREE.Vector3(...cfg.target))}}
$('perspective').onclick=()=>{if(!ready)return;setMode('perspective');resetCuts();fit();status('R/C + cave · sem cortes')};$('sections').onclick=()=>sectionsView();$('plan').onclick=planView;$('plan-floor').onchange=planView;$('plan-source').onchange=planView;$('fit').onclick=fit;
$('reset').onclick=()=>{if(!ready)return;for(const c of Object.values(cuts)){c.enabled=false;c.flip=false}cuts.y.value=6.2;cuts.x.value=0;cuts.z.value=0;$('markers').checked=true;$('surroundings').checked=true;syncSurroundings();edgeObjects.forEach(e=>e.visible=true);modelMeshes.filter(m=>m.userData.glass).forEach(m=>m.visible=true);applyCuts();goView(0)};
for(const b of document.querySelectorAll('[data-cut]'))b.onclick=()=>{if(!ready)return;const key=b.dataset.cut;if(key==='none'){completeView();return}sectionsView(key==='cross'?'z':'x')};
$('help').onclick=()=>{$('help-panel').hidden=!$('help-panel').hidden};$('close-help').onclick=()=>{$('help-panel').hidden=true};$('panel-toggle').onclick=()=>{const collapsed=$('panel').classList.toggle('collapsed');$('panel-toggle').setAttribute('aria-expanded',String(!collapsed))};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else status('Ecrã inteiro indisponível neste navegador.')}catch{status('Não foi possível abrir em ecrã inteiro.')}};
function syncSurroundings(){if(!surroundings)return;surroundings.group.visible=$('surroundings').checked&&mode==='perspective';$('context-note').textContent=mode==='perspective'?'Volumes aproximados a partir do vídeo.':'Oculta nas plantas e cortes.';}
$('surroundings').onchange=()=>{syncSurroundings();};
$('context-view').onclick=()=>{if(!ready)return;$('surroundings').checked=true;setMode('perspective');resetCuts();highlight(-1);perspective.fov=52;perspective.updateProjectionMatrix();fly(new THREE.Vector3(43,38,-65),new THREE.Vector3(0,4,-9));$('view-name').textContent='Envolvente · Rua dos Castelos';status('Envolvente esquemática · arraste para explorar');};
function zoom(factor){if(!ready)return;remindInteraction();tween=null;if(isPlan){camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,.25,30);camera.updateProjectionMatrix()}else camera.position.sub(controls.target).multiplyScalar(1/factor).add(controls.target)}$('zoom-in').onclick=()=>zoom(1.3);$('zoom-out').onclick=()=>zoom(1/1.3);
function resize(){if(!renderer||!camera)return;const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;const aspect=w/h;perspective.aspect=aspect;perspective.updateProjectionMatrix();const halfH=isPlan&&w>640?Math.max(4,frameSize/2/aspect):Math.max(frameSize/2,4/aspect);if(isPlan)orientPlan();ortho.left=-halfH*aspect;ortho.right=halfH*aspect;ortho.top=halfH;ortho.bottom=-halfH;ortho.updateProjectionMatrix();renderer.setSize(w,h)}
function category(obj){if(obj.name.startsWith('Bicycle-Tire')||obj.name.startsWith('Bicycle-Seat'))return 'rubber';if(obj.name.startsWith('Bicycle-Body'))return 'bikeFrame';if(obj.name.startsWith('Bicycle-'))return 'metal';if(obj.name.startsWith('Rhino_673a7a47'))return 'porcelain';if(obj.parent.name==='EQUIPAMENTOS')return 'metal';let n=obj;while(n){const name=n.name.toUpperCase();if(name.includes('VIDRO'))return 'glass';if(name.includes('CAIXILHARIA'))return 'metal';if(name.includes('CARPINTARIA'))return 'wood';if(name.startsWith('PAREDES'))return 'wall';if(name.startsWith('PISOS'))return 'floor';n=n.parent}return 'wall'}
async function init(){document.body.classList.add('is-loading');try{renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.88;renderer.localClippingEnabled=true;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;$('canvas').replaceChildren(renderer.domElement);perspective=new THREE.PerspectiveCamera(55,1,.025,400);ortho=new THREE.OrthographicCamera(-20,20,20,-20,.1,250);perspective.position.copy(overviewPosition());cameraMode(false);scene.add(new THREE.HemisphereLight(0xdde7ed,0x777264,1.25));scene.add(new THREE.AmbientLight(0xffffff,.55));const sun=new THREE.DirectionalLight(0xffead0,2.5);sun.position.set(-18,30,-12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-30,right:30,top:32,bottom:-32,near:1,far:100});sun.shadow.bias=-.0004;sun.shadow.normalBias=.025;scene.add(sun);const fill=new THREE.DirectionalLight(0xb8d0e0,.45);fill.position.set(15,10,22);scene.add(fill);
const gltf=await new GLTFLoader().loadAsync('./assets/projeto-v3.glb',p=>{if(p.total)$('progress').textContent='A carregar… '+Math.round(p.loaded/p.total*100)+'%'});model=gltf.scene;
// Keep the original alignment with the street, neighbouring buildings and saved views.
model.rotation.y=-.19;model.position.set(-1.5003259,0,-2.08317094);
model.updateMatrixWorld(true);
model.traverse(o=>{if(o.isMesh){if(o.name===gratingDoorProxy){o.visible=false;return}o.geometry.computeVertexNormals();modelMeshes.push(o)}});
worldMatrix=model.matrixWorld.clone();bounds=new THREE.Box3();modelMeshes.forEach(m=>bounds.union(new THREE.Box3().setFromObject(m)));center=bounds.getCenter(new THREE.Vector3());center.y=3.9;frameSize=bounds.max.z-bounds.min.z+5;
for(const [a,c] of Object.entries(cuts)){c.min=+(bounds.min[a]-.15).toFixed(2);c.max=+(bounds.max[a]+.15).toFixed(2)}cuts.x.value=0;cuts.z.value=0;
const palette={wall:0xbeb7a5,floor:0x858a7e,wood:0x957559,metal:0x354a40,glass:0x86b3b1,porcelain:0xeee9db,rubber:0x292a29,bikeFrame:0x344342};for(const mesh of modelMeshes){const cat=category(mesh);mesh.userData.glass=cat==='glass';mesh.material=new THREE.MeshStandardMaterial({color:palette[cat],roughness:cat==='porcelain'?.28:cat==='metal'?.5:.88,metalness:cat==='metal'?.3:0,side:THREE.DoubleSide,transparent:cat==='glass',opacity:cat==='glass'?.18:1,depthWrite:cat!=='glass',clipShadows:true});applyMetalGrating(mesh);mesh.castShadow=cat!=='glass';mesh.receiveShadow=true;if(mesh.name.startsWith('Bicycle-'))continue;const lines=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,25),new THREE.LineBasicMaterial({color:0x1b2920,transparent:true,opacity:cat==='glass'?.25:.42}));mesh.add(lines);edgeObjects.push(lines);const attr=mesh.geometry.attributes.position,idx=mesh.geometry.index;for(let i=0;i<(idx?idx.count:attr.count);i+=3){const points=[];for(let j=0;j<3;j++)points.push(new THREE.Vector3().fromBufferAttribute(attr,idx?idx.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));triangles.push({points,glass:cat==='glass',meshId:mesh.parent.uuid,solidId:mesh.uuid,floor:cat==='floor'})}}
scene.add(model);planting=makePlanting();scene.add(planting);surroundings=makeSurroundings();scene.add(surroundings.group);furniture=makeFurniture();scene.add(furniture.group);furniture.group.visible=false;for(const o of furniture.objects){modelMeshes.push(o);o.traverse(c=>{if(c.isLineSegments)edgeObjects.push(c)});}ground=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.MeshStandardMaterial({color:0x303c35,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.32;ground.receiveShadow=true;scene.add(ground);
for(let i=1;i<views.length;i++){const v=views[i];v.position=new THREE.Vector3(...v.pos).applyMatrix4(worldMatrix);v.lookAt=new THREE.Vector3(...v.target).applyMatrix4(worldMatrix);const point=new THREE.Vector3(...publishedViews[i].position);const el=document.createElement('button');el.className='point';el.textContent=String(i).padStart(2,'0');el.title=v.name;el.setAttribute('aria-label','Câmara '+v.name);el.onclick=()=>goView(i);$('point-labels').append(el);markers.push({el,point,index:i})}
views.forEach((v,i)=>{if(!validView(publishedViews[i]))throw new Error("Invalid published camera preset "+i);v.defaultConfig=structuredClone(publishedViews[i]);});await loadPlans();new ResizeObserver(resize).observe(stage);ready=true;resize();cameraButtons.forEach(b=>b.disabled=false);$('loading').hidden=true;document.body.classList.remove('is-loading');applyCuts();const initial=views[0].defaultConfig;controls.target.fromArray(initial.target);camera.position.fromArray(initial.position);perspective.fov=initial.fov;perspective.updateProjectionMatrix();controls.update();highlight(0);renderer.setAnimationLoop(animate);remindInteraction();
}catch(error){console.error(error);document.body.classList.remove('is-loading');$('loading').innerHTML='<strong>Não foi possível abrir o modelo.</strong><span>Verifique se o navegador tem WebGL ativo.</span><button id="retry">Tentar novamente</button>';$('retry').onclick=()=>location.reload()}}
function animate(now){animateClipping(now);if(tween){let t=tween.duration===0?1:Math.min((now-tween.start)/tween.duration,1);const k=t*t*(3-2*t);camera.position.lerpVectors(tween.from,tween.to,k);controls.target.lerpVectors(tween.fromTarget,tween.target,k);if(t===1)tween=null}controls.update();const width=stage.clientWidth,height=stage.clientHeight;for(const m of markers){const v=m.point.clone().project(camera);const direction=m.point.clone().sub(camera.position);const forward=new THREE.Vector3();camera.getWorldDirection(forward);const show=$('markers').checked&&mode==='perspective'&&activeView===0&&direction.dot(forward)>0&&v.z<1&&Math.abs(v.x)<.96&&Math.abs(v.y)<.94;m.el.hidden=!show;if(show){m.el.style.left=(v.x*.5+.5)*width+'px';m.el.style.top=(-v.y*.5+.5)*height+'px'}}surroundings?.update(camera);renderer.render(scene,camera)}
const paperTextures={};async function loadPlans(){const loader=new THREE.TextureLoader();for(const floor of ['rc','cave']){const t=await loader.loadAsync('./assets/planta-'+floor+'.png');t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();paperTextures[floor]=t;}planPaper=new THREE.Mesh(new THREE.PlaneGeometry(40,5.85),new THREE.MeshBasicMaterial({map:paperTextures.rc,side:THREE.DoubleSide,toneMapped:false}));planPaper.rotation.set(-Math.PI/2,0,Math.PI/2);planPaper.position.y=15;planPaper.visible=false;scene.add(planPaper);}
let reminderTimer;
function remindInteraction(){const el=$('interaction-reminder');clearTimeout(reminderTimer);el.hidden=false;el.classList.remove('visible');$('reminder-orbit').hidden=isPlan;$('reminder-pan').hidden=!isPlan;$('reminder-text').textContent=isPlan?'Arraste para deslocar':'Arraste para orbitar';void el.offsetWidth;el.classList.add('visible');reminderTimer=setTimeout(()=>{el.hidden=true;el.classList.remove('visible')},1000);}
function validView(v){return v&&['position','target'].every(k=>Array.isArray(v[k])&&v[k].length===3&&v[k].every(n=>Number.isFinite(n)&&Math.abs(n)<500))&&Number.isFinite(v.fov)&&v.fov>=30&&v.fov<=95&&new THREE.Vector3(...v.position).distanceTo(new THREE.Vector3(...v.target))>.1;}
syncCutUI();init();
