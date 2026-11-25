/* ربط صفحة الامتحانات بقاعدة البيانات: النشر على المنصة، وأداء التلاميذ، وحفظ المحاولات.
   تعتمد على المتغيرات العامة في exams.html (exam, S, SCH, editor, startStudent, result, ...) */
import {init, F, db, auth, ensureAnon, profile, now, errText} from './db.js';

await init();
const P = await profile().catch(() => null);
try{
  const st = await F.getDoc(F.doc(db, 'settings', 'school'));
  if(st.exists()){ SCH = st.data(); SCHOOL_NAME = SCH.school.name; }
}catch(e){}
const grades = () => SCH ? SCH.stages.flatMap(s => s.grades) : [];
const today = () => new Date().toISOString().slice(0, 10);
const out = (html, el = '#liveout') => { const b = document.querySelector(el); if(b) b.innerHTML = html; };
const studentURL = id => location.href.split(/[?#]/)[0] + '?id=' + id;

window.LX = {
  /* إعدادات النشر داخل محرر الامتحان */
  editorBlock(){
    return `
    <div class="box" id="livebox">
      <h3 style="margin-top:0">النشر على منصة المدرسة</h3>
      ${P ? `<p class="muted">تنشر باسم: <b>${esc(P.name)}</b>. تُحفظ إجابات التلاميذ وتظهر لك في «لوحة الإدارة ← الاختبارات والنتائج».</p>`
          : '<div class="alert">للنشر على المنصة سجّل الدخول أولاً من <a href="admin.html" style="color:inherit">لوحة الإدارة</a> ثم ارجع إلى هذه الصفحة.</div>'}
      <div class="grid">
        <div><label>النوع</label><select data-k="type"><option value="exam">امتحان</option><option value="homework">واجب إلكتروني</option></select></div>
        <div class="wide"><label>طريقة التصحيح</label><select data-k="mode">
          <option value="instant">فورية: يرى التلميذ درجته والتصحيح مباشرة</option>
          <option value="protected">محمية: الإجابات لا تصل لجهاز التلميذ، وتظهر الدرجة بعد اعتمادك</option></select></div>
        <div><label>تاريخ الفتح</label><input type="date" data-k="date"></div>
        <div><label>آخر موعد للواجب (اختياري)</label><input type="date" data-k="due"></div>
      </div>
      ${exam._id ? '<p class="muted">أنت تعدّل اختباراً منشوراً. تغيير الأسئلة بعد بدء التلاميذ يغيّر تصحيح محاولاتهم السابقة.</p>' : ''}
      <div class="row" style="margin-top:10px"><button class="pri" id="livepub" ${P ? '' : 'disabled'}>${exam._id ? 'حفظ التعديلات على المنصة' : 'نشر على المنصة'}</button>
        ${exam._id ? '<a href="exams.html?new=1"><button>اختبار جديد</button></a>' : ''}<a href="admin.html"><button>لوحة الإدارة</button></a></div>
      <div id="liveout"></div>
    </div>`;
  },
  wireEditor(){
    const b = document.querySelector('#livepub');
    if(b) b.onclick = publishLive;
    if(exam._id) showLink(exam._id);
  },
  onSubmit: send,
  afterDone
};

async function publishLive(){
  const e = validate();
  if(e) return out(`<div class="alert">${esc(e)}</div>`);
  if(!exam.title.trim()) return out('<div class="alert">اكتب عنوان الامتحان.</div>');
  if(!grades().includes(exam.grade)) return out('<div class="alert">اختر الصف من القائمة المقترحة كما هو مكتوب، حتى يظهر الاختبار لتلاميذ هذا الصف.</div>');
  if(!exam.subject.trim()) return out('<div class="alert">اكتب المادة.</div>');
  if(!exam.date) return out('<div class="alert">حدد تاريخ الفتح.</div>');
  const btn = document.querySelector('#livepub'); btn.disabled = true;
  try{
    const id = exam._id || F.doc(F.collection(db, 'exams')).id;
    const postId = exam.postId || F.doc(F.collection(db, 'posts')).id;
    const authorUid = exam._authorUid || P.uid, authorName = exam._authorName || P.name;
    const qsPub = exam.qs.map(({a, ...r}) => r), key = exam.qs.map(q => q.a);
    const data = {
      title: exam.title.trim(), type: exam.type || 'exam', mode: exam.mode || 'instant', grade: exam.grade, subject: exam.subject.trim(),
      school: exam.school || SCHOOL_NAME, minutes: +exam.minutes || 0, shuffle: !!exam.shuffle, review: !!exam.review,
      date: exam.date, due: exam.due || '', qs: qsPub, status: exam.status || 'open',
      authorUid, authorName, postId, createdAt: exam._createdAt || now(), updatedAt: now()
    };
    if(data.mode === 'instant') data.key = key;
    const w = F.writeBatch(db);
    w.set(F.doc(db, 'exams', id), data);
    if(data.mode === 'protected') w.set(F.doc(db, 'examKeys', id), {key});
    else if(exam._id && exam._mode === 'protected') w.delete(F.doc(db, 'examKeys', id));
    const hw = data.type === 'homework';
    w.set(F.doc(db, 'posts', postId), {
      type: hw ? 'homework' : 'exams', title: data.title, grade: data.grade, subject: data.subject, date: data.date, due: hw ? data.due : '',
      body: `${hw ? 'واجب' : 'اختبار'} إلكتروني من ${toAr(qsPub.length)} ${qsPub.length > 10 ? 'سؤالاً' : 'أسئلة'}${data.minutes ? '، مدته ' + toAr(data.minutes) + ' دقيقة' : ''}. ${data.mode === 'instant' ? 'تظهر الدرجة مباشرة بعد التسليم.' : 'تظهر الدرجة بعد اعتماد المعلم.'}`,
      link: 'exams.html?id=' + id, examId: id, authorUid, authorName, createdAt: exam._createdAt || now(), updatedAt: now()
    });
    await w.commit();
    const wasNew = !exam._id;
    Object.assign(exam, {_id: id, postId, _authorUid: authorUid, _authorName: authorName, _mode: data.mode, status: data.status});
    saveDraft();
    if(wasNew){ store.set('wx-draft', blankExam()); history.replaceState(null, '', 'exams.html?edit=' + id); }
    toast(wasNew ? 'نُشر الاختبار على المنصة' : 'حُفظت التعديلات');
    editor();
  }catch(x){ btn.disabled = false; out(`<div class="alert">${esc(errText(x))}</div>`); }
}
function showLink(id){
  const url = studentURL(id);
  out(`
    <h3>رابط التلاميذ</h3>
    <div class="link" id="lnk">${esc(url)}</div>
    <div class="row" style="margin-top:8px">
      <button class="pri" id="cp">نسخ الرابط</button>
      <a target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent((exam.title || '') + '\n' + url)}"><button>إرسال عبر واتساب</button></a>
    </div>
    <p class="muted">يظهر الاختبار أيضاً في بوابة المدرسة لتلاميذ الصف ${esc(exam.grade)}.</p>`);
  document.querySelector('#cp').onclick = async () => {
    try{ await navigator.clipboard.writeText(url); toast('تم نسخ الرابط'); }
    catch(_){ const r = document.createRange(); r.selectNodeContents(document.querySelector('#lnk')); getSelection().removeAllRanges(); getSelection().addRange(r); }
  };
}

/* ============ تحميل اختبار للتعديل ============ */
async function loadEdit(id){
  app.innerHTML = '<p>جارٍ تحميل الاختبار…</p>';
  if(!P){ app.innerHTML = '<h2>سجّل الدخول أولاً</h2><p>تعديل الاختبارات للكادر فقط.</p><a href="admin.html"><button class="pri">لوحة الإدارة</button></a>'; return; }
  try{
    const s = await F.getDoc(F.doc(db, 'exams', id));
    if(!s.exists()) throw {code: 'not-found'};
    const d = s.data();
    const key = d.mode === 'protected' ? ((await F.getDoc(F.doc(db, 'examKeys', id))).data() || {}).key || [] : d.key || [];
    exam = {
      v: 1, title: d.title, type: d.type, mode: d.mode, grade: d.grade, subject: d.subject, school: d.school, minutes: d.minutes,
      shuffle: d.shuffle, review: d.review, date: d.date, due: d.due, status: d.status,
      qs: d.qs.map((q, i) => ({...q, a: key[i]})),
      _id: id, postId: d.postId, _createdAt: d.createdAt, _authorUid: d.authorUid, _authorName: d.authorName, _mode: d.mode
    };
    editor();
  }catch(x){ app.innerHTML = `<h2>تعذّر فتح الاختبار</h2><p>${esc(x.code === 'not-found' ? 'الاختبار غير موجود أو حُذف.' : errText(x))}</p>`; }
}

/* ============ أداء التلميذ ============ */
async function studentLive(id){
  app.innerHTML = '<p>جارٍ تحميل الاختبار…</p>';
  try{
    await ensureAnon();
    const s = await F.getDoc(F.doc(db, 'exams', id));
    if(!s.exists()){ app.innerHTML = '<h2>الاختبار غير موجود</h2><p>ربما حذفه المعلم. تأكد من الرابط.</p>'; return; }
    const d = s.data(), saved = store.get('wx-run-L' + id);
    setHeader(d.school || SCHOOL_NAME);
    if(!saved && d.status !== 'open'){ app.innerHTML = `<h2>${esc(d.title)}</h2><div class="box"><p>هذا ${d.type === 'homework' ? 'الواجب' : 'الامتحان'} مغلق حالياً.</p></div>`; return; }
    if(!saved && d.date > today()){ app.innerHTML = `<h2>${esc(d.title)}</h2><div class="box"><p>يُفتح يوم ${esc(new Date(d.date + 'T00:00').toLocaleDateString('ar-IQ', {weekday:'long', day:'numeric', month:'long'}))}.</p></div>`; return; }
    const ex = {
      _id: id, title: d.title, subject: d.subject, grade: d.grade, school: d.school || SCHOOL_NAME, minutes: d.minutes, shuffle: d.shuffle,
      review: d.mode === 'instant' && d.review, mode: d.mode, type: d.type,
      qs: d.qs.map((q, i) => d.mode === 'instant' ? {...q, a: d.key[i]} : {...q})
    };
    startStudent(ex, false, 'L' + id);
  }catch(x){ app.innerHTML = `<h2>تعذّر تحميل الاختبار</h2><p>${esc(errText(x))}</p><button class="pri" onclick="location.reload()">إعادة المحاولة</button>`; }
}
async function send(){
  app.innerHTML = '<div class="score"><h2>جارٍ إرسال إجاباتك…</h2><p>لا تغلق الصفحة.</p></div>';
  try{
    await ensureAnon();
    if(!S.attemptId){ S.attemptId = F.doc(F.collection(db, 'attempts')).id; persist(); }
    const ref = F.doc(db, 'attempts', S.attemptId);
    const ex = await F.getDoc(ref).then(x => x.exists()).catch(() => false);
    if(!ex) await F.setDoc(ref, {
      examId: S.ex._id, uid: auth.currentUser.uid, name: S.name, grade: S.ex.grade || '', section: S.sec || '',
      answers: S.ans.map(a => a === undefined ? null : a), order: S.order, startedAt: S.start, submittedAt: now(),
      leaves: S.leaves || 0, timeout: !!S.timeout
    });
    S.sent = true; persist(); afterDone();
  }catch(x){
    app.innerHTML = `<div class="score"><h2>لم تُرسل إجاباتك بعد</h2><p>${esc(errText(x))}</p></div>
      <p style="text-align:center">إجاباتك محفوظة على هذا الجهاز. تحقق من الإنترنت ثم اضغط:</p>
      <div class="row" style="justify-content:center"><button class="pri" id="retry">إعادة الإرسال</button></div>`;
    document.querySelector('#retry').onclick = send;
  }
}
function afterDone(){
  if(!S.sent) return send();
  if(S.ex.mode !== 'protected') return result();
  app.innerHTML = `
    <div class="score"><h2>تم تسليم إجاباتك ✔</h2><p>ستظهر درجتك هنا بعد أن يعتمد المعلم النتائج.</p></div>
    <div class="slip">
      <table>
        <tr><td>اسم التلميذ</td><td>${esc(S.name)}</td></tr>
        <tr><td>الصف والشعبة</td><td>${esc(S.ex.grade)}${S.sec ? ' / ' + esc(S.sec) : ''}</td></tr>
        <tr><td>${S.ex.type === 'homework' ? 'الواجب' : 'الامتحان'}</td><td>${esc(S.ex.title)}، ${esc(S.ex.subject || '')}</td></tr>
        <tr><td>رمز المحاولة</td><td dir="ltr" style="text-align:right">${esc(S.attemptId)}</td></tr>
      </table>
    </div>
    <div id="res"></div>
    <div class="row" style="justify-content:center;margin-top:14px"><button class="pri" id="chk">عرض نتيجتي</button><a href="index.html"><button>بوابة المدرسة</button></a></div>`;
  document.querySelector('#chk').onclick = checkResult;
  checkResult(true);
}
async function checkResult(silent){
  try{
    await ensureAnon();
    const a = await F.getDoc(F.doc(db, 'attempts', S.attemptId));
    const r = a.exists() && a.data().result;
    if(!r){ if(silent !== true) toast('لم تُعتمد النتيجة بعد'); return; }
    out(`<div class="score" style="margin-top:14px"><div class="big">${toAr(r.got)} / ${toAr(r.total)}</div><div class="grade${r.pct < 50 ? ' fail' : ''}">${esc(r.grade)}، ${toAr(r.pct)}٪</div></div>`, '#res');
  }catch(x){ if(silent !== true) toast(errText(x)); }
}

/* ============ التوجيه ============ */
const q = new URLSearchParams(location.search);
if(q.get('id')) studentLive(q.get('id'));
else if(q.get('edit')) loadEdit(q.get('edit'));
else if(q.has('new')){ exam = store.get('wx-draft') || blankExam(); if(exam._id) exam = blankExam(); editor(); }
else route();
