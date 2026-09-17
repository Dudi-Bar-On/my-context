<!--
  Hebrew mirror of `docs/capabilities/13-testing-discipline.md`. The English
  file is the source. Conventions: `docs/README.he.md` and
  `docs/the-store.he.md` — Hebrew prose and tables inside `<div dir="rtl">`,
  fenced blocks outside it, `<span dir="ltr">` around any Latin run whose edge
  characters are not both alphanumeric, around any run of two or more Latin
  terms joined by commas or slashes, and — per
  `KNOWN-the-hebrew-convention-says-an-identifier-with-alphanumeric` — around
  any code span that begins with a digit and contains a hyphen.

  Every pasted block is byte-identical to the English file, including the
  `check:diagrams` capture whose own `[… 4 further lines are not shown …]`
  marker is the English chapter's marker, character for character, and the
  `check-basis` tail whose "nothing cut" claim is the English chapter's claim.
  The dated readings inside them (`39 fence(s) across 21 of 27 document(s)`,
  `1452 text file(s)`, `923 work item(s)`) are the English readings and are
  NOT re-measured for this mirror.

  Terminology follows `docs/the-store.he.md`: הוכחה בהסרה, אדום ידוע, נתיב.

  Heading sequence must stay identical to the English file.
-->

# 13 · משמעת הבדיקות

<div dir="rtl">

הפרויקט הזה מתייחס לצורה של סוויטת הטסטים של עצמו כדבר שנשלט, ולא כמחשבה שלאחר מעשה שסוקר בוחן
בעין. הכללים של הסוויטה עצמה — מה טסט חייב להצהיר, איך מוכיחים ששומר חשוב, איך מתקנים נמנעים
מלגעת במצב אמיתי — נאכפים על ידי אותה מכונת קורפוס/שער/בודק שמתועדת ב-
[03 · יצירה והשערים](./03-creation-and-gates.he.md) ומצוטטת לפי מזהה פריט באותה דרך שכל דבר אחר
בבסיס הקוד הזה מצוטט, לפי
<span dir="ltr">`RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number`</span>. כל
קביעה למטה מעוגנת בקובץ שהמעבר הזה באמת קרא, או בפקודה שהוא באמת הריץ (פלט מודבק מילה במילה
ומתוארך — 2026-09-12 במקור, כשאלה שנספרו הורצו מחדש ב-2026-09-13 ותוארכו מחדש במקומן). הפרק הזה
**לא** הריץ <span dir="ltr">`npm test`</span>, <span dir="ltr">`npm run test:e2e`</span>, או
<span dir="ltr">`npm run mutate`</span> — אלה מוחרגים על ידי האילוצים שכל מאמץ התיעוד הזה עובד
תחתיהם. מה שבא מגיע מקריאת <span dir="ltr">`test/`</span>, <span dir="ltr">`scripts/`</span> ו-
<span dir="ltr">`docs/mutation-testing.md`</span>, ועוד הרצת קומץ סקריפטי
<span dir="ltr">`check:*`</span> שהם בודקים טהורים לקריאה בלבד בעיצובם שלהם.

## למה זה מתועד כיכולת

שלושה אירועים אמיתיים חוזרים בהערות המקור שנקראו עבור הפרק הזה, וכל אחד ייצר אחד מהמנגנונים
למטה:

- סוויטה ירוקה שהריצה בשקט 2 מתוך 4 קובצי טסט, כי גלוב לא מצוטט פורש מחדש על ידי מעטפת מערכת
  ההפעלה (<span dir="ltr">`RULE-quote-the-test-glob`</span>) ← השער
  <span dir="ltr">`check:test-glob`</span>.
- 26 מתקנים על פני עשרה קבצים שהאדימו כשכלל קבלה הופך, ו**אף אחד** לא נקב בכלל שהוא נשען עליו —
  מקודדים כמחרוזות זהב ומספרים חשופים במקום (commit <span dir="ltr">`cdc9fd8`</span>,
  <span dir="ltr">`budget/16`</span>) ←
  <span dir="ltr">`RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none`</span>
  והצהרת ה-<span dir="ltr">`@basis`</span> ועוד השער <span dir="ltr">`check:basis`</span>.
- אותה סוויטה שמרנדרת גבולות ציור-תיבות מקומית ו-ASCII ב-CI, כי פונקציית רינדור קראה משתני
  טרמינל סביבתיים שהמעטפת של מפתח מייצאת ומריץ ה-CI לא (הרצה
  <span dir="ltr">`31964855211`</span>) ← נעיצת הרינדור ב-
  <span dir="ltr">`test/helpers/pin-rendering.ts`</span>.

החוט המשותף, כפי שנאמר בכותרת של <span dir="ltr">`scripts/check-test-glob.ts`</span> עצמו:
כישלון בצורה הזו בלתי נראה מעצם הבנייה — שום דבר בפלט אינו אומר על מה דולג או מה הונח בשקט, כי
מנקודת המבט של המריץ זה מעולם לא נשאל. כל מנגנון למטה קיים כדי להפוך אחד ממצבי הכישלון האלה
לנראה במקום שקט, וזו אותה אינטואיציה של "שום דבר אינו מושמט בשקט" ששולטת בקורפוס עצמו
(<span dir="ltr">`INV-nothing-is-dropped-silently`</span>).

## נעיצת הרינדור, ולמה <span dir="ltr">`node --test`</span> לבדו יכול לשקר

<span dir="ltr">`test/helpers/pin-rendering.ts`</span> נטען דרך <span dir="ltr">`--import`</span>
בסקריפט <span dir="ltr">`test`</span>
(<span dir="ltr">`package.json`</span>:
<span dir="ltr">`"test": "node --import ./test/helpers/pin-rendering.ts --test \"test/**/*.test.ts\""`</span>).
המריץ <span dir="ltr">`--test`</span> של Node משגר כל קובץ טסט עם אותן אפשרויות שורת פקודה, ולכן
הייבוא הזה רץ לפני שקוד טסט כלשהו רץ, בכל תהליך.

מה הוא נועץ, נקרא מהקובץ עצמו:

</div>

```ts
process.env.MYCONTEXT_ASCII = '1';
delete process.env.MYCONTEXT_UNICODE;
delete process.env.MYCONTEXT_WIDTH;
installRealHomeGuard();
```

<div dir="rtl">

- **רינדור ASCII, נכפה.** <span dir="ltr">`supportsUnicode()`</span>
  (<span dir="ltr">`src/cli/commands/format.ts`</span>) קורא את
  <span dir="ltr">`WT_SESSION`</span>, <span dir="ltr">`TERM_PROGRAM`</span>,
  <span dir="ltr">`TERM`</span> — מעטפת אינטראקטיבית של מפתח מייצאת אותם, המריץ החשוף של CI לא —
  ולכן *אותה* טבלה רינדרה גבולות ציור-תיבות על מחשב נייד ותווי <span dir="ltr">`|`</span> ב-CI.
  טסט שקבע ביטוי מדויק מול הבתים ההם היה ירוק בכל מקום שאדם יכול היה להריץ אותו אינטראקטיבית
  ואדום במכונה האחת שאף אחד לא צופה בה. ASCII נבחר (ולא Unicode) כי זה מה ש-CI כבר ענה, ולכן
  הנעיצה אינה משנה דבר היכן שהסוויטה חייבת להישאר ירוקה, והוא רינדור הנפילה-חזרה — זה שהנחה שגויה
  צריכה להיבדק מולו.
- **<span dir="ltr">`MYCONTEXT_WIDTH`</span> נמחק** מאותה סיבה: רוחב פריסה שמתחזק ייצא לטרמינל
  שלו עצמו אסור לו לעצב מחדש את הפלט הצפוי של הסוויטה.
- **מאגר סשנים נעוץ של ממשק הרשת**, דרך <span dir="ltr">`import './pin-sessions-dir.ts'`</span>
  בראש הקובץ (ESM מעריך ייבואים לפני כל הצהרה בקובץ המייבא, ולכן המאגר מנותב מחדש לפני ששומר
  הבית למטה מצלם את הבית האמיתי). שלושה קובצי טסט של ממשק הרשת הגיעו ל-
  <span dir="ltr">`~/.my-context`</span> האמיתי של המפתח לפני שזה היה קיים.
- **<span dir="ltr">`installRealHomeGuard()`</span>** הופך את "אל תכתבו מחוץ לארגז החול" ממוסכמה
  שכותב טסט צריך לזכור לבדיקה: הוא מצלם את תיקיית הבית הגלובלית האמיתית *לפני* שקוד ברמה העליונה
  של קובץ טסט כלשהו יכול לנתב מחדש את <span dir="ltr">`HOME`</span>, ומכשיל את ההרצה אם התיקייה
  ההיא השתנתה — בהשוואת התיקייה עצמה, ולא ביירוט <span dir="ltr">`fs`</span>, ולכן גם כתיבה
  מתהליך ילד משוגר נתפסת. הוא קיים כי המוסכמה לבדה נכשלה פעמיים: 134 טסטים האדימו ב-2026-08-22
  משני קובצי מתקן תועים, ודליפת מאגר הסשנים (למעלה) כמעט חזרה על זה למחרת.

