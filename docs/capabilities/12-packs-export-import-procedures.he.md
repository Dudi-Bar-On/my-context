<!--
  Hebrew mirror of `docs/capabilities/12-packs-export-import-procedures.md`.
  The English file is the source. Conventions: `docs/README.he.md` and
  `docs/the-store.he.md` — Hebrew prose and tables inside `<div dir="rtl">`,
  fenced blocks outside it, `<span dir="ltr">` around any Latin run whose edge
  characters are not both alphanumeric, around any run of two or more Latin
  terms joined by commas or slashes, and — per
  `KNOWN-the-hebrew-convention-says-an-identifier-with-alphanumeric` — around
  any code span that begins with a digit and contains a hyphen.

  Every pasted block is byte-identical to the English file: `pack list`,
  `.demo-pack/manifest.json`, the abridged pack item (its seven omitted
  frontmatter lines named in the Hebrew sentence exactly as the English names
  them), the two `export --dry-run` runs with the English `# ... cut here`
  marker in place, `procedure list`, and the skill frontmatter.

  Heading sequence must stay identical to the English file. The
  "Skills and slash commands" heading is linked from
  `09-cli-and-mcp.he.md` by anchor; do not rename it without fixing that link.
-->

# חבילות, ייצוא/ייבוא, נהלים, ספרי הרצה, מדריכים, ה-skills

<div dir="rtl">

חמש יכולות חולקות את הפרק הזה כי כולן עוסקות בהעברת ידע נורמטיבי על פני גבול — החוצה מסביבת
העבודה הזו לאחרת (חבילות, ייצוא), החוצה מההבחנה בין מתמשך לחוזר בתוך סביבת עבודה אחת (נהלים מול
ספרי הרצה), או החוצה לאדם שלומד את הכלי (מדריכים, skills).

## חבילות

**מה זה.** חבילה היא ממצא נייד — תיקייה או קובץ ZIP — שמחזיק תת-קבוצה (או הכול) של פריטי קורפוס,
ועוד מספיק מ-<span dir="ltr">`config.json`</span> ומ-<span dir="ltr">`history.jsonl`</span> כדי
שיהיה להם מובן, ו-<span dir="ltr">`manifest.json`</span> שנוקב בכל קובץ שהיא מכילה עם ספירת בתים
וגיבוב SHA-256. היא נוסעת כמו שכל קובץ נוסע: מישהו מוסר לכם אותה, או שאתם משכפלים מאגר שיש בו
אחת בנתיב כלשהו. אין רישום ואין משיכה מהרשת בשום מסלול קוד —
<span dir="ltr">`docs/TEMPLATES.md`</span> אומר זאת מפורשות: *"המוצר הזה אינו עושה שום בקשת רשת
כלל, בשום מסלול קוד. חבילה מגיעה אליכם בדרך שכל קובץ אחר מגיע."*

**למה זה קיים.** ידע נורמטיבי שנלכד בפרויקט אחד — "כסף הוא מספר שלם של יחידות משנה", "מספרי
כרטיסים לעולם אינם מגיעים ליומני אפליקציה" — הוא לעיתים קרובות נכון לגבי מחלקה שלמה של פרויקטים,
ולא רק זה שבו נכתב. חבילה היא איך הידע הזה זז בלי שהפרויקט המקבל יבטח בו בשקט: כל מה שחבילה
מביאה פנימה נוחת כ**טיוטה** ואינו שולט בדבר עד שאדם מקדם אותו (אותו צינור טיוטה/קידום כמו כל
לכידה אחרת שנכתבה על ידי סוכן, פרק 3,
[<span dir="ltr">`./03-creation-and-gates.he.md`</span>](./03-creation-and-gates.he.md)).

**איך משתמשים בזה.**

</div>

```
mycontext pack import <path> [--name <text>] [--dry-run] [--json] [--yes] [--overwrite-changed]
mycontext pack list [--json]
mycontext init --pack <path>            # found a whole new workspace from one
mycontext export --out <path> --as-pack --pack-name <name> --pack-version <text>
```

<div dir="rtl">

**דוגמה מעובדת — חבילה אמיתית, שנקראה מהדיסק.** המאגר הזה שולח חבילת הדגמה ב-
<span dir="ltr">`.demo-pack/`</span>, שלא הומצאה עבור המסמך הזה:

</div>

```
$ node src/cli/index.ts pack list
my_context: no packs have been imported into this workspace. `mycontext pack import <path>` reads
one, and `mycontext export --as-pack` writes one.
```

<div dir="rtl">

<span dir="ltr">`.demo-pack/manifest.json`</span> (קובץ אמיתי, 4 פריטים, פרוטוקול
<span dir="ltr">`my_context/pack@1`</span>):

</div>

```json
{
  "protocol": "my_context/pack@1",
  "kind": "pack",
  "name": "billing-starter",
  "version": "1.0.0",
  "generator": "mycontext 1.0.2",
  "itemCount": 4,
  "files": [
    { "path": "config.json", "bytes": 433, "sha256": "b751a42b…" },
    { "path": "history.jsonl", "bytes": 695, "sha256": "de3fba97…" },
    { "path": "items/constraint/CONST-card-numbers-never-reach-application-logs.md", "bytes": 528, "sha256": "4c646ea4…" },
    { "path": "items/glossary/GLOSS-capture.md", "bytes": 416, "sha256": "32696584…" },
    { "path": "items/invariant/INV-a-refund-never-exceeds-the-captured-amount.md", "bytes": 468, "sha256": "33e83672…" },
    { "path": "items/rule/RULE-money-is-an-integer-of-minor-units-never-a-float.md", "bytes": 527, "sha256": "1e1c86e6…" }
  ]
}
```

