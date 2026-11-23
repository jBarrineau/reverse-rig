import * as THREE from 'three';

const $ = id => document.getElementById(id);
const clamp = (v,a,b) => v<a?a:v>b?b:v;
const lerp = (a,b,t) => a+(b-a)*t;
const store = {
  get(k,d){ try{ const v=localStorage.getItem('revrig_'+k); return v?JSON.parse(v):d; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem('revrig_'+k, JSON.stringify(v)); }catch(e){} }
};
function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const fmt = t => { t=Math.max(0,t); const m=Math.floor(t/60), s=t-m*60; return m+':'+(s<10?'0':'')+s.toFixed(2); };

// ================= RIG CONSTANTS =================
const WB = 4.2;            // tractor wheelbase
const DH = 8.0;            // hitch -> trailer axle
const TR_BACK = 11.0, TR_FRONT = 1.0, TR_W = 2.6;
const TC_BACK = 1.8, TC_FRONT = 6.6, TC_W = 2.5;
const MAXSTEER = 0.6;
const JACK = 1.22;

// ================= LEVELS =================
function slalom(a,b,n,amp,phase=1){ const out=[]; for(let i=0;i<n;i++){ out.push([a+(b-a)*i/(n-1), (i%2?1:-1)*amp*phase]); } return out; }
const LEVELS = [
  { name:'Yard Warm-Up', sub:'Gentle S-bends. Learn to love your mirrors.', w:14, tod:'morning', icon:'🌅',
    segs:[['S',40],['L',32,60],['S',20],['R',32,120],['S',25],['L',32,60],['S',40]],
    cones:[[.18,.55],[.18,-.55],[.5,.6],[.66,-.55],[.86,.5],[.86,-.5]],
    cans:[[.12,0],[.36,.35],[.58,-.35],[.78,0]] },
  { name:'Snake Alley', sub:'Left, right, left, regret.', w:12.5, tod:'noon', icon:'☀️',
    segs:[['S',30],['L',24,70],['R',24,140],['L',24,140],['R',24,70],['S',25],['R',26,90],['S',20],['L',26,90],['S',30]],
    cones:[[.12,.5],[.3,-.55],[.47,.55],[.62,-.5],[.75,.5],[.9,-.45],[.9,.45]],
    cans:[[.2,0],[.4,0],[.56,.3],[.7,-.3],[.84,0]] },
  { name:'Hairpin Heights', sub:'Three 180s. The trailer has opinions.', w:15, tod:'sunset', icon:'🌇',
    segs:[['S',35],['L',19,180],['S',30],['R',19,180],['S',30],['L',19,180],['S',35]],
    cones:[[.08,.5],[.08,-.5],[.36,.0],[.64,.0],[.93,.45],[.93,-.45]],
    cans:[[.2,.55],[.3,0],[.5,-.45],[.7,.45],[.82,0]] },
  { name:'Cone Carnage', sub:'A slalom of orange regret. Every cone costs 2s.', w:15.5, tod:'noon', icon:'🚧',
    segs:[['S',30],['R',30,45],['L',30,90],['R',30,90],['L',30,45],['S',30],['L',26,90],['S',35]],
    cones:[...slalom(.06,.5,9,.42), ...slalom(.62,.92,6,.4,-1)],
    cans:[[.1,.6],[.3,-.6],[.52,0],[.75,.55],[.95,0]] },
  { name:'Docking Gauntlet', sub:'Night shift. Narrow lanes. Back it into Dock 7.', w:12, tod:'night', icon:'🌙',
    segs:[['S',25],['R',24,90],['S',15],['L',20,180,13.5],['S',15],['R',24,90],['S',30,10.5]],
    cones:[[.1,.5],[.1,-.5],[.4,0],[.6,.45],[.75,-.4],[.88,.35],[.88,-.35],[.95,.38],[.95,-.38]],
    cans:[[.2,0],[.48,.4],[.66,-.3],[.8,0]] },
];
const TOD = {
  morning:{ top:'#5d8ee0', mid:'#f7b38a', bot:'#ffe2b8', fog:0xf2cfb0, hemi:1.0, sun:2.4, sunCol:0xffe4c2, sunDir:[ -60, 50, -40 ], night:false, ground:'#9a8a70'},
  noon:   { top:'#2f7fd8', mid:'#8cc4f0', bot:'#e6f2ff', fog:0xcfe3f2, hemi:1.1, sun:2.8, sunCol:0xfff6e8, sunDir:[ 30, 90, 20 ], night:false, ground:'#a39272'},
  sunset: { top:'#2b2f6b', mid:'#e9645a', bot:'#ffc078', fog:0xe8907a, hemi:0.8, sun:2.6, sunCol:0xffa060, sunDir:[ 80, 22, 40 ], night:false, ground:'#8f7462'},
  night:  { top:'#05060f', mid:'#141a3a', bot:'#2b2450', fog:0x141530, hemi:0.28, sun:0.5, sunCol:0x8fa8ff, sunDir:[ -30, 60, 30 ], night:true, ground:'#4b4a52'},
};
const PAINTS = ['#e53935','#ff8f00','#1e88e5','#43a047','#8e24aa','#212121','#f5f5f5'];

// ================= AUDIO =================
const SFX = (() => {
  let ctx=null, master, engGain, engF, e1, e2, beepGain, nitroGain, noiseBuf, muted=false;
  function init(){
    if(ctx) { if(ctx.state==='suspended') ctx.resume(); return; }
    try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return; }
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    engF = ctx.createBiquadFilter(); engF.type='lowpass'; engF.frequency.value=500; engF.Q.value=4;
    engGain = ctx.createGain(); engGain.gain.value=0; engF.connect(engGain); engGain.connect(master);
    e1 = ctx.createOscillator(); e1.type='sawtooth'; e1.frequency.value=38; e1.connect(engF); e1.start();
    e2 = ctx.createOscillator(); e2.type='square'; e2.frequency.value=19; const g2=ctx.createGain(); g2.gain.value=.6; e2.connect(g2); g2.connect(engF); e2.start();
    const bo = ctx.createOscillator(); bo.type='square'; bo.frequency.value=1040; beepGain=ctx.createGain(); beepGain.gain.value=0;
    const bf = ctx.createBiquadFilter(); bf.type='bandpass'; bf.frequency.value=1040; bf.Q.value=2;
    bo.connect(bf); bf.connect(beepGain); beepGain.connect(master); bo.start();
    const ns = ctx.createBufferSource(); ns.buffer=noiseBuf; ns.loop=true;
    const nf = ctx.createBiquadFilter(); nf.type='bandpass'; nf.frequency.value=1200; nf.Q.value=.7;
    nitroGain = ctx.createGain(); nitroGain.gain.value=0; ns.connect(nf); nf.connect(nitroGain); nitroGain.connect(master); ns.start();
  }
  function engine(speed, throttle, nitro, beepOn){
    if(!ctx) return; const t=ctx.currentTime, s=Math.abs(speed);
    const rpm = 34 + s*3.2 + throttle*14 + (nitro?18:0);
    e1.frequency.setTargetAtTime(rpm, t, .08); e2.frequency.setTargetAtTime(rpm/2, t, .08);
    engF.frequency.setTargetAtTime(380 + throttle*600 + s*30 + (nitro?800:0), t, .1);
    engGain.gain.setTargetAtTime(0.07 + throttle*0.07, t, .1);
    beepGain.gain.setTargetAtTime(beepOn?0.05:0, t, .006);
    nitroGain.gain.setTargetAtTime(nitro?0.12:0, t, .05);
  }
  function silence(){ if(!ctx) return; const t=ctx.currentTime; engGain.gain.setTargetAtTime(0,t,.1); beepGain.gain.setTargetAtTime(0,t,.01); nitroGain.gain.setTargetAtTime(0,t,.05); }
  function tone(f, dur, type='square', vol=.15, slide=null, delay=0){
    if(!ctx) return; const t=ctx.currentTime+delay; const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(f,t); if(slide) o.frequency.exponentialRampToValueAtTime(slide,t+dur);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur); o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+.02);
  }
  function noise(dur, freq, vol, type='lowpass'){
    if(!ctx) return; const t=ctx.currentTime; const s=ctx.createBufferSource(); s.buffer=noiseBuf;
    const f=ctx.createBiquadFilter(); f.type=type; f.frequency.value=freq; const g=ctx.createGain();
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t+dur);
  }
  function horn(){
    if(!ctx) return; const t=ctx.currentTime; const g=ctx.createGain(); const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=2200;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.22,t+.03); g.gain.setValueAtTime(.22,t+.6); g.gain.linearRampToValueAtTime(0,t+.8);
    [174,220,262].forEach(fr=>{ const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=fr; o.connect(f); o.start(t); o.stop(t+.85); });
    f.connect(g); g.connect(master);
  }
  return {
    init, engine, silence, horn,
    cone(){ tone(320,.18,'triangle',.25,90); noise(.12,1800,.2,'bandpass'); },
    crash(){ noise(.45,600,.5); tone(80,.3,'sawtooth',.25,40); },
    scrape(){ noise(.08,3000,.06,'highpass'); },
    chime(){ [784,988,1319].forEach((f,i)=>tone(f,.25,'triangle',.16,null,i*.07)); },
    can(){ tone(660,.1,'square',.12,1320); tone(990,.15,'square',.1,1980,.06); },
    nope(){ tone(180,.18,'square',.15); tone(130,.3,'square',.15,null,.18); },
    count(){ tone(440,.22,'square',.15); }, go(){ tone(880,.5,'square',.17); },
    jack(){ noise(.8,400,.5); tone(200,.8,'sawtooth',.2,50); },
    finish(){ [523,659,784,1047,1319].forEach((f,i)=>tone(f,.35,'square',.12,null,i*.09)); },
    toggleMute(){ muted=!muted; if(master) master.gain.value = muted?0:.55; return muted; }
  };
})();

// ================= RENDERER / SCENE =================
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth/innerHeight, 0.3, 1500);
camera.position.set(0, 20, -30);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); });

const hemi = new THREE.HemisphereLight(0xffffff, 0x554433, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.castShadow = true; sun.shadow.mapSize.set(2048,2048);
const sc = sun.shadow.camera; sc.left=-45; sc.right=45; sc.top=45; sc.bottom=-45; sc.near=1; sc.far=300;
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);

