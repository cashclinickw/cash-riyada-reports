# Cash Riyada — نظام متابعة الاستشارات (GitHub Pages)

نظام يلفّ تقرير استشارة Cash Riyada (`docs.html`) بطبقة سحابية + لوحة حالات،
كل العملاء محفوظين في السحابة ومتابَعين حسب المرحلة. هوية Cash Riyada (Teal).

## الملفات
| ملف | الوظيفة |
|---|---|
| `dashboard.html` | الصفحة الرئيسية (استشارة جديدة · لوحة الحالات · مزامنة) |
| `docs.html` | تقرير الاستشارة الكامل + شريط سحابي أسفل يسار |
| `pipeline.html` | لوحة الحالات (Kanban) — العملاء حسب المرحلة |
| `cash-riyada-cloud.js` | الجسر السحابي (Firebase) — الإعدادات **مضافة سلفاً** |
| `logo.png` `favicon.png` `mark-light.png` | هوية Cash Riyada |
| `.nojekyll` | يمنع معالجة GitHub لـ Jekyll |

## الرفع (خطوة واحدة)
1. سوّي repo جديد على GitHub وارفعي **كل** الملفات في الجذر (مو داخل مجلد).
2. Settings → Pages → Branch: `main` / `(root)` → Save.
3. افتحي: `https://<username>.github.io/<repo>/dashboard.html`

## إعداد Firebase (مشروع `sh-riyada` — مرّة وحدة)
> الإعدادات مضافة داخل `cash-riyada-cloud.js` — ما يحتاج تغيّرين شي في الكود.
من [console.firebase.google.com](https://console.firebase.google.com) في مشروع **sh-riyada**:
1. **Firestore Database** → Create database.
2. **Authentication** → Sign-in method → فعّلي **Anonymous**.
3. **Firestore → Rules** ألصقي:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /clients/{clientId} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
4. **Authentication → Settings → Authorized domains** → أضيفي `<username>.github.io`.

## طريقة العمل
- `docs.html` = استشارة واحدة. تعبّئينها، تختارين **الحالة** من الشريط، وتضغطين **☁ حفظ للسحابة**.
- `pipeline.html` = يقرأ كل العملاء من السحابة ويرتّبهم بالأعمدة: جديد ← الجلسة الأولى ← الجلسة الثانية ← مكتمل ← تحت التنفيذ.
- «✎ فتح للتعديل» يفتح التقرير محمّلاً ببيانات العميل. «↔ نقل» يغيّر الحالة. «🗑 حذف» يحذف من السحابة.
- التصدير PDF = طباعة المتصفح من داخل التقرير.

## ملاحظات
- مفتاح Firebase الظاهر في الملف **عام وآمن** لتطبيقات الويب — الحماية عبر قواعد Firestore + النطاقات المصرّح بها.
- كل عميل = مستند واحد في مجموعة `clients` (أقل بكثير من حد 1MB).

## حفظ التقرير PDF في Google Drive (اختياري)
زر **«📥 حفظ PDF في Google Drive»** داخل تبويب «الملخص النهائي» يولّد PDF للتقرير ويرفعه لمجلد في Drive.
الموقع ثابت (GitHub Pages) فيحتاج وسيط بسيط = **Google Apps Script Web App** يشتغل تحت حساب Google Workspace مالتك.

**الخطوات (مرّة وحدة):**
1. افتحي [script.google.com](https://script.google.com) → **New project**.
2. امسحي الكود الموجود، وألصقي محتوى ملف **`google-drive-apps-script.gs`**، ثم احفظي (💾).
3. **Deploy → New deployment** → اختاري النوع **Web app**:
   - *Description:* Cash Riyada Drive
   - *Execute as:* **Me** (حسابك)
   - *Who has access:* **Anyone** (أو *Anyone within [نطاقك]* إذا تبين تقصرينه على موظفينك)
4. **Deploy** → وافقي على صلاحيات Google (Review permissions → اختاري حسابك → Allow).
5. انسخي **Web app URL** (ينتهي بـ `/exec`).
6. افتحي **`cash-riyada-cloud.js`** وألصقي الرابط:
   ```js
   window.CR_DRIVE_ENDPOINT = "https://script.google.com/macros/s/AKfyc.../exec";
   ```
7. ارفعي التحديث لـ GitHub. خلاص — الزر يشتغل.

**ملاحظات:**
- الملفات تنحفظ في مجلد اسمه **`Cash Riyada Reports`** (يتسوّى تلقائياً)، بصيغة `Cash Riyada - اسم العميل - التاريخ.pdf`.
- لو ما ألصقتي الرابط، الزر ينبّهك إنه غير مضبوط (بدون أخطاء).
- بسبب قيود المتصفح (CORS) قد لا يظهر رابط الملف مباشرة أحياناً، لكن الملف **ينحفظ في Drive** على أي حال — تلقينه بالمجلد.
- لو غيّرتي كود الـ Apps Script لاحقاً، سوّي **Deploy → Manage deployments → Edit → New version**.
