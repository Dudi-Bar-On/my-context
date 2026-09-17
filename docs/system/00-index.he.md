<!--
  This is the Hebrew mirror of `docs/system/00-index.md`. The English document
  is the source of record; where the two disagree, the English one is right and
  this one is stale.

  Conventions here are `docs/README.he.md`'s and `docs/the-store.he.md`'s, not
  new ones — they were established by rendering Hebrew Markdown in a browser
  rather than by reasoning about source, and this file only restates the two a
  translator has to apply line by line:

  1. Hebrew prose and Markdown tables live inside `<div dir="rtl">` blocks.
     Fenced code and Mermaid blocks stay OUTSIDE them: inside an RTL container
     the bidi algorithm reverses the runs of a shell transcript or a
     box-drawing table.
  2. Any Latin-script run that must read left-to-right on its own is wrapped in
     `<span dir="ltr">…</span>` — a code span whose first or last character is
     not alphanumeric, any run of two or more Latin terms separated by commas
     or slashes, and — added for this directory, which is full of them — any
     span holding a number RANGE written with an en dash, because a neutral
     between two numbers takes the paragraph direction and `101-145` would
     otherwise be read out backwards.

  LINKS: this file points at the English targets, exactly as `docs/README.he.md`
  does, with one exception — a sibling chapter inside `docs/system/` points at
  its own Hebrew mirror, because that mirror is written in the same change and
  is certain to exist.

  Nothing here was re-measured. Every count, ratio and line number is carried
  across from the English chapter as it stands on 2026-09-17; re-run the
  commands rather than trusting either edition.
-->

# `docs/system/` — איך זה באמת עובד

<div dir="rtl">

זו הגרסה העברית של [`docs/system/00-index.md`](./00-index.md). המסמך האנגלי הוא המקור: מבנה
הפרקים של שני הקבצים נשמר זהה ונבדק, אבל שום בדיקה אינה יכולה לקבוע שהתרגום עדכני, ובמקרה
של סתירה — האנגלית קובעת.

<span dir="ltr">`docs/capabilities/`</span> עונה על **מה זה יודע לעשות**. זהו סימוכין: פרק
אחד לכל משטח, פלט פקודה אמיתי, טבלת דגלים. הוא נכתב ב-2026-09-12 ואומת מול עץ העבודה
ב-2026-09-13 בארבעה־עשר פרקים; **שלושה** נוספו אחר כך — 14 (חיפוש מעל הארכיון), 15 (מציג
המסמכים וסוכני העזר) ו-16 (הלוח), שלושתם בקומיט `1ec219c2` ב-2026-09-16 — ומאז הוא תוקן
ואומת מחדש פעמיים. גרסה קודמת של המשפט הזה אמרה שפרק אחד נוסף אחר כך; היו שלושה, ושני
הפרקים שהמשפט ההוא השמיט הם בדיוק אלה שנושאיהם חופפים בצורה הישירה ביותר לפרקים 01 ו-02
של התיקייה הזאת.

התיקייה הזאת עונה על שאלה אחרת: **איך זה באמת עובד**. לא רשימת הדגלים — המנגנון שמתחתיה,
ההחלטה שעיצבה אותו, והכישלון שההחלטה הזאת הייתה תגובה אליו. המודל הוא
[`docs/the-store.he.md`](../the-store.he.md), המסמך האחד בפרויקט הזה שנכתב כך עוד לפני
שהתיקייה הזאת התקיימה: מה דבר הוא ובמה מתבלבלים איתו, מה יש בו היום, איך הוא עובד, איך
מתחזקים אותו, ו — בלי לרכך — מה ידוע שלא בסדר בו.

הצורה הזאת חשובה יותר משהיא נראית. פרק סימוכין יכול להיות שלם ועדיין להשאיר מצטרף חדש
בלי יכולת לענות על "למה זה עובד *ככה* ולא בדרך המתבקשת האחרת". התשובה היא כמעט תמיד
כישלון מסוים שנמדד — ביטוי רגולרי שהתאים ל-4 מתוך 28 אזכורים ובאחד מהם טעה, טענה שפעלו
לפיה שבוע שלם עד שמישהו מדד אותה ומצא שהיא שקרית, גוון שנשלח לפני שמישהו הכריע עליו.
פרקי הסימוכין מצטטים את התוצאה. הפרקים כאן שומרים את הטיעון.