**למה <span dir="ltr">`node --test test/foo.test.ts`</span> חשוף יכול לדווח ירוק שקרי** (או אדום
שקרי): הוא לעולם אינו טוען את ה-<span dir="ltr">`--import`</span> הזה, ולכן נעיצת ה-ASCII, ניתוב
הסשנים ושומר הבית האמיתי כולם נעדרים. טסט שהציפיות שלו תלויות במשתמע באחד מהשלושה יכול לעבור
מקומית תחת המסגרת ולהיכשל — או גרוע מזה, לעבור בשקט עם הנחות שגויות בלי שמירה — בהרצה חשופה. זהו
זיכרון הפרויקט העומד שמשימת התיעוד הזו עצמה תודרכה איתו: הריצו טסטים בודדים עם הטעינה המקדימה
של הסוויטה עצמה, ולא <span dir="ltr">`node --test`</span> חשוף.

**מקרה שימוש.** ניפוי טסט כושל אחד: הושיטו יד ל-
<span dir="ltr">`node --import ./test/helpers/pin-rendering.ts --test test/cli/status.test.ts`</span>,
ולא ל-<span dir="ltr">`node --test test/cli/status.test.ts`</span> — האחרון אינו אותה סביבה
שההרצה ששומרת על ה-CI משתמשת בה.

## הוכחות בהסרה, דרך בדיקת מוטציות (<span dir="ltr">`scripts/mutate.ts`</span>)

<span dir="ltr">`docs/mutation-testing.md`</span> קובע את הכלל שהפרויקט הזה מחזיק את עצמו אליו
בשורת הפתיחה שלו: **"כל שינוי כאן צריך טסט שנכשל בלעדיו."** הדרך שזה נבדק היא בדיקת מוטציות —
לשבור את השומר בכוונה, להריץ את הטסט שאמור להבחין, להחזיר את הקובץ — והמסמך מפורש שזה חייב
להיעשות דרך הכלי, לעולם לא ביד: <span dir="ltr">`git checkout -- <file>`</span> משחזר נתיב
מהאינדקס ואינו יכול להבחין בין מוטנט לבין תיקון לא-מחויב שחי באותו קובץ, וזה עלה לפרויקט הזה
עבודה אמיתית: **"שבע בריחות לפי הספירה של הפרויקט הזה עצמו: שלושה סוכנים איבדו עבודה כך — אחד
מהם מעבר מלא של עריכות README, שעלה משימה שלמה — ופעמיים בדיקה הורצה מול הקורפוס של המאגר הזה
עצמו תחת <span dir="ltr">`.my_context/`</span>."**

**איך משתמשים בזה** (לא הורץ במעבר הזה — הוא משנה קובץ מקור, אף שהוא משחזר אותו):

</div>

```
npm run mutate -- --file src/core/select.ts --from "seen.has(id)" --to "false" \
  -- node --test test/core/select.test.ts
```

<div dir="rtl">

קוד היציאה *הוא* הפסק, ולכן הוא מתחבר ל-CI:

</div>

<div dir="rtl">

| יציאה | משמעות |
|---|---|
| `0` | **נהרג** — הפקודה נכשלה כשהשומר שבור. מה שרציתם. |
| `1` | **שרד** — הפקודה עברה בכל זאת. שום דבר אינו בודק את השורה הזו. |
| `2` | סירב לפני שינוי; הארגומנטים היו שגויים. |
| `3` | שונה, והעץ לא הצליח להשתחזר — <span dir="ltr">`--restore`</span> מנסה שוב. |
| `4` | **לא מכריע** — לא נוצר פסק (קרס בהתחלה, או נהרג באות); הריצו מחדש, אל תסמכו על זה. |

</div>

<div dir="rtl">

**למה הוא מסרב, במדויק**, לפי המסמך: עץ עם שינוי מנוטר כלשהו (עשו commit קודם — קבצים לא מנוטרים
בסדר, מכיוון ששום דבר כאן אינו כותב לנתיב שלא ניתן לו, אבל *יעד* לא מנוטר נדחה כי לא היו בתים
מחויבים מאחוריו); כל דבר תחת <span dir="ltr">`.my_context/`</span> או
<span dir="ltr">`.git/`</span> (שנו סביבת עבודה זמנית במקום —
<span dir="ltr">`runCli(['init'], mkdtempSync(...))`</span> היא איך כל הסוויטה עושה את זה);
<span dir="ltr">`--from`</span> שחסר או מופיע יותר מפעם אחת בלי
<span dir="ltr">`--all`</span>; מוטציה בלי פקודה או להפך; והרצה שהתחילה בזמן שמוטציה קודמת עדיין
רשומה ביומן כפעילה.

**איך הוא משחזר**: הבתים המקוריים מוחזקים בזיכרון *וגם* נרשמים ביומן ל-
<span dir="ltr">`<git-dir>/mycontext-mutation.json`</span> לפני שקובץ אחד נכתב; השחזור כותב מחדש
את הבתים ההם ואז מאמת עם <span dir="ltr">`git status`</span> שהנתיבים הנקובים חזרו נקיים, ונופל
חזרה ל-<span dir="ltr">`git checkout <HEAD> -- <path>`</span> רק אחרי שהאימות ההוא כבר נכשל, ורק
מול נתיבים שההרצה עצמה נגעה בהם. <span dir="ltr">`SIGINT`/`SIGTERM`/`SIGHUP`</span> משחזרים לפני
יציאה; הרג קשיח יותר משאיר את היומן מאחור, ניתן לשחזור עם
<span dir="ltr">`npm run mutate -- --status`</span> / <span dir="ltr">`--restore`</span>.

**מה הוא אינו עושה**: הוא אינו מכניס לארגז חול את הפקודה שאתם מעבירים — "פקודה שכותבת לעץ שלכם
עדיין כותבת לעץ שלכם."

**מקרה שימוש**: להוכיח ששומר חדש באמת שומר על משהו, כחלק מסקירת קוד — הדוגמה רבת-הקבצים של המסמך
עצמו קובעת שמחרוזת אנגלית אחת ומחרוזת עברית אחת חייבות להישבר יחד
(<span dir="ltr">`README.md`</span> / <span dir="ltr">`docs/README.he.md`</span>), כי קביעה
שנעשית בשני מקומות צריכה ששני העותקים יישברו באותה הרצה אחרת העותק ששרד שומר על הסוויטה ירוקה.

## הצהרות <span dir="ltr">`@basis`</span>, והשער <span dir="ltr">`check:basis`</span>

**מה זו הצהרה.** הערה בת שורה אחת בראש הכותרת של קובץ טסט:

</div>

```ts
// @basis TASK-lesson-accept-creates-a-rule-with-no-summary-so-the-accept, STD-a-summary-is-one-plain-sentence-for-someone-who-does-not, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
```

<div dir="rtl">

(שורה אמיתית, <span dir="ltr">`test/cli/lesson-accept-summary.test.ts:1`</span>) — או, כשטסט
נשען על שום דבר בקורפוס:

</div>

```ts
// @basis none - pure parser mechanics
```

<div dir="rtl">

**למה זה קיים**, לפי הכותרת של <span dir="ltr">`scripts/check-basis.ts`</span> עצמו, שנוקבת
בעלות המדודה המדויקת: <span dir="ltr">`budget/16`</span> הפך כלל קבלה אחד והאדים 26 מתקנים על
פני עשרה קבצים. **אף אחד לא היה כישלון לוגי** — כל אחד קבע היעדר שהכלל ההפוך הפך לנכון —
ו**אפס** נקבו בכלל שהם נשענו עליו. הם קידדו אותו במקום: מחרוזת זהב,
<span dir="ltr">`pinned: 1500`</span> חשוף, פריט שכותרתו "Only an index line", הערת עוזר בלי מזהה
בתוכה. שום דבר לא יכול היה לחפש את מה שלא נרשם, והקריאה לקחה שעה כדי לקבוע שאף אחד מ-26 לא היה
כישלון אמיתי. גרוע מזה: מתוך אותם 26, בדיוק *אחד* ציטט פריט, והוא ציטט את ה**שגוי** — כלל שעדיין
בתוקף, בעוד שהקביעה למעשה נשענה על הכלל שהופך. זה היה המתקן המסוכן ביותר בקבוצה, כי הוא *נראה*
מכוסה.

