const fs=require('node:fs'),path=require('node:path');
const M=require(path.resolve(process.argv[2]));
const out=process.argv[3];
function inner(a,b){let re=0,im=0;for(let i=0;i<a.re.length;i++){re+=a.re[i]*b.re[i]+a.im[i]*b.im[i];im+=a.re[i]*b.im[i]-a.im[i]*b.re[i];}return {re,im};}
function distance(a,b){let n=0;for(let i=0;i<a.re.length;i++)n+=(a.re[i]-b.re[i])**2+(a.im[i]-b.im[i])**2;return Math.sqrt(n);}
function copy(s){return {re:s.re.slice(),im:s.im.slice()};}
const opts={nx:8,ny:4,nz:4,dx:1,dy:1,dz:1,packetX:-1,sigmaX:.7,sigmaY:.7,sigmaZ:.7,waveNumber:.5,barrierHeight:1.6,barrierHalfWidth:.3,guideStrength:.05,dt:.01};
// C1: exact periodic free-particle Fourier eigenmode, all axes nonzero.
const plane=M.createSimulation({...opts,barrierHeight:0,guideStrength:0});
const modes=[1,1,-1];let i=0;
for(let x=0;x<8;x++)for(let y=0;y<4;y++)for(let z=0;z<4;z++,i++){
 const phase=2*Math.PI*(x/8+y/4-z/4);plane.re[i]=Math.cos(phase)/Math.sqrt(128);plane.im[i]=Math.sin(phase)/Math.sqrt(128);
}
let expected=copy(plane);const energy=.5*((2*Math.PI/8)**2+2*(2*Math.PI/4)**2);const angle=-energy*.4;
for(let i=0;i<128;i++){const r=expected.re[i],v=expected.im[i];expected.re[i]=r*Math.cos(angle)-v*Math.sin(angle);expected.im[i]=r*Math.sin(angle)+v*Math.cos(angle);}
plane.advance(40);const c1=distance(plane,expected);
// C2: complex superposition linearity U(a+i b)=Ua+iUb. No renormalization.
const a=M.createSimulation(opts),b=M.createSimulation(opts),sum=M.createSimulation(opts);
b.re.fill(0);b.im.fill(0);b.re[13]=1;
for(let i=0;i<a.re.length;i++){sum.re[i]=a.re[i]-b.im[i];sum.im[i]=a.im[i]+b.re[i];}
const before=inner(a,b);
a.advance(40);b.advance(40);sum.advance(40);
const summed=copy(a);for(let i=0;i<a.re.length;i++){summed.re[i]=a.re[i]-b.im[i];summed.im[i]=a.im[i]+b.re[i];}
const c2=distance(sum,summed),after=inner(a,b);
// C3: preservation of complex overlap, phase-sensitive unitarity check.
const c3=Math.hypot(before.re-after.re,before.im-after.im);
// C4: full complex-state reversal, without phase alignment or normalization.
const reverse=M.createSimulation(opts),original=copy(reverse);reverse.advance(200);reverse.advance(200,-1);
const c4=distance(reverse,original);
// C5: export small fixed spatial grid to independent NumPy eigensolver.
const exactOpts={...opts,nx:4,ny:4,nz:4,packetX:-.75};
const runs=[];for(const dt of [.04,.02,.01]){const s=M.createSimulation({...exactOpts,dt});const initial=copy(s);s.advance(Math.round(.4/dt));runs.push({dt,initial:{re:[...initial.re],im:[...initial.im]},output:{re:[...s.re],im:[...s.im]},potential:[...s.potential]});}
// C6: recover nondimensional kinetic coefficient directly from SI equation.
const scale=M.physicalScale(1,1),L=1e-9;
const coefficient=M.HBAR_J_S**2/(2*M.ELECTRON_MASS_KG*L**2*scale.energyEv*M.ELEMENTARY_CHARGE_C);
const result={moduleVersion:M.VERSION,checks:[
 {id:'C1',name:'Analytic free Fourier-mode phase',error:c1,pass:c1<1e-11},
 {id:'C2',name:'Complex superposition linearity',error:c2,pass:c2<1e-11},
 {id:'C3',name:'Complex inner-product preservation',error:c3,pass:c3<1e-11},
 {id:'C4',name:'Forward/reverse phase recovery',error:c4,pass:c4<1e-10},
 {id:'C6',name:'SI scaling matches kinetic coefficient 1/2',coefficient,expected:.5,scale,pass:Math.abs(coefficient-.5)<1e-12}],referenceInput:{shape:[4,4,4],spacing:[1,1,1],time:.4,runs}};
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({moduleVersion:result.moduleVersion,checks:result.checks},null,2));
