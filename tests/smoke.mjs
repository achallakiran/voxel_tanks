import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {generate} from '../scripts/build.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rd=p=>fs.readFileSync(path.join(root,p),'utf8');
assert.equal(rd('index.html'),generate(),'Published HTML must match modular source. Run npm run build.');
const bundle=['src/renderer.js','src/world.js','src/tanks.js','src/game.js','src/tactics.js','src/v03.js','src/mobility.js'].map(rd).join('\n\n');
const ctx={window:{addEventListener(){}},Math,Float32Array,Uint8Array,Uint32Array,Map,Set,console};
vm.runInNewContext(bundle+';globalThis.classes={VoxelWorld,Tank,WEAPONS,Game,SurfaceNavigator,EnemyPerception,ShellCamera,MOVE_RULES}',ctx,{timeout:15000});
const {VoxelWorld,Tank,WEAPONS,Game,SurfaceNavigator,EnemyPerception,ShellCamera,MOVE_RULES}=ctx.classes;
const fake={upload:d=>d.i.length?{count:d.i.length}:null,dispose(){}};
const world=new VoxelWorld(fake),player=new Tank(-31,-15,world),enemy=new Tank(29,21,world,true);
assert.equal(world.chunks.size,49);
let y=world.height(-31,-15);assert.ok(y>0);
assert.ok(world.editSphere(-31,y,-15,4,0)>0);
assert.ok(world.height(-31,-15)<y);
assert.ok(world.mountain(-31,y,-15,4)>0);
assert.ok(world.height(-31,-15)>=y);
assert.equal(WEAPONS.length,6);
assert.equal(MOVE_RULES.credits,6); // Historic AI navigation constant; the player uses the per-turn gauge.
assert.ok(bundle.includes('const DRIVE_TURN_DISTANCE=8;'),'Per-turn distance budget module must be bundled');
const navigator=new SurfaceNavigator(world);
const path=navigator.plan(player,-27,-15);
assert.ok(path&&path.cost>=1,'Terrain-aware navigation must produce a safe short AI route');
const perception=new EnemyPerception();assert.equal(perception.estimated,null,'Enemy has no preloaded target location');
const follow=new ShellCamera().pose([{pos:[0,28,0],vel:[10,-5,9]}],world);
assert.ok(follow[0][1]>28,'Shell camera stays above projectile');
assert.ok(Math.abs(Math.atan2(enemy.x-player.x,enemy.z-player.z)-player.yaw)<.08);
const game=Object.create(Game.prototype);Object.assign(game,{player,enemy,world,wind:0,settings:{difficulty:'normal'},enemyCredits:0,aiMoved:true,perception:new EnemyPerception(),navigator, time:0,projectiles:[],fx:[],turn:'enemy',audio:{blast(){},hit(){},tone(){},shot(){}},banner(){},ui(){}});
let fired=false;game.launch=(tank,weapon)=>{fired=true;assert.ok(weapon&&tank===enemy)};
game.decideEnemy();assert.ok(fired,'AI must choose and fire a valid weapon');
const importantIds=['startDuel','fire','pauseButton','power','powerValue','powerPlus','powerMinus','weaponPanel','weaponToggle','weapons','activeWeaponArt','playerTankHealth','enemyTankHealth','moveLeft','joyBase','joyKnob','movementGauge','moveMeterFill','turnNotice'];
for(const id of importantIds)assert.ok(rd('index.html').includes('id="'+id+'"'),'Missing live UI element '+id);
for(const obsolete of ['startSandbox','cameraButton','settingsButton','bearing','angle','youScore','enemyScore','moveTokens'])assert.ok(!rd('src/shell.html').includes('id="'+obsolete+'"'),'Obsolete control '+obsolete);
assert.ok(rd('src/shell.html').includes('id="tankHealthLayer"'));
assert.ok(!rd('src/shell.html').includes('SANDBOX'),'Removed Sandbox must not appear in the menu');
const limited=navigator.plan(player,-22,-15);assert.equal(limited,null,'Move beyond the 4-unit limit must be rejected');
assert.equal(path.cost,1,'Short AI routes remain supported with historical navigation budgets');
const tree=world.props.find(p=>p.kind==='tree');assert.ok(tree,'Biome must contain trees');
assert.ok(world.propHit(tree.x,tree.y+tree.scale*1.6,tree.z),'Tree projectile collision must exist');
world.breakProps(tree.x,tree.y+1.6*tree.scale,tree.z,2);assert.equal(tree.alive,false,'Hit tree must break');
assert.ok(world.debrisEvents.length,'Tree impact must queue wood/leaves debris');
const removed=world.editSphere(-15,world.height(-15,-15)-1,-15,3,0);if(removed){world.queueEjecta(-15,world.height(-15,-15),-15,3,removed);assert.ok(world.ejecta.length,'Crater must schedule persistent rim deposits');world.tickDestruction(.25);}
assert.equal(typeof Game.prototype.drawTankHealthBars,'function');
assert.equal(typeof Game.prototype.isPlayerTankTap,'function');

