/* إعدادات مشروع Firebase الخاص بالمدرسة.
   انسخها من: Firebase Console ← ⚙️ Project settings ← General ← Your apps ← SDK setup and configuration ← Config
   والصقها مكان null بالشكل:
   window.FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", projectId: "...", storageBucket: "...", messagingSenderId: "...", appId: "..." };
   هذه الإعدادات ليست كلمة سر، ووضعها في الموقع آمن؛ الحماية تأتي من قواعد firestore.rules.
   ما دامت null يعمل الموقع بالمحتوى الثابت في data/content.js دون حسابات ولا رسائل داخلية. */
window.FIREBASE_CONFIG = null;
