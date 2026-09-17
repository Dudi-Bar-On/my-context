<!-- Chapter 8 of the my_context capabilities documentation — Hebrew mirror.

  Hebrew mirror of `docs/capabilities/08-web-ui.md`. The English file is the
  source. Conventions: `docs/README.he.md` and `docs/the-store.he.md` — Hebrew
  prose and tables inside `<div dir="rtl">`, fenced blocks outside it,
  `<span dir="ltr">` around any Latin run whose edge characters are not both
  alphanumeric and around any run of two or more Latin terms joined by commas
  or slashes.

  Screen labels are given in Hebrew with the route id beside them, because the
  ids are what `NAV` and `strings/<lang>.js` key on and are not translated.
  Quoted owner rulings that the English file marks as verbatim English are kept
  in English.

  Heading sequence must stay identical to the English file.
-->
# ממשק הרשת

<div dir="rtl">

## מה זה, ולמה

<span dir="ltr">`mycontext ui [--port N] [--no-open] [--idle-ms N]`</span> מפעיל שרת HTTP מקומי
שקשור ל-<span dir="ltr">`127.0.0.1`</span> (<span dir="ltr">`src/ui/server.ts`</span>,
<span dir="ltr">`src/ui/open.ts`</span>) ופותח בו אפליקציית דף יחיד. זהו **חלון קריאה בלבד** אל
כל מה שהמסמך הזה מתאר — הקורפוס, מכניקת ההזרקה, ארכיון השיחות, יומן הביקורת, תור הסקירה, מאגר
כללי המוצר — כדי ש*אדם* יבחן בלי סוכן בלולאה ובלי להריץ פקודות שורת פקודה אחת אחת. הכותרת של
<span dir="ltr">`src/ui/routes.ts`</span> עצמו קובעת את כוונת העיצוב בפשטות:

> "שום דבר כאן אינו קורא קורפוס, ולכן שום דבר כאן אינו יכול לכתוב אחד. הטבלה מחזיקה מטפלים
> ומתאימה נתיבים; כל עובדה על הפרויקט מגיעה מגופי המטפלים ב-<span dir="ltr">`read-model.ts`</span>."

הפרק הזה נכתב **כולו מהמקור** — <span dir="ltr">`src/ui/*.ts`</span> ו-
<span dir="ltr">`src/ui/public/`</span> — בלי להתחבר לשרת החי. שרת ממשק הרשת של הבעלים היה למעלה
על פורט 58888 עם נתיבים אחרים מחוברים אליו בזמן שזה נכתב, והפרק הזה אינו נוגע בו בשום דרך (בלי
כלי דפדפן, בלי בקשת HTTP, בלי ניווט).

## ערובת אי-הכתיבה, ושנים־עשר הקישורים שהיא באמת מודה בהם

התוכנית שהמשטח הזה נבנה מולה (<span dir="ltr">`docs/superpowers/specs/2026-08-16-web-ui-design.md`</span>
§2) קובעת "כלל נטול-משנים", והכותרת של <span dir="ltr">`src/ui/security.ts`</span> אומרת במפורש
שהכלל "נאכף על ידי טסט גרף הייבוא, לא על ידי הקובץ הזה" — כלומר זו ערובה בזמן בנייה שניתנת
לבדיקה (טסט סטטי שקובע אילו מודולים תחת <span dir="ltr">`src/ui/`</span> רשאים לקשור סמל כותב
בכלל), ולא הבטחה בזמן ריצה שנלקחת על אמונה.

**המספר הנאכף הוא שנים־עשר, לא שלושה.** <span dir="ltr">`RULED_WRITES`</span> ב-
<span dir="ltr">`test/ui/no-writes.test.ts:590`</span> הוא רשימה מילולית של שתים־עשרה מחרוזות
קישור, והקביעה ב-<span dir="ltr">`:2077`</span> היא
<span dir="ltr">`assert.deepEqual(bound.sort(), RULED_WRITES, …)`</span> — **שוויון קבוצות**,
ולכן שנים־עשר היא הקבוצה המדויקת שמותרת, לא רצפה ולא תקרה שקורא צריך לעגל כלפי מטה. הוספת
שלושה־עשר מכשילה את הבנייה; וכך גם הסרה של אחד בלי לערוך את הרשימה. השנים־עשר יושבים ב**חמישה
קבצים**:

</div>

<div dir="rtl">

| קובץ | קישורים | מה הם |
|---|---|---|
| `src/ui/anchor-write.ts` | <span dir="ltr">`markAnchor`, `markAutomaticAnchors`, `unmarkAnchor`</span> | משטח כתיבת העוגנים (למטה) — **אינו מרכיב שום פקודה ואינו מפעיל שום תהליך** |
| `src/ui/execute.ts` | <span dir="ltr">`recordAudit`, `writeBudgets`, `deriveEffect`</span> | מסלול ההרצה של ה-Composer, כתיבת התקציב שלו, ותצוגת ה-Execute שמוגבלת ל-tmpdir |
| `src/ui/retrieval-write.ts` | <span dir="ltr">`stageRetrievalReturn`, `approveStagedRestore`</span> | משטח הביום/האישור של השליפה (למטה) — גם הוא אינו מרכיב שום פקודה |
| `src/ui/security.ts` | <span dir="ltr">`recordAudit`</span> | קישור **אחד**, משותף ל-<span dir="ltr">`recordRefusal`</span> ול-<span dir="ltr">`recordNonceMint`</span> |
| `src/ui/server.ts` | <span dir="ltr">`writeUiServerRecord`, `clearUiServerRecord`, `recordSessionDigest`</span> | מצב מכונה תחת השורש הגלובלי, מחוץ לכל קורפוס |

</div>

<div dir="rtl">

כל רשומה ב-<span dir="ltr">`RULED_WRITES`</span> נושאת פסיקת בעלים משלה ותכונות תיחום משלה
בהערה מעליה; הרשימה היא התיעוד הרשמי, והטבלה הזו היא אינדקס לתוכה. שלוש מהן ראויות לאמירה
מלאה כי הן אלה שקורא שמבקר את "האם משטח הרשת המקומי הזה יכול לכתוב לקורפוס שלי?" שואל עליהן:

1. **<span dir="ltr">`recordAudit`</span> דרך <span dir="ltr">`src/ui/security.ts`</span>** —
   מסלול הסירוב של שער האבטחה. כל בקשת <span dir="ltr">`/api/*`</span> עוברת שער שבודק את
   כותרות <span dir="ltr">Host/Origin</span> ואת אסימון הסשן; בקשה שהשער דוחה מקבלת בדיוק רשומת
   ביקורת אחת (<span dir="ltr">`kind: 'access', op: 'ui-refused'`</span>), שנבנית שדה-אחר-שדה
   מרשימת היתר שלעולם אינה יכולה לשאת את האסימון עצמו. הפונקציה בלתי מסוגלת מבנית לרשום קריאה
   ש*הוגשה*: היא מסרבת לכתוב כל דבר שה-<span dir="ltr">`status`</span> שלו אינו
   <span dir="ltr">`401`/`403`</span> או שה-<span dir="ltr">`check`</span> שלו אינו אחד מ-
   <span dir="ltr">`['host', 'origin', 'token-missing', 'token-mismatch']`</span>. הטבעת ה-nonce
   (<span dir="ltr">`POST /api/nonce`</span>, פסיקת בעלים 2026-08-28, קשורה ל-
   <span dir="ltr">`KNOWN-a-locked-out-tab-can-only-be-recovered-by-the-restart-that`</span>)
   מבוקרת דרך ה*אותו* קישור — היא אינה רשומה שנייה בקבוצה, וזו הסיבה שספירת "סירוב" ו"הטבעה"
   כשני חריגים אינה מתאימה לצורה שהטסט סופר בה.