**למה <span dir="ltr">`none`</span> הוא תשובה חוקית, במכוון**: השער דורש את המחשבה, לעולם לא
קישור. אילו נקיבה בפריט הייתה חובה, כותב תחת לחץ מועד היה נוקב בקרוב הסביר ביותר — גרוע באופן
מדיד מלהודות שאין פסיקה מאחורי הטסט הזה. <span dir="ltr">`none`</span> חשוף עדיין נכשל, אמנם:
הסיבה חייבת לעבור רצפה של 3 מילים / 12 תווים, שנקבעה בדיוק כך שהדוגמה המעובדת של הכלל עצמו
(<span dir="ltr">`none - pure parser mechanics`</span>, 21 תווים) עוברת ושום דבר קצר יותר לא
(<span dir="ltr">`n/a`</span>, <span dir="ltr">`none`</span>, <span dir="ltr">`todo`</span>,
<span dir="ltr">`-`</span> כולם נדחים). השער אינו שופט אם הסיבה *טובה* — רק שנכתבה אחת.

**מה שומר לעומת מה שרק מדווח** — ארבע שכבות, נקראות מ-<span dir="ltr">`check-basis.ts`</span>:
<span dir="ltr">`MISSING`</span> (אין שורת <span dir="ltr">`@basis`</span>, מחוץ לבסיס הפטור) ו-
<span dir="ltr">`MALFORMED`</span> (הצהרה נוכחת אך שבורה — שני סמנים, מטען ריק, אסימון בצורת
מזהה שמתפענח לכלום) שניהם קובעים את קוד היציאה. <span dir="ltr">`DANGLING`</span> (מזהה שאינו
עונה לשום פריט קורפוס) שומר גם הוא. <span dir="ltr">`RETIRED`</span> (מזהה שמתפענח, אבל לפריט
שהוחלף) **רק מדווח** — ההערה של הקובץ עצמו מסבירה למה: "טסט שנשען על פסיקה שהוחלפה הוא לעיתים
קרובות בדיוק נכון כהיסטוריה", אותו נימוק ש-<span dir="ltr">`check-cited-items.ts`</span> משתמש בו
עבור הצורה הזהה שכבה אחת מעל, אחרי פסיקת בעלים ששער שהיה כופה 31 עריכות היה מוחק היסטוריה רק כדי
להיות ירוק.

**בסיס הפטור** (<span dir="ltr">`scripts/basis-undeclared.txt`</span>): 490 קובצי טסט היו קיימים
כשהכלל נחת ושישה כבר הצהירו על בסיס. שמירה על 484 האחרים הייתה מייצרת בדיוק את ההצהרות המומצאות
שהכלל קיים כדי למנוע — כותב שנשאל היום על מה מתקן שנכתב לפני חודשים נשען ינחש. ולכן הבסיס מונה
אותם כפטורים, והפטור הוא *רק* לשתיקה: תשעה מאותם 484 הוסבו בכל זאת (אלה שה-commit
<span dir="ltr">`cdc9fd8`</span> עצמו היה צריך לתקן, ולכן הצהרתם הייתה קריאה, לא ניחוש) והבסיס
רשאי רק להתכווץ — נאכף בשתי דרכים: <span dir="ltr">`test/scripts/basis-gate.test.ts`</span> נועץ
את אורכו כתקרה, ולכן קובץ חדש שמוברח לרשימת הפטור מכשיל את <span dir="ltr">`npm test`</span>,
והסרת שורה קורית אוטומטית ברגע שמישהו מצהיר על הבסיס של קובץ ישן.

**מה הוא אינו יכול לראות, נאמר בכותרת שלו עצמו כדי שהמספר לא ייקרא רחב יותר ממה שהוא**: הצהרה
אומרת מה טסט *מאמת*, לעולם לא מה הוא *מניח* — וזה החצי המונח שגרם לכישלון 26 המתקנים המקורי.
שניים מאותם מתקנים חיים ב-<span dir="ltr">`README.md`</span> וב-
<span dir="ltr">`docs/README.he.md`</span>, שאינם נושאים תחביר הערות ולעולם אינם יכולים להצהיר
דבר.

**פלט אמיתי, הורץ מחדש 2026-09-17** — <span dir="ltr">`node scripts/check-basis.ts`</span> הופנה
לקובץ, וזהו הזנב שלו משורת הסיכום ומטה, בשלמותו. ההרצה היא 142 שורות בסך הכול; 132 השורות מעל
הקטע הזה הן ממצאי ה-<span dir="ltr">`RETIRED`</span> הפר-הצהרתיים, שאחד מהם מצוטט ישירות למטה.
כל מספר כאן זז עם כל קובץ טסט שנוסף: 2026-09-12 קרא
<span dir="ltr">`150 of 611 … 138 distinct … 461 predate`</span>, 2026-09-13 קרא
<span dir="ltr">`162 of 622 … 157 distinct … 460 predate`</span>, וההדבקה של 2026-09-13 שעמדה כאן
קיצצה את השורה האחרונה של עצמה באמצע רשימה עם <span dir="ltr">`...`</span> מוקלד ולא אמרה דבר על
כך.

</div>

```
$ node scripts/check-basis.ts     # 2026-09-17, tail from the summary line down, nothing cut
238 of 691 test file(s) declare a basis: 238 name item(s), 0 say `none` with a reason · 241 distinct item(s) are named
453 predate the rule and are exempt via scripts/basis-undeclared.txt; 0 do not and are gated.
no test file outside the baseline is missing a basis or malformed.
11 declaration(s) name a RETIRED item. Reported, never gated — the successors are printed above.
scripts/basis-undeclared.txt: 0 entr(ies) name a file that no longer exists and 1 name a file that now declares a basis. Both are spent lines and deleting them is the whole repair.
12 helper module(s) under test/ and e2e/ declare a basis although nothing gates them: e2e/app.ts, e2e/composer-run.ts, e2e/composer.ts, e2e/global-setup.ts, e2e/mockup.ts, e2e/pixel-diff.ts, e2e/reduce.ts, e2e/scratch-corpus.ts, e2e/seed-agent-write.ts, e2e/seeds.ts, e2e/throwaway-home.ts, test/helpers/fabricate.ts.

--undeclared lists the 453 exempt file(s). Nobody is asked to fill them in: an author asked today what a fixture written months ago rested on will guess, and a guess that resolves is worse than silence — see RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none.

BLIND SPOT, stated so this number is not read wider than it is: a declaration says what a test VERIFIES, never what it ASSUMES — and it was the assumed half that reddened 26 fixtures in cdc9fd8. Two of those fixtures live in README.md and docs/README.he.md, which carry no comment syntax and can never declare anything.
```

<div dir="rtl">

הראשון מבין אחד־עשר ממצאי ה-<span dir="ltr">`RETIRED`</span> מאותה הרצה, בשלמותו — כל האחד־עשר
נוקבים באותה שאלה שהוחלפה, וההדבקה הקודמת של הרישום הזה קיצצה את השורה השנייה שלו עם
<span dir="ltr">`...`</span> מוקלד והשמיטה את ארבע השורות הסוגרות שאומרות מה היה הופך את הדוח
לשער:

</div>

```
RETIRED test/core/audit-tokens.test.ts:1
        `OPENQ-does-the-pinned-tier-spend-its-spare-room-on-governing-items` is superseded — does the pinned tier spend its spare room on governing items, at the price of forty-nine fixtures
        wrote: @basis TASK-the-pinned-tier-sits-half-empty-while-sixty-nine-governing, OPENQ-does-the-pinned-tier-spend-its-spare-room-on-governing-items
        superseded by TASK-the-pinned-tier-sits-half-empty-while-sixty-nine-governing
        REPORTED, NEVER GATED. A test resting on a superseded ruling is often
        correct as history. The repair is to say so where the reader is.
        WHAT WOULD MAKE IT A GATE: a committed ceiling on this count, gated on
        INCREASE only. It is not taken yet because the same owner ruling covers
        this tier as covers `check-cited-items.ts` — forcing the edits would
        delete history to go green — and a ratchet is a second baseline to keep,
        which this file already argues against for `basis-undeclared.txt`.
```

<div dir="rtl">

**מקרה שימוש**: סקירת PR שהופך פסיקה — <span dir="ltr">`check-basis.ts --items`</span> מריץ את
השאילתה ה*הפוכה* (אילו טסטים מצהירים על פריט נתון) כך שהסוקר יכול לראות, לפני מיזוג, בדיוק אילו
מתקנים עומדים להצריך מבט שני, במקום לגלות את זה שעה אחר כך בדרך ש-
<span dir="ltr">`budget/16`</span> גילה.

## תאומים חד-פעמיים עם זרע

הדפוס, אומת ב-grep על <span dir="ltr">`test/`</span> לאיתור "throwaway"/"twin" (עשרות פגיעות):
טסט שצריך קורפוס, תיקיית בית, או סביבת עבודה בונה כזו **חד-פעמית** תחת תיקיית הזמניים של מערכת
ההפעלה ולא נוגע ב-<span dir="ltr">`.my_context/`</span> האמיתי או ב-
<span dir="ltr">`~`</span> האמיתי של המפתח, ואז משליך אותה. הערות אמיתיות מייצגות:

</div>