const aimTest=Object.create(Game.prototype);
Object.assign(aimTest,{player,enemy,world,wind:0,time:0,mode:'duel',turn:'player',tankSelected:true,movingPath:null,paused:false,projectiles:[],orbit:0,aimPitch:player.elev});
const startElevation=player.elev;
assert.equal(aimTest.nudgeTankAim(0,1),true,'Selected tank must respond to arrow input');
assert.ok(Math.abs(player.elev-startElevation-2*Math.PI/180)<.000001,'Single aim tap must adjust elevation exactly two degrees');
assert.equal(aimTest.nudgeTankAim(-1,0),true);
assert.ok(Math.abs(aimTest.orbit+2*Math.PI/180)<.000001,'Left arrow must change bearing by two degrees');
const noDragAngle=player.elev,noDragBearing=player.turret;
aimTest.handleSceneDrag(60,-50);
assert.equal(player.elev,noDragAngle,'Dragging the camera must not change elevation');
assert.equal(player.turret,noDragBearing,'Dragging the camera must not change bearing');
const partial=aimTest.predict();
assert.ok(partial.length>=2,'Trajectory must show a meaningful initial arc');
assert.ok(aimTest._arcCache.fullLength>=partial.length,'Trajectory preview must not exceed simulated shot');
assert.ok(partial.length<=Math.max(2,Math.ceil(aimTest._arcCache.fullLength*.55)),'Preview stops around the middle of the estimated flight');
const alphaValues=[];
aimTest.r={cyl:{},draw(mesh,model,tint,alpha){alphaValues.push(alpha)},cube(){}};
aimTest.renderAimTrajectory();
assert.ok(alphaValues.some(a=>a<.65&&a>.15),'A translucent partial flight arc must render');
aimTest.tankSelected=false;
assert.equal(aimTest.nudgeTankAim(1,0),false,'Unselected tank cannot be aimed via arrows');
for(const id of ['tankAimControls','aimUp','aimDown','aimLeft','aimRight'])assert.ok(rd('src/shell.html').includes('id="'+id+'"'),'Missing directional aim control '+id);
assert.ok(rd('src/style.css').includes('#tankAimControls .aimArrow'),'Aim arrows must have styled on-tank hit areas');
assert.ok(!rd('src/game.js').includes('this.predict().entries()'),'Old opaque ballistic dots must be removed');


const motor=Object.create(Game.prototype),secondWorld=new VoxelWorld(fake),motorTank=new Tank(-31,-15,secondWorld);
Object.assign(motor,{
 mode:'duel',turn:'player',paused:false,player:motorTank,enemy:new Tank(29,21,secondWorld,true),
 world:secondWorld,projectiles:[],navigator:new SurfaceNavigator(secondWorld),
 movementMax:8,movementRemaining:8,moveLeft:8,keys:{},joy:{x:0,y:1},orbit:0
});
motorTank._game=motor;
const px=motorTank.x,pz=motorTank.z;
motor.driveByJoystick(.12);
const traveled=Math.hypot(motorTank.x-px,motorTank.z-pz);
assert.ok(traveled>.2&&traveled<1.2,'Joystick should move tank a controlled distance');
assert.ok(Math.abs((8-motor.movementRemaining)-traveled)<1e-4,'Meter drains by actual travel');
motor.joy={x:1,y:0};
const oldBudget=motor.movementRemaining,oldYaw=motorTank.yaw;
motor.driveByJoystick(.2);
assert.notEqual(motorTank.yaw,oldYaw,'Joystick horizontal steer rotates tank');
assert.equal(motor.movementRemaining,oldBudget,'Turning without moving uses no meter');
motor.movementRemaining=0;motor.joy={x:0,y:1};
const halted=[motorTank.x,motorTank.z];
motor.driveByJoystick(.2);
assert.equal(motorTank.x,halted[0]);
assert.equal(motorTank.z,halted[1]);
motor.joy={x:0,y:0};motor.dom=id=>({value:'',textContent:'',style:{}});
assert.equal(motor.setPowerExact(75),75);
assert.equal(motor.setPowerExact(76),75);
assert.equal(motor.setPowerExact(21),22);
assert.equal(motor.setPowerExact(40.4),40);
for(const id of ['joyBase','joyKnob','movementGauge','moveMeterFill','powerPlus','powerMinus','weaponToggle'])assert.ok(rd('src/shell.html').includes('id="'+id+'"'),'Missing compact HUD '+id);
assert.ok(!rd('src/shell.html').includes('id="moveTokens"'),'Obsolete diamond movement tokens remain');
assert.ok(rd('src/style.css').includes('#hud #bottom #weaponPanel .weaponToggle'),'Missing tiny shell picker style');
console.log('PASS — per-turn joystick distance budget, steering, precision power, compact HUD, ballistic arc, destructible world and offline bundle.');

