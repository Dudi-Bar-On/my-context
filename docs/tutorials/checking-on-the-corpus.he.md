# לבדוק אם המאגר שלך תקין, ומה מוכן לעבודה

כל פקודה וכל בלוק פלט בעמוד הזה הורצו מול סביבת עבודה נקייה בזמן הכתיבה. אין כאן
שום דבר להמחשה בלבד.

**נבדק על:** my_context v1.0.2, <span dir="ltr">Node 24, Windows 11</span>.

הערה על הכותרות: ארבע הכותרות הנדרשות מופיעות כאן באנגלית לצד העברית, מפני שבדיקת
הקיום של המוצר מחפשת בדיוק את המחרוזות האנגליות. הטקסט עצמו מתורגם, לא מסוכם.

## What it is for — למה זה נועד

שתי שאלות שנשאלות מספיק פעמים כדי להצדיק פקודות משלהן:

- *האם משהו כאן התיישן, נשבר, או פשוט הפסיק לעבוד בשקט?*
- *במה אני באמת יכול להתחיל עכשיו?*

הראשונה היא `doctor` ו-`status`. השנייה היא `ready`. יחד הן היכולת שמונעת ממאגר
להירקב בלי שאיש ישים לב.

## How it works — איך זה עובד

**`status` הוא סיכום של המאגר ושל השימוש בו.** ספירות לפי קטגוריה, סטטוס ומקור;
תור הסקירה; התקדמות ה-ingest; חלון הדעיכה; ושורת בריאות המגולגלת מ-`doctor`. הוא
קורא את האינדקס ואת הרישום ואינו משנה דבר.

**`doctor` הוא אוסף בדיקות עם קודים.** הוא מאמת את ה-checksum השמור של כל פריט מול
הקובץ שלו, עוקב אחרי מסמך המקור של `reference`, מחפש פריטים יתומים, תבניות היקף
מתות, בעיות הרשאה ומזהי סשן כפולים. הוא מדווח על סטייה; הוא לעולם אינו מתקן אותה
בשקט. ממצאים מגיעים בשלוש רמות — <span dir="ltr">`error`, `warning`, `notice`</span> — וקוד היציאה הוא
0 אלא אם יש שגיאות.

**`ack` הוא הדרך שבה ממצא מפסיק להציק בלי להיעלם.** הוא מתעד שאדם הכריע בעניינו,
מעוגן לפריט כפי שהוא כרגע: שנה את הפריט וההכרעה כבר אינה חלה, מפני שהיא הייתה
שיפוט על אותו טקסט.

**`ready` נגזר, ואינו נשמר.** הוא עובר על משימות פתוחות, בודק את ה-`needs` של כל
אחת מול ה-`state` של מה שהיא מציינת, ומדפיס את אלה שכל הצרכים שלהן נענו, לפי סדר
עדיפות. אין מצב `ready` על הדיסק שיוכל להתיישן.

## From the CLI — מהשורה

```console
$ mycontext status
my_context 1.0.2: 3 item(s), profile "standard"

by category
  ┌────────────┬───────┐
  │ category   │ items │
  ├────────────┼───────┤
  │ constraint │ 1     │
  │ lesson     │ 1     │
  │ rule       │ 1     │
  └────────────┴───────┘

by status
  ┌────────┬───────┐
  │ status │ items │
  ├────────┼───────┤
  │ active │ 3     │
  └────────┴───────┘

by origin
  ┌────────┬───────┐
  │ origin │ items │
  ├────────┼───────┤
  │ human  │ 3     │
  └────────┴───────┘

review queue: 0 draft(s) pending review — walk it with `mycontext review`.

usage: no sessions recorded yet — decay reporting starts once items begin to be injected.
  1 active normative item(s) carry no scope, so they apply to every file and compete for the jit
  budget on every file operation.

health: 0 error(s), 0 warning(s), 0 note(s) — details from `mycontext doctor`.
```