## מה יש כאן, ולמה דווקא השבעה האלה

<span dir="ltr">`reports/2026-09-16-the-subjects-of-this-system.md`</span> ערך מצאי של 32
נושאים וסימן לכל אחד מהם איזה תיעוד קיים היום. **שבעה מתוך ה-32 לא היה להם פרק כלל** — לא
פרק מיושן, לא פרק שזקוק לעדכון, ולשלושה מהם אפילו לא מדריך. הם מכוסים כאן ב**שבעה**
פרקים, כי לקחים, קליטה ומיקוד חולקים שורה אחת למטה ומקבלים פרק לכל אחד. הסימונים של
המצאי עצמו, בציטוט: שורה 6 (הלוח) *"NOTHING of the right shape"*, שורה 9 (המציג)
*"NOTHING"*, שורה 30 (הפלטה) *"Effectively NOTHING in prose"*, שורה 17 (דעיכה, תרומה
ויומן הביקורת) *"Scattered, with no owner"*, ושורות 18, 19 ו-20 (לקחים, קליטה, מיקוד)
*"Tutorial only … No chapter"*.

**נושא שמיני נושא את אותו סימון בדיוק ולא קיבל פרק**, ולומר זאת זול יותר מלהשאיר לקורא
לשים לב: שורה 31, הגשר לשורת המצב, גם היא *"Tutorial only … No chapter"*, והמצאי מקבץ
אותה יחד עם לקחים, קליטה ומיקוד בשמן — *"rows 18, 19, 20 and 31 … are four small subjects
with a tutorial each and no chapter."* שלושה מתוך אותם ארבעה נכתבו והרביעי לא. זה פער
בתיקייה הזאת, לא במצאי.

</div>

<div dir="rtl">

| פרק | נושא | מה היה קיים לפני המעבר הזה |
|---|---|---|
| [<span dir="ltr">`01-the-board.md`</span>](./01-the-board.he.md) | איך נבחרת עבודה: `needs`, `ready`, `path`, מספרי ה-D | פרק סימוכין (<span dir="ltr">`docs/capabilities/16-the-board.md`</span>) שנשלח באותו מעבר תיקון שהתיקייה הזאת שייכת אליו — תחביר הפקודות והפלט האמיתי חיים שם. הפרק הזה נושא את מה שפרק סימוכין אינו יכול לשאת: סיפור הממשל, ולמה מצטרף חדש חייב להבין אותו לפני שהוא נוגע בכל דבר אחר כאן. |
| [<span dir="ltr">`02-the-document-and-lane-viewer.md`</span>](./02-the-document-and-lane-viewer.he.md) | עיבוד תמליל גדול מאוד — זה של הפרויקט הזה עומד על **151,884,220 בתים** ב-2026-09-17, מול 133 MB כשמפת המנגנונים מדדה אותו ו-63.9 MB כשמודל הקריאה תוכנן: קיפול, הדגשת התאמות, חלונית החיפוש, סימונים בשוליים | שלושה דוחות מאותו שבוע. אין פרק. |
| [<span dir="ltr">`03-the-palette-and-the-drawn-language.md`</span>](./03-the-palette-and-the-drawn-language.he.md) | תקציב המשמעות של חמשת הגוונים, שבבים, אייקונים, תרשימי Mermaid מיוצרים | מוקאפ עיצוב ושערי דפדפן שאוכפים אותו. שום דבר בפרוזה. |
| [<span dir="ltr">`04-the-audit-log-decay-and-contribution.md`</span>](./04-the-audit-log-decay-and-contribution.he.md) | מה הפרויקט רושם על הריצה של עצמו, ושתי קריאות שנגזרות מזה | אזכורים מפוזרים על פני שני פרקים ושני מדריכים. אין פרק, אין בעלים אחד. |
| <span dir="ltr">`05-lessons.md`, `06-ingest.md`, `07-focus.md`</span> | שלוש דלתות קטנות: טעות הופכת לכלל מועמד; מסמך הופך לפריטי טיוטה; סשן מצמצם את מה שהוא רואה | מדריך אחד לכל אחת. אין פרק. |