function canvasTex(w,h,draw,repeat){
  const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); draw(g,w,h);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8;
  if(repeat){ t.wrapS=t.wrapT=THREE.RepeatWrapping; }
  return t;
}
function skyTex(p){
  const draw=(g,w,h,time=0)=>{
    const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,p.top); gr.addColorStop(.55,p.mid); gr.addColorStop(1,p.bot); g.fillStyle=gr; g.fillRect(0,0,w,h);
    if(!p.night) return;
    const R=rng(73), sx=w/h/camera.aspect;
    for(let i=0;i<140;i++){
      const x=R()*w, y=R()*h*.65, r=.6+R()*1.25, phase=R()*Math.PI*2, rate=.6+R()*1.4;
      if(Math.hypot((x-w*.78)/sx,y-h*.18)<34) continue;
      g.globalAlpha=.35+.65*(.5+.5*Math.sin(time*rate+phase)); g.fillStyle='#fff4d6';
      g.beginPath(); g.ellipse(x,y,r*sx,r,0,0,Math.PI*2); g.fill();
      if(i%14===0){ g.fillRect(x-4*sx,y-.35,8*sx,.7); g.fillRect(x-.35*sx,y-4,.7*sx,8); }
    }
    g.globalAlpha=1;
    g.save(); g.translate(w*.78,h*.18); g.scale(sx,1); g.rotate(-.25); g.fillStyle='#ffe7ab';
    g.beginPath(); g.arc(0,0,28,Math.PI/3,5*Math.PI/3); g.arc(28,0,28,4*Math.PI/3,2*Math.PI/3,true); g.closePath(); g.fill(); g.restore();
  };
  const tex=canvasTex(p.night?1024:4,512,draw);
  if(p.night){
    let elapsed=0, lastDraw=0;
    tex.userData.twinkle=dt=>{
      elapsed+=dt;
      if(elapsed-lastDraw<.1) return;
      lastDraw=elapsed;
      const c=tex.image; draw(c.getContext('2d'),c.width,c.height,elapsed); tex.needsUpdate=true;
    };
  }
  return tex;
}
function speckle(g,w,h,base,n,cols){ g.fillStyle=base; g.fillRect(0,0,w,h); for(let i=0;i<n;i++){ g.fillStyle=cols[i%cols.length]; const s=Math.random()*2.2+.5; g.fillRect(Math.random()*w,Math.random()*h,s,s); } }
const trackTex = canvasTex(256,256,(g,w,h)=>{
  speckle(g,w,h,'#45484e',5000,['#3a3c41','#55585e','#4d4f55','#606369']);
  for(let i=0;i<6;i++){ g.strokeStyle='#33353a'; g.lineWidth=1; g.beginPath(); let x=Math.random()*w, y=Math.random()*h; g.moveTo(x,y); for(let j=0;j<5;j++){ x+=Math.random()*30-15; y+=Math.random()*30; g.lineTo(x,y);} g.stroke(); }
  g.fillStyle='#f4f4f0'; g.fillRect(6,0,7,h); g.fillRect(w-13,0,7,h);
  g.fillStyle='#ffc107'; g.fillRect(124,0,8,120);
}, true);
const groundTexes = {};
function groundTex(col){ if(groundTexes[col]) return groundTexes[col]; const t=canvasTex(512,512,(g,w,h)=>{ speckle(g,w,h,col,14000,['#0000001a','#ffffff14','#00000026','#ffffff0a']);
  g.strokeStyle='#00000022'; g.lineWidth=2; for(let i=0;i<=4;i++){ g.beginPath(); g.moveTo(i*128,0); g.lineTo(i*128,h); g.stroke(); g.beginPath(); g.moveTo(0,i*128); g.lineTo(w,i*128); g.stroke(); }
  for(let i=0;i<30;i++){ g.fillStyle='#0000001c'; g.beginPath(); g.ellipse(Math.random()*w,Math.random()*h,Math.random()*30+5,Math.random()*12+3,Math.random()*3,0,7); g.fill(); }
}, true); t.repeat.set(120,120); groundTexes[col]=t; return t; }
const checkerTex = canvasTex(256,64,(g,w,h)=>{ const s=16; for(let y=0;y<h/s;y++) for(let x=0;x<w/s;x++){ g.fillStyle=(x+y)%2?'#111':'#fafafa'; g.fillRect(x*s,y*s,s,s);} });
function bannerTex(text, c1, c2){ return canvasTex(1024,128,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,w,0); gr.addColorStop(0,c1); gr.addColorStop(1,c2); g.fillStyle=gr; g.fillRect(0,0,w,h);
  g.fillStyle='#0003'; for(let x=-h;x<w;x+=60){ g.beginPath(); g.moveTo(x,h); g.lineTo(x+30,h); g.lineTo(x+30+h,0); g.lineTo(x+h,0); g.fill(); }
  g.font='900 78px Bungee, Rubik, sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#0008'; g.fillText(text,w/2+4,h/2+6); g.fillStyle='#fff'; g.fillText(text,w/2,h/2+2); }); }
const smokeTex = canvasTex(64,64,(g,w,h)=>{ const gr=g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,'#ffffffff'); gr.addColorStop(.5,'#ffffff88'); gr.addColorStop(1,'#ffffff00'); g.fillStyle=gr; g.fillRect(0,0,w,h); });

// ================= RIG MODEL =================
const mats = {
  paint: new THREE.MeshStandardMaterial({ color:PAINTS[0], metalness:.35, roughness:.32 }),
  dark: new THREE.MeshStandardMaterial({ color:0x1d1f24, metalness:.2, roughness:.7 }),
  chrome: new THREE.MeshStandardMaterial({ color:0xe8ecf0, metalness:1, roughness:.18 }),
  glass: new THREE.MeshStandardMaterial({ color:0x1a2a3a, metalness:.6, roughness:.08 }),
  tire: new THREE.MeshStandardMaterial({ color:0x111111, roughness:.9 }),
  white: new THREE.MeshStandardMaterial({ color:0xf0f0f0, roughness:.6 }),
  stripe: new THREE.MeshStandardMaterial({ color:0xffffff, roughness:.4, metalness:.2 }),
  head: new THREE.MeshStandardMaterial({ color:0xfff6c8, emissive:0xfff2b0, emissiveIntensity:1.5 }),
  tail: new THREE.MeshStandardMaterial({ color:0xff1a1a, emissive:0xff0000, emissiveIntensity:1.2 }),
  rev: new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xffffff, emissiveIntensity:0.2 }),
  amber: new THREE.MeshStandardMaterial({ color:0xffa000, emissive:0xff8f00, emissiveIntensity:.8 }),
};
function sideTex(arrowLeft){ return canvasTex(1024,290,(g,w,h)=>{
  g.fillStyle='#f7f5ef'; g.fillRect(0,0,w,h);
  g.fillStyle='#ff6f00'; g.fillRect(0,h-46,w,26); g.fillStyle='#263238'; g.fillRect(0,h-20,w,20);
  g.fillStyle='#ff6f00'; g.fillRect(0,14,w,10);
  g.save(); g.font='900 96px Bungee, Rubik, sans-serif'; g.textBaseline='middle'; g.textAlign='center';
  g.fillStyle='#263238'; g.fillText('BACKWARDS',w/2,104);
  g.font='800 40px Rubik, sans-serif'; g.fillStyle='#ff6f00'; g.fillText('FREIGHT CO.  ·  ALWAYS ARRIVING… EVENTUALLY',w/2,182);
  g.font='900 70px Rubik, sans-serif'; g.fillStyle='#ff6f00';
  const arr = arrowLeft?'◀◀':'▶▶'; g.fillText(arr, arrowLeft?90:w-90, 104);
  g.restore();
  g.strokeStyle='#0001'; g.lineWidth=2; for(let x=0;x<w;x+=64){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,h); g.stroke(); }
}); }
const rearTex = canvasTex(260,340,(g,w,h)=>{
  g.fillStyle='#e9e7e1'; g.fillRect(0,0,w,h); g.fillStyle='#bdbdbd'; g.fillRect(w/2-2,0,4,h);
  g.fillStyle='#9e9e9e'; for(const x of [60,200]) g.fillRect(x-3,30,6,h-60);
  for(let i=0;i<10;i++){ g.fillStyle=i%2?'#d50000':'#fff'; g.fillRect(i*26,h-26,26,26); }
  g.fillStyle='#263238'; g.textAlign='center'; g.font='900 26px Rubik, sans-serif';
  g.fillText("HOW'S MY",w/2,72); g.fillText('REVERSING?',w/2,104);
  g.font='800 15px Rubik, sans-serif'; g.fillStyle='#ff6f00'; g.fillText('CALL 1-800-BACKWRD',w/2,134);
  g.fillStyle='#263238'; g.font='700 14px Rubik, sans-serif';
  g.fillText('IF YOU CAN READ THIS,',w/2,206); g.fillText("YOU'RE MY DESTINATION.",w/2,226);
});
const trailerMats = [ mats.white, new THREE.MeshStandardMaterial({map:rearTex,roughness:.6}), mats.white, mats.dark,
  new THREE.MeshStandardMaterial({map:sideTex(true),roughness:.55}), new THREE.MeshStandardMaterial({map:sideTex(false),roughness:.55}) ];

function buildRig(ghost){
  const gm = ghost ? new THREE.MeshBasicMaterial({ color:0x66e8ff, transparent:true, opacity:.22, depthWrite:false }) : null;
  const pk = m => ghost ? gm : m;
  const tractor = new THREE.Group(), trailer = new THREE.Group();
  const B = (grp,w,h,d,m,x,y,z) => { const me=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), Array.isArray(m)&&!ghost?m:pk(Array.isArray(m)?m[0]:m)); me.position.set(x,y,z); if(!ghost){ me.castShadow=true; me.receiveShadow=true; } grp.add(me); return me; };
  const C = (grp,r,len,m,x,y,z,axis) => { const g=new THREE.CylinderGeometry(r,r,len,16); if(axis==='x') g.rotateZ(Math.PI/2); if(axis==='z') g.rotateX(Math.PI/2); const me=new THREE.Mesh(g,pk(m)); me.position.set(x,y,z); if(!ghost) me.castShadow=true; grp.add(me); return me; };
  // tractor (origin at rear axle / hitch, +X forward)
  B(tractor,8.2,.45,1.2,mats.dark,2.3,.95,0);
  C(tractor,.95,.18,mats.dark,0,1.28,0);
  const cab = new THREE.Group(); tractor.add(cab);
  B(cab,2.5,2.7,2.5,mats.paint,2.9,2.6,0);
  B(cab,1.9,.9,2.45,mats.paint,2.7,4.35,0);
  B(cab,.08,1.05,2.2,mats.glass,4.17,3.25,0);
  B(cab,1.05,.95,2.54,mats.glass,3.55,3.25,0);
  B(cab,2.52,.22,2.54,mats.stripe,2.9,2.05,0);
  B(cab,2.35,1.55,2.35,mats.paint,5.3,1.98,0);
  B(cab,.12,1.3,1.7,mats.chrome,6.48,1.98,0);
  B(cab,.45,.42,2.56,mats.chrome,6.55,.95,0);
  for(const z of [-.95,.95]){ B(cab,.1,.32,.5,mats.head,6.5,1.3,z); B(cab,.1,.16,.2,mats.amber,6.5,2.6,z*1.1); }
  for(const z of [-1.2,1.2]){ C(cab,.14,3.8,mats.chrome,1.55,3.1,z); C(cab,.46,1.5,mats.chrome,2.6,1.05,z*1.02,'x'); B(cab,.12,.7,.12,mats.dark,4.05,3.1,z*1.25); B(cab,.05,.05,.35,mats.chrome,4.05,3.4,z*1.13); }
  for(const z of [-1.1,1.1]) B(cab,1.4,.15,.55,mats.dark,4.2,1.55,z);
  const steerPivots=[], spinners=[];
  const wheel = (grp,x,z,r,wd,steer) => { const piv=new THREE.Group(); piv.position.set(x,r,z); grp.add(piv); const sp=new THREE.Group(); piv.add(sp);
    const tg=new THREE.CylinderGeometry(r,r,wd,18); tg.rotateX(Math.PI/2); const t=new THREE.Mesh(tg,pk(mats.tire)); if(!ghost) t.castShadow=true; sp.add(t);
    const hg=new THREE.CylinderGeometry(r*.55,r*.55,wd+.04,8); hg.rotateX(Math.PI/2); sp.add(new THREE.Mesh(hg,pk(mats.chrome)));
    const bar=new THREE.Mesh(new THREE.BoxGeometry(r*1.3,.1,wd+.06),pk(mats.dark)); sp.add(bar);
    if(steer) steerPivots.push(piv); spinners.push({sp,r}); };
  for(const z of [-1.08,1.08]){ wheel(tractor,4.2,z,.56,.42,true); wheel(tractor,.65,z,.56,.62); wheel(tractor,-.7,z,.56,.62); }
  // trailer (origin at hitch, extends -X)
  B(trailer,TR_FRONT+TR_BACK,3.4,TR_W,ghost?gm:trailerMats,(TR_FRONT-TR_BACK)/2,2.75,0);
  B(trailer,10.5,.32,1.1,mats.dark,-5.2,.95,0);
  for(const z of [-.9,.9]) B(trailer,.12,.9,.12,mats.dark,-1.2,.55,z);
  const tspin=[];
  for(const z of [-1.05,1.05]) for(const x of [-8,-9.35]){ const piv=new THREE.Group(); piv.position.set(x,.56,z); trailer.add(piv); const sp=new THREE.Group(); piv.add(sp);
    const tg=new THREE.CylinderGeometry(.56,.56,.62,18); tg.rotateX(Math.PI/2); const t=new THREE.Mesh(tg,pk(mats.tire)); if(!ghost) t.castShadow=true; sp.add(t);
    const hg=new THREE.CylinderGeometry(.3,.3,.66,8); hg.rotateX(Math.PI/2); sp.add(new THREE.Mesh(hg,pk(mats.chrome))); sp.add(new THREE.Mesh(new THREE.BoxGeometry(.75,.1,.68),pk(mats.dark))); tspin.push({sp,r:.56}); }
  for(const z of [-1.05,1.05]){ B(trailer,.06,.34,.3,mats.tail,-TR_BACK-.03,1.35,z); B(trailer,.06,.6,.5,mats.dark,-10.4,.55,z); }
  const revs=[]; for(const z of [-.55,.55]) revs.push(B(trailer,.06,.22,.3,mats.rev,-TR_BACK-.03,1.35,z));
  B(trailer,.3,.25,TR_W,mats.dark,-TR_BACK+.1,.85,0);
  // reverse spotlight (night)
  let spot=null;
  if(!ghost){ spot=new THREE.SpotLight(0xfff4e0, 0, 70, .62, .5, 1.2); spot.position.set(-TR_BACK-.2,2.2,0); const tgt=new THREE.Object3D(); tgt.position.set(-35,0,0); trailer.add(tgt); spot.target=tgt; trailer.add(spot); }
  return { tractor, trailer, steerPivots, spinners:[...spinners, ...tspin], spot, cab };
}