```ts
// test/cli/inbox-promote.test.ts:45
/** A throwaway project, disposed by the caller. */

// test/cli/ready.test.ts:49
/** A throwaway project that declares a work-planning category. Disposed by the caller. */

// test/core/anchor-durability.test.ts:88
/** A throwaway `~/.claude`, so nothing here reads the developer's own. */

// test/core/config-field-write.test.ts:5
* fs functions against a throwaway `corpusDir` holding nothing but ...
```

<div dir="rtl">

"תאום" נוקב ספציפית בטסט *מזווג* ששונה מהאח שלו בדיוק בקלט אחד, כדי לבודד מה ההבדל מוכיח — הערה
אמיתית, <span dir="ltr">`test/cli/inbox-promote.test.ts:153`</span>: *"התאום של הטסט למעלה,
שונה בדיוק בקלט אחד. בלעדיו, …"* — משמעת של הוכחה בהסרה שמיושמת ביד ברמת קלט בודד ולא בהרצת כלי
המוטציות.

**למה זה קיים**: זה אותו מצב כישלון של שומר הבית האמיתי שסעיף נעיצת הרינדור למעלה מתאר, מיושם על
מתקני *קורפוס* ולא על <span dir="ltr">`HOME`</span> — טסט שמשנה מצב חייב לשנות עותק שאף אחד אחר
אינו תלוי בו. <span dir="ltr">`mutate.ts`</span> אוכף את אותו כלל מכנית עבור מוטציה של קובץ מקור
(<span dir="ltr">`runCli(['init'], mkdtempSync(...))`</span> היא פשוטו כמשמעו איך הסוויטה ההיא
משליכה את סביבת העבודה החד-פעמית שלה, לפי <span dir="ltr">`docs/mutation-testing.md`</span>).

**מקרה שימוש**: הכותרת של <span dir="ltr">`test/cli/lesson-accept-summary.test.ts`</span> עצמו
קובעת את זה במפורש כבחירת עיצוב: *"סביבות עבודה חד-פעמיות, לא הקורפוס של המאגר הזה"* — טסט
lesson-accept שהיה רץ מול ה-<span dir="ltr">`.my_context/`</span> האמיתי כאן היה יוצר פריטי כללים
אמיתיים וקבועים בקורפוס עצמו שהתיעוד הזה מיוצר ממנו.

## שערי ה-<span dir="ltr">`check:*`</span>

**אחד־עשר סקריפטים**, שמורצים ממשפחת ה-<span dir="ltr">`check:*`</span> של
<span dir="ltr">`package.json`</span> — נספרו ישירות מתוך <span dir="ltr">`package.json`</span>
ב-**2026-09-17**; תשעה כשהסעיף הזה נכתב לראשונה ב-2026-09-13, ועוד
<span dir="ltr">`check:board`</span> (2026-09-16) ו-<span dir="ltr">`check:diagrams`</span>
(2026-09-17). כל אחד מכוון למצב כישלון אחד שבלתי נראה מעצם הבנייה. מתוך התשעה המקוריים, חמישה הם
בודקים טהורים לקריאה בלבד שהמעבר של 2026-09-12/13 הריץ באמת (פלט מודבק למטה) וארבעה נקראו מהמקור
בלבד, כי הרצתם או משנה מצב או משכפלת עבודה שפרק אחר כבר אימת חי. מתוך שני החדשים יותר:
**<span dir="ltr">`check:diagrams`</span> הורץ באמת ב-2026-09-17** והפלט שלו מודבק למטה עם השאר;
<span dir="ltr">`check:board`</span> מתואר ב-[16 · הלוח](./16-the-board.he.md), שמריץ אותו שם ולא
פעם שנייה כאן.

### איפה כל אחד רץ — שהיא שאלה שונה מהאם הוא עובד

הפרק הזה תיאר קודם תשעה שערים ומעולם לא אמר **איפה מישהו מהם רץ**, וזה בדיוק כישלון השער הריק
שכל השאר עוסק בו. הטבלה למטה נלקחה לראשונה ב-<span dir="ltr">`deb3d809`</span> (2026-09-13)
ו**נקראה מחדש משני קובצי זרימת העבודה ומה-hook ב-2026-09-17**, כשהיא קיבלה את שתי השורות
האחרונות שלה:

</div>

<div dir="rtl">

| שער | `ci.yml` | `release.yml` | <span dir="ltr">`.githooks/pre-commit`</span> |
|---|---|---|---|
| `check:test-glob` | כן | כן | — |
| `check:basis` | כן | כן | — |
| `check:retired` | כן | כן | — |
| `check:text-files` | כן | כן | — |
| `check:vendor` | כן | כן | — |
| `check:dependencies` | כן | כן | **כן** |
| `check:needs-cycles` | כן | כן | — |
| `check:handover` | כן | כן | — |
| `check:board` | כן | כן | — |
| `check:diagrams` | כן, **ubuntu בלבד** | כן, **ubuntu בלבד** | — |
| `check:cited-items` | **לא, במכוון** | לא | — |

</div>

<div dir="rtl">

ועוד <span dir="ltr">`verify:citations`</span>, אחר כך <span dir="ltr">`typecheck`</span>,
<span dir="ltr">`npm test`</span> ו-<span dir="ltr">`test:perf`</span> בשתי זרימות העבודה, ו-
<span dir="ltr">`test:e2e`</span> ב-<span dir="ltr">`ci.yml`</span> בלבד.

**<span dir="ltr">`check:diagrams`</span> הוא ubuntu-בלבד מסיבה שאינה העדפה**: mermaid היא ספריית
דפדפן ואין מרנדר Node, ולכן השער צריך את ה-Chromium ללא הראש שבלוק הדפדפן מתקין, ורק למשימת
ubuntu יש כזה. הוא ממוקם **ראשון** בתוך הבלוק ההוא, כי הוא עולה כשתי שניות מול שתים־עשרה הדקות
של הסוויטה ההיא — אותו סדר של הזול-נכשל-ראשון שכל שלב אחר בקובץ טוען בעדו. בחיתוך תגית הוא שווה
הורדה של 275 MB משלו ב-<span dir="ltr">`--only-shell`</span>, בנימוק שנאמר ב-
<span dir="ltr">`release.yml`</span> עצמו: **תגית היא מתי שהמסמכים נשלחים**, ולכן מכל השערים זה
היחיד שהנושא שלו הוא בדיוק מה שדף שחרור מצביע עליו.

**לפני ה-commit ההוא, ארבעה מהם רצו בשום מקום.** <span dir="ltr">`check:needs-cycles`</span>,
<span dir="ltr">`check:handover`</span>, <span dir="ltr">`check:dependencies`</span> ו-
<span dir="ltr">`check:cited-items`</span> לא היו באף זרימת עבודה, ו-
<span dir="ltr">`verify:citations`</span> היה ב-<span dir="ltr">`release.yml`</span> לבדו
**והיה אדום** — ולכן השער האחד שנכשל היה זה שרק חיתוך תגית היה מריץ. ארבעה מתוך שנים־עשר החוסמים
שנמצאו על ידי שש סקירות באותו שבוע היו נתפסים על ידי שערים שכבר היו קיימים.

**ההיעדר של <span dir="ltr">`check:cited-items`</span> הוא פסיקה, לא השמטה.**
<span dir="ltr">`7d10c14d`</span>, במילותיו שלו: *"בדיקה שלעולם אינה שומרת שם מדפיסה 224 שורות
לתוך יומן ירוק ומייצרת את המראית של כיסוי."* שלוש היציאות השונות מאפס היחידות שלו הן שומרי
אנטי-ריקנות, ולכן שום ממצא שהוא מדווח אינו יכול להכשיל הרצה — ושלב שאינו יכול להאדים הוא השער
הריק שהמאגר הזה ממשיך לתפוס. הוא נשאר דבר שאדם מריץ וקורא.

**הפער שכל הטבלה סוגרת נקוב בקובץ טסט שהפרק הזה לא הזכיר קודם.**
<span dir="ltr">`test/scripts/workflow-gates.test.ts`</span> קובע ששערים *מגיעים אליהם*, ולא
שהם נכונים: *"<span dir="ltr">`dependency-budget.test.ts`</span> ירוק אומר שאפשר לחשב את תקציב
התלויות, לעולם לא שמשהו מחשב אותו לפני מיזוג."* הוא קורא את זרימות העבודה בסריקת שורות (לפרויקט
הזה אין מפענח YAML ואף אחת מארבע תלויות הפיתוח שלו אינה כזו), ולכן טסטי האנטי-ריקנות שלו באים
ראשונים: הקורא חייב למצוא את השלבים שכבר היו קיימים **ואת הספירה המדויקת שלהם**, כך שסריקה שהתאימה
להכול נדחית גם היא. הוא גם **נועץ את ההיעדר של <span dir="ltr">`check:cited-items`</span> עם
הסיבה שלו**, כי "החרגה שאף אחד לא רשם אינה ניתנת להבחנה מההשמטה שכל הפריט הזה הוגש עליה". זה
המופע החד ביותר של התזה של הפרק הזה עצמו.

