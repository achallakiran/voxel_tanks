'use strict';
// Voxel Tanks v0.2 — modular terrain navigation, discovery AI, shell cinematics.
const MOVE_RULES={credits:6,unit:4,grid:1.6,maxStep:1.25,speed:5.4};
class SurfaceNavigator{
 constructor(world){this.world=world;}
 floor(x,z,reference){
  const w=this.world,top=Math.min(w.H-4,Math.floor(reference+1.5));
  for(let y=top;y>=0;y--)if(w.solid(x,y+.25,z)&&!w.solid(x,y+1.25,z)&&!w.solid(x,y+2.5,z)&&!w.solid(x,y+3.5,z))return y+1;
  return null;
 }
 support(x,z,reference){
  const probes=[[0,0],[.93,1.35],[-.93,1.35],[.93,-1.35],[-.93,-1.35]],levels=[];
  for(let p of probes){let h=this.floor(x+p[0],z+p[1],reference);if(h===null)return null;levels.push(h);}
  if(Math.max(...levels)-Math.min(...levels)>2.1||Math.abs(levels[0]-reference)>1.65)return null;
  return levels[0];
 }
 plan(tank,toX,toZ){
  const w=this.world,s=MOVE_RULES.grid,sx=Math.round(tank.x/s),sz=Math.round(tank.z/s),ex=Math.round(toX/s),ez=Math.round(toZ/s);
  if(Math.hypot(toX-tank.x,toZ-tank.z)<.7)return null;
  const h=this.support(tank.x,tank.z,tank.y+1);if(h===null)return null;
  const key=(x,z)=>x+','+z,initial={x:sx,z:sz,h,g:0,f:0,k:key(sx,sz)},open=[initial],best=new Map([[initial.k,initial]]),closed=new Set();
  const offsets=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  let goal=null,iterations=0;
  while(open.length&&iterations++<1400){
   let nextIndex=0;for(let i=1;i<open.length;i++)if(open[i].f<open[nextIndex].f)nextIndex=i;
   let cur=open.splice(nextIndex,1)[0];if(closed.has(cur.k))continue;closed.add(cur.k);
   if(Math.hypot(cur.x-ex,cur.z-ez)*s<2.1){goal=cur;break;}
   for(let [dx,dz] of offsets){
    let x=cur.x+dx,z=cur.z+dz,px=x*s,pz=z*s,k=key(x,z);
    if(closed.has(k)||Math.abs(px)>w.W/2-3||Math.abs(pz)>w.D/2-3)continue;
    let nh=this.support(px,pz,cur.h),rise=MOVE_RULES.maxStep*Math.hypot(dx,dz);
    if(nh===null||Math.abs(nh-cur.h)>rise)continue;
    let dist=Math.hypot(dx,dz)*s,g=cur.g+Math.hypot(dist,(nh-cur.h)*.65);
    if(g>48)continue;
    let old=best.get(k);if(old&&g>=old.g-.00001)continue;
    let node={x,z,h:nh,g,f:g+Math.hypot(x-ex,z-ez)*s,k,parent:cur};
    best.set(k,node);open.push(node);
   }
  }
  if(!goal)return null;
  let points=[];for(let cur=goal;cur;cur=cur.parent)points.push([cur.x*s,cur.h,cur.z*s]);
  points.reverse();if(points.length<2)return null;points[0]=[tank.x,tank.y,tank.z];
  let distance=0;for(let i=1;i<points.length;i++)distance+=Math.hypot(points[i][0]-points[i-1][0],points[i][2]-points[i-1][2]);
  return {points,length:distance,cost:Math.max(1,Math.ceil(distance/MOVE_RULES.unit))};
 }
}
function walkPlannedPath(tank,path,dt,world){
 let remaining=MOVE_RULES.speed*dt;
 while(remaining>0&&path.next<path.points.length){
  const pt=path.points[path.next],dx=pt[0]-tank.x,dz=pt[2]-tank.z,d=Math.hypot(dx,dz);
  if(d<.01){path.next++;continue;}
  let traveled=Math.min(d,remaining);
  tank.x+=dx/d*traveled;tank.z+=dz/d*traveled;remaining-=traveled;tank.trackPhase+=traveled*1.4;
  const heading=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(heading-tank.yaw),Math.cos(heading-tank.yaw));
  tank.yaw+=clamp(delta,-dt*3.5,dt*3.5);
  if(traveled>=d-.001)path.next++;
 }
 tank.velocity=0;tank.updateHeight(dt,world);
 return path.next>=path.points.length;
}
class EnemyPerception{
 constructor(){this.estimated=null;this.uncertainty=30;this.seenAt=-1;}
 visible(world,observer,target){
  const a=[observer.x,observer.y+3,observer.z],b=[target.x,target.y+1.7,target.z],delta=V3.sub(b,a),length=V3.len(delta),steps=Math.ceil(length/.65);
  for(let i=3;i<steps-3;i++){const p=V3.add(a,V3.mul(delta,i/steps));if(world.solid(...p))return false;}
  return true;
 }
 observe(world,enemy,player,time){
  if(this.visible(world,enemy,player)){this.estimated=[player.x,player.z];this.uncertainty=.6;this.seenAt=time;return true;}
  if(!this.estimated){this.estimated=[clamp(enemy.x-28,-49,49),clamp(enemy.z-25,-49,49)];this.uncertainty=27;}
  else this.uncertainty=Math.min(35,this.uncertainty+.45);
  return false;
 }
 hearFire(world,enemy,player,time){
  if(this.visible(world,enemy,player)){this.observe(world,enemy,player,time);return;}
  // A distant gun report allows a rough bearing, never the target's exact coordinates.
  let angle=Math.atan2(player.x-enemy.x,player.z-enemy.z)+(Math.random()-.5)*.28;
  let range=this.estimated?Math.hypot(this.estimated[0]-enemy.x,this.estimated[1]-enemy.z):43;
  range=clamp(range+(Math.random()-.5)*18,19,76);
  this.estimated=[clamp(enemy.x+Math.sin(angle)*range,-51,51),clamp(enemy.z+Math.cos(angle)*range,-51,51)];
  this.uncertainty=Math.max(8,this.uncertainty);
 }
 target(world,enemy){
  let estimate=this.estimated||[enemy.x-25,enemy.z-25],noise=Math.min(14,this.uncertainty*.4);
  return [clamp(estimate[0]+(Math.random()-.5)*noise,-51,51),clamp(estimate[1]+(Math.random()-.5)*noise,-51,51)];
 }
}
class ShellCamera{
 constructor(){this.impact=null;}
 onImpact(pos,radius){this.impact={pos:[...pos],radius,time:1.3};}
 tick(dt){if(this.impact){this.impact.time-=dt;if(this.impact.time<=0)this.impact=null;}}
 pose(projectiles,world){
  if(projectiles.length){
   let n=Math.min(12,projectiles.length),pos=[0,0,0],vel=[0,0,0];
   for(let i=0;i<n;i++)for(let j=0;j<3;j++){pos[j]+=projectiles[i].pos[j]/n;vel[j]+=projectiles[i].vel[j]/n;}
   let forward=V3.norm([vel[0],0,vel[2]]);if(Math.hypot(vel[0],vel[2])<.01)forward=[0,0,1];
   let altitude=Math.max(0,pos[1]-world.height(pos[0],pos[2])),lead=11+Math.min(9,altitude*.18),lag=7+Math.min(6,altitude*.15);
   let tx=clamp(pos[0]+forward[0]*lead,-53,53),tz=clamp(pos[2]+forward[2]*lead,-53,53);
   let eye=[pos[0]-forward[0]*lag,pos[1]+9+Math.min(24,altitude*.45)+(n>1?10:0),pos[2]-forward[2]*lag];
   return [eye,[tx,world.height(tx,tz)+1.5,tz]];
  }
  if(this.impact){let p=this.impact.pos,r=this.impact.radius;return [[p[0]+13+r,p[1]+18+r*1.7,p[2]+12+r],[p[0],p[1]+1,p[2]]];}
  return null;
 }
}
class WeaponCinematics{
 constructor(game){this.game=game;this.events=[];}
 launch(t,w){
  let g=this.game,a=g.audio;g.spawnFX(t.muzzle(),w.col,w.id==='mega'?32:18,w.id==='mega'?12:6);
  if(w.id==='mega'){a.tone(67,.61,'sawtooth',.22,-34);a.tone(510,.26,'triangle',.12,-400);}
  else if(w.id==='cluster'){a.tone(630,.38,'sine',.15,-420);a.tone(330,.23,'square',.07,170);}
  else if(w.id==='digger'){for(let i=0;i<3;i++)a.tone(100+i*50,.2,'sawtooth',.08,70);}
  else if(w.id==='mountain'){a.tone(270,.45,'triangle',.15,320);a.tone(640,.5,'sine',.1,-340);}
  else if(w.id==='roller')a.tone(410,.34,'triangle',.18,-290);
  else a.tone(220,.14,'sawtooth',.12,-140);
 }
 impact(p,pos){
  let id=p.w.id,g=this.game,a=g.audio;
  this.events.push({pos:[...pos],id,age:0,life:id==='mega'?1.45:id==='mountain'?1.5:1.1,r:p.frag?2.3:p.w.radius,col:p.w.col});
  if(id==='mega'){a.tone(48,.9,'sawtooth',.35,-8);a.tone(110,.7,'triangle',.22,-58);}
  else if(id==='cluster')a.tone(295,.19,'square',.1,-240);
  else if(id==='digger'){for(let i=0;i<3;i++)a.tone(130+i*35,.25,'sawtooth',.075,-30);}
  else if(id==='mountain'){a.tone(165,.72,'triangle',.15,-85);a.tone(490,.5,'sine',.11,-305);}
  else if(id==='roller')a.tone(100,.56,'sawtooth',.18,-60);
  else a.tone(90,.3,'triangle',.18,-55);
 }
 tick(dt){for(let i=this.events.length-1;i>=0;i--){this.events[i].age+=dt;if(this.events[i].age>=this.events[i].life)this.events.splice(i,1);}}
 draw(r,projectiles,time){
  for(let p of projectiles){
   let id=p.w.id,c=p.w.col;
   if(id==='cannon')r.cylinder(p.pos,[.3,.52,.3],[.87,.86,.76],M4.rx(Math.PI/2));
   if(id==='mega'){r.cube(p.pos,[1.06,1.06,1.06],[1,.33,.08]);r.cube(p.pos,[.52,.52,.52],[1,.94,.46]);}
   if(id==='cluster')for(let k=0;k<4;k++){let a=time*8+k*Math.PI/2;r.cube([p.pos[0]+Math.cos(a)*.55,p.pos[1]+Math.sin(a)*.55,p.pos[2]],[.17,.17,.17],[1,.86,.48]);}
   if(id==='digger'){r.cylinder(p.pos,[.44,.85,.44],[.66,.53,.89],M4.rx(Math.PI/2));for(let k=0;k<3;k++){let a=time*21+k*2.1;r.cube([p.pos[0]+Math.cos(a)*.46,p.pos[1]+Math.sin(a)*.46,p.pos[2]],[.15,.15,.15],[.94,.77,1]);}}
   if(id==='mountain'){r.cube(p.pos,[.78,.78,.78],[.58,.9,.57],M4.ry(time*3));r.cube(p.pos,[.36,.36,.36],[.9,1,.6],M4.ry(-time*2));}
   if(id==='roller'){r.cube(p.pos,[.88,.88,.88],[.28,.63,.83],M4.rz(time*8));r.cube(p.pos,[.4,.4,.4],[.83,.95,1],M4.ry(time*7));}
  }
  for(let e of this.events){
   let t=e.age/e.life,radius=e.r*(e.id==='mega'?1.7:1),spread=radius*clamp(t*1.7,.06,1.8);
   if(['mega','cannon','cluster','roller'].includes(e.id)){
    let n=e.id==='mega'?25:12;
    for(let k=0;k<n;k++){let a=k*Math.PI*2/n;r.cube([e.pos[0]+Math.sin(a)*spread,e.pos[1]+.24+Math.sin(t*Math.PI)*radius*.1,e.pos[2]+Math.cos(a)*spread],[.25,.18,.25],e.id==='mega'?[1,.63,.19]:e.col);}
   }else if(e.id==='digger'){
    for(let k=0;k<12;k++){let a=k*1.6+time*9,dist=.4+k*.17;r.cube([e.pos[0]+Math.sin(a)*dist,e.pos[1]+k*.19,e.pos[2]+Math.cos(a)*dist],[.3,.3,.3],[.75,.59,.94]);}
   }else if(e.id==='mountain'){
    for(let k=0;k<13;k++){let a=k*2.4,dist=radius*(.2+.7*Math.abs(Math.sin(k*1.7)));r.cube([e.pos[0]+Math.sin(a)*dist,e.pos[1]+t*radius*1.6,e.pos[2]+Math.cos(a)*dist],[.38,.4,.38],[.53,.79,.4]);}
   }
  }
 }
}
// Preserve underlying engine and override only the coordinated v0.2 experience.
const OLD_BIND=Game.prototype.bind;
Game.prototype.bind=function(){
 OLD_BIND.call(this);
 this.dom('hud').insertAdjacentHTML('beforeend','<div id="moveControls"><button id="moveToggle" class="iconButton" title="Plan movement" aria-label="Plan movement">↗</button><b id="moveCredits">6</b><button id="moveConfirm" class="iconButton" title="Confirm move" aria-label="Confirm move">✓</button><button id="moveCancel" class="iconButton" title="Cancel route" aria-label="Cancel route">×</button></div>');
 this.dom('cameraButton').onclick=()=>{this.cam=this.cam==='chase'?'orbit':'chase';this.audio.select();this.toast('CAMERA • '+this.cam.toUpperCase());};
 this.dom('moveToggle').onclick=()=>{this.moveMode=!this.moveMode;this.movePlan=null;this.refreshMoveUi();};
 this.dom('moveConfirm').onclick=()=>this.confirmMove();
 this.dom('moveCancel').onclick=()=>{this.movePlan=null;this.refreshMoveUi();};
 let down=null;
 this.canvas.addEventListener('pointerdown',e=>down={id:e.pointerId,x:e.clientX,y:e.clientY});
 this.canvas.addEventListener('pointerup',e=>{
  if(!down||down.id!==e.pointerId)return;
  let distance=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;
  if(distance>9||!this.moveMode||this.mode!=='duel'||this.turn!=='player'||this.movingPath||this.paused)return;
  let ground=this.pickGround(e.clientX,e.clientY);
  if(ground)this.previewMove(ground[0],ground[2]);else this.toast('SELECT VISIBLE TERRAIN');
 });
 this.dom('radar').style.display='none';
};
Game.prototype.pickGround=function(px,py){
 if(!this.lastCamera)return null;
 let [eye,target]=this.lastCamera,forward=V3.norm(V3.sub(target,eye)),right=V3.norm(V3.cross(forward,[0,1,0])),up=V3.norm(V3.cross(right,forward)),rect=this.canvas.getBoundingClientRect();
 let tan=Math.tan(Math.PI/3.05/2),nx=((px-rect.left)/rect.width*2-1),ny=1-(py-rect.top)/rect.height*2;
 let dir=V3.norm(V3.add(forward,V3.add(V3.mul(right,nx*tan*rect.width/rect.height),V3.mul(up,ny*tan))));
 for(let dist=1;dist<240;dist+=.65){let p=V3.add(eye,V3.mul(dir,dist));if(Math.abs(p[0])>55||Math.abs(p[2])>55||p[1]>=this.world.H||p[1]<0)continue;if(this.world.solid(...p))return p;}
 return null;
};
Game.prototype.previewMove=function(x,z){
 if(this.moveCredits<=0){this.movePlan=null;this.toast('NO MOVES LEFT');this.refreshMoveUi();return;}
 let plan=this.navigator.plan(this.player,x,z);
 this.movePlan=plan;
 this.toast(!plan?'ROUTE BLOCKED':plan.cost>this.moveCredits?'NOT ENOUGH MOVES':'ROUTE • '+plan.cost+' MOVE'+(plan.cost===1?'':'S'));
 this.refreshMoveUi();
};
Game.prototype.confirmMove=function(){
 if(this.turn!=='player'||this.mode!=='duel'||this.movingPath||this.paused||!this.movePlan)return;
 const plan=this.movePlan;
 if(!plan.cost||plan.cost>this.moveCredits){this.toast('ROUTE OUT OF RANGE');return;}
 this.moveCredits-=plan.cost;this.moveLeft=this.moveCredits;
 this.movingPath={points:plan.points,next:1};this.movePlan=null;this.audio.select();this.refreshMoveUi();
};
Game.prototype.refreshMoveUi=function(){
 if(!this.dom('moveControls'))return;
 let active=this.mode==='duel'&&this.turn==='player'&&!this.paused;
 this.dom('hud').classList.toggle('classicMove',this.mode==='duel');
 this.dom('moveCredits').textContent=(this.moveCredits??6)+(this.movePlan?' (−'+this.movePlan.cost+')':'');
 this.dom('moveToggle').disabled=!active||!!this.movingPath||this.moveCredits<=0;
 this.dom('moveToggle').style.background=this.moveMode?'rgba(245,196,104,.28)':'rgba(8,28,37,.82)';
 this.dom('moveConfirm').disabled=!active||!this.movePlan||this.movePlan.cost>this.moveCredits||!!this.movingPath;
 this.dom('moveCancel').disabled=!active||!this.movePlan;
 this.dom('moveLeft').textContent=this.mode==='duel'?this.moveCredits:Math.ceil(this.moveLeft);
 this.dom('fire').disabled=!active||!!this.movingPath;
};
const OLD_START=Game.prototype.start;
Game.prototype.start=function(mode){
 if(this.world&&this.world.chunks)for(let mesh of this.world.chunks.values())this.r.dispose(mesh);
 OLD_START.call(this,mode);
 this.player._game=this;this.enemy._game=this;
 this.navigator=new SurfaceNavigator(this.world);this.perception=new EnemyPerception();this.shellCamera=new ShellCamera();this.cinematics=new WeaponCinematics(this);
 this.moveCredits=MOVE_RULES.credits;this.enemyCredits=MOVE_RULES.credits;this.moveLeft=mode==='duel'?this.moveCredits:22;
 this.moveMode=mode==='duel';this.movePlan=null;this.movingPath=null;this.enemyPath=null;this.aiMoved=false;this.lastCamera=null;
 this.dom('radar').style.display='none';this.refreshMoveUi();
 this.banner(mode==='duel'?'DISCOVER • AIM • FIRE':'TERRAIN SANDBOX',mode==='duel'?'TAP GROUND TO PLAN • SIX MOVES PER MATCH':'DRIVE FREELY • AIM • FIRE',2.4);
};
const OLD_UI=Game.prototype.ui;
Game.prototype.ui=function(){OLD_UI.call(this);if(this.moveCredits!==undefined&&this.mode==='duel')this.dom('moveLeft').textContent=this.moveCredits;};
const OLD_FIRE=Game.prototype.fire;
Game.prototype.fire=function(){if(this.movingPath)return;OLD_FIRE.call(this);this.movePlan=null;if(this.moveCredits!==undefined)this.refreshMoveUi();};
const OLD_LAUNCH=Game.prototype.launch;
Game.prototype.launch=function(t,w){
 OLD_LAUNCH.call(this,t,w);if(this.cinematics)this.cinematics.launch(t,w);
 if(this.perception&&t===this.player&&this.mode==='duel')this.perception.hearFire(this.world,this.enemy,this.player,this.time);
};
const OLD_IMPACT=Game.prototype.impact;
Game.prototype.impact=function(p,pos){this.lastTerrainImpact={owner:p.owner,pos:[...pos],radius:p.w.radius,time:this.time};OLD_IMPACT.call(this,p,pos);if(this.shellCamera)this.shellCamera.onImpact(pos,p.w.radius);if(this.cinematics)this.cinematics.impact(p,pos);};
const OLD_DAMAGE=Game.prototype.damage;
Game.prototype.damage=function(center,radius,damage,owner){
 let hp=owner?owner.hp:0;OLD_DAMAGE.call(this,center,radius,damage,owner);
 if(owner&&owner.hp<hp)owner.score-=Math.round((hp-owner.hp)*1.5);
 this.ui();
};
const OLD_VOLLEY=Game.prototype.afterVolley;
Game.prototype.afterVolley=function(){OLD_VOLLEY.call(this);if(this.mode==='duel'){this.moveLeft=this.moveCredits;this.movePlan=null;this.moveMode=true;this.aiMoved=false;this.refreshMoveUi();}};
Game.prototype.decideEnemy=function(){
 const e=this.enemy;
 if(e.hp<=0||this.enemyPath)return;
 this.perception.observe(this.world,e,this.player,this.time);
 if(!this.aiMoved){
  this.aiMoved=true;
  if(this.enemyCredits>0&&Math.random()<.53){
   const tx=clamp(e.x+(Math.random()-.5)*12,-48,48),tz=clamp(e.z+(Math.random()-.5)*12,-48,48),path=this.navigator.plan(e,tx,tz);
   if(path&&path.cost>0&&path.cost<=Math.min(2,this.enemyCredits)){this.enemyCredits-=path.cost;this.enemyPath={points:path.points,next:1};return;}
  }
 }
 let target=this.perception.target(this.world,e),tx=target[0],tz=target[1],ty=this.world.height(tx,tz)+1.3;
 let choices=this.settings.difficulty==='easy'?['cannon','cannon','roller']:['cannon','mega','cluster','digger','mountain','roller'];
 let id=choices[Math.floor(Math.random()*choices.length)],w=WEAPONS.find(q=>q.id===id)||WEAPONS[0];
 if(id==='mountain'){tx=lerp(e.x,tx,.65);tz=lerp(e.z,tz,.65);ty=this.world.height(tx,tz);}
 let bearing=Math.atan2(tx-e.x,tz-e.z),best={err:Infinity,yaw:bearing,elev:.7,power:44};
 const angs=[.37,.49,.61,.75,.88,1.01,1.15,1.28],powers=[25,31,37,43,49,55,61,67,74];
 for(let off of [-.09,0,.09])for(let ang of angs)for(let power of powers){
  let yaw=bearing+off,position=[e.x+Math.sin(yaw)*Math.cos(ang)*3.25,e.y+1.77+Math.sin(ang)*3.25,e.z+Math.cos(yaw)*Math.cos(ang)*3.25],v=[Math.sin(yaw)*Math.cos(ang)*power*.94,Math.sin(ang)*power*.94,Math.cos(yaw)*Math.cos(ang)*power*.94];
  for(let i=0;i<190;i++){v[0]+=this.wind*.36*.06;v[1]-=21*.06;position=V3.add(position,V3.mul(v,.06));if(position[1]<0||Math.abs(position[0])>56||Math.abs(position[2])>56||this.world.solid(...position))break;}
  let err=Math.hypot(position[0]-tx,position[2]-tz)+Math.abs(position[1]-ty)*.16;
  if(err<best.err)best={err,yaw,elev:ang,power};
 }
 let spread=this.settings.difficulty==='easy'?.16:this.settings.difficulty==='hard'?.028:this.settings.difficulty==='expert'?.013:.07;
 e.turret=best.yaw-e.yaw+(Math.random()-.5)*spread;e.elev=best.elev+(Math.random()-.5)*spread;e.power=clamp(best.power+(Math.random()-.5)*spread*18,22,75);
 this.launch(e,w);this.turn='flying';this.shooter='enemy';this.ui();this.banner('INCOMING',w.name.toUpperCase(),.9);
};
const OLD_UPDATE=Game.prototype.update;
Game.prototype.update=function(dt){
 if(this.mode!=='duel'){OLD_UPDATE.call(this,dt);if(this.shellCamera)this.shellCamera.tick(dt);if(this.cinematics)this.cinematics.tick(dt);return;}
 const oldKeys=this.keys,oldJoy=this.joy,enemyUpdate=this.enemy.update;
 this.keys=Object.assign({},oldKeys,{KeyW:false,KeyS:false,ArrowUp:false,ArrowDown:false});
 this.joy={x:0,y:0};this.moveLeft=0;
 this.enemy.update=function(dt,throttle,steer,world){this.updateHeight(dt,world);};
 try{OLD_UPDATE.call(this,dt);}finally{this.keys=oldKeys;this.joy=oldJoy;this.enemy.update=enemyUpdate;}
 this.moveLeft=this.moveCredits;
 if(this.turn==='player'&&this.movingPath&&walkPlannedPath(this.player,this.movingPath,dt,this.world)){this.movingPath=null;this.refreshMoveUi();}
 if(this.turn==='enemy'&&this.enemyPath&&walkPlannedPath(this.enemy,this.enemyPath,dt,this.world))this.enemyPath=null;
 if(this.shellCamera)this.shellCamera.tick(dt);
 if(this.cinematics)this.cinematics.tick(dt);
 if(this.dom('moveLeft'))this.dom('moveLeft').textContent=this.moveCredits;
};
Game.prototype.camera=function(){
 let p=this.player,eye,target;
 if(this.mode==='menu'){let a=this.time*.12+.7,d=23;target=[p.x,p.y+2.5,p.z];eye=[p.x+Math.sin(a)*d,p.y+12,p.z+Math.cos(a)*d];}
 else{
  let shot=this.shellCamera&&this.shellCamera.pose(this.projectiles,this.world);
  if(shot){[eye,target]=shot;}
  else{let a=p.yaw+this.orbit,d=(this.cam==='orbit'?23:15)*this.zoom,side=this.cam==='orbit'?3:2;target=[p.x,p.y+2.3,p.z];eye=[p.x-Math.sin(a)*d+Math.cos(a)*side,p.y+7.8*this.zoom,p.z-Math.cos(a)*d-Math.sin(a)*side];}
 }
 let factor=this.mode==='menu'?.045:this.projectiles.length?.26:.14;
 this.cameraPos=this.cameraPos.map((x,i)=>lerp(x,eye[i],factor));
 this.cameraTarget=this.cameraTarget.map((x,i)=>lerp(x,target[i],this.projectiles.length?.3:.18));
 this.lastCamera=[this.cameraPos.slice(),this.cameraTarget.slice()];
 return [this.cameraPos.map(x=>x+(Math.random()-.5)*this.shake),this.cameraTarget];
};
const OLD_DRAW=Game.prototype.draw;
Game.prototype.draw=function(now){
 OLD_DRAW.call(this,now);
 if(this.mode==='duel'&&this.movePlan){
  let col=this.movePlan.cost>this.moveCredits?[1,.4,.25]:[1,.8,.35];
  for(let i=1;i<this.movePlan.points.length;i++){let p=this.movePlan.points[i];this.r.cube([p[0],p[1]+.3,p[2]],[.45,.13,.45],col);}
  let last=this.movePlan.points[this.movePlan.points.length-1];this.r.cube([last[0],last[1]+.85,last[2]],[.55,1.2,.55],col);
 }
 if(this.cinematics)this.cinematics.draw(this.r,this.projectiles,this.time);
};
Game.prototype.drawRadar=function(){};
// Real local support: falling into blasted cavities no longer snaps tanks onto cave roofs.
Tank.prototype.updateHeight=function(dt,world){
 if(!this._nav||this._nav.world!==world)this._nav=new SurfaceNavigator(world);
 let nav=this._nav,level=nav.floor(this.x,this.z,this.y+1.1),ground=level===null?0:level+.18;
 if(this.y>ground+.06){
  if(this.fallStart===undefined)this.fallStart=this.y;
  this.verticalSpeed=(this.verticalSpeed||0)-22*dt;this.y+=this.verticalSpeed*dt;
  if(this.y<=ground){this.y=ground;let drop=this.fallStart-ground;if(drop>4.5){let dealt=this.applyDamage(Math.min(80,(drop-4.5)*5)),g=this._game,impact=g&&g.lastTerrainImpact;if(impact&&g.time-impact.time<8&&Math.hypot(this.x-impact.pos[0],this.z-impact.pos[2])<impact.radius+6){if(impact.owner===this)this.score-=Math.round(dealt*1.5);else if(impact.owner)impact.owner.score+=Math.round(dealt*1.5);g.ui();}}this.verticalSpeed=0;this.fallStart=undefined;}
 }else{this.y=lerp(this.y,ground,1-Math.exp(-8*dt));this.verticalSpeed=0;this.fallStart=undefined;}
 let fx=Math.sin(this.yaw)*2,fz=Math.cos(this.yaw)*2,sx=Math.cos(this.yaw),sz=-Math.sin(this.yaw),h=this.y+1.2;
 let fore=nav.floor(this.x+fx,this.z+fz,h)??ground,back=nav.floor(this.x-fx,this.z-fz,h)??ground;
 let left=nav.floor(this.x-sx,this.z-sz,h)??ground,right=nav.floor(this.x+sx,this.z+sz,h)??ground;
 this.pitch=lerp(this.pitch,clamp(Math.atan2(back-fore,4),-.35,.35),1-Math.exp(-5*dt));
 this.roll=lerp(this.roll,clamp(Math.atan2(left-right,2.5),-.3,.3),1-Math.exp(-5*dt));
 this.recoil=Math.max(0,this.recoil-dt*2.7);this.damageGlow=Math.max(0,this.damageGlow-dt*2);
};