האזהרה הזו היא ההרגל השימושי ביותר שהכלי מלמד: **תן היקף לפריטים שלך.** פריט
נורמטיבי ללא היקף נשקל בכל פעולת קובץ, לתמיד.

`doctor` על מאגר תקין אומר זאת בשורה אחת:

```console
$ mycontext doctor
my_context doctor: 0 error(s), 0 warning(s), 0 note(s) across 0 finding(s).
```

ועל מאגר שבו מסמך המקור של `reference` זז מתחתיו:

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

שים לב מה ההודעה הזו עושה: היא מציינת את התוצאה, מאשרת ששום דבר לא תוקן
אוטומטית, ונוקבת בתרופה המדויקת.

`ready` על מאגר בלי משימות אומר מה נמדד, ומה לא:

```console
$ mycontext ready
my_context: no task is ready to start.

Readiness is derived on every run from `needs` and the `state` of what it names — it is stored
nowhere and there is no `ready` state to go stale. A task with no `needs` is ready here because
nothing in the corpus says otherwise, which is a statement about the corpus and not a promise about
the work: a dependency that was only ever written in prose is invisible to this report. `mycontext
doctor` reports the blocked tasks that name nothing.
```

הכרעה על ממצא:

```bash
mycontext ack <id> <finding-code>              # הכרעה אחת, מעוגנת לפריט כפי שהוא
mycontext ack <id> <finding-code> --clear      # ביטולה
mycontext ack --all --code <code> --count <n>  # הכרעה אחת לכל ממצא מקוד אחד
```

**פקודות ה-slash.** <span dir="ltr">`/mycontext:status`, `/mycontext:doctor`</span>
ו-`/mycontext:ready`.

**מתוך סוכן**, <span dir="ltr">`status_report`, `doctor`</span> ו-`ready` הם כלי MCP עם אותן שלוש
תשובות.

**מה שהשורה יודעת לעשות כאן והממשק לא.** `ack` — לדפדפן אין פקד הכרעה, ולכן
הכרעה על ממצא היא פעולת טרמינל. גם `--json` ו-`--quiet` על `doctor`, וגם
`ready --plan` / `--held`, קיימים רק בשורה. ל-`mycontext ready` אין מסך משלו כלל.

## From the UI — מהממשק

שני מסכים, שניהם תחת `nav.ev` — *ראיות — למה כן או לא*:

- **אבחון** מצייר את ממצאי `runChecks` בשלמותם, בשלושה כרטיסים, אחד לכל רמה, וכל
  שורה נושאת את הקוד שלה. המסך קיים מפני ש*"'exit 1' מאבד את רשימת הממצאים"*:
  טרמינל מדווח מספר, וזה מדווח את הממצאים שהפיקו אותו.
- **מצב** הוא החריג המתועד לכלל "בלי טבלאות פשוטות" של הממשק: טבלה, שנשמרה
  כטבלה, שאינה טוענת דבר מעבר לספירות שהיא מחזיקה.

שניהם קריאות. **מרכיב הפקודות** מחזיק בנוסף את `status`, `doctor` ו-`decay`
ככניסות קריאה בקטלוג שלו, כך שאפשר להריץ אחת מהן מהדפדפן ולראות את פלט הטרמינל
האמיתי שלה.

**מה שהממשק יודע לעשות כאן והשורה לא.** להחזיק כל ממצא על המסך בבת אחת, מקובץ
ומסודר לפי חומרת הקוד, ולאפשר מעבר מממצא לפריט שהוא עוסק בו.

**מה שהממשק אינו יכול לעשות כאן.** להכריע בממצא, או לתקן אחד. כל תרופה ש-`doctor`
נוקב בה מורכבת עבורך להרצה, ולעולם אינה מורצת עבורך — למעט דרך מרכיב הפקודות עם
אישור מפורש, שם `repair` ו-`rebuild` הן שתיים מכניסות הכתיבה בקטלוג.