</div>

<div dir="rtl">

לקחים, קליטה ומיקוד הם שלושה פרקים קצרים נפרדים ולא פרק אחד משולב, וזה מכוון: המצאי
שהציע לקבץ אותם כ"ניצחונות זולים" קיבץ אותם לפי *גודל*, והמחקר למעבר הזה מצא שהם אינם
צמודים זה לזה בקוד — שום קובץ תחת <span dir="ltr">`src/ingest/`</span> אינו מייבא את
`focus.ts` או משהו תחת <span dir="ltr">`src/lesson/`</span>, ו-`focus.ts` אינו מייבא דבר
מקליטה. תיוק שלושתם תחת כותרת אחת היה רומז על צינור שאינו קיים. לכל אחד יש דלת משלו,
היסטוריית כישלונות משלו ו"מה ידוע שלא בסדר" משלו.

## מה שמכוון לא לחזור כאן

לפי הכלל הקבוע של הפרויקט הזה — עותק של עובדה הוא הפגם שהפרויקט הזה בילה את 2026-09-07
במדידתו — הפרקים האלה מפנים אל
<span dir="ltr">`docs/capabilities/16-the-board.md`</span> עבור סימוכין הפקודות המלא של
הלוח ופלט הטרמינל האמיתי, במקום להדפיס אותם שוב, והם מפנים אל פריטי הקורפוס הרלוונטיים
(<span dir="ltr">`DEC-…`, `KNOWN-…`, `TASK-…`</span>) לפי מזהה במקום לצטט את גופם במלואו.
משכו פריט עם <span dir="ltr">`mycontext show <id>`</span> או קראו אותו ישירות תחת
<span dir="ltr">`.my_context/items/`</span>; ציטוט כאן אינו תחליף לקריאה שלו, וכל מזהה
למטה נפתר מול קובץ אמיתי בעץ נכון לתאריך שעל המסמך הזה.

## כל ספירה בכל פרק כאן היא קריאה עם תאריך

הממצא החוזר ביותר במחקר שמאחורי התיקייה הזאת הוא שמספר שהועתק ממסמך הוא מספר שכבר התחיל
להיות שגוי. <span dir="ltr">`docs/capabilities/16-the-board.md:9–11`</span> נושא בעצמו
תיקון שנעשה באותו יום שבו נכתב — כותרת ששני מסמכים קראו לה "200 שורות" התבררה כ-**48**
(<span dir="ltr">`needs.ts:1–48`</span>) כשנספרה ישירות,
ו-<span dir="ltr">`reports/2026-09-16-the-mechanism-map.md:102`</span> השאיר את התיקון גלוי
במקום לערוך את המספר ולהעלים אותו. כל פקודה שמוצגת בפרקים האלה הורצה מול עץ העבודה
ב-**2026-09-17**; הקורא אמור להריץ אותה מחדש, לא לסמוך עליה. שני מספרים זזו בין שתי ריצות
של אותה פקודה באותו יום יחיד — ראו <span dir="ltr">`04` §4</span> — וזו הצורה החדה ביותר
של האזהרה הזאת שהתיקייה הזאת יכולה להציע.

## ראו גם

- [`docs/the-store.he.md`](../the-store.he.md) — הדוגמה המעובדת שממנה נלקחה הצורה של
  התיקייה הזאת (עברית; המבנה, הטבלאות והתרשימים עוברים גם בלי השפה)
- [`docs/capabilities/00-index.md`](../capabilities/00-index.md) — הסימוכין שהתיקייה
  הזאת משלימה
- [`reports/2026-09-16-the-subjects-of-this-system.md`](../../reports/2026-09-16-the-subjects-of-this-system.md) —
  המצאי שזיהה את שבעת הפערים האלה
- [`reports/2026-09-16-the-mechanism-map.md`](../../reports/2026-09-16-the-mechanism-map.md) —
  המעקב ברמת הקוד שממנו נבנו פרקי הלוח, המציג והפלטה של התיקייה הזאת

</div>