<div dir="rtl">

אחד מהפריטים שלה, **מקוצץ** — שבע שורות frontmatter (<span dir="ltr">`scope`</span>,
<span dir="ltr">`tags`</span>, <span dir="ltr">`source_file`</span>,
<span dir="ltr">`source_anchor`</span>, <span dir="ltr">`source_checksum`</span>,
<span dir="ltr">`valid_from`</span>, <span dir="ltr">`valid_until`</span>) מושמטות והגוף נעטף
מחדש, אז קראו אותו כצורה ולא כבתים. הוא מראה את הצורה שפריט לובש בתוך חבילה —
<span dir="ltr">`origin: human`</span>, <span dir="ltr">`checksum`</span> טרי, ובלי
<span dir="ltr">`source_file`</span> חי:

</div>

```markdown
---
id: RULE-money-is-an-integer-of-minor-units-never-a-float
type: rule
title: Money is an integer of minor units, never a float
status: active
severity: soft
always: false
origin: human
checksum: f11fbe6a0d72ea84
---

# Money is an integer of minor units, never a float

A float cannot represent a tenth of a cent, and a rounding error that appears
once per transaction appears a million times per month.
```

<div dir="rtl">

**מכניקת הייבוא, מ-<span dir="ltr">`src/cli/commands/pack.ts`</span> ומ-
<span dir="ltr">`src/pack/`</span>.** הערת התיעוד של קובץ הפקודה עצמו (מצוטטת, לא מנוסחת מחדש —
היא קובעת את הסדר במדויק) פורשת שישה צעדים: פענוח תת-הפקודה והדגלים לפני שהקורפוס נפתח; קריאה
ואימות של הממצא; סירובו על הסף אם הוא ייצוא מלא — פסיקה C (2026-09-21, B10): ייצוא הוא ארכיון
להעתיק בחזרה, לא משהו שהפקודה הזאת מייבאת, ו-<span dir="ltr">`mycontext export --as-pack`</span>
הוא מה שיוצר חבילה שניתן לייבא — נבדק על הממצא עצמו, כדי ש-<span dir="ltr">`config.json`</span>
הלא-מוקרן של ייצוא אמיתי לעולם לא ייחשב אשם בסירוב שבאמת נוגע לסוגו — ואחרת הרצת
<span dir="ltr">`planImport`</span> — שהוא טהור, ולכן "כל מה שהוא דוחה
נדחה בלי ששום דבר נכתב"; פענוח <span dir="ltr">`--name`</span> דרך שני הסירובים של
<span dir="ltr">`refusePackName`</span>; **תמיד** הדפסת דוח ההתנגשויות — שממיין את הפריטים
המגיעים לדליי <span dir="ltr">`new`</span> / <span dir="ltr">`changed`</span> /
<span dir="ltr">`identical`</span>, כי סירוב לא אינטראקטיבי אחרת לעולם לא היה אומר על מה הוא
ויתר; אז שער הייבוא (אלא אם <span dir="ltr">`--dry-run`</span>); ואז, רק אם דלי ה-
<span dir="ltr">`changed`</span> מחזיק משהו, שער אישור **שני ונפרד** לדריסות, שמאוית
<span dir="ltr">`--overwrite-changed`</span> באופן לא אינטראקטיבי — במכוון לא נענה על ידי אותו
<span dir="ltr">`--yes`</span> שענה לשער הראשון, כי "הסכמה לייבוא שתיארת" אינה "הסכמה להחלפת פריט
שכתבת בעצמך". דחיית השער השני אינה שגיאה: פריטים חדשים עדיין נוחתים, והמשונים מדווחים ומדולגים,
לעולם לא בשקט.

**צעד שביעי רץ עכשיו לפני כל השישה, והוא הערובה החזקה ביותר במשטח הזה.** נכון ל-
<span dir="ltr">`44b3623b`</span> (2026-09-13), <span dir="ltr">`readArtefact`</span>
(<span dir="ltr">`readArtefact`</span>, <span dir="ltr">`src/pack/reader.ts:262`</span>; הסירוב
ב-<span dir="ltr">`:310–337`</span>) **מסרב לכל הממצא** אם פריט כלשהו נושא
<span dir="ltr">`status`</span>, <span dir="ltr">`severity`</span> או
<span dir="ltr">`origin`</span> מחוץ לאוצר המילים שלו — *"שום דבר לא יובא."* הסירוב נוחת
**לפני** <span dir="ltr">`planImport`</span>, ולכן הוא אינו דלי שדוח ההתנגשויות ממיין; זה הממצא
שלא נקרא בכלל. המקור קובע את האי-סימטריה שהוא בנוי עליה: <span dir="ltr">`parseItem`</span> קורא
ערך מחוץ לאוצר המילים כחבר בטוח וממשיך לטעון, וזו התשובה הנכונה לקובץ בקורפוס של ה**בעלים** —
"הוא שלו לתקן, ואיבוד הפריט היה עונש כבד יותר מהפגם" — והתשובה השגויה כאן, כי זהו "נתיב הקריאה
היחיד שניתן להגיע אליו מקלט שאף אחד בפרויקט הזה לא כתב", והנפילה חזרה "הייתה שותלת פריט בקורפוס
שנושא סטטוס שהשולח בחר והקורא מעולם לא ראה". זה זול (ממצא שהמוצר הזה כתב אינו יכול להיכשל בזה,
מכיוון שכל נתיב כתיבה מריץ <span dir="ltr">`validateEnums`</span>) ורועש, "וזה החצי שהנפילה חזרה
אינה יכולה להיות". <span dir="ltr">`doctor`</span> מדווח על אותו תנאי על הדיסק כ-
<span dir="ltr">`laundered_enum`</span>, בדרגת <span dir="ltr">`error`</span> — ראו
[פרק 1](./01-items-and-corpus.he.md) לגבול הקריאה ו-[פרק 3](./03-creation-and-gates.he.md) לקוד
הממצא.

