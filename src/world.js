'use strict';
class VoxelWorld {
 constructor(renderer,seed=2401){this.r=renderer;this.seed=seed;this.W=112;this.D=112;this.H=39;this.C=16;this.vox=new Uint8Array(this.W*this.D*this.H);this.top=new Uint8Array(this.W*this.D);this.chunks=new Map();this.dirty=new Set();this.props=[];this.debrisEvents=[];this.ejecta=[];this.generate();this.prepareProps();this.rebuildAll()}
 index(x,y,z){return (y*this.D+z)*this.W+x}
 inBounds(x,y,z){return x>=0&&x<this.W&&z>=0&&z<this.D&&y>=0&&y<this.H}
 getI(x,y,z){if(!this.inBounds(x,y,z))return 0;return this.vox[this.index(x,y,z)]}
 setI(x,y,z,mat){if(!this.inBounds(x,y,z))return false;let i=this.index(x,y,z);if(this.vox[i]===mat)return false;this.vox[i]=mat;return true}
 toX(x){return Math.floor(x+this.W/2)}toZ(z){return Math.floor(z+this.D/2)}
 at(x,y,z){return this.getI(this.toX(x),Math.floor(y),this.toZ(z))}
 solid(x,y,z){return this.at(x,y,z)!==0}
 height(x,z){let ix=this.toX(x),iz=this.toZ(z);if(ix<0||ix>=this.W||iz<0||iz>=this.D)return 0;return this.top[iz*this.W+ix]}
 recalc(ix,iz){if(ix<0||ix>=this.W||iz<0||iz>=this.D)return;let v=0;for(let iy=this.H-1;iy>=0;iy--)if(this.getI(ix,iy,iz)){v=iy+1;break}this.top[iz*this.W+ix]=v}
 rawHeight(x,z){let h=6+4.8*Math.sin(x*.066+1)*Math.cos(z*.047)+3.2*Math.sin(x*.13-z*.043)+2.7*Math.sin(z*.11+x*.055)+1.15*Math.sin(x*.29)*Math.cos(z*.25);let pads=[[-31,-15],[29,21]];for(let p of pads){let d=Math.hypot(x-p[0],z-p[1]);h=lerp(7.5,h,smooth(4.5,15,d))}return clamp(Math.round(h),3,27)}
 generate(){for(let iz=0;iz<this.D;iz++)for(let ix=0;ix<this.W;ix++){let x=ix-this.W/2,z=iz-this.D/2,h=this.rawHeight(x,z),rock=h>17,topMat=rock?3:1;if(h<5)topMat=4;if(h>21)topMat=5;for(let iy=0;iy<h;iy++){let mat=iy<h-5?3:iy<h-1?2:topMat;if(topMat===4&&iy>h-4)mat=4;this.setI(ix,iy,iz,mat)}this.top[iz*this.W+ix]=h}}
 chunkKey(cx,cz){return cx+','+cz}
 mark(ix,iz){let cx=Math.floor(ix/this.C),cz=Math.floor(iz/this.C);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){let x=cx+dx,z=cz+dz;if(x>=0&&z>=0&&x<this.W/this.C&&z<this.D/this.C)this.dirty.add(this.chunkKey(x,z))}}
 rebuildAll(){for(let x=0;x<this.W/this.C;x++)for(let z=0;z<this.D/this.C;z++)this.dirty.add(this.chunkKey(x,z));this.flush(Infinity)}
 flush(limit=3){let n=0;for(let key of this.dirty){this.dirty.delete(key);let [cx,cz]=key.split(',').map(Number),old=this.chunks.get(key);if(old)this.r.dispose(old);let mesh=this.buildChunk(cx,cz);if(mesh)this.chunks.set(key,mesh);else this.chunks.delete(key);if(++n>=limit)break}return n}
 buildChunk(cx,cz){let d=meshData(),sx=cx*this.C,sz=cz*this.C;for(let ix=sx;ix<Math.min(sx+this.C,this.W);ix++)for(let iz=sz;iz<Math.min(sz+this.C,this.D);iz++)for(let iy=0;iy<this.H;iy++){let mat=this.getI(ix,iy,iz);if(!mat)continue;let base=palette[mat]||palette[2],v=.86+rand(ix+iy*1.3,iz+this.seed)*.23,co=base.map(k=>clamp(k*v,0,1)),x=ix-this.W/2,z=iz-this.D/2;for(let [n,points] of FACES){if(this.getI(ix+n[0],iy+n[1],iz+n[2]))continue;quad(d,...points.map(p=>[x+p[0],iy+p[1],z+p[2]]),n,co)}}return this.r.upload(d)}
 editSphere(cx,cy,cz,radius,mat=0){let xa=clamp(Math.floor(cx-radius+this.W/2),0,this.W-1),xb=clamp(Math.ceil(cx+radius+this.W/2),0,this.W-1),za=clamp(Math.floor(cz-radius+this.D/2),0,this.D-1),zb=clamp(Math.ceil(cz+radius+this.D/2),0,this.D-1),ya=clamp(Math.floor(cy-radius),1,this.H-1),yb=clamp(Math.ceil(cy+radius),1,this.H-1),n=0;for(let iz=za;iz<=zb;iz++)for(let ix=xa;ix<=xb;ix++){let dirty=false;for(let iy=ya;iy<=yb;iy++){let dx=ix-this.W/2+.5-cx,dy=iy+.5-cy,dz=iz-this.D/2+.5-cz;if(dx*dx+dy*dy+dz*dz>radius*radius)continue;if(this.setI(ix,iy,iz,mat)){dirty=true;n++}}if(dirty){this.recalc(ix,iz);this.mark(ix,iz)}}this.breakProps(cx,cy,cz,radius);return n}
 tunnel(a,b,radius=2){let d=V3.sub(b,a),dist=V3.len(d),steps=Math.max(1,Math.ceil(dist/(radius*.75))),removed=0;for(let i=0;i<=steps;i++)removed+=this.editSphere(...V3.add(a,V3.mul(d,i/steps)),radius,0);return removed}
 mountain(cx,cy,cz,radius=5){let ra=Math.ceil(radius),made=0;for(let iz=Math.floor(cz-ra);iz<=Math.ceil(cz+ra);iz++)for(let ix=Math.floor(cx-ra);ix<=Math.ceil(cx+ra);ix++){let dx=ix+.5-cx,dz=iz+.5-cz,d=Math.hypot(dx,dz);if(d>radius)continue;let rise=Math.floor(1+radius*1.34*(1-d/radius)**1.15),base=Math.max(1,this.height(ix,iz)-1);for(let iy=base;iy<Math.min(this.H-1,base+rise);iy++)if(this.setI(this.toX(ix),iy,this.toZ(iz),iy>base+rise-2?1:2))made++;let vx=this.toX(ix),vz=this.toZ(iz);this.recalc(vx,vz);this.mark(vx,vz)}return made}
 settle(cx,cy,cz,radius){let xa=clamp(this.toX(cx-radius),1,this.W-2),xb=clamp(this.toX(cx+radius),1,this.W-2),za=clamp(this.toZ(cz-radius),1,this.D-2),zb=clamp(this.toZ(cz+radius),1,this.D-2);for(let iter=0;iter<3;iter++)for(let iz=za;iz<=zb;iz++)for(let ix=xa;ix<=xb;ix++)for(let iy=2;iy<this.H-1;iy++){let m=this.getI(ix,iy,iz);if((m===4||m===2)&&!this.getI(ix,iy-1,iz)){this.setI(ix,iy-1,iz,m);this.setI(ix,iy,iz,0);this.mark(ix,iz)}}for(let iz=za;iz<=zb;iz++)for(let ix=xa;ix<=xb;ix++)this.recalc(ix,iz)}
 propHit(x,y,z){
  for(let p of this.props){
   if(!p.alive||p.kind==='cloud')continue;
   const s=p.scale||1,dx=Math.abs(x-p.x),dz=Math.abs(z-p.z),dy=y-p.y;
   if(p.kind==='tree'&&dy>=0&&dy<3.9*s&&((dy<1.65*s&&dx<.53*s&&dz<.53*s)||(dy>=1.4*s&&dx<.9*s&&dz<.9*s)))return p;
   if(p.kind==='rock'&&dy>=0&&dy<.92*s&&dx<.83*s&&dz<.7*s)return p;
   if(p.kind==='ruin'&&dy>=0&&dy<4.35&&dx<2.5&&dz<3.2)return p;
  }
  return null;
 }
 breakProps(cx,cy,cz,r){
  let broken=0;
  for(let p of this.props){
   if(!p.alive||p.kind==='cloud')continue;
   let s=p.scale||1,extent=p.kind==='ruin'?2.5:p.kind==='tree'?1.65*s:.7*s;
   let centerY=p.y+(p.kind==='tree'?1.6*s:p.kind==='ruin'?2:.4*s);
   if(Math.hypot(p.x-cx,centerY-cy,p.z-cz)>r+extent)continue;
   p.alive=false;p.fallAge=0;p.fallYaw=Math.atan2(p.z-cz,p.x-cx);broken++;
   this.debrisEvents.push({kind:p.kind,x:p.x,y:p.y+(p.kind==='tree'?1.6*s:1),z:p.z,s,material:p.kind==='tree'?6:3});
  }
  return broken;
 }
 // Material outside the rim settles into persistent, irregular voxel heaps.
 queueEjecta(cx,cy,cz,r,removed){
  if(removed<1)return;
  let count=Math.min(135,Math.floor(removed*.17)),places=[],golden=2.39996322973;
  for(let i=0;i<count;i++){
   let angle=i*golden,dist=r+.8+Math.sqrt(rand(cx+i*2.1,cz+i*3.3))*Math.min(3.4,r*.63);
   let wx=Math.floor(cx+Math.cos(angle)*dist),wz=Math.floor(cz+Math.sin(angle)*dist);
   let ix=this.toX(wx),iz=this.toZ(wz);
   if(!this.inBounds(ix,1,iz))continue;
   let top=this.height(wx,wz);if(top<2||top>this.H-3)continue;
   let mat=this.getI(ix,top-1,iz);if(!mat)mat=2;
   places.push({ix,iz,mat:mat===1?2:mat,x:wx,z:wz});
  }
  if(places.length)this.ejecta.push({places,index:0,delay:.12,rate:0});
 }
 tickDestruction(dt){
  for(let p of this.props)if(p.fallAge!==undefined)p.fallAge+=dt;
  for(let j=this.ejecta.length-1;j>=0;j--){
   let job=this.ejecta[j];job.delay-=dt;if(job.delay>0)continue;
   job.rate+=dt*100;let steps=Math.min(12,Math.floor(job.rate));job.rate-=steps;
   for(let k=0;k<steps&&job.index<job.places.length;k++){
    let q=job.places[job.index++],y=this.height(q.x,q.z);
    if(y>this.H-3)continue;
    if(this.setI(q.ix,y,q.iz,q.mat)){this.recalc(q.ix,q.iz);this.mark(q.ix,q.iz);}
   }
   if(job.index>=job.places.length)this.ejecta.splice(j,1);
  }
 }

 prepareProps(){for(let ix=3;ix<this.W-3;ix+=3)for(let iz=3;iz<this.D-3;iz+=3){let x=ix-this.W/2,z=iz-this.D/2,rr=rand(ix+this.seed,iz),h=this.height(x,z),spawn=[[-31,-15],[29,21]].some(p=>Math.hypot(x-p[0],z-p[1])<11);if(spawn||h<5||h>20)continue;if(rr>.79&&this.getI(ix,h-1,iz)===1)this.props.push({kind:'tree',x,y:h,z,scale:.8+rand(ix*2,iz*3)*1.15,alive:true});else if(rr<.055)this.props.push({kind:'rock',x,y:h,z,scale:.7+rr*8,alive:true})}
 for(let [x,z] of [[-5,-23],[9,1],[19,-25],[-24,17],[1,33],[-43,-28]])this.props.push({kind:'ruin',x,y:this.height(x,z),z,scale:1,alive:true});
 for(let i=0;i<9;i++)this.props.push({kind:'cloud',x:-48+i*13,y:35+rand(i,3)*8,z:-23+Math.sin(i*4)*35,scale:2+rand(i,7)*2.5,alive:true})}
 draw(time,eye){let r=this.r;for(let mesh of this.chunks.values())r.draw(mesh,M4.id());r.cube([0,.4,0],[154,.8,154],[.23,.44,.56]);for(let p of this.props){if(!p.alive&&(p.fallAge===undefined||p.fallAge>1.7))continue;let dx=p.x-eye[0],dz=p.z-eye[2];if(dx*dx+dz*dz>110*110)continue;let {x,y,z,scale:s}=p;
 if(p.kind==='tree'){
   let t=p.fallAge===undefined?0:clamp(p.fallAge/1.1,0,1),angle=t*t*1.33,yaw=p.fallYaw||0;
   const trunk=(off,size,col)=>{
    let px=Math.sin(angle)*off*Math.cos(yaw),pz=Math.sin(angle)*off*Math.sin(yaw),py=Math.cos(angle)*off;
    let m=M4.mul(M4.t(x+px,y+py,z+pz),M4.mul(M4.ry(-yaw),M4.mul(M4.rz(-angle),M4.s(...size))));
    r.draw(r.box,m,col);
   };
   trunk(s*.8,[.43*s,1.6*s,.43*s],[.37,.27,.18]);
   trunk(s*1.9,[1.65*s,1.4*s,1.65*s],[.20,.39,.24]);
   trunk(s*2.7,[1.24*s,1.1*s,1.24*s],[.27,.47,.28]);
   trunk(s*3.25,[.8*s,.8*s,.8*s],[.32,.54,.3]);
  }
 else if(p.kind==='rock'){if(!p.alive)continue;r.cube([x,y+s*.45,z],[1.35*s,.8*s,1.1*s],[.43,.46,.45],M4.ry(rand(x,z)*3))}
 else if(p.kind==='ruin'){if(!p.alive)continue;let c=[.59,.52,.42];r.cube([x,y+2,z],[4,4,.65],c);r.cube([x+2,y+1.7,z-1.5],[.7,3.4,3.6],c);r.cube([x-2,y+1.5,z-1.5],[.7,3,3.6],c);r.cube([x,y+3.9,z-1.5],[4.7,.5,3.8],[.51,.43,.37]);r.cube([x,y+.6,z+1.3],[1.9,1.2,.65],[.28,.27,.25])}
 else if(p.kind==='cloud'){let drift=Math.sin(time*.015+p.x)*2,cp=[x+drift,y,z];r.cube(cp,[7*s,1.2*s,2.4*s],[.79,.81,.78]);r.cube([cp[0]+s*2,cp[1]+s*.27,cp[2]],[3*s,1.4*s,2.7*s],[.87,.87,.82])}
 }}
}
