# לתעד את מה שהרגע החלטת, לפני ששוכחים

כל פקודה וכל בלוק פלט בעמוד הזה הורצו מול סביבת עבודה נקייה בזמן הכתיבה. אין כאן
שום דבר להמחשה בלבד.

**נבדק על:** my_context v1.0.2, <span dir="ltr">Node 24, Windows 11</span>.

הערה על הכותרות: ארבע הכותרות הנדרשות מופיעות כאן באנגלית לצד העברית, מפני שבדיקת
הקיום של המוצר מחפשת בדיוק את המחרוזות האנגליות. הטקסט עצמו מתורגם, לא מסוכם.

## What it is for — למה זה נועד

אתה אומר ל-Claude ש"מספרי כרטיס אשראי לעולם לא נכנסים ללוגים". שעתיים אחר כך,
בסשן חדש, Claude כותב `logger.info(card.number)`.

הפתרונות המקובלים לא מחזיקים. `CLAUDE.md` הולך ומתארך, וכל מה שבתוכו נטען בכל סשן
בין אם הוא רלוונטי ובין אם לא. הסבר חוזר עובד עד שחלון ההקשר מתחלף. אף אחד משניהם
לא יודע לענות על השאלה "מה שולט בקובץ הזה?"

תיעוד הוא היכולת שפותרת את זה. הוא שומר את המשפט כ**קובץ במאגר הקוד שלך**, מצמיד
אותו לנתיבים שהוא עוסק בהם, ומאפשר לשאר המוצר להגיש אותו ל-Claude ברגע ש-Claude
נוגע באחד מהם.

## How it works — איך זה עובד

פריט הוא קובץ Markdown אחד תחת `.my_context/items/<category>/`, עם frontmatter
בפורמט YAML וגוף טקסט. שום דבר מעבר לזה. הוא עובר diff, הוא נסקר, והוא שורד גם אם
הכלי יוסר מהמחשב.

**יש 29 קטגוריות, והן יושבות בשתי שכבות.** השכבה היא כל המנגנון, ולכן כדאי לקרוא
עליה לפני הרשימה:

- קטגוריות **נורמטיביות** (16: <span dir="ltr">`constraint`, `invariant`, `rule`, `requirement`,
  `standard`, `pattern`, `glossary`, `instruction`, `non_goal`, `open_question`,
  `runbook`, `procedure`, `environment`, `known_issue`, `exception`, `contract`</span>)
  — אלה אומרות מה חייב להתקיים. הן *מוזרקות*: הן מגיעות לסשן באופן אוטומטי.
- קטגוריות **רציונל** (13: <span dir="ltr">`adr`, `decision`, `lesson`, `tradeoff`, `assumption`,
  `edge_case`, `risk`, `measurement`, `reference`, `plan`, `task`, `todo`,
  `note`</span>) — אלה מתעדות למה. הן לעולם אינן מוזרקות; הן היסטוריה שניתן לחפש בה,
  ואינדקס הסשן מצמצם את כל השכבה למספר בלבד.

`known_issue` נמצאת בצד הנורמטיבי אף שהיא נשמעת כמו עובדה. כל תפקידה הוא "זה
שבור, אל תשקיע בזה מאמץ", והיא לא יכולה למלא את התפקיד הזה משכבה ש-Claude לעולם
אינו קורא. `todo` ו-`note` נמצאות בצד הרציונל מהסיבה ההפוכה בדיוק: הן תיבת
הדואר הנכנס, ואף אחת מהן אינה טוענת דבר. `procedure` היא נורמטיבית מפני שהיא
האחות החד-פעמית של `runbook`.

**הבעלות על הכתיבה קובעת אמון, דרך השכבה.** אתה כותב פריט נורמטיבי — הוא שולט
מיד. *Claude* כותב אחד כזה דרך כלי ה-<span dir="ltr">MCP `create_item`</span> — והוא נוחת כ**טיוטה**
שאינה שולטת בדבר עד שתקדם אותה. סוכן שכותב פריט *רציונל* נוחת פעיל בלי מעשה
אנושי, וזה מכוון — רציונל לעולם אינו מוזרק, ולכן אינו יכול לכוון דבר. הגבול הזה
הוא הנושא של *סקירת שינוי ממתין לפני שהוא שולט*.

שלושה שדות ב-frontmatter קובעים את רוב מה שקורה אחר כך:

- **`summary`** — משפט אחד פשוט לקורא שאינו מכיר את בסיס הקוד הזה. תיעוד מסרב
  בלעדיו (או בלי `--summary-omitted` מפורש).