<span dir="ltr">`src/pack/`</span> מפצל את העבודה לפי עניין — **שנים־עשר קבצים (2026-09-17);
<span dir="ltr">`layout.ts`</span> הוא זה שהרשימה הזו השמיטה** והוא נושא את פריסת הנתיבים על
הדיסק של החבילה. <span dir="ltr">`reader.ts`</span> קורא ומאמת ממצא (תיקייה או zip) מול גיבובי
המניפסט שלו; <span dir="ltr">`collide.ts`</span> מחשב את שלושת דליי ההתנגשות ומרנדר את הדוח
(<span dir="ltr">`collisionJson`</span> / <span dir="ltr">`renderCollisionReport`</span>);
<span dir="ltr">`import.ts`</span> מחזיק את <span dir="ltr">`planImport`</span> (טהור) ואת
<span dir="ltr">`applyImport`</span> (הכתיבה); <span dir="ltr">`manifest.ts`</span> בונה ומאמת
את <span dir="ltr">`manifest.json`</span>, כולל <span dir="ltr">`refusePackName`</span>;
<span dir="ltr">`bundle.ts`</span> ו-<span dir="ltr">`dir-writer.ts`/`zip.ts`</span> הם המקבילות
מצד הייצוא (ראו למטה); <span dir="ltr">`config-io.ts`</span> קורא/כותב את
<span dir="ltr">`config.json`</span> של החבילה עצמה; <span dir="ltr">`history.ts`</span> ו-
<span dir="ltr">`imported-audit.ts`</span> נושאים את רשומות היסטוריית החבילה וביקורת הייבוא;
<span dir="ltr">`screen.ts`</span> מרנדר מטא-נתוני חבילה למסך חבילות התבנית של ממשק הרשת (פרק 8,
[<span dir="ltr">`./08-web-ui.he.md`</span>](./08-web-ui.he.md)).

**מקרה שימוש.** צוות מריץ שלושה שירותים משלוש סביבות עבודה נפרדות של
<span dir="ltr">`my_context`</span> אבל רוצה ש"סכום הוא תמיד מספר שלם של יחידות משנה" ייאכף
בשלושתן. סביבת עבודה אחת לוכדת ומבשילה את הכלל, ואז מייצאת אותו
<span dir="ltr">`--as-pack`</span>; השתיים האחרות עושות לו
<span dir="ltr">`pack import`</span>, סוקרות את הטיוטה שנוצרת, ומקדמות אותה — כשכל סביבת עבודה
מכריעה בעצמה אם הכלל מתאים, ולעולם אינה יורשת אותו בשקט.

## ייצוא / ייבוא כפעולת קורפוס

**מה זה**, בנבדל מחבילה ספציפית: <span dir="ltr">`mycontext export`</span> כותב את הקורפוס של
סביבת העבודה ה*זו* לנתיב מחוצה לה, או בשלמותו ("ייצוא") או מוקרן כחבילה
(<span dir="ltr">`--as-pack`</span>). <span dir="ltr">`--format dir|zip`</span> בוחר את המכל;
<span dir="ltr">`--dry-run`</span> מדפיס את התצוגה המקדימה המדויקת שייצוא היה מייצר ומבצע **אפס
כתיבות** — אומת ישירות מ-<span dir="ltr">`src/cli/commands/export.ts`</span>: בלוק הכתיבה בתחתית
הפקודה נשמר על <span dir="ltr">`if (!request.dryRun && request.out !== null)`</span>, ו-
<span dir="ltr">`--out`</span> אפילו אינו נדרש כש-<span dir="ltr">`--dry-run`</span> מוגדר.

**למה זה קיים**, ולמה התצוגה המקדימה נוקבת במה ש*אינו* נוסע: הערת התיעוד של הפקודה עצמה קובעת
את הנימוק מפורשות — *"רשימת היתר היא רק חצי גילוי. משתמש שמוסר למישהו ייצוא של הקורפוס שלו זכאי
לדעת מה אין בו, באותה נשימה שבה הוא יודע מה יש בו — אחרת ההשמטה מתגלה על ידי המקבל, או לעולם
לא."* <span dir="ltr">`buildBundle`</span> (<span dir="ltr">`src/pack/bundle.ts`</span>) יודע רק
מה הוא הרכיב, ולכן שורת ה*"לא נוסע"* מודפסת על ידי <span dir="ltr">`export.ts`</span> עצמו.

