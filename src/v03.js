'use strict';
// v0.3: camera-to-barrel aiming, direct tank selection, discrete movement and impact staging.
const V03_MAX_STEP=MOVE_RULES.unit;
const V03_PLAN=SurfaceNavigator.prototype.plan;
SurfaceNavigator.prototype.plan=function(tank,x,z){
 if(Math.hypot(x-tank.x,z-tank.z)>V03_MAX_STEP+1.25)return null;
 let route=V03_PLAN.call(this,tank,x,z);
 if(!route||route.length>V03_MAX_STEP+.06||route.points.length<2)return null;
 route.cost=1; // One movement action, never distance-based multi-credit movement.
 return route;
};
function v03Project(view,point,width,height){
 if(!view)return null;
 const [eye,target]=view;
 const m=M4.mul(M4.perspective(Math.PI/3.05,width/height,.15,350),M4.look(eye,target));
 const [x,y,z]=point,w=m[3]*x+m[7]*y+m[11]*z+m[15];
 if(w<=.01)return null;
 const nx=(m[0]*x+m[4]*y+m[8]*z+m[12])/w;
 const ny=(m[1]*x+m[5]*y+m[9]*z+m[13])/w;
 return [width*(nx*.5+.5),height*(.5-ny*.5)];
}
function v03WeaponArt(canvas,id){
 if(!canvas)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);
 const color={cannon:'#ffc76b',mega:'#ff693e',cluster:'#ffe78c',digger:'#b7a1ff',mountain:'#a9ef92',roller:'#65c7ff'}[id]||'#f8db8d';
 ctx.save();ctx.translate(w*.5,h*.5);ctx.rotate(-.30);
 const metal=ctx.createLinearGradient(-16,-12,16,12);
 metal.addColorStop(0,'#a1c3b8');metal.addColorStop(.42,'#42555c');metal.addColorStop(1,'#1b2c36');
 ctx.shadowColor=color;ctx.shadowBlur=9;
 if(id==='cannon'||id==='mega'){
  ctx.fillStyle=metal;ctx.fillRect(-8,-15,16,29);ctx.fillStyle=color;
  ctx.beginPath();ctx.moveTo(-8,-15);ctx.lineTo(0,-27);ctx.lineTo(8,-15);ctx.closePath();ctx.fill();
  ctx.fillStyle=id==='mega'?'#f15a3a':'#e2aa54';ctx.fillRect(-8,6,16,5);ctx.fillRect(-8,11,16,4);
  if(id==='mega'){ctx.fillStyle='#ffe4a9';ctx.beginPath();ctx.arc(0,-14,5,0,6.28);ctx.fill();}
 }else if(id==='cluster'){
  ctx.fillStyle=metal;ctx.fillRect(-7,-17,14,32);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-7,-17);ctx.lineTo(0,-24);ctx.lineTo(7,-17);ctx.fill();
  for(let i=-1;i<=1;i++){ctx.save();ctx.translate(i*12,i%2?10:-1);ctx.fillStyle=i?'#eeb55b':'#ffeaa0';ctx.fillRect(-4,-5,8,12);ctx.restore();}
 }else if(id==='digger'){
  ctx.fillStyle=metal;ctx.fillRect(-9,-8,18,25);
  for(let i=0;i<3;i++){ctx.fillStyle=i%2?'#c1adfc':'#7d5fbd';ctx.fillRect(-9,-7+i*8,18,3);}
  ctx.fillStyle='#e5dbff';ctx.beginPath();ctx.moveTo(-9,-8);ctx.lineTo(0,-29);ctx.lineTo(9,-8);ctx.closePath();ctx.fill();
 }else if(id==='mountain'){
  ctx.fillStyle='#52725b';ctx.fillRect(-16,-10,32,26);
  ctx.fillStyle=color;ctx.fillRect(-10,-22,20,19);ctx.fillStyle='#e0ffb6';ctx.fillRect(-4,-28,8,10);
  ctx.strokeStyle='#d7ffb3';ctx.strokeRect(-13,-13,26,26);
 }else if(id==='roller'){
  const grad=ctx.createRadialGradient(-5,-6,2,0,0,23);grad.addColorStop(0,'#e7ffff');grad.addColorStop(.5,color);grad.addColorStop(1,'#234f76');
  ctx.fillStyle=grad;ctx.beginPath();ctx.arc(0,0,20,0,6.283);ctx.fill();
  ctx.strokeStyle='#e7fdff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,15,1.1,4.8);ctx.stroke();
 }
 ctx.restore();
}
const V03_BIND=Game.prototype.bind;
Game.prototype.bind=function(){
 V03_BIND.call(this);
 // Legacy v0.2 controls remain inert for compatibility but are never visible.
 const oldMove=this.dom('moveControls');if(oldMove)oldMove.style.display='none';
 let panel=this.dom('weaponPanel'),toggle=this.dom('weaponToggle');
 if(panel&&toggle){
  toggle.onclick=()=>{if(this.mode==='menu')return;let open=panel.classList.toggle('expanded');toggle.setAttribute('aria-expanded',String(open));this.audio.select();};
  const original=this.dom('weapons');
  for(let i=0;i<original.children.length;i++){
   let b=original.children[i],w=WEAPONS[i];
   b.innerHTML='<canvas width="56" height="56" aria-hidden="true"></canvas><span class="weaponName">'+w.name+'</span>';
   b.title=w.description;v03WeaponArt(b.querySelector('canvas'),w.id);
  }
  document.addEventListener('pointerdown',e=>{if(!panel.contains(e.target)){panel.classList.remove('expanded');toggle.setAttribute('aria-expanded','false');}});
 }
 let pressed=null;
 this.canvas.addEventListener('pointerdown',e=>{pressed={id:e.pointerId,x:e.clientX,y:e.clientY};});
 this.canvas.addEventListener('pointerup',e=>{
  if(!pressed||pressed.id!==e.pointerId)return;
  let drift=Math.hypot(e.clientX-pressed.x,e.clientY-pressed.y);pressed=null;
  if(drift>10||this.mode!=='duel'||this.turn!=='player'||this.paused||this.movingPath)return;
  if(this.isPlayerTankTap(e.clientX,e.clientY)){
   this.tankSelected=!this.tankSelected&&this.moveCredits>0;
   if(this.tankSelected)this.computeMovementHalo();
   this.audio.select();
   if(!this.tankSelected)this.movementHalo=[];
   this.refreshMoveUi();return;
  }
  if(!this.tankSelected)return;
  let hit=this.pickGround(e.clientX,e.clientY);
  if(!hit){this.toast('NO VALID GROUND');return;}
  let plan=this.navigator.plan(this.player,hit[0],hit[2]);
  if(!plan){this.toast('TOO FAR OR BLOCKED');return;}
  this.moveCredits--;this.moveLeft=this.moveCredits;
  this.aimWorldHeading=this.player.aimYaw();
  this.movingPath={points:plan.points,next:1};
  this.tankSelected=false;this.movementHalo=[];
  this.refreshMoveUi();this.audio.select();
 });
};
Game.prototype.isPlayerTankTap=function(px,py){
 if(!this.lastCamera)return false;
 const rect=this.canvas.getBoundingClientRect(),w=rect.width,h=rect.height,p=this.player;
 const corners=[];
 for(let dx of [-1.6,1.6])for(let dz of [-2.3,2.3])for(let dy of [.2,2.95]){
  const a=p.yaw,x=p.x+Math.cos(a)*dx+Math.sin(a)*dz,z=p.z-Math.sin(a)*dx+Math.cos(a)*dz;
  let proj=v03Project(this.lastCamera,[x,p.y+dy,z],w,h);
  if(proj)corners.push(proj);
 }
 if(!corners.length)return false;
 let minx=Math.min(...corners.map(c=>c[0]))-14,maxx=Math.max(...corners.map(c=>c[0]))+14;
 let miny=Math.min(...corners.map(c=>c[1]))-15,maxy=Math.max(...corners.map(c=>c[1]))+16;
 return px-rect.left>=minx&&px-rect.left<=maxx&&py-rect.top>=miny&&py-rect.top<=maxy;
};
Game.prototype.computeMovementHalo=function(){
 this.movementHalo=[];
 let t=this.player;
 for(let i=0;i<24;i++){
  let a=i*Math.PI*2/24,x=t.x+Math.sin(a)*V03_MAX_STEP*.86,z=t.z+Math.cos(a)*V03_MAX_STEP*.86;
  let plan=this.navigator.plan(t,x,z);
  if(plan){let p=plan.points[plan.points.length-1];this.movementHalo.push([p[0],p[1]+.32,p[2]]);}
 }
};
Game.prototype.handleSceneDrag=function(dx,dy){
 if(this.paused||this.mode==='menu'||this.projectiles.length||this.turn==='flying')return;
 this.orbit+=dx*.007;
 this.aimPitch=clamp((this.aimPitch??this.player.elev)-dy*.006,.14,1.41);
 if(this.mode==='duel'&&this.turn==='player'&&!this.tankSelected&&!this.movingPath){
  this.player.turret=this.orbit;this.player.elev=this.aimPitch;this.updateAimText();
 }
};
const V03_START=Game.prototype.start;
Game.prototype.start=function(mode){
 V03_START.call(this,mode);
 this.moveMode=false;this.movePlan=null;this.movingPath=null;this.tankSelected=false;this.movementHalo=[];this.aimWorldHeading=null;this.debrisCloud=[];this.healthRayCache=null;
 this.orbit=this.player.turret;this.aimPitch=this.player.elev;this.moveCredits=6;this.enemyCredits=6;
 if(this.dom('weaponPanel'))this.dom('weaponPanel').classList.remove('expanded');
 if(this.dom('weaponToggle'))this.dom('weaponToggle').setAttribute('aria-expanded','false');
 this.refreshMoveUi();this.pickWeapon(0);
 this.banner('TAP YOUR TANK TO MOVE','SIX MOVES • DRAG TO AIM • FIRE',2.5);
};
const V03_VOLLEY=Game.prototype.afterVolley;
Game.prototype.afterVolley=function(){
 V03_VOLLEY.call(this);
 this.moveMode=false;this.tankSelected=false;this.movementHalo=[];
 this.refreshMoveUi();
};
const V03_PICK=Game.prototype.pickWeapon;
Game.prototype.pickWeapon=function(i){
 V03_PICK.call(this,i);
 let w=WEAPONS[i];
 if(this.dom('activeWeaponArt'))v03WeaponArt(this.dom('activeWeaponArt'),w.id);
 if(this.dom('weaponPanel'))this.dom('weaponPanel').classList.remove('expanded');
 if(this.dom('weaponToggle'))this.dom('weaponToggle').setAttribute('aria-expanded','false');
};
const V03_MOVE_UI=Game.prototype.refreshMoveUi;
Game.prototype.refreshMoveUi=function(){
 V03_MOVE_UI.call(this);
 let indicator=this.dom('moveTokens');
 if(indicator)indicator.innerHTML=Array.from({length:6},(_,i)=>'<span class="'+(i<(this.moveCredits??6)?'ready':'spent')+'"></span>').join('');
 if(this.dom('moveControls'))this.dom('moveControls').style.display='none';
 if(this.dom('hud'))this.dom('hud').classList.toggle('selectedTank',!!this.tankSelected);
 if(this.dom('moveLeft'))this.dom('moveLeft').textContent=this.moveCredits??6;
};
const V03_UPDATE=Game.prototype.update;
Game.prototype.update=function(dt){
 const wasMoving=!!this.movingPath;
 V03_UPDATE.call(this,dt);
 if(this.world.tickDestruction)this.world.tickDestruction(dt);
 if(this.world.debrisEvents&&this.world.debrisEvents.length){
  if(!this.debrisCloud)this.debrisCloud=[];
  const events=this.world.debrisEvents.splice(0,12);
  for(let e of events){
   const n=e.kind==='tree'?21:e.kind==='ruin'?32:14;
   for(let i=0;i<n;i++){
    let a=Math.random()*Math.PI*2,spd=(e.kind==='tree'?4:7)+Math.random()*8;
    if(this.debrisCloud.length>185)this.debrisCloud.shift();
    this.debrisCloud.push({
     pos:[e.x+(Math.random()-.5),e.y+(Math.random()-.5),e.z+(Math.random()-.5)],
     vel:[Math.sin(a)*spd,4+Math.random()*12,Math.cos(a)*spd],time:0,
     life:1.0+Math.random()*1.1,size:e.kind==='tree'?.19+Math.random()*.25:.26+Math.random()*.35,
     color:e.kind==='tree'?(Math.random()<.6?[.26,.49,.22]:[.42,.30,.20]):[.56,.53,.45]
    });
   }
  }
 }
 if(wasMoving&&this.aimWorldHeading!==null){
  this.orbit=this.aimWorldHeading-this.player.yaw;
  this.player.turret=this.orbit;
  if(!this.movingPath)this.aimWorldHeading=null;
 }
 if(this.debrisCloud){
  for(let j=this.debrisCloud.length-1;j>=0;j--){
   let d=this.debrisCloud[j];d.time+=dt;
   d.vel[1]-=20*dt;d.pos=V3.add(d.pos,V3.mul(d.vel,dt));
   if(d.pos[1]<this.world.height(d.pos[0],d.pos[2])+.1){d.pos[1]=this.world.height(d.pos[0],d.pos[2])+.1;d.vel=V3.mul(d.vel,.24);}
   if(d.time>d.life)this.debrisCloud.splice(j,1);
  }
 }
};
Game.prototype.camera=function(){
 let p=this.player,eye,target;
 if(this.mode==='menu'){
  let a=this.time*.12+.7,d=23;target=[p.x,p.y+2.5,p.z];eye=[p.x+Math.sin(a)*d,p.y+12,p.z+Math.cos(a)*d];
 }else{
  let shot=this.shellCamera&&this.shellCamera.pose(this.projectiles,this.world);
  if(shot)[eye,target]=shot;
  else{
   let a=p.yaw+this.orbit,pitch=clamp(this.aimPitch??p.elev,.14,1.41),distance=(this.cam==='orbit'?22:15)*this.zoom;
   let camH=6+Math.sin(pitch)*4.1,lookAhead=8;
   eye=[p.x-Math.sin(a)*distance,p.y+camH,p.z-Math.cos(a)*distance];
   target=[p.x+Math.sin(a)*lookAhead,p.y+1.4+Math.sin(pitch)*8,p.z+Math.cos(a)*lookAhead];
  }
 }
 const factor=this.mode==='menu'?.05:this.projectiles.length?.26:.14;
 this.cameraPos=this.cameraPos.map((x,i)=>lerp(x,eye[i],factor));
 this.cameraTarget=this.cameraTarget.map((x,i)=>lerp(x,target[i],this.projectiles.length?.3:.2));
 this.lastCamera=[this.cameraPos.slice(),this.cameraTarget.slice()];
 return [this.cameraPos.map(x=>x+(Math.random()-.5)*this.shake),this.cameraTarget];
};
const V03_DRAW=Game.prototype.draw;
Game.prototype.draw=function(now){
 V03_DRAW.call(this,now);
 if(this.mode==='duel'&&this.tankSelected&&this.turn==='player'&&!this.movingPath){
  for(let p of this.movementHalo||[])this.r.cube(p,[.23,.09,.23],[.98,.78,.37]);
  for(let i=0;i<24;i++){
   let a=i*Math.PI*2/24,t=this.player;
   let px=t.x+Math.cos(a)*2.9,pz=t.z+Math.sin(a)*2.9;
   this.r.cube([px,t.y+.12,pz],[.18,.12,.18],[.96,.78,.31]);
  }
 }
 for(let d of this.debrisCloud||[]){
  let a=clamp((d.life-d.time)/d.life,.1,1),size=d.size*(.8+.2*a);
  this.r.cube(d.pos,[size,size,size],d.color,null,a);
 }
 this.drawTankHealthBars();
};
Game.prototype.spawnCratersideDebris=function(p,pos,rad,removed){
 if(!removed||rad<.8)return;
 if(!this.debrisCloud)this.debrisCloud=[];
 let count=Math.min(95,Math.ceil(Math.sqrt(removed)*3+rad*5));
 for(let i=0;i<count;i++){
  let a=Math.random()*6.283,up=5+Math.random()*8,spd=4+rad*2+Math.random()*7,material=this.world.at(pos[0],Math.max(1,pos[1]-1),pos[2]);
  let c=material===3?[.43,.46,.46]:material===4?[.76,.62,.37]:Math.random()<.3?[.49,.35,.22]:[.64,.52,.33];
  if(this.debrisCloud.length>185)this.debrisCloud.shift();
  this.debrisCloud.push({pos:[...pos],vel:[Math.sin(a)*spd,up+Math.random()*7,Math.cos(a)*spd],time:0,life:.85+Math.random()*1.1,size:.18+Math.random()*.42,color:c});
 }
};