const rig = buildRig(false);
scene.add(rig.tractor, rig.trailer);
const ghostRig = buildRig(true);
scene.add(ghostRig.tractor, ghostRig.trailer);
ghostRig.tractor.visible = ghostRig.trailer.visible = false;

// ================= PARTICLES =================
const parts = [];
for(let i=0;i<220;i++){ const m=new THREE.SpriteMaterial({ map:smokeTex, transparent:true, depthWrite:false, opacity:0 }); const s=new THREE.Sprite(m); s.visible=false; scene.add(s); parts.push({s,m,life:0,max:1,vx:0,vy:0,vz:0,g0:1,g1:2,a:1,grav:0}); }
let pIdx=0;
function emit(x,y,z,o){ const p=parts[pIdx++%parts.length]; p.s.position.set(x,y,z); p.vx=o.vx||0; p.vy=o.vy||0; p.vz=o.vz||0; p.life=0; p.max=o.life||1; p.g0=o.s0||.6; p.g1=o.s1||2; p.a=o.a||.6; p.grav=o.grav||0;
  p.m.color.set(o.c||0xffffff); p.m.blending = o.add?THREE.AdditiveBlending:THREE.NormalBlending; p.s.visible=true; }
function updParts(dt){ for(const p of parts){ if(!p.s.visible) continue; p.life+=dt; const k=p.life/p.max; if(k>=1){ p.s.visible=false; continue; }
  p.vy-=p.grav*dt; p.s.position.x+=p.vx*dt; p.s.position.y+=p.vy*dt; p.s.position.z+=p.vz*dt; if(p.s.position.y<.05){ p.s.position.y=.05; p.vy*=-.3; }
  const sz=lerp(p.g0,p.g1,k); p.s.scale.set(sz,sz,1); p.m.opacity=p.a*(1-k)*(k<.1?k*10:1); } }

// confetti
const CONF=260;
const confMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(.35,.55), new THREE.MeshBasicMaterial({side:THREE.DoubleSide}), CONF);
confMesh.frustumCulled=false; scene.add(confMesh);
const conf=[]; const dummy=new THREE.Object3D(); const confCols=[0xff1744,0xffc400,0x00e676,0x2979ff,0xd500f9,0xffffff];
for(let i=0;i<CONF;i++){ conf.push({x:0,y:-50,z:0,vx:0,vy:0,vz:0,r:0,rv:0,on:false}); confMesh.setColorAt(i,new THREE.Color(confCols[i%confCols.length])); }
confMesh.instanceColor.needsUpdate=true;
function confettiBurst(x,z){ conf.forEach(c=>{ c.x=x+(Math.random()-.5)*6; c.z=z+(Math.random()-.5)*6; c.y=2+Math.random()*3; const a=Math.random()*6.28, sp=4+Math.random()*9; c.vx=Math.cos(a)*sp; c.vz=Math.sin(a)*sp; c.vy=10+Math.random()*14; c.r=Math.random()*6; c.rv=(Math.random()-.5)*14; c.on=true; }); }
function updConf(dt){ conf.forEach((c,i)=>{ if(c.on){ c.vy-=14*dt; c.vx*=.985; c.vz*=.985; if(c.vy<-3) c.vy=-3; c.x+=c.vx*dt; c.y+=c.vy*dt; c.z+=c.vz*dt; c.r+=c.rv*dt; if(c.y<0){ c.on=false; c.y=-50; } }
  dummy.position.set(c.x,c.y,c.z); dummy.rotation.set(c.r,c.r*.7,c.r*.3); dummy.updateMatrix(); confMesh.setMatrixAt(i,dummy.matrix); }); confMesh.instanceMatrix.needsUpdate=true; }

// ================= TRACK =================
let T = null;             // current track data
let levelGroup = null;

function buildTrack(lv){
  const segs = [['S',26], ...lv.segs, ['S',12]];
  const step=1.5; let x=0,z=0,h=0; const pts=[{x,z,h,w:lv.w}];
  for(const s of segs){
    if(s[0]==='S'){ const w=s[2]||lv.w; const n=Math.max(1,Math.round(s[1]/step)), ds=s[1]/n; for(let i=0;i<n;i++){ x+=Math.cos(h)*ds; z+=Math.sin(h)*ds; pts.push({x,z,h,w}); } }
    else { const w=s[3]||lv.w; const r=s[1], ang=s[2]*Math.PI/180*(s[0]==='R'?1:-1); const n=Math.max(2,Math.round(Math.abs(ang)*r/step)); const dh=ang/n, ds=2*r*Math.sin(Math.abs(dh)/2);
      for(let i=0;i<n;i++){ const hm=h+dh/2; x+=Math.cos(hm)*ds; z+=Math.sin(hm)*ds; h+=dh; pts.push({x,z,h,w}); } }
  }
  // smooth widths
  const ws = pts.map(p=>p.w); for(let i=0;i<pts.length;i++){ let a=0,c=0; for(let j=-8;j<=8;j++){ const k=clamp(i+j,0,pts.length-1); a+=ws[k]; c++; } pts[i].hw=a/c/2; }
  let s=0; pts.forEach((p,i)=>{ if(i>0) s+=Math.hypot(p.x-pts[i-1].x,p.z-pts[i-1].z); p.s=s;
    const a=pts[Math.max(0,i-1)], b=pts[Math.min(pts.length-1,i+1)]; const tx=b.x-a.x, tz=b.z-a.z, tl=Math.hypot(tx,tz)||1; p.tx=tx/tl; p.tz=tz/tl; p.nx=p.tz; p.nz=-p.tx; });
  const N=pts.length; const idxAt = ss => { let i=0; while(i<N-1 && pts[i].s<ss) i++; return i; };
  const startIdx = idxAt(24), finishIdx = idxAt(s-11);
  const raceLen = pts[finishIdx].s - pts[startIdx].s;
  const ncp = Math.max(2, Math.round(raceLen/55));
  const cps=[]; for(let k=1;k<=ncp;k++) cps.push(idxAt(pts[startIdx].s + raceLen*k/ncp)); cps[cps.length-1]=finishIdx;
  return { pts, N, startIdx, finishIdx, raceLen, cps, idxAt };
}
function nearest(px,pz,hint,win=60){
  const P=T.pts; let best=1e18, bi=0, bt=0; const lo=Math.max(0,hint-win), hi=Math.min(T.N-2,hint+win);
  for(let i=lo;i<=hi;i++){ const a=P[i], b=P[i+1]; const ex=b.x-a.x, ez=b.z-a.z; const l2=ex*ex+ez*ez||1e-6; let t=((px-a.x)*ex+(pz-a.z)*ez)/l2; t=t<0?0:t>1?1:t;
    const qx=a.x+ex*t, qz=a.z+ez*t, dd=(px-qx)*(px-qx)+(pz-qz)*(pz-qz); if(dd<best){ best=dd; bi=i; bt=t; } }
  const a=P[bi], b=P[bi+1]; const qx=a.x+(b.x-a.x)*bt, qz=a.z+(b.z-a.z)*bt;
  return { d:Math.sqrt(best), i:bi+(bt>.5?1:0), qx, qz, hw:lerp(a.hw,b.hw,bt) };
}
function trackPoint(i, lat){ const p=T.pts[clamp(i,0,T.N-1)]; return { x:p.x+p.nx*lat, z:p.z+p.nz*lat, h:Math.atan2(p.tz,p.tx), p }; }

function disposeGroup(g){ g.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{ if(m.map && !Object.values(groundTexes).includes(m.map) && m.map!==trackTex && m.map!==checkerTex) m.map.dispose(); m.dispose(); }); } }); }

