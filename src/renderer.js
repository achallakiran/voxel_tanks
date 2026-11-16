'use strict';
const V3={add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len:a=>Math.hypot(...a),norm:a=>{let m=Math.hypot(...a)||1;return a.map(v=>v/m)}};
const M4={
 id(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])},
 mul(a,b){let o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o},
 t(x,y,z){let m=this.id();m[12]=x;m[13]=y;m[14]=z;return m},
 s(x,y,z){let m=this.id();m[0]=x;m[5]=y;m[10]=z;return m},
 ry(a){let m=this.id(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m},
 rx(a){let m=this.id(),c=Math.cos(a),s=Math.sin(a);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m},
 rz(a){let m=this.id(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m},
 trs(pos,rot,scale){let m=this.t(...pos);if(rot)m=this.mul(m,rot);return this.mul(m,this.s(...scale))},
 perspective(fov,aspect,near,far){let f=1/Math.tan(fov/2),m=new Float32Array(16);m[0]=f/aspect;m[5]=f;m[10]=(far+near)/(near-far);m[11]=-1;m[14]=2*far*near/(near-far);return m},
 look(eye,target){let z=V3.norm(V3.sub(eye,target)),x=V3.norm(V3.cross([0,1,0],z)),y=V3.cross(z,x),m=this.id();m[0]=x[0];m[1]=y[0];m[2]=z[0];m[4]=x[1];m[5]=y[1];m[6]=z[1];m[8]=x[2];m[9]=y[2];m[10]=z[2];m[12]=-V3.dot(x,eye);m[13]=-V3.dot(y,eye);m[14]=-V3.dot(z,eye);return m}
};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,v)=>{let t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
function noise(x,z){return Math.sin(x*1.71+z*5.91)*Math.sin(x*8.11-z*2.47)}
function rand(x,z){let v=Math.sin(x*127.1+z*311.7)*43758.5453;return v-Math.floor(v)}
const palette={1:[.32,.59,.32],2:[.38,.27,.17],3:[.43,.45,.47],4:[.72,.57,.33],5:[.82,.88,.85],6:[.50,.36,.22],7:[.29,.41,.49],8:[.64,.51,.32]};
const hex=n=>[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];
function meshData(){return {v:[],i:[]}}
function quad(d,a,b,c,e,n,col){let ab=V3.sub(b,a),ac=V3.sub(c,a);if(V3.dot(V3.cross(ab,ac),n)<0){let t=b;b=e;e=t}let start=d.v.length/9;for(let p of [a,b,c,e])d.v.push(p[0],p[1],p[2],n[0],n[1],n[2],col[0],col[1],col[2]);d.i.push(start,start+1,start+2,start,start+2,start+3)}
const FACES=[
 [[1,0,0],[[1,0,0],[1,0,1],[1,1,1],[1,1,0]]],
 [[-1,0,0],[[0,0,0],[0,1,0],[0,1,1],[0,0,1]]],
 [[0,1,0],[[0,1,0],[1,1,0],[1,1,1],[0,1,1]]],
 [[0,-1,0],[[0,0,0],[0,0,1],[1,0,1],[1,0,0]]],
 [[0,0,1],[[0,0,1],[0,1,1],[1,1,1],[1,0,1]]],
 [[0,0,-1],[[0,0,0],[1,0,0],[1,1,0],[0,1,0]]]
];
function makeBox(){let d=meshData();for(let [n,p] of FACES)quad(d,...p.map(v=>v.map(k=>k-.5)),n,[1,1,1]);return d}
function makeCylinder(segments=14){let d=meshData();for(let i=0;i<segments;i++){let a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments,pa=[Math.sin(a)*.5,-.5,Math.cos(a)*.5],pb=[Math.sin(b)*.5,-.5,Math.cos(b)*.5],qa=[pa[0],.5,pa[2]],qb=[pb[0],.5,pb[2]],n=V3.norm([Math.sin((a+b)/2),0,Math.cos((a+b)/2)]);quad(d,pa,pb,qb,qa,n,[1,1,1]);quad(d,[0,.5,0],qa,qb,[0,.5,0],[0,1,0],[1,1,1]);quad(d,[0,-.5,0],pb,pa,[0,-.5,0],[0,-1,0],[1,1,1])}return d}
function createShader(gl,type,src){let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
function program(gl,v,f){let p=gl.createProgram();gl.attachShader(p,createShader(gl,gl.VERTEX_SHADER,v));gl.attachShader(p,createShader(gl,gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
const VERT=['#version 300 es','precision highp float;','layout(location=0) in vec3 position; layout(location=1) in vec3 normal; layout(location=2) in vec3 color;','uniform mat4 uVP;uniform mat4 uModel;out vec3 vColor;out vec3 vNormal;out vec3 vWorld;','void main(){vec4 w=uModel*vec4(position,1.0);vWorld=w.xyz;vNormal=mat3(uModel)*normal;vColor=color;gl_Position=uVP*w;}'].join('\n');
const FRAG=['#version 300 es','precision highp float;','in vec3 vColor;in vec3 vNormal;in vec3 vWorld;','uniform vec3 uTint;uniform vec3 uCamera;uniform vec3 uFog;uniform float uAlpha;out vec4 frag;','void main(){vec3 N=normalize(vNormal);vec3 light=normalize(vec3(-.49,.84,-.30));float nd=max(dot(N,light),0.0);float shade=.53+nd*.49+max(N.y,0.)*.14;vec3 rgb=vColor*uTint*shade;float fog=1.0-exp(-pow(distance(vWorld,uCamera)/125.,2.2));rgb=mix(rgb,uFog,clamp(fog,0.,.92));frag=vec4(pow(max(rgb,vec3(0.0)),vec3(.88)),uAlpha);}'].join('\n');
const SKYV=['#version 300 es','out vec2 uv;void main(){vec2 pos=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=pos;gl_Position=vec4(pos*2.-1.,0.,1.);}'].join('\n');
const SKYF=['#version 300 es','precision highp float;','in vec2 uv;out vec4 frag;uniform vec2 uResolution;uniform float uTime;uniform float uDay;','void main(){vec2 v=gl_FragCoord.xy/uResolution;float t=clamp(v.y,0.,1.);vec3 horizon=mix(vec3(.78,.71,.54),vec3(.96,.74,.50),uDay);vec3 zenith=mix(vec3(.08,.14,.26),vec3(.18,.43,.62),uDay);vec3 col=mix(horizon,zenith,smoothstep(.11,.95,t));float sun=exp(-length((v-vec2(.74,.78))*vec2(1.65,1.))*29.);col+=vec3(1.,.68,.23)*sun*.78;float cloud=sin(v.x*21.+uTime*.016+sin(v.y*19.)*1.9)*sin(v.x*11.-v.y*32.)*.5+.5;col+=vec3(.28,.24,.16)*smoothstep(.74,.95,cloud)*.18*smoothstep(.47,.76,v.y);frag=vec4(col,1.);}'].join('\n');
class Renderer{
 constructor(canvas){this.canvas=canvas;let gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance',depth:true});if(!gl)throw Error('WebGL 2 is unavailable in this browser.');this.gl=gl;this.program=program(gl,VERT,FRAG);this.sky=program(gl,SKYV,SKYF);this.u={};for(let n of ['uVP','uModel','uTint','uCamera','uFog','uAlpha'])this.u[n]=gl.getUniformLocation(this.program,n);this.su={};for(let n of ['uResolution','uTime','uDay'])this.su[n]=gl.getUniformLocation(this.sky,n);this.box=this.upload(makeBox());this.cyl=this.upload(makeCylinder());this.eye=[0,30,60];this.fog=[.70,.72,.64];this.quality=1;gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();location.reload()})}
 upload(data){let gl=this.gl;if(!data.i.length)return null;let vao=gl.createVertexArray(),vbo=gl.createBuffer(),ibo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.v),gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(data.i),gl.STATIC_DRAW);for(let i=0;i<3;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,36,i*12)}gl.bindVertexArray(null);return {vao,vbo,ibo,count:data.i.length}}
 dispose(m){if(!m)return;let gl=this.gl;gl.deleteVertexArray(m.vao);gl.deleteBuffer(m.vbo);gl.deleteBuffer(m.ibo)}
 resize(){let dpr=Math.min(devicePixelRatio||1,window.innerWidth<800?1.35:1.7)*this.quality,w=Math.max(1,Math.round(this.canvas.clientWidth*dpr)),h=Math.max(1,Math.round(this.canvas.clientHeight*dpr));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}this.gl.viewport(0,0,w,h)}
 begin(eye,target,time){let gl=this.gl;this.resize();this.eye=eye;gl.disable(gl.DEPTH_TEST);gl.useProgram(this.sky);gl.uniform2f(this.su.uResolution,this.canvas.width,this.canvas.height);gl.uniform1f(this.su.uTime,time);gl.uniform1f(this.su.uDay,1);gl.drawArrays(gl.TRIANGLES,0,3);gl.enable(gl.DEPTH_TEST);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);let vp=M4.mul(M4.perspective(Math.PI/3.05,this.canvas.width/this.canvas.height,.15,350),M4.look(eye,target));gl.uniformMatrix4fv(this.u.uVP,false,vp);gl.uniform3fv(this.u.uCamera,eye);gl.uniform3fv(this.u.uFog,this.fog)}
 draw(mesh,model,tint=[1,1,1],alpha=1){if(!mesh)return;let gl=this.gl;gl.uniformMatrix4fv(this.u.uModel,false,model);gl.uniform3fv(this.u.uTint,tint);gl.uniform1f(this.u.uAlpha,alpha);gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_INT,0)}
 cube(pos,size,color,rot=null,alpha=1){this.draw(this.box,M4.trs(pos,rot,size),color,alpha)}
 cylinder(pos,size,color,rot=null,alpha=1){this.draw(this.cyl,M4.trs(pos,rot,size),color,alpha)}
}
