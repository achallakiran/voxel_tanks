'use strict';
// Voxel Tanks v0.3.2 — distance-budget analog movement, deliberately minimal UI.
// One distance meter per turn, not six match-wide action tokens.
const DRIVE_TURN_DISTANCE=8;
const DRIVE_FORWARD_SPEED=5.4;
const DRIVE_REVERSE_SPEED=3.5;
const DRIVE_TURN_SPEED=1.65;
const DRIVE_DEAD_ZONE=.11;

const DRIVE_OLD_BIND=Game.prototype.bind;
Game.prototype.bind=function(){
 DRIVE_OLD_BIND.call(this);
 const base=this.dom('joyBase'),knob=this.dom('joyKnob');
 if(!base||!knob)throw Error('Missing movement joystick');
 let active=null;
 const movePointer=e=>{
  const rect=base.getBoundingClientRect();
  const radius=Math.max(18,rect.width*.34);
  const dx=e.clientX-(rect.left+rect.width*.5),dy=e.clientY-(rect.top+rect.height*.5);
  const size=Math.hypot(dx,dy),factor=size?Math.min(1,radius/size):1;
  const x=dx*factor,y=dy*factor;
  this.joy.x=Math.abs(x/radius)<DRIVE_DEAD_ZONE?0:x/radius;
  this.joy.y=Math.abs(y/radius)<DRIVE_DEAD_ZONE?0:-y/radius;
  knob.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)';
 };
 base.addEventListener('pointerdown',e=>{
  if(active!==null||this.mode!=='duel'||this.turn!=='player'||this.paused)return;
  e.preventDefault();e.stopPropagation();
  active=e.pointerId;
  try{base.setPointerCapture(e.pointerId)}catch(err){}
  movePointer(e);
 });
 base.addEventListener('pointermove',e=>{
  if(e.pointerId!==active)return;
  e.preventDefault();movePointer(e);
 });
 const release=e=>{
  if(e.pointerId!==active)return;
  active=null;this.joy={x:0,y:0};knob.style.transform='translate(0px,0px)';
 };
 base.addEventListener('pointerup',release);
 base.addEventListener('pointercancel',release);
 base.addEventListener('lostpointercapture',release);
 window.addEventListener('blur',()=>{this.resetDriveJoystick();active=null;});
 const adjust=(id,delta)=>{
  const button=this.dom(id);
  if(!button)throw Error('Missing precision power button: '+id);
  button.addEventListener('click',e=>{
   e.preventDefault();
   if(this.mode!=='duel'||this.turn!=='player'||this.paused)return;
   this.setPowerExact(this.player.power+delta);
  });
 };
 adjust('powerPlus',1);adjust('powerMinus',-1);
};
Game.prototype.resetDriveJoystick=function(){
 this.joy={x:0,y:0};
 const knob=this.dom('joyKnob');
 if(knob)knob.style.transform='translate(0px,0px)';
};
Game.prototype.setPowerExact=function(value){
 const next=clamp(Math.round(value),22,75);
 this.player.power=next;
 this.dom('power').value=String(next);
 this.updateAimText();
 this._arcCache=null;
 return next;
};
Game.prototype.renderMovementGauge=function(){
 if(this.movementRemaining===undefined)return;
 const max=this.movementMax||DRIVE_TURN_DISTANCE;
 const ratio=clamp(this.movementRemaining/max,0,1);
 const fill=this.dom('moveMeterFill'),gauge=this.dom('movementGauge');
 if(fill)fill.style.width=(ratio*100).toFixed(1)+'%';
 if(gauge)gauge.setAttribute('aria-valuenow',String(Math.round(ratio*max*10)/10));
 const active=this.mode==='duel'&&this.turn==='player'&&!this.paused;
 const hud=this.dom('hud');
 if(hud)hud.classList.toggle('canMove',active);
 if(this.dom('moveLeft'))this.dom('moveLeft').textContent=this.movementRemaining.toFixed(1);
};
Game.prototype.driveByJoystick=function(dt){
 if(this.mode!=='duel'||this.turn!=='player'||this.paused||this.projectiles.length)return;
 const t=this.player,joy=this.joy||{x:0,y:0},keys=this.keys||{};
 let move=clamp(((keys.KeyW||keys.ArrowUp)?1:0)-((keys.KeyS||keys.ArrowDown)?1:0)+joy.y,-1,1);
 let steer=clamp(((keys.KeyD||keys.ArrowRight)?1:0)-((keys.KeyA||keys.ArrowLeft)?1:0)+joy.x,-1,1);
 if(Math.abs(move)<DRIVE_DEAD_ZONE)move=0;
 if(Math.abs(steer)<DRIVE_DEAD_ZONE)steer=0;
 if(!move&&!steer){t.velocity=0;return;}
 // Rotating in place does not consume fuel or sneak in extra translation.
 if(steer){
  const aim=t.aimYaw();
  t.yaw+=steer*DRIVE_TURN_SPEED*dt;
  t.turret=Math.atan2(Math.sin(aim-t.yaw),Math.cos(aim-t.yaw));
  this.orbit=t.turret;
 }
 if(!move||this.movementRemaining<=0){t.velocity=0;return;}
 const rawSpeed=(move>0?DRIVE_FORWARD_SPEED:DRIVE_REVERSE_SPEED)*move;
 const requested=Math.min(Math.abs(rawSpeed)*dt,this.movementRemaining);
 if(requested<.000001)return;
 const signed=Math.sign(move)*requested;
 const nx=t.x+Math.sin(t.yaw)*signed,nz=t.z+Math.cos(t.yaw)*signed;
 if(Math.abs(nx)>this.world.W*.5-3||Math.abs(nz)>this.world.D*.5-3)return;
 const nav=this.navigator||new SurfaceNavigator(this.world);
 const startGround=nav.support(t.x,t.z,t.y+.95);
 const nextGround=nav.support(nx,nz,t.y+.95);
 if(nextGround===null||startGround===null||Math.abs(nextGround-startGround)>1.25){t.velocity=0;return;}
 // A tank must fit around boulders, tree trunks and constructed walls.
 const forwardX=Math.sin(t.yaw),forwardZ=Math.cos(t.yaw);
 const testPoints=[[nx,nz],[nx+forwardX*.9,nz+forwardZ*.9],[nx-forwardX*.7,nz-forwardZ*.7]];
 for(const [px,pz] of testPoints){
  if(this.world.propHit&&this.world.propHit(px,nextGround+.9,pz)){t.velocity=0;return;}
 }
 t.x=nx;t.z=nz;t.trackPhase+=signed*1.35;
 t.velocity=0;t.updateHeight(dt,this.world);
 const actual=Math.hypot(nx-(nx-forwardX*signed),nz-(nz-forwardZ*signed));
 this.movementRemaining=Math.max(0,this.movementRemaining-actual);
};
const DRIVE_OLD_START=Game.prototype.start;
Game.prototype.start=function(mode){
 DRIVE_OLD_START.call(this,'duel');
 this.movementMax=DRIVE_TURN_DISTANCE;
 this.movementRemaining=this.movementMax;
 this.enemyMovementRemaining=this.movementMax;
 this.enemyCredits=1;
 this.moveLeft=this.movementRemaining;
 this.tankSelected=false;this.movementHalo=[];this.movingPath=null;this.movePlan=null;
 this.resetDriveJoystick();
 this.renderMovementGauge();
 this.banner('DRIVE • AIM • FIRE','JOYSTICK • TAP TANK FOR AIM • POWER +/-',2.1);
};
const DRIVE_OLD_AFTER=Game.prototype.afterVolley;
Game.prototype.afterVolley=function(){
 DRIVE_OLD_AFTER.call(this);
 if(this.turn==='player'){
  this.movementRemaining=this.movementMax||DRIVE_TURN_DISTANCE;
  this.resetDriveJoystick();
 }else if(this.turn==='enemy'){
  this.enemyMovementRemaining=this.movementMax||DRIVE_TURN_DISTANCE;
  this.enemyCredits=1; // The enemy can also reposition once, up to one turn's distance.
  this.resetDriveJoystick();
 }
 this.moveLeft=this.movementRemaining;
 this.renderMovementGauge();
};
const DRIVE_OLD_FIRE=Game.prototype.fire;
Game.prototype.fire=function(){
 DRIVE_OLD_FIRE.call(this);
 if(this.turn!=='player')this.resetDriveJoystick();
 this.renderMovementGauge();
};
const DRIVE_OLD_PANEL=Game.prototype.openPanel;
Game.prototype.openPanel=function(){
 this.resetDriveJoystick();DRIVE_OLD_PANEL.call(this);this.renderMovementGauge();
};
const DRIVE_OLD_CLOSE=Game.prototype.closePanel;
Game.prototype.closePanel=function(){DRIVE_OLD_CLOSE.call(this);this.renderMovementGauge();};
const DRIVE_OLD_UPDATE=Game.prototype.update;
Game.prototype.update=function(dt){
 // v0.2 turn simulation still handles ballistics and the enemy's terrain path.
 // Stop its old free-driving/inertial motion; apply our constrained joystick drive after.
 if(this.player)this.player.velocity=0;
 const beforeEnemy=this.enemy?[this.enemy.x,this.enemy.z]:null;
 DRIVE_OLD_UPDATE.call(this,dt);
 if(beforeEnemy&&this.enemyMovementRemaining!==undefined){
  const dist=Math.hypot(this.enemy.x-beforeEnemy[0],this.enemy.z-beforeEnemy[1]);
  if(dist>0){
   this.enemyMovementRemaining=Math.max(0,this.enemyMovementRemaining-dist);
   if(this.enemyMovementRemaining<=.00001){this.enemyPath=null;this.enemyCredits=0;}
  }
 }
 if(this.turn==='player'&&!this.paused)this.driveByJoystick(dt);
 else if(this.joy&&(Math.abs(this.joy.x)>0||Math.abs(this.joy.y)>0))this.resetDriveJoystick();
 if(this.movementRemaining!==undefined){
  this.moveLeft=this.movementRemaining;
  this.renderMovementGauge();
 }
};
const DRIVE_OLD_AIM=Game.prototype.canAdjustTankAim;
Game.prototype.canAdjustTankAim=function(){
 return DRIVE_OLD_AIM.call(this)&&Math.abs(this.joy?.x||0)<DRIVE_DEAD_ZONE&&Math.abs(this.joy?.y||0)<DRIVE_DEAD_ZONE;
};