let cones=[], cans=[], gates=[], fans=[], poleLights=[];
function buildLevel(li){
  const lv = LEVELS[li];
  if(levelGroup){ scene.remove(levelGroup); disposeGroup(levelGroup); }
  levelGroup = new THREE.Group(); scene.add(levelGroup);
  T = buildTrack(lv);
  const P=T.pts, N=T.N, R=rng(li*977+13);
  // lighting
  const tod = TOD[lv.tod];
  scene.background = skyTex(tod);
  scene.fog = new THREE.Fog(tod.fog, tod.night?40:90, tod.night?260:520);
  hemi.intensity = tod.hemi; hemi.color.set(tod.night?0x6070c0:0xfff1e0); hemi.groundColor.set(tod.night?0x101020:0x5a4a3a);
  sun.intensity = tod.sun; sun.color.set(tod.sunCol); T.sunDir = new THREE.Vector3(...tod.sunDir).normalize();
  T.night = tod.night; rig.spot.intensity = tod.night?60:0; mats.rev.emissiveIntensity = tod.night?3:.4; mats.head.emissiveIntensity = tod.night?3:1.2;
  renderer.toneMappingExposure = tod.night?1.25:1.05;
  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000,3000), new THREE.MeshStandardMaterial({ map:groundTex(tod.ground), roughness:.95 }));
  ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; levelGroup.add(ground);
  // track ribbon
  const pos=[], uv=[], idx=[];
  P.forEach((p,i)=>{ pos.push(p.x+p.nx*p.hw,.03,p.z+p.nz*p.hw, p.x-p.nx*p.hw,.03,p.z-p.nz*p.hw); uv.push(0,p.s/14,1,p.s/14); if(i<N-1){ const a=i*2; idx.push(a,a+2,a+1, a+1,a+2,a+3); } });
  const tg=new THREE.BufferGeometry(); tg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); tg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); tg.setIndex(idx); tg.computeVertexNormals();
  const track=new THREE.Mesh(tg,new THREE.MeshStandardMaterial({ map:trackTex, roughness:.85, side:THREE.DoubleSide })); track.receiveShadow=true; levelGroup.add(track);
  // barriers
  const segsB=[]; for(let i=0;i<N-2;i+=2){ for(const sd of [1,-1]){ const a=P[i], b=P[i+2]; const off=sd*(a.hw+.35), offb=sd*(b.hw+.35);
    const ax=a.x+a.nx*off, az=a.z+a.nz*off, bx=b.x+b.nx*offb, bz=b.z+b.nz*offb; segsB.push([ (ax+bx)/2, (az+bz)/2, Math.atan2(bz-az,bx-ax), Math.hypot(bx-ax,bz-az)*1.04, (i/2)%2 ]); } }
  // end caps
  for(const [ci,dir] of [[0,-1],[N-1,1]]){ const p=P[ci]; for(let l=-p.hw; l<p.hw; l+=2.9){ const x=p.x+p.nx*(l+1.45)+p.tx*dir*.4, z=p.z+p.nz*(l+1.45)+p.tz*dir*.4; segsB.push([x,z,Math.atan2(p.nz,p.nx),2.9,Math.round(l)%2?1:0]); } }
  const barGeo=new THREE.BoxGeometry(1,1.05,.7); barGeo.translate(0,.525,0);
  const bar=new THREE.InstancedMesh(barGeo,new THREE.MeshStandardMaterial({ roughness:.6 }),segsB.length);
  const cR=new THREE.Color(0xe53935), cW=new THREE.Color(0xf5f5f5);
  segsB.forEach((s,i)=>{ dummy.position.set(s[0],0,s[1]); dummy.rotation.set(0,-s[2],0); dummy.scale.set(s[3],1,1); dummy.updateMatrix(); bar.setMatrixAt(i,dummy.matrix); bar.setColorAt(i,s[4]?cR:cW); });
  dummy.scale.set(1,1,1); bar.castShadow=true; bar.receiveShadow=true; levelGroup.add(bar);
  // start & finish decals
  const decal = (i,label,c1,c2) => { const p=P[i]; const h=Math.atan2(p.tz,p.tx);
    const d=new THREE.Mesh(new THREE.BoxGeometry(3,.04,p.hw*2),new THREE.MeshStandardMaterial({ map:checkerTex })); d.position.set(p.x,.04,p.z); d.rotation.y=-h; d.receiveShadow=true; levelGroup.add(d);
    return gate(i,label,c1,c2,true); };
  // gates
  gates=[];
  function gate(i,label,c1,c2,special){ const p=P[i]; const h=Math.atan2(p.tz,p.tx); const g=new THREE.Group(); g.position.set(p.x,0,p.z); g.rotation.y=-h;
    const W=p.hw*2+2.4; const postM=new THREE.MeshStandardMaterial({ color:0x263238, metalness:.6, roughness:.4 });
    for(const sd of [-1,1]){ const post=new THREE.Mesh(new THREE.CylinderGeometry(.28,.34,8.4,10),postM); post.position.set(0,4.2,sd*(W/2)); post.castShadow=true; g.add(post); }
    const btx=bannerTex(label,c1,c2); const bm=new THREE.MeshStandardMaterial({ map:btx, emissive:0xffffff, emissiveMap:btx, emissiveIntensity:tod.night?.35:.08 });
    const banner=new THREE.Mesh(new THREE.BoxGeometry(.5,1.6,W),[bm,bm,postM,postM,postM,postM]); banner.position.y=7.6; banner.castShadow=true; g.add(banner);
    const lightM=new THREE.MeshStandardMaterial({ color:0xff6d00, emissive:0xff6d00, emissiveIntensity:1.5 });
    const strip=new THREE.Mesh(new THREE.BoxGeometry(.55,.18,W),lightM); strip.position.y=6.7; g.add(strip);
    levelGroup.add(g); const o={ g, lightM, i, special }; gates.push(o); return o; }
  T.startGate = decal(T.startIdx,'START','#ff6d00','#ff1744');
  gates=[];
  T.cps.forEach((ci,k)=>{ if(k===T.cps.length-1) decal(ci,'FINISH','#00c853','#00b8d4'); else gate(ci,'CHECKPOINT '+(k+1),'#ffab00','#ff6d00'); });
  // warehouse / dock at end
  { const p=P[N-1]; const h=Math.atan2(p.tz,p.tx); const g=new THREE.Group(); g.position.set(p.x+p.tx*1.2,0,p.z+p.tz*1.2); g.rotation.y=-h; const hw=p.hw;
    const wallM=new THREE.MeshStandardMaterial({ color:0x90a4ae, roughness:.8 }), roofM=new THREE.MeshStandardMaterial({ color:0x546e7a, roughness:.7 });
    const BB=(w,hh,d,m,x,y,z)=>{ const me=new THREE.Mesh(new THREE.BoxGeometry(w,hh,d),m); me.position.set(x,y,z); me.castShadow=true; me.receiveShadow=true; g.add(me); };
    const W=hw*2+16; BB(1,13,W,wallM,24,6.5,0); BB(24,13,1,wallM,12,6.5,W/2); BB(24,13,1,wallM,12,6.5,-W/2); BB(25,1,W+1,roofM,12,13.5,0);
    BB(1,13,8,wallM,0,6.5,hw+4.4); BB(1,13,8,wallM,0,6.5,-hw-4.4); BB(1,5,hw*2+1,wallM,0,10.5,0);
    const sign=new THREE.Mesh(new THREE.BoxGeometry(.3,2.2,hw*1.6),new THREE.MeshStandardMaterial({ map:(window._dt=bannerTex('DOCK 7','#1565c0','#00838f')), emissiveMap:window._dt, emissive:0xffffff, emissiveIntensity:tod.night?.5:.1 }));
    sign.position.set(-.7,10.4,0); g.add(sign);
    const inner=new THREE.Mesh(new THREE.PlaneGeometry(23,W-1),new THREE.MeshStandardMaterial({ color:0x1b1b1f })); inner.rotation.x=-Math.PI/2; inner.position.set(12,.05,0); g.add(inner);
    const il=new THREE.PointLight(0xffd180, tod.night?300:120, 34); il.position.set(10,10,0); g.add(il);
    levelGroup.add(g); }
  // decorations: containers
  const farOK = (x,z,m) => { for(let i=0;i<N;i+=3){ const p=P[i]; if((p.x-x)**2+(p.z-z)**2 < (p.hw+m)**2) return false; } return true; };
  const cont=[]; let tries=0;
  while(cont.length<140 && tries<2500){ tries++; const i=Math.floor(R()*N), sd=R()<.5?-1:1, off=P[i].hw+5+R()*55; const x=P[i].x+P[i].nx*off*sd, z=P[i].z+P[i].nz*off*sd;
    if(!farOK(x,z,5)) continue; const rot=Math.atan2(P[i].tz,P[i].tx)+(R()<.5?0:Math.PI/2)+(R()-.5)*.2; const stack=R()<.4?2:1; for(let k=0;k<stack;k++) cont.push([x,z,rot,1.3+k*2.6,Math.floor(R()*7)]); }
  const cGeo=new THREE.BoxGeometry(6.1,2.6,2.44); const cTex=canvasTex(128,64,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); g.fillStyle='#0000002a'; for(let x=0;x<w;x+=6) g.fillRect(x,0,3,h); g.fillStyle='#00000040'; g.fillRect(0,0,w,3); g.fillRect(0,h-3,w,3); });
  const cMesh=new THREE.InstancedMesh(cGeo,new THREE.MeshStandardMaterial({ map:cTex, roughness:.7, metalness:.2 }),Math.max(1,cont.length));
  const cc=[0xc62828,0x1565c0,0x2e7d32,0xef6c00,0x6a1b9a,0x00838f,0x4e342e].map(c=>new THREE.Color(c));
  cont.forEach((c,i)=>{ dummy.position.set(c[0],c[3],c[1]); dummy.rotation.set(0,-c[2],0); dummy.updateMatrix(); cMesh.setMatrixAt(i,dummy.matrix); cMesh.setColorAt(i,cc[c[4]]); });
  cMesh.count=cont.length; cMesh.castShadow=true; cMesh.receiveShadow=true; levelGroup.add(cMesh);
  // light poles
  poleLights=[]; const poleM=new THREE.MeshStandardMaterial({ color:0x37474f, metalness:.5 }); const bulbM=new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xffe0a0, emissiveIntensity:tod.night?4:.3 });
  let lightsMade=0;
  for(let i=6;i<N;i+=22){ const sd=(i/22|0)%2?1:-1; const p=P[i]; const off=sd*(p.hw+2.2); const x=p.x+p.nx*off, z=p.z+p.nz*off;
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.15,.22,11,8),poleM); pole.position.set(x,5.5,z); pole.castShadow=true; levelGroup.add(pole);
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,2.6),poleM); arm.position.set(x-p.nx*sd*1.2,10.9,z-p.nz*sd*1.2); arm.rotation.y=-Math.atan2(p.tz,p.tx); levelGroup.add(arm);
    const bulb=new THREE.Mesh(new THREE.BoxGeometry(.8,.25,1.2),bulbM); bulb.position.set(x-p.nx*sd*2.3,10.75,z-p.nz*sd*2.3); bulb.rotation.y=arm.rotation.y; levelGroup.add(bulb);
    if(tod.night && lightsMade<10){ const pl=new THREE.PointLight(0xffc880, 140, 34, 1.6); pl.position.copy(bulb.position); pl.position.y-=.6; levelGroup.add(pl); lightsMade++; } }
  // cones
  cones=[]; const coneGeo=new THREE.ConeGeometry(.38,1.0,14); coneGeo.translate(0,.5,0); const coneM=new THREE.MeshStandardMaterial({ color:0xff5d00, roughness:.5, emissive:0xff3d00, emissiveIntensity:tod.night?.35:.05 });
  const baseGeo=new THREE.BoxGeometry(.8,.08,.8); baseGeo.translate(0,.04,0); const bandM=new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xffffff, emissiveIntensity:tod.night?.6:0 });
  const bandGeo=new THREE.CylinderGeometry(.21,.26,.16,14); bandGeo.translate(0,.55,0);
  const raceIdx = f => T.idxAt(P[T.startIdx].s + T.raceLen*f);
  lv.cones.forEach(([f,lat])=>{ const i=raceIdx(f); const tp=trackPoint(i, lat*P[i].hw); const g=new THREE.Group(); g.add(new THREE.Mesh(coneGeo,coneM)); g.add(new THREE.Mesh(baseGeo,coneM)); g.add(new THREE.Mesh(bandGeo,bandM));
    g.children.forEach(c=>c.castShadow=true); g.position.set(tp.x,0,tp.z); levelGroup.add(g); cones.push({ g, x:tp.x, z:tp.z, y:0, hx:tp.x, hz:tp.z, vx:0,vy:0,vz:0, rx:0,rz:0, wx:0, wz:0, hit:false, i }); });
  // diesel cans
  cans=[]; const canM0=new THREE.MeshStandardMaterial({ color:0x00e676, emissive:0x00e676, emissiveIntensity:.7, metalness:.4, roughness:.3 });
  const capM0=new THREE.MeshStandardMaterial({ color:0xffeb3b, emissive:0xffc400, emissiveIntensity:.6 });
  lv.cans.forEach(([f,lat])=>{ const canM=canM0.clone(), capM=capM0.clone(); const i=raceIdx(f); const tp=trackPoint(i, lat*P[i].hw); const g=new THREE.Group(); const b=new THREE.Mesh(new THREE.BoxGeometry(.8,1.0,.45),canM); b.position.y=1.4; g.add(b);
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.22,8),capM); cap.position.set(.2,2.0,0); g.add(cap); const hdl=new THREE.Mesh(new THREE.BoxGeometry(.4,.12,.12),capM); hdl.position.set(-.12,1.98,0); g.add(hdl);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.9,.06,8,32),new THREE.MeshBasicMaterial({ color:0x69f0ae, transparent:true, opacity:.6 })); ring.rotation.x=Math.PI/2; ring.position.y=.1; g.add(ring);
    g.position.set(tp.x,0,tp.z); levelGroup.add(g); cans.push({ g, x:tp.x, z:tp.z, taken:false, t:0, i }); });
  // fans near checkpoints
  fans=[]; const skin=[0xf1c27d,0xe0ac69,0x8d5524,0xc68642,0xffdbac]; const shirts=[0xff1744,0x2979ff,0xffea00,0x00e676,0xd500f9,0xff9100,0xffffff];
  const headG=new THREE.SphereGeometry(.28,10,8), bodyG=new THREE.CylinderGeometry(.28,.34,1.1,8), armG=new THREE.BoxGeometry(.12,.7,.12);
  T.cps.forEach((ci,k)=>{ const p=P[ci]; for(let n=0;n<8;n++){ const sd=n%2?1:-1; const along=(Math.floor(n/2)-1.5)*2.2; const off=sd*(p.hw+2.6+R()*2.5); const x=p.x+p.nx*off+p.tx*along, z=p.z+p.nz*off+p.tz*along;
    const g=new THREE.Group(); const bm=new THREE.MeshStandardMaterial({ color:shirts[Math.floor(R()*shirts.length)] }); const body=new THREE.Mesh(bodyG,bm); body.position.y=.75; body.castShadow=true; g.add(body);
    const head=new THREE.Mesh(headG,new THREE.MeshStandardMaterial({ color:skin[Math.floor(R()*skin.length)] })); head.position.y=1.6; g.add(head);
    const a1=new THREE.Mesh(armG,bm); a1.position.set(0,1.45,.38); const a2=a1.clone(); a2.position.z=-.38; g.add(a1,a2);
    g.position.set(x,0,z); g.rotation.y=-Math.atan2(p.z-z,p.x-x); levelGroup.add(g); fans.push({ g, a1, a2, i:ci, ph:R()*6, jump:0 }); } });
  // ghost
  const rec = store.get(`rec_${li}_${S.mode}`, null);
  S.best = rec; ghostRig.tractor.visible = ghostRig.trailer.visible = false;
}