ראוי לציון גם: ל-<span dir="ltr">`export`</span> במכוון **אין <span dir="ltr">`--yes`</span> ואין
שער אישור**, בנימוק המוצהר ש-<span dir="ltr">`confirmAction`</span> שומר על כתיבות ל*קורפוס*,
והפקודה הזו כותבת רק לנתיב שהמשתמש נקב בו בשורת הפקודה — "שער כאן היה שאלה בלי מה להגן עליו,
והוא היה מאמן בדיוק את הרפלקס שהשער בצד הייבוא תלוי בו." <span dir="ltr">`export`</span> נעדר
לכן מקבוצת גבול האישור שמסגרת הטסטים של פרק 13
(<span dir="ltr">`test/helpers/approval-boundary.ts`</span>) גוזרת בשאלה למפענח אילו פקודות מקבלות
<span dir="ltr">`--yes`</span>.

**דוגמה מעובדת — פלט אמיתי, הורץ מחדש לקריאה בלבד מול הקורפוס של המאגר הזה עצמו ב-2026-09-13
(1,235 פריטים; הוא היה 1,108 ב-2026-09-12, אז קראו את הנתונים כקריאה מתוארכת):**

</div>

```
$ node src/cli/index.ts export --dry-run
my_context: about to export 1235 item(s) as a full export
  adr 3   constraint 7   decision 99   instruction 11   invariant 6   known_issue 32   lesson 43
  measurement 1   non_goal 3   note 27   open_question 29   reference 5   requirement 32   rule 56
  standard 15   task 866
  history: 4466 mutation record(s), filtered to mutations and joined to these items
  not travelling: injections, hook actions, focus records, the index, session state,
                  revisions, ingest sessions and staged lessons
  nothing was written — this was a --dry-run. Run it again without --dry-run to write the artefact
  above.

$ node src/cli/index.ts export --dry-run --as-pack --pack-name test-preview --pack-version 1.0.0
my_context: about to export 1235 item(s) as a pack named "test-preview", version "1.0.0"
  adr 3   constraint 7   decision 99   # ... the remaining categories cut here   task 866
  history: 4466 mutation record(s), filtered to mutations and joined to these items
  not travelling: injections, hook actions, focus records, the index, session state,
                  revisions, ingest sessions and staged lessons
  dropped for a pack: source_file on 67 item(s), source_checksum on 97 item(s)
  nothing was written — this was a --dry-run. Run it again without --dry-run to write the artefact
  above.
```

<div dir="rtl">

ההרצה השנייה מדגימה משהו ש-<span dir="ltr">`--dry-run`</span> על
<span dir="ltr">`--as-pack`</span> מרוויח בחינם: היא *גם* מגלה מה הקרנה לחבילה משמיטה בנוסף
ביחס לייצוא מלא — כאן, <span dir="ltr">`source_file`</span> על 67 פריטים ו-
<span dir="ltr">`source_checksum`</span> על 97 — כי חבילה נוסעת למכונה שאין לה את קובצי המקור
האלה, ומצביע מיושן לנתיב על הדיסק של מישהו אחר גרוע יותר מכלום.

**לא נוסע, בכל ייצוא, לפי השורה המודפסת של הכלי עצמו**: הזרקות, פעולות hook, רשומות מיקוד,
האינדקס, מצב סשן, גרסאות, סשני בליעה, ולקחים מבוימים. כל אלה הם מצב שניתן לגזירה מחדש, ולא מקור
ה-Markdown הרשמי — אותו פיצול אמת/אינדקס-נגזר ששולט ב-<span dir="ltr">`.my_context/`</span>
באופן כללי.

**מקרה שימוש.** לפני מסירת תצלום קורפוס לסוקר אבטחה, הריצו
<span dir="ltr">`export --dry-run`</span> קודם כדי לראות בדיוק אילו פריטים וכמה רשומות היסטוריה
היו נוסעים, אשרו ששום דבר בלתי צפוי אינו כלול, ואז הורידו את <span dir="ltr">`--dry-run`</span>
כדי לכתוב באמת את ה-ZIP.

## נהלים מול ספרי הרצה

**ההבחנה**, מצוטטת ישירות מהערת התיעוד של הקטגוריה <span dir="ltr">`procedure`</span> ב-
<span dir="ltr">`src/core/categories.ts`</span> (הערת התיעוד של
<span dir="ltr">`procedure`</span>, מיד אחרי ההגדרה של <span dir="ltr">`runbook`</span>):