### ה-hook שלפני ה-commit

<span dir="ltr">`.githooks/pre-commit`</span> (חדש 2026-09-13) מותקן על ידי
<span dir="ltr">`npm run hooks:install`</span>, שהוא
<span dir="ltr">`git config core.hooksPath .githooks`</span>. **הוא מריץ בדיוק שער אחד**,
<span dir="ltr">`check:dependencies`</span>, על <span dir="ltr">`package.json`</span> מבוים או
<span dir="ltr">`CONST-zero-runtime-dependencies`</span> מבוים, וההתאפקות היא העיצוב:

> "hook שעולה שתי שניות ויכול להאדים על עבודה לא-מחויבת של נתיב אחר מקבל
> <span dir="ltr">`--no-verify`</span> פעם אחת, אחר כך מקבל כינוי שמעלים אותו, ואז הוא שער
> מחווט לשום דבר שלובש את הבגדים של שער שרץ."

למה דווקא זה: <span dir="ltr">`npm i --save`</span> הוא **מעשה של עץ העבודה**, וה-commit הוא
הרגע האחרון שבו הכתיבה עדיין זולה לביטול — CI פירושו דחיפה, הרצה אדומה וביטול; כאן פירושו מחיקת
שורה. והוא **לעולם אינו קו ההגנה היחיד** — אותה בדיקה רצה בשתי זרימות העבודה, במכוון, "כך שכיבוי
ה-hook הזה עולה לכם מהירות ולעולם לא בטיחות."

שתי מגבלות שה-hook קובע ולא משאיר להתגלות: hook שלפני commit קורא את **עץ העבודה**, לא את
האינדקס, ולכן מניפסט שנערך אך לא בוים נשפט בכל זאת (הכיוון הבטוח, אבל לא השאלה ש-
<span dir="ltr">`git commit`</span> שואל); ו-<span dir="ltr">`git commit --no-verify`</span> מדלג
עליו, כפי שהוא מדלג על כל hook.

</div>

<div dir="rtl">

| סקריפט | מה הוא אוכף |
|---|---|
| `check-test-glob.ts` | שגלוב הטסטים של <span dir="ltr">`package.json`</span> מצוטט במרכאות כפולות (לא מצוטט, <span dir="ltr">`sh`</span> ב-CI של Linux מרחיב <span dir="ltr">`**`</span> כ-<span dir="ltr">`*`</span> פשוט והריץ בשקט **2 מתוך 4** קובצי טסט בקוד יציאה 0 — מטריצה ירוקה על חצי סוויטה), ושהתבנית המצוטטת עדיין מתפענחת לכל <span dir="ltr">`*.test.ts`</span> אמיתי תחת <span dir="ltr">`test/`</span> (תופס תבנית שנשארת מצוטטת נכון אך מפסיקה להתאים לעץ). |
| `check-retired.ts` | שבלוק תיקון "§0" שנרשם במסמך תכנון באמת *מיושם* בגוף המסמך — ולא רק נרשם. מעבר של 2026-08-18 כתב תיקונים לארבעה סעיפי §0 של תוכניות והשאיר הוראות מיושנות ארבעה קטעים אחר כך שמצטטות את העובדה הישנה; מסמך יכול להכריז <span dir="ltr">`<!-- retired-phrases … -->`</span> והבודק הזה מאמת שכל ביטוי גנוז נעלם מהגוף. |
| `check-text-files.ts` | מסרב לקובץ מקור או טסט שמכיל בית NUL גולמי, שגורם ל-git לסווג את כל הקובץ כבינארי (אין diff, אין סקירה, התנגשויות מיזוג בלתי פתירות) — קרה כבר פעמיים ממתקנים כמו <span dir="ltr">`'CONST-x\0'`</span>. סורק את *כל* הקובץ, ולא רק את היוריסטיקת 8000 הבתים הראשונים של git, וסורק גם את <span dir="ltr">`skills/`</span>. |
| `check-vendor.ts` | שתי שאלות על <span dir="ltr">`src/ui/public/lib/vendor/`</span>: (1) האם כל קובץ משולב זהה-לבית ל-SHA-256 שננעץ ב-<span dir="ltr">`VENDOR.md`</span> (מפוענח, לא משוכפל), כך שטלאי "רק הפעם" אינו יכול להיסחף בשקט מהמקוריות המוצהרת שלו; (2) האם סריקה סטטית ל-<span dir="ltr">`fetch`/`XMLHttpRequest`/`Worker`/`importScripts`/`eval`/`new Function`/`WebAssembly`</span> נשארת באפס, מכיוון שתוסף לא-מקוון שמשלב קוד שיכול להגיע לרשת שובר את המצגת של עצמו. |
| `check-needs-cycles.ts` | הולך על גרף ה-<span dir="ltr">`needs:`</span> על פריטי <span dir="ltr">`task`</span> לאיתור מעגלים. שלוש הבדיקות הקיימות (מוכנות, ממצאי המשימה-החסומה/ההפניה-הלא-פתורה של doctor) אינן יכולות לראות מעגל כלל: <span dir="ltr">`a/1 needs a/2`</span> ו-<span dir="ltr">`a/2 needs a/1`</span> כל אחד תקין בנפרד וכל אחד "ממתין" בנפרד, ולכן שניהם יושבים ברשימת העצורים לנצח עם סיבה שנקראת כרגילה ולעולם לא כבעיה האמיתית. מדווח, לעולם לא פותר — הפסיקה מפורשת ששבירת מעגל בשקט הייתה גרועה יותר. |
| `check-dependency-budget.ts` | אוכף את <span dir="ltr">`CONST-zero-runtime-dependencies`</span> מכנית. לפני 2026-09-07 האילוץ אמר, במילות הפריט עצמו, *"שום דבר אינו בודק את זה אוטומטית"* — והסקירה פספסה בדיוק את המקרה שחשוב: <span dir="ltr">`mermaid`</span> נחת כתלות פיתוח רביעית לא מוכרזת ב-commit אחד ונמצא שבועות אחר כך במקרה. הסקריפט הזה קורא את <span dir="ltr">`package.json`</span> ומשווה מול המניין שפריט האילוץ עצמו נושא. |
| `check-cited-items.ts` | ההפך של <span dir="ltr">`scripts/verify-citations.ts`</span>. הסקריפט ההוא מוכיח שציטוט כמו <span dir="ltr">`` `file` · `fragment` · ~line ``</span> עדיין נוחת על קוד אמיתי; זה מוכיח שה*פריט* שהערה מצטטת עדיין שולט. הערה ב-<span dir="ltr">`e2e/app.ts`</span> ציטטה החלטה כ"הפסיקה העומדת של הבעלים" במשך שבועות אחרי שהוחלפה — הפריט נכון מעולם לא הוזרק (אפס אזכורים בפלט <span dir="ltr">`SessionStart`</span>), אבל הערת מקור חיה המשיכה לצטט אותו כעדכני, וסשן הסיק ממנו במשך שעות. מדווח, לעולם לא שומר — מחיקת הפריט שהוחלף הייתה משאירה את ההערה מצביעה על כלום, וזה גרוע יותר. |
| `check-basis.ts` | מכוסה בסעיף משלו למעלה. |
| `check-handover.ts` | מכוסה ב-[07 · שחזור והעברת ידיים](./07-restore-and-handover.he.md). |
| `check-board.ts` | מכוסה ב-[16 · הלוח](./16-the-board.he.md) — השער שתפס פעמיים את הלוח עצמו משקר לקורא. חדש 2026-09-16. |
| `check-diagrams-parse.ts` | שכל fence מסוג <span dir="ltr">`` ```mermaid ``</span> תחת <span dir="ltr">`README.md`</span>, <span dir="ltr">`docs/README.he.md`</span>, <span dir="ltr">`docs/capabilities/`</span> ו-<span dir="ltr">`docs/system/`</span> באמת **מתפענח**, ב-mermaid אמיתי, בדפדפן אמיתי. חדש 2026-09-17, והוא קיים בגלל כישלון מדוד בדיוק מהסוג שהפרק הזה עוסק בו — ראו למטה. |

</div>

<div dir="rtl">

**פלט אמיתי, כל הארבעה הורצו מחדש 2026-09-17.** שניים מהארבעה משחזרים את הלכידה הקודמת שלהם
במדויק (<span dir="ltr">`check-vendor`</span>: 28 קבצים;
<span dir="ltr">`check-dependency-budget`</span>: אותן ארבע תלויות פיתוח) ושניים לא, כי שניהם
סופרים את העץ: <span dir="ltr">`check-text-files`</span> סרק 1,330 קבצים ב-2026-09-13 ו-1,452
היום, ו-<span dir="ltr">`check-needs-cycles`</span> הלך על 724 פריטי עבודה אז ועל 923 עכשיו.
**ספירה שמשחזרת וספירה שזזה נראות זהות בהדבקה בלי תאריך עליה** — וזו הסיבה שהתאריכים על שורות
הפקודה ולא במשפט שמעליהן.

</div>

```
$ node scripts/check-vendor.ts     # 2026-09-17
28 vendored file(s) match src/ui/public/lib/vendor/VENDOR.md.