// ================= GAME STATE =================
const S = {
  state:'menu', level: store.get('lastLevel',0), mode: store.get('mode','rookie'), paint: store.get('paint',0), cam:0, guide:true,
  x:0,z:0,th:0,ph:0,dl:0,v:0, nitro:.5, time:0, pen:0, bonus:0, cdown:0,
  conesHit:0, walls:0, jacks:0, resets:0, cansGot:0, perfect:false,
  hitchIdx:0, rearIdx:0, nextCp:0, splits:[], ghost:[], ghostT:0, best:null,
  wasHit:false, lastImpact:-9, shake:0, nopeT:0, finishT:0, wheelDist:0, steerAxis:0, jackT:0, totalAtFinish:0,
};
let resultsTimer=null;
const keys = { rev:false, brake:false, left:false, right:false, nitro:false };
mats.paint.color.set(PAINTS[S.paint]);

function poseAt(rearI){
  const step = 1.5; const R0 = T.pts[clamp(rearI,0,T.N-1)];
  const hi = clamp(Math.round(rearI - TR_BACK/step), 0, T.N-1), fi = clamp(Math.round(rearI - (TR_BACK+4.5)/step), 0, T.N-1);
  const H = T.pts[hi], F = T.pts[fi];
  let ph = Math.atan2(H.z-R0.z, H.x-R0.x); let th = (hi===fi) ? ph : Math.atan2(F.z-H.z, F.x-H.x);
  while(th-ph>Math.PI) th-=Math.PI*2; while(th-ph<-Math.PI) th+=Math.PI*2;
  return { x: R0.x + Math.cos(ph)*TR_BACK, z: R0.z + Math.sin(ph)*TR_BACK, th, ph };
}
function placeRig(rearI){ const p=poseAt(rearI); S.x=p.x; S.z=p.z; S.th=p.th; S.ph=p.ph; S.v=0; S.dl=0; S.hitchIdx=nearest(S.x,S.z,rearI,200).i; S.rearIdx=rearI; }

function startLevel(li){
  clearTimeout(resultsTimer); resultsTimer=null;
  SFX.init();
  S.level=li; store.set('lastLevel',li);
  buildLevel(li);
  S.time=0; S.pen=0; S.bonus=0; S.conesHit=0; S.walls=0; S.jacks=0; S.resets=0; S.cansGot=0; S.perfect=false; S.nitro=.5;
  S.nextCp=0; S.splits=[]; S.ghost=[]; S.ghostT=0; S.wasHit=false; S.shake=0; S.finishT=0; S.wheelDist=0; S.steerAxis=0;
  placeRig(T.startIdx);
  S.state='countdown'; S.cdown=3; S.lastCount=99;
  $('menu').classList.add('hide'); $('results').classList.add('hide'); $('pauseS').classList.add('hide');
  $('hud').style.display='block'; $('minimap').style.display='block';
  $('lvlName').textContent = `${li+1}. ${LEVELS[li].name.toUpperCase()}`;
  $('delta').textContent=''; $('pen').textContent='';
  if(isTouch) $('touch').style.display='block';
  prepMinimap();
  snapCamera();
  const ghostOn = S.best && S.best.ghost && S.best.ghost.length>4;
  ghostRig.tractor.visible = ghostRig.trailer.visible = !!ghostOn;
  showHint(li===0 && S.mode==='rookie' ? 'Hold S / ↓ to reverse. Steer A/D — the trailer follows your keys. Follow the cyan guide!' :
    li===0 ? 'PRO: raw steering. Counter-steer early or jackknife!' : (ghostOn ? 'Racing your ghost 👻 — beat your best!' : LEVELS[li].sub), 4.5);
}

function popup(text, cls='info'){ const d=document.createElement('div'); d.className='popup '+cls; d.textContent=text; $('popups').appendChild(d); setTimeout(()=>d.remove(),1650); while($('popups').children.length>4) $('popups').firstChild.remove(); }
function big(text, color){ const b=$('big'); b.textContent=text; b.style.color=color||'#fff'; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); b.style.opacity=1; clearTimeout(big.t); big.t=setTimeout(()=>b.style.opacity=0, 900); }
let hintT=null; function showHint(t,dur){ const h=$('hint'); h.textContent=t; h.style.opacity=1; clearTimeout(hintT); hintT=setTimeout(()=>h.style.opacity=0, dur*1000); }
function flash(col,op=.5){ const f=$('flash'); f.style.transition='none'; f.style.background=col; f.style.opacity=op; requestAnimationFrame(()=>{ f.style.transition='opacity .45s'; f.style.opacity=0; }); }

// ================= PHYSICS =================
const fwd = a => [Math.cos(a), Math.sin(a)];
function steerTarget(th, ph, axis){
  if(S.mode==='rookie'){ const g=th-ph; const gs=axis*0.62; const tn=WB*(-0.36*(g-gs) - Math.sin(g)/DH); return clamp(Math.atan(tn),-MAXSTEER,MAXSTEER); }
  return axis*MAXSTEER;
}
function kin(st, v, h){ const c=Math.cos(st.th), s=Math.sin(st.th); st.x+=v*c*h; st.z+=v*s*h; st.th+=-v/WB*Math.tan(st.dl)*h; st.ph+=v/DH*Math.sin(st.th-st.ph)*h; }
function rigPoints(){
  const out=[]; const [c,s]=fwd(S.th), [cp,sp]=fwd(S.ph);
  const tp=(lx,ly)=>out.push([S.x+c*lx+s*ly, S.z+s*lx-c*ly]);
  const pp=(lx,ly)=>out.push([S.x+cp*lx+sp*ly, S.z+sp*lx-cp*ly]);
  for(const ly of [TC_W/2,-TC_W/2]){ tp(TC_FRONT,ly); tp(TC_BACK*-1+0.2,ly); tp(3,ly); }
  for(const ly of [TR_W/2,-TR_W/2]){ for(const lx of [TR_FRONT,-2.5,-5,-7.5,-TR_BACK]) pp(lx,ly); }
  return out;
}
function inRig(x,z,pad){
  let dx=x-S.x, dz=z-S.z; let c=Math.cos(S.th), s=Math.sin(S.th);
  let lx=dx*c+dz*s, ly=dx*s-dz*c; if(lx>-TC_BACK-pad && lx<TC_FRONT+pad && Math.abs(ly)<TC_W/2+pad) return 1;
  c=Math.cos(S.ph); s=Math.sin(S.ph); lx=dx*c+dz*s; ly=dx*s-dz*c; if(lx>-TR_BACK-pad && lx<TR_FRONT+pad && Math.abs(ly)<TR_W/2+pad) return 2;
  return 0;
}