2. **<span dir="ltr">`src/ui/execute.ts`</span>** — המודול שמריץ פקודה אמיתית ומשנה בשם האדם.
   ראו "ה-Composer" למטה.
3. **<span dir="ltr">`src/ui/anchor-write.ts`</span> ו-<span dir="ltr">`src/ui/retrieval-write.ts`</span>**
   — שני משטחי כתיבה שמגיעים לדיסק **בלי להרכיב פקודה בכלל**. ראו "שני משטחי הכתיבה נטולי
   הפקודה" למטה.

הכותרת של <span dir="ltr">`execute.ts`</span> עצמו מדגישה תכונה אחרת, והיא עוסקת בפלט ולא בהיותו
הכותב היחיד: *"הוא מרכיב כלום (זה <span dir="ltr">`execute-catalogue.ts`</span>), הוא מכריע כלום
לגבי איזה אישור פקודה מקבלת … והוא רושם שום **פלט** בשום מקום."*

## שני משטחי הכתיבה נטולי הפקודה

אלה החלק במשטח שמסגור ה"חלון קריאה בלבד" מסתיר, והם הסיבה שהספירה למעלה חשובה. שניהם נפסקו על
ידי הבעלים תחת משפט אחד —
<span dir="ltr">`REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`</span>: *פקודה
מורכבת שקורא מעתיק לטרמינל אינה ממשק הרשת שיש לו יכולת, היא ממשק הרשת שמתאר אחת.*

**<span dir="ltr">`src/ui/anchor-write.ts`</span>** רושם ארבעה מסלולים —
<span dir="ltr">`POST /api/conversations/anchors/{mark,relabel,drop,sweep}`</span>
(<span dir="ltr">`:511–522`</span>) — והכותרת שלו עצמו אומרת באותיות גדולות מה מבדיל אותו מה-
Composer: *"שום דבר כאן אינו מרכיב פקודה או מפעיל תהליך. אין argv, אין nonce, אין ילד. כל
הכתיבה היא שורה אחת."* ארבע תכונות תוחמות אותו, כפי שנאמר בכותרת ההיא: הוא עובר דרך **אותו תפר
ששורת הפקודה משתמשת בו** (<span dir="ltr">`markAnchor` / `unmarkAnchor`</span>, כש-
<span dir="ltr">`withAnchorWrite`</span> מפרסם את <span dir="ltr">`.my_context/.anchors.jsonl`</span>
בטרנזקציה שמזיזה את השורה); **מה שנמצא ב-gitignore הוא מה שזז** — שורת עוגן ומסמך ב-gitignore,
בלי פריט קורפוס, בלי <span dir="ltr">`config.json`</span>, בלי תמליל, כש-
<span dir="ltr">`test/ui/anchor-write-route.test.ts`</span> לוקח את תצלום הבתים על פני מסע
<span dir="ltr">mark/relabel/drop/sweep</span> שלם; **הצורה קבועה על ידי המסלול, לא על ידי
הקורא** (עוגן שנעשה ביד הוא <span dir="ltr">`kind: 'note'`</span>,
<span dir="ltr">`origin: 'owner'`</span>, ולכן שום בקשה אינה יכולה לזייף שורה שלמעבר האוטומטי
אסור לגעת בה); ו**הוא אינו יכול להדליק את הארכיון** — כל מטפל פותח קודם את דלת הקריאה ועונה על
מצב אי-האינדוקס ולא יוצר מסד נתונים.

**<span dir="ltr">`src/ui/retrieval-write.ts`</span>** רושם שלושה (<span dir="ltr">`:425–434`</span>):
<span dir="ltr">`POST /api/retrieval/stage`</span>,
<span dir="ltr">`GET /api/retrieval/approve/confirm`</span>,
<span dir="ltr">`POST /api/retrieval/approve`</span>. זהו **זוג אישור+nonce שני, מחוץ ל-
<span dir="ltr">`execute.ts`</span>** — ולכן ה"אין מסלול קוד שני" של ה-Composer הוא קביעה על
הפנים של <span dir="ltr">`execute.ts`</span>, לא על השרת. ה-nonce כאן מגיע מ-
<span dir="ltr">`GET /api/retrieval/approve/confirm`</span> ומשום שורה אחרת, קשור למפתח **וגם**
לתקציר של הבתים המבוימים שמחושב מחדש מהדיסק בשני הקצוות, ונשרף בניסיון. ארבע תכונות התיחום שלו,
מההערה של <span dir="ltr">`RULED_WRITES`</span> עצמו: **ביום אינו מסירה** (הרשומה נשארת
<span dir="ltr">`proposed`</span>, ו-<span dir="ltr">`approvedRestore`</span> חייב עדיין לא לענות
דבר אחר כך); **מה שזז הוא <span dir="ltr">`.staging/restore/`</span>**, קובץ JSON אחד בתיקייה
ב-gitignore; **השחקן הוא של המסלול** — <span dir="ltr">`'human'`</span> הוא ליטרל באתר הקריאה
האחד, בלתי נגיש משום שדה בגוף; והאישור מוסמך על ידי אישור שאף אחד אינו יכול להטביע.

שני המודולים נרשמים מ-<span dir="ltr">`startUiServer`</span> ולא מ-
<span dir="ltr">`registerReadRoutes`</span>, וכך הסריקה הזהה-לבית של
<span dir="ltr">`server-e2e.test.ts`</span> על משטח הקריאה נשארת משמעותית: כל מודול *קריאה*
עדיין אינו קושר דבר.

## המסילה: בדיוק 20 מסכים

<span dir="ltr">`src/ui/public/app.js`</span> מגדיר את הניווט במערך אחד,
<span dir="ltr">`NAV`</span>, מקובץ לארבעה סעיפים **לפי זמן** — זו הכרעת עיצוב מכוונת שההערה של
הקובץ עצמו נוקבת בה ("ארבע קבוצות, לפי **זמן**… בסדר של המוקאפ עצמו"):

</div>

<div dir="rtl">