Game.prototype.cameraSeesTank=function(tank){
 if(!this.lastCamera)return false;
 let eye=this.lastCamera[0],target=[tank.x,tank.y+2.3,tank.z];
 let delta=V3.sub(target,eye),length=V3.len(delta);
 let steps=Math.ceil(length/.85);
 for(let i=1;i<steps-2;i++){
  let pt=V3.add(eye,V3.mul(delta,i/steps));
  if(this.world.solid(...pt))return false;
  if(i%3===0&&this.world.propHit&&this.world.propHit(...pt))return false;
 }
 return true;
};
Game.prototype.drawTankHealthBars=function(){
 if(this.mode==='menu')return;
 const rect=this.canvas.getBoundingClientRect(),w=rect.width,h=rect.height;
 if(this.healthRayCache===null||!this.healthRayCache||this.time-this.healthRayCache.time>.12){
  this.healthRayCache={time:this.time,player:this.cameraSeesTank(this.player),enemy:this.cameraSeesTank(this.enemy)};
 }
 for(let [tank,id,visible] of [
  [this.player,'playerTankHealth',this.healthRayCache.player],
  [this.enemy,'enemyTankHealth',this.healthRayCache.enemy]
 ]){
  let element=this.dom(id);if(!element)continue;
  let projection=v03Project(this.lastCamera,[tank.x,tank.y+4.15,tank.z],w,h);
  let onscreen=!!(projection&&projection[0]>12&&projection[0]<w-12&&projection[1]>14&&projection[1]<h-12);
  element.style.opacity=(onscreen&&visible)?'1':'0';
  if(!onscreen||!visible)continue;
  element.style.left=Math.round(projection[0]+rect.left)+'px';
  element.style.top=Math.round(projection[1]+rect.top)+'px';
  element.firstElementChild.style.width=clamp(tank.hp,0,100)+'%';
 }
};