function physics(h){
  const racing = S.state==='race';
  const rev = racing && keys.rev;
  const brake = keys.brake || S.state==='finished' || S.state==='jack';
  const nitroOn = racing && keys.nitro && S.nitro>0.01 && rev;
  // steering
  const axis = (keys.left?1:0) - (keys.right?1:0);
  S.steerAxis += clamp(axis - S.steerAxis, -h*(S.mode==='rookie'?5:4), h*(S.mode==='rookie'?5:4));
  if(S.state!=='jack'){ const tgt=steerTarget(S.th,S.ph,S.steerAxis); const rate=S.mode==='rookie'?6:2.6; S.dl+=clamp(tgt-S.dl,-rate*h,rate*h); }
  // speed
  const vmax = nitroOn ? 22 : 15;
  if(rev){ S.v -= (nitroOn?16:8.5)*h*(1-Math.max(0,-S.v)/vmax*.6); }
  if(S.v < -vmax) S.v = lerp(S.v, -vmax, .08);
  if(brake){ const b=(S.state==='finished'?9:22)*h; S.v = S.v<0 ? Math.min(0,S.v+b) : Math.max(0,S.v-b); }
  if(!rev && !brake){ const b=1.6*h; S.v = S.v<0 ? Math.min(0,S.v+b) : Math.max(0,S.v-b); }
  S.v -= S.v*0.06*h;
  if(S.v>0) S.v=Math.max(0,S.v-9*h);
  if(nitroOn) S.nitro=Math.max(0,S.nitro-0.32*h); else if(racing) S.nitro=Math.min(1,S.nitro+0.025*h);
  S.nitroOn = nitroOn;
  // integrate
  kin(S, S.v, h);
  S.wheelDist += S.v*h;
  // collisions
  let hit=false, hx=0, hz=0;
  const pts=rigPoints();
  for(const p of pts){ const q=nearest(p[0],p[1],S.hitchIdx); const lim=q.hw-.12; if(q.d>lim){ const pen=q.d-lim; const nx=(p[0]-q.qx)/q.d, nz=(p[1]-q.qz)/q.d; S.x-=nx*pen; S.z-=nz*pen; hit=true; hx=p[0]; hz=p[1]; } }
  const now=S.time;
  if(hit){
    if(!S.wasHit && Math.abs(S.v)>4 && now-S.lastImpact>.5 && racing){
      S.lastImpact=now; S.walls++; S.pen+=.5; popup('WALL! +0.5s','bad'); SFX.crash(); S.shake=Math.min(1.2,Math.abs(S.v)/12); S.v=-S.v*.22;
      for(let k=0;k<14;k++) emit(hx,1+Math.random(),hz,{ vx:(Math.random()-.5)*10, vy:3+Math.random()*6, vz:(Math.random()-.5)*10, c:0xffb300, add:true, life:.5, s0:.35, s1:.1, a:1, grav:18 });
    } else { S.v*=(1-2.2*h); if(Math.random()<.25 && Math.abs(S.v)>1){ emit(hx,.8,hz,{ vx:(Math.random()-.5)*5, vy:2+Math.random()*3, vz:(Math.random()-.5)*5, c:0xffd54f, add:true, life:.35, s0:.25, s1:.05, a:1, grav:14 }); if(Math.random()<.3) SFX.scrape(); } }
  }
  S.wasHit=hit;
  // track progress
  S.hitchIdx = nearest(S.x,S.z,S.hitchIdx,30).i;
  const [cp,sp]=fwd(S.ph); const rx=S.x-cp*TR_BACK, rz=S.z-sp*TR_BACK; S.rx=rx; S.rz=rz;
  S.rearIdx = nearest(rx,rz,S.hitchIdx+7,30).i;
  // jackknife
  const gam=S.th-S.ph;
  if(racing && Math.abs(gam)>JACK){ jackknife(); }
}

function jackknife(){
  S.state='jack'; S.jackT=1.6; S.jacks++; S.pen+=3; S.v*=.2; SFX.jack(); S.shake=1.4; flash('#ff1744',.55);
  big('JACKKNIFE!','#ff5252'); popup('+3.0s','bad');
}
function resetToCheckpoint(manual){
  const ci = S.nextCp>0 ? T.cps[S.nextCp-1] : T.startIdx;
  placeRig(ci); S.state='race'; S.wasHit=false;
  if(manual){ S.resets++; S.pen+=3; popup('TOW TRUCK! +3.0s','bad'); }
  for(let k=0;k<20;k++) emit(S.x+(Math.random()-.5)*12, .5, S.z+(Math.random()-.5)*12, { vy:2, c:0xffffff, life:1, s0:1, s1:4, a:.5 });
}

function finishRace(){
  S.state='finished'; S.finishT=0;
  const gam=Math.abs(S.th-S.ph);
  if(Math.abs(S.v)<6 && gam<.14){ S.perfect=true; S.bonus+=2; popup('PERFECT DOCK! -2.0s','good'); }
  const total = S.time + S.pen - S.bonus; S.totalAtFinish = total;
  SFX.finish(); big('DELIVERED!','#69f0ae'); flash('#fff',.4);
  confettiBurst(S.rx,S.rz);
  const key=`rec_${S.level}_${S.mode}`; const prev=store.get(key,null);
  const newRec = !prev || total < prev.t;
  if(newRec){ store.set(key,{ t:total, ghost:S.ghost, splits:S.splits }); }
  const med = medalFor(S.level, S.mode, total);
  const mk=`medal_${S.level}`; const pm=store.get(mk,0); if(med.rank>pm) store.set(mk,med.rank);
  resultsTimer=setTimeout(()=>{ resultsTimer=null; showResults(total, prev, newRec, med); }, 2200);
}
function targetsFor(li, mode){ const tr=buildTrackCache(li); const k = mode==='pro'?1.12:1; const r=x=>Math.round(x*2)/2;
  return { gold:r(tr.raceLen/9.2*k), silver:r(tr.raceLen/7*k), bronze:r(tr.raceLen/5*k) }; }
const tcache={}; function buildTrackCache(li){ return tcache[li] || (tcache[li]=buildTrack(LEVELS[li])); }
function medalFor(li, mode, t){ const g=targetsFor(li,mode); if(t<=g.gold) return {rank:3,icon:'🥇',name:'GOLD'}; if(t<=g.silver) return {rank:2,icon:'🥈',name:'SILVER'}; if(t<=g.bronze) return {rank:1,icon:'🥉',name:'BRONZE'}; return {rank:0,icon:'📦',name:'DELIVERED'}; }

const quips = ['The trailer has accepted you as its leader.','Your chiropractor sends regards.','Forward gear? Never heard of her.','Mirrors: polished. Ego: inflated.','That was beautiful. In reverse.'];
function showResults(total, prev, newRec, med){
  S.state='results'; SFX.silence();
  $('rMedal').textContent=med.icon; $('rTitle').textContent = med.rank? med.name+' MEDAL!' : 'DELIVERED… ON TIME-ISH';
  $('rTime').textContent=fmt(total);
  $('rRecord').textContent = newRec ? (prev?`NEW RECORD! −${(prev.t-total).toFixed(2)}s`:'FIRST DELIVERY RECORDED!') : `BEST ${fmt(prev.t)}  (+${(total-prev.t).toFixed(2)}s)`;
  $('rRecord').style.animation = newRec?'':'none'; $('rRecord').style.color = newRec?'':'#ffd54f';
  const rows=[['Drive time',fmt(S.time),'']];
  if(S.conesHit) rows.push([`Cones flattened ×${S.conesHit}`,'+'+(S.conesHit*2).toFixed(1)+'s','b']);
  if(S.walls) rows.push([`Wall kisses ×${S.walls}`,'+'+(S.walls*.5).toFixed(1)+'s','b']);
  if(S.jacks) rows.push([`Jackknifes ×${S.jacks}`,'+'+(S.jacks*3).toFixed(1)+'s','b']);
  if(S.resets) rows.push([`Tow trucks ×${S.resets}`,'+'+(S.resets*3).toFixed(1)+'s','b']);
  if(S.cansGot) rows.push([`Diesel cans ×${S.cansGot}`,'−'+S.cansGot.toFixed(1)+'s','g']);
  if(S.perfect) rows.push(['Perfect dock','−2.0s','g']);
  if(!S.conesHit && !S.walls && !S.jacks && !S.resets) rows.push(['🧼 CLEAN RUN','✓','g']);
  $('rStats').innerHTML = rows.map(r=>`<div class="${r[2]}">${r[0]}</div><div class="${r[2]}" style="text-align:right;font-weight:800">${r[1]}</div>`).join('');
  const g=targetsFor(S.level,S.mode);
  $('rTargets').innerHTML = `🥇 ${fmt(g.gold)} &nbsp; 🥈 ${fmt(g.silver)} &nbsp; 🥉 ${fmt(g.bronze)}<br><i>${quips[Math.floor(Math.random()*quips.length)]}</i>`;
  $('rNext').style.display = S.level<LEVELS.length-1 ? '' : 'none';
  $('results').classList.remove('hide'); $('touch').style.display='none';
}

// ================= UPDATE LOOP =================
const camPos=new THREE.Vector3(), camLook=new THREE.Vector3(), tmpV=new THREE.Vector3(), tmpL=new THREE.Vector3();
const CAMS=['CHASE CAM','DRONE CAM','MIRROR CAM'];
function camTarget(){
  const [c,s]=fwd(S.th), [cp,sp]=fwd(S.ph);
  const cx=S.x-cp*5, cz=S.z-sp*5; const spd=Math.abs(S.v);
  if(S.cam===0){ const back=17+spd*.25; tmpV.set(cx+cp*back, 9+spd*.12, cz+sp*back); tmpL.set(cx-cp*14, 1, cz-sp*14); }
  else if(S.cam===1){ tmpV.set(cx+cp*10, 42, cz+sp*10); tmpL.set(cx-cp*10, 0, cz-sp*10); }
  else { const lx=s, lz=-c; tmpV.set(S.x+c*4.05+lx*1.9, 3.35, S.z+s*4.05+lz*1.9); tmpL.set(S.x-cp*24+lx*.9, 1.2, S.z-sp*24+lz*.9); }
}
function snapCamera(){ camTarget(); camPos.copy(tmpV); camLook.copy(tmpL); }

// guide line
const GN=48; const guideGeo=new THREE.BufferGeometry(); guideGeo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(GN*3),3));
const guideMat=new THREE.PointsMaterial({ color:0x00e5ff, size:.7, transparent:true, opacity:.85, depthWrite:false, map:smokeTex, blending:THREE.AdditiveBlending });
const guide=new THREE.Points(guideGeo,guideMat); guide.frustumCulled=false; scene.add(guide);
function updGuide(){
  guide.visible = S.guide && (S.state==='race'||S.state==='countdown');
  if(!guide.visible) return;
  const st={ x:S.x,z:S.z,th:S.th,ph:S.ph,dl:S.dl }; const v=Math.min(-6, S.v); const arr=guideGeo.attributes.position.array; let danger=false;
  for(let i=0;i<GN;i++){ for(let k=0;k<3;k++){ const tg=steerTarget(st.th,st.ph,S.steerAxis); const r=S.mode==='rookie'?6:2.6; st.dl+=clamp(tg-st.dl,-r*.02,r*.02); kin(st,v,.02); }
    if(Math.abs(st.th-st.ph)>JACK*.85) danger=true;
    const [cp,sp]=fwd(st.ph); arr[i*3]=st.x-cp*TR_BACK; arr[i*3+1]=.25; arr[i*3+2]=st.z-sp*TR_BACK; }
  guideGeo.attributes.position.needsUpdate=true; guideMat.color.set(danger?0xff1744:0x00e5ff);
}