| קבוצה | תווית (`strings/en.js`) | מסכים |
|---|---|---|
| `nav.inj` | *"הזרקה — מה מגיע"* | <span dir="ltr">preview, coverage, simulate, injected</span> |
| `nav.ev`  | *"ראיות — למה כן או למה לא"* | <span dir="ltr">watch, ask, doctor, decay, graph, status</span> |
| `nav.ch`  | *"שינוי — מורכב, לעולם לא מורץ"* | <span dir="ltr">work, capture, palette, config, proc, port, packs</span> |
| `nav.read`| *"קריאה"* | <span dir="ltr">conversations, library, learn</span> |

</div>

<div dir="rtl">

4 + 6 + 7 + 3 = **20**, שזו בדיוק הספירה שהתדריך נוקב בה, וכל אחד מ-20 מזהי המסלול מתפענח
1:1 ל-20 שמות המסכים הנתונים דרך מפתחות <span dir="ltr">`s.<id>`</span> של
<span dir="ltr">`strings/en.js`</span>. **אומת שוב ב-2026-09-16, מול שתי הערות קוד שחולקות על
המערך שמתחתיהן**: <span dir="ltr">`app.js:283`</span> נקרא
<span dir="ltr">`// them. TWENTY-ONE OF TWENTY-ONE.`</span> ו-<span dir="ltr">`app.js:289`</span>
— שש שורות *מתחתיה*, לא מעליה — נקרא
<span dir="ltr">`// FOUR groups, by TENSE, and ALL TWENTY-ONE SCREENS`</span>;
<span dir="ltr">`NAV`</span> עצמו מתחיל ב-<span dir="ltr">`:303`</span>, ארבע־עשרה שורות עוד
יותר למטה. (מעבר קודם על אותו ממצא עצמו החזיק את הסדר היחסי של שתי ההערות הפוך ואת שני המרחקים
שגויים; מתוקן כאן מול הקובץ ישירות.) המערך שמתחת לשתי ההערות עדיין מחזיק בדיוק 20 רשומות
(4+6+7+3, נספרו ישירות למעלה). הספירה של הפרק הזה כבר הייתה נכונה לפני המעבר הזה; המספר המיושן
חי רק בשתי הערות המקור, שמעבר התיעוד הזה לא נגע בהן — תיקונן הוא תיקון קוד בן שורה אחת למי
שיהיה הבעלים הבא של <span dir="ltr">`app.js`</span>, לא שינוי תיעוד.

</div>

<div dir="rtl">

| מזהה | תווית | מודול/ים מאחור |
|---|---|---|
| `preview` | תצוגה מקדימה של ההזרקה | <span dir="ltr">`screens/preview.js`</span> |
| `coverage` | כיסוי היקף | <span dir="ltr">`screens/coverage.js`</span> (ספג את מסך ה-<span dir="ltr">`gaps`</span> שנגנז ב-2026-09-04) |
| `simulate` | סימולטור התקציב | <span dir="ltr">`screens/simulate.js`</span> |
| `injected` | מוזרק עכשיו | <span dir="ltr">`screens/injected.js`</span> |
| `watch` | זרם הביקורת | <span dir="ltr">`screens/watch.js`</span> |
| `ask` | שאל | <span dir="ltr">`screens/ask.js`</span> |
| `doctor` | Doctor | <span dir="ltr">`screens/doctor.js`</span> |
| `decay` | דעיכה | <span dir="ltr">`screens/decay.js`</span> |
| `graph` | יחסים | <span dir="ltr">`screens/graph.js`</span> |
| `status` | מצב | <span dir="ltr">`screens/status.js`</span> |
| `work` | תור הסקירה | <span dir="ltr">`screens/work.js`</span> |
| `capture` | לכידה | <span dir="ltr">`screens/capture.js`</span> |
| `palette` | Composer | <span dir="ltr">`screens/palette.js`</span> |
| `config` | הגדרה | <span dir="ltr">`screens/config.js`</span> |
| `proc` | נהלים | <span dir="ltr">`screens/proc.js`</span> |
| `port` | ייצוא / ייבוא | <span dir="ltr">`screens/port.js`</span> |
| `packs` | חבילות תבנית | <span dir="ltr">`screens/packs.js`</span> |
| `conversations` | שיחות | <span dir="ltr">`screens/conversations.js`</span> |
| `library` | עזרה | <span dir="ltr">`screens/library.js`</span> (מטמיע את <span dir="ltr">`screens/cli-help.js`</span>) |
| `learn` | למידה | <span dir="ltr">`screens/learn.js`</span> |

</div>

<div dir="rtl">

הערה על אי-התאמה שכדאי להיות ישר לגביה: ההערה של <span dir="ltr">`app.js`</span> עצמו מעל מפת
הייבוא <span dir="ltr">`SCREENS`</span> עדיין אומרת *"TWENTY-ONE OF TWENTY-ONE"*, וההערה של
<span dir="ltr">`NAV`</span> מתחתיה עדיין אומרת *"ALL TWENTY-ONE SCREENS"*, מול
<span dir="ltr">`NAV`</span> שמסתכם עכשיו ב-20. **ה-21 מעולם לא היה
<span dir="ltr">`cli-help`</span>.** ב-<span dir="ltr">`e8a8177416d8`</span>, כשההערות ההן
נכתבו, <span dir="ltr">`NAV`</span> באמת מנה 21 מזהים: <span dir="ltr">`nav.inj`</span> נשא
רשומה חמישית, <span dir="ltr">`gaps`</span>, ו-<span dir="ltr">`nav.read`</span> היה
<span dir="ltr">`['docs', 'tut', 'learn']`</span>. שלוש גניזות ומיזוג לקחו את זה ל-20 —
<span dir="ltr">`gaps`</span> נספג לתוך <span dir="ltr">`coverage`</span> ב-2026-09-04,
<span dir="ltr">`docs`</span> ו-<span dir="ltr">`tut`</span> הפכו למסך ה-
<span dir="ltr">`library`</span> היחיד ב-2026-09-05, ו-<span dir="ltr">`conversations`</span>
נוסף — ולכן הספירה בהערה מפגרת במסך אחד, מסיבות שאין להן שום קשר ל-
<span dir="ltr">`cli-help`</span>.

<span dir="ltr">`cli-help`</span> הוא בנפרד *אינו* מסך מסילה, ומעולם לא היה אחד: אין לו רשומה
ב-<span dir="ltr">`NAV`</span> או ב-<span dir="ltr">`SCREENS`</span>, והוא מיובא *בתוך*
<span dir="ltr">`library.js`</span>
(<span dir="ltr">`import { paintCliHelp } from '/screens/cli-help.js'`</span>) כחלונית נושאי שורת
הפקודה של מסך העזרה. ולכן יש 20 מסכי מסילה ניתנים לניווט ועוד מודול אחד בצורת מסך שמקופל לתוך
אחד מהם. שתי העובדות מסומנות כאן ולא מיושבות בשקט; ההערה היא פגם קוד, לא פגם של פרק.