> *"האח החד-פעמי של <span dir="ltr">`runbook`</span>, והזוג מכוון (מפרט §6o).
> <span dir="ltr">`runbook`</span> הוא **חוזר**: הוא מבוצע בכל פעם שהפעולה הנקובה עולה, והוא
> שולט כל עוד הפעולה קיימת. <span dir="ltr">`procedure`</span> מבוצע **פעם אחת** — הגירה, תיקון
> נתונים, תיקון חד-פעמי — ואז הוא גמור, וזו הסיבה שהוא הקטגוריה שנושאת מחזור חיים ו-
> <span dir="ltr">`runbook`</span> לא. קיפול השניים לאחד היה מאבד את התכונה שהופכת את החד-פעמי
> לישר: הוא מפסיק להיות מוזרק כשהוא גמור.
>
> המבחן שכותב מיישם, וזה אותו משפט שקובץ הנושא, שני ה-README ושני פלטי
> <span dir="ltr">`examples`</span> נותנים: תעשו את זה שוב בפעם הבאה שהמצב יתעורר? אז זה
> <span dir="ltr">`runbook`</span>. זה נעשה פעם אחת ואז גמור? אז זה
> <span dir="ltr">`procedure`</span>.
>
> **נורמטיבי**, כמו <span dir="ltr">`runbook`</span>, ובשונה מ-<span dir="ltr">`todo`</span>/
> <span dir="ltr">`note`</span>: נוהל פעיל מוזרק במלואו, נקוב באינדקס, ואחד שנכתב על ידי סוכן
> נוחת <span dir="ltr">`draft`</span> דרך <span dir="ltr">`trustedStatus`</span> בלי יוצא מן
> הכלל בשום מקום."*

שתי הקטגוריות נורמטיביות (פרק 1,
[<span dir="ltr">`./01-items-and-corpus.he.md`</span>](./01-items-and-corpus.he.md)), תחיליות
<span dir="ltr">`RUN`</span> ו-<span dir="ltr">`PROC`</span> בהתאמה, ומופעלות כברירת מחדל. רק
<span dir="ltr">`procedure`</span> מקבל פקודת מחזור חיים — <span dir="ltr">`mycontext procedure`</span>
מסרב ל-<span dir="ltr">`runbook`</span> בשמו, והסירוב מכוון ולא פער, כי "לספר הרצה אין מחזור
חיים… הוא מבוצע שוב בכל פעם שהפעולה הנקובה עולה."

**מחזור החיים של נוהל**, מהטבלה של <span dir="ltr">`src/cli/commands/procedure.ts`</span> עצמו
(מצוטטת, הערת קוד אמיתית):

</div>

<div dir="rtl">

| שלב | ייצוג | מזריק | פקודה |
|-----------|------------------------------------|----------------------------------|----------------------------------------|
| מוצע | <span dir="ltr">`status: draft`</span> | כלום | <span dir="ltr">`mycontext add procedure …`</span> |
| מוכן | <span dir="ltr">`status: draft`</span> + תגית <span dir="ltr">`ready`</span> | כלום, אפילו לא שורת אינדקס | <span dir="ltr">`mycontext edit <id> --tags …`</span> |
| פעיל | <span dir="ltr">`status: active`</span> + <span dir="ltr">`always: true`</span> | את הבלוק המלא, בכל סשן | <span dir="ltr">`mycontext procedure activate`</span> |
| גמור | <span dir="ltr">`status: deprecated`</span> | כלום; נספר ב-<span dir="ltr">`retired`</span> | <span dir="ltr">`mycontext procedure done`</span> |
| ננטש | <span dir="ltr">`status: superseded`</span> | כלום | <span dir="ltr">`mycontext supersede <id> --by <id>`</span> |

</div>

<div dir="rtl">

שום דבר לא נוסף ל-enum של <span dir="ltr">`Status`</span> בשביל זה — כל מחזור החיים הוא הקרנה
מעל <span dir="ltr">`status`</span> + <span dir="ltr">`always`</span> + תגית
<span dir="ltr">`ready`</span> שכבר הייתה קיימת למטרות אחרות.

**מעקב הצעדים אינו נשמר בפריט.** סימון (<span dir="ltr">`procedure step <id> <n>`</span>) כותב
רשומת ביקורת <span dir="ltr">`progress`</span> אחת
(<span dir="ltr">`PROGRESS_OPS = ['step-done', 'step-undone', 'step-reset']`</span> ב-
<span dir="ltr">`src/core/audit.ts`</span>), שמשוחזרת לפי דרישה על ידי
<span dir="ltr">`src/core/progress.ts`</span>. הערת התיעוד של
<span dir="ltr">`procedure.ts`</span> מפורשת לגבי למה: *"למה <span dir="ltr">`step`</span> אינו
כותב פריט, אינו לוקח נעילת כתיבה לאינדקס, ומשאיר את ה-checksum של הקובץ בדיוק היכן שהיה — ולמה
<span dir="ltr">`show`</span> אומר בקול רם שה-<span dir="ltr">`- [x]`</span> שהוא מדפיס הוא
מרונדר ולא שמור."* זו אותה משמעת שפרק 1 מתעד עבור שדות <span dir="ltr">`state:`</span> באופן
כללי — תיבת הסימון המרונדרת היא תצוגה, לעולם לא הרישום עצמו — וזו גם הסיבה שההתקדמות תחומה
לסביבת עבודה, ולא לסשן: שני טרמינלים על אותה סביבת עבודה חולקים קבוצת רשומות אחת (הערת שורת
פקודה אמיתית, שנלכדה למטה).

**דוגמה מעובדת — פלט אמיתי לקריאה בלבד מול המאגר הזה (0 נהלים קיימים כאן היום):**

</div>

```
$ node src/cli/index.ts procedure list
0 procedure(s). Capture one with `mycontext add procedure "<title>" --step "..."`.
note: progress is recorded per workspace, not per session — two terminals on this workspace share
      one record set.
```

<div dir="rtl">

