(() => {
  'use strict';
  const {TAU, mod, indexAtPointer, targetRotation, stoppingRotation, easeInOut} = WheelCore;
  let browserStorage;
  try { browserStorage = window.localStorage; } catch {}
  const questionStore = QuestionStore.createStore(PARTY_QUESTIONS, browserStorage);
  window.partyQuestionStore = questionStore;
  const canvas = document.querySelector('#wheel');
  const ctx = canvas.getContext('2d');
  const spinButton = document.querySelector('#spin-button');
  const tabs = [...document.querySelectorAll('.category')];
  const levels = [...document.querySelectorAll('.level')];
  const question = document.querySelector('#question-text');
  const number = document.querySelector('#question-number');
  const typeBadge = document.querySelector('#question-type');
  const hint = document.querySelector('#result-hint');
  const card = document.querySelector('#result-card');
  const categoryNames = {mixed:'混合版', truth:'真心话', dare:'大冒险'};
  const levelNames = {spicy:'刺激版', mild:'温和版', beginner:'纯菜版'};
  const typeNames = {truth:'真心话', dare:'大冒险'};
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const SIZE = 1200, CENTER = 600;
  let category = 'mixed', level = 'mild', rotation = 0, spinning = false, selected = -1;
  let round = 1, completed = 0, textAnimation, motion = null;
  let plate = document.createElement('canvas');
  plate.width = SIZE; plate.height = SIZE;
  const plateCtx = plate.getContext('2d');
  const items = () => questionStore.getBank()[category][level];

  function sectorPath(context, index) {
    const step = TAU/items().length;
    const start = -Math.PI/2 + (index-.5)*step;
    context.beginPath();
    context.arc(0,0,553,start,start+step);
    context.arc(0,0,160,start+step,start,true);
    context.closePath();
  }

  function renderPlate() {
    const c = plateCtx;
    c.clearRect(0,0,SIZE,SIZE); c.save(); c.translate(CENTER,CENTER);
    const colors = ['#29281b','#41402a','#22261b','#353422','#24291e'];
    const step = TAU/items().length;
    items().forEach((item,i) => {
      sectorPath(c,i); c.fillStyle=colors[i%colors.length]; c.fill();
      c.strokeStyle='#b69a5759';c.lineWidth=.8;c.stroke();
      c.save();c.rotate(-Math.PI/2+i*step);
      c.fillStyle=i%5===1?'#ecd8a2':'#c4b784';
      c.textBaseline='middle'; c.textAlign='right';
      c.font=`500 ${Math.min(17, TAU*360/items().length*.72)}px "Microsoft YaHei", sans-serif`;
      const characters=[...item.text.replace(/\s+/g,' ')];
      let preview=characters.join('');
      while(c.measureText(preview).width>210&&characters.length>1){characters.pop();preview=characters.join('')+'…';}
      c.fillText(preview,505,0);
      c.fillStyle='#ab9960';c.font='11px Georgia, serif';c.fillText(String(i+1).padStart(3,'0'),540,0);
      c.restore();
    });
    c.restore();
  }

  function draw() {
    ctx.clearRect(0,0,SIZE,SIZE);ctx.save();ctx.translate(CENTER,CENTER);
    const rim=ctx.createRadialGradient(0,0,543,0,0,591);
    rim.addColorStop(0,'#151810');rim.addColorStop(.24,'#6b603a');rim.addColorStop(.34,'#d5b879');rim.addColorStop(.45,'#443d29');rim.addColorStop(.72,'#202219');rim.addColorStop(.86,'#947d48');rim.addColorStop(.93,'#d1b47a');rim.addColorStop(1,'#62522f');
    ctx.beginPath();ctx.arc(0,0,591,0,TAU);ctx.fillStyle=rim;ctx.fill();
    ctx.save();ctx.rotate(rotation);ctx.drawImage(plate,-CENTER,-CENTER);
    if(selected>=0){sectorPath(ctx,selected);ctx.fillStyle=spinning?'#f2d38924':'#efd18c55';ctx.fill();ctx.strokeStyle='#f5da9e';ctx.lineWidth=1.8;ctx.stroke();}
    ctx.restore();
    for(let i=0;i<items().length;i++){
      const angle=i*TAU/items().length-Math.PI/2;
      ctx.save();ctx.rotate(angle);ctx.beginPath();ctx.moveTo(562,0);ctx.lineTo(i%5===0?573:568,0);ctx.strokeStyle=i%5===0?'#dbc18a':'#a08d5666';ctx.lineWidth=i%5===0?2:1;ctx.stroke();ctx.restore();
    }
    for(let i=0;i<20;i++){
      const angle=i*TAU/20;ctx.beginPath();ctx.arc(Math.cos(angle)*580,Math.sin(angle)*580,2,0,TAU);ctx.fillStyle='#e9d3a0';ctx.fill();
    }
    const inner=ctx.createRadialGradient(0,0,95,0,0,170);inner.addColorStop(0,'#24271b');inner.addColorStop(1,'#171b13');
    ctx.beginPath();ctx.arc(0,0,166,0,TAU);ctx.fillStyle=inner;ctx.fill();ctx.strokeStyle='#9f8e5266';ctx.lineWidth=2;ctx.stroke();ctx.restore();
  }

  function showQuestion(index, animate = true) {
    selected=index;
    const item=items()[index];
    number.textContent=String(index+1).padStart(3,'0');
    typeBadge.textContent=`${typeNames[item.type]} · ${levelNames[level]}`;
    question.textContent=item.text;
    if(textAnimation)textAnimation.cancel();
    if(animate&&!reducedMotion.matches){
      textAnimation=question.animate([{transform:'translateY(15px)',opacity:.65},{transform:'translateY(0)',opacity:1}],{duration:110,easing:'ease-out'});
    }
  }

  function setState(state) {
    spinning=state!=='idle';
    spinButton.dataset.state=state;
    spinButton.setAttribute('aria-disabled',String(state==='stopping'));
    [...tabs,...levels].forEach(button=>button.disabled=spinning);
    const label={idle:'转一下',spinning:'快速停止',stopping:'即将揭晓'}[state];
    document.querySelector('#spin-label').textContent=label;
    spinButton.setAttribute('aria-label',label);
    document.querySelector('#spin-subtitle').textContent={idle:"LET'S PLAY",spinning:'TAP TO STOP',stopping:'HERE WE GO'}[state];
    document.querySelector('#wheel-wrap').classList.toggle('spinning',spinning);
  }
  function randomIndex(count) {
    if(window.crypto?.getRandomValues){
      const array=new Uint32Array(1),limit=Math.floor(4294967296/count)*count;
      do{crypto.getRandomValues(array);}while(array[0]>=limit);
      return array[0]%count;
    }
    return Math.floor(Math.random()*count);
  }
  function sampleMotion(now) {
    const progress=Math.min(Math.max((now-motion.startTime)/motion.duration,0),1);
    const eased=motion.stopping?1-Math.pow(1-progress,3):easeInOut(progress);
    const derivative=motion.stopping?3*Math.pow(1-progress,2):12*Math.pow(progress<.5?progress:1-progress,2);
    const angle=motion.reduced?(progress>=1?motion.end:motion.start):motion.start+(motion.end-motion.start)*eased;
    return {angle,progress,speed:(motion.end-motion.start)*derivative/motion.duration};
  }
  function quickStop() {
    if(!motion||motion.stopping)return;
    const now=performance.now(),sample=sampleMotion(now);
    rotation=sample.angle;
    const duration=motion.reduced?100:Math.min(550,Math.max(80,motion.duration-(now-motion.startTime)));
    const end=motion.reduced?motion.end:stoppingRotation(rotation,sample.speed,items().length,duration);
    motion={start:rotation,end,duration,startTime:now,stopping:true,reduced:motion.reduced};
    setState('stopping');
  }
  function frame(now) {
    const sample=sampleMotion(now);
    rotation=sample.angle;
    const index=indexAtPointer(rotation,items().length);
    if(index!==selected)showQuestion(index);
    draw();
    if(sample.progress<1){requestAnimationFrame(frame);return;}
    rotation=mod(motion.end,TAU);motion=null;
    showQuestion(indexAtPointer(rotation,items().length),false);
    setState('idle');draw();completed++;
    card.classList.add('landed');hint.textContent='就是这道，轮到你了';
    document.querySelector('#announcement').textContent=`第${round}轮，${levelNames[level]}，${typeNames[items()[selected].type]}，第${selected+1}题：${items()[selected].text}`;
  }
  function spin() {
    if(document.querySelector('dialog[open]'))return;
    if(spinning){quickStop();return;}
    if(completed>0)round=completed+1;
    document.querySelector('#round-number').textContent=String(round).padStart(2,'0');
    document.querySelector('#round-caption').textContent='下一段故事，由你开启';
    const target=randomIndex(items().length),start=rotation;
    const end=targetRotation(start,target,items().length,6,(Math.random()-.5)*.4);
    motion={start,end,duration:reducedMotion.matches?900:3800,startTime:performance.now(),stopping:false,reduced:reducedMotion.matches};
    card.classList.remove('landed');hint.textContent='跟着指针，让故事慢慢揭晓';
    setState('spinning');
    requestAnimationFrame(frame);
  }
  spinButton.addEventListener('click',spin);
  function resetWheel() {
    rotation=0;selected=-1;
    [...tabs,...levels].forEach(button=>{
      const active=button.dataset.category?button.dataset.category===category:button.dataset.level===level;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    });
    if(textAnimation)textAnimation.cancel();
    number.textContent='000';typeBadge.textContent=`${categoryNames[category]} · ${levelNames[level]}`;hint.textContent=`${items().length} 道题，等你来揭晓`;
    document.querySelector('#wheel-count').textContent=items().length;
    question.textContent={spicy:'放开一点，今晚玩点大胆的。',mild:'刚刚好的心跳，刚刚好的热闹。',beginner:'从小小的快乐开始，轻松玩。'}[level];
    card.classList.remove('landed');
    canvas.setAttribute('aria-label',`包含${items().length}道题的${categoryNames[category]}·${levelNames[level]}转盘；点击中心按钮抽选，再点一次快速停止，上方会显示完整题目`);
    renderPlate();draw();
  }
  tabs.forEach(tab=>tab.addEventListener('click',()=>{
    if(spinning||tab.dataset.category===category)return;
    category=tab.dataset.category;resetWheel();
  }));
  levels.forEach(button=>button.addEventListener('click',()=>{
    if(spinning||button.dataset.level===level)return;
    level=button.dataset.level;resetWheel();
  }));
  document.addEventListener('keydown',event=>{
    if(document.querySelector('dialog[open]'))return;
    if(event.code==='Space'&&!event.repeat&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.target.closest('button,a,input,textarea,select,[contenteditable]')){event.preventDefault();spin();}
  });
  document.addEventListener('questions-saved',()=>{if(!spinning)resetWheel();});
  resetWheel();
})();