$ node scripts/check-text-files.ts     # 2026-09-17
1452 text file(s) scanned: none contains a NUL byte.
every one of them still diffs.
# exit 0. On 2026-09-12 this run reported, in this repository's own working tree:
#   NUL  src\ui\retrieval-write.ts  at byte 8280
#   1309 text file(s) scanned: 1 contain(s) a NUL byte…
# (those two lines are quoted from the 2026-09-12 run, not from this one)

$ node scripts/check-needs-cycles.ts     # 2026-09-17
923 work item(s), 157 open · 890 plan/seq node(s) · 111 carrying "needs" · 146 edge(s) walked · 0 reference(s) nothing answers to, not walked · 25 item(s) carry no plan/seq and can be needed by nothing
no cycle: every "needs" chain in this corpus terminates.

$ node scripts/check-dependency-budget.ts     # 2026-09-17
package.json declares no runtime dependency, and 4 devDependencies (typescript, @types/node, @playwright/test, mermaid) — exactly what CONST-zero-runtime-dependencies enumerates.
```

<div dir="rtl">

**הממצא ההוא היה אמיתי והוא תוקן מאז.** ב-2026-09-12
<span dir="ltr">`check-text-files.ts`</span> באמת מצא בית NUL אחד ב-
<span dir="ltr">`src/ui/retrieval-write.ts`</span> בבית 8280, בעץ העבודה של המאגר הזה עצמו, ברגע
שהפרק הזה נכתב — לא דוגמה מובנית. הורץ מחדש 2026-09-13:
<span dir="ltr">`1330 text file(s) scanned: none contains a NUL byte`</span>, יציאה 0; הורץ מחדש
שוב 2026-09-17, עדיין נקי, על פני 1,452 קבצים. הוא נשמר כאן כהיסטוריה, מתוארך, ולא נמחק, כי בודק
שתופס פגם אמיתי בעץ שהוא שומר עליו הוא הראיה שהוא אינו ריק — וזה כל הנושא של הפרק הזה.

<span dir="ltr">`check-cited-items.ts`</span> ו-<span dir="ltr">`check-test-glob.ts`</span> נקראו
מהמקור בלבד (של הראשון החצי הקורא כבר מופעל בבטחה על ידי
<span dir="ltr">`check-basis.ts`</span> שמייבא אותו; השני אינו צריך הרצה חיה כדי שהכלל שלו ייאמר
במדויק).

### <span dir="ltr">`check:diagrams`</span> — השער שנכשל בכוונה לפני שהוא מדווח על מעבר

חדש ב-2026-09-17, והוא שייך לפרק הזה ולא לפרק תיעוד כי הוא המופע הברור ביותר של התזה של הפרק
הזה עצמו בעץ.

**הכישלון שהוא קיים בשבילו.**
<span dir="ltr">`docs/capabilities/07-restore-and-handover.md:78`</span> נשא
<span dir="ltr">`&lt;key&gt;`</span>, שה-<span dir="ltr">`&`</span> שלו מסיים את הלקסר של
mermaid, והוא צייר תיבת שגיאה על הדף כל עוד הוא היה קיים. הכותב שלו דיווח *"כל fence מתפענח"* —
אחרי שבדק **איזון סוגריים**, לא רינדור — וזה הועבר למעלה בלי שאף אחד שאל איך זה נבדק. **איזון
אינו פענוח.** שום דבר לא תפס את זה כי ה-<span dir="ltr">`DIAGRAM_SOURCES`</span> של
<span dir="ltr">`scripts/gen-diagrams.ts`</span> מונה רק את שני ה-README, ולכן שום fence תחת
<span dir="ltr">`docs/`</span> לא יוצר, לא נעשה לו commit ולא נשמר בשער בכלל.

</div>

<div dir="rtl">

| | |
|---|---|
| מה הוא עושה | מחלץ fences עם ה-<span dir="ltr">`mermaidBlocks`</span> של המוצר עצמו (<span dir="ltr">`src/ui/public/lib/markdown.js`</span> — אותה פונקציה שהדפדפן מרנדר דרכה, ולכן אין סורק שני שיחלוק על הראשון), ואז <span dir="ltr">`mermaid.parse()`</span> תחת התצורה של <span dir="ltr">`gen-diagrams.ts`</span> עצמו |
| מה הוא **אינו** עושה | **לצייר משהו.** פסיקת בעלים, 2026-09-17, בבחירה בין הרחבת <span dir="ltr">`DIAGRAM_SOURCES`</span> לבין שער פענוח-בלבד, בשתי מילים: *"שער הפענוח-בלבד"*. ציור ה-fences הלא מצוירים נמדד בכ-1.5–1.8 MiB, שהיה לוקח את <span dir="ltr">`src/ui/public`</span> מ-5.04 MB לכ-6.7 MB — מעבר לתקציב גודל שכבר נדחה פעם אחת |
| שתי רשימות המקור | מותר להן במכוון לחלוק זו על זו: הרשימה של השער הזה **רחבה** מ-<span dir="ltr">`DIAGRAM_SOURCES`</span> ואינה נקראת ממנה, כי כל הפגם היה שרשימת הציור קצרה |
| למה סקריפט, לא טסט | הוא צריך דפדפן, ו-<span dir="ltr">`test/`</span> חסום מ-Playwright — <span dir="ltr">`npm test`</span> רץ על Windows וגם על ubuntu ורק ל-ubuntu יש Chromium |

</div>

<div dir="rtl">

**מהלך האנטי-ריקנות, והוא הסיבה ששווה לקרוא את השער הזה.** הדבר הראשון שכל הרצה עושה הוא
**להיכשל בכוונה**: ה-fence של פרק 7 שלפני התיקון, שניתן לשחזור מילה במילה מ-
<span dir="ltr">`471b13b3^`</span>, נדחף דרך אותו חילוץ, אותו פענוח ואותו פסק כמו המסמכים
האמיתיים, וההרצה נקטעת בקוד שונה מאפס אם mermaid *מקבל* אותו. **נתיב אדום שמעולם לא רץ הוא אור
ירוק בלי נורה מאחוריו** — וזה בדיוק מה שסעיפי ה-<span dir="ltr">`@basis`</span> וההוכחה-בהסרה
של הפרק הזה עוסקים בו, שמגיע לשער.

פלט אמיתי, המאגר הזה, **2026-09-17** — נלכד בהרצת הפקודה והפניית stdout ו-stderr לקובץ, והדבקת
הבתים של הקובץ ההוא:

</div>

```
$ npm run check:diagrams                       # 2026-09-17
red proof — the RED path, run before any number below is believed. The pre-repair
chapter 7 fence (git 471b13b3^) must be refused, and is:
DOES NOT PARSE  471b13b3^:docs/capabilities/07-restore-and-handover.md:78
     the fence opens: sequenceDiagram  (at 471b13b3^:docs/capabilities/07-restore-and-handover.md:69)
[… 4 further lines are not shown: mermaid's own parse-error text for that fence — the line, the
offending token, and the set of tokens it expected instead. Nothing above or below this marker is
cut, reflowed or retyped, and the two npm banner lines above the output are replaced by the
command line at the top. …]