- **`scope`** — התבניות (globs) שהפריט נצמד אליהן. ריק פירושו כל קובץ.
- **`origin`** — <span dir="ltr">`human`, `agent`</span> או `ingest`. שום כלי אינו מאפשר לקורא לקבוע את
  השדה הזה, וזה מה שגבול האמון בנוי עליו.

## From the CLI — מהשורה

```bash
mycontext add constraint "Card numbers never reach the logs" \
  --scope "src/billing/**" \
  --severity hard \
  --summary "A rule against ever writing a full card number to a log file." \
  --body "Log the last four digits and the processor's reference."
```

שים לב שאין `--yes`. הרצה כזו תסרב, אחרי שתאמר לך בדיוק מה עמדה לעשות:

```console
about to create constraint "Card numbers never reach the logs" — active, and governing this project at once.
my_context: refusing without confirmation — stdin is not interactive. Rerun with --yes to confirm, or run this from an interactive terminal.
```

המשפט הזה עושה עבודה אמיתית. הוא אומר שהפריט יהיה **פעיל**, ושפעיל פירושו *שולט
בפרויקט הזה מיד*. הוסף `--yes`:

```console
my_context: created CONST-card-numbers-never-reach-the-logs (active) at items/constraint/CONST-card-numbers-never-reach-the-logs.md.
```

השמט את התקציר והפקודה תסרב מסיבה אחרת, ולא תיצור דבר:

```console
my_context: this capture carries no summary, and an item created without one can never afterwards be asked for it. […] Nothing was created.
```

### מה נכתב

```markdown
---
id: CONST-card-numbers-never-reach-the-logs
type: constraint
title: Card numbers never reach the logs
status: active
severity: hard
always: false
summary: A rule against ever writing a full card number to a log file.
summary_of: e7377c8d689fd20c
scope:
  - src/billing/**
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 0f5e13431b7c9ebc
---

# Card numbers never reach the logs

Log the last four digits and the processor's reference.
```

**פקודות ה-slash.** לכל קטגוריה יש פקודה משלה, <span dir="ltr">`/mycontext:add-<category>`</span> —
29 כאלה, בתוספת `/mycontext:add` כללית — וכל אחת מציגה תצוגה מקדימה לפני שהיא
כותבת. הן קיימות כדי שתיעוד בתוך סשן לא ידרוש ממך לזכור את דגל הקטגוריה.

**מתוך סוכן**, אותה יכולת היא כלי ה-<span dir="ltr">MCP `create_item`</span>, וזה מה שגורם לתיעוד
נורמטיבי לנחות כטיוטה.

**מה שהשורה יודעת לעשות כאן והממשק לא.** <span dir="ltr">`--always`</span> (בקשה לשכבת ה-pinned כבר
בזמן התיעוד), <span dir="ltr">`--original-id`</span> ו-`--summary-omitted` קיימים רק בשורה. <span dir="ltr">`--note`,
`--observation`, `--step`</span> ו-`--extra` ניתנים לחזרה בשורה; הממשק מרכיב ערך אחד
לכל דגל.

## From the UI — מהממשק

מסך **תיעוד** (`nav.ch`) הוא דלת הכניסה של הדפדפן ליכולת הזו, וההצהרה שלו אומרת
מה הוא מוסיף מעל הטרמינל: *הוא מראה מה כבר שולט לפני שאתה מוסיף עוד אחד*. הוא
מרכיב `add` מתוך בוררים אמיתיים — רשימת הקטגוריות החיה, שדה glob שנבדק מול עץ
הקבצים האמיתי — ולצידם בדיקת החפיפה: הפריטים שכבר שולטים בהיקף שהרגע הקלדת.
הבדיקה הזו היא הסיבה לתעד כאן ולא בטרמינל.

מסך **מרכיב פקודות** מחזיק את אותה כניסת `add` כאחת מ-27 פקודות הקטלוג, אם נוח
לך להרכיב את השורה לצד כל שאר הפעלים.

**מה שהממשק יודע לעשות כאן והשורה לא.** את בדיקת החפיפה. טרמינל יכול לומר לך מה
`add` יייצור; רק המסך הזה אומר לך מה כבר שולט באותם נתיבים, לפני שתוסיף כפילות
כמעט־זהה.

**מה שהממשק אינו יכול לעשות כאן.** הוא אינו יכול לתעד בלי הסכמה מפורשת ממך:
הדפדפן שולח מזהה קטלוג ואוסף ערכים, לעולם לא פקודה, השרת בונה את ה-argv בעצמו,
ומציג לך את השורה המדויקת בדיאלוג אישור לפני שמשהו רץ. `add` יושב על גבול
האמון, ולכן הוא מקבל את האישור המפורט שדה־שדה ולא את הקל. ושלושת הדגלים שקיימים
רק בשורה אינם ניתנים להרכבה כאן כלל.