function update(dt){
  const st=S.state;
  if(st==='paused' || st==='menu' || st==='results'){ if(st==='menu') menuCam(dt); if(st==='results') S.finishT+=dt; updParts(dt); updConf(dt); return; }
  if(st==='countdown'){
    S.cdown-=dt; const n=Math.ceil(S.cdown);
    if(n!==S.lastCount && n>0){ S.lastCount=n; big(String(n),'#ffd54f'); SFX.count(); }
    if(S.cdown<=0){ S.state='race'; big('REVERSE!','#ff6d00'); SFX.go(); }
  }
  if(st==='jack'){ S.jackT-=dt; S.th += (S.th-S.ph>0?1:-1)*dt*.4; if(S.jackT<=0){ resetToCheckpoint(false); } }
  const sub=4; for(let i=0;i<sub;i++) physics(dt/sub);
  if(S.state==='race'){
    S.time+=dt;
    S.ghostT+=dt; if(S.ghostT>=.05){ S.ghostT-=.05; S.ghost.push(+S.x.toFixed(2),+S.z.toFixed(2),+S.th.toFixed(3),+S.ph.toFixed(3)); }
    // checkpoints
    if(S.nextCp<T.cps.length && S.rearIdx>=T.cps[S.nextCp]){
      const tot=S.time+S.pen-S.bonus; S.splits.push(tot);
      const g=gates.find(o=>o.i===T.cps[S.nextCp]); if(g){ g.lightM.color.set(0x00e676); g.lightM.emissive.set(0x00e676); }
      S.nextCp++;
      if(S.nextCp===T.cps.length){ finishRace(); }
      else { SFX.chime(); popup(`CHECKPOINT ${S.nextCp}/${T.cps.length-1}`,'info');
        if(S.best && S.best.splits && S.best.splits[S.nextCp-1]!=null){ const d=tot-S.best.splits[S.nextCp-1]; const el=$('delta'); el.textContent=(d<0?'−':'+')+Math.abs(d).toFixed(2); el.style.color=d<0?'#69f0ae':'#ff5252'; clearTimeout(el.t); el.t=setTimeout(()=>el.textContent='',3000); } }
    }
    if(S.time>0 && keys.brakeTap && Math.abs(S.v)<.6 && S.time-S.nopeT>1.4){ S.nopeT=S.time; SFX.nope(); popup('FORWARD GEAR NOT INCLUDED 🚫','bad'); }
  }
  keys.brakeTap=false;
  if(S.state==='finished'){ S.finishT+=dt; }
  // cones
  for(const c of cones){
    if(!c.hit){ if(S.state==='race'||S.state==='jack'){ const r=inRig(c.x,c.z,.38); if(r){ c.hit=true; S.conesHit++; S.pen+=2; SFX.cone(); popup('CONE! +2.0s','bad'); S.shake=Math.max(S.shake,.35);
        const a = r===1?S.th:S.ph; const vx=S.v*Math.cos(a), vz=S.v*Math.sin(a); const ox=c.x-S.x, oz=c.z-S.z, ol=Math.hypot(ox,oz)||1;
        c.vx=vx*1.3+ox/ol*3+(Math.random()-.5)*3; c.vz=vz*1.3+oz/ol*3+(Math.random()-.5)*3; c.vy=5+Math.abs(S.v)*.5; c.wx=(Math.random()-.5)*16; c.wz=(Math.random()-.5)*16; } } }
    else { c.vy-=22*dt; c.x+=c.vx*dt; c.z+=c.vz*dt; c.y+=c.vy*dt; c.rx+=c.wx*dt; c.rz+=c.wz*dt;
      if(c.y<0){ c.y=0; c.vy*=-.35; c.vx*=.6; c.vz*=.6; c.wx*=.6; c.wz*=.6; if(Math.abs(c.vy)<1){ c.vy=0; c.rx=lerp(c.rx,Math.PI/2*Math.sign(c.rx||1),.2); } }
      c.g.position.set(c.x,c.y,c.z); c.g.rotation.set(c.rx,0,c.rz); }
  }
  // cans
  for(const c of cans){ c.t+=dt;
    if(!c.taken){ c.g.children[0].rotation.y+=dt*2; c.g.children[0].position.y=1.4+Math.sin(c.t*3)*.2; c.g.children[1].position.y=2.0+Math.sin(c.t*3)*.2; c.g.children[2].position.y=1.98+Math.sin(c.t*3)*.2; c.g.children[3].scale.setScalar(1+Math.sin(c.t*4)*.1);
      if(S.state==='race' && inRig(c.x,c.z,.6)){ c.taken=true; c.t=0; S.cansGot++; S.bonus+=1; S.nitro=Math.min(1,S.nitro+.35); SFX.can(); popup('DIESEL! −1.0s ⚡','good'); } }
    else { const k=Math.min(1,c.t/.4); c.g.scale.setScalar(1+k*1.5); c.g.position.y=k*3; c.g.visible = k<1; c.g.traverse(o=>{ if(o.material) { o.material.transparent=true; o.material.opacity=1-k; } }); }
  }
  // fans
  const tt=performance.now()/1000;
  for(const f of fans){ const near = Math.abs(S.rearIdx - f.i) < 14 || Math.abs(S.hitchIdx - f.i) < 10; f.jump = lerp(f.jump, near?1:0.08, dt*4);
    const j=Math.abs(Math.sin(tt*9+f.ph))*.55*f.jump; f.g.position.y=j; const arm=near?-2.6:-.2; f.a1.rotation.x=lerp(f.a1.rotation.x,arm+Math.sin(tt*14+f.ph)*.3*f.jump,.2); f.a2.rotation.x=-f.a1.rotation.x; }
  // effects
  const [c0,s0]=fwd(S.th); const lx=s0, lz=-c0; const throttle = (keys.rev && S.state==='race')?1:0;
  if(Math.random() < (throttle? .8 : .15)){ for(const sd of [1,-1]){ const x=S.x+c0*1.55+lx*1.2*sd, z=S.z+s0*1.55+lz*1.2*sd;
    if(S.nitroOn){ emit(x,5.1,z,{ vy:6, vx:(Math.random()-.5), vz:(Math.random()-.5), c:Math.random()<.5?0x40c4ff:0xb388ff, add:true, life:.35, s0:.9, s1:.3, a:1 }); }
    else emit(x,5.1,z,{ vy:2.5+throttle*2, vx:(Math.random()-.5)+c0*S.v*-.05, vz:(Math.random()-.5), c:throttle?0x333333:0x888888, life:1.6, s0:.5, s1:2.6, a:throttle?.45:.25 }); } }
  if(Math.abs(S.v)>7 && Math.random()<.5){ const [cp,sp]=fwd(S.ph); const x=S.x-cp*8.6, z=S.z-sp*8.6; for(const sd of [1,-1]) emit(x+sp*1.3*sd,.4,z-cp*1.3*sd,{ vy:.8, vx:(Math.random()-.5)*2, vz:(Math.random()-.5)*2, c:T.night?0x555566:0xc8b49a, life:1.2, s0:.8, s1:3.5, a:.3 }); }
  if(S.state==='finished' && S.finishT<3 && Math.random()<.3){ emit(S.rx+(Math.random()-.5)*8, 5+Math.random()*4, S.rz+(Math.random()-.5)*8,{ c:confCols[Math.floor(Math.random()*6)], add:true, life:.8, s0:1.5, s1:.1, a:1, vy:2 }); }
  updParts(dt); updConf(dt); updGuide();
  // audio
  const beep = Math.abs(S.v)>.3 && S.v<0 && (tt%1)<.5 && S.state!=='finished';
  SFX.engine(S.v, throttle, S.nitroOn, beep);
  S.shake = Math.max(0, S.shake - dt*2.2);
}

function updateVisuals(dt){
  if(T && T.night) scene.background.userData.twinkle(dt);
  rig.tractor.position.set(S.x,0,S.z); rig.tractor.rotation.y=-S.th;
  rig.trailer.position.set(S.x,0,S.z); rig.trailer.rotation.y=-S.ph;
  rig.steerPivots.forEach(p=>p.rotation.y=S.dl);
  rig.spinners.forEach(w=>w.sp.rotation.z=-S.wheelDist/w.r);
  const acc = (keys.rev&&S.state==='race')?1:0; rig.cab.rotation.x = lerp(rig.cab.rotation.x, -S.dl*.04*Math.abs(S.v)/15, .1); rig.cab.position.y = Math.sin(performance.now()/60)*.012*(1+acc);
  mats.rev.emissiveIntensity = (S.v<-.2? (T&&T.night?4:2.2) : .3);
  // ghost
  if(ghostRig.tractor.visible && S.best && (S.state==='race'||S.state==='finished'||S.state==='jack')){
    const g=S.best.ghost; const n=g.length/4; const f=S.time/.05; const i=Math.min(n-2,Math.floor(f)); const k=clamp(f-i,0,1);
    if(i>=0){ const a=i*4,b=(i+1)*4; const gx=lerp(g[a],g[b],k), gz=lerp(g[a+1],g[b+1],k), gt=lerp(g[a+2],g[b+2],k), gp=lerp(g[a+3],g[b+3],k);
      ghostRig.tractor.position.set(gx,.02,gz); ghostRig.tractor.rotation.y=-gt; ghostRig.trailer.position.set(gx,.02,gz); ghostRig.trailer.rotation.y=-gp; }
  } else if(S.state==='countdown' && ghostRig.tractor.visible){ ghostRig.tractor.position.set(S.x,.02,S.z); ghostRig.tractor.rotation.y=-S.th; ghostRig.trailer.position.set(S.x,.02,S.z); ghostRig.trailer.rotation.y=-S.ph; }
  // camera
  if(S.state!=='menu'){
    camTarget(); const r = S.cam===2 ? 1-Math.exp(-dt*14) : 1-Math.exp(-dt*3.6);
    if(S.state==='finished'||S.state==='results'){ // orbit
      const a=S.finishT*.35; const [cp,sp]=fwd(S.ph); tmpL.set(S.x-cp*5,2,S.z-sp*5); tmpV.set(tmpL.x+Math.cos(a+S.ph)*22, 9, tmpL.z+Math.sin(a+S.ph)*22); }
    camPos.lerp(tmpV,r); camLook.lerp(tmpL, S.cam===2?r:1-Math.exp(-dt*5));
    camera.position.copy(camPos);
    if(S.shake>0){ camera.position.x+=(Math.random()-.5)*S.shake*.8; camera.position.y+=(Math.random()-.5)*S.shake*.8; camera.position.z+=(Math.random()-.5)*S.shake*.8; }
    camera.lookAt(camLook);
    const fov = 60 + Math.abs(S.v)*.45 + (S.nitroOn?10:0); camera.fov=lerp(camera.fov,fov,.08); camera.updateProjectionMatrix();
  }
  // sun follows
  if(T){ sun.position.set(S.x+T.sunDir.x*120, T.sunDir.y*120, S.z+T.sunDir.z*120); sun.target.position.set(S.x-Math.cos(S.ph)*5,0,S.z-Math.sin(S.ph)*5); }
}

let menuA=0;
function menuCam(dt){ if(!T) return; menuA+=dt*.12; const cx=S.x-Math.cos(S.ph)*4, cz=S.z-Math.sin(S.ph)*4; camera.position.set(cx+Math.cos(menuA)*24, 8+Math.sin(menuA*.7)*2, cz+Math.sin(menuA)*24); camera.lookAt(cx,2,cz); camera.fov=55; camera.updateProjectionMatrix(); }

