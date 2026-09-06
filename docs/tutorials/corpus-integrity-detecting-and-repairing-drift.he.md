# לזהות ולתקן מאגר שסטה מהדיסק

כל פקודה וכל בלוק פלט בעמוד הזה הורצו מול סביבת עבודה נקייה בזמן הכתיבה. אין כאן
שום דבר להמחשה בלבד.

**נבדק על:** my_context v1.0.2, <span dir="ltr">Node 24, Windows 11</span>.

הערה על הכותרות: ארבע הכותרות הנדרשות מופיעות כאן באנגלית לצד העברית, מפני שבדיקת
הקיום של המוצר מחפשת בדיוק את המחרוזות האנגליות. הטקסט עצמו מתורגם, לא מסוכם.

## What it is for — למה זה נועד

הפריטים הם קובצי Markdown פשוטים, וזו כל הנקודה — וזו גם הדרך שבה משהו שאינו
my_context יכול לשנות אותם. עריכה ידנית, מיזוג, סקריפט, סוכן עם גישת מעטפת.

היכולת הזו היא הדרך לגלות שזה קרה, ולהכריע בזה במכוון במקום שכלי יסכים בשקט עם מה
שמצא.

## How it works — איך זה עובד

שלושה סוגי סטייה שונים, והם אינם אותה בעיה:

- **סטיית פריט.** כל פריט נושא `checksum` של התוכן שלו עצמו. `doctor` מחשב אותו
  מחדש ומדווח על כל פריט שהקובץ שלו כבר אינו תואם למה שנרשם.
- **סטיית מקור.** פריט `reference` נושא גם את ה-checksum של *מסמך המקור* שהוא
  צילם. כשהמסמך הזה משתנה, הפריט עדיין מחזיק את הטקסט הישן — והטקסט הישן הזה הוא
  מה שכל סשן שקורא אותו מקבל.
- **סטיית אינדקס.** אינדקס ה-SQLite נגזר מה-Markdown. אפשר למחוק אותו בבטחה,
  ו-`rebuild` יוצר אותו מחדש.

**`doctor` לעולם אינו מתקן דבר בשקט.** כל ממצא מציין את ההשלכה, מאשר ששום דבר לא
נפתר אוטומטית, ונוקב בתרופה המדויקת.

**`repair` מטביע מחדש checksum כך שיסכים עם הקובץ. הוא אינו יכול לשחזר מה שעריכה
הסירה.** הוא נועד לעריכה ידנית מכוונת שאתה עומד מאחוריה, לא לשחזור.

**`refresh` הוא התרופה לסטיית מקור**, והוא מעשה שונה מ-`repair`: הוא מחליף את גוף
הפריט, בשלמותו, בטקסט הנוכחי של קובץ המקור. הכותרת, התצפיות, הקשרים, ההיקף
והתגיות של הפריט נשארים ללא נגיעה.

**`config.json` אינו נושא checksum**, ולכן שום דבר מכל זה אינו מזהה עריכה ידנית
שלו.

## From the CLI — מהשורה

`reference` שהמקור שלו זז:

```console
$ mycontext doctor
source_drift (1)  [warn]
  REF-architecture-overview: "docs/ARCHITECTURE.md" has changed since REF-architecture-overview
    snapshotted it (11464bc9a02d1351 → e308f1fc47813cde). The item still holds the OLD text, and
    that is what any session reading it gets. Nothing was auto-resolved: run `mycontext refresh
    REF-architecture-overview` to take a fresh snapshot, which shows you the size change and asks
    before it writes.

my_context doctor: 0 error(s), 1 warning(s), 0 note(s) across 1 finding(s).
```

התרופה, בתצוגה מקדימה לפני שהיא כותבת:

```console
$ mycontext refresh REF-architecture-overview
about to refresh:
  item        REF-architecture-overview
  type        reference
  source      docs/ARCHITECTURE.md
  checksum    11464bc9a02d1351 -> e308f1fc47813cde
  size        3 -> 3 line(s), ~16 -> ~18 estimated tokens
  budget      this category is on the rationale tier, so the item is never injected in full and costs the injection budget nothing. It is stored, searchable, and counted in the session index. Retiering the category to "normative" in config changes that — and changes what governs this project — see README, "reference".
  the item's title, observations, relations, scope and tags are untouched; only the
  body is replaced, whole, by the file's current text.

my_context: refusing without confirmation — stdin is not interactive. Rerun with --yes to confirm, or run this from an interactive terminal.
```

שלושת הפעלים, ועוד אחד שמכריע ממצא בלי לשנות דבר:

```bash
mycontext doctor            # checksums, סטיית מקור, יתומים, globs מתים, הרשאות
mycontext rebuild           # צור מחדש את האינדקס מה-Markdown
mycontext repair [--yes]    # הטבע מחדש checksums אחרי עריכה ידנית מכוונת
mycontext refresh <id>      # צלם מחדש reference מקובץ המקור שלו
mycontext ack <id> <code>   # רשום שאדם הכריע בממצא, כפי שהפריט עומד
```

`ack` הוא החלופה הישרה לעריכת פריט כדי שבדיקה תפסיק לירות. ההכרעה מעוגנת לפריט
כפי שהוא עומד, ולכן שינוי הפריט מבטל אותה.

**פקודות ה-slash.** <span dir="ltr">`/mycontext:doctor`</span> ו-`/mycontext:refresh`.

**מתוך סוכן**, `doctor` ו-`refresh_item` הם כלי MCP. אין כלי `repair`: הטבעה
מחדש של checksum היא טענה שעריכה ידנית הייתה מכוונת, ורק אדם יכול לטעון אותה.

**מה שהשורה יודעת לעשות כאן והממשק לא.** `ack`. <span dir="ltr">`repair`, `rebuild`</span>
ו-`refresh` נמצאים כולם בקטלוג הפקודות של הדפדפן, ולכן את שלושתם אפשר להריץ
מדפדפן מאחורי אישור; אישור ממצא אי אפשר, וגם לא `doctor --json` או
`doctor --quiet`.

## From the UI — מהממשק

מסך **אבחון** (`nav.ev`) הוא המקום שבו קוראים סטייה בדפדפן: שלושה כרטיסים, אחד
לכל רמה — <span dir="ltr">`error`, `warning`, `notice`</span> — כל שורה נושאת את קוד הממצא שלה,
ממוינים בכל כרטיס לפי הקוד החמור ביותר תחילה. הוא קיים מפני ש*"exit 1 מאבד את
רשימת הממצאים"*: טרמינל מדווח מספר, וזה מדווח את הממצאים שמאחוריו.

<span dir="ltr">`repair`, `rebuild`</span> ו-`refresh` יושבים בקטלוג של **מרכיב הפקודות**. `rebuild`
הוא אחת משלוש הכניסות היחידות מסוג `kind: 'write'` שמסווגות *מתחת* לגבול האמון —
`ack` ו-`lesson-discard` הן שתי האחרות — וכל אחת נושאת את הסיבה שלה במקום להישמט:
האינדקס נגזר מה-Markdown, ולכן בנייה מחדש שלו אינה משנה דבר ששולט בדבר. `repair`
ו-`refresh` נמצאים מעל הגבול ומקבלים את האישור המלא.

**מה שהממשק יודע לעשות כאן והשורה לא.** לשמור כל ממצא גלוי בבת אחת, מקובץ לפי רמה
וקוד, ולעבור מממצא לפריט שהוא נוקב בשמו.

**מה שהממשק אינו יכול לעשות כאן.** לאשר ממצא, לצלם מחדש reference, או לפתור סטייה
בעצמו. כל תרופה היא או מורכבת עבור המעטפת שלך או מורצת דרך אישור שקראת קודם.
