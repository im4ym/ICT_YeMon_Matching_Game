/* Count and Match: shared matching engine used by every theme page.
   Each page sets window.MATCH_CONFIG before loading this file. */
(function(){
  /* theme settings come from the page, so every theme shares one copy of the game logic */
  const CFG=window.MATCH_CONFIG;
  const GROUPS=CFG.groups;
  const NUMS=CFG.nums;
  const PROMPT=CFG.prompt;
  const NOUN=CFG.noun;
  const LINE=CFG.line;
  const CONFCOLS=CFG.confcols;

  const $=id=>document.getElementById(id);
  const stage=$('stage'), numCol=$('numCol'), bCol=$('basketCol'), svg=$('lines');
  const fb=$('feedback'), fbBig=$('fbBig'), fbSmall=$('fbSmall'), starTxt=$('starTxt');
  const dotsWrap=$('dots'), guideBubble=$('guideBubble');
  const startOv=$('startOv'), pauseOv=$('pauseOv'), doneOv=$('doneOv');
  const cvs=$('confetti'), ctx=cvs.getContext('2d');
  let selected=null, solved={}, stars=0, dragLine=null, paused=false, muted=false;

  /* ---------- audio: everything routes through a master gain ---------- */
  let AC=null, MASTER=null;
  function ac(){
    if(!AC){
      try{
        AC=new (window.AudioContext||window.webkitAudioContext)();
        MASTER=AC.createGain(); MASTER.gain.value=1; MASTER.connect(AC.destination);
      }catch(e){ AC=null; }
    }
    if(AC && AC.state==='suspended'){ AC.resume(); }
    return AC;
  }
  function tone(freq,dur,type,vol,when){
    if(muted) return; const a=ac(); if(!a||!MASTER) return;
    const t0=a.currentTime+(when||0);
    const o=a.createOscillator(), g=a.createGain();
    o.type=type||'sine'; o.frequency.value=freq;
    o.connect(g); g.connect(MASTER);
    g.gain.setValueAtTime(0,t0);
    g.gain.linearRampToValueAtTime(vol||0.2,t0+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.start(t0); o.stop(t0+dur+0.03);
  }
  const sCorrect=()=>{ tone(660,0.14,'triangle',0.26,0); tone(880,0.22,'triangle',0.26,0.12); };
  const sWrong  =()=>{ tone(210,0.26,'sawtooth',0.15,0); };
  const sClick  =()=>{ tone(430,0.06,'square',0.11,0); };
  const sPick   =()=>{ tone(550,0.07,'sine',0.13,0); };
  const sWin    =()=>{ [523,659,784,1047].forEach((f,i)=>tone(f,0.3,'triangle',0.22,i*0.12)); };

  /* background music */
  let musicTimer=null, mi=0;
  const NOTES=[392,523,659,523,440,587,494,392];
  function musicStart(){
    if(muted||musicTimer) return;
    musicTimer=setInterval(()=>{
      if(paused||muted) return;
      tone(NOTES[mi%NOTES.length],0.4,'sine',0.05,0);
      tone(NOTES[mi%NOTES.length]/2,0.4,'triangle',0.035,0);
      mi++;
    },430);
  }
  function musicStop(){ if(musicTimer){ clearInterval(musicTimer); musicTimer=null; } }

  /* mute: silences the master gain instantly, so already-scheduled notes stop too */
  function setMuted(m){
    muted=m;
    $('muteBtn').innerHTML = m ? '&#128263;' : '&#128266;';
    if(AC && MASTER){
      MASTER.gain.cancelScheduledValues(AC.currentTime);
      MASTER.gain.setValueAtTime(m?0:1, AC.currentTime);
    }
    if(m) musicStop(); else if(!startOv.classList.contains('show')) musicStart();
  }

  /* ---------- scale to fit ---------- */
  function fit(){
    const s=Math.min((window.innerWidth-20)/1194,(window.innerHeight-20)/600,1);
    stage.style.transform='scale('+s+')';
  }
  window.addEventListener('resize',fit); fit();

  /* ---------- build ---------- */
  function fruitHTML(g){ let h='<div class="fruits">';
    for(let i=0;i<g.count;i++) h+='<span class="f '+g.kind+'"></span>'; return h+'</div>'; }
  function build(){
    numCol.innerHTML=''; bCol.innerHTML=''; dotsWrap.innerHTML='';
    NUMS.forEach(n=>{
      const d=document.createElement('div');
      d.className='num'; d.textContent=n; d.dataset.n=n;
      d.addEventListener('pointerdown',e=>pickNum(e,d));
      numCol.appendChild(d);
    });
    GROUPS.forEach((g,i)=>{
      const d=document.createElement('div');
      d.className='basket'; d.dataset.i=i; d.innerHTML=fruitHTML(g);
      d.addEventListener('pointerdown',e=>{ e.preventDefault(); dropBasket(d); });
      bCol.appendChild(d);
    });
    for(let i=0;i<4;i++){ const dot=document.createElement('div'); dot.className='dot'; dotsWrap.appendChild(dot); }
  }
  function center(el,right){
    const r=el.getBoundingClientRect(), s=stage.getBoundingClientRect(), sc=s.width/1194;
    return {x:((right?r.right:r.left)-s.left)/sc, y:(r.top+r.height/2-s.top)/sc};
  }
  function drawLine(a,b,color){
    const l=document.createElementNS('http://www.w3.org/2000/svg','line');
    l.setAttribute('x1',a.x); l.setAttribute('y1',a.y);
    l.setAttribute('x2',b.x); l.setAttribute('y2',b.y);
    l.setAttribute('stroke',color); l.setAttribute('stroke-width','7');
    l.setAttribute('stroke-linecap','round'); svg.appendChild(l); return l;
  }
  function redraw(){
    svg.innerHTML='';
    Object.keys(solved).forEach(n=>{
      const ne=numCol.querySelector('[data-n="'+n+'"]');
      const be=bCol.querySelector('[data-i="'+solved[n]+'"]');
      if(ne&&be) drawLine(center(ne,true),center(be,false),LINE);
    });
  }
  function updDots(){
    const done=Object.keys(solved).length;
    dotsWrap.querySelectorAll('.dot').forEach((d,i)=>d.classList.toggle('on',i<done));
  }
  function guide(msg){ guideBubble.textContent=msg; }

  function pickNum(e,d){
    if(paused) return; e.preventDefault();
    if(d.classList.contains('done')) return;
    if(selected) selected.classList.remove('sel');
    selected=d; d.classList.add('sel'); hideFb(); sPick();
    guide('Now pick a group.');
    const start=center(d,true);
    if(dragLine){ dragLine.remove(); dragLine=null; }
    dragLine=drawLine(start,start,'#F5B33C');
    dragLine.setAttribute('stroke-dasharray','12 9');
    const move=ev=>{
      if(!dragLine) return;
      const s=stage.getBoundingClientRect(), sc=s.width/1194;
      dragLine.setAttribute('x2',(ev.clientX-s.left)/sc);
      dragLine.setAttribute('y2',(ev.clientY-s.top)/sc);
    };
    const up=()=>{
      window.removeEventListener('pointermove',move);
      window.removeEventListener('pointerup',up);
      if(dragLine){ dragLine.remove(); dragLine=null; }
    };
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);
  }

  function dropBasket(b){
    if(paused) return;
    if(b.classList.contains('done')) return;
    if(!selected){
      showFb('tip','Pick a number first','Tap a number, then tap a group.');
      guide('Tap a number first.');
      return;
    }
    const n=+selected.dataset.n, i=+b.dataset.i, g=GROUPS[i];
    if(g.count===n){
      solved[n]=i;
      selected.classList.remove('sel'); selected.classList.add('done');
      b.classList.add('done'); selected=null;
      stars++; starTxt.innerHTML='&#9733; '+stars;
      redraw(); updDots(); sCorrect();
      const left=4-Object.keys(solved).length;
      if(left===0){ showFb('good','&#11088; Well done!','You matched them all.'); guide('Hooray!'); setTimeout(finish,900); }
      else { showFb('good','&#127881; Yes!','That is '+n+' '+g.name+'. '+left+' to go.'); guide('Great! Keep going.'); }
    } else {
      b.classList.add('shake'); setTimeout(()=>b.classList.remove('shake'),420); sWrong();
      showFb('bad','Not yet!','Count again. That group has '+g.count+'.');
      guide('Try counting again.');
      if(selected){ selected.classList.remove('sel'); selected=null; }
    }
  }

  let fbT=null;
  function showFb(kind,big,small){
    fb.className='feedback show '+kind; fbBig.innerHTML=big; fbSmall.textContent=small;
    clearTimeout(fbT); fbT=setTimeout(hideFb,2400);
  }
  function hideFb(){ fb.className='feedback'; }

  $('hintBtn').addEventListener('click',()=>{
    if(paused) return; sClick();
    const rem=NUMS.filter(n=>!(n in solved)); if(!rem.length) return;
    const n=rem[0];
    const ne=numCol.querySelector('[data-n="'+n+'"]');
    const idx=GROUPS.findIndex(g=>g.count===n);
    const be=bCol.querySelector('[data-i="'+idx+'"]');
    if(ne) ne.classList.add('hintpulse');
    if(be) be.classList.add('hintpulse');
    setTimeout(()=>{ if(ne)ne.classList.remove('hintpulse'); if(be)be.classList.remove('hintpulse'); },2200);
    showFb('tip','&#128161; Try this one','Count the '+NOUN+'. Which group has '+n+'?');
    guide('Count them slowly.');
  });
  $('speakerBtn').addEventListener('click',e=>{
    e.stopPropagation(); sClick(); guide(PROMPT);
    showFb('tip','&#128266; '+PROMPT,'Draw a line to the matching group.');
  });

  /* ---------- confetti ---------- */
  let parts=[],anim=null;
  function confetti(){
    cvs.width=1194; cvs.height=600; parts=[];
    for(let i=0;i<120;i++) parts.push({x:Math.random()*1194,y:-20-Math.random()*380,
      w:8+Math.random()*8,h:10+Math.random()*10,c:CONFCOLS[(Math.random()*CONFCOLS.length)|0],
      v:2.4+Math.random()*3.2,r:Math.random()*Math.PI,vr:(Math.random()-.5)*.25});
    cancelAnimationFrame(anim); step();
  }
  function step(){
    ctx.clearRect(0,0,1194,600); let live=false;
    parts.forEach(p=>{
      if(!paused){ p.y+=p.v; p.r+=p.vr; }
      if(p.y<620) live=true;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r);
      ctx.fillStyle=p.c; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore();
    });
    if(live) anim=requestAnimationFrame(step); else ctx.clearRect(0,0,1194,600);
  }

  /* ---------- pause ---------- */
  function setPause(p){
    paused=p; pauseOv.classList.toggle('show',p);
    if(p) musicStop(); else if(!muted) musicStart();
  }
  $('pauseBtn').addEventListener('click',()=>{ sClick(); setPause(true); });
  $('resumeBtn').addEventListener('click',()=>{ sClick(); setPause(false); });
  $('muteBtn').addEventListener('click',()=>{ setMuted(!muted); if(!muted) sClick(); });

  /* ---------- flow ---------- */
  function finish(){ musicStop(); doneOv.classList.add('show'); sWin(); confetti(); }
  function reset(){
    solved={}; stars=0; selected=null; starTxt.innerHTML='&#9733; 0';
    svg.innerHTML=''; hideFb(); guide("Let's count!");
    cancelAnimationFrame(anim); ctx.clearRect(0,0,1194,600); build();
  }
  $('playBtn').onclick =()=>{ ac(); sClick(); startOv.classList.remove('show'); setPause(false); reset(); if(!muted) musicStart(); };
  $('againBtn').onclick=()=>{ sClick(); doneOv.classList.remove('show'); reset(); if(!muted) musicStart(); };
  $('backBtn').onclick =()=>{ sClick(); doneOv.classList.remove('show'); musicStop(); reset(); startOv.classList.add('show'); };
  $('pResetBtn').onclick=()=>{ sClick(); setPause(false); reset(); };
  $('pHomeBtn').onclick =()=>{ sClick(); setPause(false); musicStop(); reset(); startOv.classList.add('show'); };
  $('resetBtn').onclick =()=>{ if(paused) return; sClick(); reset(); };

  build();
  window.addEventListener('resize',()=>setTimeout(redraw,60));
})();