39 fence(s) across 21 of 27 document(s) (README.md, docs/README.he.md, docs/capabilities, docs/system): 39 parse, 0 do not — 1.2s.
nothing was drawn, and nothing needed to be: every fence in the documents parses.
```

<div dir="rtl">

**הסך זז והתזמון זז.** <span dir="ltr">`39 of 39`</span> היא הקריאה של 2026-09-17; ספירת ה-fences
משתנה עם כל דיאגרמה שנתיב כלשהו מוסיף לאחד מארבעת המקורות, ו-<span dir="ltr">`1.2s`</span> הוא
הרצה אחת על מכונה אחת. הריצו מחדש במקום לסמוך על אחד מהם.

**הוא כבר תפס כישלון אמיתי ולא רק אחד מובנה.** מעבר תיקון ב-2026-09-17 כתב
<span dir="ltr">`;`</span> לתוך תווית הודעה ב-<span dir="ltr">`sequenceDiagram`</span>; mermaid
קורא את זה כמפריד הצהרות וה-fence הפסיק להתפענח. בדיקת איזון סוגריים — הדבר שהתבלבל עם אימות
מלכתחילה — הייתה מעבירה אותו. השער נקב ב-fence, בשורה ובאסימון בפחות משתי שניות.

## אי-כתיבה

"אי-כתיבה" היא **ערובה אחת**, שנקבעת על שני משטחים שונים, ולא שני מושגים נפרדים. ערובת אי-הכתיבה
של ממשק הרשת עצמו (מנגנון האכיפה שלה, והחריגים הפסוקים הצרים שלה) מתועדת במלואה ב-
[08 · ממשק הרשת](./08-web-ui.he.md); הסעיף הזה מכסה איך צד ה*טסט* מוכיח אותה, שהיא בדיקה מבנית
וקפדנית יותר.

<span dir="ltr">`test/ui/no-writes.test.ts`</span> הוא החצי הסטטי של האכיפה (הכותרת שלו עצמו
מצטטת את "spec §2, §6; plan Task 14"). **מה הוא מוכיח**: קבוצת הסמלים בעלי יכולת הכתיבה
ש*נקשרים* על ידי מודול כלשהו תחת <span dir="ltr">`src/ui/`</span> היא בדיוק אחד — רשומת הסירוב
ב-<span dir="ltr">`src/ui/security.ts`</span> (פסיקת בעלים B4) — נבדק כ**שוויון**, לא כבדיקת
ריקנות, ולכן גם הוספת קישור כתיבה שני וגם מחיקת הקישור האחד שנפסק מכשילות את הטסט. יחידת האיסור
היא ה*סמל* המיובא הבודד, ולא הקובץ: <span dir="ltr">`revision-log.ts`</span> מייבא רק את
<span dir="ltr">`readJsonlFile`</span> מ-<span dir="ltr">`jsonl-log.ts`</span>, מודול שגם מייצא
שלוש פונקציות כותבות, ואיסור ברמת הקובץ היה צריך רשימת היתר מתוחזקת ביד ש"גדלה לשורה של חורים
שאף אחד אינו בוחן מחדש" (במילות הקובץ עצמו). ההיקף הוא <span dir="ltr">`src/ui/`</span> ועוד כל
שרשרת ייצוא מחדש שהקישורים שלו מתפענחים דרכה — כשהוא מיושם על כל הגרף הנגיש הוא היה אדום ביום
הראשון, ותפס את <span dir="ltr">`focus.ts`</span> קושר <span dir="ltr">`recordAudit`</span> ואת
<span dir="ltr">`seen-file.ts`</span> קושר <span dir="ltr">`appendJsonlLine`</span> אף שהפונקציות
הממשיות שמודל הקריאה קורא (<span dir="ltr">`readFocus`</span>, <span dir="ltr">`readSeen`</span>)
אינן כותבות דבר.

החברות בקבוצת הסמלים האסורים היא עצמה **נגזרת**, לא מתוחזקת ביד: לגרסה מוקדמת יותר היו שני חצאים
מתוחזקים ביד ורק אחד נבדק, ולכן מודול שכתב ומעולם לא *נקוב* ברשימה נשפט כלא-כותב ויכול היה לקשור
אותו כשהטסט ירוק — נמדד פעמיים באמת (<span dir="ltr">`core/ui-server-record.ts`</span>
ב-2026-08-27, <span dir="ltr">`ui/execute-effect.ts`</span> ארבעה ימים אחר כך).

[06 · שליפה](./06-retrieval.he.md) מתעד את בדיקת הלוויין ה*דינמית*:
<span dir="ltr">`approvedRestore`</span> שמחזיר <span dir="ltr">`null`</span> לכל דבר שאינו אישור
אנושי מכוון, שמור-nonce ומאומת-דיסק, שמוכח בתצלום זהה-לבית של קובץ הביום ובבקרת מייבא שתול. שני
החצאים — קשירת סמלים סטטית והוכחה התנהגותית דינמית — עונים על אותה הבטחה בסיסית: מממשק הרשת אפשר
לקרוא, לעולם לא לכתוב, למעט דרך דלת המילוט הפסוקה האחת.

## פנקסי השקילות

**"פנקס" כאן אומר טבלה מוצהרת**, שנעשה לה commit כ-TypeScript רגיל, שרושמת — לכל זוג משטחים
שאמורים להסכים — או את ההתאמה ביניהם או היעדר *מנומק*, ונבדקת מול התוכנית החיה והרצה על ידי טסט
ייעודי כך שההצהרה אינה יכולה להיסחף בשקט מהמוצר. <span dir="ltr">`src/plugin/parity.ts`</span>
הוא המרכזי; כמה טסטי שקילות צרים יותר מיישמים את אותו רעיון בדיוק על פונקציה אחת שממומשת פעמיים.

**<span dir="ltr">`src/plugin/parity.ts`</span>** קיים כדי להפוך דרישה אחת לניתנת לבדיקה, מצוטטת
מהכותרת שלו עצמו — מילות הבעלים: *"כל דבר שהמודל יכול לעשות דרך כלי, המשתמש צריך להיות מסוגל
לעשות דרך פקודה."* לפני הקובץ הזה, זו הייתה שאיפה: אחד־עשר כלי MCP ופקודות סלאש כיסו בערך ארבעה
מהם, והפער נמצא פקודה חסרה אחת בכל פעם. שלושה פנקסים חיים כאן, כל אחד נאכף על ידי
<span dir="ltr">`test/plugin/parity.test.ts`</span> מול התוכנית הרצה בשני הכיוונים:

- **<span dir="ltr">`TOOL_PARITY`</span>** — כל כלי MCP, והמקבילה שלו בשורת הפקודה ו/או בסלאש.
  היכן שאחד נעדר, <span dir="ltr">`note`</span> חובה קובע *למה*, ולא רק *ש*. דוגמה אמיתית: ל-
  <span dir="ltr">`mycontext_help`</span> יש <span dir="ltr">`cli: 'help'`</span> אבל
  <span dir="ltr">`slash: null`</span>, כי <span dir="ltr">`/mycontext:help`</span> שכל תוכנו הוא
  "הריצו <span dir="ltr">`mycontext help`</span>" אינו נושא דבר משלו.
- **<span dir="ltr">`CLI_WITHOUT_SLASH`</span>** — פקודות שורת פקודה בלי מקבילת סלאש, ולמה. כל
  רשומה היא או משהו שרץ לפני שסשן קיים לזמן בו פקודת סלאש (<span dir="ltr">`init`</span>), או
  מעשה אנושי-בלבד מכוון — למשל <span dir="ltr">`ack`</span> נדחה לכל מקור שאינו
  <span dir="ltr">`human`</span> ב-<span dir="ltr">`core/mutate.ts`</span>, ולכן פקודת סלאש (מודל
  שמקליד את הפקודה) הייתה מוחרגת על ידי אותה לוגיקה שבדיקת זמן הריצה של שורת הפקודה עצמה כבר
  אוכפת.
- **<span dir="ltr">`CLI_WITHOUT_TOOL`</span>** — הרגל השלישית שאף אחד לא בדק עד שהשורה הזו הייתה
  קיימת: כל פקודת שורת פקודה בלי כלי MCP, מתויגת <span dir="ltr">`'intended'`</span> (סיבה
  מבנית — רובן מצטטות עובדה שהטסט *בודק מחדש בקוד*, כמו ליטרל
  <span dir="ltr">`origin: 'human'`</span> קשיח, ולא סומכות על משפט שיישאר נכון) או
  <span dir="ltr">`'owed'`</span> (שום דבר אינו דוחה אותה, הפער פשוט עוד לא נבנה, והוא בודק את
  עצמו: ביום שכלי נשלח, השורה הופכת לסתירה והטסט נכשל עד שמישהו מוחק אותה).

הקובץ קובע בפשטות למה <span dir="ltr">`'intended'`</span> היא ההבטחה הקשה יותר: סיבה כמו "ההיעדר
של <span dir="ltr">`ready`</span> היה בגלל X" יכולה להתיישן בדיוק בדרך שהקורפוס עצמו מתיישן —
עובדת הקוד משתנה והמשפט ממשיך לקבוע את הישנה — וזו הסיבה שהשורות שבודקות את עצמן מצביעות על מקור
אמיתי (ליטרלים של <span dir="ltr">`origin: 'human'`</span>, רישומי
<span dir="ltr">`workspace: 'none'`</span>, מחרוזות שימוש של SQL גולמי) ולא רק על פרוזה.

**פנקסי שקילות צרים יותר**, פונקציה אחת שממומשת פעמיים ונעוצה שווה:
<span dir="ltr">`test/ui/duration-parity.test.ts`</span> ו-
<span dir="ltr">`test/ui/zoned-stamp-parity.test.ts`</span> סורקים את
<span dir="ltr">`formatDuration`/`zonedStamp`</span> (עותק TypeScript בצד השרת מול
<span dir="ltr">`viewmodel.js`</span> של הדפדפן) לאיתור פלט זהה על פני טווח קלט סרוק;
<span dir="ltr">`test/ui/strip-parity.test.ts`</span> עושה את אותו דבר ללוגיקת הפשטת מקטעי ה-
powerline של שורת המצב; <span dir="ltr">`test/doctor/shared-tail-parity.test.ts`</span> נועץ את
רינדור הזנב המשותף "הודעה אחת עושה שתי עבודות" של מודול ה-doctor
(<span dir="ltr">`src/doctor/shared-tail.ts`</span>) באותה דרך. הכותרת של
<span dir="ltr">`src/doctor/shared-tail.ts`</span> עצמו קובעת את העיקרון שכולם חולקים: *"עותק
שמוכח שווה בסריקת שקילות… העסקה היא הטסט, לא הכוונה."*

**מקרה שימוש**: תורם שמוסיף כלי MCP חדש בלי פקודת שורת פקודה (או להפך) —
<span dir="ltr">`test/plugin/parity.test.ts`</span> נכשל מיד, ונוקב בשורה החסרה, במקום שהפער
יימצא חודשים אחר כך על ידי מישהו שמחפש פקודה שאינה שם, שזו בדיוק הדרך שבה הגרסה ה*ראשונה* של
הפער הזה נמצאה.

## מה **לא** בנוי / בנוי אך כבוי

- **<span dir="ltr">`check:basis`</span> תחום, לא אוניברסלי.** **460 מתוך 622 קובצי טסט (74%)**
  פטורים דרך הבסיס ואינם נושאים שורת <span dir="ltr">`@basis`</span> כלל (הורץ מחדש 2026-09-13;
  הוא קרא 461 מתוך 611 ב-2026-09-12 — <span dir="ltr">`8aa489fc`</span> הסיר שורת בסיס אחת
  והסוויטה גדלה). זה עיצוב מכוון (הסבה של ניחוש גרועה משתיקה), לא פער שאף אחד לא הבחין בו, אבל
  זה אומר שלרוב הסוויטה כרגע אין הצהרת בסיס. **0 קבצים נשמרים ולא מוצהרים**, וזה המספר שהיה
  פגם.
- **<span dir="ltr">`@basis`</span> אינו יכול לראות מה טסט *מניח***, רק מה הוא *מאמת* — נאמר
  כמגבלה ידועה בפלט הסיכום של הבודק עצמו, לא משהו שהתיעוד הזה מסיק.
- **ממצא בית ה-NUL שהפרק הזה דיווח עליו ב-2026-09-12 תוקן.**
  <span dir="ltr">`check-text-files.ts`</span> יוצא 0 נכון ל-2026-09-13 על פני 1,330 קבצים. הדין
  וחשבון למעלה נשמר, מתוארך, כראיה שהבודק תופס פגמים אמיתיים.
- **בדיקת מוטציות היא כלי שאדם מריץ במכוון, לא שער CI** — נבדק מחדש ב-HEAD ב-2026-09-13 מול כל
  סקריפט ב-<span dir="ltr">`package.json`</span> ושתי זרימות העבודה:
  <span dir="ltr">`npm run mutate`</span> אינו מחווט לשום סקריפט
  <span dir="ltr">`check:*`</span> או <span dir="ltr">`test:*`</span> ואינו מופיע לא ב-
  <span dir="ltr">`ci.yml`</span> ולא ב-<span dir="ltr">`release.yml`</span>. הוא מופעל ביד או
  מופנה אליו מזרימת עבודה של סקירת קוד.
- **ארבעה־עשר סקריפטי npm אינם נקובים בשום מקום בסימוכין הזה**, וכמה מהם שערים:
  <span dir="ltr">`test:perf`</span> (שרץ ב**שתי** זרימות העבודה),
  <span dir="ltr">`test:e2e:single-phase`</span>, <span dir="ltr">`test:e2e:install`</span>,
  <span dir="ltr">`typecheck`</span>, <span dir="ltr">`gen:commands`</span>,
  <span dir="ltr">`gen:docs`</span>, <span dir="ltr">`verify:citations`</span>,
  <span dir="ltr">`check:retired`</span>, <span dir="ltr">`check:text-files`</span>,
  <span dir="ltr">`check:vendor`</span>, <span dir="ltr">`check:needs-cycles`</span>,
  <span dir="ltr">`check:dependencies`</span>, <span dir="ltr">`check:cited-items`</span>,
  <span dir="ltr">`hooks:install`</span>. הטבלה למעלה מתקנת את החצי של "איפה זה רץ"; נקיבה בהם
  כסקריפטים עדיין דקה.
- **תשעה מתוך 43 הקבצים ב-<span dir="ltr">`scripts/`</span> אינם נקובים בשום מקום תחת
  <span dir="ltr">`test/`</span> או <span dir="ltr">`e2e/`</span>** (2026-09-17,
  <span dir="ltr">`grep -rl <basename> test/ e2e/`</span> לכל סקריפט):
  <span dir="ltr">`changelog-section.ts`</span>, <span dir="ltr">`measure-corpus-rank.ts`</span>,
  <span dir="ltr">`measure-review-coverage.ts`</span>,
  <span dir="ltr">`repair-openq-filters.ts`</span>,
  <span dir="ltr">`restamp-summary-basis-lifecycle.ts`</span>,
  <span dir="ltr">`restamp-summary-basis-workflow-extra.ts`</span>,
  <span dir="ltr">`review-trigger-replay.ts`</span>, <span dir="ltr">`seed-dogfood.ts`</span>,
  <span dir="ltr">`vendor-webawesome.ts`</span>.
  **זה מודד אזכור, לא כיסוי, והשתיים אינן אותה קביעה.** גרסה מוקדמת יותר של הסעיף הזה קבעה
  ש*תשעה־עשר* סקריפטים "אין להם כיסוי בשום מקום" ונקבה ב-<span dir="ltr">`e2e-gate.ts`</span>,
  <span dir="ltr">`gen-diagrams.ts`</span>, <span dir="ltr">`check-faint-usage.ts`</span> ואחרים
  ביניהם; כל שלושת אלה נקובים תחת <span dir="ltr">`test/`</span> או
  <span dir="ltr">`e2e/`</span> היום, והוכחת הקביעה החזקה יותר דורשת ניתוח גרף ייבוא על הסוויטה
  שאף אחד לא הריץ. מה שנמדד כאן הוא העובדה החלשה יותר, שנאמרת כעובדה החלשה יותר: תשעה סקריפטים
  ששום קובץ טסט אפילו לא מזכיר. סקריפט ש**כן** מוזכר עשוי עדיין להיות לא מכוסה.
- **<span dir="ltr">`test/rules/*`</span> (18 קבצים נכון ל-2026-09-17) אינו מתואר כאן**, אף
  ש-<span dir="ltr">`test/rules/isolation.test.ts`</span> הוא מה שהופך את קביעת הבידוד של פרק 10
  לניתנת לבדיקה ולא לנטענת.
- **שומר מתקן תפר ה-UTF-8 הוא הוכחה בצורת <span dir="ltr">`@basis`</span> שהפרק הזה אינו נושא.**
  <span dir="ltr">`test/core/chunk-seam-utf8.test.ts`</span> כתוב בעברית בדיוק כי על ASCII הפגם
  שהוא תופס *אינו יכול* להכשיל טסט, והוא קובע שבית 1,048,576 של המתקן שלו עצמו הוא בית המשך של
  UTF-8 — כך שמתקן שנסחף בבית אחד אינו יכול להיות ירוק בכך שהוא כבר לא בודק דבר. זהו
  <span dir="ltr">`a-fixture-must-not-be-what-makes-a-proof-pass`</span> (מאגר כללי המוצר,
  [פרק 10](./10-rule-store.he.md)) בקובץ אחד. ראו [פרק 4](./04-conversation-archive.he.md).
- **חוזה הביטויים הגנוזים של <span dir="ltr">`check-retired.ts`</span> מכסה רק מסמכים שמצטרפים
  מרצון** עם בלוק הערת HTML מפורש <span dir="ltr">`<!-- retired-phrases -->`</span> — הוא אינו
  סורק כל מסמך לאיתור התיישנות באופן כללי.

## ראו גם

- [00 · אינדקס](./00-index.he.md)
- [03 · יצירה והשערים](./03-creation-and-gates.he.md) — שערי הסיכום והסתירה ששולטים בפריטי
  קורפוס; השערים של הפרק הזה שולטים בסוויטת הטסטים שמאמתת אותם.
- [06 · שליפה](./06-retrieval.he.md) — הוכחת אי-הכתיבה ה*דינמית*
  (<span dir="ltr">`approvedRestore`</span>, ה-nonce, בקרות המייבא השתול) שמזדווגת עם הכיסוי
  הסטטי של <span dir="ltr">`no-writes.test.ts`</span> בפרק הזה.
- [08 · ממשק הרשת](./08-web-ui.he.md) — ערובת אי-הכתיבה עצמה, והחריגים הנקובים שלה, כתכונת מוצר
  ולא כטסט.
- [07 · שחזור והעברת ידיים](./07-restore-and-handover.he.md) —
  <span dir="ltr">`check:handover`</span>.

</div>