כל מסך מנוי תמיד על המסילה, אפילו אלה עם "שום מודול מאחוריהם" — ההערה על
<span dir="ltr">`NAV`</span> מסבירה למה: *"הסתרת מסך כי התוכן שלו עדיין לא נכתב אומרת לקורא
שהמוצר קטן ממה שהוא."* מסכים לא בנויים היו נושאים תג <span dir="ltr">`PROPOSED`</span> שמחושב
מ-<span dir="ltr">`Object.hasOwn(SCREENS, name)`</span>; כפי שנקרא היום,
<span dir="ltr">`SCREENS`</span> למעשה מגדיר טוען לכל **20** המזהים, ולכן אף אחד לא אמור כרגע
להיות מרונדר כמוצע-אך-חסר — קביעה ששווה לבדוק מחדש מול השרת החי אם זה חשוב, מכיוון שזה אומת
מהמקור בלבד.

### מסך אחר מסך

**תצוגה מקדימה של ההזרקה** (<span dir="ltr">`preview`</span>) — קורא את אותו מסלול בחירה שפרק 2
([<span dir="ltr">`./02-injection.he.md`</span>](./02-injection.he.md)) מתאר: מה באמת היה נמסר
ב-<span dir="ltr">`SessionStart`</span> הבא, בהינתן הקורפוס והתקציבים הנוכחיים. הוא נקוב בהערת
הניתוב של <span dir="ltr">`app.js`</span> עצמו כ*"מסך הנחיתה"* — הדבר הראשון שאדם רואה כשהוא
פותח את ממשק הרשת, כי "מה מגיע" היא העובדה הבודדת נושאת המשקל ביותר על כל המערכת הזו.
*מקרה שימוש:* לפני נעיצת פריט חדש עם <span dir="ltr">`mycontext pin`</span>, בדקו את המסך הזה
כדי לראות אם הוא באמת מרוויח מקום בתוך התקציב הנעוץ או נדחק לשורת כותרת בלבד.

**כיסוי היקף** (<span dir="ltr">`coverage`</span>) — אילו נתיבים/גלובים במאגר באמת מכוסים על ידי
פריט נורמטיבי עם היקף, ואיפה יש פערים. ספג את מסך ה"gaps" הנפרד ב-2026-09-04; קישור עמוק מיושן
<span dir="ltr">`#/gaps`</span> מנותב מחדש לכאן במפורש ב-<span dir="ltr">`route()`</span> של
<span dir="ltr">`app.js`</span>.
*מקרה שימוש:* לאמת שתיקיית מקור חדשה אינה נטולת שליטה בשקט משום אילוץ/תקן.

**סימולטור התקציב** (<span dir="ltr">`simulate`</span>) — מאפשר לאדם לנסות הקצאת תקציב היפותטית
(ראו פרק 2 למפתחות התקציב האמיתיים: <span dir="ltr">`pinned`</span>,
<span dir="ltr">`jit`</span>, <span dir="ltr">`restored`</span>,
<span dir="ltr">`continuity`</span>, <span dir="ltr">`index`</span>) ולראות מה היה נדחק לפני
כתיבה אמיתית של <span dir="ltr">`config.json`</span>. מסלול ה*כתיבה* לסימולציה שהתקבלה עובר דרך
<span dir="ltr">`writeBudgets`</span> של <span dir="ltr">`execute.ts`</span> (ראו "ה-Composer"
למטה) ולא שמסך הסימולציה כותב משהו בעצמו.
*מקרה שימוש:* להחליט אם העלאת התקציב <span dir="ltr">`pinned`</span> בכמות נתונה באמת מצילה את
הפריטים שנדחקים כרגע לשורות כותרת בלבד, לפני הוצאת האסימונים המתאימים בכל סשן עתידי.

**מוזרק עכשיו** (<span dir="ltr">`injected`</span>) — מה *באמת* נמסר באירוע ההזרקה האמיתי האחרון
(תחילת סשן / תחילת תת-סוכן / שחזור), בנבדל מהשחזור ההיפותטי של
<span dir="ltr">`preview`</span> ל"אם זה היה רץ עכשיו".
*מקרה שימוש:* ביקורת של סשן ספציפי בדיעבד כדי לראות בדיוק אילו פריטים הוא קיבל.

**זרם הביקורת** (<span dir="ltr">`watch`</span>) — הזנב החי של יומן הביקורת שרק מוסיפים לו
(<span dir="ltr">`.my_context/.audit/audit.jsonl`</span>, לפי רשומת D4.3 של
<span dir="ltr">`docs/ROADMAP.md`</span>). הכותרת של <span dir="ltr">`routes.ts`</span> עצמו
אומרת שמסלולי זרם קיימים "עבור זרם הביקורת של תוכנית 3" ומוחרגים במפורש מאיפוס מוניטור פסק
הזמן של חוסר הפעילות של ממשק הרשת (זרם פתוח אינו "פעילות"). מגובה על ידי
<span dir="ltr">`watch-model.ts`</span>.
*מקרה שימוש:* לצפות בשינויים (יצירות/עריכות/קידומים/החלפות) ובירי של hooks נוחתים בזמן אמת תוך
כדי עבודה בטרמינל אחר.

**שאל** (<span dir="ltr">`ask`</span>) — מגובה על ידי <span dir="ltr">`ask-model.ts`</span>;
משטח שאילתה מעל הקורפוס (האח מצד הקריאה של כלי ה-MCP <span dir="ltr">`ask_handover`</span>
ומנגנון השליפה בפרק 6, [<span dir="ltr">`./06-retrieval.he.md`</span>](./06-retrieval.he.md)).

**Doctor** (<span dir="ltr">`doctor`</span>) — הרינדור בממשק הרשת של ממצאי הבדיקה העצמית של
<span dir="ltr">`mycontext doctor`</span> (טריות אינדקס, יתומים, סחף, גלובים מתים, הרשאות, מזהי
סשנים — ראו פרק 3, [<span dir="ltr">`./03-creation-and-gates.he.md`</span>](./03-creation-and-gates.he.md)).

**דעיכה** (<span dir="ltr">`decay`</span>) — פריטים שלא הוזרקו ב-N סשנים, מגובה על ידי
<span dir="ltr">`src/core/decay.ts`</span>, אותם נתונים ש-<span dir="ltr">`mycontext decay`</span>
מדפיס בשורת הפקודה.

**יחסים** (<span dir="ltr">`graph`</span>) — הדמיה של גרף ה-<span dir="ltr">`link`</span>/היחסים
בין פריטים (מחליף, מוותר, מתקן וכן הלאה), קורא נתוני חלונית פריט (ראו למטה) בבחירה.

**מצב** (<span dir="ltr">`status`</span>) — ספירות, גודל תור הסקירה, התקדמות בליעה, דעיכה
ובריאות, המראה בממשק הרשת של <span dir="ltr">`mycontext status`</span>.

