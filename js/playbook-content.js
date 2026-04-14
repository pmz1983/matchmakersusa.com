/* Playbook Content — navigation, access gate, Dating Coach AI */

// ── Progress bar ──
window.addEventListener('scroll',()=>{
  const h=document.documentElement;
  const f=document.getElementById('pbProgress');
  if(f) f.style.width=(window.scrollY/(h.scrollHeight-h.clientHeight)*100)+'%';
},{passive:true});

// ── Active nav ──
const navLinks = document.querySelectorAll('.pb-nav a[href^="#"]');
const chapterEls = document.querySelectorAll('[id^="ch"]');
if(window.IntersectionObserver && chapterEls.length){
  new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        navLinks.forEach(a=>a.classList.remove('active'));
        const l=document.querySelector(`.pb-nav a[href="#${e.target.id}"]`);
        if(l) l.classList.add('active');
      }
    });
  },{rootMargin:'-10% 0px -80% 0px'}).observe(document.getElementById('ch1'));
  chapterEls.forEach(c=>new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        navLinks.forEach(a=>a.classList.remove('active'));
        const l=document.querySelector(`.pb-nav a[href="#${e.target.id}"]`);
        if(l) l.classList.add('active');
      }
    });
  },{rootMargin:'-15% 0px -75% 0px'}).observe(c));
}

// ── Smooth scroll ──
function scrollTo(id){
  const el=document.getElementById(id);
  if(el) window.scrollTo({top:el.offsetTop-80,behavior:'smooth'});
  return false;
}
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click',e=>{
    e.preventDefault();
    const id=a.getAttribute('href').slice(1);
    scrollTo(id);
  });
});

// ── Copy button ──
function doCopy(btn){
  const q=btn.closest('.sc-body').querySelector('.sc-quote');
  if(q) navigator.clipboard.writeText(q.textContent.replace(/"/g,'').replace(/"/g,'').trim())
    .then(()=>{btn.textContent='COPIED';btn.classList.add('copied');setTimeout(()=>{btn.textContent='COPY';btn.classList.remove('copied');},2000);});
}

// ── Gate ──
const VALID_CODES=['MATCH777','MM-PLAYBOOK-2024','MATCHMAKERS','MM2024','MM-BETA-001','MM-BETA-002','MM-BETA-003','MM-BETA-004','MM-BETA-005','MM-FRIEND-001','MM-FRIEND-002','MM-FRIEND-003','MM-FRIEND-004','MM-FRIEND-005','MM-VIP-TEST'];
function checkAccess(){
  const code=document.getElementById('accessCode').value.trim().toUpperCase();
  const err=document.getElementById('gateError');
  if(!code){err.textContent='Please enter your access code.';return;}
  if(VALID_CODES.includes(code)){
    document.getElementById('pb-gate').style.display='none';
    document.body.style.overflow='';
    localStorage.setItem('pb_access','1');
  } else {
    err.textContent='Code not recognized. Please check your code and try again.';
    document.getElementById('accessCode').style.borderColor='rgba(229,115,115,.5)';
  }
}
document.getElementById('accessCode')?.addEventListener('keydown',e=>{if(e.key==='Enter')checkAccess();});
if(localStorage.getItem('pb_access')==='1') document.getElementById('pb-gate').style.display='none';

// ── Scroll reveal ──
if(window.IntersectionObserver){
  new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');new IntersectionObserver(()=>{}).observe(e.target);}});
  },{threshold:0.08}).observe(document.body);
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');}});
  },{threshold:0.06,rootMargin:'0px 0px -20px 0px'});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
}

