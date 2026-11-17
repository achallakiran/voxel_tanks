'use strict';
const WEAPONS=[
 {id:'cannon',name:'Cannon',icon:'●',col:[1,.72,.30],radius:3.2,damage:35,description:'Reliable direct-impact shell'},
 {id:'mega',name:'Mega',icon:'✹',col:[1,.40,.12],radius:6.1,damage:61,description:'Large blast and deep crater'},
 {id:'cluster',name:'Cluster',icon:'✣',col:[.98,.82,.34],radius:2.3,damage:21,description:'Splits into six bomblets'},
 {id:'digger',name:'Digger',icon:'⛏',col:[.71,.53,1],radius:2.1,damage:23,description:'Carves a tunnel through ground'},
 {id:'mountain',name:'Builder',icon:'▥',col:[.65,.98,.58],radius:5,damage:4,description:'Raises a permanent voxel hill'},
 {id:'roller',name:'Roller',icon:'◉',col:[.52,.86,1],radius:3.6,damage:42,description:'Bounces and rolls before detonation'}
];
class AudioFX{
 constructor(){this.ctx=null;this.volume=.45}
 wake(){try{this.ctx=this.ctx||new (window.AudioContext||window.webkitAudioContext)();if(this.ctx.state==='suspended')this.ctx.resume()}catch(e){}}
 tone(freq,duration=.15,type='sine',gain=.12,sweep=0){if(!this.ctx||this.volume<=0)return;let c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(Math.max(40,freq),t);if(sweep)o.frequency.exponentialRampToValueAtTime(Math.max(40,freq+sweep),t+duration);g.gain.setValueAtTime(gain*this.volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+duration+.01)}
 shot(){this.tone(110,.28,'sawtooth',.2,-75);this.tone(60,.4,'triangle',.3,-22)}
 blast(size=1){this.tone(110*size,.55,'sawtooth',.26,-65*size);this.tone(56,.65,'triangle',.3,-25)}
 hit(){this.tone(430,.2,'square',.09,-260)}
 select(){this.tone(520,.09,'triangle',.13,130)}
}
class Game{
 constructor(){this.canvas=document.getElementById('viewport');this.r=new Renderer(this.canvas);this.world=new VoxelWorld(this.r);this.player=new Tank(-31,-15,this.world);this.enemy=new Tank(29,21,this.world,true);this.audio=new AudioFX();this.mode='menu';this.turn='menu';this.cam='chase';this.cameraPos=[-42,28,-36];this.cameraTarget=[-30,10,-15];this.orbit=0;this.zoom=1;this.wind=0;this.selected=0;this.round=1;this.maxRounds=10;this.moveLeft=21;this.projectiles=[];this.fx=[];this.keys={};this.joy={x:0,y:0};this.time=0;this.prev=performance.now();this.stepAcc=0;this.shooter=null;this.resolveTimer=-1;this.aiTimer=-1;this.paused=false;this.aims=0;this.messageTimer=0;this.shake=0;this.settings={quality:1,difficulty:'normal',invert:false};this.bind();this.ui();requestAnimationFrame(t=>this.frame(t))}
 dom(id){return document.getElementById(id)}
bind(){
 const get=id=>this.dom(id);
 get('startDuel').onclick=()=>this.start('duel');
 get('fire').onclick=()=>this.fire();
 get('pauseButton').onclick=()=>this.openPanel();
 get('closePanel').onclick=()=>this.closePanel();
 get('restartButton').onclick=()=>{this.closePanel();this.start('duel');};
 get('quitButton').onclick=()=>{this.closePanel();this.mode='menu';this.turn='menu';get('menu').classList.remove('hidden');get('hud').classList.remove('active');};
 get('quality').onchange=e=>this.r.quality=Number(e.target.value);
 get('volume').oninput=e=>this.audio.volume=Number(e.target.value);
 get('difficulty').onchange=e=>this.settings.difficulty=e.target.value;
 get('power').addEventListener('input',()=>{this.player.power=Number(get('power').value);this.updateAimText();});
 get('weapons').innerHTML='';
 for(let i=0;i<WEAPONS.length;i++){
  let w=WEAPONS[i],b=document.createElement('button');
  b.className='weaponPick';b.title=w.description;b.innerHTML='<span>'+w.icon+'</span><small>'+w.name+'</small>';
  b.onclick=()=>this.pickWeapon(i);get('weapons').appendChild(b);
 }
 window.addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  this.keys[e.code]=true;
  if(e.repeat)return;
  if(e.code==='Space')this.fire();
  if(e.code==='Escape'){if(get('panel').classList.contains('open'))this.closePanel();else this.openPanel();}
  if(/^Digit[1-6]$/.test(e.code))this.pickWeapon(Number(e.code.slice(-1))-1);
 });
 window.addEventListener('keyup',e=>this.keys[e.code]=false);
 let pointer=null;
 this.canvas.addEventListener('pointerdown',e=>{pointer={id:e.pointerId,x:e.clientX,y:e.clientY};try{this.canvas.setPointerCapture(e.pointerId)}catch(x){}});
 this.canvas.addEventListener('pointermove',e=>{
  if(!pointer||pointer.id!==e.pointerId)return;
  let dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
  pointer.x=e.clientX;pointer.y=e.clientY;
  if(this.handleSceneDrag)this.handleSceneDrag(dx,dy);
  else{this.orbit+=dx*.008;this.zoom=clamp(this.zoom+dy*.003,.6,1.8);}
 });
 this.canvas.addEventListener('pointerup',()=>pointer=null);
 this.canvas.addEventListener('pointercancel',()=>pointer=null);
 this.canvas.addEventListener('wheel',e=>{this.zoom=clamp(this.zoom+Math.sign(e.deltaY)*.085,.6,1.8)},{passive:true});
 window.addEventListener('blur',()=>{this.keys={};this.joy={x:0,y:0};});
 this.pickWeapon(0);
}
  bindJoystick(){let base=this.dom('joyBase'),knob=this.dom('joyKnob'),held=null;let move=e=>{let b=base.getBoundingClientRect(),x=e.clientX-(b.left+b.width/2),y=e.clientY-(b.top+b.height/2),radius=b.width*.34,mag=Math.hypot(x,y),mul=Math.min(1,radius/(mag||1));x*=mul;y*=mul;this.joy.x=x/radius;this.joy.y=-y/radius;knob.style.transform='translate('+x+'px,'+y+'px)'};base.addEventListener('pointerdown',e=>{e.preventDefault();held=e.pointerId;base.setPointerCapture(e.pointerId);move(e)});base.addEventListener('pointermove',e=>{if(e.pointerId===held){e.preventDefault();move(e)}});let release=e=>{if(e.pointerId!==held)return;held=null;this.joy={x:0,y:0};knob.style.transform='translate(0,0)'};base.addEventListener('pointerup',release);base.addEventListener('pointercancel',release)}