**מקרה שימוש.** הגירת נתונים חד-פעמית ("שנו את שם העמודה <span dir="ltr">`amount_cents`</span>
בכל מקום ומלאו לאחור את השורות הישנות") נלכדת כ-<span dir="ltr">`procedure`</span> עם רשומות
<span dir="ltr">`--step`</span> לכל שלב, מופעלת כך שכל סשן רואה אותה במלואה עד שהיא נגמרת,
מסומנת צעד אחר צעד על פני כמה סשנים שזה לוקח, ואז מסומנת <span dir="ltr">`done`</span> — ובנקודה
ההיא היא מפסיקה להיות מוזרקת ונספרת רק בסך הגנוזים. פעולה חוזרת ("איך אנחנו מגלגלים תיקון חם")
נלכדת כ-<span dir="ltr">`runbook`</span> במקום, ונשארת מוזרקת ללא הגבלה כי אין מצב "גמור" למשהו
שמבוצע שוב בפעם הבאה.

## מדריכים

**מה זה.** תיעוד מיוצר מהמשטחים של המוצר עצמו, ונבדק מולם, ולא פרוזה שמתוחזקת ביד ויכולה להיסחף.
רשימת המדריכים לכל יכולת חיה ב-<span dir="ltr">`docs/tutorials/manifest.json`</span> שנעשה לו
check-in (24 רשומות ב-2026-09-17, נספרו בפענוח
<span dir="ltr">`docs/tutorials/manifest.json`</span>), כשכל רשומה היא
<span dir="ltr">`TutorialManifestEntry`</span> (<span dir="ltr">`src/core/tutorial-manifest.ts`</span>)
שנוקבת ב: <span dir="ltr">`id`</span> יציב ב-kebab-case; <span dir="ltr">`title`</span> שמנוסח
כ*"עבודה שקורא מנסה לעשות, לא שם של יכולת"*; <span dir="ltr">`tier`</span>
(<span dir="ltr">`basic`</span> | <span dir="ltr">`advanced`</span>); וקובצי המשטח הקונקרטיים
שהיא תובעת — שמות קובצי פקודות <span dir="ltr">`cli`</span>, שמות קובצי פקודות
<span dir="ltr">`slash`</span> (מ-<span dir="ltr">`commands/*.md`</span>), שמות קובצי
<span dir="ltr">`screens`</span> (מ-<span dir="ltr">`src/ui/public/screens/*.js`</span>), ומפתחות
<span dir="ltr">`categories`</span>.

**איך זה נשאר ישר.** <span dir="ltr">`scripts/build-tutorial-manifest.ts`</span> (מורץ ביד דרך
<span dir="ltr">`npm run gen:tutorials`</span>) *גוזר* את המניפסט בהרצת גלוב על ארבעת המשטחים
האמיתיים — פקודות שורת פקודה, פקודות סלאש, מסכי ממשק רשת, קטגוריות — ומאשכל אותם ליכולות;
<span dir="ltr">`test/core/tutorial-manifest.test.ts`</span> מריץ גלוב מחדש על אותם ארבעה משטחים
באופן בלתי תלוי ונכשל, **בנקיבה בקובץ**, ברגע שמופיע משהו שנתבע פעמיים או בכלל לא. זה אומר
שפקודת שורת פקודה חדשה או מסך ממשק רשת חדש שלא נתבעו שוברים טסט ולא פשוט לא מקבלים מדריך בשקט —
אותה משמעת "אין פער שקט" שעוברת לאורך כל המוצר הזה
(<span dir="ltr">`INV-nothing-is-dropped-silently`</span> של פרק 1, שמצוטט על ידי פרק אח).

רשומה אמיתית, <span dir="ltr">`capturing-an-item-and-the-categories`</span> (הראשונה במניפסט):
כותרת *"לכדו את מה שזה עתה הכרעתם, לפני שתשכחו"*, תובעת **30 קובצי סלאש — 29
<span dir="ltr">`add-*.md`</span> ועוד <span dir="ltr">`add.md`</span>** — את המסך
<span dir="ltr">`capture.js`</span>, וכל 29 מפתחות ה-<span dir="ltr">`CATEGORIES`</span>. לכל
מדריך אותם ארבעה סעיפים לפי <span dir="ltr">`docs/TUTORIAL.md`</span>: למה הוא, איך הוא עובד,
איך משתמשים בו משורת הפקודה, ואיך משתמשים בו מממשק הרשת — "כשכל משטח אומר מה הוא יכול ומה הוא
אינו יכול, כי הם אינם אותו דבר."

**איפה הם חיים.** כל רשומה מצביעה על קובץ אנגלי וקובץ עברי
(<span dir="ltr">`enFile`/`heFile`</span>) תחת <span dir="ltr">`docs/tutorials/`</span> — למשל
<span dir="ltr">`capturing-an-item-and-the-categories.md`</span> והתאום
<span dir="ltr">`.he.md`</span> שלו, שניהם קיימים על הדיסק.
<span dir="ltr">`docs/TUTORIAL.md`</span> עצמו הוא עכשיו דף הפניה, ולא תוכן המדריך — ציטוט
אמיתי ובדוק: *"הדף הזה עבר. הוא נהג להיות פרק ארוך אחד של 'עשרים הדקות הראשונות'. המדריכים הם
עכשיו קובץ אחד לכל יכולת… שמוגשים על ידי המוצר עצמו — פתחו את ממשק הרשת
(<span dir="ltr">`mycontext ui`</span>) וקראו אותם במסך המדריכים, או קראו את ה-Markdown
ישירות."* <span dir="ltr">`docs/TUTORIAL.md`</span> מונה שישה מדריכים ב"דרג הבסיסי" שנקראים
ראשונים (לכידה ← טעינת הקשר ← חיפוש ← בדיקת בריאות ← תיבת דואר נכנס ← ממשק רשת) ומצביע הלאה אל
<span dir="ltr">`docs/TUTORIAL-ADVANCED.md`</span> לשאר.

**מקרה שימוש.** תורם חדש שואל "איך אני מחפש בקורפוס?" — במקום לכתוב תשובה טרייה ב-Slack, הפנו
אותו ל-<span dir="ltr">`docs/tutorials/reading-and-searching-the-corpus.md`</span> (או למסך
המדריכים בממשק הרשת, פרק 8), בידיעה שהמדריך מאומת כמי שמעולם לא יצא בשקט מסנכרון עם פקודות
<span dir="ltr">`search`/`query`</span> האמיתיות של שורת הפקודה.

## תבניות (תיקיית החבילות)

<span dir="ltr">`docs/TEMPLATES.md`</span> הוא משטח הגילוי האחד והיחיד לחבילות, והוא במכוון
ובכנות ריק היום — ציטוט אמיתי ובדוק: *"הרשימה. היא ריקה. זה אינו פספוס וזה אינו מציין מקום. שום
חבילה עדיין לא פורסמה, ולכן רשימה שנזרעה בדוגמאות שנראות סבירות הייתה מסמך שמשקר ביום שהוא
נשלח… היא נשארת ריקה עד שיהיה משהו אמיתי לשים בה."* כשרשומה כן קיימת, היא נושאת **קישור** ו**שם
כותב**, "כי אלה שני הדברים שאדם צריך כדי להכריע אם להריץ
<span dir="ltr">`mycontext pack import`</span> עליה" — ואף אחד מהם אינו מאומת על ידי המאגר הזה;
זה מנוהל ביד.

## Skills ופקודות סלאש

התוסף הזה שולח **skill** אחד של Claude Code, <span dir="ltr">`skills/mycontext/SKILL.md`</span>
(אומת על הדיסק — הקובץ היחיד תחת <span dir="ltr">`skills/mycontext/`</span>). ה-frontmatter שלו:

</div>

```yaml
name: mycontext
description: Use when project knowledge is at stake — a constraint, requirement,
  decision, rule or lesson is being established, or you are about to assume how
  this project works. Captures normative knowledge as Markdown and retrieves
  what already governs.
```

<div dir="rtl">

הגוף של ה-skill מלמד סוכן לקרוא ל-<span dir="ltr">`create_item`</span> (כלי ה-MCP, פרק 9,
[<span dir="ltr">`./09-cli-and-mcp.he.md`</span>](./09-cli-and-mcp.he.md)) **בתור שבו הידע
נקבע**, אומר מחדש את פיצול הדרגים נורמטיבי/נימוקי מפרק 1 בשפה פשוטה לסוכן שמכריע לאן משהו נוחת,
ומצביע על <span dir="ltr">`mycontext_help`/`mycontext_examples`</span> לכל דבר לא ודאי. זהו
ה-skill <span dir="ltr">`mycontext:mycontext`</span> שנראה ברשימת ה-skills של הסשן הזה ממש —
התוכן שלו הוא בדיוק הקובץ הזה.

<span dir="ltr">`mycontext:LoadMyContext`</span> (גם הוא נראה ברשימת ה-skills של הסשן הזה) מתאים
ל-<span dir="ltr">`commands/LoadMyContext.md`</span> בשורש המאגר. לצידו,
<span dir="ltr">`commands/`</span> שולח **91 קובצי פקודות סלאש** —
<span dir="ltr">`ls commands/*.md | wc -l`</span>, 2026-09-13, והתיקייה מחזיקה רק קובצי
<span dir="ltr">`.md`</span>. החשבון בדף הזה הוא הבדיקה של עצמו: **29
<span dir="ltr">`add-*.md`</span> + 29 <span dir="ltr">`list-*.md`</span> + 32 בני מילה אחת +
<span dir="ltr">`LoadMyContext.md`</span> = 91.** <span dir="ltr">`add-<category>.md`</span> אחד
ו-<span dir="ltr">`list-<category>.md`</span> אחד לכל קטגוריה
(<span dir="ltr">`add-adr.md`</span> … <span dir="ltr">`add-tradeoff.md`</span>,
<span dir="ltr">`list-adr.md`</span> … <span dir="ltr">`list-tradeoff.md`</span>), ועוד פקודות
בנות מילה אחת שמשקפות את <span dir="ltr">`add`</span>, <span dir="ltr">`audit`</span>,
<span dir="ltr">`decay`</span>, <span dir="ltr">`discard`</span>,
<span dir="ltr">`doctor`</span>, <span dir="ltr">`edit`</span>, <span dir="ltr">`focus`</span>,
<span dir="ltr">`handover`</span>, <span dir="ltr">`harden`</span>,
<span dir="ltr">`inbox-promote`</span>, <span dir="ltr">`ingest`</span>,
<span dir="ltr">`lesson`</span>, <span dir="ltr">`lesson-stage`</span>,
<span dir="ltr">`link`</span>, <span dir="ltr">`pin`</span>,
<span dir="ltr">`procedure`</span>, <span dir="ltr">`promote`</span>,
<span dir="ltr">`query`</span>, <span dir="ltr">`ready`</span>,
<span dir="ltr">`refresh`</span>, <span dir="ltr">`review`</span>,
<span dir="ltr">`search`</span>, <span dir="ltr">`session-carry`</span>,
<span dir="ltr">`session-name`</span>, <span dir="ltr">`show`</span>,
<span dir="ltr">`soften`</span>, <span dir="ltr">`status`</span>,
<span dir="ltr">`supersede`</span>, <span dir="ltr">`todo`</span>, <span dir="ltr">`ui`</span>,
<span dir="ltr">`unlink`</span>, <span dir="ltr">`unpin`</span>. הרישום מוכרז ב-
<span dir="ltr">`.claude-plugin/plugin.json`</span> (שם <span dir="ltr">`mycontext`</span>,
גרסה 1.0.2) וב-<span dir="ltr">`.claude-plugin/marketplace.json`</span>, וכך Claude Code מגלה גם
את ה-skill וגם את פקודות הסלאש כשהתוסף הזה מותקן.

## מה **לא** בנוי / בנוי אך כבוי

- **הרצת <span dir="ltr">`pack import --json`</span> או <span dir="ltr">`export --json`</span>
  כושלת פולטת מעטפת JSON על stdout, ולא פרוזה** — <span dir="ltr">`src/cli/json-envelope.ts`</span>,
  חדש 2026-09-13, כשקוד היציאה ללא שינוי והרצה שונה מאפס שהגוף שלה כבר מתפענח כ-JSON מועברת
  כמות שהיא. כל בלוק <span dir="ltr">`--json`</span> בפרק הזה הוא צורת *הצלחה*; ראו
  [פרק 3](./03-creation-and-gates.he.md) לצורת הכישלון.
- **אין רישום חבילות, אינדקס, או ערוץ עדכון** — <span dir="ltr">`docs/TEMPLATES.md`</span> קובע
  שזה מכוון, לא פער שיש למלא: *"אין רישום, אין משיכה מחדש, אין ערוץ עדכון ואין בדיקת גרסה מעל
  הרשת."* עדכון חבילה פירושו לייבא מחדש ממצא חדש יותר שמשכתם בעצמכם; אין פקודת
  <span dir="ltr">`pack update`</span>.
- **הרשימה של <span dir="ltr">`docs/TEMPLATES.md`</span> ריקה באמת** — שום חבילה לא פורסמה בשום
  מקום שהפרויקט מנהל, ולכן אין חבילת צד שלישי אמיתית להדגים מעבר ל-
  <span dir="ltr">`.demo-pack/`</span> של המאגר עצמו.
- **לסביבת העבודה הזו יש 0 נהלים ו-0 חבילות מיובאות כרגע** — אומת בפלט אמיתי של
  <span dir="ltr">`procedure list`</span> ו-<span dir="ltr">`pack list`</span> למעלה; הדוגמאות
  המעובדות לשתי הפקודות האלה הן בהכרח "אין כאן כלום עדיין" ולא דוגמה מאוכלסת, וזה עצמו מלמד על
  כמה נדיר שהמתחזקים של המאגר הזה עצמו מושיטים יד לקטגוריית מחזור החיים החד-פעמי.
- שאלה פתוחה שכבר רשומה בקורפוס הזה, שנמצאה בזמן החיפוש —
  <span dir="ltr">`OPENQ-does-export-import-ever-import-or-is-a-third-of-that-screen`</span> —
  מסמנת שהיחס של מסך הייצוא/ייבוא בממשק הרשת להתנהגות ייבוא ממשית עדיין לא הוכרע; התייחסו לכל
  קביעה מצד ממשק הרשת על המסך ההוא (פרק 8) כזמנית עד שהשאלה ההיא תיפתר. נמצאו גם:
  <span dir="ltr">`NOTE-packs-is-the-app-ahead-of-its-design-and-well-defended`</span>,
  <span dir="ltr">`TASK-export-as-pack-has-no-unicode-screen-so-a-hostile-pack-name`</span>,
  <span dir="ltr">`TASK-export-wire-screenpackmeta-which-is-written-but-never-called`</span>, ו-
  <span dir="ltr">`TASK-pack-import-name-bypasses-refusepackname-and-screenpackmeta`</span> —
  ארבעה פריטים חיים ופתוחים שרושמים קצוות מחוספסים ידועים ספציפיים במשטח החבילות/הייצוא,
  מצוטטים כאן ולא נאמרים מחדש, לפי משמעת הציטוט של הפרויקט הזה עצמו.

## ראו גם

- [אינדקס](./00-index.he.md)
- [פריטים והקורפוס](./01-items-and-corpus.he.md) — צינור הטיוטה/הקידום שכל פריט מיובא עובר דרכו.
- [שורת הפקודה ושרת ה-MCP](./09-cli-and-mcp.he.md) — סימוכין הפקודות המלא, כולל
  <span dir="ltr">`create_item`</span>.

</div>
