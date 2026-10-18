# عقارك من بعيد

موقع ثابت يُبنى بـ Eleventy ويُستضاف على Cloudflare Pages، وتُحرَّر مقالاته من لوحة Pages CMS.
العربية في جذر الموقع، والإنجليزية تحت /en/ وتُترجم تلقائيًا.

- إعدادات Cloudflare Pages: أمر البناء `npm run build`، ومجلد الناتج `_site`.
- لوحة التحرير: https://app.pagescms.org ثم اختر المستودع aqarak-min-baeed.
- لا تعدّل ملفات الكود من GitHub مباشرة؛ اكتب المحتوى من اللوحة فقط.

## الترجمة التلقائية إلى الإنجليزية

- تعمل من GitHub Actions (الملف .github/workflows/translate.yml) بعد كل حفظ لمحتوى عربي، ومرة يوميًا.
- تستخدم Cloudflare Workers AI بالحصة المجانية اليومية لحساب Cloudflare نفسه.
- تحتاج سرّين في المستودع (Settings ثم Secrets and variables ثم Actions):
  - CF_ACCOUNT_ID: رقم حساب Cloudflare.
  - CF_API_TOKEN: توكن بصلاحية Workers AI.
- لو انتهت الحصة اليومية، تكمل الترجمة في التشغيل التالي تلقائيًا.
- المقال العربي المسودة لا يُترجم، والمقال العربي المحذوف تُحذف ترجمته.