updateAimText(){
  const power=this.dom('powerValue');
  if(power)power.textContent=Math.round(this.player.power)+'%';
}
  pickWeapon(i){this.selected=i;let children=this.dom('weapons').children;for(let j=0;j<children.length;j++)children[j].classList.toggle('selected',i===j);this.dom('weaponLabel').textContent=WEAPONS[i].name.toUpperCase();if(this.audio)this.audio.select()}
ui(){
 this.dom('power').value=this.player.power;
 this.updateAimText();
 this.dom('round').textContent='ROUND '+this.round+'/'+this.maxRounds;
 this.dom('wind').textContent='WIND '+(this.wind>0?'→ ':this.wind<0?'← ':'· ')+Math.abs(this.wind).toFixed(1);
 this.dom('fire').disabled=!(this.turn==='player'&&this.mode==='duel'&&!this.paused);
 this.dom('moveLeft').textContent=Math.ceil(this.moveLeft);
}
  toast(s){let el=this.dom('toast');el.textContent=s;el.classList.add('show');clearTimeout(this.toastHandle);this.toastHandle=setTimeout(()=>el.classList.remove('show'),2100)}
 banner(s,sub='',duration=1.7){this.dom('message').textContent=s;this.dom('subMessage').textContent=sub;this.dom('message').style.opacity=1;this.dom('subMessage').style.opacity=1;this.messageTimer=duration}
 openPanel(){this.paused=true;this.dom('panel').classList.add('open')}
 closePanel(){this.dom('panel').classList.remove('open');this.paused=false;this.prev=performance.now()}
 start(mode){this.audio.wake();mode='duel';this.mode=mode;this.turn='player';this.paused=false;this.world=new VoxelWorld(this.r);this.player=new Tank(-31,-15,this.world);this.enemy=new Tank(29,21,this.world,true);this.wind=(Math.random()-.5)*3.4;this.round=1;this.selected=0;this.moveLeft=22;this.projectiles=[];this.fx=[];this.shooter=null;this.resolveTimer=-1;this.aiTimer=-1;this.cam='chase';this.orbit=0;this.dom('menu').classList.add('hidden');this.dom('hud').classList.add('active');this.pickWeapon(0);this.ui();this.banner(mode==='sandbox'?'TERRAIN SANDBOX':'BATTLE START','W · A · S · D TO DRIVE  •  AIM & FIRE',2.5)}
 fire(){if(this.turn!=='player'||this.paused)return;this.launch(this.player,WEAPONS[this.selected]);if(this.mode!=='sandbox'){this.turn='flying';this.shooter='player';this.ui()}else{this.shooter='sandbox';this.moveLeft=22;this.ui()}}
 launch(t,w){let dir=t.direction(),pos=t.muzzle(),speed=t.power*.94;this.projectiles.push({pos,vel:V3.mul(dir,speed),w,owner:t,age:0,life:0,bounce:0,trail:[],frag:false});t.recoil=1;this.audio.shot();this.shake=.15;this.banner(w.name.toUpperCase(),'INCOMING',.55)}
 spawnFX(pos,col,n=42,energy=10){for(let i=0;i<n;i++){if(this.fx.length>260)this.fx.shift();let a=Math.random()*6.283,up=Math.random(),dir=[Math.cos(a)*Math.sqrt(1-up*up),up,Math.sin(a)*Math.sqrt(1-up*up)];this.fx.push({pos:[...pos],vel:V3.mul(dir,energy*(.3+.8*Math.random())),color:col,size:.11+Math.random()*.35,life:.5+Math.random()*1.05,max:1.5})}}
 burstCluster(p){for(let i=0;i<6;i++){let a=i*6.283/6,vel=[p.vel[0]*.54+Math.cos(a)*7,p.vel[1]*.3+6+Math.random()*6,p.vel[2]*.54+Math.sin(a)*7];this.projectiles.push({pos:[...p.pos],vel,w:p.w,owner:p.owner,age:0,bounce:0,trail:[],frag:true})}this.spawnFX(p.pos,p.w.col,22,5);this.audio.tone(620,.24,'triangle',.15,-280)}
 damage(center,rad,damage,owner){for(let t of [this.player,this.enemy]){let d=V3.len(V3.sub(t.position(),center));let hit=clamp(1-d/(rad+2.4),0,1);if(!hit)continue;let dealt=t.applyDamage(damage*hit);if(owner&&owner!==t)owner.score+=Math.round(dealt*1.5);if(dealt>5){this.spawnFX(t.position(),[1,.45,.18],12,6);this.audio.hit()}this.ui()}}
 impact(p,pos){let w=p.w;this.audio.blast(w.radius/4);this.shake=clamp(this.shake+w.radius*.045,0,.9);if(w.id==='cluster'&&!p.frag){this.burstCluster(p);return}let rad=p.frag?2.25:w.radius;if(w.id==='mountain'){let m=this.world.mountain(pos[0],pos[1],pos[2],rad);this.spawnFX(pos,[.64,.97,.48],38,9);this.damage(pos,rad,4,p.owner);this.banner('TERRAIN RAISED','+'+m+' VOXELS',.9)}
 else if(w.id==='digger'){let dir=V3.norm([p.vel[0],-.2,p.vel[2]]),end=V3.add(pos,V3.mul(dir,13));let n=this.world.tunnel(pos,end,rad);this.world.settle(pos[0],pos[1],pos[2],rad+4);this.spawnFX(pos,w.col,55,12);this.spawnFX(end,w.col,35,6);this.damage(pos,rad+3,w.damage,p.owner);this.banner('TUNNEL CUT','−'+n+' VOXELS',.85)}
 else{let removed=this.world.editSphere(...pos,rad,0);if(rad>3)this.world.settle(...pos,rad+2);if(this.world.queueEjecta)this.world.queueEjecta(...pos,rad,removed);if(this.spawnCratersideDebris)this.spawnCratersideDebris(p,pos,rad,removed);this.spawnFX(pos,w.col,Math.floor(20+rad*11),8+rad*1.5);this.spawnFX(pos,[.48,.45,.4],26,6);this.damage(pos,rad,p.frag?21:w.damage,p.owner);if(w.id==='mega')this.banner('MEGA IMPACT','−'+removed+' VOXELS',1.05)}
 this.player.updateHeight(.02,this.world);this.enemy.updateHeight(.02,this.world);
 }
 stepProjectiles(dt){let list=this.projectiles;for(let i=list.length-1;i>=0;i--){let p=list[i];p.age+=dt;if(p.w.id==='cluster'&&!p.frag&&p.age>1.25){list.splice(i,1);this.burstCluster(p);continue}
 p.vel[0]+=this.wind*.36*dt;p.vel[1]-=21*dt;p.pos=V3.add(p.pos,V3.mul(p.vel,dt));if(p.age%0.11<dt)p.trail.unshift([...p.pos]);if(p.trail.length>11)p.trail.pop();
 let collision=this.world.solid(...p.pos);if(this.world.propHit&&this.world.propHit(...p.pos))collision=true;if(p.age>.32&&[this.player,this.enemy].some(t=>V3.len(V3.sub(p.pos,t.position()))<1.9))collision=true;
 if(p.pos[1]<-1||p.pos[1]>100||Math.abs(p.pos[0])>56||Math.abs(p.pos[2])>56||p.age>9)collision=true;
 if(collision){if(p.w.id==='roller'&&p.bounce<4&&p.age<5){p.bounce++;p.vel[0]*=.78;p.vel[2]*=.78;p.vel[1]=p.bounce<3?6:3;let ground=this.world.height(p.pos[0],p.pos[2]);p.pos[1]=Math.max(p.pos[1],ground+1.3);this.spawnFX(p.pos,p.w.col,8,3);this.audio.tone(270,.10,'triangle',.13,-50);continue}
 list.splice(i,1);let ground=this.world.height(p.pos[0],p.pos[2]);this.impact(p,[clamp(p.pos[0],-54,54),clamp(p.pos[1],Math.max(1,ground-3),37),clamp(p.pos[2],-54,54)])}
 }
 }
 updateFX(dt){for(let i=this.fx.length-1;i>=0;i--){let p=this.fx[i];p.life-=dt;if(p.life<=0){this.fx.splice(i,1);continue}p.vel[1]-=12*dt;p.pos=V3.add(p.pos,V3.mul(p.vel,dt));p.vel=V3.mul(p.vel,Math.exp(-1.25*dt))}}
 decideEnemy(){let e=this.enemy,target=this.player,dx=target.x-e.x,dz=target.z-e.z,dist=Math.hypot(dx,dz);if(e.hp<=0)return;let choices=this.settings.difficulty==='easy'?['cannon','cannon','mega','roller']:['mega','cannon','cluster','roller','digger','mountain'];let id=choices[Math.floor(Math.random()*choices.length)],w=WEAPONS.find(w=>w.id===id);if(!w)w=WEAPONS[0];let tx=target.x,tz=target.z,ty=target.y+1.2;
 if(id==='mountain'){tx=lerp(e.x,target.x,.55);tz=lerp(e.z,target.z,.55);ty=this.world.height(tx,tz)}
 let bearing=Math.atan2(tx-e.x,tz-e.z),best={score:Infinity,elev:.65,power:48,yaw:bearing};
 let angles=[.35,.44,.53,.63,.73,.83,.94,1.05,1.15,1.25],powers=[27,32,37,42,47,52,57,63,69,74],offsets=[-.07,0,.07];
 for(let offset of offsets)for(let ang of angles)for(let pow of powers){let yaw=bearing+offset;let pos=[e.x+Math.sin(yaw)*Math.cos(ang)*3.25,e.y+1.77+Math.sin(ang)*3.25,e.z+Math.cos(yaw)*Math.cos(ang)*3.25],v=[Math.sin(yaw)*Math.cos(ang)*pow*.94,Math.sin(ang)*pow*.94,Math.cos(yaw)*Math.cos(ang)*pow*.94],hit=null;
 for(let step=0;step<225;step++){v[0]+=this.wind*.36*.055;v[1]-=21*.055;pos[0]+=v[0]*.055;pos[1]+=v[1]*.055;pos[2]+=v[2]*.055;if(this.world.solid(...pos)||pos[1]<=0||Math.abs(pos[0])>56||Math.abs(pos[2])>56){hit=pos;break}}if(!hit)continue;let error=Math.hypot(hit[0]-tx,hit[2]-tz)+Math.abs(hit[1]-ty)*.19;if(error<best.score)best={score:error,elev:ang,power:pow,yaw}}
 let difficulty=this.settings.difficulty,spread=difficulty==='easy'?.14:difficulty==='hard'?.015:difficulty==='expert'?.004:.055;e.turret=best.yaw-e.yaw+(Math.random()-.5)*spread;e.elev=best.elev+(Math.random()-.5)*spread*.6;e.power=best.power+(Math.random()-.5)*spread*22;
 this.banner('ENEMY FIRING',w.name.toUpperCase(),.85);this.launch(e,w);this.turn='flying';this.shooter='enemy';this.ui()}
 afterVolley(){this.resolveTimer=-1;if(this.player.hp<=0||this.enemy.hp<=0){this.finish();return}if(this.shooter==='player'){this.turn='enemy';this.aiTimer=1.15;this.banner('ENEMY TURN','ANALYSING TRAJECTORY',1);this.ui()}else if(this.shooter==='enemy'){this.round++;if(this.round>this.maxRounds&&this.mode==='duel'){this.finish();return}this.turn='player';this.wind=clamp(this.wind+(Math.random()-.5)*1.25,-2.2,2.2);this.moveLeft=22;this.banner('YOUR TURN','REPOSITION • AIM • FIRE',1.25);this.ui()}}
 finish(){
  this.turn='end';
  const diff=this.player.hp-this.enemy.hp;
  let outcome=this.player.hp<=0?'DEFEAT':this.enemy.hp<=0?'VICTORY':diff>=0?'VICTORY':'DEFEAT';
  this.banner(outcome,'',999);
  this.audio.tone(outcome==='VICTORY'?670:210,.7,'triangle',.25,outcome==='VICTORY'?250:-140);
  this.dom('turnNotice').classList.add('show');
  this.dom('turnTitle').textContent=outcome;
  this.dom('turnDetails').textContent='YOU '+Math.ceil(this.player.hp)+'% • ENEMY '+Math.ceil(this.enemy.hp)+'% • '+this.round+' ROUNDS';
  this.dom('turnAction').onclick=()=>{this.dom('turnNotice').classList.remove('show');this.start('duel');};
 }
  update(dt){this.time+=dt;if(this.messageTimer>0){this.messageTimer-=dt;if(this.messageTimer<=0){this.dom('message').style.opacity=0;this.dom('subMessage').style.opacity=0}}
 let p=this.player,e=this.enemy;
 if(this.turn==='player'){let move=(this.keys.KeyW||this.keys.ArrowUp?1:0)-(this.keys.KeyS||this.keys.ArrowDown?1:0)+this.joy.y,steer=(this.keys.KeyD||this.keys.ArrowRight?1:0)-(this.keys.KeyA||this.keys.ArrowLeft?1:0)+this.joy.x;move=clamp(move,-1,1);steer=clamp(steer,-1,1);if(this.settings.invert)move=-move;if(this.moveLeft<=0)move=0;let before=[p.x,p.z];p.update(dt,move,steer,this.world);this.moveLeft=Math.max(0,this.moveLeft-Math.hypot(p.x-before[0],p.z-before[1]));}else{p.updateHeight(dt,this.world)}e.updateHeight(dt,this.world);
 if(this.turn==='enemy'){let desired=Math.atan2(p.x-e.x,p.z-e.z),difference=Math.atan2(Math.sin(desired-e.yaw),Math.cos(desired-e.yaw));let steer=clamp(difference*1.4,-1,1);if(this.aiTimer>.42)e.update(dt,.68,steer,this.world);this.aiTimer-=dt;if(this.aiTimer<=0)this.decideEnemy()}
 if(this.projectiles.length){this.stepAcc+=dt;let ticks=0;while(this.stepAcc>=1/60&&ticks++<6){this.stepProjectiles(1/60);this.stepAcc-=1/60}if(this.projectiles.length===0&&this.turn==='flying')this.resolveTimer=1}
 else if(this.turn==='flying'&&this.resolveTimer<0)this.resolveTimer=.8;
 if(this.turn==='flying'&&this.resolveTimer>=0){this.resolveTimer-=dt;if(this.resolveTimer<=0)this.afterVolley()}
 this.updateFX(dt);this.shake*=Math.exp(-7*dt);this.world.flush(3);if(Math.floor(this.time*8)%8===0)this.uiLight()}
 uiLight(){if(this.mode==='menu')return;this.dom('moveLeft').textContent=Math.ceil(this.moveLeft)}
 predict(){let t=this.player,dir=t.direction(),pos=t.muzzle(),v=V3.mul(dir,t.power*.94),dots=[];for(let i=0;i<105;i++){v[0]+=this.wind*.36*.05;v[1]-=21*.05;pos=V3.add(pos,V3.mul(v,.05));if(i%5===0)dots.push([...pos]);if(pos[1]<0||this.world.solid(...pos)||Math.abs(pos[0])>56||Math.abs(pos[2])>56)break}return dots}
 camera(){let p=this.player,e=this.enemy,eye,target,t=this.time;if(this.mode==='menu'){let a=t*.12+.7,dist=23;target=[p.x,p.y+2.5,p.z];eye=[p.x+Math.sin(a)*dist,p.y+12,p.z+Math.cos(a)*dist]}
 else if(this.projectiles.length&&this.turn==='flying'&&this.cam!=='strategy'){let q=this.projectiles[0],v=V3.norm(q.vel);target=V3.add(q.pos,V3.mul(v,4));eye=V3.add(V3.sub(q.pos,V3.mul(v,11)),[0,4.5,0])}
 else if(this.cam==='strategy'){target=[(p.x+e.x)/2,7,(p.z+e.z)/2];eye=[target[0]+12,target[1]+94*this.zoom,target[2]+37*this.zoom]}
 else{let a=p.yaw+this.orbit,dist=(this.cam==='orbit'?23:15)*this.zoom,side=this.cam==='orbit'?3:2;target=[p.x,p.y+2.3,p.z];eye=[p.x-Math.sin(a)*dist+Math.cos(a)*side,p.y+7.8*this.zoom,p.z-Math.cos(a)*dist-Math.sin(a)*side]}
 this.cameraPos=this.cameraPos.map((x,i)=>lerp(x,eye[i],this.mode==='menu'?.045:.13));this.cameraTarget=this.cameraTarget.map((x,i)=>lerp(x,target[i],.16));let sh=this.shake;return [this.cameraPos.map(x=>x+(Math.random()-.5)*sh),this.cameraTarget]}
 draw(time){let [eye,target]=this.camera();this.r.begin(eye,target,this.time);this.world.draw(this.time,eye);this.player.render(this.r,this.time);this.enemy.render(this.r,this.time);
 if(this.turn==='player'&&this.mode!=='menu')for(let [i,pt] of this.predict().entries()){let s=i%2===0?.19:.14;this.r.cube(pt,[s,s,s],[1,.84,.36])}
 for(let p of this.projectiles){let co=p.w.col;for(let i=0;i<p.trail.length;i++){let q=p.trail[i],s=.21*(1-i/p.trail.length)+.04;this.r.cube(q,[s,s,s],co)}let s=p.w.id==='mega'?.63:p.w.id==='roller'?.66:.39;this.r.cube(p.pos,[s,s,s],co);this.r.cube(p.pos,[s*.35,s*.35,s*.35],[1,1,.8])}
 for(let p of this.fx){let alpha=clamp(p.life/1.4,.08,.9),s=p.size*clamp(p.life,0,1.2);this.r.cube(p.pos,[s,s,s],p.color,null,alpha)}
 this.drawRadar()}
 drawRadar(){if(this.mode==='menu')return;let c=this.dom('radar');if(!c||getComputedStyle(c).display==='none')return;let ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);let m=w/2;ctx.fillStyle='rgba(9,31,40,.75)';ctx.beginPath();ctx.arc(m,m,m-2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(222,237,226,.24)';for(let rad of [.35,.7,.94]){ctx.beginPath();ctx.arc(m,m,m*rad,0,6.283);ctx.stroke()}for(let [t,col] of [[this.player,'#91ffd2'],[this.enemy,'#ff9e80']]){let x=m+t.x/56*m*.88,y=m+t.z/56*m*.88;ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,5,0,6.283);ctx.fill()}ctx.fillStyle='#c7d7cd';ctx.font='bold 10px system-ui';ctx.fillText('N',m-3,11)}
 frame(now){let dt=clamp((now-this.prev)/1000,0,.05);this.prev=now;if(!this.paused)this.update(dt);this.draw(now);requestAnimationFrame(t=>this.frame(t))}
}
window.addEventListener('DOMContentLoaded',()=>{try{window.voxelTanks=new Game()}catch(e){console.error(e);let title=document.getElementById('errorMessage');if(title){title.style.display='block';title.textContent='Cannot start Voxel Tanks: '+e.message}}});
