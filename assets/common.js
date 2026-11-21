/* أدوات مشتركة بين البوابة ولوحة الإدارة */
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

/* الأقسام: لكل قسم لونه وخلفيته ولمعته */
const SECTIONS = {
  announcements:{label:'التبليغات',          icon:'📢', c:'#7A1212', bg:'#F1E4C3', glow:'#FF2E93'},
  homework:     {label:'الواجبات',           icon:'✏️', c:'#1F3B2D', bg:'#DCE9D5', glow:'#39FF14'},
  exams:        {label:'الامتحانات',         icon:'📝', c:'#1E2F4A', bg:'#D5E4F3', glow:'#00E5FF'},
  lessons:      {label:'الدروس الإلكترونية', icon:'🎬', c:'#5B4326', bg:'#F6E3A1', glow:'#FFEB00'},
  events:       {label:'المناسبات',          icon:'🎉', c:'#3B2A1A', bg:'#E8D5AE', glow:'#FF6A00'},
  activities:   {label:'النشاطات',           icon:'🏅', c:'#4A3A28', bg:'#ECDCB6', glow:'#B026FF'},
  contact:      {label:'التواصل',            icon:'💬', c:'#1E2F4A', bg:'#D5E4F3', glow:'#00E5FF'}
};
function theme(key){
  const s = SECTIONS[key] || {c:'#1F3B2D', bg:'#DCE9D5', glow:'#39FF14'};
  const r = document.documentElement.style;
  r.setProperty('--sec', s.c); r.setProperty('--secbg', s.bg); r.setProperty('--glow', s.glow);
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
/* نص آمن مع تحويل الروابط والأسطر */
function rich(t){
  return esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
}
function ytId(u){
  const m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/))([\w-]{11})/);
  return m ? m[1] : '';
}
const gradeLabel = g => g ? 'الصف ' + g : 'جميع الصفوف';
