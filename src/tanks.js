'use strict';
function transformPoint(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]]}
class Tank{
 constructor(x,z,world,enemy=false){this.x=x;this.z=z;this.y=world.height(x,z)+.18;this.yaw=enemy?Math.PI+2.4:-.45;this.turret=0;this.elev=.62;this.power=43;this.hp=100;this.score=0;this.enemy=enemy;this.color=enemy?[.65,.34,.27]:[.31,.55,.43];this.velocity=0;this.roll=0;this.pitch=0;this.trackPhase=0;this.recoil=0;this.damageGlow=0;this.lastHeading=this.yaw;}
 base(){return M4.mul(M4.mul(M4.mul(M4.t(this.x,this.y,this.z),M4.ry(this.yaw)),M4.rz(this.roll)),M4.rx(this.pitch))}
 position(){return [this.x,this.y+1.25,this.z]}
 aimYaw(){return this.yaw+this.turret}
 direction(){let a=this.aimYaw();return [Math.sin(a)*Math.cos(this.elev),Math.sin(this.elev),Math.cos(a)*Math.cos(this.elev)]}
 muzzle(){let a=this.aimYaw(),d=this.direction();return [this.x+d[0]*3.25,this.y+1.77+d[1]*3.25,this.z+d[2]*3.25]}
 update(dt,throttle,steer,world){let speed=(throttle>0?7.8:5.5),moving=Math.abs(throttle)>.06;this.velocity=lerp(this.velocity,throttle*speed,1-Math.exp(-3.8*dt));if(!moving)this.velocity*=Math.exp(-5*dt);this.yaw+=steer*dt*(.95+Math.abs(this.velocity)*.095)*(this.velocity<-.05?-1:1);this.trackPhase+=this.velocity*dt*1.4;let nx=this.x+Math.sin(this.yaw)*this.velocity*dt,nz=this.z+Math.cos(this.yaw)*this.velocity*dt;nx=clamp(nx,-world.W/2+3,world.W/2-3);nz=clamp(nz,-world.D/2+3,world.D/2-3);let a=world.height(this.x,this.z),b=world.height(nx,nz);if(b-a<3.5){this.x=nx;this.z=nz}else this.velocity*=.2;this.updateHeight(dt,world)}
 updateHeight(dt,world){let ground=world.height(this.x,this.z)+.18;this.y=lerp(this.y,ground,1-Math.exp(-6*dt));let fx=Math.sin(this.yaw)*2.0,fz=Math.cos(this.yaw)*2.0,sx=Math.cos(this.yaw)*1.0,sz=-Math.sin(this.yaw)*1.0,fore=world.height(this.x+fx,this.z+fz),back=world.height(this.x-fx,this.z-fz),left=world.height(this.x-sx,this.z-sz),right=world.height(this.x+sx,this.z+sz);this.pitch=lerp(this.pitch,clamp(Math.atan2(back-fore,4),-.35,.35),1-Math.exp(-5*dt));this.roll=lerp(this.roll,clamp(Math.atan2(left-right,2.5),-.3,.3),1-Math.exp(-5*dt));this.recoil=Math.max(0,this.recoil-dt*2.7);this.damageGlow=Math.max(0,this.damageGlow-dt*2)}
 applyDamage(amount){let real=clamp(amount,0,100);this.hp=clamp(this.hp-real,0,100);this.damageGlow=.65;return real}
 render(r,time){let base=this.base(),hull=this.color,light=hull.map(v=>clamp(v*1.31,0,1)),dark=hull.map(v=>v*.62),metal=[.20,.27,.29],rubber=[.13,.15,.17],accent=this.enemy?[.96,.54,.34]:[.97,.78,.32],wheel=[.29,.32,.32];
 const box=(p,s,c,rot=null)=>{let m=M4.mul(base,M4.t(...p));if(rot)m=M4.mul(m,rot);r.draw(r.box,M4.mul(m,M4.s(...s)),c)};
 const cyl=(p,s,c,rot=null)=>{let m=M4.mul(base,M4.t(...p));if(rot)m=M4.mul(m,rot);r.draw(r.cyl,M4.mul(m,M4.s(...s)),c)};
 box([0,.58,0],[2.85,.72,4.25],dark);box([0,1.04,0],[2.42,.62,3.57],hull);box([0,1.24,1.25],[2.21,.33,1.05],light,M4.rx(.26));box([0,1.17,-1.63],[2.4,.45,.65],dark);
 box([0,.89,-1.93],[1.7,.28,.17],metal);
 for(let side of [-1,1]){
  box([side*1.27,.51,0],[.46,.9,3.92],rubber);
  box([side*1.30,.99,0],[.52,.19,3.8],metal);
  box([side*1.3,.08,0],[.54,.17,3.82],metal);
  for(let i=0;i<5;i++){let z=-1.55+i*.78;cyl([side*1.48,.52,z],[.23,.72,.72],wheel,M4.rz(Math.PI/2));cyl([side*1.615,.52,z],[.05,.28,.28],light,M4.rz(Math.PI/2))}
  for(let i=0;i<9;i++){let z=-1.75+i*.44;box([side*1.32,1.04,z],[.56,.09,.095],rubber);box([side*1.32,.05,z],[.56,.09,.095],rubber)}
  box([side*1.02,1.31,-1.0],[.25,.24,.8],dark);
 }
 box([0,1.52,0],[1.94,.25,2.15],metal);cyl([0,1.7,-.05],[2.04,.42,1.82],dark);
 let tm=M4.mul(base,M4.mul(M4.t(0,1.76,-.04),M4.ry(this.turret)));
 const tbox=(p,s,c,rot=null)=>{let m=M4.mul(tm,M4.t(...p));if(rot)m=M4.mul(m,rot);r.draw(r.box,M4.mul(m,M4.s(...s)),c)};
 const tcyl=(p,s,c,rot=null)=>{let m=M4.mul(tm,M4.t(...p));if(rot)m=M4.mul(m,rot);r.draw(r.cyl,M4.mul(m,M4.s(...s)),c)};
 tbox([0,.15,-.23],[1.79,.64,1.8],light);tbox([0,.28,.61],[1.51,.44,.78],hull,M4.rx(-.17));tbox([0,.54,-.18],[1.2,.11,1.04],dark);
 tbox([.51,.55,-.48],[.37,.17,.47],metal);tbox([-.5,.55,-.48],[.38,.18,.47],metal);
 tcyl([-.17,.68,-.52],[.64,.24,.64],metal);tcyl([-.17,.87,-.52],[.18,.16,.18],dark);
 let d=[0,Math.sin(this.elev),Math.cos(this.elev)],center=[0,d[1]*(1.29-this.recoil*.22),.55+d[2]*(1.29-this.recoil*.22)];
 tcyl(center,[.39,2.52,.39],metal,M4.rx(Math.PI/2-this.elev));
 tbox([0,.03+d[1]*2.49,.55+d[2]*2.49],[.58,.52,.58],dark,M4.rx(-this.elev));
 tcyl([0,d[1]*2.62,.55+d[2]*2.62],[.46,.2,.46],accent,M4.rx(Math.PI/2-this.elev));
 tbox([-.55,.05,-1.0],[.42,.17,.13],accent);tbox([.55,.05,-1.0],[.42,.17,.13],accent);
 if(this.hp<60){let smoke=(60-this.hp)/60;for(let j=0;j<3;j++){let pt=[this.x+Math.sin(time*.4+j)*(.4+j*.25),this.y+3+j*.63+(time*.55)%1.2,this.z-1.3];r.cube(pt,[.40+j*.18,.33+j*.12,.43+j*.18],[.22,.25,.25],null,.5*smoke)}}
 if(this.damageGlow>0){let p=[this.x,this.y+2.6,this.z];r.cube(p,[.46,.24,.46],[1,.37,.13],null,this.damageGlow*.6)}
 }
}
