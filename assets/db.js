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

/* إعدادات المدرسة ودليل التواصل؛ المنشورات تُجلب بالاشتراك subscribePosts حسب صلاحية الزائر */
export async function loadSite(){
  const [st, dir] = await Promise.all([F.getDoc(F.doc(db, 'settings', 'school')), F.getDocs(F.collection(db, 'directory'))]);
  const base = st.exists() ? st.data() : {school: window.SCHOOL.school, stages: window.SCHOOL.stages};
  const D = {school: base.school, stages: base.stages, channels: [], announcements: [], homework: [], exams: [], lessons: [], events: [], activities: []};
  D.staff = docs(dir).filter(d => d.inbox !== false).map(d => ({id: d.id, name: d.name, role: d.title || '', stage: d.stage || '', subjects: d.subjects || '', grades: d.grades || '', inbox: true}));
  D.configured = st.exists();
  return D;
}
/* الكادر يرى كل المنشورات؛ والزائر يرى العامة + منشورات الصفوف التي دخلها برمز */
export function subscribePosts({all, grades}, cb){
  const col = F.collection(db, 'posts');
  const qs = all ? [col] : [F.query(col, F.where('public', '==', true)), ...grades.map(g => F.query(col, F.where('grade', '==', g)))];
  const parts = qs.map(() => null);
  let first; const ready = new Promise(r => first = r);
  const emit = () => { if(!parts.every(Boolean)) return; const m = new Map(); parts.flat().forEach(p => m.set(p.id, p)); cb([...m.values()]); first(); };
  const uns = qs.map((q, i) => F.onSnapshot(q,
    s => { parts[i] = s.docs.map(d => ({id: d.id, ...d.data({serverTimestamps: 'estimate'})})); emit(); },
    e => { console.error(e); parts[i] = parts[i] || []; emit(); }));
  return {ready, stop: () => uns.forEach(u => u())};
}
/* الدخول إلى صف برمزه */
export const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export async function joinClass(code, parentName, studentName){
  const u = await ensureAnon(); code = cleanCode(code);
  if(code.length < 4) throw {code: 'bad-code'};
  const c = await F.getDoc(F.doc(db, 'joinCodes', code));
  if(!c.exists()) throw {code: 'bad-code'};
  const grade = c.data().grade, ref = F.doc(db, 'memberships', u.uid + '__' + grade);
  const had = await F.getDoc(ref).then(x => x.exists()).catch(() => false);
  if(!had) await F.setDoc(ref, {uid: u.uid, grade, code, parentName: String(parentName).trim(), studentName: String(studentName).trim(), at: now()});
  return grade;
}
export async function myMemberships(){
  const u = auth.currentUser; if(!u) return [];
  return docs(await F.getDocs(F.query(F.collection(db, 'memberships'), F.where('uid', '==', u.uid))));
}
export const isPublicGrade = g => !g || g.startsWith('مرحلة:');
const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newCode = (n = 6) => Array.from(crypto.getRandomValues(new Uint32Array(n)), x => CODE_ABC[x % CODE_ABC.length]).join('');
export const now = () => F.serverTimestamp();
export function tsText(t){
  const d = t && t.toDate ? t.toDate() : t ? new Date(t) : null;
  return d ? d.toLocaleString('ar-IQ', {day:'numeric', month:'long', hour:'numeric', minute:'2-digit'}) : '';
}
export function errText(e){
  const c = String(e && (e.code || e.message) || e);
  if(/bad-code/.test(c)) return 'رمز الصف غير صحيح. تأكد منه واكتبه كما أرسلته المدرسة.';
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
