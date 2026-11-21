/* أدوات مشتركة بين البوابة ولوحة الإدارة وصفحة الامتحانات */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const AR = '٠١٢٣٤٥٦٧٨٩';
const toAr = n => String(n).replace(/\d/g, d => AR[d]);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = {
  get(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} }
};
function toast(t){ const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2400); }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const DRAFT_KEY = 'wx2-admin-draft', BASE_KEY = 'wx2-admin-base';

/* الأقسام: لون داكن من هوية براعم + لمعة نيون للإبراز */
const SECTIONS = {
  announcements:{label:'التبليغات',          icon:'📢', c:'#7A1212', glow:'#FF2E93'},
  homework:     {label:'الواجبات',           icon:'✏️', c:'#1F3B2D', glow:'#39FF14'},
  exams:        {label:'الامتحانات',         icon:'📝', c:'#1E2F4A', glow:'#00E5FF'},
  lessons:      {label:'الدروس الإلكترونية', icon:'🎬', c:'#5B4326', glow:'#FFEB00'},
  events:       {label:'المناسبات',          icon:'🎉', c:'#3B2A1A', glow:'#FF6A00'},
  activities:   {label:'النشاطات',           icon:'🏅', c:'#2A1E3F', glow:'#B026FF'},
  contact:      {label:'التواصل',            icon:'💬', c:'#1E2F4A', glow:'#00E5FF'}
};
function theme(key){
  const s = SECTIONS[key] || {c:'#1E2F4A', glow:'#00E5FF'};
  const r = document.documentElement.style;
  r.setProperty('--sec', s.c); r.setProperty('--glow', s.glow);
}

/* المراحل والصفوف. الجمهور المستهدف لأي عنصر:
   ''                 = جميع المراحل
   'مرحلة:الابتدائية' = مرحلة كاملة
   'الأول الابتدائي'  = صف واحد */
const STAGE_P = 'مرحلة:';
const allGrades = D => D.stages.flatMap(s => s.grades);
const stageOf = (D, g) => (D.stages.find(s => s.grades.includes(g)) || {}).name || '';
function audienceLabel(t){
  if(!t) return 'جميع المراحل';
  if(t.startsWith(STAGE_P)) return 'المرحلة ' + t.slice(STAGE_P.length);
  return 'الصف ' + t;
}
function matches(D, t, sel){
  if(!t || (!sel.stage && !sel.grade)) return true;
  if(t.startsWith(STAGE_P)) return t.slice(STAGE_P.length) === (sel.stage || stageOf(D, sel.grade));
  if(sel.grade) return t === sel.grade;
  return stageOf(D, t) === sel.stage;
}
function subjectsFor(D, t){
  if(!t) return [...new Set(D.stages.flatMap(s => s.subjects))];
  const st = t.startsWith(STAGE_P) ? t.slice(STAGE_P.length) : stageOf(D, t);
  return (D.stages.find(s => s.name === st) || {subjects:[]}).subjects;
}
/* قائمة اختيار الجمهور مجمّعة حسب المرحلة */
function audienceOptions(D, v, {all=true, stages=true}={}){
  return (all ? `<option value="">جميع المراحل</option>` : '') + D.stages.map(s => `
    <optgroup label="المرحلة ${esc(s.name)}">
      ${stages ? `<option value="${esc(STAGE_P + s.name)}"${v === STAGE_P + s.name ? ' selected' : ''}>كل المرحلة ${esc(s.name)}</option>` : ''}
      ${s.grades.map(g => `<option${g === v ? ' selected' : ''}>${esc(g)}</option>`).join('')}
    </optgroup>`).join('');
}

/* التواريخ بصيغة YYYY-MM-DD */
const pad = n => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
function dayDiff(iso){
  if(!iso) return null;
  const [y,m,d] = iso.split('-').map(Number), t = new Date();
  return Math.round((Date.UTC(y, m-1, d) - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5);
}
function fmtDate(iso, opt={weekday:'long', year:'numeric', month:'long', day:'numeric'}){
  if(!iso) return '';
  const [y,m,d] = iso.split('-').map(Number);
  return new Date(y, m-1, d).toLocaleDateString('ar-IQ', opt);
}
function relDay(n){
  if(n === null) return '';
  if(n === 0) return 'اليوم'; if(n === 1) return 'غداً'; if(n === -1) return 'أمس'; if(n === 2) return 'بعد غد';
  const a = Math.abs(n), w = a === 2 ? 'يومين' : a <= 10 ? toAr(a) + ' أيام' : toAr(a) + ' يوماً';
  return n > 0 ? 'بعد ' + w : 'قبل ' + w;
}
function rich(t){
  return esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
}
function ytId(u){
  const m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/))([\w-]{11})/);
  return m ? m[1] : '';
}
/* رسم الشعار الدائري التقني (سنة التأسيس في المركز) */
function orbSVG(year){
  const nodes = [0, 60, 130, 200, 255, 310].map(a => { const r = a * Math.PI / 180; return `<circle cx="${150 + 118*Math.cos(r)}" cy="${150 + 118*Math.sin(r)}" r="4" fill="var(--glow)"/>`; }).join('');
  return `<svg viewBox="0 0 300 300" aria-hidden="true">
    <defs><radialGradient id="og" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="var(--glow)" stop-opacity=".28"/><stop offset="1" stop-color="var(--glow)" stop-opacity="0"/></radialGradient></defs>
    <circle cx="150" cy="150" r="150" fill="url(#og)"/>
    <g class="spin"><circle cx="150" cy="150" r="118" fill="none" stroke="var(--glow)" stroke-opacity=".5" stroke-dasharray="2 10"/>${nodes}</g>
    <g class="spin2"><circle cx="150" cy="150" r="92" fill="none" stroke="#F1E4C3" stroke-opacity=".35" stroke-dasharray="60 20 6 20"/></g>
    <circle cx="150" cy="150" r="70" fill="rgba(11,18,32,.75)" stroke="var(--glow)" stroke-width="1.5"/>
    <circle cx="150" cy="150" r="64" fill="none" stroke="var(--glow)" stroke-opacity=".35"/>
    <text x="150" y="138" text-anchor="middle" class="yl">تأسست عام</text>
    <text x="150" y="182" text-anchor="middle" class="yr">${toAr(year)}</text>
  </svg>`;
}