**תור הסקירה** (<span dir="ltr">`work`</span>) — תור הטיוטות והגרסאות: פריטים שנלכדו על ידי משהו
שאינו אדם (פרק 1, [<span dir="ltr">`./01-items-and-corpus.he.md`</span>](./01-items-and-corpus.he.md))
שממתינים לקידום או לדחייה, ומועמדי כללים מבוימים מהלולאה המשפרת את עצמה (פרק 11,
[<span dir="ltr">`./11-self-improvement-loop.he.md`</span>](./11-self-improvement-loop.he.md)).
לוגיקת תג-הספירה הזהוב של המסילה (<span dir="ltr">`RAIL_COUNTS = ['doctor', 'work']`</span>)
מייחדת את המסך הזה ואת Doctor כשניים שספירת הממתינים שלהם שווה תג על המסילה עצמה.

**לכידה** (<span dir="ltr">`capture`</span>) — מגובה על ידי
<span dir="ltr">`capture-model.ts`</span>; נקודת הכניסה בצד ממשק הרשת לרישום todo/note, אותה
תיבת דואר נכנס ש-<span dir="ltr">`mycontext todo`</span> ו-
<span dir="ltr">`mycontext inbox-promote`</span> פועלות עליה.

**Composer** (<span dir="ltr">`palette`</span>) — ראו את הסעיף שלו למטה; המסך שבו אדם מריץ פקודת
קטלוג אמיתית מהדפדפן. הוא **אינו** המקום היחיד שממשק הרשת ה"קריאה בלבד" גורם לכתיבה: מסך השיחות
כותב עוגנים ומביים שליפות דרך מסלולים שאינם מרכיבים פקודה כלל (ראו "שני משטחי הכתיבה נטולי
הפקודה"), ופקד ה-Copy+Execute ש-<span dir="ltr">`lib/command-actions.js`</span> מספק מיובא על ידי
**שמונה מסכים** — <span dir="ltr">`config`</span>, <span dir="ltr">`conversations`</span>,
<span dir="ltr">`coverage`</span>, <span dir="ltr">`doctor`</span>,
<span dir="ltr">`packs`</span>, <span dir="ltr">`port`</span>, <span dir="ltr">`proc`</span>,
<span dir="ltr">`work`</span> — ועוד <span dir="ltr">`app.js`</span> ו-
<span dir="ltr">`lib/builder.js`</span> (וכך <span dir="ltr">`palette`</span> מגיע אליו; ההערה
של <span dir="ltr">`palette.js`</span> עצמו ב-<span dir="ltr">`:193`</span> רושמת שהוא ייבא את
המודול ישירות עד שהבנאי המשותף לקח את זה). ה-Composer הוא המקום שבו הקטלוג *מעולעל*; הוא אינו
נקודת חנק.

**הגדרה** (<span dir="ltr">`config`</span>) — מגובה על ידי
<span dir="ltr">`read-model-config.ts`</span>; מציג את <span dir="ltr">`config.json`</span> כפי
שהוא עומד (כולל הנפילה חזרה <span dir="ltr">`configError`</span>/"מגיש את התצורה הטובה
האחרונה" שמתוארת בהערת התיעוד של <span dir="ltr">`ApiContext.configError`</span> ב-
<span dir="ltr">`routes.ts`</span>) ומרכיב פקודות כותבות-תקציב דרך אותו מסלול
<span dir="ltr">Composer/execute</span>.

**נהלים** (<span dir="ltr">`proc`</span>) — מחזור החיים של נוהל חד-פעמי
(<span dir="ltr">`activate`/`step`/`done`</span>) שמתואר בפרק 12,
[<span dir="ltr">`./12-packs-export-import-procedures.he.md`</span>](./12-packs-export-import-procedures.he.md);
מגובה על ידי <span dir="ltr">`proc-model.ts`</span>.

**ייצוא / ייבוא** (<span dir="ltr">`port`</span>) — מגובה על ידי
<span dir="ltr">`port-model.ts`</span>; התצוגה בממשק הרשת של
<span dir="ltr">`mycontext export`/`pack import`</span> (פרק 12).

**חבילות תבנית** (<span dir="ltr">`packs`</span>) — מגובה על ידי
<span dir="ltr">`packs-model.ts`</span> ו-<span dir="ltr">`preview-history.ts`</span>; עלעול
ותצוגה מקדימה של חבילות לפני ייבוא (פרק 12).

**שיחות** (<span dir="ltr">`conversations`</span>) — מגובה על ידי
<span dir="ltr">`read-model-conversations.ts`</span> ו-
<span dir="ltr">`read-model-conversation-document.ts`</span>; התצוגה בממשק הרשת של ארכיון השיחות
(פרק 4, [<span dir="ltr">`./04-conversation-archive.he.md`</span>](./04-conversation-archive.he.md)),
דקדוק החיפוש שלו (פרק 14,
[<span dir="ltr">`./14-search-over-the-archive.he.md`</span>](./14-search-over-the-archive.he.md))
והעוגנים (פרק 5, [<span dir="ltr">`./05-anchors.he.md`</span>](./05-anchors.he.md)). פתיחת מסמך
תמליל פותחת את <span dir="ltr">`/lane.html`</span> — דף ייעודי מחוץ למעטפת ה-SPA, לא מסך מסילה —
לקריאת שיחה אחת במלואה; תצוגת המסמך והנתיב ההיא היא המקום שבו משטח החיפוש, **שלוש החלוניות
הצפות** (חיפוש, צעד-אחר-צעד והעתקה — הראשונה נשלחה ב-2026-09-16, השתיים האחרות ב-2026-09-17,
וביניהן הן מחזיקות עכשיו כל פקד שנהג לעמוד ברצועה מעל המסמך), תפריט הלחיצה הימנית המקוצץ ופקדי
הסימנים-בשוליים באמת חיים — ראו פרק 15,
[<span dir="ltr">`./15-document-and-lane-viewer.he.md`</span>](./15-document-and-lane-viewer.he.md),
בשביל כל המשטח ולא שכפולו כאן. **הוא יושב בקבוצת <span dir="ltr">`nav.read`</span> ("קריאה")
ובכל זאת הוא משטח הכתיבה הגדול ביותר של המוצר**: הוא קורא לכל ארבעת המסלולים של
<span dir="ltr">`anchor-write.ts`</span> — <span dir="ltr">`mark`</span> (למשל
<span dir="ltr">`screens/conversations.js:2084`</span>, <span dir="ltr">`:2170`</span>,
<span dir="ltr">`:7172`</span>), <span dir="ltr">`relabel`</span>
(<span dir="ltr">`:2793`</span>, <span dir="ltr">`:7077`</span>),
<span dir="ltr">`drop`</span> (<span dir="ltr">`:1988`</span>) ו-
<span dir="ltr">`sweep`</span> (<span dir="ltr">`:3106`</span>, <span dir="ltr">`:3166`</span>)
— ומניע מחזור ביום/אישור/אשרור של שליפה: בקשת המשימה ב-<span dir="ltr">`:3494`</span>, ההחזרה
שלה ב-<span dir="ltr">`:3667`</span>, הביום ב-<span dir="ltr">`:3797`</span>, ניווט אישור-האשרור
ב-<span dir="ltr">`:3841`</span>, והאשרור עצמו ב-<span dir="ltr">`:3884`</span>. (גרסה מוקדמת
יותר של הפסקה הזו ציטטה עשרה מספרי שורות, שאף אחד מהם לא הצביע על קריאת כתיבה — הקובץ גדל מעבר
ל-11,000 שורות (12,728 ב-2026-09-17, ועדיין עולה) והציטוטים מעולם לא פוענחו מחדש אחרי שחיבור
ערך את הפרוזה שמסביב; כל מספר למעלה נקרא מחדש מול הקובץ ישירות עבור התיקון הזה, וזהו מדגם מייצג
של אתרי קריאה לכל פעולה, לא רשימה ממצה — כמה מהפעולות האלה נקראות מיותר ממקום אחד בקובץ.) תווית
הקבוצה מתארת את הזמן של מה שהמסך *עוסק בו*, לא את הנגישות של כתיבה ממנו.

**עזרה** (<span dir="ltr">`library`</span>) — לפי הכותרת של הקובץ שלו עצמו, זהו במכוון **דף
הקונסולה האחד שמחליף את מה שנהגו להיות מסכי תיעוד ומדריכים נפרדים** (פסיקת בעלים
<span dir="ltr">`DEC-the-documentation-and-tutorials-screens-become-one-list-and`</span>,
2026-09-05, מצוטטת מילה במילה ב-<span dir="ltr">`library.js`</span>: *"One console page replaces
both screens. It lists every document and tutorial BY TITLE, never by file path, with the measured
EN/HE state beside each. Opening one opens a RENDERED page in a new browser tab. The console stops
trying to be a documentation site."*). פסיקה שנייה מאותו יום
(<span dir="ltr">`DEC-the-document-page-wears-github-styling-lists-the-readmes-and`</span>) צמצמה
את ה*רשימה* (לא את המציג) לשני ה-README והמדריכים — "לא 166 מפרטים, תוכניות ודוחות פנימיים" —
בעוד שמציג המסמכים בפועל ב-<span dir="ltr">`/doc.html`</span> עדיין פותח כל אחד מ-**274** קובצי
ה-Markdown המנוטרים (<span dir="ltr">`git ls-files`</span> תחת <span dir="ltr">`docs/`</span>
או <span dir="ltr">`reports/`</span>, ועוד <span dir="ltr">`README.md`</span> — אותה קבוצה ש-
<span dir="ltr">`isServableDocPath`</span>, <span dir="ltr">`src/doctor/checks.ts`</span>, מודה
בה) אם קישור בתוך מסמך מנוי מצביע על אחד. **זה כ-44% יותר מה"כ-190" שהסעיף הזה אמר קודם** —
<span dir="ltr">`reports/`</span> בפרט גדל מדי יום, אז התייחסו ל-274 כקריאה של 2026-09-16 ולא
כקבוע, וצפו שהיא תהיה נמוכה שוב עד שמישהו יספור מחדש. המסך הזה גם מארח את חלונית
<span dir="ltr">`cli-help.js`</span> (<span dir="ltr">`mycontext help <topic>`</span> מרונדר
כקונסולה שניתן לעלעל בה).

**למידה** (<span dir="ltr">`learn`</span>) — מסך סיור מודרך/חניכה, נשמר נבדל מעזרה.

## ה-Composer

<span dir="ltr">`palette`</span> (מתויג "Composer") הוא המסך שהתגית של קבוצת
<span dir="ltr">`nav.ch`</span> עצמה נוקבת בו במדויק: *"שינוי — מורכב, לעולם לא מורץ."* שני קובצי
מקור נושאים את המנגנון בפועל, מפוצלים לפי אחריות:

- **<span dir="ltr">`execute-catalogue.ts`</span>** *מרכיב*. בהינתן מסך וקבוצת ערכים שאדם מילא,
  הוא מתפענח ל-argv מדויק — אותה מחרוזת שאדם היה מקליד במעטפת — ומכריע איזה דיאלוג אישור הפקודה
  ההיא צריכה. ההערה שלו עצמו קובעת שהגבול ממוטמן ממדידה ש-
  <span dir="ltr">`test/ui/palette-lib.test.ts`</span> גוזרת ממפענח הארגומנטים האמיתי, כלומר
  התפיסה של ה-Composer לגבי פקודה תקפה נבדקת מול המפענח בפועל של שורת הפקודה, ולא מתוחזקת ביד
  כעותק שני שלו.
- **<span dir="ltr">`execute.ts`</span>** *מריץ* אותה, דרך בדיוק שני מסלולים:
  - <span dir="ltr">`GET /api/execute/confirm?id=…`</span> — מחזיר מה דיאלוג האישור חייב להציג,
    ועוד nonce.
  - <span dir="ltr">`POST /api/execute`</span> — גוף <span dir="ltr">`{ id, values, nonce }`</span>
    ← הוא באמת מריץ.

הכותרת של הקובץ קובעת את התכונה האחת שכל המודול קיים כדי להגן עליה: **"המחרוזת שאדם קורא באישור
וה-argv שרץ הם אותו דבר."** שני המסלולים עוברים דרך אותו
<span dir="ltr">`resolveCommand`</span>, וה-nonce קושר קריפטוגרפית את הקריאה השנייה בדיוק למה
שהראשונה החזירה — אין מסלול קוד שני בשום מקום במודול שיכול היה להרכיב argv בדרך אחרת. (זו קביעה
על הפנים של <span dir="ltr">`execute.ts`</span>, ורק עליו: זוג אישור+nonce **שני** קיים בשרת,
ב-<span dir="ltr">`retrieval-write.ts`</span>, שקושר את ה-nonce שלו לתקציר של בתים מבוימים ולא
ל-argv. ראו "שני משטחי הכתיבה נטולי הפקודה".) הסדר של מטפל ה-POST עצמו *הוא* סיפור האבטחה,
מפורט בקובץ: בדיקת צורת גוף ← <span dir="ltr">`resolveCommand`</span> ← שריפת ה-nonce (נבדקת מול
ה-argv המפוענח של השרת עצמו, לעולם לא מול שום דבר שהלקוח טוען) ← שורת ביקורת
<span dir="ltr">`execute`</span> נכתבת *לפני* שמשהו רץ (**"הרצה שאי אפשר לרשום אינה קורית"** —
כתיבת ביקורת שנכשלה היא 500 והפקודה לעולם אינה מורצת) ← ההרצה בפועל, דרך
<span dir="ltr">`execFile`</span> עם מערך argv ו**בלי מעטפת מכל סוג** ← שורת ביקורת שנייה,
<span dir="ltr">`execute-done`</span>, מצורפת (לעולם לא מתקנת את הראשונה) עם קוד היציאה האמיתי
ומשך הזמן.

הכותרת של המודול מפורשת שהוא "רושם שום **פלט** בשום מקום" — רק ה-argv (היקף) נשמר, לעולם לא
stdout (תוכן), כי "ה-argv הוא היקף, stdout הוא תוכן, ורק הראשון שייך לקובץ שנוסע בין מכונות."
לפי §6.1/§6.2 של המפרט (מצוטטים בכותרת של הקובץ עצמו): *כל מה שבקטלוג רץ, ואין מתג הרג* —
כלומר זו אינה יכולת חצי-בנויה שנעולה מאחורי דגל; כל פקודה שהקטלוג מונה היא חיה.

מופע קונקרטי אחד: ההצעה שהתקבלה של **סימולטור התקציב** נכתבת ל-
<span dir="ltr">`config.json`</span> דרך המסלול המדויק הזה — <span dir="ltr">`execute.ts`</span>
מייבא את <span dir="ltr">`writeBudgets`/`diffBudgetsAgainstDisk`</span> וקורא ל-
<span dir="ltr">`writeBudgets(root, proposedBudgets)`</span> מתוך מטפל ה-POST, אחרי שה-nonce
נשרף, וההערה של המודול עצמו מדגישה שזה "כל הכתיבה" (אין מסלול כתיבה נפרד לתקציבים).

*מקרה שימוש:* אדם שסוקר את ההצעה של סימולטור התקציב, או פעולת קורפוס מקוטלגת שצפה במסך אחר,
רואה את הפקודה המדויקת שהייתה רצה, מוצג לו אישור מוקלד שמתאים לסיכון של אותה פקודה, ורק אז הוא
מפעיל הרצה בצד השרת, מבוקרת במלואה — בלי לעזוב אי פעם את הדפדפן ובלי לסמוך על מחרוזת שהורכבה
בלקוח.

## חלונית הפריט

חלונית פרטי פריט חוזרת על פני כמה מסכים ולא ייחודית לאחד — הפניות אמיתיות אליה מופיעות ב-
<span dir="ltr">`app.js`</span> עצמו ועוד <span dir="ltr">`screens/conversations.js`</span>,
<span dir="ltr">`screens/graph.js`</span>, <span dir="ltr">`screens/palette.js`</span>,
<span dir="ltr">`screens/preview.js`</span>, <span dir="ltr">`screens/work.js`</span>, וה-
<span dir="ltr">`lib/command-actions.js`</span> המשותף. זהו המשטח המשותף להצגת השדות של פריט אחד
(ראו פרק 1 למה שהשדות האלה אומרים: כותרת, גוף, סיכום, היקף, תגיות, סטטוס, חומרה,
<span dir="ltr">`always`</span>, <span dir="ltr">`continuity`</span>) בכל מקום שבו מסך מאפשר
לאדם לקדוח לתוך פריט ספציפי — משורת דחיקה בתצוגה המקדימה של ההזרקה, מצומת ביחסים, מרשומת תור
בתור הסקירה, או מהתאמה ב"שאל".

## המראה העברית ב-RTL וטבלאות המחרוזות

כל מחרוזת שמופנית למשתמש בממשק הרשת נשלפת לפי מפתח מ-
<span dir="ltr">`src/ui/public/strings/en.js`</span> ומ-
<span dir="ltr">`src/ui/public/strings/he.js`</span>, ולא קבועה קשיח במודולי המסכים.
<span dir="ltr">`grep -c "^\s*'"`</span> מחלץ **1,462 שורות מפתח מכל אחת**, נמדד מחדש
2026-09-16 ישירות מול העץ (שתי הטבלאות עדיין מחזיקות בדיוק אותה ספירה — שקילות מפתחות היא
התכונה ש-<span dir="ltr">`strings-parity.test.ts`</span> אוכף, ראו למטה); הקבצים עצמם הם עכשיו
**2,648** ו-**1,790** שורות, כשרוב ההבדל הוא פרוזת הערות בטבלה האנגלית. (קריאה של 2026-09-13
של 1,314/2,386/1,629 נישאה קדימה ללא שינוי דרך המעבר הזה; שתי הטבלאות גדלו בכ-11% בימים
שבינתיים, וזה עצמו נתון על כמה מהר המשטח הזה זז.) זו מדידה, לא האכיפה.

האכיפה היא טסט נקוב, והוא אינו ב-<span dir="ltr">`scripts/`</span>:
**<span dir="ltr">`test/ui/strings-parity.test.ts`</span>** קיים מאז 2026-08-20 — ה-commit
הראשון שלו מכותרת "…with key-parity test" — והוא קובע שלושה דברים נפרדים. קבוצות מפתחות, **בשני
הכיוונים**: *"טבלאות המחרוזות en ו-he מכריזות על קבוצות מפתחות זהות — בשני הכיוונים"* עושה diff
ל-<span dir="ltr">`enKeys \ heKeys`</span> ול-<span dir="ltr">`heKeys \ enKeys`</span> ודורש
ששניהם יהיו ריקים (<span dir="ltr">`:116–123`</span>). משבצות מונוספייס
(<span dir="ltr">`{m:…}`</span>) תואמות מפתח למפתח (<span dir="ltr">`:195`</span>). משבצות ערך
(<span dir="ltr">`{name}`</span>) תואמות מפתח למפתח (<span dir="ltr">`:215`</span>), כשההערה
רושמת למה השנייה נוספה: <span dir="ltr">`t()`</span> מחליף לפי *שם*, ולכן משבצת ששמה שונה
משאירה <span dir="ltr">`{lines}`</span> מילולי על המסך ואחת שהושמטה מאבדת את המספר שהמשפט עוסק
בו. ארבעה טסטי שקילות אחים חיים באותה תיקייה — <span dir="ltr">`strip-parity`</span>,
<span dir="ltr">`styles-parity`</span>, <span dir="ltr">`duration-parity`</span>,
<span dir="ltr">`zoned-stamp-parity`</span>.

<span dir="ltr">`docs/README.he.md`</span> הוא המראה העברית של ה-README ברמה העליונה של הפרויקט
עצמו, ומקיים את אותה משמעת "שקף, אל תפצל" כמו מחרוזות ממשק הרשת.

## מה **לא** בנוי / בנוי אך כבוי

- **<span dir="ltr">`cli-help`</span> אינו מסך מסילה עצמאי** — הוא מודול שמקופל לתוך מסך העזרה
  (<span dir="ltr">`library`</span>). בנפרד, ההערה "TWENTY-ONE OF TWENTY-ONE" של
  <span dir="ltr">`app.js`</span> מפגרת במסך אחד אחרי ה-<span dir="ltr">`NAV`</span> הנוכחי בן
  20 הרשומות, מהסיבות שהותחקו למעלה (<span dir="ltr">`gaps`</span> נגנז,
  <span dir="ltr">`docs`</span>+<span dir="ltr">`tut`</span> מוזגו,
  <span dir="ltr">`conversations`</span> נוסף). שניהם פגמי קוד חיים, לא עובדות על המוצר.
- הפרק הזה לא הצליח לאמת, בלי להתחבר לשרת החי, אם כל אחת מ-20 רשומות
  <span dir="ltr">`SCREENS`</span> מרנדרת כרגע תוכן אמיתי מול מציין מקום
  <span dir="ltr">`PROPOSED`</span> — הערת המקור שמתארת את לוגיקת התג
  (<span dir="ltr">`Object.hasOwn(SCREENS, name)`</span>) מרמזת שאף אחד לא אמור להיות מוצע-בלבד
  היום מכיוון שלכל 20 המזהים יש טוענים, אבל זה מוסק מהמקור, לא נצפה חי.
- **שום מסלול כתיבה מעבר לשנים־עשר ב-<span dir="ltr">`RULED_WRITES`</span> אינו קיים נכון
  ל-2026-09-13**, ושלושה־עשר אינו יכול להתווסף בשקט: הקביעה היא שוויון קבוצות, ולכן קישור שלא
  נפסק מכשיל את הבנייה וכך גם הסרה שהרשימה לא נאמר לה עליה. מה שזה *אינו* אומר הוא ששנים־עשר
  זה קטן — ראו את הספירה ואת שני המשטחים נטולי הפקודה למעלה.
- **הפרק הזה אינו מכסה את רוב משטח ה-HTTP.** <span dir="ltr">`src/ui/`</span> רושם **77 מסלולים**
  (<span dir="ltr">`grep -c 'registerRoute(' src/ui/*.ts`</span>, נספר מחדש 2026-09-16 — הוא היה
  76 ב-2026-09-13). ה-<span dir="ltr">`docs/cli-ui-coverage.md`</span> המיוצר קובע בנפרד **67
  מסלולי קריאה רשומים בממשק הרשת** — נתון שונה וצר יותר מכלי אחר
  (<span dir="ltr">`scripts/gen-cli-ui-coverage.ts`</span>), והפרק הזה לא אימת אילו תריסר מסלולים
  בדיוק מסבירים את הפער; התייחסו לשתי הספירות כמודדות דברים קשורים אך לא זהים ולא תניחו שאחת
  מהן מחליפה את השנייה. הפרק הזה נוקב בשישה־עשר נתיבים נבדלים. משפחות לא מכוסות כוללות את כל
  קבוצת זרם ה-SSE <span dir="ltr">`/api/watch/*`</span>, <span dir="ltr">`/api/ask/*`</span>,
  <span dir="ltr">`/api/render`</span>, <span dir="ltr">`/api/glob`</span>,
  <span dir="ltr">`/api/overlap`</span>, <span dir="ltr">`/api/command/check`</span>,
  <span dir="ltr">`/api/config/{check,preview}`</span> ו-<span dir="ltr">`/api/handoff`</span>.
- **מודולים לא מכוסים**, נקובים כאן כדי שקורא יידע שהם קיימים ולא יסיק שלא:
  <span dir="ltr">`git-info.ts`</span>, <span dir="ltr">`idle.ts`</span>,
  <span dir="ltr">`zoned-day.ts`</span>, <span dir="ltr">`execute-nonce.ts`</span>,
  <span dir="ltr">`maintenance/`</span>,
  <span dir="ltr">`read-model-{flags,cli-help,work,staging,retrieval}.ts`</span>; ספריות הלקוח
  תחת <span dir="ltr">`lib/`</span> (<span dir="ltr">`sse`</span>,
  <span dir="ltr">`heartbeat`</span>, <span dir="ltr">`live-invalidation`</span>,
  <span dir="ltr">`disclosure`</span>, <span dir="ltr">`pane-resize`</span>,
  <span dir="ltr">`sanitize`</span>, <span dir="ltr">`highlight`</span>,
  <span dir="ltr">`markdown`</span>, <span dir="ltr">`diagrams`</span>,
  <span dir="ltr">`wa-tree`</span>, <span dir="ltr">`palette-defs`</span>,
  <span dir="ltr">`builder`</span>); <span dir="ltr">`screens/parts.js`</span>, מודול מסגרת
  המסך המשותף שכל מסך מייבא; ושני הדפים שאינם SPA
  <span dir="ltr">`tree-proof.html`</span> ו-<span dir="ltr">`doc.html`</span>.
- **מנגנון השיקוף ל-RTL עצמו אינו מתואר כאן** — רק שקילות מפתחות.
  <span dir="ltr">`lib/i18n.js`</span>, <span dir="ltr">`translate()`</span>, מקטעי ה-
  <span dir="ltr">`.m`</span> / <span dir="ltr">`unicode-bidi: isolate`</span> ומשבצות הערך
  המונוספייס <span dir="ltr">`{mv:…}`</span> הם מה שגורם למסך עברי לרנדר מזהה לטיני נכון, והם
  פער בפרק הזה ולא פער במוצר.
- **אתחול האסימון/ה-nonce ואורך החיים של ה-<span dir="ltr">`sessionStorage`</span> שלו**
  (<span dir="ltr">`app.js:310–340`</span>) ומשמעת ה-CSP
  <span dir="ltr">`style-src 'self'`</span> / ללא-<span dir="ltr">`innerHTML`</span> שמעצבת כל
  בנאי DOM — שניהם אינם מתוארים כאן.
- **<span dir="ltr">`clearUiServerRecord`</span> מקבל זהות, וזה חשוב לכל מי שמנתח את כתיבת רשומת
  השרת.** מאז <span dir="ltr">`fe4086c1`</span> החתימה היא
  <span dir="ltr">`clearUiServerRecord(owner: UiServerIdentity, globalRoot?): ClearOutcome`</span>
  (<span dir="ltr">`src/core/ui-server-record.ts:343–357`</span>): הוא קורא מחדש את הרשומה
  ומחזיר <span dir="ltr">`'names-another-server'`</span> אלא אם **גם**
  <span dir="ltr">`pid`</span> **וגם** <span dir="ltr">`port`</span> תואמים — הצירוף מכוון,
  מכיוון ש"<span dir="ltr">`pid`</span> לבדו מובס על ידי מיחזור,
  <span dir="ltr">`port`</span> לבדו על ידי מכונה שעושה שימוש חוזר בפורט". שרת שנסגר אינו יכול
  לכן יותר למחוק את הרשומה של *מחליף*. הפונקציה לעולם אינה זורקת; קובץ שאינו ניתן להסרה עונה
  <span dir="ltr">`'no-record'`</span>.

## ראו גם

- [אינדקס](./00-index.he.md)
- [הזרקה](./02-injection.he.md) — מה מסכי התצוגה המקדימה של ההזרקה/מוזרק עכשיו באמת מציגים
- [עוגנים](./05-anchors.he.md) — מנגנון המקוריות של מסך השיחות
- [חיפוש מעל הארכיון](./14-search-over-the-archive.he.md) — הדקדוק מאחורי תיבת החיפוש של מסך
  השיחות
- [מציג המסמכים והנתיבים](./15-document-and-lane-viewer.he.md) — משטח החיפוש, שלוש החלוניות
  הצפות, תפריט הלחיצה הימנית והסימנים-בשוליים, שאף אחד מהם אינו מתואר בפרק הזה
- [שורת הפקודה ושרת ה-MCP](./09-cli-and-mcp.he.md) — הפקודות שה-Composer בסופו של דבר מרכיב
  ומריץ

</div>
