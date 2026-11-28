/* طبقة الاتصال بقاعدة بيانات Firebase، مشتركة بين البوابة ولوحة الإدارة وصفحة الامتحانات */
const V = '10.12.2', CDN = `https://www.gstatic.com/firebasejs/${V}/`;
export const LIVE = !!window.FIREBASE_CONFIG;
export const USER_DOMAIN = 'baraem-karbala.invalid';
export let F = null, A = null, db = null, auth = null, ap = null;
let ready = null;

export function init(){
  if(!LIVE) return Promise.resolve(null);
  return ready ||= (async () => {
    const [apm, fs, au] = await Promise.all([import(CDN + 'firebase-app.js'), import(CDN + 'firebase-firestore.js'), import(CDN + 'firebase-auth.js')]);
    ap = apm; F = fs; A = au;
    const app = ap.initializeApp(window.FIREBASE_CONFIG);
    db = F.getFirestore(app); auth = A.getAuth(app);
    let emu = null; try{ emu = localStorage.getItem('wx-emu'); }catch(e){}
    if(emu){ F.connectFirestoreEmulator(db, '127.0.0.1', 8080); A.connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings:true}); }
    await new Promise(r => { const u = A.onAuthStateChanged(auth, () => { u(); r(); }); });
    return {F, A, db, auth};
  })();
}

/* اسم المستخدم يتحول إلى بريد داخلي؛ ومن يكتب بريداً حقيقياً يُستخدم كما هو */
export const toEmail = u => (u = String(u).trim().toLowerCase()).includes('@') ? u : `${u}@${USER_DOMAIN}`;
export const userName = email => String(email || '').replace('@' + USER_DOMAIN, '');

/* تسجيل دخول مجهول للتلاميذ وأولياء الأمور (بلا حسابات) */
export async function ensureAnon(){
  if(!auth.currentUser) await A.signInAnonymously(auth);
  return auth.currentUser;
}
export async function profile(){
  const u = auth.currentUser;
  if(!u || u.isAnonymous) return null;
  const s = await F.getDoc(F.doc(db, 'users', u.uid));
  return s.exists() ? {uid: u.uid, email: u.email, ...s.data()} : null;
}
export const docs = snap => snap.docs.map(d => ({id: d.id, ...d.data()}));

/* محتوى البوابة: الإعدادات والمنشورات ودليل التواصل؛ وعند عدم وجود إعدادات يُستخدم content.js */
export async function loadSite(){
  const [st, posts, dir] = await Promise.all([
    F.getDoc(F.doc(db, 'settings', 'school')),
    F.getDocs(F.collection(db, 'posts')),
    F.getDocs(F.collection(db, 'directory'))
  ]);
  const base = st.exists() ? st.data() : {school: window.SCHOOL.school, stages: window.SCHOOL.stages};
  const D = {school: base.school, stages: base.stages, channels: [], announcements: [], homework: [], exams: [], lessons: [], events: [], activities: []};
  docs(posts).forEach(p => { if(D[p.type]) D[p.type].push(p); });
  D.staff = docs(dir).filter(d => d.inbox !== false).map(d => ({id: d.id, name: d.name, role: d.title || '', stage: d.stage || '', subjects: d.subjects || '', grades: d.grades || '', inbox: true}));
  D.configured = st.exists();
  return D;
}
export const now = () => F.serverTimestamp();
export function tsText(t){
  const d = t && t.toDate ? t.toDate() : t ? new Date(t) : null;
  return d ? d.toLocaleString('ar-IQ', {day:'numeric', month:'long', hour:'numeric', minute:'2-digit'}) : '';
}
export function errText(e){
  const c = String(e && (e.code || e.message) || e);
  if(/permission-denied|insufficient permissions/i.test(c)) return 'لا تملك صلاحية لهذا الإجراء.';
  if(/invalid-credential|wrong-password|user-not-found|invalid-login/i.test(c)) return 'اسم المستخدم أو كلمة السر غير صحيحة.';
  if(/email-already-in-use/.test(c)) return 'اسم المستخدم مستخدم من قبل، اختر اسماً آخر.';
  if(/weak-password/.test(c)) return 'كلمة السر ضعيفة، اجعلها ٨ أحرف على الأقل.';
  if(/invalid-email/.test(c)) return 'اسم المستخدم غير صالح. استخدم حروفاً إنكليزية وأرقاماً فقط.';
  if(/too-many-requests/.test(c)) return 'محاولات كثيرة، انتظر قليلاً ثم حاول مجدداً.';
  if(/requires-recent-login/.test(c)) return 'سجّل الخروج ثم الدخول مجدداً، ثم أعد المحاولة.';
  if(/unavailable|network|offline/i.test(c)) return 'تعذّر الاتصال بالإنترنت. تحقق من الشبكة وحاول مجدداً.';
  if(/operation-not-allowed|admin-restricted/.test(c)) return 'طريقة الدخول هذه غير مفعّلة في Firebase. راجع دليل التشغيل.';
  return 'حدث خطأ غير متوقع: ' + c;
}