// ================= HUD =================
const mm=$('minimap'), mg=mm.getContext('2d'); let mmB=null;
function prepMinimap(){ let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; T.pts.forEach(p=>{ x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);z0=Math.min(z0,p.z);z1=Math.max(z1,p.z); }); const pad=20; const sc=(360-2*pad)/Math.max(x1-x0,z1-z0); mmB={x0,z0,sc,ox:pad+((360-2*pad)-(x1-x0)*sc)/2,oz:pad+((360-2*pad)-(z1-z0)*sc)/2}; }
const mmX=x=>mmB.ox+(x-mmB.x0)*mmB.sc, mmZ=z=>mmB.oz+(z-mmB.z0)*mmB.sc;
function drawMinimap(){
  if(!mmB) return; mg.clearRect(0,0,360,360); mg.lineCap='round'; mg.lineJoin='round';
  mg.beginPath(); T.pts.forEach((p,i)=>i?mg.lineTo(mmX(p.x),mmZ(p.z)):mg.moveTo(mmX(p.x),mmZ(p.z))); mg.strokeStyle='#fff3'; mg.lineWidth=Math.max(8,T.pts[0].hw*2*mmB.sc); mg.stroke(); mg.strokeStyle='#ffffff99'; mg.lineWidth=3; mg.stroke();
  mg.beginPath(); for(let i=0;i<=Math.min(S.rearIdx,T.N-1);i++){ const p=T.pts[i]; i?mg.lineTo(mmX(p.x),mmZ(p.z)):mg.moveTo(mmX(p.x),mmZ(p.z)); } mg.strokeStyle='#ffb300'; mg.lineWidth=4; mg.stroke();
  T.cps.forEach((ci,k)=>{ const p=T.pts[ci]; mg.fillStyle= k<S.nextCp?'#00e676':(k===T.cps.length-1?'#00e5ff':'#ff6d00'); mg.beginPath(); mg.arc(mmX(p.x),mmZ(p.z),6,0,7); mg.fill(); });
  cones.forEach(c=>{ if(!c.hit){ mg.fillStyle='#ff6d00'; mg.fillRect(mmX(c.x)-2,mmZ(c.z)-2,4,4); } });
  if(ghostRig.tractor.visible){ mg.fillStyle='#66e8ffaa'; mg.beginPath(); mg.arc(mmX(ghostRig.tractor.position.x),mmZ(ghostRig.tractor.position.z),6,0,7); mg.fill(); }
  // rig
  const [c,s]=fwd(S.th), [cp,sp]=fwd(S.ph); mg.lineWidth=7; mg.strokeStyle='#fff'; mg.beginPath(); mg.moveTo(mmX(S.x),mmZ(S.z)); mg.lineTo(mmX(S.x-cp*TR_BACK),mmZ(S.z-sp*TR_BACK)); mg.stroke();
  mg.strokeStyle=PAINTS[S.paint]==='#f5f5f5'?'#ffb300':PAINTS[S.paint]; mg.lineWidth=8; mg.beginPath(); mg.moveTo(mmX(S.x),mmZ(S.z)); mg.lineTo(mmX(S.x+c*TC_FRONT),mmZ(S.z+s*TC_FRONT)); mg.stroke();
}
let hudT=0;
function updHUD(dt){
  if(S.state==='menu'||S.state==='results') return;
  hudT+=dt; const total=S.time+S.pen-S.bonus;
  $('timer').textContent=fmt(total);
  $('pen').textContent = (S.pen||S.bonus) ? `${S.pen?'+'+S.pen.toFixed(1)+'s penalty':''}${S.pen&&S.bonus?' · ':''}${S.bonus?'−'+S.bonus.toFixed(1)+'s bonus':''}` : '';
  const kmh=Math.round(Math.abs(S.v)*3.6); $('speedo').innerHTML=kmh+'<small>KM/H</small>';
  $('gear').classList.toggle('blink', S.v<-.3);
  $('nitroFill').style.width=(S.nitro*100)+'%';
  const gam=S.th-S.ph; $('needle').setAttribute('transform',`rotate(${clamp(-gam/JACK*90,-95,95)} 110 110)`);
  const danger=clamp((Math.abs(gam)/JACK-.6)/.4,0,1); $('vignette').style.opacity = S.state==='jack'?.9: danger*.8;
  $('speedlines').style.opacity = S.nitroOn?1:0;
  const done=clamp((S.rearIdx-T.startIdx)/(T.finishIdx-T.startIdx),0,1); $('progFill').style.width=(done*100)+'%';
  $('cpTxt').textContent = `CHECKPOINT ${Math.min(S.nextCp,T.cps.length-1)}/${T.cps.length-1} · ${S.mode.toUpperCase()}`;
  $('camName').textContent=CAMS[S.cam];
  drawMinimap();
}

// ================= INPUT =================
const isTouch = matchMedia('(pointer:coarse)').matches;
const KEYMAP = { ArrowDown:'rev', KeyS:'rev', ArrowUp:'brake', KeyW:'brake', Space:'brake', ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right', ShiftLeft:'nitro', ShiftRight:'nitro', KeyN:'nitro' };
addEventListener('keydown', e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  const k=KEYMAP[e.code]; if(k){ if(k==='brake' && !keys.brake) keys.brakeTap=true; keys[k]=true; }
  if(e.repeat) return;
  if(S.state==='menu'){ if(e.code==='Enter') startLevel(S.level);
    if(e.code==='ArrowRight'||e.code==='KeyD'){ S.level=(S.level+1)%LEVELS.length; renderMenu(); previewLevel(); } if(e.code==='ArrowLeft'||e.code==='KeyA'){ S.level=(S.level+LEVELS.length-1)%LEVELS.length; renderMenu(); previewLevel(); } return; }
  if(S.state==='results'){ if(e.code==='KeyR') startLevel(S.level); if(e.code==='Enter'||e.code==='KeyN'){ startLevel(S.level<LEVELS.length-1?S.level+1:S.level); } if(e.code==='Escape') toMenu(); return; }
  if(e.code==='KeyH'){ SFX.horn(); hornScare(); }
  if(e.code==='KeyC'){ S.cam=(S.cam+1)%3; popup(CAMS[S.cam],'blue'); }
  if(e.code==='KeyG'){ S.guide=!S.guide; popup('GUIDE '+(S.guide?'ON':'OFF'),'blue'); }
  if(e.code==='KeyM'){ const m=SFX.toggleMute(); popup(m?'MUTED':'SOUND ON','blue'); }
  if(e.code==='KeyR'){ startLevel(S.level); }
  if(e.code==='KeyT' && S.state==='race'){ resetToCheckpoint(true); }
  if(e.code==='Escape'||e.code==='KeyP'){ togglePause(); }
});
addEventListener('keyup', e=>{ const k=KEYMAP[e.code]; if(k) keys[k]=false; });
addEventListener('blur', ()=>{ for(const k in keys) keys[k]=false; });
function hornScare(){ // horn makes fans go wild and nearby cones wobble
  fans.forEach(f=>{ const p=T.pts[f.i]; if(Math.hypot(p.x-S.x,p.z-S.z)<45) f.jump=2.2; });
  popup('HOOONK! 📯','info');
}
function bindTouch(id,k){ const el=$(id); const on=e=>{ e.preventDefault(); SFX.init(); if(k==='brake' && !keys.brake) keys.brakeTap=true; keys[k]=true; el.classList.add('on'); }; const off=e=>{ e.preventDefault(); keys[k]=false; el.classList.remove('on'); };
  el.addEventListener('pointerdown',on); el.addEventListener('pointerup',off); el.addEventListener('pointercancel',off); el.addEventListener('pointerleave',off); }
bindTouch('tL','left'); bindTouch('tR','right'); bindTouch('tB','brake'); bindTouch('tG','rev'); bindTouch('tN','nitro');

function togglePause(){
  if(S.state==='paused'){ S.state=S.prevState; $('pauseS').classList.add('hide'); }
  else if(['race','countdown','jack'].includes(S.state)){ S.prevState=S.state; S.state='paused'; SFX.silence(); $('pauseS').classList.remove('hide'); }
}
function toMenu(){ clearTimeout(resultsTimer); resultsTimer=null; S.state='menu'; SFX.silence(); $('results').classList.add('hide'); $('pauseS').classList.add('hide'); $('hud').style.display='none'; $('minimap').style.display='none'; $('touch').style.display='none'; renderMenu(); previewLevel(); }
$('pResume').onclick=togglePause; $('pRetry').onclick=()=>startLevel(S.level); $('pMenu').onclick=toMenu;
$('rRetry').onclick=()=>startLevel(S.level); $('rMenu').onclick=toMenu; $('rNext').onclick=()=>startLevel(Math.min(LEVELS.length-1,S.level+1));
$('goBtn').onclick=()=>startLevel(S.level);

// ================= MENU =================
const modeDesc = { rookie:'ROOKIE: Hitch-assist on. Steer where you want the trailer to go — the computer handles the counter-steer. Jackknife-proof.', pro:'PRO: Raw steering, just like a real rig. The trailer wants to fold. Counter-steer or JACKKNIFE (+3s). Separate leaderboard.' };
function renderMenu(){
  $('levels').innerHTML = LEVELS.map((lv,i)=>{ const rec=store.get(`rec_${i}_${S.mode}`,null); const med=rec?medalFor(i,S.mode,rec.t):null; const g=targetsFor(i,S.mode);
    return `<div class="lv ${i===S.level?'sel':''}" data-i="${i}"><div class="tod">${lv.icon}</div><div class="n">LEVEL ${i+1}</div><div class="t">${lv.name}</div><div class="s">${lv.sub}</div>
    <div class="m"><span>${rec?'BEST '+fmt(rec.t):'🥇 '+fmt(g.gold)}</span><span class="medal">${med?med.icon:'·'}</span></div></div>`; }).join('');
  document.querySelectorAll('.lv').forEach(el=>{ el.onclick=()=>{ S.level=+el.dataset.i; renderMenu(); previewLevel(); }; el.ondblclick=()=>startLevel(+el.dataset.i); });
  document.querySelectorAll('#modeSeg button').forEach(b=>{ b.classList.toggle('on', b.dataset.m===S.mode); b.onclick=()=>{ S.mode=b.dataset.m; store.set('mode',S.mode); renderMenu(); }; });
  $('modeDesc').textContent = modeDesc[S.mode];
  $('paints').innerHTML = PAINTS.map((p,i)=>`<div class="sw ${i===S.paint?'on':''}" data-i="${i}" style="background:${p}"></div>`).join('');
  document.querySelectorAll('.sw').forEach(el=>el.onclick=()=>{ S.paint=+el.dataset.i; store.set('paint',S.paint); mats.paint.color.set(PAINTS[S.paint]); renderMenu(); });
}
let previewed=-1;
function previewLevel(){ if(previewed===S.level) return; previewed=S.level; buildLevel(S.level); placeRig(T.startIdx); S.v=0; S.time=0; S.state='menu'; ghostRig.tractor.visible=ghostRig.trailer.visible=false; updateVisuals(0); }

renderMenu(); previewLevel();

// ================= MAIN LOOP =================
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000); last=now;
  update(dt);
  if(S.state!=='menu' || true) updateVisuals(dt);
  if(S.state==='menu') menuCam(0);
  updHUD(dt);
  renderer.render(scene,camera);
}
requestAnimationFrame(frame);