// ── Embedded Dating Coach — Playbook Integration ──────────────────────
(function(){
const DC_CODE = 'MMCOACH2026';
// System prompt is now server-side only (in coach-proxy Edge Function)

let pb_history=[], pb_typing=false, pb_intent='', pb_phase='', pb_focus='';

// Gate
window.pbDcCheckAccess = function(){
  const code = document.getElementById('pb-dc-code').value.trim().toUpperCase();
  const err  = document.getElementById('pb-dc-err');
  if(!code){ err.textContent='Enter your access code.'; return; }
  // Accept MMCOACH codes or any valid free promo code from checkout system
  var isValidCoach = code===DC_CODE||code.startsWith('MMCOACH');
  var promoCheck = (typeof lookupPromo==='function') ? lookupPromo(code) : null;
  var isValidPromo = promoCheck && promoCheck.type==='free';
  if(isValidCoach||isValidPromo){
    document.getElementById('pb-dc-gate').style.display='none';
    if(!localStorage.getItem('pb_dc_first'))
      localStorage.setItem('pb_dc_first',Date.now().toString());
    localStorage.setItem('pb_dc_access','1');
    pbDcInit();
  } else {
    err.textContent='Code not recognized. Please check your code and try again.';
  }
};
document.getElementById('pb-dc-code')?.addEventListener('keydown',e=>{if(e.key==='Enter')pbDcCheckAccess();});

function pbDcInit(){
  const first = parseInt(localStorage.getItem('pb_dc_first')||Date.now());
  const days  = Math.max(0,30-Math.floor((Date.now()-first)/(864e5)));
  const badge = document.getElementById('pb-dc-days');
  if(badge) badge.textContent = days>0 ? `⏱ ${days}d remaining` : 'Access expired';
  if(localStorage.getItem('pb_dc_onboarded')){
    pb_intent = localStorage.getItem('pb_dc_intent')||'';
    pb_phase  = localStorage.getItem('pb_dc_phase')||'';
    pb_focus  = localStorage.getItem('pb_dc_focus')||'';
    showChat(); pbWelcome();
  } else {
    document.getElementById('pb-dc-onboard').classList.add('show');
  }
}

// Onboarding
window.pbSelectIntent = function(el,v){
  document.querySelectorAll('.pb-intent-opt').forEach(o=>o.classList.remove('sel'));
  el.classList.add('sel'); pb_intent=v;
  document.getElementById('pb-ob-btn1').disabled=false;
};
window.pbSelectPhase = function(el,v){
  document.querySelectorAll('.pb-phase-opt').forEach(o=>o.classList.remove('sel'));
  el.classList.add('sel'); pb_phase=v;
  document.getElementById('pb-ob-btn2').disabled=false;
};
window.pbSelectFocus = function(el,v){
  document.querySelectorAll('.pb-focus-opt').forEach(o=>o.classList.remove('sel'));
  el.classList.add('sel'); pb_focus=v;
  document.getElementById('pb-ob-btn3').disabled=false;
};
window.pbObNext = function(step){
  document.querySelectorAll('.pb-ob-step').forEach(s=>s.classList.remove('active'));
  document.getElementById('pb-ob-step'+step).classList.add('active');
  for(let i=1;i<=3;i++){
    const p=document.getElementById('pb-pip'+i);
    if(p) p.className='pb-ob-pip'+(i<step?' done':i===step?' active':'');
  }
};
window.pbStartCoach = function(){
  localStorage.setItem('pb_dc_onboarded','1');
  localStorage.setItem('pb_dc_intent',pb_intent);
  localStorage.setItem('pb_dc_phase',pb_phase);
  localStorage.setItem('pb_dc_focus',pb_focus);
  document.getElementById('pb-dc-onboard').classList.remove('show');
  showChat(); setTimeout(pbWelcome,300);
};

function showChat(){
  document.getElementById('pb-dc-chat').classList.add('show');
}
function pbWelcome(){
  const g=`Your context is set — ${pb_intent} Intent, ${pb_phase}. What are you working on right now?`;
  pbAddMsg('coach',g); pb_history.push({role:'assistant',content:g});
}

// Chat
function pbAddMsg(role,text){
  const msgs=document.getElementById('pb-dc-messages');
  const d=document.createElement('div'); d.className='pb-msg '+role;
  const av=document.createElement('div'); av.className='pb-msg-av'; av.textContent=role==='coach'?'M':'You';
  const b=document.createElement('div'); b.className='pb-msg-bubble';
  b.innerHTML=text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
  d.appendChild(av); d.appendChild(b); msgs.appendChild(d);
  msgs.scrollTop=msgs.scrollHeight;
}
function pbShowTyping(){
  const msgs=document.getElementById('pb-dc-messages');
  const d=document.createElement('div'); d.className='pb-msg coach'; d.id='pb-typing-ind';
  d.innerHTML='<div class="pb-msg-av">M</div><div class="pb-typing"><span></span><span></span><span></span></div>';
  msgs.appendChild(d); msgs.scrollTop=msgs.scrollHeight;
}
function pbHideTyping(){ const t=document.getElementById('pb-typing-ind'); if(t)t.remove(); }

window.pbDcSend = async function(){
  if(pb_typing) return;
  const inp=document.getElementById('pb-dc-input');
  const txt=inp.value.trim(); if(!txt) return;
  inp.value=''; inp.style.height='auto';
  document.getElementById('pb-dc-send-btn').disabled=true;
  pb_typing=true;
  document.getElementById('pb-dc-status').textContent='Thinking...';
  pbAddMsg('user',txt); pb_history.push({role:'user',content:txt}); pbShowTyping();
  const memberCtx=(pb_intent||pb_phase ? '\n\n---\nMEMBER CONTEXT:\nIntent: '+(pb_intent||'Not specified')+'\nPhase: '+(pb_phase||'Not specified')+'\nFocus: '+(pb_focus||'Not specified')+'\n---' : '');
  try{
    const sessionId=localStorage.getItem('dc_session')||(function(){const s='dc_'+Date.now()+'_'+Math.random().toString(36).slice(2);localStorage.setItem('dc_session',s);return s;})();
    const r=await fetch('https://peamviowxkyaglyjpagc.supabase.co/functions/v1/coach-proxy',{method:'POST',headers:{'Content-Type':'application/json','x-session-id':sessionId},body:JSON.stringify({context:memberCtx,messages:pb_history})});
    const data=await r.json();
    const errMsg=data.error||data.message||null;
    if(errMsg||data.code){pbHideTyping();pbAddMsg('coach',errMsg||'Something went wrong — please try again.');pb_typing=false;document.getElementById('pb-dc-send-btn').disabled=false;document.getElementById('pb-dc-status').textContent='Ready';return;}
    const reply=data?.content?.[0]?.text||'';
    if(!reply){pbHideTyping();pbAddMsg('coach','I wasn\'t able to generate a response. Could you try rephrasing your question? The more specific you are about your situation, the better I can help.');pb_typing=false;document.getElementById('pb-dc-send-btn').disabled=false;document.getElementById('pb-dc-status').textContent='Ready';return;}
    pbHideTyping(); pbAddMsg('coach',reply); pb_history.push({role:'assistant',content:reply});
    if(pb_history.length>40) pb_history=pb_history.slice(-40);
  } catch(e){
    pbHideTyping(); pbAddMsg('coach','Connection error — try again in a moment.');
  }
  pb_typing=false;
  document.getElementById('pb-dc-send-btn').disabled=false;
  document.getElementById('pb-dc-status').textContent='Ready';
};

window.pbDcNewSession = function(){
  if(!confirm('Clear conversation history?')) return;
  pb_history=[]; document.getElementById('pb-dc-messages').innerHTML='';
  setTimeout(pbWelcome,200);
};

// Init on load
window.addEventListener('DOMContentLoaded',function(){
  const gate=document.getElementById('pb-dc-gate');
  if(gate&&localStorage.getItem('pb_dc_access')==='1'){
    gate.style.display='none'; pbDcInit();
  }
});
})();