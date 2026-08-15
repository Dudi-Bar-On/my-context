<!--
  Two conventions in this file, both about right-to-left rendering, both
  established by rendering this file through GitHub's own markdown API and
  reading the result in a browser rather than by reasoning about the source.

  1. Hebrew prose lives inside `<div dir="rtl">` blocks. Fenced code and Mermaid
     blocks are deliberately left OUTSIDE them: inside an RTL container the
     bidi algorithm reverses the runs in a box-drawing table, and every
     generated example here is one.
  2. Any Latin-script run that must read left-to-right on its own is wrapped in
     `<span dir="ltr">…</span>`. GitHub's sanitizer keeps the `dir` attribute,
     and an element carrying `dir` is a bidi isolate, so both the run and the
     punctuation beside it resolve correctly. Two cases need it. A code span
     whose first or last character is not alphanumeric: without the wrapper
     `<id>` renders with its angle brackets mirrored and `--json` renders as
     `json--`. And any run of two or more Latin terms separated by commas or
     slashes: without the wrapper each term becomes its own island, the run
     reads back to front, and every comma attaches to the wrong side. A code
     span whose two edge characters are both alphanumeric needs nothing.

  An earlier revision used U+200E LEFT-TO-RIGHT MARK beside code spans instead.
  It renders a single span correctly but cannot hold a multi-term run together,
  and it is invisible in a diff, so it was replaced wholesale.

  Section structure and the example markers must stay identical to README.md;
  `npm test` fails otherwise. Do not write a literal comment terminator inside
  this block: an earlier revision quoted one, which closed the comment early and
  leaked three lines of these notes onto the rendered page above the title.
-->

# my_context

<div dir="rtl">

**תוסף ל-Claude Code שזוכר את הכללים של הפרויקט שלך, כדי שתפסיק לחזור עליהם.**

אתה מסביר ל-Claude איך הפרויקט הזה עובד. הסשן הבא מעולם לא שמע על זה. my_context לוכד
את הכללים האלה כקובצי Markdown בתוך המאגר שלך, ומחזיר את הרלוונטיים שבהם אל Claude
מעצמו — נעוצים בתחילת הסשן, או ברגע שהוא עומד לפתוח קובץ שהם חלים עליו.

</div>

![Node 24 or newer](https://img.shields.io/badge/node-%E2%89%A5%2024-informational)
![Zero runtime dependencies](https://img.shields.io/badge/runtime%20dependencies-0-informational)
![Markdown is the source of truth](https://img.shields.io/badge/storage-markdown%20in%20your%20repo-informational)
![MIT licence](https://img.shields.io/badge/licence-MIT-informational)

<div dir="rtl">

Node 24 ומעלה, בלי תלויות זמן ריצה ובלי שלב בנייה — קובצי המקור של TypeScript מורצים
ישירות. מופץ תחת [רישיון MIT](../LICENSE). ממהרים? [התקנה](#התקנה).

**אם מילה או <span dir="ltr">`--flag`</span> כאן אינם מובנים מאליהם, יש לאן לקפוץ.** כל
מונח שהמסמך הזה נותן לו משמעות מסוימת מוגדר ב[מילון המונחים](#9-מילון-מונחים). כל אפשרות
של שורת הפקודה יושבת בטבלה אחת: [כל הדגלים, במקום אחד](#כל-הדגלים-במקום-אחד). המונחים
מוסברים גם בשפה פשוטה במקום הראשון שבו הם מופיעים, כך שקריאה רצופה מההתחלה לסוף אינה
מחייבת אף אחת מהשתיים.

זו הגרסה העברית של [README.md](../README.md). המסמך האנגלי הוא המקור. מבנה הפרקים ובלוקי
הדוגמאות של שני הקבצים נשמרים זהים, אבל שום בדיקה אינה יכולה לקבוע שהתרגום עדכני. פסקה
כאן יכולה להישאר מאחור אחרי שינוי באנגלית, ובמקרה של סתירה — האנגלית קובעת.

## תוכן העניינים

1. [הבעיה](#1-הבעיה)
2. [הרעיון](#2-הרעיון)
3. [איך זה עובד, בשלושה צעדים](#3-איך-זה-עובד-בשלושה-צעדים)
4. [מתי זה חוזר, ומה](#4-מתי-זה-חוזר-ומה)
5. [שימוש](#5-שימוש) — [התקנה](#התקנה), [פקודות סלאש](#מה-שאתה-מקליד-פקודות-הסלאש), [שורת הפקודה](#מה-שאתה-מריץ-שורת-הפקודה), [כלי MCP](#מה-שהמודל-קורא-לו-כלי-ה-mcp), [כל הדגלים](#כל-הדגלים-במקום-אחד)
6. [תצורה](#6-תצורה)
7. [גבול האמון](#7-גבול-האמון)
8. [עדיין לא זמין](#8-עדיין-לא-זמין)
9. [מילון מונחים](#9-מילון-מונחים) — כל מונח שהמסמך הזה נותן לו משמעות מסוימת

## 1. הבעיה

אתה עובד על תהליך תשלום. אתה אומר ל-Claude: *מחירים הם מספר שלם של סנטים, אף פעם לא
דולרים בנקודה צפה — שגיאת העיגול בכל המרה היא הסיבה שהסכום הכולל לא התאים לשורות הפריטים
ברבעון שעבר.* Claude מסכים, מתקן את הקוד, והסשן נגמר.

יומיים אחר כך אתה פותח סשן חדש ומבקש תכונת הנחה. Claude כותב `price * 0.9`, ושגיאת
העיגול חזרה.

שום דבר לא התקלקל. הזיכרון של סשן נגמר כשהסשן נגמר. כל מה שהסברת — הנימוקים, התיקונים,
ה"לא, לא ככה" — הלך איתו.

### למה הדבקה מחדש לא פותרת את זה

הפתרון המתבקש הוא להדביק את הכללים שוב בתחילת כל סשן. הוא נכשל בשלוש דרכים בבת אחת.

- **אתה שוכח.** לא תמיד — רק בסשן שבו זה היה חשוב.
- **זה נודד.** כשמדביקים מהזיכרון, הכלל יוצא קצת אחרת בכל פעם. "סנטים שלמים" הופך
  ל"להימנע מנקודה צפה", שזו עצה ולא כלל, והסשן הבא מפרש אותו רופף יותר מקודמו.
- **זה עולה בכל סשן.** הכללים שלך נקראים ומחויבים מחדש בכל פעם. כשיש לך תריסר מהם, רוב
  מה שאתה מדביק אינו נוגע כלל לקובץ שאתה עומד לגעת בו.

### למה `CLAUDE.md` לבדו לא מספיק

`CLAUDE.md` הוא שיפור אמיתי לעומת הדבקה: Claude Code טוען אותו אוטומטית, כך שלפחות
הכללים מגיעים בלי שתעשה דבר. יש לו ארבע מגבלות שצצות ברגע שפרויקט גדול מקטן.

- **הוא סטטי.** הוא אומר את אותו הדבר בכל סשן, לא משנה במה אתה עוסק.
- **הוא חסר היקף.** אין דרך לומר "זה חל רק על קוד חיוב". כל כלל חל על כל קובץ באותה מידה,
  ובפועל זה אומר שכל כלל הוא רעש רקע לרוב העבודה.
- **הוא לא מבדיל.** "השתמש בהזחה של שני רווחים" יושב שם ליד "לעולם אל תכתוב כתובת דוא"ל
  של לקוח ליומן". שום דבר לא מסמן שהאחד הוא העדפה והשני חשיפה משפטית.
- **הוא גדל עד שרק מרפרפים עליו.** כל כלל שאתה מוסיף מאריך את הקובץ, וקובץ ארוך מתחרה
  בעצמו על תשומת הלב. שום דבר בו לא יוצא לגמלאות, מפני ששום דבר בו לא מתעד מתי הוא היה
  רלוונטי בפעם האחרונה.

### המחיר שאתה באמת מרגיש

זה לא באמת עניין של טוקנים. זה שאתה נותן את אותו התיקון שוב ושוב והוא אף פעם לא נדבק.
אחרי הפעם השלישית אתה מפסיק לסמוך על העבודה ומתחיל לבדוק אותה. הזמן נשרף על הסבר חוזר של
החלטות שכבר קיבלת, במקום על קבלת חדשות.

my_context סוגר את הלולאה הזאת: אתה לוכד כלל פעם אחת, והחלק הרלוונטי ממה שלכדת חוזר
מעצמו, כשהוא חל.

</div>

```mermaid
flowchart TB
  A["אתה מסביר את הכלל"] --> B["Claude מיישם אותו"]
  B --> C["הסשן נגמר,<br/>והכלל נגמר איתו"]
  C -->|"הסשן הבא"| A
  A -.->|"לוכדים פעם אחת"| D["<b>.my_context/</b><br/>Markdown במאגר שלך"]
  D -.->|"נעוץ בתחילת סשן, או<br/>כשנפתח קובץ שבהיקפו"| B
  linkStyle 3,4 stroke:#2e7d32
```

<div dir="rtl">

החצים המלאים הם הלולאה שאתה נמצא בה היום. המקווקווים הם מה ש-my_context מוסיף: לכידה
אחת, ומסלול חזרה שלא תלוי בזה שתזכור.

## 2. הרעיון

my_context מחלק את מה שפרויקט יודע לשני סוגים, ומתייחס אליהם אחרת.

**ידע נורמטיבי** הוא מה שחייב להתקיים. אילוצים, אינווריאנטות, כללים, דרישות, תקנים,
תבניות, מונחים, הוראות, לא-מטרות ושאלות פתוחות. *מחירים הם סנטים שלמים.* *לעולם אל
תכתוב כתובת דוא"ל של לקוח ליומן.* *ה-pool של החיבורים מוגבל ל-20.* אלה עונים על השאלה
**"מה אסור לי לפספס כאן?"**

**נימוקים** (rationale) הם הסיבה שהפרויקט הוא כפי שהוא. החלטות, מסמכי ADR, לקחים, פשרות,
הנחות, מקרי קצה, סיכונים. *בחרנו ב-Stripe על פני Adyen כי תזמון הסליקה התאים ללוח
התשלומים שלנו.* *סופות ניסיונות חוזרים צריכות ריווח אקראי — למדנו את זה בדרך הקשה
במרץ.* אלה עונים על **"למה זה ככה?"**

שני הסוגים ראויים לשמירה. רק הראשון שולט.

שלוש מילים במשפט האחרון משמשות במסמך הזה במובן מדויק. כדאי לקבע אותן לפני שבונים עליהן.

- **הזרקה** היא my_context ששם טקסט בהקשר של סשן Claude Code מעצמו, בלי שאף אחד ביקש. זה
  כל המנגנון: לא חיפוש שאתה מריץ, אלא טקסט שכבר נמצא שם כשהמודל מתחיל לקרוא.
- פריט **שולט** כשהוא כשיר להזרקה וגם מנוסח כהוראה — משהו שהמודל אמור לציית לו, ולא רק
  לדעת עליו.
- **דרג** היא המילה לחלוקה בין נורמטיבי לנימוקים. כל קטגוריה נושאת דרג אחד —
  <span dir="ltr">`constraint`, `decision`, `rule`, `lesson`</span> והשאר — ואפשר לשנות
  איזה ([פרק 6](#6-תצורה)). לאותה מילה יש כאן שימוש שני, שאינו קשור:
  [פרק 4](#4-מתי-זה-חוזר-ומה) קורא לארבעת מסלולי האספקה שלו *דרגי הזרקה*. במקומות שבהם
  ההבדל חשוב, המשפט אומר במה מדובר.

אוסף הפריטים של הפרויקט — כל מה שנמצא תחת <span dir="ltr">`.my_context/items/`</span>,
בכל דרג ובכל סטטוס — הוא ה**קורפוס** שלו.

</div>

<!-- example: list --summary -->
```text
┌───────────────┬───────┐
│ type          │ items │
├───────────────┼───────┤
│ constraint    │ 1     │
│ decision      │ 2     │
│ invariant     │ 1     │
│ lesson        │ 1     │
│ open_question │ 1     │
│ requirement   │ 1     │
│ rule          │ 2     │
│ standard      │ 1     │
└───────────────┴───────┘

10 item(s)
```
<!-- /example -->

<div dir="rtl">

זהו פרויקט קטן לדוגמה — Bookstore API בדיוני — שמשמש לאורך כל המסמך הזה. שבעה מעשרת
הפריטים שלו נורמטיביים ושלושה הם נימוקים. `mycontext help categories` מדפיס את הרשימה
המלאה של הסוגים ואת הדרג שכל אחד שייך אליו.

### למה החלוקה נושאת משקל, ולא רק מתייקת

קל לקרוא את זה כטקסונומיה: דרך מסודרת למיין הערות. זה לא. החלוקה קובעת **איזה טקסט רשאי
לשנות בשקט את התנהגות הסוכן.**

טקסט נורמטיבי מוזרק להקשר של Claude במלואו, בלי שביקשו, והוא כתוב בציווי. זו בדיוק
הנקודה: כלל שצריך לבקש אותו הוא כלל שנשכח. אבל טקסט בעל טווח כזה הוא טקסט שמכוון, ולכן
הוא חייב להיות טקסט שמישהו אישר.

נימוקים לעולם אינם נכנסים לסשן בדרך הזאת. בתחילת סשן הם תורמים ספירה — "2 decision ·
1 lesson" — ולא יותר. הם מאונדקסים, ניתנים לחיפוש ונשלפים לפי בקשה, אבל הם אינם מגיעים
בלי הזמנה ואינם מנסחים את עצמם כפקודה.

הפרש הטווח הזה הוא הסיבה ששני הדרגים כפופים לכללים שונים לגבי מי רשאי להוסיף להם.
כש-Claude לוכד פריט נורמטיבי, הוא נוחת כ**טיוטה** ואינו שולט בכלום עד שאדם מקדם אותו.
כש-Claude לוכד פריט נימוק, הוא פשוט נרשם. ההבדל הוא בעלות הטעות: לטעות לגבי *למה* עולה
לך בהסבר מטעה, ולטעות לגבי *מה חייב להתקיים* עולה לך בקוד שגוי, שנכתב בביטחון, בידי משהו
שסמכת עליו שהוא מכיר את הכלל. גבול האישור, ומגבלותיו, מתוארים במלואם
ב[פרק 7](#7-גבול-האמון).

## 3. איך זה עובד, בשלושה צעדים

</div>

```mermaid
flowchart LR
  Y["<b>אתה</b><br/>mycontext add"] --> MD
  M["<b>Claude</b><br/>create_item"] --> MD["<b>.my_context/items/</b><br/>קובץ Markdown אחד לכל פריט<br/><i>מקור האמת</i>"]
  MD -->|"rebuild"| DB[("<b>.index.db</b><br/>מטמון נגזר")]
  DB --> SEL["<b>בחירה</b><br/>מה כשיר,<br/>ומה נכנס בתקציב"]
  SEL --> HK["<b>hooks</b><br/>תחילת סשן · לפני קובץ<br/>· לפני כיווץ"]
  HK --> CX["ההקשר של Claude"]
```

<div dir="rtl">

### צעד 1 — אתה לוכד את זה

אתה מנסח את הכלל פעם אחת, בשורת הפקודה או בבקשה מ-Claude לרשום אותו.

</div>

<!-- example: add constraint "Uploads capped at 10 MB" --body "The API gateway rejects a larger body before it reaches us, so accepting one only produces a timeout the customer cannot explain." --scope "src/api/**" --tags uploads --yes -->
```text
about to create constraint "Uploads capped at 10 MB" — active, and governing this project at once.
my_context: created CONST-uploads-capped-at-10-mb (active) at items/constraint/CONST-uploads-capped-at-10-mb.md.
```
<!-- /example -->

<div dir="rtl">

כל מה שבא אחרי הכותרת הוא **אפשרות** — צמד <span dir="ltr">`--name value`</span> שקובע
שדה אחד בפריט. ארבעה דברים בפקודה הזאת חשובים.

- <span dir="ltr">`--body "…"`</span> הוא הטקסט של הפריט: הפסקה ש-Claude באמת יקבל.
  הכותרת אומרת מה הכלל, והגוף אומר למה. ה"למה" הוא מה שמונע מכלל להיות מיושם מכנית במקרה
  שהוא מעולם לא עסק בו.
- <span dir="ltr">`--scope "src/api/**"`</span> הוא מה שהופך את הכלל לממוקד במקום סביבתי.
  זהו **glob של scope** — תבנית של נתיב קובץ, שבה <span dir="ltr">`*`</span> תואם בתוך
  רמת תיקייה אחת ו-<span dir="ltr">`**`</span> תואם על פני כמה רמות שצריך. האילוץ הזה
  נוגע לשכבת ה-API, ולכן הוא יחזור כשנוגעים בקוד של ה-API ויישאר מחוץ לדרך בכל מצב אחר.
  scope *מגביל*, ולכן כלל בלי scope אינו מוגבל לדבר והוא חל על כל קובץ — ראו
  [פרק 4](#4-מתי-זה-חוזר-ומה).
- <span dir="ltr">`--tags uploads`</span> מצמיד תגיות חופשיות. הן אינן משנות דבר לגבי מתי
  פריט מוזרק; הן שם כדי שתוכל למצוא אותו אחר כך.
- <span dir="ltr">`--yes`</span> נדרש מפני שזו קטגוריה נורמטיבית. הפריט שולט בפרויקט מרגע
  שהוא קיים, והדגל הוא ההכרה המפורשת בכך. קטגוריות של נימוקים אינן דורשות אישור.

המזהה, `CONST-uploads-capped-at-10-mb`, נגזר מהכותרת. תראה אותו בהקשר של Claude,
ב-`mycontext list`, ובשם הקובץ.

הארבעה האלה הם חלק קטן ממה שהפקודות מקבלות. כל עשרים ושתיים האפשרויות של שורת הפקודה
מרוכזות ב[כל הדגלים, במקום אחד](#כל-הדגלים-במקום-אחד).

גם Claude יכול ללכוד פריטים, בעזרת הכלי `create_item`. פריט נורמטיבי שנלכד כך נוחת
כטיוטה וממתין לך.

#### מתקרית לכלל

לא כל דבר ששווה לשמור מגיע כשהוא כבר מנוסח ככלל. לרוב משהו נשבר, אתה מבין למה, והכלל הוא
בדיוק החלק שעוד לא כתבת. <span dir="ltr">`mycontext lesson`</span> מתחילה מהקצה הזה.

<span dir="ltr">`mycontext lesson "<what was learned>"`</span> רושמת את הלקח — דרג הנימוקים,
כלומר הוא מאונדקס וניתן לחיפוש ולעולם אינו מוזרק בלי שביקשו — ומדפיסה **בקשת גזירת כללים**:
הלקח, סכמת JSON, והוראות להמיר תיאור של מה שקרה להנחיות על מה שחייב לקרות מכאן והלאה. אם
תיתן לה מזהה של לקח שכבר קיים במקום הטקסט, היא תגזור מחדש מאותו לקח ולא תרשום עותק שני;
זו הצורה שבה משתמש התיאור שלהלן.

ל-my_context אין מודל משלה, והבקשה אומרת זאת בשורה הראשונה שלה. גזירת הכללים היא חלקו של
Claude בעבודה:

</div>

<details>
<summary dir="rtl"><b>בקשת גזירת הכללים, במלואה</b> — 77 שורות, בדיוק כפי שהמודל מקבל אותן</summary>

<!-- example: lesson LESSON-retry-storms-need-jitter -->
````text
my_context: lesson LESSON-retry-storms-need-jitter recorded (rationale tier — indexed, never injected).

my_context RULE DERIVATION REQUEST — LESSON-retry-storms-need-jitter

- You are deriving rules. my_context has no model of its own — it stages what you return and waits for a human.
- A lesson is descriptive ("this is what happened"); a rule is normative ("this is what must happen from now on"). Convert, do not restate.
- Emit a JSON array of rule candidates matching the schema. Two or three is usually right; return [] if the lesson supports no general rule.
- Each rule must be actionable by someone who was not present for the incident. Drop the dates, names and ticket numbers.
- Do not invent scope. Scope RESTRICTS where a rule applies, so omitting it leaves the rule applying everywhere — which is the right answer for a rule that is not about particular directories, and the honest answer when you cannot name them. A human can narrow it during review.
- NOTHING you return is applied. Every candidate is staged pending explicit human approval, because a subtly wrong invariant would be injected into every future session indefinitely.
- Call back with: mycontext lesson-stage LESSON-retry-storms-need-jitter --stdin

```json
{
  "protocol": "my_context/rule-derivation-request@1",
  "lessonId": "LESSON-retry-storms-need-jitter",
  "lessonTitle": "Retry storms need jitter",
  "lessonBody": "The March catalogue outage lasted forty minutes because every client retried on the\nsame fixed one-second interval, so the service was re-hit in synchronized waves and\nnever got a quiet moment to recover. Retries now use exponential backoff with full\njitter.",
  "lessonObservations": [],
  "ruleCategoryEnabled": true,
  "schema": {
    "type": "array",
    "items": {
      "type": "object",
      "required": [
        "title",
        "directive",
        "body"
      ],
      "additionalProperties": false,
      "properties": {
        "title": {
          "type": "string",
          "maxLength": 200,
          "description": "The directive itself, phrased as an instruction: \"Run migrations outside peak hours\"."
        },
        "directive": {
          "enum": [
            "do",
            "dont"
          ],
          "description": "\"do\" prescribes; \"dont\" prohibits."
        },
        "body": {
          "type": "string",
          "description": "Why. Cite the mechanism from the lesson, not the incident narrative."
        },
        "scope": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "POSIX globs this governs. Omit rather than guessing; a bare \"**\" is rejected."
        },
        "severity": {
          "enum": [
            "hard",
            "soft"
          ]
        }
      }
    }
  },
  "callback": {
    "cli": "mycontext lesson-stage LESSON-retry-storms-need-jitter --stdin"
  },
  "instructions": [
    "You are deriving rules. my_context has no model of its own — it stages what you return and waits for a human.",
    "A lesson is descriptive (\"this is what happened\"); a rule is normative (\"this is what must happen from now on\"). Convert, do not restate.",
    "Emit a JSON array of rule candidates matching the schema. Two or three is usually right; return [] if the lesson supports no general rule.",
    "Each rule must be actionable by someone who was not present for the incident. Drop the dates, names and ticket numbers.",
    "Do not invent scope. Scope RESTRICTS where a rule applies, so omitting it leaves the rule applying everywhere — which is the right answer for a rule that is not about particular directories, and the honest answer when you cannot name them. A human can narrow it during review.",
    "NOTHING you return is applied. Every candidate is staged pending explicit human approval, because a subtly wrong invariant would be injected into every future session indefinitely.",
    "Call back with: mycontext lesson-stage LESSON-retry-storms-need-jitter --stdin"
  ]
}
```
````
<!-- /example -->

</details>

<div dir="rtl">

מה שחוזר הוא מערך JSON של מועמדים, והוא נמסר
ל-<span dir="ltr">`mycontext lesson-stage`</span>. ההעמדה אינה כותבת דבר לקורפוס שלך —
המועמדים יושבים בקובץ תחת <span dir="ltr">`.my_context/.staging/`</span>, והשורה הראשונה
של הפקודה קיימת כדי לומר בדיוק את זה:

</div>

<!-- example: lesson LESSON-retry-storms-need-jitter && lesson-stage LESSON-retry-storms-need-jitter --file docs/lesson-rule-candidates.json -->
```text
my_context: 2 rule candidate(s) staged for LESSON-retry-storms-need-jitter. None of them exists as an item yet.
  ┌──────────┬───────────┬─────────────────────────────────┐
  │ key      │ directive │ title                           │
  ├──────────┼───────────┼─────────────────────────────────┤
  │ 99eb0e3d │ do        │ Retries add jitter to backoff   │
  │ 47c76d53 │ dont      │ Never retry on a fixed interval │
  └──────────┴───────────┴─────────────────────────────────┘

Accept with:  mycontext lesson-accept LESSON-retry-storms-need-jitter <key> [--title "…"] [--scope "a/**,b/**"]
Discard with: mycontext lesson-discard LESSON-retry-storms-need-jitter <key>
```
<!-- /example -->

<div dir="rtl">

כל מועמד מקבל **מפתח** קצר. המפתח הוא גיבוב של תוכן המועמד עצמו — ההוראה, הכותרת, הגוף,
ה-scope והחומרה — ולא של מקומו ברשימה, ולכן גזירה שנייה שמנסחת מועמד מחדש נותנת לו מפתח
אחר. <span dir="ltr">`lesson-stage`</span> מחליפה את קבוצת הממתינים בכל הרצה, והיא מדפיסה
את המועמדים הממתינים שהקבוצה החדשה לא ייצרה שוב במקום להשמיט אותם בשקט. כל מה שכבר אישרת
או דחית עובר הלאה כמות שהוא: מועמד שנדחה אינו יכול לחזור.

<span dir="ltr">`mycontext lesson-accept`</span> נוקבת במפתח אחד ויוצרת את הכלל.

</div>

<!-- example: lesson LESSON-retry-storms-need-jitter && lesson-stage LESSON-retry-storms-need-jitter --file docs/lesson-rule-candidates.json && lesson-accept LESSON-retry-storms-need-jitter 99eb0e3d -->
```text
my_context: about to create this rule — review before it becomes active:
  title:     Retries add jitter to backoff
  directive: do
  severity:  hard
  scope:     (unrestricted)
  body:      A fixed interval re-hits a recovering service in waves; jitter spreads them out.

my_context: created RULE-retries-add-jitter-to-backoff (active) with derived_from [[LESSON-retry-storms-need-jitter]].
```
<!-- /example -->

> [!WARNING]
> <div dir="rtl">
>
> קראו את שני החצאים של הפלט הזה יחד. <span dir="ltr">`lesson-accept`</span> מדפיסה
> <span dir="ltr">"review before it becomes active"</span> ואז יוצרת את הכלל כ**פעיל** —
> שולט בפרויקט הזה — באותה הרצה עצמה. אין פקודה שנייה ואין
> <span dir="ltr">`--yes`</span> שאפשר להימנע מלתת: התצוגה המקדימה מתארת דבר שכבר הוכרע
> עד שהספקתם לקרוא אותה. <span dir="ltr">`--title`, `--scope`, `--severity`</span>
> ו-<span dir="ltr">`--directive`</span> מתקנים את המועמד בדרך,
> ו-<span dir="ltr">`mycontext lesson-discard <lesson> <key>`</span> דוחה אחד לתמיד — אבל
> האישור עצמו הוא השער האחרון, והוא אינו עוצר. [פרק 7](#7-גבול-האמון) מונה אותו בין
> הפקודות שמשנות את מה ששולט בפרויקט הזה בלי אדם בלולאה.
>
> </div>

<div dir="rtl">

הכלל שיוצא מכאן הוא פריט רגיל — אותו Markdown שהצעד הבא מתאר, עם יחס אחד שרושם מאיפה הוא
הגיע.

</div>

<!-- example: lesson LESSON-retry-storms-need-jitter && lesson-stage LESSON-retry-storms-need-jitter --file docs/lesson-rule-candidates.json && lesson-accept LESSON-retry-storms-need-jitter 99eb0e3d && show RULE-retries-add-jitter-to-backoff -->
```text
---
id: RULE-retries-add-jitter-to-backoff
type: rule
title: Retries add jitter to backoff
status: active
severity: hard
always: false
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: <today>
valid_until: null
checksum: 66d3ef277acdc7ee
directive: do
---

# Retries add jitter to backoff

A fixed interval re-hits a recovering service in waves; jitter spreads them out.

## Relations
- derived_from [[LESSON-retry-storms-need-jitter]]
```
<!-- /example -->

<div dir="rtl">

<span dir="ltr">`derived_from`</span> הוא מה שישאיר את הצמד קריא בעוד שנה: הכלל אומר מה
חייב לקרות, והלקח שהוא מצביע אליו אומר למה מישהו חשב כך.

#### ממסמך לפריטי טיוטה

רוב הפרויקטים אינם מתחילים מדף ריק. הכללים כבר כתובים במקום כלשהו — מסמך אפיון, מפרט,
מסמך תכנון, תיקיית ה-ADR — והסיבה שאף אחד מהם אינו מגיע ל-Claude היא שאיש לא יקליד את כל
זה מחדש, <span dir="ltr">`mycontext add`</span> אחד בכל פעם.
<span dir="ltr">`mycontext ingest`</span> היא בדיוק ההקלדה הזאת, כשהמודל עושה אותה, מקטע
אחד בכל פעם, ואדם עומד בסופה.

**המודל הוא המחלץ.** זה הדבר שצריך לדעת לפני כל דבר אחר, כי
<span dir="ltr">`ingest`</span> אינה מנתח (parser) ואינה מתנהגת ככזה. כשמפנים אותה לקובץ,
היא מפצלת את המסמך לפי הכותרות שלו, לוקחת את המקטע הראשון שאיש עדיין לא טיפל בו, ומדפיסה
**בקשת חילוץ**: את הטקסט של המקטע מילה במילה, את הקטגוריות שהפרויקט הזה הפעיל, סכמת JSON
למה שצריך לחזור, ואת הפקודה שבה מחזירים. הקריאה של הטקסט הזה וההכרעה מה בו נורמטיבי הן
חלקו של Claude בעבודה. ל-my_context אין מודל משלה והיא לעולם אינה קוראת לאחד, והבקשה
אומרת זאת בשורה הראשונה שלה.

</div>

<details>
<summary dir="rtl"><b>בקשת החילוץ, במלואה</b> — 244 שורות, בדיוק כפי שהמודל מקבל אותן</summary>

<!-- example: ingest docs/prd.md -->
`````text
my_context EXTRACTION REQUEST — docs/prd.md § bookstore-api-prd (chunk 1 of 3, 3 pending)

- You are the extractor. my_context has no model of its own and never calls one — it hands you the text and validates what you return.
- Read the chunk below, taken from docs/prd.md under the anchor "bookstore-api-prd", and extract every piece of NORMATIVE knowledge it establishes: things that must hold, must be built, must not be done, or are deliberately left open.
- Do not extract narrative, status updates, or descriptions of what was done — that is claude-mem's job, not this one.
- Emit a JSON array matching the "schema" field. Return [] when the chunk establishes nothing normative — that is a correct and common answer, and the common case for prose that isn't a spec.
- Every candidate MUST carry a "quote": a span copied VERBATIM from the chunk. It is checked by exact match after whitespace collapsing, and a paraphrase is rejected. This is how an invented item is caught.
- "title" is one declarative sentence on a SINGLE LINE, at most 200 characters — no line breaks. Put the reasoning in "body".
- "body" is plain prose: no line may start with a Markdown heading ("#" through "######", e.g. "## Why") — that line and everything after it is silently dropped when the item is read back from disk. Do not structure the rationale with headings; use plain paragraphs.
- "scope", "tags" and "observations" must each be a JSON ARRAY — never a bare string. Scope RESTRICTS where an item applies: set it only to the directories the item actually governs, as POSIX globs such as "src/auth/**". "**", "*" and "**/*" are all rejected, because omitting "scope" already means exactly that. Omitting scope is safe and is the right answer when the item is not about particular files — it simply leaves the item unrestricted, so it applies everywhere.
- "severity" is "hard" (a future enforcement candidate) or "soft" (the default) — omit it to get "soft".
- Each observation's "category" must be lowercase letters, digits, underscore and hyphen only (e.g. "root-cause", not "Root Cause") — anything else silently drops the whole observation on the next read. Its "text" must not contain "#" and must not end in a parenthetical like "(...)" — use "tags"/"context" for those instead of writing them inline in "text".
- "extra" keys are category-specific fields (e.g. {"kind":"functional"} for a requirement, {"directive":"dont"} for a rule). Keys must be letters, digits and underscore only, not starting with a digit, and must not reuse a reserved field name such as "source_file", "status" or "id".
- Everything you return lands as status "draft". Nothing you extract governs future work until a human promotes it with `mycontext review promote <id>`.
- Then call back with the results. CLI: mycontext ingest-apply ING-docs-prd-md-dd2990c9-9e3efbae --anchor bookstore-api-prd --stdin — pipe your JSON array to stdin. MCP: call ingest_document with exactly the arguments shown in the "callback.mcp.arguments" object below, PLUS one more key: "candidates", whose value is the JSON array you produced (a real array, not a string).
- Including this one, 3 chunks in this document still need extraction; the callback returns the next request automatically.

CHUNK — the source text to read and extract from:
````
# Bookstore API PRD

The Bookstore API sells books on behalf of tenants who embed our checkout in
their own storefronts. This document is what the first release is measured
against, and it is read by the people building it and by the agents working
alongside them.

It is not a status report. Where a paragraph below says something must hold, it
is meant as a requirement; where it says something is deliberately not being
built, it is meant as a boundary.
````

```json
{
  "protocol": "my_context/extraction-request@1",
  "session": "ING-docs-prd-md-dd2990c9-9e3efbae",
  "sourceFile": "docs/prd.md",
  "anchor": "bookstore-api-prd",
  "chunkIndex": 0,
  "totalChunks": 3,
  "remaining": 3,
  "heading": "Bookstore API PRD",
  "categories": [
    {
      "name": "adr",
      "description": "Formal decision record, MADR shape",
      "extraFields": []
    },
    {
      "name": "assumption",
      "description": "Unverified premise plus validation deadline",
      "extraFields": [
        "validate_by",
        "validated_on"
      ]
    },
    {
      "name": "constraint",
      "description": "Non-negotiable limit: budget, stack, regulation, SLA",
      "extraFields": []
    },
    {
      "name": "decision",
      "description": "Lightweight decision not warranting a full ADR",
      "extraFields": []
    },
    {
      "name": "edge_case",
      "description": "Boundary condition; frequently worth promoting",
      "extraFields": []
    },
    {
      "name": "glossary",
      "description": "Ubiquitous language: the agreed term, and terms not to use",
      "extraFields": []
    },
    {
      "name": "instruction",
      "description": "Governs the agent's process, not the artifact",
      "extraFields": []
    },
    {
      "name": "invariant",
      "description": "Condition that must always hold during execution",
      "extraFields": []
    },
    {
      "name": "lesson",
      "description": "What was learned; source material for generated rules",
      "extraFields": []
    },
    {
      "name": "non_goal",
      "description": "Explicit prohibition on building something",
      "extraFields": []
    },
    {
      "name": "open_question",
      "description": "Deliberately undecided; the agent must not decide it alone",
      "extraFields": [
        "blocks"
      ]
    },
    {
      "name": "pattern",
      "description": "Reusable solution, or an anti-pattern to avoid",
      "extraFields": []
    },
    {
      "name": "requirement",
      "description": "What must be built",
      "extraFields": [
        "kind"
      ]
    },
    {
      "name": "risk",
      "description": "May occur and would harm",
      "extraFields": [
        "likelihood",
        "impact"
      ]
    },
    {
      "name": "rule",
      "description": "A do/dont directive",
      "extraFields": [
        "directive"
      ]
    },
    {
      "name": "standard",
      "description": "Formatting, coding convention, architectural guideline",
      "extraFields": []
    },
    {
      "name": "tradeoff",
      "description": "What was sacrificed for what",
      "extraFields": []
    }
  ],
  "schema": {
    "type": "array",
    "items": {
      "type": "object",
      "required": [
        "type",
        "title",
        "body",
        "quote"
      ],
      "additionalProperties": false,
      "properties": {
        "type": {
          "type": "string",
          "description": "One of the enabled categories listed in this request."
        },
        "title": {
          "type": "string",
          "maxLength": 200,
          "description": "One declarative sentence stating what must hold. Must be a single line — no line breaks."
        },
        "body": {
          "type": "string",
          "description": "The rationale: why this holds, and what breaks if it does not. Plain prose only — no line may start with a Markdown heading (\"#\" through \"######\", e.g. \"## Why\"). A heading line and everything after it is silently dropped when the item is read back from disk."
        },
        "quote": {
          "type": "string",
          "description": "A verbatim span copied from the chunk. Never paraphrase — a paraphrased quote is rejected."
        },
        "severity": {
          "enum": [
            "hard",
            "soft"
          ],
          "description": "hard = a future enforcement candidate. Default soft."
        },
        "scope": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "POSIX globs of the code this governs, e.g. \"src/auth/**\". Must be an array of strings, not a single string. Scope RESTRICTS where an item applies: omitting it leaves the item unrestricted, so it applies to every file. Set it only when the item is genuinely about particular directories, and omit it rather than guessing. \"**\", \"*\" and \"**/*\" are all rejected as redundant spellings of omitting it."
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Must be an array of strings, not a single string."
        },
        "observations": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "category",
              "text"
            ],
            "additionalProperties": false,
            "properties": {
              "category": {
                "type": "string",
                "description": "Lowercase letters, digits, underscore and hyphen only (e.g. \"root-cause\"), no spaces or other punctuation — anything else makes this observation unreadable and it is silently dropped when the item is read back from disk."
              },
              "text": {
                "type": "string",
                "description": "Must not contain \"#\" (read back as a tag marker) and must not end in a parenthetical like \"(...)\" (read back as \"context\") — either silently strips content from this text when the item is read back from disk. Use \"tags\"/\"context\" instead."
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "description": "Must be an array of strings, not a single string."
              },
              "context": {
                "type": "string",
                "description": "Optional qualifier, e.g. \"at registration\". Must not contain parentheses."
              }
            }
          }
        },
        "extra": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          },
          "description": "Category-specific fields, e.g. {\"kind\":\"functional\"} for a requirement, {\"directive\":\"dont\"} for a rule. Keys must be letters, digits and underscore only, and not start with a digit (e.g. \"validate_by\", not \"validate-by\") — any other character makes the item unreadable on the next rebuild. Keys must also not collide with a reserved frontmatter field name (e.g. \"source_file\", \"status\", \"id\") — that would silently overwrite the real field on disk."
        }
      }
    }
  },
  "callback": {
    "cli": "mycontext ingest-apply ING-docs-prd-md-dd2990c9-9e3efbae --anchor bookstore-api-prd --stdin",
    "mcp": {
      "tool": "ingest_document",
      "arguments": {
        "session": "ING-docs-prd-md-dd2990c9-9e3efbae",
        "anchor": "bookstore-api-prd"
      }
    }
  }
}
```
`````
<!-- /example -->

</details>

<div dir="rtl">

זה מה ש-<span dir="ltr">`mycontext ingest docs/prd.md`</span> אחת מדפיסה. שתי מילים בה
ייחודיות לפקודה הזאת. **עוגן** הוא הכותרת שמעליה יושב מקטע, באותיות קטנות ועם מקפים —
<span dir="ltr">`## Catalogue and search`</span> הופך ל-`catalogue-and-search` — וכך שני
צידי השיחה נוקבים באותו מקטע. **מועמד** הוא פריט מוצע שעדיין אינו קיים על הדיסק: חולץ,
תואר ב-JSON, ואינו כלום עד שמחילים אותו.

התשובה היא מערך JSON של מועמדים, והיא נמסרת בחזרה ל-<span dir="ltr">`mycontext
ingest-apply`</span>, תוך נקיבה במפגש ובעוגן שממנו הגיעה. כל מועמד חייב לשאת `quote` —
ציטוט שהועתק **מילה במילה** מהמקטע שממנו בא; my_context בודקת אותו בהתאמה מדויקת ודוחה
פרפרזה. הבדיקה הזאת אינה פורמליות: היא המנגנון שתופס פריט שהמודל ייצר מתוך הידע שלו עצמו
ולא מתוך המסמך שלכם. מועמד שנדחה נקוב בשמו, נרשם במפגש, ומשאיר את העוגן שלו ממתין.

**המקטע הראשון כאן אינו מייצר דבר, וזו התשובה הנכונה.** מסמך האפיון של Bookstore API נפתח
בשתי פסקאות שאומרות למה המסמך נועד. הן אינן מבססות שום דבר שחייב להתקיים, ולכן החילוץ
מחזיר `[]`, ההחלה מדווחת אפס נוצרו, אפס אוחדו ואפס הוחלפו, ושום פריט אינו נכתב. הבקשה
מבקשת בדיוק את זה — "החזר `[]` כשהמקטע אינו מבסס דבר נורמטיבי" — וכדאי לעצור על כך, כי זו
התשובה לחשש שהמילה "חילוץ" מעוררת: **הקליטה אינה ממציאה פריטים.** פרוזה תיאורית אינה
מניבה דבר, ומקטע שאינו מניב דבר עדיין מסומן כמטופל, כך שהריצה ממשיכה הלאה במקום לשאול שוב.

</div>

<!-- example: ingest docs/prd.md && ingest-apply ING-docs-prd-md-dd2990c9-9e3efbae --anchor bookstore-api-prd --file docs/prd-candidates-bookstore-api-prd.json && ingest-status --full -->
```text
┌───────────────────────────────────┬─────────────┬─────────┬──────────┐
│ session                           │ source      │ applied │ rejected │
├───────────────────────────────────┼─────────────┼─────────┼──────────┤
│ ING-docs-prd-md-dd2990c9-9e3efbae │ docs/prd.md │ 1/3     │ 0        │
└───────────────────────────────────┴─────────────┴─────────┴──────────┘

ING-docs-prd-md-dd2990c9-9e3efbae  docs/prd.md
  applied  bookstore-api-prd
  pending  checkout-and-payments
  pending  catalogue-and-search
```
<!-- /example -->

<div dir="rtl">

זו <span dir="ltr">`mycontext ingest-status --full`</span>, וזה מה שהופך מסמך אמיתי לנסבל.
מסמך אפיון הוא מקטעים רבים, ולעבור על כולם בישיבה אחת אינו המקרה הרגיל: המפגש הוא קובץ
תחת <span dir="ltr">`.my_context/.ingest/`</span>, המזהה שלו נגזר מנתיב המסמך ומתוכנו, וכל
החלה מתווספת אליו. הריצו <span dir="ltr">`mycontext ingest`</span> על אותו קובץ שוב —
שעה אחר כך או שבוע אחר כך — ותקבלו את המקטע **הבא** הממתין, ולא את הראשון. החלה של מקטע
מחזירה את הבקשה הבאה אוטומטית, כך שהלולאה אינה דורשת מכם ניהול;
<span dir="ltr">`--anchor`</span> מבקש מחדש מקטע מסוים כשרוצים לחזור עליו. ומכיוון שהמזהה
מקפל בתוכו סכום ביקורת של המסמך, עריכת המסמך פותחת מפגש **חדש** במקום לחתוך מחדש בשקט את
מקטעי הישן; <span dir="ltr">`ingest-status`</span> אז מונה את שניהם, והפריטים שהמפגש
הראשון ייצר אינם מושפעים.

עברו על שאר המקטעים והפריטים מופיעים:

</div>

<!-- example: ingest docs/prd.md && ingest-apply ING-docs-prd-md-dd2990c9-9e3efbae --anchor bookstore-api-prd --file docs/prd-candidates-bookstore-api-prd.json && ingest-apply ING-docs-prd-md-dd2990c9-9e3efbae --anchor catalogue-and-search --file docs/prd-candidates-catalogue-and-search.json && ingest-apply ING-docs-prd-md-dd2990c9-9e3efbae --anchor checkout-and-payments --file docs/prd-candidates-checkout-and-payments.json -->
```text
my_context: checkout-and-payments — created 3, deduped 0, superseded 0.
  created     CONST-carts-expire-in-30-minutes
  created     REQ-refunds-use-payment-intents
  created     NOGOAL-guest-checkout-is-excluded

my_context: every chunk of docs/prd.md is applied. Promote what you want with `mycontext review`.
```
<!-- /example -->

<div dir="rtl">

**כל מה שהקליטה יוצרת הוא טיוטה.** שום דבר שחולץ מהמסמך שלכם אינו שולט בדבר, אינו מוזרק
לשום סשן, ואינו מגיע להקשר של Claude עד שאדם מקדם אותו — וזו התכונה שמאפשרת להפנות את
הקליטה למסמך שלא קראתם לעומק. חמישה פריטים יצאו ממסמך האפיון הזה, וכל החמישה יושבים בתור
הסקירה עם <span dir="ltr">`origin ingest`</span> ועם הקובץ שממנו הגיעו:

</div>

<!-- example: ingest docs/prd.md && ingest-apply ING-docs-prd-md-dd2990c9-9e3efbae --anchor bookstore-api-prd --file docs/prd-candidates-bookstore-api-prd.json && ingest-apply ING-docs-prd-md-dd2990c9-9e3efbae --anchor catalogue-and-search --file docs/prd-candidates-catalogue-and-search.json && ingest-apply ING-docs-prd-md-dd2990c9-9e3efbae --anchor checkout-and-payments --file docs/prd-candidates-checkout-and-payments.json && review list -->
```text
┌───────────────────────────────────┬─────────────┬────────┬────────┬─────────────┬────────────────┐
│ id                                │ type        │ origin │ always │ source      │ title          │
├───────────────────────────────────┼─────────────┼────────┼────────┼─────────────┼────────────────┤
│ CONST-carts-expire-in-30-minutes  │ constraint  │ ingest │ no     │ docs/prd.md │ Carts expire   │
│                                   │             │        │        │             │ in 30 minutes  │
│ CONST-search-pages-hold-50-titles │ constraint  │ ingest │ no     │ docs/prd.md │ Search pages   │
│                                   │             │        │        │             │ hold 50 titles │
│ INV-isbn-is-unique-per-tenant     │ invariant   │ ingest │ no     │ docs/prd.md │ ISBN is unique │
│                                   │             │        │        │             │ per tenant     │
│ NOGOAL-guest-checkout-is-excluded │ non_goal    │ ingest │ no     │ docs/prd.md │ Guest checkout │
│                                   │             │        │        │             │ is excluded    │
│ REQ-refunds-use-payment-intents   │ requirement │ ingest │ no     │ docs/prd.md │ Refunds use    │
│                                   │             │        │        │             │ payment        │
│                                   │             │        │        │             │ intents        │
│ RULE-cache-keys-include-tenant-id │ rule        │ agent  │ no     │ -           │ Cache keys     │
│                                   │             │        │        │             │ include tenant │
│                                   │             │        │        │             │ ID             │
└───────────────────────────────────┴─────────────┴────────┴────────┴─────────────┴────────────────┘

6 draft(s) pending. Promote with `mycontext review promote <id>`.

1 pending revision(s) on 1 item(s) — proposed by an agent and NOT applied; the items keep their
current text. Read them as diffs with `mycontext review revisions`.
```
<!-- /example -->

<div dir="rtl">

השורה השישית היא הטיוטה הממתינה של הפיקסצ'ר עצמו, שנלכדה בידי סוכן ולא בידי הקליטה,
וההודעה מתחת לטבלה היא רוויזיה ממתינה שאינה קשורה — שתיהן שם כדי להראות שהפלט של הקליטה
מצטרף לתור אחד במקום לקבל תור משלו. <span dir="ltr">`origin`</span> היא העמודה שאומרת
מאיפה כל פריט הגיע, ואף כלי אינו מאפשר למי שקורא לו לקבוע אותה. למה התור הזה קיים בכלל
כתוב ב[פרק 7](#7-גבול-האמון); הקידום הוא הרגע שבו פריט שחולץ מתחיל לשלוט בפרויקט:

</div>

<!-- example: ingest docs/prd.md && ingest-apply ING-docs-prd-md-dd2990c9-9e3efbae --anchor bookstore-api-prd --file docs/prd-candidates-bookstore-api-prd.json && ingest-apply ING-docs-prd-md-dd2990c9-9e3efbae --anchor catalogue-and-search --file docs/prd-candidates-catalogue-and-search.json && ingest-apply ING-docs-prd-md-dd2990c9-9e3efbae --anchor checkout-and-payments --file docs/prd-candidates-checkout-and-payments.json && review promote INV-isbn-is-unique-per-tenant --yes -->
```text
about to promote:
  id       INV-isbn-is-unique-per-tenant
  type     invariant
  title    ISBN is unique per tenant
  severity hard
  always   no
  scope    src/catalogue/**

Two tenants may stock the same book, so a lookup that omits the tenant can return the wrong row.

my_context: INV-isbn-is-unique-per-tenant is now active (scope src/catalogue/** — injected when work touches those paths).
```
<!-- /example -->

<div dir="rtl">

Claude יכול להריץ את שני הצעדים בעצמו בעזרת הכלי `ingest_document`, שנושא את המועמדים ואת
הקריאה החוזרת בקריאה אחת. אין פקודת סלאש לקליטה; שורת הפקודה והכלי הם שני המשטחים שיש לה,
והפער רשום ב[פרק 8](#8-עדיין-לא-זמין).

### צעד 2 — זה נשמר כ-Markdown שאפשר לקרוא, להשוות ולסקור

כל פריט הוא קובץ אחד תחת
<span dir="ltr">`.my_context/items/<type>/<id>.md`</span>, במאגר שלך, ב-Markdown רגיל.

</div>

<!-- example: show CONST-postgres-pool-capped-at-20 -->
```text
---
id: CONST-postgres-pool-capped-at-20
type: constraint
title: Postgres pool capped at 20
status: active
severity: hard
always: true
scope: []
tags:
  - database
  - capacity
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-14
valid_until: null
checksum: a81dff73a154242e
---

# Postgres pool capped at 20

The managed Postgres plan allows 120 connections. Five API instances at 20 each
leaves 20 for migrations, backups and the admin console. Raising the pool past 20
does not buy throughput; it buys `remaining connection slots are reserved` during
the next deploy.
```
<!-- /example -->

<div dir="rtl">

הגוש שבין שורות ה-<span dir="ltr">`---`</span> הוא ה-**frontmatter**: השדות ש-my_context
משתמש בהם כדי להחליט מתי הפריט הזה חוזר ועד כמה לסמוך עליו. כל מה שמתחתיו הוא הגוף, והגוף
הוא מה ש-Claude באמת קורא. שדה אחר שדה:

| שדה | מה המשמעות |
|---|---|
| `id` | שם הפריט, נגזר מהכותרת. המזהים הם הדרך שכל דבר אחר מפנה אליו |
| `type` | הקטגוריה שלו — <span dir="ltr">`constraint`, `decision`, `rule`</span> וכן הלאה. הקטגוריה קובעת את הדרג |
| `status` | <span dir="ltr">`draft`, `active`, `superseded`, `deprecated`</span> או `validated`. **רק `active` מוזרק אי פעם.** מה אומרים ארבעת האחרים כתוב ב[מילון המונחים](#9-מילון-מונחים) |
| `severity` | `hard` או `soft`. זה אינו משנה אם פריט מוזרק, רק את הסדר: פריטים קשיחים מתקבלים לתקציב ראשונים |
| `always` | הערך `true` נועץ את הפריט — מוזרק במלואו בתחילת כל סשן, בלי קשר לקבצים שאתה נוגע בהם |
| `scope` | globs של הקבצים שהפריט מוגבל אליהם. ריק פירושו בלי הגבלה: הוא חל על כל קובץ |
| `tags` | תגיות חופשיות למציאה מאוחרת. הן אינן משפיעות על ההזרקה |
| `origin` | מי כתב אותו: <span dir="ltr">`human`</span>, <span dir="ltr">`agent`</span> (כלומר Claude, דרך כלי MCP) או <span dir="ltr">`ingest`</span> (חולץ ממסמך). על השדה הזה בנוי [גבול האמון](#7-גבול-האמון), ואף כלי אינו מאפשר למי שקורא לו לקבוע אותו |
| <span dir="ltr">`source_file`, `source_anchor`, `source_checksum`</span> | מהיכן הפריט הגיע כשהוא חולץ ממסמך: הנתיב, הכותרת בתוכו, ו-hash של אותו טקסט כדי שאפשר יהיה לזהות סטייה |
| <span dir="ltr">`valid_from`, `valid_until`</span> | היום שבו התחיל לחול, והיום שבו חדל. `valid_until` ממולא כשפריט פורש |
| `checksum` | hash של תוכן הפריט עצמו, מוחתם מחדש בכל כתיבה. כך `mycontext doctor` מבחין בקובץ שנערך ביד |

חלק מהקטגוריות מוסיפות שדה משלהן. פריט `rule`, למשל, נושא
<span dir="ltr">`directive: do`</span> או <span dir="ltr">`directive: dont`</span>. הפקודה
<span dir="ltr">`mycontext examples <category>`</span> מדפיסה דגם תקין של כל סוג, כולל
השדות הנוספים.

הצורה הזאת מכוונת. הכללים של הפרויקט שלך חיים ב-git, ולכן הם מופיעים ב-diff של pull
request, נסקרים כמו קוד, ומסתעפים ומתמזגים יחד עם הקוד שהם מתארים. אפשר גם לקרוא אותם בלי
להריץ כלום: אין מסד נתונים שצריך לתשאל כדי לגלות במה הפרויקט שלך מאמין.

*יש* מסד נתונים — <span dir="ltr">`.my_context/.index.db`</span>, מסוג SQLite — אבל הוא
נגזר ולא נכתב ידנית. הוא קיים כדי שחיפוש בזמן סשן יהיה מהיר. מחקו אותו
ו-`mycontext rebuild` יבנה אותו מחדש מה-Markdown. ה-Markdown הוא מקור האמת; האינדקס הוא
מטמון.

השלכה אחת שכדאי להכיר מוקדם: אל תערוך קובץ פריט ביד. כל מסלול כתיבה מחשב מחדש את שדה
ה-`checksum` של הפריט. עריכה ידנית לא מחשבת אותו, ולכן ה-checksum הרשום מפסיק להתאים
לתוכן, ו-`mycontext doctor` מדווח על הפער מאותו רגע.

### צעד 3 — זה חוזר מעצמו

כשסשן מתחיל, Claude Code מריץ את ה-hooks של my_context — תוכניות קטנות שהוא מריץ ברגעים
קבועים, לפני שקורה משהו אחר. ה-hook של תחילת הסשן בוחר את הפריטים שחלים ומוסר אותם
ל-Claude כהקשר. זה מה שהמודל מקבל, מילה במילה:

</div>

```text
## my_context — these govern this project

### CONST-postgres-pool-capped-at-20 · constraint · Postgres pool capped at 20

The managed Postgres plan allows 120 connections. Five API instances at 20 each
leaves 20 for migrations, backups and the admin console. Raising the pool past 20
does not buy throughput; it buys `remaining connection slots are reserved` during
the next deploy.

## my_context index
- INV-prices-are-integer-cents · invariant · Prices are integer cents
- REQ-checkout-completes-in-two-steps · requirement · Checkout completes in two steps
- RULE-never-log-customer-email · rule · Never log customer email
- STD-api-errors-use-problem-json · standard · API errors use Problem JSON

2 decision · 1 lesson · 1 drafts pending review · 1 retired
→ use mycontext list or mycontext show <id> to browse these
```

<div dir="rtl">

פריט אחד הגיע במלואו, מפני שהוא נעוץ. ארבעה הגיעו כשורה אחת כל אחד, כך ש-Claude יודע
שהם קיימים ויכול לשלוף כל אחד מהם לפי מזהה. פריטי הנימוקים הגיעו כספירה. שום דבר לא
הושמט בלי שנאמר עליו.

hook שני רץ לפני ש-Claude קורא או עורך קובץ, ושם ה-scope משתלם. הפרק הבא עוסק בשאלה מי
מהם נורה מתי.

## 4. מתי זה חוזר, ומה

יש ארבעה **דרגי הזרקה** — ארבעה מסלולים שדרכם טקסט של פריט יכול להגיע לסשן. (זהו המובן
השני של "דרג"; הראשון, מ[פרק 2](#2-הרעיון), הוא החלוקה בין נורמטיבי לנימוקים שכל קטגוריה
נושאת.) לכל מסלול תנאי שמפעיל אותו וכלל לגבי מה שהוא מכיל. "בדיוק בזמן" מקוצר לעיתים
קרובות ל-**JIT**, כולל בקובץ התצורה, שבו התקציב של הדרג הזה נכתב `jit`.

| דרג | מתי נורה | מה מכיל |
|---|---|---|
| **נעוץ** | בתחילת כל סשן, ושוב אחרי כיווץ | כל פריט נורמטיבי פעיל שמסומן `always: true`, במלואו |
| **בדיוק בזמן** | Claude עומד לקרוא או לערוך קובץ שהפריט חל עליו — כזה שתואם ל-`scope` שלו, או כל קובץ שהוא אם לא הוגדר לו `scope` | אותו פריט, במלואו |
| **משוחזר** | אחרי כיווץ | הפריטים שהיו בהקשר לפניו |
| **אינדקס** | בתחילת כל סשן, ואחרי כיווץ | שורה אחת לכל פריט נורמטיבי שנותר, ועוד ספירות לשאר |

</div>

```mermaid
flowchart LR
  S(["סשן מתחיל"]) --> Q{"always: true?"}
  Q -->|כן| PIN["<b>נעוץ</b><br/>מוזרק במלואו"]
  Q -->|לא| IDX["<b>אינדקס</b><br/>שורה אחת: id · type · title"]
  F(["Claude עומד לקרוא<br/>או לערוך קובץ"]) --> G{"האם לפריט<br/>הוגדר scope?"}
  G -->|"לא — בלי הגבלה"| JIT["<b>בדיוק בזמן</b><br/>מוזרק במלואו, פעם אחת בסשן"]
  G -->|"כן, והוא תואם"| JIT
  G -->|"כן, ואינו תואם"| NO["כלום — הפריט נשאר<br/>מחוץ לדרך"]
  C(["הסשן מכווץ"]) --> RES["<b>משוחזר</b><br/>מה שהיה בהקשר קודם"]
  C --> PIN
  C --> IDX
```

<div dir="rtl">

### נעוץ — המעטים שתמיד חלים

פריט עם `always: true` ב-frontmatter שלו מוזרק במלואו בתחילת כל סשן, לא משנה על מה אתה
עובד ובאילו קבצים אתה נוגע. בדוגמה שלמעלה זהו `CONST-postgres-pool-capped-at-20`: מגבלה
שמצרה כל קוד שפותח חיבור למסד נתונים, כך שלחכות לקובץ תואם זה לחכות יותר מדי.

נעיצה מיועדת לקבוצה הקטנה של כללים שהם באמת חסרי תנאי. לדרג הנעוץ יש תקציב משלו, וכל מה
שנעצת מתחרה עליו מול כל מה שנעצת קודם.

פריט מקבל `always: true` בקידום שלו, עם
<span dir="ltr">`mycontext review promote <id> --always`</span>, בזמן שהוא עדיין טיוטה, או
עם <span dir="ltr">`mycontext pin <id>`</span> ברגע שהוא שולט — השנייה מבקשת אישור, ומראה
מה משתנה בהזרקה של הפריט לפני שהיא פועלת. <span dir="ltr">`mycontext unpin <id>`</span>
מוציאה אותו משם בחזרה.

### בדיוק בזמן — אלה שחלים על מה שאתה נוגע בו

`scope` הוא רשימה של תבניות קבצים. כש-Claude עומד לקרוא או לערוך קובץ, my_context מחפש
פריטים נורמטיביים פעילים שה-scope שלהם תואם לנתיב הזה, ומזריק אותם במלואם לפני שהכלי רץ.

ל-`INV-prices-are-integer-cents` יש <span dir="ltr">`scope: src/billing/**`</span>:

</div>

<!-- example: show INV-prices-are-integer-cents -->
```text
---
id: INV-prices-are-integer-cents
type: invariant
title: Prices are integer cents
status: active
severity: soft
always: false
scope:
  - src/billing/**
tags:
  - billing
  - money
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-14
valid_until: null
checksum: b9c3d588c634c8cc
---

# Prices are integer cents

Every price crossing a module boundary is an integer number of cents.
Floating-point dollars re-introduce a rounding error at each conversion, and the
total a customer approves at checkout must equal the sum of its line items exactly.
```
<!-- /example -->

<div dir="rtl">

כך שברגע ש-Claude פותח את `src/billing/prices.js`, זה מה שהוא מקבל ראשון:

</div>

```text
## my_context — these govern this project

### CONST-postgres-pool-capped-at-20 · constraint · Postgres pool capped at 20

The managed Postgres plan allows 120 connections. Five API instances at 20 each
leaves 20 for migrations, backups and the admin console. Raising the pool past 20
does not buy throughput; it buys `remaining connection slots are reserved` during
the next deploy.

### INV-prices-are-integer-cents · invariant · Prices are integer cents

Every price crossing a module boundary is an integer number of cents.
Floating-point dollars re-introduce a rounding error at each conversion, and the
total a customer approves at checkout must equal the sum of its line items exactly.

_scope: src/billing/**_

### REQ-checkout-completes-in-two-steps · requirement · Checkout completes in two steps

Cart to payment, payment to confirmation. A third step was measured against the
two-step flow in April and abandonment rose by four points, so a new field belongs
in one of the two existing steps or nowhere.

### RULE-never-log-customer-email · rule · Never log customer email

Log the customer id instead. Access logs are shipped to a third-party aggregator
that our data-processing agreement does not cover, so an email address in a log
line leaves the boundary the checkout flow promises the customer.

_scope: src/**_
```

<div dir="rtl">

ארבעה פריטים חלו. שניים מהם נוקבים בקובץ הזה: האינווריאנטה של החיוב, שה-scope שלה
<span dir="ltr">`src/billing/**`</span>, וכלל שה-scope שלו <span dir="ltr">`src/**`</span>.
לשניים האחרים — האילוץ על ה-pool והדרישה על התשלום — לא הוגדר `scope` כלל, ולכן דבר אינו
מגביל אותם והם חלים כאן בדיוק כפי שהם חלים בכל מקום. שימו לב שהאילוץ על ה-pool מגיע אף
שהוא גם נעוץ: הוא נמסר על ידי הדרג הראשון שמגיע אליו בסשן, ופעם אחת בלבד.

פתחו במקום זאת את `src/catalogue/search.js` והאינווריאנטה של החיוב תיפול, כי ה-scope שלה
אינו כולל את הקובץ הזה. שלושת האחרים עדיין יגיעו.

שלושה פרטים שמפתח ירצה לדעת:

- **בלי scope פירושו בלי הגבלה.** פריט בלי תבניות scope חל על כל קובץ, ולכן הדרג הזה מוסר
  אותו כבר בקובץ הראשון ש-Claude נוגע בו. כתיבת `scope` היא הדרך *לצמצם* פריט לספריות
  שהוא באמת עוסק בהן; להשאיר אותו ריק היא ברירת המחדל הכנה לכלל שאינו עוסק בקבצים
  מסוימים, והיא גם קצרה יותר להקלדה. העלות אמיתית וכדאי להכיר אותה: פריט בלי scope מתחרה
  על תקציב ה-`jit` בכל פעולת קובץ, ולכן קורפוס עם פריטים גדולים ורבים בלי scope יגלוש —
  בגלוי, ראו [התקציב](#התקציב-ומה-קורה-כשזה-לא-נכנס) — במקום לדחוק בשקט את הפריט שנקב
  בקובץ עצמו.
- **כל פריט מגיע פעם אחת בסשן.** my_context רושם מה כבר הזריק, כך שעריכה של עשרה קובצי
  חיוב אינה מספקת את אותה אינווריאנטה עשר פעמים.
- **בדרג הזה אין אינדקס.** הזרקה שנורתה מקובץ מכילה את הפריטים שחלו ותו לא. האינדקס
  הוא עלות לכל סשן, לא לכל קובץ.

### משוחזר — אחרי שחלון ההקשר מכווץ

סשן ארוך מוצה בסוף את חלון ההקשר, ו-Claude Code *מכווץ* אותו: מסכם את השיחה עד כה וממשיך
מהסיכום. הסיכום קצר בהרבה ממה שהוא מחליף, והכללים שהוזרקו קודם הם בדרך כלל בין מה שהוא
משמיט.

my_context מצלם תמונת מצב מיד לפני שזה קורה, ורושם אילו פריטים היו במשחק — גם אלה שהזריק
וגם אלה שהוזכרו לפי מזהה בתמליל. כשהסשן מתחדש אחרי הכיווץ, הפריטים האלה מוזרקים מחדש,
לצד הדרג הנעוץ והאינדקס.

שתי מגבלות שנאמרות בכנות. תמונת המצב מפותחת לפי מזהה הסשן שה-hooks מקבלים, ולכן פריטים
שטענת ידנית עם <span dir="ltr">`/mycontext:LoadMyContext`</span> אינם נרשמים ואינם
משוחזרים: למשטח הזה אין מזהה סשן אמין לרשום מולו. והשחזור מוגבל בתקציב משלו, כמו כל דרג
אחר.

### האינדקס — כדי ששום דבר לא יהיה בלתי נראה

את כל מה שהדרגים שלמעלה לא סיפקו במלואו, האינדקס מונה. שורה אחת לכל פריט נורמטיבי פעיל
שנותר: מזהה, סוג, כותרת. מספיק כדי ש-Claude יידע שהכלל קיים ויוכל לשלוף אותו לפי מזהה
כשיתברר שהוא חשוב, וזול מספיק כדי לכלול אותו בכל פעם.

פריטי נימוקים אינם מנויים אחד-אחד. הם נספרים לפי סוג — <span dir="ltr">`2 decision`,
`1 lesson`</span> — לצד מספר הטיוטות הממתינות לסקירה ומספר הפריטים שיצאו לגמלאות. פריט
שהקטגוריה שלו כובתה בתצורה נספר גם הוא, ומסומן ככזה, כך שכיבוי קטגוריה לעולם אינו מעלים
את פריטיה בלי סימן.

פריט שכבר סופק במלואו לא מקבל שורת אינדקס. ל-Claude כבר יש את הכלל כולו, והוצאת מקום
באינדקס על חזרה הייתה דוחפת החוצה משהו שבאמת לא נראה.

### השכבה הגלובלית — ידע שנוסע איתך בין פרויקטים

לא כל מה שאתה יודע שייך למאגר אחד. *כתוב קודם את הבדיקה שנכשלת. לעולם אל תכניס סוד
למאגר. שאל לפני שאתה מוסיף תלות.* דברים כאלה נוסעים איתך, ולכידה מחדש שלהם בכל פרויקט
שאתה פותח היא בעיית ההדבקה מחדש מ[פרק 1](#1-הבעיה), תיקייה אחת למעלה.

my_context קורא קורפוס שני בדיוק בשביל זה. תיקיית <span dir="ltr">**`.my-context`**</span>
**בתיקיית הבית שלך** — שים לב למקף; התיקייה של פרויקט היא
<span dir="ltr">`.my_context`</span>, עם קו תחתון — נטענת כ**שכבה גלובלית** לצד זו של
הפרויקט, בכל פקודה שקוראת את הקורפוס ובכל הזרקה. הפריטים שבה הם פריטים רגילים: אותן
קטגוריות, אותם דרגים, אותן חומרות, אותם globs של scope, אותם תקציבים.
<span dir="ltr">`mycontext list --full`</span> מציג את שני הקורפוסים, ושדה
<span dir="ltr">`layer`</span> אומר מאיזה מהם הגיע כל פריט.

</div>

<!--
  הבלוקים מסוג `text` בפרק הזה מאומתים ביד, לא מיוצרים, ולכן `test/docs/examples.test.ts`
  אינו מכסה אותם. הסיבה מבנית, והיא בדיוק זו ש-`scripts/doc-fixture.ts` מתעד עבור הוצאת
  השכבה הגלובלית מן ה-fixture: `runExampleInFixture` מכוון את `HOME`/`USERPROFILE` של כל
  פקודה מיוצרת אל תיקייה ריקה (`emptyHome`, gen-doc-examples.ts) כדי שהשאלה אם למכונה
  שמייצרת יש `~/.my-context` לא תכריע מה המסמך מראה. ייצור בלוק כאן פירושו החלשה של
  ההבטחה הזאת. גם סמן משורשר ב-`&&` אינו יכול לבנות שכבה גלובלית בתוך ריצת דוגמה, כי — כפי
  שהפרק הזה אומר — אין פקודת `mycontext` שיוצרת אחת או כותבת אליה; הצעד היחיד שמניח קורפוס
  ב-`~/.my-context` הוא שינוי שם של תיקייה, ולא פקודה שה-harness יכול להריץ. כל בלוק כאן
  הוא הפלט האמיתי של הפקודה שנקובה מעליו, שהורצה ברצף מול סביבת עבודה זמנית עם `HOME`
  זמני, ב-2026-08-15. `npm run gen:docs` אינו מתחזק אותם: אם שינית את הנוסח של אחת
  ההודעות האלה, שנה אותו גם כאן.
-->

```text
CONST-never-commit-a-secret
  type    constraint
  status  active
  origin  human
  layer   global
  scope   (unrestricted)
  title   Never commit a secret

RULE-never-log-customer-email
  type    rule
  status  active
  origin  human
  layer   project
  scope   src/**
  title   Never log customer email

RULE-write-the-failing-test-first
  type    rule
  status  active
  origin  human
  layer   global
  scope   (unrestricted)
  title   Write the failing test first
```

<div dir="rtl">

פריט גלובלי שולט בדיוק כמו פריט של הפרויקט. נעץ אותו והוא יוזרק במלואו בתחילת כל סשן, בכל
פרויקט שאתה נמצא בו. השאר אותו לא נעוץ והוא יוזרק כשקובץ תואם ל-scope שלו — שנבדק מול
הפרויקט שאתה עובד בו, כך שפריט גלובלי עם <span dir="ltr">`scope: src/**`</span> נדלק בכל
פרויקט שיש בו <span dir="ltr">`src/`</span> — וייכלל באינדקס כששום קובץ שהוא חל עליו לא
נגעו בו.

**הפרויקט מנצח, פעמיים.** כשפריט של הפרויקט ופריט גלובלי מתחרים על אותו מקום בתקציב, זה
של הפרויקט מתקבל ראשון ([התקציב](#התקציב-ומה-קורה-כשלא-נכנסים-בו) הוא הפרק שלמטה). וכששניהם
חולקים **מזהה** אחד, העותק של הפרויקט הוא זה ששולט, והגלובלי אינו מאונדקס כלל — מוסתר, לא
ממוזג. שום חלק מהפריט הגלובלי אינו שורד אל תוך המבט של הפרויקט הזה עליו.

כך פרויקט גובר על הרגל: לכוד פריט של הפרויקט תחת המזהה שאתה משתמש בו גלובלית, והמאגר הזה
ילך אחרי הגרסה של הפרויקט. זה לא קורה בשקט. כל פקודה שבונה מחדש את האינדקס מדווחת על
ההתנגשות, ונוקבת בשם המזהה ובשתי השכבות — זו <span dir="ltr">`mycontext rebuild`</span>:

</div>

```text
my_context: indexed 4 item(s)
my_context: error  items/rule/RULE-write-the-failing-test-first.md: duplicate id "RULE-write-the-failing-test-first" declared in both the global layer (items/rule/RULE-write-the-failing-test-first.md) and the project layer (items/rule/RULE-write-the-failing-test-first.md); the project copy wins and the global one is not indexed. Rename one of them.
```

<div dir="rtl">

שני הנתיבים יחסיים לשורש של השכבה שלהם, ולכן במקרה כמו זה — אותה קטגוריה ואותו מזהה — הם
נקראים זהים. שמות השכבות הם מה שמבדיל ביניהם.

**פריטים גלובליים הם לקריאה בלבד מתוך פרויקט.** הם שלך בכל מאגר, וסשן של מאגר אחד הוא
המקום הלא נכון לשכתב אותם, ולכן כל נתיב כתיבה מסרב לאחד כזה. זו
<span dir="ltr">`mycontext edit`</span> על פריט גלובלי:

</div>

```text
my_context: "RULE-write-the-failing-test-first" belongs to the global layer and cannot be modified
from this project — global items are read-only here. See mycontext_help("categories").
```

<div dir="rtl">

<span dir="ltr">`pin`</span>, <span dir="ltr">`unpin`</span>,
<span dir="ltr">`harden`</span>, <span dir="ltr">`soften`</span>,
<span dir="ltr">`supersede`</span> ו-<span dir="ltr">`review promote`</span> מסרבים באותן
מילים. <span dir="ltr">`mycontext repair`</span> מחתים מחדש פריטים של הפרויקט בלבד, ונוקב
בשם הגלובליים שלא נגע בהם במקום לדלג עליהם בשקט.

דבר אחד שהשכבה **אינה** נושאת הוא התצורה שלה. קובץ
<span dir="ltr">`config.json`</span> בתוך <span dir="ltr">`~/.my-context`</span> אינו
נקרא — התצורה מגיעה מהפרויקט שאתה נמצא בו. ולכן פריט גלובלי שהקטגוריה שלו כובתה בפרויקט
הזה עדיין מנוי ב-<span dir="ltr">`mycontext list`</span>, ועדיין נספר באינדקס ככזה
שקטגוריתו כבויה, אבל לעולם אינו נבחר להזרקה שם.

#### איך יוצרים אחת, היום

> **אין פקודה שיוצרת שכבה גלובלית, ואין פקודה שכותבת אליה.**
> <span dir="ltr">`mycontext init`</span> יוצרת <span dir="ltr">`.my_context`</span>
> בתיקייה שהיא רצה בה, ולכן <span dir="ltr">`cd ~ && mycontext init`</span> מייצרת
> <span dir="ltr">`~/.my_context`</span> — האיות עם הקו התחתון, שאיש אינו קורא. זה פער, לא
> תכנון; הוא רשום ב[פרק 8](#8-עדיין-לא-זמין).

מה שכן עובד הוא לבנות את הקורפוס כ**סביבת עבודה רגילה** ואז להעביר את התיקייה שנוצרה אל
השורש הגלובלי:

</div>

```bash
mkdir ~/global-context && cd ~/global-context
mycontext init
mycontext add rule "Write the failing test first" --yes
mycontext add constraint "Never commit a secret" --severity hard --yes
# ואז לשנות את שם התיקייה שנוצרה, אל מקומה
mv ~/global-context/.my_context ~/.my-context
```

<div dir="rtl">

כל פריט שם נכתב בידי אותו קוד שכותב פריט של פרויקט — מזהים נגזרים, checksums מחושבים —
וזה מה שמבדיל את זה מכתיבת הקבצים ביד, ש[פרק 7](#לעולם-אל-תערכו-קובץ-פריט-ביד) אומר לך
לעולם לא לעשות. שינוי השם הוא הצעד הלא נתמך היחיד. כדי לשנות משהו אחר כך, העבר אותה
בחזרה, ערוך אותה כפרויקט רגיל, והעבר אותה החוצה שוב; זו גם המשמעות של
<span dir="ltr">`mycontext repair`</span> כשהיא אומרת לך להריץ אותה "מסביבת העבודה של
השכבה הגלובלית עצמה", שכן אין סביבת עבודה כזאת עד שאתה מייצר אותה. הקבצים
<span dir="ltr">`config.json`</span> ו-<span dir="ltr">`.index.db`</span> של אותה סביבת
עבודה נוסעים איתה; אף אחד מהם אינו נקרא מהשורש הגלובלי, ואף אחד מהם אינו מזיק.

### התקציב, ומה קורה כשלא נכנסים בו

לכל דרג יש **תקציב** — מגבלת גודל, כדי שקורפוס שגדל לא ישתלט בשקט על חלון ההקשר. ברירות
המחדל:

| תקציב | ברירת מחדל | מה הוא מנהל |
|---|---|---|
| `pinned` | 1500 | הדרג הנעוץ בתחילת סשן |
| `jit` | 500 | הזרקה אחת שנורתה מקובץ |
| `restored` | 2000 | ההזרקה מחדש אחרי כיווץ |
| `index` | 150 | רשימת האינדקס |

היחידה היא טוקנים משוערים, ו"משוערים" נאמר כפשוטו: זו ספירת התווים חלקי ארבע. my_context
נשלח בלי תלויות זמן ריצה, ולכן בלי tokenizer. זהו קירוב שיכול לסטות לשני הכיוונים, לא
תקרה מובטחת.

פריטים מתקבלים מהקשה לרך: <span dir="ltr">`severity: hard`</span> לפני
<span dir="ltr">`severity: soft`</span>, ואז
[שכבת הפרויקט לפני הגלובלית](#השכבה-הגלובלית--ידע-שנוסע-איתך-בין-פרויקטים), ואז לפי מזהה
כדי שהתוצאה תהיה דטרמיניסטית.

פריט גדול מדי למקום שנותר מדולג במקום לסיים את המעבר, כך שפריט קטן יותר אחריו עדיין יכול
להתקבל. פריט שדולג כך עבר **spill** — זו המילה שבה משתמש הקוד, והפסקה שלמטה היא איך
ש-spill נראה מבחוץ.

**מה שלא נכנס נמנה, ולעולם לא נזרק בשקט** — האינווריאנטה של הפרויקט עצמו,
`INV-nothing-is-dropped-silently`. באופן מוחשי, פריט שדרג של טקסט מלא לא הצליח להכיל
מופיע פעמיים: בשמו בהערה בת שורה מתחת להזרקה,

</div>

```text
_1 item(s) omitted from full text for budget: CONST-postgres-pool-capped-at-20. Fetch with mycontext show <id>._
```

<div dir="rtl">

ושוב כשורה רגילה באינדקס, כי הוא לא סופק במלואו ולכן עדיין ראוי לאזכור.

יש מקום אחד שבו מזהה מסוים אינו ננקב בשם, וכדאי לומר אותו בפירוש: כשל*אינדקס עצמו* נגמר
התקציב, השורות שלא נכנסות מוחלפות בספירה.

</div>

```text
- … +2 more (fetch with mycontext show <id>)
```

<div dir="rtl">

הספירה לעולם אינה שגויה, ו-`mycontext list` מציג את הקורפוס כולו מהטרמינל — אבל בתוך
הסשן ההוא Claude רואה את המספר ולא את השמות. בכל מקום אחר, מה שהושמט ננקב בשם במקום שבו
הושמט.

## 5. שימוש

ל-my_context שני משטחים מעל קורפוס אחד. האחד בשבילך, השני בשביל המודל, והחלוקה מכוונת
ולא היסטורית.

**אתה** מקליד פקודות סלאש בתוך סשן של Claude Code, או מריץ את הפקודה `mycontext` בטרמינל.
**המודל** קורא לאחד-עשר כלי ה-MCP. שני המשטחים קוראים וכותבים לאותם קובצי Markdown תחת
<span dir="ltr">`.my_context/`</span>. פריט שלכדת בטרמינל נמצא באינדקס של המודל בפעם הבאה
שהוא מסתכל, ופריט שהמודל לכד מופיע ב-`mycontext list` מיד.

שניהם קיימים מפני שכל אחד מהם בלתי שמיש במצב של האחר. המודל אינו יכול לעצור באמצע משפט
ולפתוח טרמינל, ולכן הוא צריך כלים שאפשר לקרוא להם ישירות. אתה צריך משטח שעובד כששום מודל
אינו בחדר — בסקריפט, ב-CI, או כשאתה פשוט רוצה לקרוא במה הפרויקט מאמין. וכמה פעולות אמורות
להיות שלך בלבד: קידום טיוטה, הוצאה לגמלאות של פריט ששולט. עד כמה ההפרדה הזאת באמת מחזיקה
כתוב ב[פרק 7](#7-גבול-האמון), וכדאי לקרוא אותו לפני שסומכים עליה.

</div>

```mermaid
flowchart TB
  U(["<b>אתה</b>"]) --> SL["<b>/mycontext:…</b><br/>38 פקודות סלאש"]
  U --> CL["<b>mycontext …</b><br/>26 פקודות שורת פקודה"]
  A(["<b>Claude</b>"]) --> TL["<b>כלי MCP</b><br/>אחד-עשר, מוגשים מעל stdio"]
  SL -->|"add-* · search · LoadMyContext"| TL
  SL -->|"list-* · review · status"| CL
  TL --> CO["<b>.my_context/</b><br/>קורפוס אחד של Markdown,<br/>במאגר שלך"]
  CL --> CO
```

<div dir="rtl">

### התקנה

יש שני חצאים, והם מותקנים אחרת. הפקודה `mycontext` היא חבילת npm במאגר הזה. פקודות
הסלאש, ה-hooks ושרת ה-MCP הם **תוסף** של Claude Code, שמוצהר על ידי
<span dir="ltr">`.claude-plugin/plugin.json`</span> ומתגלה מתוך
<span dir="ltr">`commands/`, `hooks/hooks.json`</span> ו-<span dir="ltr">`.mcp.json`</span>
בשורש המאגר.

**הפקודה.** משכפול של המאגר הזה:

</div>

```bash
npm install
npm link          # provides the `mycontext` command

cd /path/to/your/project
mycontext init
```

<div dir="rtl">

`mycontext init` יוצר <span dir="ltr">`.my_context/`</span> בתיקייה הנוכחית, עם תיקיית
<span dir="ltr">`items/`</span>, קובץ `config.json` וקובץ
<span dir="ltr">`.gitignore`</span>. הכניסו אותו ל-git: הקורפוס אמור לנסוע יחד עם הקוד
שהוא מתאר. בלי `npm link`, אפשר להריץ כל פקודה גם ישירות:
<span dir="ltr">`node /path/to/my-context/src/cli/index.ts <args>`</span>.

**התוסף.** התקינו אותו פעם אחת, מתוך העותק המקומי שלכם של המאגר הזה:

</div>

```bash
cd /path/to/my-context
claude plugin marketplace add ./
claude plugin install mycontext@mycontext
```

<div dir="rtl">

המאגר הזה הוא בעצמו marketplace בן תוסף אחד
(<span dir="ltr">`.claude-plugin/marketplace.json`</span>), ולכן גם ה-marketplace וגם
התוסף נקראים `mycontext`. ההתקנה שורדת הפעלה מחדש. `claude plugin list` מציגה אותה, ואת
הביטול עושות שתי פקודות יחד:
<span dir="ltr">`claude plugin uninstall mycontext@mycontext`</span> ו-<span dir="ltr">`claude plugin marketplace remove mycontext`</span>.

כדי לנסות אותו לסשן אחד בלי להתקין כלום:

</div>

```bash
claude --plugin-dir /path/to/my-context
```

<div dir="rtl">

בכל מקרה, כדי לבדוק מה באמת נטען, שאלו את Claude Code עצמו:

</div>

```bash
claude plugin details mycontext@mycontext
```

<div dir="rtl">

הוא מדפיס את מצאי הרכיבים — 38 הפקודות והמיומנות `mycontext`, ארבעת ה-hooks
(<span dir="ltr">`SessionStart`, `PreToolUse`, `PreCompact`, `PostToolUse`</span>) ושרת
ה-MCP האחד. כך אתם מוודאים שהתוסף נטען, במקום להניח שכן. כל פקודה בפרק הזה נקבעה על ידי
הרצתה, לא מקריאת התיעוד.

### מה שאתה מקליד: פקודות הסלאש

פקודות סלאש נמצאות במרחב השם של התוסף, ולכן כל אחת מהן מתחילה
ב-<span dir="ltr">`/mycontext:`</span>. הן מקובצות לפי מה שאתה מנסה לעשות:

**לכידה.** פקודת <span dir="ltr">`add-<type>`</span> אחת לכל קטגוריה מופעלת. הנורמטיביות
לוכדות דרך הכלי `create_item` ונוחתות כ**טיוטות**:
<span dir="ltr">`/mycontext:add-constraint`, `/mycontext:add-invariant`,
`/mycontext:add-rule`, `/mycontext:add-requirement`, `/mycontext:add-standard`,
`/mycontext:add-pattern`, `/mycontext:add-glossary`, `/mycontext:add-instruction`,
`/mycontext:add-non-goal`, `/mycontext:add-open-question`</span>. אלה של הנימוקים נוחתות
פעילות, מפני שנימוקים לעולם אינם מוזרקים ולכן אינם יכולים לכוון שום דבר בשקט:
<span dir="ltr">`/mycontext:add-adr`, `/mycontext:add-decision`, `/mycontext:add-lesson`,
`/mycontext:add-tradeoff`, `/mycontext:add-assumption`, `/mycontext:add-edge-case`,
`/mycontext:add-risk`</span>.

</div>

```
/mycontext:add-constraint  The connection pool is capped at 20
/mycontext:add-decision    We chose Stripe because settlement timing matched payouts
```

<div dir="rtl">

**חיפוש.** <span dir="ltr">`/mycontext:search`</span> מקבלת מילים וקוראת לכלי
`query_items`. זה המקום להתחיל בו כשאינך יודע מזהה. פקודת
<span dir="ltr">`list-<type>`</span> אחת לכל קטגוריה מופעלת מדפיסה את הטבלה של אותה
קטגוריה: <span dir="ltr">`/mycontext:list-constraint`, `/mycontext:list-invariant`,
`/mycontext:list-rule`, `/mycontext:list-requirement`, `/mycontext:list-standard`,
`/mycontext:list-pattern`, `/mycontext:list-glossary`, `/mycontext:list-instruction`,
`/mycontext:list-non-goal`, `/mycontext:list-open-question`, `/mycontext:list-adr`,
`/mycontext:list-decision`, `/mycontext:list-lesson`, `/mycontext:list-tradeoff`,
`/mycontext:list-assumption`, `/mycontext:list-edge-case`,
`/mycontext:list-risk`</span>. כל אחת מקבלת את אותם דגלי פירוט כמו שורת הפקודה.

<span dir="ltr">`/mycontext:LoadMyContext`</span> היא היוצאת דופן: היא מזריקה את הפריטים
הנעוצים ואת האינדקס אל הסשן עכשיו, בלי לחכות לתחילת סשן. השתמשו בה כשניקיתם את ההקשר, או
אחרי כיווץ. פריטים שנטענו כך אינם נכנסים לתמונת המצב ואינם משוחזרים אוטומטית.

**סקירה.** <span dir="ltr">`/mycontext:review`</span> עוברת על תור הטיוטות ומדפיסה, לכל
אחת, על מה היא תשלוט. היא נעצרת שם במכוון: היא אומרת לך את הפקודה המדויקת —
<span dir="ltr">`mycontext review promote <id>`</span> או
<span dir="ltr">`mycontext review discard <id>`</span> — ואינה מריצה אותה בשבילך.

**אבחון.** <span dir="ltr">`/mycontext:status`</span> מדפיסה את אותו דוח כמו `status`
בשורת הפקודה, ועוד שתי שורות לכל היותר שאומרות מה דורש את תשומת לבך.

</div>

```
/mycontext:search           connection pool
/mycontext:list-decision    --full
/mycontext:review
/mycontext:status
/mycontext:LoadMyContext
```

<div dir="rtl">

יש <span dir="ltr">`add-<type>`</span> אחת ו-<span dir="ltr">`list-<type>`</span> אחת לכל
קטגוריה **מופעלת** — 34 היום, ועוד <span dir="ltr">`search`, `review`, `status`</span>. הן
נוצרות מאותה תצורה מיושבת ש-`mycontext help categories` מדפיס, על ידי
`npm run gen:commands`. בדיקה נכשלת אם הקבצים ששמורים ב-git והמחולל אינם מסכימים: קטגוריה
מכובה אינה יכולה לשמור פקודה שתסורב אחר כך.

כל 37 אלה נושאות <span dir="ltr">`disable-model-invocation: true`</span>, וזה בתוקף — הן
המשטח שלך, לא של המודל. <span dir="ltr">`/mycontext:LoadMyContext`</span> היא היוצאת דופן
היחידה, והיא הפקודה היחידה שרק קוראת.

**ל"בתוקף" יש כאן תפקיד, והנה למה.** עד לאחרונה זה לא היה כך. תשע-עשרה מ-38 הקבצים — 17
פקודות ה-<span dir="ltr">`list-<type>`</span> ועוד `review` ו-`status` — נשאו
<span dir="ltr">`argument-hint: [--full|--short|--summary] [--json]`</span>, שפותח flow
sequence של YAML ואז גורר עוד אחד. זה אינו YAML תקין. ההודעה של Claude Code למקרה הזה
מפורשת — *at runtime this command loads with empty metadata (all frontmatter fields
silently dropped)* — כך שב-19 האלה `disable-model-invocation` היה כתוב ולא בתוקף, והמודל
יכול היה להפעיל פקודות שאמרו שהוא לא יכול.

כל רמז מצוטט עכשיו, כל 37 הקבצים נוצרו מחדש,
ו-<span dir="ltr">`claude plugin validate .`</span> עובר עם אפס שגיאות מול המאגר הזה.
הבדיקה ב-`test/plugin/commands.test.ts` נהגה לבדוק את השורות האלה בביטוי רגולרי, ולכן היא
עברה לאורך כל הדרך. היום היא מנתחת את ה-frontmatter ומוודאת
ש-`disable-model-invocation` חוזר כערך הבוליאני `true`.

**אי-סימטריה אחת, שנאמרת במקום להיטשטש: ל-<span dir="ltr">`/mycontext:search`</span> אין
מקבילה בשורת הפקודה.** אין פקודת `search` בשורת הפקודה כלל. פקודת הסלאש קוראת ישירות לכלי
ה-MCP `query_items`, והמקבילות הקרובות ביותר בטרמינל הן `mycontext list` לקטגוריה
ו-`mycontext query` ל-SQL מעל האינדקס. שני המשטחים עדיין אינם מכסים את אותו שטח.

### מה שאתה מריץ: שורת הפקודה

26 פקודות. `mycontext help` מדפיס את אותה רשימה מהתוכנית עצמה,
ו-<span dir="ltr">`mycontext help <topic>`</span> מסביר אחד
מ-<span dir="ltr">`categories`, `scope`, `capture`, `workflow`</span>.

**לכידה ושינוי.**

| פקודה | מה היא עושה |
|---|---|
| `mycontext init` | יוצרת <span dir="ltr">`.my_context/`</span> בתיקייה הנוכחית |
| <span dir="ltr">`mycontext add <category> <title>`</span> | יוצרת פריט — <span dir="ltr">`--body`, `--scope`, `--tags`, `--severity`, `--yes`</span> |
| <span dir="ltr">`mycontext edit <id>`</span> | משנה פריט — <span dir="ltr">`--title`, `--body`, `--scope`, `--tags`, `--severity`, `--always`, `--status`, `--yes`</span>. השער מדורג לפי מה שהשינוי יכול לעשות: אין אישור על טיוטה או על פריט רציונל, ויש תצוגה מקדימה ואישור על פריט ששולט |
| <span dir="ltr">`mycontext pin <id>`</span> / <span dir="ltr">`mycontext unpin <id>`</span> | <span dir="ltr">`mycontext edit <id> --always=true`</span> ו-<span dir="ltr">`--always=false`</span>, בשם קצר יותר |
| <span dir="ltr">`mycontext harden <id>`</span> / <span dir="ltr">`mycontext soften <id>`</span> | <span dir="ltr">`mycontext edit <id> --severity=hard`</span> ו-<span dir="ltr">`--severity=soft`</span>, בשם קצר יותר |
| <span dir="ltr">`mycontext review promote <id>`</span> | הופכת טיוטה לפריט פעיל ששולט |
| <span dir="ltr">`mycontext review discard <id>`</span> | מוציאה טיוטה לגמלאות |
| <span dir="ltr">`mycontext supersede <id> --by <id>`</span> | מוציאה לגמלאות פריט ששולט לטובת מחליף |
| `mycontext repair` | מחתימה מחדש את ה-checksum של פריט שהקובץ שלו כבר לא תואם לו |
| `mycontext rebuild` | בונה מחדש את <span dir="ltr">`.index.db`</span> מה-Markdown |

`add` מקבלת <span dir="ltr">`--body`, `--scope`, `--tags`</span>
ו-<span dir="ltr">`--severity hard|soft`</span>, ומסרבת לכל אפשרות שאינה מוכרת לה במקום
לקפל אותה לתוך הכותרת.

<span dir="ltr">`--scope`</span> ו-<span dir="ltr">`--tags`</span> הם רשימות: מופרדים
בפסיקים, ניתנים לחזרה, ושתי הצורות מתחברות. כך
ש-<span dir="ltr">`--scope "src/api/**,src/db/**"`</span>
ו-<span dir="ltr">`--scope src/api/** --scope src/db/**`</span> פירושם אותו דבר. דגל בעל
ערך יחיד שניתן פעמיים (<span dir="ltr">`--body x --body y`</span>) מסורב במקום להיפתר
לאחד מהם, בכל פקודה שמקבלת כזה.

תצפיות ויחסים אינם ניתנים לביטוי כדגלים; לשם כך יש את הכלים `create_item` ו-`link_items`.
<span dir="ltr">`--yes`</span> נדרש לקטגוריה **נורמטיבית**, מפני שהפריט הזה שולט בפרויקט
מרגע שהוא קיים. קטגוריות של נימוקים אינן דורשות אישור.

<span dir="ltr">`pin`</span>, <span dir="ltr">`unpin`</span>,
<span dir="ltr">`harden`</span> ו-<span dir="ltr">`soften`</span> אינן מנגנון עריכה שני: כל
אחת מהן מריצה את `edit` עם הדגל היחיד שהיא נושאת בשמה, ולכן היא מדפיסה את אותה תצוגה
מקדימה, מבקשת את אותו אישור, ומייצרת את אותה תוצאה ואת אותם סירובים. הן קיימות מפני שרשימת
הפקודות היא הבורר — ההשלמה האוטומטית מסננת תוך כדי הקלדה — ומפני
ש-<span dir="ltr">`--always`</span> הוא מתג, כך שהאיות
<span dir="ltr">`--always true`</span> הוא טעות שהצורה הקצרה אינה יכולה לעשות. כל אחת מקבלת
מזהה אחד ו-<span dir="ltr">`--yes`</span>, ומסרבת לכל דגל אחר, תוך שהיא מפנה
ל-<span dir="ltr">`mycontext edit`</span> — הפקודה שמשנה יותר משדה אחד בבת אחת.

**חיפוש וקריאה.**

| פקודה | מה היא עושה |
|---|---|
| <span dir="ltr">`mycontext list [category]`</span> | הקורפוס כטבלה |
| <span dir="ltr">`mycontext show <id>`</span> | פריט אחד במלואו, בדיוק כפי שהוא על הדיסק |
| <span dir="ltr">`mycontext query "SELECT …"`</span> | SQL לקריאה בלבד מעל האינדקס — [הסכמה, ושאילתות לדוגמה](#הסכמה-של-האינדקס-ואיך-לתשאל-אותה) |
| <span dir="ltr">`mycontext examples <category>`</span> | פריט לדוגמה שלם ותקין מאותו סוג |
| <span dir="ltr">`mycontext help [topic]`</span> | הדרכה: <span dir="ltr">categories, scope, capture, workflow</span> |

</div>

<!-- example: list -->
```text
┌─────────────────────────────────────┬───────────────┬────────────┐
│ id                                  │ type          │ status     │
├─────────────────────────────────────┼───────────────┼────────────┤
│ CONST-postgres-pool-capped-at-20    │ constraint    │ active     │
│ DEC-search-with-postgres-full-text  │ decision      │ active     │
│ DEC-use-stripe-for-payments         │ decision      │ active     │
│ INV-prices-are-integer-cents        │ invariant     │ active     │
│ LESSON-retry-storms-need-jitter     │ lesson        │ active     │
│ OPENQ-which-search-engine           │ open_question │ superseded │
│ REQ-checkout-completes-in-two-steps │ requirement   │ active     │
│ RULE-cache-keys-include-tenant-id   │ rule          │ draft      │
│ RULE-never-log-customer-email       │ rule          │ active     │
│ STD-api-errors-use-problem-json     │ standard      │ active     │
└─────────────────────────────────────┴───────────────┴────────────┘
```
<!-- /example -->

<div dir="rtl">

אין עמודת `title`, וזה בכוונה. מזהה הוא slug של הכותרת —
`CONST-postgres-pool-capped-at-20` עבור "Postgres pool capped at 20" — כך ששתי העמודות
הרחבות ביותר בטבלה הזאת אמרו אותו דבר פעמיים. ביחד הן הביאו את דוח ברירת המחדל ל-192
תווים בקורפוס של המאגר הזה עצמו, מול פריסה ברוחב 100; בלי הכותרת הוא 97.

הכותרת עדיין מופיעה במלואה ב-`mycontext show`, ב-<span dir="ltr">`list --full`</span>
וב-<span dir="ltr">`list --json`</span>. אותה הסרה נעשתה ב-`mycontext decay` (מ-170 תווים
ל-97) ובטבלת הפריטים הקרים שבתוך <span dir="ltr">`status --full`</span>, משיקול הרוחב
עצמו. <span dir="ltr">`mycontext review list`</span> שומרת על העמודה: שאר העמודות שלה הן
ערכי מנייה צרים, כך שעל המזהים שתור אמיתי מחזיק היא נכנסת לתקציב עם הכותרת במקומה.
ה-<span dir="ltr">`--full`</span> שלה אינה טבלה כלל — כמו
<span dir="ltr">`list --full`</span> היא גוש לכל טיוטה, וזה מה שמשאיר אותה בתוך הפריסה גם
במזהה הארוך ביותר שהפרויקט הזה יכול לייצר.

<span dir="ltr">`mycontext show <id>`</span> מדפיס את הקובץ עצמו, כולל ה-frontmatter —
אותו פלט שמופיע ב[פרק 3](#3-איך-זה-עובד-בשלושה-צעדים).
<span dir="ltr">`mycontext examples <category>`</span> מדפיס דוגמה מלאה של סוג שלא השתמשת
בו קודם, כדי שתראה את הצורה לפני שאתה כותב אחת:

</div>

<!-- example: examples rule -->
```text
---
id: RULE-never-log-request-bodies-on-auth-endpoints
type: rule
title: Never log request bodies on auth endpoints
status: active
severity: soft
always: false
scope:
  - src/api/auth/**
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: <today>
valid_until: null
checksum: 0040bc230528c1af
directive: dont
---

# Never log request bodies on auth endpoints

Bodies carry passwords and reset tokens; logs are retained for 90 days.
```
<!-- /example -->

<div dir="rtl">

בשדה `valid_from` כתוב <span dir="ltr">`<today>`</span> מפני שהשדה הזה נחתם ביום שבו
הפקודה רצה. כל בלוק במסמך הזה נוצר מהרצה אמיתית של הפקודה שמעליו ונבדק מחדש על ידי חבילת
הבדיקות. תאריך אמיתי שהיה מודפס שם היה תאריך שגוי עבור כל מי שלא הריץ את הפקודה ביום שבו
הבלוק נוצר.

**סקירת התור.**

</div>

<!-- example: review list -->
```text
┌───────────────────────────────────┬──────┬────────┬────────┬────────┬────────────────────────────┐
│ id                                │ type │ origin │ always │ source │ title                      │
├───────────────────────────────────┼──────┼────────┼────────┼────────┼────────────────────────────┤
│ RULE-cache-keys-include-tenant-id │ rule │ agent  │ no     │ -      │ Cache keys include tenant  │
│                                   │      │        │        │        │ ID                         │
└───────────────────────────────────┴──────┴────────┴────────┴────────┴────────────────────────────┘

1 draft(s) pending. Promote with `mycontext review promote <id>`.

1 pending revision(s) on 1 item(s) — proposed by an agent and NOT applied; the items keep their
current text. Read them as diffs with `mycontext review revisions`.
```
<!-- /example -->

<div dir="rtl">

<span dir="ltr">`mycontext review show <id>`</span> מדפיס טיוטה אחת במלואה.
<span dir="ltr">`mycontext review promote <id>`</span> הופך אותה לשולטת,
ו-<span dir="ltr">`--always`</span> נועץ אותה באותה הזדמנות — זה המסלול הקצר ביותר
ל-<span dir="ltr">`always: true`</span> עבור משהו שעדיין בתור
(<span dir="ltr">`mycontext pin <id>`</span> הוא המסלול ברגע שהפריט שולט — ראו
[פרק 6](#6-תצורה)). <span dir="ltr">`mycontext review discard <id>`</span> מוציא אותה
לגמלאות במקום זאת.

**סקירת מה שסוכן הציע.** לצד תור הטיוטות יושב תור שני, והוא מחזיק *שינויים* ולא פריטים.
כשסוכן מתקן את הכותרת, הגוף או התגיות של פריט בקטגוריה שמוגדרת
<span dir="ltr">`agentEdits: "review"`</span> — ברירת המחדל לכל קטגוריה נורמטיבית, ראו
[פרק 6](#6-תצורה) — העריכה אינה חלה. היא הופכת ל**רוויזיה ממתינה**: הקובץ על הדיסק אינו
נוגע, הפריט שומר על הטקסט שכבר היה לו — וממשיך לשלוט באמצעותו, ככל שהוא שולט בכלל —
וההצעה ממתינה לכם.

| פקודה | מה היא עושה |
|---|---|
| <span dir="ltr">`mycontext review revisions [<id>]`</span> | כל הרוויזיות הממתינות, כל אחת כהפרש מול הטקסט שהפריט שלה שולט בו כעת |
| <span dir="ltr">`mycontext review promote-revision <id>`</span> | מיישמת הצעה אחת, כך שהפריט שולט בטקסט החדש — <span dir="ltr">`--yes`</span>, <span dir="ltr">`--force`</span> |
| <span dir="ltr">`mycontext review discard-revision <id>`</span> | דוחה הצעה אחת ומשאירה את הפריט בדיוק כפי שהוא — <span dir="ltr">`--yes`</span> |

הנה הלולאה כולה, על אותה סביבת בדיקה שהמסמך הזה נוצר ממנה. סוכן מחליט שהכלל על מייל
הלקוח צר מכפי שצריך וקורא ל-`update_item`. זו התשובה שהוא מקבל — המילה הראשונה היא
שהעריכה **לא** נכנסה לתוקף, מפני שסוכן שיחשוב אחרת ימשיך להסיק מטקסט ששום דבר אינו אוכף:

</div>

```text
my_context: NOT applied — staged as revision REV-5218d09de570 for review. RULE-never-log-customer-email is unchanged and keeps governing its current body, and will until a human promotes this proposal. A human sees it with `mycontext review revisions` (it is counted by `mycontext status` too), and it is recorded in <workspace>/.my_context/.revisions/revisions.jsonl. Tell the user you staged it rather than assuming they will look. Do not reason as if the new text is in force.
```

<div dir="rtl">

שום דבר בפריט לא השתנה, ולא ישתנה עד שתגידו. <span dir="ltr">`mycontext review revisions`</span>
הוא המקום שבו אתם רואים זאת, כהפרש: <span dir="ltr">`-`</span> הוא הטקסט שבתוקף היום,
ו-<span dir="ltr">`+`</span> הוא מה שהסוכן מציע.

</div>

<!-- example: review revisions -->
```text
RULE-never-log-customer-email
  revision  REV-5218d09de570
  staged    2026-08-15T15:28:13.911Z by agent
  state     applies cleanly — nothing has changed underneath it since it was staged
  body
    - Log the customer id instead. Access logs are shipped to a third-party aggregator
    - that our data-processing agreement does not cover, so an email address in a log
    - line leaves the boundary the checkout flow promises the customer.
    + Log the customer id instead. Crash reports and analytics payloads leave our systems the same
        way access logs do, so no sink gets the address.

1 pending revision(s) on 1 item(s) — proposed by an agent and NOT applied; the items keep their
current text. Read them as diffs with `mycontext review revisions`.
```
<!-- /example -->

<div dir="rtl">

ההפרש אינו משמיט דבר: כל שדה שהרוויזיה נוגעת בו, כל שורה שלו, כולל שורות שלא השתנו כהקשר.
אין לו גרסת <span dir="ltr">`--short`</span>, מפני שהפרש מקוצר הוא שינוי אחר מזה שאתם
עומדים לאשר.

אם אתם מסכימים, <span dir="ltr">`mycontext review promote-revision <id>`</span> מיישמת
אותו. היא מציגה תצוגה מקדימה ושואלת קודם, בדיוק כמו
<span dir="ltr">`review promote`</span>:

</div>

<!-- example: review promote-revision RULE-never-log-customer-email --yes -->
```text
about to promote a staged revision:
RULE-never-log-customer-email
  revision  REV-5218d09de570
  staged    2026-08-15T15:28:13.911Z by agent
  state     applies cleanly — nothing has changed underneath it since it was staged
  body
    - Log the customer id instead. Access logs are shipped to a third-party aggregator
    - that our data-processing agreement does not cover, so an email address in a log
    - line leaves the boundary the checkout flow promises the customer.
    + Log the customer id instead. Crash reports and analytics payloads leave our systems the same
        way access logs do, so no sink gets the address.

`-` is the text this item has now and `+` is what the revision proposes; the promotion replaces the
first with the second.
my_context: promoted revision REV-5218d09de570 — RULE-never-log-customer-email now governs the
proposed body.
```
<!-- /example -->

<div dir="rtl">

אם לא, <span dir="ltr">`mycontext review discard-revision <id>`</span> דוחה אותו. הפריט אינו
נוגע כך או כך, וההצעה **אינה** נמחקת — היא נשארת ביומן שרק מוסיפים לו, וההודעה מפנה
לפקודה שקוראת אותה בחזרה:

</div>

<!-- example: review discard-revision RULE-never-log-customer-email --yes -->
```text
about to discard a staged revision:
RULE-never-log-customer-email
  revision  REV-5218d09de570
  staged    2026-08-15T15:28:13.911Z by agent
  state     applies cleanly — nothing has changed underneath it since it was staged
  body
    - Log the customer id instead. Access logs are shipped to a third-party aggregator
    - that our data-processing agreement does not cover, so an email address in a log
    - line leaves the boundary the checkout flow promises the customer.
    + Log the customer id instead. Crash reports and analytics payloads leave our systems the same
        way access logs do, so no sink gets the address.

RULE-never-log-customer-email is unchanged either way — discarding rejects the proposal, it does not
touch the item.
my_context: discarded revision REV-5218d09de570. RULE-never-log-customer-email is unchanged and
keeps governing its current text. The proposal itself is NOT deleted — its full proposed body stays
in the append-only log at
<workspace>/.my_context/.revisions/revisions.jsonl and is
read back with `mycontext review revisions RULE-never-log-customer-email --full`. It cannot be
staged again against this same text; a different proposal, or the same one after the item changes,
can be.
```
<!-- /example -->

<div dir="rtl">

<span dir="ltr">`review promote`</span> ו-<span dir="ltr">`review promote-revision`</span>
הן בכוונה שני פעלים ולא אחד, מפני שטיוטה נורמטיבית יכולה לשבת בשני התורים בו-זמנית:
<span dir="ltr">`promote`</span> גורמת לטיוטה לשלוט בטקסט שכבר יש לה,
ו-<span dir="ltr">`promote-revision`</span> משכתבת את הטקסט הזה. אף אחת מהן אינה עושה את
עבודתה של האחרת, ו-<span dir="ltr">`review promote`</span> אומרת זאת לפני שהיא מבקשת אישור.

[פרק 7](#7-גבול-האמון) מתאר מהי רוויזיה ממתינה ומה אינה — מה קורה כשעורכים את הפריט מתחתיה,
מה <span dir="ltr">`--force`</span> הורס, ולמה רוויזיה אינה מזיזה אף ספירה של מה ששולט.

**אבחון.**

| פקודה | מה היא עושה |
|---|---|
| `mycontext status` | ספירות, תור סקירה, התקדמות קליטה, דעיכה ובריאות |
| `mycontext doctor` | טריות האינדקס, יתומים, סטייה, globs מתים, הרשאות, מזהי סשן |
| `mycontext decay` | פריטים שלא הוזרקו לאחרונה |

</div>

<!-- example: status -->
```text
my_context 0.1.0: 10 item(s), profile "standard"

by category
  ┌───────────────┬───────┐
  │ category      │ items │
  ├───────────────┼───────┤
  │ constraint    │ 1     │
  │ decision      │ 2     │
  │ invariant     │ 1     │
  │ lesson        │ 1     │
  │ open_question │ 1     │
  │ requirement   │ 1     │
  │ rule          │ 2     │
  │ standard      │ 1     │
  └───────────────┴───────┘

by status
  ┌────────────┬───────┐
  │ status     │ items │
  ├────────────┼───────┤
  │ active     │ 8     │
  │ draft      │ 1     │
  │ superseded │ 1     │
  └────────────┴───────┘

by origin
  ┌────────┬───────┐
  │ origin │ items │
  ├────────┼───────┤
  │ agent  │ 2     │
  │ human  │ 8     │
  └────────┴───────┘

review queue: 1 draft(s) pending review — walk it with `mycontext review`.

1 pending revision(s) on 1 item(s) — proposed by an agent and NOT applied; the items keep their
current text. Read them as diffs with `mycontext review revisions`.

usage: no sessions recorded yet — decay reporting starts once items begin to be injected.
  2 active normative item(s) carry no scope, so they apply to every file and compete for the jit
  budget on every file operation.

health: 0 error(s), 0 warning(s), 0 note(s) — details from `mycontext doctor`.
```
<!-- /example -->

<div dir="rtl">

`mycontext doctor` היא הפקודה להריץ כשמשהו נראה לא בסדר. על קורפוס בריא זו שורה אחת:

</div>

<!-- example: doctor -->
```text
my_context doctor: 0 error(s), 0 warning(s), 0 note(s) across 0 finding(s).
```
<!-- /example -->

<div dir="rtl">

`mycontext decay` עונה על "מה לכדתי ומעולם לא השתמשתי בו". הדוח שלה נפתח באזהרה, מפני שקל
לקרוא את התשובה לא נכון: היומן רושם *הזרקה*, לא קריאה או הישענות, ולכן פריט חדש לגמרי
ופריט נטוש נראים כאן זהים.

</div>

<!-- example: decay --summary -->
```text
my_context decay — items not injected in the last 20 session(s). The ledger holds 0 session(s).
  "cold" means: not auto-injected in the last window of sessions. It does NOT mean unused — the
  ledger records injection, not reading or reliance, so a new item, and any item consulted via
  `show`, MCP `get_item`, or the Markdown file directly, look exactly like an abandoned one here.
  Do not supersede or deprecate anything on this report alone — verify real usage first.
  (no sessions recorded yet — nothing here has been measured; "cold" currently means only "never
  injected")

cold 5, warm 0, of which 2 unrestricted. Rows with `mycontext decay` (default) or `--full`.
```
<!-- /example -->

<div dir="rtl">

האזהרה הזאת מודפסת בכל רמת פירוט, <span dir="ltr">`--summary`</span> בכלל זה: דוח קצר
יותר רשאי לוותר על שורות, לעולם לא על הסיבה שהמספר הראשי שלו עצמו עלול להטעות. היא נשברת
לרוחב הפריסה, כך שהיא נקראת כפסקה ולא כשורה אחת בת 284 תווים.

**קליטת מסמך.** הפיכת מפרט או PRD קיים לפריטים היא שיחה בת שני צעדים, מפני של-my_context
אין מודל משלו: הוא מוסר לך את הטקסט ומאמת את מה שחוזר.

| פקודה | מה היא עושה |
|---|---|
| <span dir="ltr">`mycontext ingest <path>`</span> | פולטת בקשת חילוץ עבור מקטע אחד של מסמך |
| <span dir="ltr">`mycontext ingest-apply <id> --anchor <a>`</span> | מחילה את המועמדים שחולצו כטיוטות |
| `mycontext ingest-status` | מונה מפגשי קליטה ואת התקדמותם |

`mycontext ingest docs/prd.md` מדפיס מקטע מהמסמך יחד עם הוראות וסכמת JSON. אתה (או המודל)
מחזירים מערך JSON של מועמדים אל
<span dir="ltr">`mycontext ingest-apply <session-id> --anchor <anchor> --stdin`</span>,
ובקשת המקטע הבא חוזרת אוטומטית.

שתי מילים במשפט הזה ייחודיות לפקודה הזאת. **עוגן** הוא הכותרת שמעליה יושב מקטע של המסמך,
באותיות קטנות ועם מקפים — <span dir="ltr">`## Rate limits`</span> הופך
ל-`rate-limits` — וכך שני צידי השיחה מסכימים על איזה חלק של המסמך מדובר. **מועמד** הוא
פריט מוצע שעדיין אינו קיים: חולץ, תואר ב-JSON, ואין לו דבר על הדיסק עד שמחילים אותו. כל
מועמד חייב לצטט את מקטע המקור שלו מילה במילה, פרפרזה נדחית, וכל מה שמוחל נוחת כ**טיוטה**.
המקבילה של המודל היא הכלי `ingest_document`, שעושה את שני הצעדים במקום אחד.

**הפיכת לקח לכללים.** אותה צורה, למקרים ולא למסמכים.

| פקודה | מה היא עושה |
|---|---|
| <span dir="ltr">`mycontext lesson "<text>"`</span> | רושמת לקח ומבקשת כללים מועמדים |
| <span dir="ltr">`mycontext lesson-stage <id>`</span> | מעמידה את המועמדים שחזרו לאישור |
| <span dir="ltr">`mycontext lesson-accept <id> <key>`</span> | מאשרת מועמד אחד ויוצרת את הכלל |
| <span dir="ltr">`mycontext lesson-discard <id> <key>`</span> | דוחה מועמד אחד לצמיתות |

`mycontext lesson` רושמת את הלקח (דרג הנימוקים — מאונדקס, לעולם לא מוזרק) ומדפיסה בקשת
גזירת כללים: המר את התיאור הזה של מה שקרה להנחיות על מה שחייב לקרות. המועמדים חוזרים דרך
<span dir="ltr">`mycontext lesson-stage <LESSON-id> --stdin`</span>, ושם הם ממתינים. שום
דבר אינו מוחל עד ש-`mycontext lesson-accept` נוקב באחד, ו-`mycontext lesson-discard` דוחה
אחד לתמיד. שימו לב ש-`lesson-accept` יוצרת כלל **פעיל** ישירות — היא ברשימה
שב[פרק 7](#7-גבול-האמון) מסיבה זו. כל התהליך, מורץ מקצה לקצה עם הפלט האמיתי של כל צעד,
נמצא ב[מתקרית לכלל](#מתקרית-לכלל).

#### הסכמה של האינדקס, ואיך לתשאל אותה

<span dir="ltr">`mycontext query`</span> מריצה משפט SQL אחד, לקריאה בלבד, מול
<span dir="ltr">`.my_context/.index.db`</span>. האינדקס הוא מטמון — קובצי ה-Markdown הם
מקור האמת, ו-<span dir="ltr">`mycontext rebuild`</span> בונה ממנו את מסד הנתונים מחדש — ולכן
מה שאפשר לשאול אותו הוא הצורה של המטמון הזה, ולא מודל נתונים שני. כל מה שהסכמה אינה נושאת
כעמודה יושב ב-`data`, שמחזיק את הפריט כולו כ-JSON.

**<span dir="ltr">`items`</span> — שורה אחת לכל פריט, כששתי השכבות מקופלות לאותה טבלה.**

| עמודה | טיפוס | מה היא מחזיקה |
|---|---|---|
| `id` | `TEXT` | מזהה הפריט. מפתח ראשי |
| `type` | `TEXT` | שם הקטגוריה: `rule`, `constraint`, או [כזו שהגדרתם בעצמכם](#קטגוריות-שאתם-מגדירים-בעצמכם) |
| `title` | `TEXT` | כותרת הפריט |
| `status` | `TEXT` | אחד מחמשת [הסטטוסים](#צעד-2--זה-נשמר-כ-markdown-שאפשר-לקרוא-להשוות-ולסקור). רק `active` מוזרק אי פעם |
| `always` | `INTEGER` | <span dir="ltr">`1`</span> אם הפריט [נעוץ לכל סשן](#always--נעיצת-פריט-לכל-סשן), <span dir="ltr">`0`</span> אם לא |
| `has_scope` | `INTEGER` | <span dir="ltr">`1`</span> אם הפריט נושא לפחות glob אחד של scope, <span dir="ltr">`0`</span> אם ה-scope שלו ריק |
| `layer` | `TEXT` | `project` או `global` |
| `file_path` | `TEXT` | קובץ ה-Markdown של הפריט, יחסית לשורש השכבה שלו — <span dir="ltr">`items/rule/RULE-….md`</span> |
| `updated_at` | `TEXT` | מתי השורה הזאת נכתבה לאינדקס לאחרונה, ב-UTC. **לא** חותמת זמן של הפריט — קראו את האזהרה שלמטה לפני שאתם משתמשים בה |
| `data` | `TEXT` | הפריט כולו כ-JSON, כולל הגוף, התגיות, התצפיות והקשרים |

שתי טבלאות נוספות חולקות את הקובץ. <span dir="ltr">`schema_version(version)`</span> מחזיקה
שורה אחת: הגרסה של פורמט האינדקס עצמו.
<span dir="ltr">`ledger(session_id, item_id, tier, injected_at)`</span> רושמת כל הזרקה, והיא
מה ש-<span dir="ltr">`mycontext decay`</span> קוראת — אבל ה-hooks של הסשן הם שיוצרים אותה,
ולא `rebuild`, ולכן אינדקס שרק נבנה מחדש עדיין לא מחזיק אותה, ותשאול שלה נכשל עם
<span dir="ltr">`no such table: ledger`</span>.

**ב-`data` השמות ב-camelCase; ב-frontmatter של ה-Markdown הם ב-snake_case.** בקובץ כתוב
<span dir="ltr">`valid_from`</span>, <span dir="ltr">`source_file`</span> ו-<span dir="ltr">`source_anchor`</span>;
ב-JSON שב-`data` כתוב <span dir="ltr">`validFrom`</span>, <span dir="ltr">`sourceFile`</span>
ו-<span dir="ltr">`sourceAnchor`</span>, ונוספים לו `body`, `observations`, `relations`
ו-`extra`, שבו יושבים השדות הייחודיים לקטגוריה.
<span dir="ltr">`json_extract(data, '$.valid_from')`</span> מחזיר <span dir="ltr">`NULL`</span>
ולא שגיאה, ולכן זו שגיאת כתיב שנראית כמו שדה ריק.

</div>

> [!WARNING]
> <div dir="rtl">
>
> **<span dir="ltr">`updated_at`</span> הוא זמן הכתיבה לאינדקס, לא חותמת זמן של
> ה-Markdown.** כל <span dir="ltr">`mycontext query`</span> בונה את האינדקס מחדש לפני
> שהיא קוראת, ולכן <span dir="ltr">`updated_at`</span> נכתב מחדש ל*עכשיו* בכל שורה ובכל
> הרצה, בין אם ה-Markdown שמתחת השתנה ובין אם לא. הוא עונה על "מתי השורה הזאת אונדקסה
> לאחרונה" — תמיד: בהרצה הזאת — ולעולם לא על "מתי הפריט הזה השתנה לאחרונה".
> <span dir="ltr">`ORDER BY updated_at DESC`</span> לפיכך אינו ממיין דבר, ושום דבר לא
> אומר לכם זאת. כדי לדעת מתי פריט באמת השתנה, קראו את קובץ ה-Markdown או את היסטוריית
> ה-git שלו.
>
> </div>

<div dir="rtl">

**כמה פריטים יש מכל סוג ומכל סטטוס?**

</div>

<!-- example: query "SELECT type, status, COUNT(*) AS n FROM items GROUP BY type, status ORDER BY type" -->
```text
┌───────────────┬────────────┬───┐
│ type          │ status     │ n │
├───────────────┼────────────┼───┤
│ constraint    │ active     │ 1 │
│ decision      │ active     │ 2 │
│ invariant     │ active     │ 1 │
│ lesson        │ active     │ 1 │
│ open_question │ superseded │ 1 │
│ requirement   │ active     │ 1 │
│ rule          │ active     │ 1 │
│ rule          │ draft      │ 1 │
│ standard      │ active     │ 1 │
└───────────────┴────────────┴───┘

9 row(s)
```
<!-- /example -->

<div dir="rtl">

**אילו פריטים פעילים מוגבלים ב-scope, ולמה?** `scope` אינו עמודה — הוא מערך JSON בתוך
`data`, ו-`has_scope` הוא הדגל המאונדקס שמאפשר לסנן לפיו בלי לפרסר.

</div>

<!-- example: query "SELECT id, json_extract(data, '$.scope') AS scope FROM items WHERE status = 'active' AND has_scope = 1 ORDER BY id" -->
```text
┌─────────────────────────────────┬────────────────────┐
│ id                              │ scope              │
├─────────────────────────────────┼────────────────────┤
│ INV-prices-are-integer-cents    │ ["src/billing/**"] │
│ RULE-never-log-customer-email   │ ["src/**"]         │
│ STD-api-errors-use-problem-json │ ["src/api/**"]     │
└─────────────────────────────────┴────────────────────┘

3 row(s)
```
<!-- /example -->

<div dir="rtl">

**אילו פריטים מתויגים `privacy`?** זו בדיוק סוג השאלה ש-`query` קיימת בשבילה: הכלי
`query_items` מסנן לפי תגית, ושום פקודת שורת פקודה אינה עושה זאת.

</div>

<!-- example: query "SELECT id, type, status FROM items WHERE EXISTS (SELECT 1 FROM json_each(data, '$.tags') WHERE value = 'privacy') ORDER BY id" -->
```text
┌───────────────────────────────┬──────┬────────┐
│ id                            │ type │ status │
├───────────────────────────────┼──────┼────────┤
│ RULE-never-log-customer-email │ rule │ active │
└───────────────────────────────┴──────┴────────┘

1 row(s)
```
<!-- /example -->

<div dir="rtl">

**מה בדיוק אומר "לקריאה בלבד" כאן.** שני מנגנונים, ואף אחד מהם אינו ארגז חול מלא של SQL.
`query` מסרבת לכל דבר שאינו משפט יחיד הפותח ב-<span dir="ltr">`SELECT`</span> או
ב-<span dir="ltr">`WITH`</span>, ומסרבת לרשימת מילות מפתח של משפטים —
<span dir="ltr">`INSERT`, `DROP`, `PRAGMA`, `ATTACH`, `VACUUM`</span> וכן הלאה — בכל מקום
שבו הן מופיעות מחוץ למחרוזת או להערה. לאחר מכן היא פותחת את מסד הנתונים בחיבור לקריאה
בלבד, וזה מה שהמנוע אוכף כנגד כתיבות אל `items`, `ledger` ו-`schema_version` שבקובץ הזה.
רשימת מילות המפתח אינה הערובה, וזה מכוון: רשימת חסימה מעל דקדוק SQL מלא אינה יכולה להיות
שלמה, וזו אינה שלמה. החריג שכדאי להכיר הוא
<span dir="ltr">`VACUUM INTO '<path>'`</span>, שכותב עותק מלא של מסד הנתונים אל נתיב שהקורא
נוקב בו ולא אל האינדקס — החיבור לקריאה בלבד אינו עוצר אותו, ולכן עבור המשפט הזה בדיקת
מילות המפתח היא המחסום היחיד שקיים.

### רמות פירוט, ו-<span dir="ltr">`--json`</span>

כל פקודת דיווח — <span dir="ltr">`status`, `list`, `decay`, `review list`, `doctor`,
`ingest-status`</span> — מקבלת <span dir="ltr">`--full`</span>,
<span dir="ltr">`--short`</span> (ברירת המחדל) ו-<span dir="ltr">`--summary`</span>, וגם
<span dir="ltr">`--json`</span>.

<span dir="ltr">`--short`</span> וברירת המחדל הן טבלאות מיושרות בעמודות עם כותרות.
<span dir="ltr">`--full`</span> **אינה** טבלה רחבה יותר: היא מדפיסה גוש אחד לכל פריט, כל
שדה בשורה מתויגת משלו. שבע עמודות הכוללות מזהה בן 63 תווים וכותרת בת 92 תווים יצרו טבלה
ברוחב 280 תווים בקורפוס של המאגר הזה עצמו. הרמה שמראה הכי הרבה על פריט הייתה אפוא הרמה
היחידה ששום טרמינל לא יכול היה להציג, וטבלה שהייתה קוטעת את המזהה במקום זאת הייתה מוסרת
חצי מזהה שעדיין נראה שלם. שום דבר אינו נזרק ואינו נקטע באף רמה; מה שלא נכנס בשורה נשבר
לשורה הבאה.

הכול נפרס לרוחב 100 תווים. זהו קבוע, לא רוחב הטרמינל שלכם: פריסה שמסתגלת לרוחב הייתה
הופכת את גושי הדוגמאות במסמך הזה לעובדה על החלון שממנו הם נוצרו מחדש. אפשר לקבוע
`MYCONTEXT_WIDTH` כדי לפרוס לרוחב אחר.

כלל אחד גובר על התקציב: שום עמודה אינה מצטמצמת מתחת למחרוזת הרצופה הארוכה ביותר שבה, ולכן
מזהה, glob או נתיב לעולם אינם נשברים בין שורות ונשארים ניתנים להעתקה. לכן טבלה שהמחרוזות
שלה עצמן רחבות מהתקציב — קורפוס שבו המזהים לבדם חורגים ממנו — נשארת ברוחבה הטבעי במקום
להידחס לכיוון מספר שאינה יכולה להגיע אליו, משום שדחיסה כזאת עולה בשורות שלמות ועדיין
חורגת. כל הדוחות בקורפוס של המאגר הזה עצמו נכנסים עכשיו: הרחב מכולם, `list`, הוא 97
תווים.

<span dir="ltr">`--json`</span> הוא הייצוג הנאמן היחיד של הדוחות ההיררכיים (התקדמות לכל
עוגן במפגש קליטה, גוף של טיוטה), והוא נושא שגיאות טעינה של הקורפוס בתוך המסמך כך שהוא
נשאר ניתן לניתוח. אפשרות שאף אחת מהן אינה מכירה מסורבת ולא מתעלמים ממנה בשקט: כל השש
נבדקות מול רישום הפקודות ב-`test/cli/unknown-flag-refusal.test.ts`, ולא פקודה-פקודה.
`review promote` ו-`review discard` נבדקות מול מערכי הדגלים שלהן עצמן, כך
ש-<span dir="ltr">`--json`</span> שנועד לתור אינו עובר בשקט בתת-פקודה שכותבת.

<span dir="ltr">`--summary`</span> היא זו שכדאי להושיט אליה יד כשרוצים את הצורה ולא את
השורות. אותו דוח כמו למעלה, רמה אחת למטה:

</div>

<!-- example: status --summary -->
```text
my_context 0.1.0: 10 item(s), profile "standard"

review queue: 1 draft(s) pending review — walk it with `mycontext review`.

1 pending revision(s) on 1 item(s) — proposed by an agent and NOT applied; the items keep their
current text. Read them as diffs with `mycontext review revisions`.

usage: no sessions recorded yet — decay reporting starts once items begin to be injected.
  2 active normative item(s) carry no scope, so they apply to every file and compete for the jit
  budget on every file operation.

health: 0 error(s), 0 warning(s), 0 note(s) — details from `mycontext doctor`.
```
<!-- /example -->

<div dir="rtl">

טבלאות משורטטות בתווי מסגרת היכן שהטרמינל תומך בהם, וב-ASCII פשוט היכן שלא. הזיהוי נוטה
לכיוון ASCII, כך שטרמינל Windows שאינו מזוהה מקבל את הציור הבטוח. הגדירו
`MYCONTEXT_ASCII=1` כדי לכפות אותו, או `MYCONTEXT_UNICODE=1` כדי לכפות את הכיוון השני.

`mycontext query` **אינה** אחת מהן. היא מקבלת <span dir="ltr">`--json`</span>
ו-<span dir="ltr">`--limit <n>`</span> בלבד, ומסרבת לכל דבר אחר: לתוצאת SQL אין רמות
פירוט, מפני שהעמודות שלה הן אלה שה-`SELECT` שלך נוקב בהן.
ה-<span dir="ltr">`--json`</span> שלה הוא מסמך —
<span dir="ltr">`{ rows, rowCount, truncated, limit, loadErrors }`</span> — ולא מערך חשוף.
התוצאות מוגבלות ל-1000 שורות כברירת מחדל, ו-`truncated` הוא איך שמכונה לומדת שהתשובה
נקטעה. שימו <span dir="ltr">`--`</span> לפני SQL שמתחיל בהערת
<span dir="ltr">`--`</span>.

### מה שהמודל קורא לו: כלי ה-MCP

אחד-עשר כלים, מוגשים מעל stdio על ידי `src/mcp/server.ts`. המודל מגיע אליהם בלי shell, וכל
כתיבת פריט שהוא מבצע דרכם מוחתמת ככתיבת סוכן. זה מה שהופך את כלל הטיוטה
ש[בפרק 7](#7-גבול-האמון) לאכיף בכלל במשטח הזה.

| כלי | למה המודל משתמש בו |
|---|---|
| `create_item` | לכידת פריט מוקלד חדש. אידמפוטנטי: קריאה שנייה מדווחת על הפריט הקיים במקום לשכפל אותו |
| `update_item` | עדכון פריט קיים לפי מזהה — אבל לא כל שדה, ולא תמיד מיד. הוא **מסרב** ל-<span dir="ltr">`scope`</span>, ל-<span dir="ltr">`always`</span> ול-<span dir="ltr">`severity`</span> בפריט נורמטיבי ששולט, ול-<span dir="ltr">`status`</span> בכל פריט נורמטיבי. שינוי לכותרת, לגוף או לתגיות חל או **מוחזק כרוויזיה ממתינה** לפי הגדרת ה-[<span dir="ltr">`agentEdits`</span>](#categoriesnameagentedits--האם-שכתוב-של-סוכן-חל-או-ממתין) של הקטגוריה, שברירת המחדל שלה היא החזקה לכל קטגוריה נורמטיבית. שדות נוספים חלים ישירות |
| `supersede_item` | הוצאת פריט לגמלאות לטובת מחליף, תוך רישום שני כיווני היחס. הוא **מסרב** להוציא לגמלאות פריט נורמטיבי ששולט — זו החלטה של אדם |
| `link_items` | רישום יחס מוקלד בין שני פריטים, כמו `derived_from` או `constrains` |
| `get_item` | שליפת פריט אחד במלואו, כ-Markdown, כשהמזהה כבר ידוע |
| `query_items` | חיפוש וסינון לפי סוג, סטטוס, תגית, יחס, טקסט או נתיב קובץ. זה מה ש-<span dir="ltr">`/mycontext:search`</span> קוראת לו |
| `list_drafts` | מניית מה שממתין לסקירת אדם, החדש ביותר ראשון — לא כדי לקדם, מה שאין ביכולתו |
| `load_context` | הזרקת הפריטים הנעוצים והאינדקס עכשיו, בדיוק כמו תחילת סשן. זה מה ש-<span dir="ltr">`/mycontext:LoadMyContext`</span> קוראת לו |
| `mycontext_help` | קריאת הדרכה על נושא אחד: <span dir="ltr">categories, scope, capture, workflow</span> |
| `mycontext_examples` | הצגת פריט לדוגמה שלם מסוג נתון, להעתיק ממנו את הצורה |
| `ingest_document` | חילוץ פריטים נורמטיביים ממסמך, באותה צורה של שתי קריאות כמו פקודות הקליטה בשורת הפקודה |

רשימת הכלים ממוינת ויציבה ברמת הבתים בין קריאות, וזה מה שמאפשר ל-Claude Code להטמין את
הפרומפט שנושא אותה. כל כלי מצהיר על רשימת הארגומנטים המלאה שלו ומסרב לכל דבר אחר: ארגומנט
שכלי אינו יכול לפעול לפיו נענה בסירוב שמונה את מה שהכלי כן מקבל, ולעולם אינו מתקבל ונזרק.

`create_item` בפרט מסרב ל-`relations` בשמו. יחסים נוספים אחרי שהפריט קיים, עם
`link_items`, או עם `supersede_item` ליחס של הוצאה לגמלאות — יחס ש-`link_items` לא יכתוב,
מפני שהוא טוען טענה על מחזור החיים שאינו מבצע.

### כל הדגלים, במקום אחד

**דגל** (flag) — נקרא גם אפשרות או מתג — הוא <span dir="ltr">`--name`</span> שנכתב אחרי
פקודה. יש כאן שני סוגים. *מתג* הוא דלוק או כבוי ואינו מקבל דבר אחריו
(<span dir="ltr">`--yes`, `--json`</span>). *דגל ערך* בא בליווי הערך שיש לקבוע, ושני
האיותים <span dir="ltr">`--name value`</span> ו-<span dir="ltr">`--name=value`</span>
שקולים בכל מקום בשורת הפקודה הזאת.

עשרים ושניים אלה הם כולם. שום דבר כאן אינו חל על כל הפקודות: כל שורה אומרת בדיוק היכן
הדגל עובד. פקודה שקיבלה דגל שאינה מכירה או מסרבת לו או — בכמה פקודות — מתעלמת ממנו, ומי
מהשתיים [מפורט למטה](#שלושה-כללים-שחלים-על-כולם). כלי ה-MCP מקבלים ארגומנטים בשם ב-JSON
ולא דגלים; אלה טבלת הכלים [שלמעלה](#מה-שהמודל-קורא-לו-כלי-ה-mcp).

**בחירת כמות הפירוט שדוח מדפיס.**

| דגל | מה הוא עושה | היכן הוא עובד |
|---|---|---|
| <span dir="ltr">`--short`</span> | שורה אחת לכל פריט, בטבלה מיושרת בעמודות. **זו ברירת המחדל** — אין צורך להקליד אותה לעולם | <span dir="ltr">`list`, `status`, `decay`, `doctor`, `review list`, `ingest-status`</span> |
| <span dir="ltr">`--full`</span> | גוש אחד לכל פריט, כל שדה בשורה מתויגת משלו. לא טבלה רחבה יותר | אותן שש |
| <span dir="ltr">`--summary`</span> | הצורה בלי השורות: ספירות כותרת ואזהרות בלבד | אותן שש |
| <span dir="ltr">`--json`</span> | מסמך JSON אחד במקום טבלה, כולל שגיאות טעינה של הקורפוס. הייצוג הנאמן היחיד של דוח מקונן | אותן שש, ובנוסף <span dir="ltr">`mycontext query`</span> |
| <span dir="ltr">`--quiet`</span> | ב-<span dir="ltr">`mycontext doctor`</span> בלבד, איות ותיק יותר של <span dir="ltr">`--summary`</span>. אם תעבירו גם <span dir="ltr">`--quiet`</span> וגם רמת פירוט, <span dir="ltr">`--quiet`</span> מנצח ואף אחד לא אומר זאת | `doctor` |
| <span dir="ltr">`--sessions <n>`</span> | כמה סשנים אחרונים נחשבים "לאחרונה" בדוח הדעיכה. ברירת מחדל 20; חייב להיות מספר שלם גדול מאפס | `decay` |
| <span dir="ltr">`--all`</span> | להציג גם את הפריטים ה*חמימים* — אלה שכן הוזרקו בתוך החלון, ושהדוח משמיט אחרת. <span dir="ltr">`--full`</span> כבר כולל אותם | `decay` |
| <span dir="ltr">`--limit <n>`</span> | מספר השורות המרבי ששאילתת SQL מחזירה. ברירת מחדל 1000, מינימום 1; אין הגדרה של "בלי הגבלה". כשהתקרה נוגסת, הדוח אומר זאת | `query` |
| <span dir="ltr">`--type <category>`</span> | להציג רק טיוטות מקטגוריה אחת. שם שאין לו קטגוריה פשוט לא תואם דבר — זו אינה שגיאה | <span dir="ltr">`review list`</span> |

**קביעת שדה בפריט.**

| דגל | מה הוא עושה | היכן הוא עובד |
|---|---|---|
| <span dir="ltr">`--body "<text>"`</span> | הטקסט של הפריט — הפסקה ש-Claude מקבל | <span dir="ltr">`add`, `edit`</span> |
| <span dir="ltr">`--scope "<globs>"`</span> | תבניות הקבצים שהפריט נצמד אליהן, מופרדות בפסיקים | <span dir="ltr">`add`, `edit`, `review promote`, `lesson-accept`</span> |
| <span dir="ltr">`--tags "<labels>"`</span> | תגיות חופשיות, מופרדות בפסיקים. אינן משפיעות על ההזרקה | <span dir="ltr">`add`, `edit`</span> |
| <span dir="ltr">`--severity hard\|soft`</span> | פריטי `hard` מתקבלים לתקציב לפני `soft`. כל מילה אחרת מסורבת. <span dir="ltr">`mycontext harden <id>`</span> ו-<span dir="ltr">`mycontext soften <id>`</span> הן שתי ההגדרות האלה בשם קצר יותר | <span dir="ltr">`add`, `edit`, `review promote`, `lesson-accept`</span> |
| <span dir="ltr">`--always`</span> | לנעוץ את הפריט: להזריק אותו במלואו בתחילת כל סשן, בלי קשר לקבצים. <span dir="ltr">`review promote --always`</span> קובעת אותו כל עוד הפריט טיוטה; <span dir="ltr">`mycontext edit --always`</span> קובעת אותו, ו-<span dir="ltr">`--always=false`</span> מנקה אותו, בכל שלב — מאחורי האישור שפריט ששולט כבר מזכה בו. <span dir="ltr">`mycontext pin <id>`</span> ו-<span dir="ltr">`mycontext unpin <id>`</span> הן שתי העריכות האלה בשם קצר יותר | <span dir="ltr">`review promote`, `edit`</span> |
| <span dir="ltr">`--title "<text>"`</span> | להחליף את כותרת המועמד המבוים בניסוח שלך לפני שהכלל נוצר; ב-`edit`, הכותרת של הפריט עצמו | <span dir="ltr">`lesson-accept`, `edit`</span> |
| <span dir="ltr">`--directive do\|dont`</span> | האם הכלל שנוצר מורה או אוסר | `lesson-accept` |
| <span dir="ltr">`--status <name>`</span> | להזיז את סטטוס מחזור החיים של פריט: <span dir="ltr">`active`, `draft`, `deprecated`</span> או `validated`. `superseded` **מסורב** כאן, כי פרישה נוקבת במחליף שלה ורושמת אותו בשני הכיוונים — וזו <span dir="ltr">`mycontext supersede`</span> | `edit` |
| <span dir="ltr">`--by <id>`</span> | נוקב במחליף שתופס את מקומו של הפריט הפורש. **חובה** — פרישה בלי יורש אינה מוצעת | `supersede` |
| <span dir="ltr">`--reason "<text>"`</span> | למה הפרישה קרתה. זה נרשם כתצפית `supersession` על ה**מחליף**, בנוסח <span dir="ltr">`Replaces <old id>: <your text>`</span> | `supersede` |

**אישור שינוי, והזנת נתונים פנימה.**

| דגל | מה הוא עושה | היכן הוא עובד |
|---|---|---|
| <span dir="ltr">`--yes`</span> | לאשר בלי שישאלו. כל אחת מהפקודות האלה אומרת מה היא עומדת לעשות ואז ממתינה לכן; זה עונה מראש, וזה מה שהופך את הפקודה לשמישה בסקריפט. זה אינו אמצעי אבטחה — ראו [פרק 7](#7-גבול-האמון) | <span dir="ltr">`add`, `edit`, `review promote`, `review discard`, `review promote-revision`, `review discard-revision`, `supersede`, `repair`</span> — וגם הצורות הקרויות של <span dir="ltr">`edit`</span>: <span dir="ltr">`pin`, `unpin`, `harden`, `soften`</span>, שהן אותו שער בשם קצר יותר ולא ארבעה שערים נוספים |
| <span dir="ltr">`--anchor <a>`</span> | לאיזה חלק של המסמך הכוונה. ב-`ingest` הוא מבקש מחדש מקטע מסוים במקום את הבא בתור; ב-`ingest-apply` הוא **חובה**, ואומר מאיזה מקטע הגיעו המועמדים שאתם מחזירים | <span dir="ltr">`ingest`, `ingest-apply`</span> |
| <span dir="ltr">`--file <path>`</span> | לקרוא את ה-JSON מקובץ במקום מ-stdin | <span dir="ltr">`ingest-apply`, `lesson-stage`</span> |
| <span dir="ltr">`--stdin`</span> | לקרוא את ה-JSON מ-stdin — האיות להזרמה פנימה. `ingest-apply` דורשת אחד מבין <span dir="ltr">`--file`</span> ו-<span dir="ltr">`--stdin`</span> ומדפיסה שימוש אם לא ניתן אף אחד; `lesson-stage` קוראת מ-stdin בכל פעם ש-<span dir="ltr">`--file`</span> נעדר, כך שבפקודה הזאת <span dir="ltr">`--stdin`</span> מתעד כוונה ולא מפעיל דבר | <span dir="ltr">`ingest-apply`, `lesson-stage`</span> |

#### שלושה כללים שחלים על כולם

**חזרה על דגל או אוספת או מסרבת, ולעולם אינה שומרת אחד מהם בשקט.**
<span dir="ltr">`--scope`</span> ו-<span dir="ltr">`--tags`</span> הם רשימות, ולכן חזרה
פירושה "וגם": <span dir="ltr">`--scope "src/api/**,src/db/**"`</span>
ו-<span dir="ltr">`--scope src/api/** --scope src/db/**`</span> מייצרים בדיוק את אותו
פריט. כל דגל ערך אחר מחזיק ערך יחיד, ומסירתו פעמיים מסורבת מכול וכול במקום להיפתר:
<span dir="ltr">`--body x --body y`</span> נעצר בהודעה שנוקבת בשניהם. זו אינה קפדנות.
שמירת הראשון בשקט היא מה ששורת הפקודה הזאת עשתה פעם, וזה נתן scope שגוי לפריט אמיתי
בקורפוס של המאגר הזה עצמו לפני שמישהו שם לב.

**<span dir="ltr">`--yes=false`</span> פירושו לא.** מתג אינו רק צורתו החשופה.
<span dir="ltr">`--yes`, `--yes=true`, `--yes=yes`, `--yes=on`, `--yes=1`</span> כולם
מאשרים. <span dir="ltr">`--yes=false`, `--yes=no`, `--yes=off`, `--yes=0`</span> כולם
מסרבים, ומשאירים את הפקודה בדיוק במקום שבו הייתה בלי <span dir="ltr">`--yes`</span> כלל:
היא שואלת, או מסרבת אם אין טרמינל לשאול בו. כל דבר אחר, כמו
<span dir="ltr">`--yes=maybe`</span>, מסורב ולא מנוחש, והעברת איות אמת ואיות שקר של אותו
דגל מסורבת אף היא. כל זה חל על <span dir="ltr">`--json`, `--full`, `--all`</span> וכל מתג
אחר, לא רק על <span dir="ltr">`--yes`</span>.

**דגל שאינו מוכר מסורב — ברוב הפקודות.** <span dir="ltr">`mycontext status --ful`</span>
נעצר ונוקב בשגיאת ההקלדה במקום להדפיס את דוח ברירת המחדל ולצאת עם 0. הפקודות שבודקות הן
<span dir="ltr">`add`, `list`, `status`, `decay`, `doctor`, `review`</span> (כל תת-פקודה
מול המערך שלה), <span dir="ltr">`ingest-status`, `query`, `repair`, `supersede`, `edit`</span>. גם
<span dir="ltr">`mycontext help`</span> מסרבת, אך בדרך אחרת: היא קוראת את מה שבא אחריה כשם
נושא, ו-<span dir="ltr">`--anything`</span> אינו אחד מארבעת הנושאים שלה.

הפקודות ש**אינן** בודקות הן <span dir="ltr">`init`, `show`, `rebuild`, `examples`,
`ingest`, `ingest-apply`, `lesson`, `lesson-stage`, `lesson-accept`,
`lesson-discard`</span>: דגל שהן אינן מכירות נזרק בלי מילה. נבדק בהרצה של כל אחת מהן.
הפער אמיתי, וכדאי להכיר אותו לפני שסומכים על כך שדגל אכן נכנס לתוקף.

## 6. תצורה

התצורה נמצאת בקובץ אחד, <span dir="ltr">`.my_context/config.json`</span>, שנוצר על ידי
`mycontext init`:

</div>

```json
{
  "profile": "standard",
  "categories": {},
  "budgets": {}
}
```

<div dir="rtl">

כל מה שלמטה הוא רשות. הדוגמאות שלהלן הורצו כל אחת מול קורפוס ה-Bookstore API לדוגמה,
והפלט המצוטט הוא מה שבאמת השתנה.

### `profile` — אילו קטגוריות קיימות בכלל

שלושה פרופילים: `minimal` (8 קטגוריות), `standard` (17, ברירת המחדל) ו-`full` (כל ה-20).
פרופיל קובע אילו קטגוריות **מופעלות**. שם פרופיל לא מוכר הוא שגיאה בזמן טעינה, לא נסיגה
שקטה.

מעבר של פרויקט הדוגמה ל-<span dir="ltr">`"profile": "minimal"`</span> מכבה את
<span dir="ltr">`decision`, `requirement`, `standard`</span>, בין היתר. הפריטים שלהן אינם
נעלמים; הם מפסיקים להימנות אחד-אחד באינדקס ונספרים כמכובים במקום זאת:

</div>

```text
1 lesson · 1 drafts pending review · 1 retired · 2 decision (disabled/unknown category) · 1 requirement (disabled/unknown category) · 1 standard (disabled/unknown category)
```

<div dir="rtl">

זו כל הנקודה שבתווית. כיבוי קטגוריה לעולם לא מעלים את פריטיה בלי סימן.

### מה כל קטגוריה אומרת

קטגוריה אינה תווית תיוק. היא קובעת שני דברים שאי אפשר לשנות אחר כך: לאיזה **דרג** הפריט
שייך — פריטים נורמטיביים יכולים להיות מוזרקים לסשן עתידי, פריטי נימוקים לעולם לא — ומה
**הקידומת של המזהה** שלו. `type` נקבע ברגע היצירה, ו-`update_item` אינו יכול לתייק פריט
מחדש, משום שהסוג קובע היכן הקובץ יושב.

ההגדרות חיות בקטלוג (`src/core/categories.ts`) ומודפסות עבור הפרויקט *שלכם* על ידי
`mycontext help categories`, שאותו המודל קורא דרך הכלי `mycontext_help`. הגוש שלמטה הוא
הפלט האמיתי של הפקודה הזאת מול פרויקט הדוגמה, ולכן הוא מונה את 17 הקטגוריות שהפרופיל
`standard` מפעיל, לפי סדר הדרגים. הוא נוצר מחדש על ידי `npm run gen:docs`, כך שהמסמך הזה
אינו יכול לפגר אחרי הקטלוג בלי שחבילת הבדיקות תאמר זאת:

</div>

<!-- example: help categories -->
```text
# Categories

Every my_context item has a type. The type decides two things: whether the item
can be injected into a future session, and the prefix of its id.

- **Normative** types govern future work. With `always: true` they are injected
  in full at every session start. Otherwise they are injected when a file they
  apply to is touched: the files matching their `scope`, or every file if they
  declare none — see `help("scope")`.
- **Rationale** types explain past reasoning. They are never injected. They
  appear in the session index as counts and are retrieved with `query_items`.

Because a rationale item is never injected, `always` and `severity` do nothing
on one — the pinned tier admits only normative items, and nothing outside that
tier gates on severity. Setting either on a rationale item is therefore
**refused** rather than stored and ignored, on every write surface. Two things
work instead: change the category's tier (`categories.<name>.tier` in
`.my_context/config.json`), or capture the fact in a normative category.
`scope` is not refused there — it is inert for injection on the rationale tier,
but `query_items({path})` reads it on every item, which is how "what was
decided about this file?" is answered.

Only the types below are accepted in this project. Anything else is refused.

| type | tier | id prefix | use for |
|---|---|---|---|
| `constraint` | normative | `CONST-` | Non-negotiable limit: budget, stack, regulation, SLA |
| `glossary` | normative | `GLOSS-` | Ubiquitous language: the agreed term, and terms not to use |
| `instruction` | normative | `INSTR-` | Governs the agent's process, not the artifact |
| `invariant` | normative | `INV-` | Condition that must always hold during execution |
| `non_goal` | normative | `NOGOAL-` | Explicit prohibition on building something |
| `open_question` | normative | `OPENQ-` | Deliberately undecided; the agent must not decide it alone |
| `pattern` | normative | `PAT-` | Reusable solution, or an anti-pattern to avoid |
| `requirement` | normative | `REQ-` | What must be built |
| `rule` | normative | `RULE-` | A do/dont directive |
| `standard` | normative | `STD-` | Formatting, coding convention, architectural guideline |
| `adr` | rationale | `ADR-` | Formal decision record, MADR shape |
| `assumption` | rationale | `ASSUME-` | Unverified premise plus validation deadline |
| `decision` | rationale | `DEC-` | Lightweight decision not warranting a full ADR |
| `edge_case` | rationale | `EDGE-` | Boundary condition; frequently worth promoting |
| `lesson` | rationale | `LESSON-` | What was learned; source material for generated rules |
| `risk` | rationale | `RISK-` | May occur and would harm |
| `tradeoff` | rationale | `TRADE-` | What was sacrificed for what |

## Choosing between close neighbours

- `adr` vs `decision` — an ADR is heavyweight: drivers, considered options,
  outcome, consequences. A decision is one sentence plus its reason. If you
  would not write a "considered options" section, it is a `decision`.
- `constraint` vs `non_goal` — a constraint limits *how* something is built
  ("must run on Node 24 with no dependencies"). A non_goal excludes the thing
  itself ("we are not building offline sync").
- `rule` vs `standard` — a rule is a do/don't directive and carries
  `directive: do | dont`. A standard is a convention that shapes how code looks.
- `standard` vs `pattern` — a standard says what the code should look like
  everywhere ("every exported function carries a doc comment"). A pattern is a
  shape to reach for when a particular problem comes up, or one to avoid
  ("repository objects wrap every query; handlers never open a connection").
- `requirement` vs `constraint` — a requirement is what must be built. A
  constraint limits how anything may be built. "Users can reset their own
  password" is a requirement; "on Node 24 with no dependencies" is a
  constraint.
- `invariant` vs `rule` — an invariant is a condition about the running system
  that must hold at all times and can in principle be checked ("an order total
  equals the sum of its line items"). A rule is an instruction to whoever is
  writing the code.
- `instruction` vs `rule` — an instruction governs how the agent works ("run
  the test suite before claiming a change is complete"). A rule governs what it
  produces. When in doubt, ask whether the sentence would still make sense to a
  human contributor with no agent involved: if it would, it is a rule.
- `decision` vs `tradeoff` — a decision records what was chosen. A tradeoff
  records what that choice cost, and is worth its own item when the cost is
  what a future reader will be tempted to undo.
- `risk` vs `assumption` — a risk is something that may happen and would harm.
  An assumption is something already being relied on as true. A risk is watched;
  an assumption is validated by a date.
- `edge_case` vs `requirement` — an edge case is a boundary the system must
  survive, captured as rationale so it is not lost. Once it is agreed that the
  system must handle it in a particular way, that agreement is a requirement or
  an invariant, and the edge case is the reasoning behind it.
- `lesson` vs `rule` — a lesson is what happened. A rule is what must now hold.
  Capture the lesson; a human promotes it to a rule.
- `open_question` vs `assumption` — an open question is deliberately undecided
  and you must not decide it alone. An assumption is a premise someone already
  acted on that has not been verified yet.
- Functional versus non-functional requirements are the `kind` field on
  `requirement`, not two types.

## When you are unsure

Capture it as the closest type rather than not capturing it. `update_item`
cannot re-file an item under a different type — `type` is fixed at creation
and decides where the file lives. A misfiled item is recovered by
`create_item`-ing a correctly-typed replacement and `supersede_item`-ing the
original onto it, or by a human editing the Markdown directly. An uncaptured
constraint is lost either way, which is the greater risk.
```
<!-- /example -->

<div dir="rtl">

### קטגוריות שאתם מגדירים בעצמכם

הקטלוג הוא אוצר מילים התחלתי, לא הרשימה כולה. **שם שאינו בקטלוג הופך לקטגוריה מן המניין
בפרויקט הזה ברגע שאתם מצהירים עליו עם <span dir="ltr">`tier`</span> ועם
<span dir="ltr">`description`</span>:**

</div>

```json
{
  "categories": {
    "security_control": {
      "tier": "normative",
      "description": "A control the system must implement to satisfy a security requirement"
    }
  }
}
```

<!--
  גושי ה-`text` בפרק הזה מאומתים ביד, לא נוצרים אוטומטית, ולכן אינם מכוסים על ידי
  `test/docs/examples.test.ts`. ההנמקה המלאה נמצאת בהערה המקבילה ב-README.md.
-->

<div dir="rtl">

שני המפתחות נדרשים. שם שאינו בקטלוג ושחסר לו אחד מהם הוא שגיאה בזמן טעינה, ולא קטגוריה
שמתעלמים ממנה בשקט. כך נראית <span dir="ltr">`mycontext list`</span> בפרויקט שהצהיר על
ה-`tier` והשמיט את ה-`description`:

</div>

```text
my_context: unknown category "security_control". To define a custom category it must declare both "tier" (normative | rationale) and "description".
```

<div dir="rtl">

מרגע שהיא מוצהרת, `security_control` היא קטגוריה ככל קטגוריה אחרת.
<span dir="ltr">`mycontext add security_control "All admin endpoints require MFA" --scope
"src/admin/**" --yes`</span> יוצרת את
<span dir="ltr">`SECURI-all-admin-endpoints-require-mfa`</span> תחת
<span dir="ltr">`items/security_control/`</span>:

</div>

```text
about to create security_control "All admin endpoints require MFA" — active, and governing this project at once.
my_context: created SECURI-all-admin-endpoints-require-mfa (active) at items/security_control/SECURI-all-admin-endpoints-require-mfa.md.
```

<div dir="rtl">

היא מקבלת שורה ב-<span dir="ltr">`mycontext help categories`</span>, כך שהמודל קורא את
התיאור שלה בדיוק כפי שהוא קורא תיאור של קטגוריה מובנית. היא נמנית
ב-<span dir="ltr">`mycontext list`</span>, יש לה תבנית
ב-<span dir="ltr">`mycontext examples security_control`</span>,
<span dir="ltr">`mycontext doctor`</span> בודק אותה ו-<span dir="ltr">`mycontext
query`</span> שולף אותה. מכיוון שהיא נורמטיבית היא מוזרקת כשנוגעים בקובץ תחת
<span dir="ltr">`src/admin/`</span>, ו-<span dir="ltr">`mycontext pin`</span> מכניסה אותה
לכל סשן. הכלי `create_item` מקבל אותה ומנחית את הגרסה של הסוכן כטיוטה, בדיוק כמו בקטגוריה
מובנית. וארבעת מפתחות התצורה שלכל קטגוריה — <span dir="ltr">`enabled`, `tier`,
`agentEdits`, `scopePolicy`</span> — חלים עליה כולם.

זו הנקודה שכדאי לקחת מהפרק הזה: **my_context הוא תשתית לכל אוצר מילים נורמטיבי שיש
לפרויקט שלכם בפועל**, ולא רשימה קבועה של עשרים שמות עצם. אם התחום שלכם חושב במונחי בקרות
אבטחה או יעדי רמת שירות, הצהירו עליהם ותייקו אותם ככאלה במקום תחת הקטגוריה המובנית הקרובה
ביותר — `type` נקבע ברגע היצירה, ולכן פריט שתויק לא נכון נשאר לא נכון.

שלושה דברים שכדאי לדעת לפני שמתחייבים לאחת.

**קידומת המזהה נגזרת מהשם, אלא אם קבעתם אחת.** היא שש האותיות והספרות הראשונות של השם,
באותיות גדולות: `security_control` נותן <span dir="ltr">`SECURI-`</span>. קבעו `prefix`
כדי לבחור בעצמכם:

</div>

```json
{ "categories": { "slo": { "tier": "normative", "description": "…", "prefix": "SLO" } } }
```

<div dir="rtl">

שני שמות שחולקים את שש האותיות והספרות הראשונות שלהם —
<span dir="ltr">`standard_ops`</span> ו-<span dir="ltr">`standardize`</span> — מגיעים
לאותה קידומת, ושום דבר לא מזהיר, ולכן קבעו `prefix` במפורש כשזה עומד לקרות. **`prefix`
עובד רק על קטגוריה שאתם מגדירים.** על קטגוריה מובנית הוא מתקבל ונזנח:
<span dir="ltr">`{ "rule": { "prefix": "POLICY" } }`</span> נטען בלי תלונה, ומזהי ה-`rule`
נשארים <span dir="ltr">`RULE-`</span>. זה פגם, לא תכנון — אל תסתמכו לא על הקבלה ולא על
השתיקה.

**לקטגוריה שאתם מגדירים אין שדות frontmatter ייחודיים לקטגוריה.** המובנות מצהירות על כמה
— <span dir="ltr">`directive`</span> ב-`rule`, <span dir="ltr">`kind`</span>
ב-`requirement` — ואין מפתח תצורה שמצהיר על שדה כזה, ולכן `security_control` אינו יכול
לשאת <span dir="ltr">`control_id`</span>. `create_item` מסרב לו במקום להשמיט אותו:

</div>

```text
my_context: create_item does not take "control_id". It accepts: type, title, body, scope, tags, severity, always, observations, source_file, source_anchor, blocks, directive, impact, kind, likelihood, validate_by, validated_on. Nothing was written — an argument this tool cannot act on is refused rather than ignored.
```

<div dir="rtl">

שימו את הערך בגוף הפריט, או ב-`tags`.

**פקודות הסלאש מגיעות מהקטלוג שנשלח, לא מהתצורה שלכם.** המחולל
(<span dir="ltr">`src/plugin/commands.ts`</span>) אכן בונה
<span dir="ltr">`/mycontext:add-<name>`</span> ו-<span dir="ltr">`/mycontext:list-<name>`</span>
לכל קטגוריה מופעלת בכל תצורה שנמסרת לו, כולל קטגוריות שהוגדרו ביד, והוא מסרב לשני שמות
שהיו מייצרים את אותו קובץ פקודה. אבל התיקייה `commands/` נוצרת ונשמרת ב-git כשהתוסף
נבנה, מתצורת ברירת המחדל, ולכן לקטגוריה שאתם מצהירים עליה אין פקודת סלאש בפרויקט שלכם.
לכדו אותה עם <span dir="ltr">`mycontext add`</span>, או בקשו מהמודל, מה שמגיע
ל-`create_item` — המשטח הזה מקבל כל סוג מופעל.

### שלוש הקטגוריות שרק `full` מפעילה

הקטלוג מחזיק **20** קטגוריות, ו-`standard` הוא בדיוק אלה שהקטלוג מסמן `defaultEnabled`,
כלומר **17**. השלוש שהוא משאיר בחוץ — <span dir="ltr">`policy`, `postmortem`,
`taxonomy`</span> — אינן ניסיוניות ואינן בלתי גמורות. הן שלמות, וכל אחת מהן חופפת
לקטגוריה שכבר מופעלת. סוג אינו ניתן לשינוי אחרי היצירה, ולכן שני סוגים חופפים שמופעלים
יחד הם הזמנה לתייק את אותה עובדה תחת שניהם, בלי שום דרך ליישב ביניהם אחר כך:

| קטגוריה | דרג | חופפת ל־ | הפעילו אותה כאשר |
|---|---|---|---|
| `policy` | נורמטיבי | <span dir="ltr">`rule`, `constraint`</span> | יש לכם באמת שכבה מעל הכללים — מדיניות עסקית או מדיניות אבטחה שכמה כללים מממשים, ושבבעלות ובגרסאות נפרדות מהם |
| `postmortem` | נימוקים | `lesson` | אתם כותבים תחקירי תקלה מלאים ורוצים אותם ליד הקוד. `lesson` הוא המסקנה בפסקה אחת, ו-`postmortem` הוא המסמך כולו |
| `taxonomy` | נימוקים | `glossary` | לתחום שלכם יש יחסים בין מונחים שראוי לתעד, ולא רק את המונחים עצמם. `glossary` מגדיר מילה, ו-`taxonomy` אומר איך המושגים ניצבים זה מול זה |

מפעילים אחת עם <span dir="ltr">`"profile": "full"`</span>, או אחת-אחת עם
<span dir="ltr">`"categories": { "policy": { "enabled": true } }`</span> — אותו מתג שהפרק
הבא מתאר, בכיוון ההפוך.

`minimal` הוא רשימה קצרה מסוג אחר: לא "המופעלות פחות כמה", אלא רשימה שנקובה במפורש
בקטלוג. שלושה סוגים נורמטיביים (<span dir="ltr">`constraint`, `invariant`,
`rule`</span>) וחמישה סוגי נימוקים (<span dir="ltr">`adr`, `assumption`, `edge_case`,
`lesson`, `tradeoff`</span>) — שמונה בסך הכול. שני הדרגים עדיין מיוצגים, וזה מה שמונע
מהפרופיל הקטן ביותר להפוך לקורפוס של כללים בלי סיבות מתועדות.

### `categories.<name>.enabled` — כיבוי קטגוריה אחת

</div>

```json
{ "categories": { "standard": { "enabled": false } } }
```

<div dir="rtl">

עם זה מוגדר, <span dir="ltr">`mycontext add standard "…"`</span> מסורבת במקום להתקבל:

</div>

```text
my_context: category "standard" is disabled in this project, so no new standard items are accepted. Enable it in .my_context/config.json under categories.standard.enabled, or pick another type — see mycontext_help("categories").
```

<div dir="rtl">

ה-`STD-api-errors-use-problem-json` הקיים עדיין מופיע ב-`mycontext list`, ואינדקס תחילת
הסשן סופר אותו כ-<span dir="ltr">`1 standard (disabled/unknown category)`</span> במקום
למנות אותו. פקודות הסלאש אינן הולכות אחרי המתג הזה:
<span dir="ltr">`/mycontext:add-standard`</span> ו-<span dir="ltr">`/mycontext:list-standard`</span>
נשארות על הדיסק, משום שהתיקייה `commands/` נוצרת מתצורת ברירת המחדל כשהתוסף נבנה ושום דבר
אינו מייצר אותה מחדש מהתצורה של הפרויקט שלכם — ראו את ההערה על פקודות סלאש בפרק הקודם.

### `categories.<name>.tier` — מה שולט, ומה רק מיידע

הדרג של קטגוריה קובע אם פריטיה יכולים להיות מוזרקים. העברת `standard` מ-`normative`
ל-`rationale`:

</div>

```json
{ "categories": { "standard": { "tier": "rationale" } } }
```

<div dir="rtl">

משנה את אינדקס תחילת הסשן ממניית הפריט בשמו לספירתו. לפני:

</div>

```text
- STD-api-errors-use-problem-json · standard · API errors use Problem JSON
```

<div dir="rtl">

אחרי, אותו פריט מופיע רק בתוך ספירות הנימוקים:

</div>

```text
2 decision · 1 lesson · 1 standard · 1 drafts pending review · 1 retired
```

<div dir="rtl">

זו האפשרות המשמעותית ביותר בקובץ. העברת קטגוריה ל-`rationale` פירושה שפריטיה מפסיקים
לכוון את המודל; העברת קטגוריה ל-`normative` פירושה שהם מתחילים.

### `categories.<name>.agentEdits` — האם שכתוב של סוכן חל או ממתין

סוכן אינו יכול לשנות <span dir="ltr">`scope`</span>, <span dir="ltr">`always`</span>,
<span dir="ltr">`severity`</span> או <span dir="ltr">`status`</span> של פריט ששולט. הוא
**כן** יכול לשכתב את הטקסט, והטקסט של פריט נורמטיבי הוא ההוראה עצמה: "לעולם אל תרשמו
ללוג את כתובת המייל של הלקוח" יכול להתרכך למשהו חלש יותר בעוד הפריט נשאר
<span dir="ltr">`active`</span>, נשאר <span dir="ltr">`hard`</span>, ונקרא כבלתי משתנה בכל
דוח. ההגדרה הזו היא שקובעת אם עריכה כזו נוחתת או ממתינה.

</div>

```json
{ "categories": { "rule": { "agentEdits": "review" }, "lesson": { "agentEdits": "allow" } } }
```

<div dir="rtl">

| ערך | עריכה של סוכן לתוכן הקטגוריה הזו |
|---|---|
| <span dir="ltr">`allow`</span> | חלה מיד, והסוכן מקבל תשובה <span dir="ltr">`updated`</span> |
| <span dir="ltr">`review`</span> | **מוחזקת כרוויזיה ממתינה**. הפריט אינו נוגע ומוסיף לשלוט בטקסט הנוכחי שלו עד שתקדמו את השינוי |

**"תוכן" פירושו הכותרת, הגוף והתגיות** — לא הגוף לבדו. פיצול ביניהם היה מאפשר לסוכן לשכתב
את ההוראה דרך הכותרת בעוד הגוף שמור, וזו אותה פרצה בשדה אחר. זה כתוב כאן במפורש ולא נשאר
להסקה, מפני שמשתמש שקורא "גוף" ומגלה שגם הכותרת מכוסה הופתע מהתצורה של עצמו.

שני שדות שההגדרה **אינה** מכסה, בשני המקרים מפני ששום דבר אינו יכול לערוך אותם באופן
שההגדרה מניחה. <span dir="ltr">`observations`</span> אינן ניתנות לשינוי בשום משטח, על ידי
אף אחד, אחרי הלכידה — כך שאין כאן מה לשלוט בו. ו-<span dir="ltr">`extra`</span> — שמחזיק
את <span dir="ltr">`directive`</span> של כלל, שהוא בעצמו הוראה — חל ישירות גם תחת
<span dir="ltr">`review`</span>, מפני שרוויזיה מוחזקת אינה יכולה לשאת אותו. סוכן שמשנה
<span dir="ltr">`extra`</span> **וגם** את הגוף בקריאה אחת נדחה כולו במקום להיות מיושם
בחצי, מה שסוגר את המקרה המעורב אך לא את המקרה של <span dir="ltr">`extra`</span> לבדו.
הפער הזה אמיתי; [פרק 8](#8-עדיין-לא-זמין) רושם אותו במקום לטשטש אותו.

ברירת המחדל נגזרת מהדרג ה**מיושב** של הקטגוריה: <span dir="ltr">`review`</span> לכל
קטגוריה נורמטיבית, <span dir="ltr">`allow`</span> לכל קטגוריית נימוקים. זו בדיוק החלוקה
ש[פרק 2](#2-הרעיון) כבר מתווה — הטקסט של פריט נורמטיבי משנה את מה שקלוד מקבל *הוראה
לעשות*, והטקסט של פריט נימוק משנה את מה שהוא *יודע*. היא הולכת אחרי הדרג שהגדרתם ולא אחרי
זה שהקטלוג מספק, כך ש-<span dir="ltr">`{"categories": {"lesson": {"tier": "normative"}}}`</span>
מעביר גם את <span dir="ltr">`lesson`</span> ל-<span dir="ltr">`review`</span>, והגדרה
מפורשת גוברת על שתיהן.

ההגדרה נקראת רק עבור סוכן. העריכות שלכם — `mycontext edit`, `mycontext add`,
<span dir="ltr">`mycontext review promote`</span> — מעבירות מקור אנושי ולעולם אינן מוחזקות,
תהיה ההגדרה אשר תהיה.

הנה ההבדל שהיא עושה, שני הצדדים דרך הכלי `update_item` האמיתי. תחת
<span dir="ltr">`allow`</span>:

</div>

```text
my_context: updated RULE-never-log-customer-email (active).
```

<div dir="rtl">

ותחת <span dir="ltr">`review`</span>, לאותה קריאה בדיוק:

</div>

```text
my_context: NOT applied — staged as revision REV-5218d09de570 for review. RULE-never-log-customer-email is unchanged and keeps governing its current body, and will until a human promotes this proposal. A human sees it with `mycontext review revisions` (it is counted by `mycontext status` too), and it is recorded in <workspace>/.my_context/.revisions/revisions.jsonl. Tell the user you staged it rather than assuming they will look. Do not reason as if the new text is in force.
```

<div dir="rtl">

**<span dir="ltr">`allow`</span> אינו אומר "סוכנים רשאים לעשות כל דבר לקטגוריה הזו."** הוא
מרחיב את מה שסוכן רשאי לעשות ל*תוכן* ותו לא: <span dir="ltr">`scope`</span>,
<span dir="ltr">`always`</span>, <span dir="ltr">`severity`</span>
ו-<span dir="ltr">`status`</span> על פריט נורמטיבי ששולט נשארים אנושיים בלבד תחת שני
הערכים, ונדחים על ידי שומר שההגדרה הזו כלל אינה נקראת בו. הגדרת
<span dir="ltr">`allow`</span> על <span dir="ltr">`rule`</span> ואז בקשה מסוכן להקשיח כלל
עדיין מקבלת את הסירוב, והסירוב מפנה ל-`mycontext edit` כפקודה שיש לאדם.

[פרק 5](#5-שימוש) מוליך רוויזיה מוחזקת מההצעה של הסוכן ועד לקידום,
ו[פרק 7](#7-גבול-האמון) מתאר מהי רוויזיה כזו ומה אינה. ערך שאינו
<span dir="ltr">`allow`</span> או <span dir="ltr">`review`</span> נדחה בטעינת התצורה, תוך
ציון המפתח ושני הערכים.

### `categories.<name>.scopePolicy` — מה המשמעות של scope ריק

פריט בלי `scope` אינו מוגבל כברירת מחדל: הוא חל על כל קובץ. זו הכרעה אחת, והיא אינה
נכונה לכל סוג ידע, ולכן זו הגדרה לכל קטגוריה בנפרד, עם שלושה ערכים:

</div>

```json
{ "categories": { "pattern": { "scopePolicy": "required" }, "lesson": { "scopePolicy": "inert" } } }
```

<div dir="rtl">

| ערך | פריט מקטגוריה זו ללא scope |
|---|---|
| <span dir="ltr">`global`</span> | חל על כל קובץ — ברירת המחדל, וההתנהגות הקיימת |
| <span dir="ltr">`required`</span> | **נדחה בזמן הלכידה**: `mycontext add`, הכלי `create_item` והקליטה כולם אומרים זאת ואינם כותבים דבר. העבירו <span dir="ltr">`--scope`</span>. גם עריכה שמסירה את ה-glob האחרון נדחית |
| <span dir="ltr">`inert`</span> | חל על אף קובץ: לעולם אינו מוזרק בדיוק בזמן, ואינו מוחזר מ-<span dir="ltr">`query_items({path})`</span>. הוא עדיין מופיע באינדקס הסשן, ו-<span dir="ltr">`always: true`</span> עדיין נועץ אותו |

<span dir="ltr">`required`</span> דוחה בלכידה ולעולם לא בהזרקה: פריט שקיים ולעולם לא יוזרק
הוא מלכודת, לא מדיניות.

**שינוי ההגדרה הזו אינו כותב מחדש דבר ממה שכבר לכדתם.** פריט שנלכד כשהקטגוריה שלו הייתה
<span dir="ltr">`global`</span> ונקרא מאוחר יותר תחת <span dir="ltr">`inert`</span> מפסיק
להיות מוזרק, וקובץ ה-Markdown שלו מעולם לא השתנה — מפני שהמדיניות היא תצורה, לא תוכן.
זה מכוון, וזה מדווח במקום להיוותר לגילוי מקרי: `mycontext doctor` מדפיס הערת
<span dir="ltr">`scope_policy_inert`</span> (או <span dir="ltr">`scope_policy_required`</span>)
שסופרת את הפריטים שמדיניות זו משנה כרגע את התנהגותם. גם הדוחות אומרים איזה כלל בתוקף —
ה-scope של פריט ללא globs מוצג כ-<span dir="ltr">`(unrestricted)`</span> תחת
<span dir="ltr">`global`</span> ו-<span dir="ltr">`required`</span>, וכ-<span dir="ltr">`(inert)`</span>
תחת <span dir="ltr">`inert`</span>.

### `budgets` — כמה הקשר כל דרג רשאי להוציא

</div>

```json
{ "budgets": { "pinned": 1500, "jit": 500, "restored": 2000, "index": 150 } }
```

<div dir="rtl">

אלה ברירות המחדל, בטוקנים משוערים (תווים חלקי ארבע — אין כאן tokenizer, ולכן זה קירוב
לשני הכיוונים). הורדה של אחד מהם אינה משמיטה דבר בשקט. עם
<span dir="ltr">`"index": 30`</span>, ארבע שורות האינדקס של פרויקט הדוגמה הופכות לאחת ועוד
ספירה:

</div>

```text
- INV-prices-are-integer-cents · invariant · Prices are integer cents
- … +3 more (fetch with mycontext show <id>)
```

<div dir="rtl">

ועם <span dir="ltr">`"jit": 40`</span>, הזרקה שנורתה מקובץ אינה נושאת טקסט מלא כלל, אלא רק
את הגילוי של מה שלא נכנס:

</div>

```text
_2 item(s) omitted from full text for budget: INV-prices-are-integer-cents, RULE-never-log-customer-email. Fetch with mycontext show <id>._
```

<div dir="rtl">

ערך שאינו מספר סופי הגדול או שווה לאפס נזנח וברירת המחדל נשמרת.

### `watchedDocs` — מהיכן מגיעה תזכורת ללכוד

אחרי שאתה עורך קובץ שתואם לאחד מה-globs האלה, my_context מוסיף לסשן שורה אחת שמציעה
ללכוד את מה שהעריכה החליטה. ברירות המחדל הן
<span dir="ltr">`docs/superpowers/specs/**`, `docs/superpowers/plans/**`,
`docs/prd/**`</span>. עריכת `docs/prd/checkout.md` תחת ברירות המחדל מייצרת:

</div>

```text
You edited docs/prd/checkout.md. If it set a new requirement, decision or constraint, capture it now with create_item (source_file: the path above). Skip if nothing new was decided.
```

<div dir="rtl">

הגדירו <span dir="ltr">`"watchedDocs": ["docs/rfc/**"]`</span> ואותה עריכה לא תייצר דבר,
מפני **שהרשימה שאתה נותן מחליפה את ברירות המחדל**. היא אינה מתווספת אליהן. כתיבות בתוך
<span dir="ltr">`.my_context/`</span> לעולם אינן מייצרות תזכורת, מה שלא יגידו ה-globs.

### globs של scope — המתג הפרטני לכל פריט

`scope` הוא תכונה של פריט ולא של קובץ התצורה, והוא ההגדרה שקובעת את רוב מה שאתה רואה. זו
רשימת globs בסגנון POSIX, יחסית לשורש המאגר, שמותאמת מול הקובץ ש-Claude עומד לקרוא או
לערוך.

כלל שה-scope שלו <span dir="ltr">`src/billing/tax/**`</span> אינו נורה כש-Claude פותח את
`src/billing/prices.js`:

</div>

```text
### INV-prices-are-integer-cents · invariant · Prices are integer cents
### RULE-never-log-customer-email · rule · Never log customer email
```

<div dir="rtl">

והוא כן נורה ברגע שהוא פותח את `src/billing/tax/vat.js`:

</div>

```text
### INV-prices-are-integer-cents · invariant · Prices are integer cents
### RULE-never-log-customer-email · rule · Never log customer email
### RULE-vat-rates-come-from-the-tax-table · rule · VAT rates come from the tax table
```

<div dir="rtl">

(כותרות בלבד, למעלה; כל אחד מהם מגיע עם הגוף המלא שלו.) צמצום ה-scope הוא איך שמונעים
מפריט להוציא הקשר על עבודה שאין לו קשר אליה. מסלול הקליטה דוחה את
<span dir="ltr">`**`, `*`, `**/*`</span> — לא מפני שאסור לפריט לחול על הכול, אלא מפני
שהשמטת `scope` כבר אומרת בדיוק את זה, ואיות הדבר כ-glob רק מסתיר את הכוונה.

<span dir="ltr">`--scope`</span> ב-`mycontext add` מופרד בפסיקים וניתן לחזרה, וכל מופע
נשמר. פריט בלי scope כלל אינו מוגבל: הוא חל על כל קובץ, ודרג ה"בדיוק בזמן" מוסר אותו
כבר בקובץ הראשון שהסשן נוגע בו. זו משמעות ברירת המחדל של scope ריק;
<span dir="ltr">`categories.<name>.scopePolicy`</span> ([פרק 6](#6-תצורה)) משנה אותה לכל
קטגוריה בנפרד.

### `always` — נעיצת פריט לכל סשן

פריט עם `always: true` מוזרק במלואו בתחילת כל סשן, לפני שנוגעים בקובץ כלשהו וללא תלות
ב-scope. פריטים **נורמטיביים** אחרים ממתינים לקובץ שהם חלים עליו, ועד אז מופיעים כשורת
אינדקס אחת. פריטי נימוקים
(<span dir="ltr">`lesson`, `adr`, `decision`, `tradeoff`</span>, …) לעולם אינם נמנים
אחד-אחד; הם תורמים ספירה מצרפית בלבד. ראו `mycontext help categories`.

יש שני מסלולים, והבחירה ביניהם תלויה רק במקום שבו הפריט נמצא. בזמן שהוא עדיין טיוטה,
**<span dir="ltr">`mycontext review promote <id> --always`</span>** מקדמת ונועצת בצעד אחד.
ברגע שהוא שולט, **<span dir="ltr">`mycontext pin <id>`</span>** — או
<span dir="ltr">`mycontext edit <id> --always=true`</span>, שהיא אותה פקודה — מגדירה אותו,
ו-<span dir="ltr">`mycontext unpin <id>`</span> מנקה אותו, מאחורי התצוגה המקדימה והאישור
שפריט ששולט כבר מזכה בהם. אף אחד מהשניים אינו זמין לקלוד: `update_item` מסרב
ל-<span dir="ltr">`scope`/`always`/`severity`</span> בפריט נורמטיבי ששולט, מפני שכל כתיבת
MCP מקבעת מקור שאינו אנושי, והסירוב שלו נוקב ב-<span dir="ltr">`mycontext pin`</span>
כדבר שאדם יכול לעשות.

בפריט **נימוקים** (<span dir="ltr">`lesson`, `adr`, `decision`, `tradeoff`</span>, …) השדות
<span dir="ltr">`always: true`</span> ו-<span dir="ltr">`severity: hard`</span> **מסורבים**,
בכל משטח כתיבה: <span dir="ltr">`mycontext add`</span>, <span dir="ltr">`create_item`</span>,
<span dir="ltr">`update_item`</span>,
<span dir="ltr">`review promote --always/--severity`</span> והקליטה. הבחירה מכניסה לדרג הנעוץ
פריטים נורמטיביים בלבד, ומחוץ לדרג הזה שום דבר אינו מותנה בחומרה — כך ששני השדות היו נשמרים
ולא עושים דבר, ושדה שמתקבל ומתעלמים ממנו הוא הכשל היחיד שהפרויקט הזה מתייחס אליו כבלתי מתקבל
על הדעת. הסירוב מציין את שתי הדרכים קדימה: לשנות את דרג הקטגוריה
(<span dir="ltr">`categories.<name>.tier`</span>), או לתעד את העובדה בקטגוריה נורמטיבית.
`scope` **אינו** מסורב שם — הוא חסר השפעה על ההזרקה בדרג הזה, אבל
<span dir="ltr">`query_items({path})`</span> קורא אותו בכל פריט, וכך נענית השאלה "מה הוחלט
על הקובץ הזה?".

פריט שנושא אחד מהשדות האלה מפני שהקטגוריה שלו הייתה נורמטיבית ברגע הלכידה ושונתה אחר כך,
נשאר ניתן לעריכה: מסורב רק שינוי שקובע את השדה מחדש, ו-<span dir="ltr">`update_item`</span>
מדווח על הערך השמור כחסר השפעה במקום לדווח "עודכן" בלבד.

### התצורה מחליפה; היא לא ממזגת

שני כללים, והראשון מפתיע אנשים:

- **`watchedDocs` מחליף את ברירות המחדל.** תנו לו glob אחד ויהיה לכם glob אחד. אם אתם
  רוצים את ברירות המחדל ועוד שלכם, כתבו את כולם. אין "הרחבה".
- **`categories` ו-`budgets` ממזגים לפי מפתח.**
  <span dir="ltr">`{"budgets": {"index": 30}}`</span> משאיר את
  <span dir="ltr">`pinned`, `jit`, `restored`</span> בברירות המחדל,
  ו-<span dir="ltr">`{"categories": {"standard": {"enabled": false}}}`</span> אינו משנה
  דבר בשום קטגוריה אחרת. בתוך קטגוריה אחת, רק המפתחות שנקבתם בהם נדרסים.

שם קטגוריה שאינו מובנה חייב להצהיר גם `tier` וגם `description`, אחרת התצורה נדחית. זה
מכוון: שגיאת הקלדה בשם קטגוריה הייתה אחרת יוצרת קטגוריה חדשה וריקה שלא מקבלת דבר בשקט.

## 7. גבול האמון

### טיוטה ופעיל, ולמה קיימת סקירה

המנגנון הוא שדה סטטוס. `draft` ו-`active` הם שניהם פריטים רגילים על הדיסק, וההבדל ביניהם
הוא שטיוטה אינה נבחרת לאף דרג הזרקה. הקידום הוא מה שהופך פריט ל-`active`, ופעיל הוא מה
שגורם לו לשלוט.

</div>

```mermaid
stateDiagram-v2
  direction LR
  [*] --> draft: Claude לוכד פריט נורמטיבי<br/>(create_item, origin מוחתם agent)
  [*] --> active: אתה לוכד בעצמך<br/>(mycontext add, עם אישור מפורש)
  draft --> active: mycontext review promote<br/>החלטה של אדם
  draft --> deprecated: mycontext review discard
  active --> superseded: mycontext supersede, בציון מחליף<br/>החלטה של אדם
  note right of draft
    לא נבחר לאף דרג.
    נספר באינדקס, לא מוזרק לשום מקום.
  end note
  note right of active
    מוזרק: נעוץ, בדיוק בזמן, או משוחזר.
  end note
```

<div dir="rtl">

הסיבה היא הטווח שתואר ב[פרק 2](#2-הרעיון). טקסט נורמטיבי מוזרק במלואו, בלי שביקשו, מנוסח
כהוראה. משהו בעל טווח כזה, שנכתב בידי משהו שיכול לטעות בביטחון, שווה מבט אנושי אחד לפני
שהוא הופך להוראה קבועה לכל סשן עתידי. לטעות לגבי *למה* עולה בהסבר מטעה; לטעות לגבי *מה
חייב להתקיים* עולה בקוד שגוי, שנכתב בביטחון.

נימוקים אינם עוברים שער, וגם לא צריכים. `decision` או `lesson` שנלכדו בידי המודל נוחתים
`active` מיד, מפני שנימוקים לעולם אינם מוזרקים אוטומטית. אפשר לשלוף אותם, אבל הם אינם
יכולים לכוון דבר מעצמם.

### מה הכלים מתירים, ומה shell מוסיף

סוכן שמחזיק רק את כלי ה-MCP יכול ליצור פריטים (נורמטיביים כטיוטות), **להציע** רוויזיה
לכותרת, לגוף או לתגיות של פריט, לשנות שדות נוספים של פריט, לקשר פריטים, לקרוא הכול, למנות
את תור הסקירה, ולטעון הקשר. הוא אינו יכול לקדם טיוטה, ו-`supersede_item` מסרב על הסף
להוציא לגמלאות פריט נורמטיבי ששולט כרגע. `update_item` מסרב ל-`scope`, ל-`always`
ול-`severity` בפריט נורמטיבי ששולט, ול-`status` בכל פריט נורמטיבי שהוא.

**האם ההצעה הזו היא הצעה או עריכה שחלה — זו הגדרה, וברירת המחדל שלה היא הזהירה.** תחת
[<span dir="ltr">`categories.<name>.agentEdits`</span>](#categoriesnameagentedits--האם-שכתוב-של-סוכן-חל-או-ממתין)
— <span dir="ltr">`review`</span> לכל קטגוריה נורמטיבית אלא אם תשנו זאת — עריכה של סוכן
לכותרת, לגוף או לתגיות אינה נכנסת לתוקף. היא מוחזקת, הפריט ממשיך לשלוט בטקסט שכבר היה לו,
והסוכן נאמר לו במילה הראשונה ששום דבר לא יושם. תחת <span dir="ltr">`allow`</span> אותה
עריכה נוחתת מיד, וזה מה שכל קטגוריה עשתה לפני שההגדרה הזו קיימת ומה שכל קטגוריית נימוקים
עדיין עושה. כך ש"סוכן יכול לתקן את הטקסט של כלל" נכון רק במובן שהוא יכול *לבקש*; אם בקשה
מספיקה — זה בידיכם, לכל קטגוריה בנפרד.

שדה אחד נמצא מחוץ לזה: <span dir="ltr">`extra`</span> — ה-`directive` של כלל, שהוא הוראה —
חל ישירות גם תחת <span dir="ltr">`review`</span>, מפני שרוויזיה מוחזקת אינה יכולה לשאת
אותו. קריאה שמשנה <span dir="ltr">`extra`</span> *וגם* תוכן נדחית כולה במקום להיות מיושמת
בחצי, אבל שינוי של <span dir="ltr">`extra`</span> לבדו אינו מוחזק.
[פרק 8](#8-עדיין-לא-זמין) רושם את הפער.

שום כלי אינו מקבל ארגומנט `origin`: <span dir="ltr">`create_item`, `update_item`,
`supersede_item`</span> מחתימים `agent` בעצמם, כך שסוכן אינו יכול לטעון שהיה אדם.
(`link_items` אינו נושא `origin` כלל, מפני שיחס אינו נוגע בשום דבר שהגבול עוסק בו — לא
סטטוס, לא חומרה, לא scope, לא `always` ולא הגוף.)

סוכן שמחזיק גם `Bash` מחזיק את כל זה ועוד את שורת הפקודה, ושורת הפקודה היא המשטח האנושי.
שם נמצא הגבול בפועל, ושאר הפרק הזה עוסק בשאלה כמה הוא מחזיק.

### מהי רוויזיה ממתינה, ומה היא אינה יכולה לעשות

רוויזיה ממתינה היא **שינוי מוצע לטקסט של פריט, שאינו הפריט**. היא חיה ביומן שרק מוסיפים לו
תחת <span dir="ltr">`.my_context/.revisions/`</span>, לעולם לא תחת
<span dir="ltr">`items/`</span>, וזה מבני ולא הבטחה: הטוען שבונה את הקורפוס עובר על
<span dir="ltr">`items/`</span> ועל שום דבר אחר, ולכן שום דבר במסלול הבחירה אינו יכול לראות
רוויזיה.

מה שנובע מכך, וכל אחד מאלה ראוי לאמירה מפורשת מפני שהחלופה הייתה מלכודת:

- **הפריט ממשיך לשלוט בטקסט הנוכחי שלו.** לא בטקסט המוצע, ולא באף אחד מהם — המילים שהיו
  בתוקף לפני שהסוכן כתב הן עדיין המילים שמוזרקות לכל סשן, עד שתקדמו את השינוי.
- **רוויזיה מוחזקת לעולם אינה מוזרקת**, בשום דרג, בשום סשן.
- **רוויזיה אינה פריט.** היא אינה מופיעה ב-`mycontext list`, אינה ניתנת לבחירה, ואינה מזיזה
  אף ספירה של מה ששולט. `mycontext status` ו-`mycontext review` סופרים אותה במקום אחד
  ובמשפט אחד — שורת *רוויזיות ממתינות* שנפרדת בכוונה מספירת תור הטיוטות, מפני ששני התורים
  מיושבים אחרת.
- **דחייה אינה הורסת את ההצעה.** <span dir="ltr">`review discard-revision`</span> מוסיפה
  הכרעה; היא לעולם אינה משכתבת את השורה שרשמה את ההצעה, ולכן הטקסט המלא שהסוכן הציע נשאר
  על הדיסק ו-<span dir="ltr">`mycontext review revisions <id> --full`</span> מדפיס אותו
  בחזרה. הפקודה אומרת זאת בשעה שהיא דוחה.

**אם תערכו את הפריט מתחת לרוויזיה ממתינה, הרוויזיה הופכת לישנה במקום לנצח בשקט.** הישָנות
היא לכל שדה בנפרד: הצעה לגוף ישנה רק אם שיניתם את הגוף, כך שהצעה לכותרת לצידה נשארת ניתנת
לקידום. קידום רוויזיה ישנה נדחה, תוך ציון השדות שזזו והדפסת שני הטקסטים.

**<span dir="ltr">`--force`</span> הוא העקיפה, ומה שהוא הורס זו העריכה שלכם.**
<span dir="ltr">`mycontext review promote-revision <id> --force`</span> מיישמת רוויזיה ישנה
בכל זאת; הטקסט שכתבתם בינתיים מוחלף בטקסט שהסוכן הציע מול גרסה ישנה יותר, והוא אינו ניתן
לשחזור מהפריט. לפני השאלה היא מדפיסה שני הפרשים עם מקרא נפרד לכל אחד — השינוי שעומד לחול,
והטקסט החדש שעומד להיאבד — והיא עדיין עוברת דרך האישור, שעליו
<span dir="ltr">`--yes`</span> עונה מראש בדיוק כמו בכל מקום אחר. על רוויזיה ש*אינה* ישנה,
<span dir="ltr">`--force`</span> אומר זאת במקום להיבלע.

לפריט יכולה להיות יותר מרוויזיה ממתינה אחת, וכל אחת רושמת את הטקסט שמולו נכתבה. קידום של
אחת מותיר לכן את האחרות ישנות במקום לערום אותן זו על זו, והקידום נוקב בדיוק באלה שהוא זה
עתה ביטל.

### גבול האישור — קראו את זה לפני שאתם סומכים עליו

פריט נורמטיבי שנלכד בידי מודל נוחת כ-`draft` ואינו שולט בכלום עד שאדם מקדם אותו. כלל
שנגזר מלקח חסר השפעה עד שאדם מקבל אותו. זה התכנון.

**מה שבאמת אוכף את זה: הרשאות ה-Bash שלך, ולא שום דבר אחר.**

שמונה פקודות בשורת הפקודה משנות את מה ששולט בפרויקט הזה בלי אדם בלולאה. חמש מהן מעבירות
פריט את שער הטיוטה — שלוש מהן היו מתועדות בשלב מסוים, אחר כך ארבע, והחמישית (`repair`)
נשלחה באותו סבב שבו נכתבה הרשימה. השישית, `supersede`, פועלת בכיוון ההפוך: היא מוציאה
פריט ששולט *החוצה*. השביעית, `edit`, פועלת בשני הכיוונים: היא יכולה לצמצם את ה-scope של
פריט ששולט, לבטל את נעיצתו, להוציא אותו לגמלאות או לשכתב את ההוראה שהוא נושא. השמינית,
<span dir="ltr">`review promote-revision`</span>, היא זו שלסוכן יש בה את העניין הישיר
ביותר: היא מיישמת שינוי ש*הסוכן עצמו הציע*, בטקסט של פריט שכבר שולט.

<span dir="ltr">`mycontext pin`</span>, <span dir="ltr">`unpin`</span>,
<span dir="ltr">`harden`</span> ו-<span dir="ltr">`soften`</span> הן `edit` בשם קצר יותר,
והן שייכות לרשימה הזאת בדיוק כמו `edit`: אותו <span dir="ltr">`--yes`</span>, אותה תצוגה
מקדימה, אותה כתיבה. הן אינן נספרות כאן כארבע פקודות נוספות מפני שאינן ארבעה מנגנונים
נוספים; אבל כלל הרשאות מותאם מול *מחרוזת* הפקודה, ולכן
<span dir="ltr">`Bash(mycontext edit *)`</span> אינו תואם
<span dir="ltr">`mycontext pin …`</span>, וכל אחת מהארבע זקוקה לכלל מניעה משלה למטה.
אותו חשבון תופס את תור הרוויזיות מהכיוון השני:
<span dir="ltr">`Bash(mycontext review promote *)`</span> **אינו** תואם
<span dir="ltr">`mycontext review promote-revision …`</span>, מפני שהתבנית מצפה לרווח במקום
שבו לפקודה האמיתית יש מקף. עוד שני כללים, למטה, מאותה סיבה.

| פקודה | מה היא עושה בלי אדם בלולאה |
|---|---|
| <span dir="ltr">`mycontext review promote <id>`</span> | הופכת טיוטה לפריט `active` ששולט |
| <span dir="ltr">`mycontext review discard <id>`</span> | מוציאה טיוטה לגמלאות |
| <span dir="ltr">`mycontext lesson-accept <lesson> <key>`</span> | יוצרת כלל `active` ממועמד שהועמד |
| <span dir="ltr">`mycontext add <normative category> "…" --yes`</span> | יוצרת פריט ששולט **ישירות** — היא מעבירה <span dir="ltr">`origin: 'human'`</span>, ולכן הורדת הדרגה לטיוטה אינה חלה. היא דורשת <span dir="ltr">`--yes`</span>, באותם תנאים כמו `promote`: כל דבר שיכול להריץ `mycontext` יכול להעביר <span dir="ltr">`--yes`</span>, כך שהשער קונה סימן מפורש בתמליל, לא הגנה |
| <span dir="ltr">`mycontext supersede <id> --by <id> --yes`</span> | מוציאה לגמלאות פריט ששולט, מסמנת אותו `superseded` כך שהוא מפסיק להיות מוזרק, ורושמת את הזוג בשני הכיוונים (`superseded_by` על הפורש, `supersedes` על המחליף). היא מעבירה <span dir="ltr">`origin: 'human'`</span>, וזה בדיוק מה שכלי ה-MCP `supersede_item` מסרב לעשות עבור פריט נורמטיבי `active` או `validated` — כך שהפקודה הזאת היא הדרך לעקוף את הסירוב הזה לכל מי שמחזיק shell. היא מדפיסה מה מוצא לגמלאות, באילו תנאים הוא מוזרק היום, ומה שולט אחר כך (כולל "כלום") לפני שהיא מבקשת אישור |
| <span dir="ltr">`mycontext edit <id> … --yes`</span> | משנה כל שדה של פריט שכבר שולט — את הגוף שלו, את ה-scope, את דגל <span dir="ltr">`always`</span>, את ה-severity או את הסטטוס. היא מעבירה <span dir="ltr">`origin: 'human'`</span>, וזה בדיוק מה ש-`update_item` מסרב לעשות בשדות ההישג והכוח של פריט נורמטיבי `active` או `validated` — כך שהפקודה הזאת היא הדרך לעקוף את הסירוב הזה לכל מי שמחזיק shell. היא מדפיסה מה משתנה, ומה שולט לפני ואחרי, לפני שהיא מבקשת אישור |
| <span dir="ltr">`mycontext review promote-revision <id> --yes`</span> | מיישמת רוויזיה ממתינה, כך שהכותרת, הגוף או התגיות של פריט ששולט הופכים לטקסט ש**סוכן** הציע. זו החצי השני של <span dir="ltr">`agentEdits: "review"`</span>: ההגדרה מחזיקה את השכתוב של הסוכן, והפקודה הזאת היא ששחררת אותו. <span dir="ltr">`--force`</span> דורסת בנוסף עריכה אנושית חדשה יותר של אותו שדה — היא מדפיסה קודם מה היא הורסת, אבל <span dir="ltr">`--yes --force`</span> עונה גם על השאלה הזאת מראש |
| <span dir="ltr">`mycontext review discard-revision <id> --yes`</span> | דוחה רוויזיה ממתינה. היא אינה משנה דבר במה ששולט, ולכן אינה נספרת בין השמונה שלמעלה — אבל היא מיישבת, סופית, הכרעה שתור הרוויזיות קיים כדי לשמור לאדם, ואותה הצעה אינה יכולה להיות מוחזקת שוב מול אותו טקסט. ההצעה עצמה נשארת ביומן |
| <span dir="ltr">`mycontext repair --yes`</span> | מחתימה מחדש את ה-checksum של כל פריט שהקובץ שלו כבר לא תואם לו. זו *מטרת* הפקודה, וזה גם מה שמשלים מסלול ששום דבר אחר אינו מציע: `update_item` מסרב ל-<span dir="ltr">`always`/`severity`/`status`</span> בפריט ששולט, ועריכה ידנית של השדות האלה מותירה אי-התאמה קבועה ש-`doctor` מדווח עליה ו-`rebuild` לעולם אינו מנקה — עד ש-`repair` מנקה אותה. כך שעריכה ידנית ועוד <span dir="ltr">`repair --yes`</span> משנות את מה ששולט בפרויקט הזה ואינן מותירות ראיה שזה קרה. אומת בהרצה |

אלה פקודות רגילות בשורת הפקודה. בקשת גזירת הכללים שהתוסף הזה מדפיס *מנחה את המודל לצאת
ל-shell אל שורת הפקודה הזאת*, ואותו shell מגיע לכל אחת מהן. אישור
ה-<span dir="ltr">`--yes`</span> ב-`promote`, ב-`discard`,
ב-<span dir="ltr">`promote-revision`</span>, ב-<span dir="ltr">`discard-revision`</span>,
ב-`add`, ב-`supersede` וב-`edit` **אינו** גבול אבטחה: סוכן שמרכיב את שורת הפקודה יכול
להוסיף <span dir="ltr">`--yes`</span> בעצמו, ולהוסיף לצידו גם
<span dir="ltr">`--force`</span>. מה שהוא כן קונה הוא קריאוּת. אי אפשר ליצור, להוציא
לגמלאות או לשכתב פריט ששולט בלי סימן מפורש שאפשר לחפש בתמליל.

**יש מסלול שני שעוקף את שורת הפקודה לגמרי.** ה-hook `PreToolUse` דוחה כתיבות תחת
<span dir="ltr">`.my_context/`</span>, אבל תבנית ההתאמה שלו היא
<span dir="ltr">`Read|Edit|MultiEdit|Write|NotebookEdit`</span> — **`Bash` אינו מותאם** —
וה-hook בוחן רק ארגומנט `file_path`, שקריאת Bash אינה נושאת. הפניית פלט ב-shell אל
<span dir="ltr">`.my_context/items/…`</span> ואחריה `mycontext rebuild` אינה נראית לו
כלל. הוספת `Bash` לתבנית ההתאמה לא הייתה סוגרת את זה מעצמה: ה-hook היה צריך לנתח מחרוזות
פקודה שרירותיות כדי למצוא את הכתיבה, וזו אותה בעיה חסרת גבולות שיש לכללי ההרשאות שלמטה.

**איותים חלופיים של התיקייה המנוהלת סגורים, כולל אלה שאינם חולקים איתה אף תו.** דחיית
הכתיבה מתאימה את מקטעי הנתיב <span dir="ltr">`.my_context`</span>
ו-<span dir="ltr">`.my-context`</span> ללא תלות ברישיות, ואז מביאה את הנתיב לצורתו
הקנונית — פותרת את הקידומת הארוכה ביותר שכבר קיימת, מכיוון ש-`Write` נוקב בקובץ שאינו
קיים — כך שאיות שהתאמת המחרוזות אינה רואה עדיין נתפס לפי מה שהוא נפתר אליו.

במכונה הזאת זה מכסה **שם קצר 8.3** של Windows (`MY_CON~1`, שנוצר בכל פעם
ש-<span dir="ltr">`fsutil 8dot3name query <volume>`</span> מדווח שהמנגנון מופעל), קישורים
סימבוליים ו-junctions של NTFS שמצביעים לתוך התיקייה, קידומות
<span dir="ltr">`\\?\`</span>, שיתופי ניהול מסוג <span dir="ltr">`\\localhost\C$`</span>,
כונני `subst` ומעבר עם <span dir="ltr">`..`</span>. כל אחד נבדק בהרצה מול ה-hook האמיתי,
לפני ואחרי. קישור סימבולי או junction שמצביעים *לתוך*
<span dir="ltr">`.my_context`</span> נדחים מאותה סיבה: הם שם נוסף לאותה תיקייה.

**מה שהבאה לצורה קנונית אינה יכולה לסגור הוא קישור קשיח.** לקישור סימבולי יש יעד. קישור
קשיח הוא רשומת ספרייה שנייה ושוות ערך לאותו קובץ, ואין דרך לומר איזו רשומה היא האמיתית.
קישור קשיח שהונח מחוץ ל-<span dir="ltr">`.my_context`</span> ומצביע על קובץ פריט קיים הוא
נתיב שה-hook אינו יכול לזהות, ו-`Write` דרכו עורך את הפריט במקום. זה לא ממש מסלול נפרד
אלא נגזרת של מסלול ה-Bash שלמעלה — יצירת הקישור דורשת shell מלכתחילה — אבל זה האיות היחיד
שה-hook הזה נראה כאילו הוא אמור לתפוס ואינו תופס.

**האמירה הכנה, והיא רחבה מזו שהקובץ הזה נהג לומר: השער מחזיק אם ורק אם משטח ה-Bash של
הסוכן אינו כולל את הקובץ הבינארי `mycontext` כלל, בכל איות, *וגם* כתיבות ישירות אל
<span dir="ltr">`.my_context/`</span>.**

**תוסף אינו יכול לשלוח כללי הרשאות.** ה-`settings.json` של תוספים ב-Claude Code תומך רק
במפתחות `agent` ו-`subagentStatusLine`, ולכן המאגר הזה אינו יכול לסגור את הפער בשמכם. אם
אתם רוצים שהגבול ייאכף, שימו אותו ב-<span dir="ltr">`.claude/settings.json`</span> שלכם:

</div>

```json
{
  "permissions": {
    "deny": [
      "Bash(mycontext lesson-accept *)",
      "Bash(mycontext review promote *)",
      "Bash(mycontext review discard *)",
      "Bash(mycontext review promote-revision *)",
      "Bash(mycontext review discard-revision *)",
      "Bash(mycontext add *)",
      "Bash(mycontext supersede *)",
      "Bash(mycontext edit *)",
      "Bash(mycontext pin *)",
      "Bash(mycontext unpin *)",
      "Bash(mycontext harden *)",
      "Bash(mycontext soften *)",
      "Bash(mycontext repair *)"
    ]
  }
}
```

<div dir="rtl">

**הכללים האלה אינם כיסוי מלא, ושום דבר כאן אינו יכול להפוך אותם לכאלה.** הם התאמות
קידומת על מחרוזת פקודה.
<span dir="ltr">`node .claude/plugins/…/src/cli/index.ts add …`</span>, הפעלה דרך `npx`,
משתנה shell שמחזיק את הנתיב, או כל איות אחר של אותה תוכנית — כל אלה הם מחרוזת אחרת
ו**אינם** נדחים. אף אחד מהם גם אינו נוגע במסלול ההפניה אל
<span dir="ltr">`.my_context/`</span> שלמעלה. הכללים מייקרים קידום בשוגג; הם אינם הופכים
אותו לבלתי אפשרי.

### לעולם אל תערכו קובץ פריט ביד

**אל תערכו את <span dir="ltr">`always:`</span> (או כל שדה אחר) ב-frontmatter של פריט.** כל
מסלול כתיבה מחשב מחדש את ה-`checksum` של הפריט. עריכה ידנית לא מחשבת אותו, ולכן ה-checksum
הרשום מפסיק להתאים לתוכן, ו-`mycontext doctor` מדווח על אי-ההתאמה ויוצא עם קוד 1, מאותו
רגע והלאה.

`mycontext rebuild` **אינו** מחשב אותו מחדש. אומת בהרצה: ערכו את
<span dir="ltr">`always:`</span> ביד, הריצו `rebuild`, ושורת ה-<span dir="ltr">`checksum:`</span>
זהה ברמת הבתים למה שהייתה. גרוע מכך, אי-ההתאמה הזאת אינה ניתנת להבחנה ממקרה השחיתות
האמיתי היחיד: doctor יכול רק לומר שהתוכן כבר אינו תואם ל-checksum הרשום, ועריכה ידנית
וכשל הלוך-ושוב בזמן כתיבה שאיבד טקסט בשקט מייצרים את אותו ממצא.

`mycontext repair` מחתים מחדש את ה-checksum אחרי עריכה ידנית מכוונת. הוא גורם ל-checksum
הרשום להסכים עם הקובץ, ואינו יכול לשחזר שום דבר שהעריכה הסירה.

## 8. עדיין לא זמין

**זהו הפרק היחיד במסמך הזה שבו מופיעה התנהגות שלא נבנתה.** כל מה שלמעלה מתאר את מה שהקוד
עושה היום. כל יכולת שמתוארת למטה היא יכולת שאין לפרויקט הזה — או שמעולם לא נבנתה, או
שהוצהרה במקום כלשהו ובאופן שניתן לאימות אינה בתוקף — ואף משפט למטה אינו טוען אחרת. היכן
שמופיע משפט בזמן הווה, הוא מתאר מה חסר או שבור היום, לעולם לא מה מתוכנן.

ההפרדה הזאת מכוונת ולא רק מסודרת. כלי שכל הנחת היסוד שלו היא שידע מוזרק הוא אמת אינו
יכול להרשות לעצמו README שמתאר יכולת שאין לו, ולפרויקט הזה יש היסטוריה מתועדת של בדיוק
הפגם הזה, ולכן זה כלל ולא כוונה.

אלה מתוכננים, לא מובטחים. כל ערך נוקב במה שהוא יעשה, למה זה חשוב, ובאיזה **גל** הוא
יסופק. הגלים מגיעים מרצף ההבשלה של הפרויקט לקראת ייצור: גל 1 גבול האמון והחוזים
קריאי-המכונה (הושלם), גל 2 יישוב הטקסט שנשלח מול ההתנהגות שנשלחה, גל 3 עיגון כל מנגנון
אבטחה בבדיקה שמאדימה כשהמנגנון מוסר, גל 4 המכניקה שהמפרט הבטיח, גל 5 איחוד מבני, גל 6
הדרישות המתועדות שעדיין חסרות. ערכים המסומנים *לא מתוזמן* רשומים ועדיין לא שובצו לגל.

### עריכת פריט — סגור עכשיו, חוץ משני שדות

הפרק הזה נהג לומר שאין בכלל מסלול עדכון לאדם: אין פקודת `edit`, אין פקודת `update`, והדרך
היחידה אל ה-`scope`, ה-`always`, ה-`severity` או הסטטוס של פריט ששולט היא עריכה ידנית של
ה-Markdown ואז <span dir="ltr">`mycontext repair --yes`</span> — המסלול
ש[פרק 7](#7-גבול-האמון) מתאר ומזהיר מפניו.

`mycontext edit` סגרה את זה, עם <span dir="ltr">`pin`/`unpin`</span>
ו-<span dir="ltr">`harden`/`soften`</span> כצורות הקרויות שלה, ועם שער שמדורג לפי מה
שהשינוי יכול באמת לעשות ולא אישור אחד להכול ([פרק 5](#5-שימוש)). אותו סבב הפך שכתוב של
סוכן לטקסט של פריט ששולט למדיניות לכל קטגוריה במקום לפרצה בלתי שמורה
([<span dir="ltr">`agentEdits`</span>](#6-תצורה)). שניהם מתוארים למעלה, בזמן הווה, מפני
שהם נשלחו.

**לשני שדות עדיין אין מסלול, והם אינם אותו פער פעמיים.**

- **<span dir="ltr">`extra`</span> אינו ניתן לעריכה בידי אדם בשום משטח.** `mycontext edit`
  אינה מקבלת אותו. ברוב הקטגוריות זה חסר חשיבות, אבל <span dir="ltr">`extra`</span> הוא
  המקום שבו חי ה-`directive` של כלל — ה-<span dir="ltr">`do`/`dont`</span> שקובע אם הכלל
  מצווה או אוסר — וגם ה-`validate_by` של הנחה. כך שכלל שה-directive שלו שגוי אפשר להחליף
  אבל לא לתקן. הכלי `update_item` **כן** יכול לשנות את <span dir="ltr">`extra`</span>,
  והוא חל ישירות גם תחת <span dir="ltr">`agentEdits: "review"`</span>, מפני שרוויזיה
  מוחזקת אינה יכולה לשאת אותו: השדה שאדם אינו יכול להגיע אליו הוא השדה היחיד שעריכת סוכן
  אינה מוחזקת בו. האי-סימטריה הזו היא הפער, נאמרת במפורש ולא מתוארת כעקיפה.
- **<span dir="ltr">`observations`</span> אינן ניתנות לעריכה בידי אף אחד, בשום משטח, מכל
  מקור.** הן נקבעות בלכידה ולעולם לא אחריה; ל-`update_item` אין ארגומנט כזה וגם ל-`edit`
  לא. שום דבר במסמך הזה אינו טוען אחרת.

**מה לא יתווסף: מחיקה.** `NOGOAL-no-agent-hard-delete` הוא פריט פעיל בקורפוס של המאגר הזה
עצמו, שמתעד את זה כלא-מטרה מכוונת. פרישה היא החלפה —
<span dir="ltr">`mycontext supersede <id> --by <id>`</span>, שקיימת — והיא משאירה את
הפריט, גופו והיסטוריה שלו על הדיסק, היכן שסוקר עדיין יכול לקרוא אותם.

**שתי עובדות קטנות יותר על מחסן הרוויזיות, רשומות ולא מתוקנות.** היומן שלו רק מוסיף ולעולם
אינו נגזם, כך שפרויקט שמחזיק ומיישב הרבה רוויזיות צובר קובץ שרק גדל; ול-`mycontext doctor`
אין בדיקה כלשהי ל-<span dir="ltr">`.my_context/.revisions/`</span>, כך ששום דבר אינו מדווח
על גודלו או על רוויזיה שנשארה ממתינה חודשים.

### משטח אחד לכל פעולה (גל 5)

**הדרישה, בלשון המשתמש:** כל מה שהמודל יכול לעשות דרך כלי, אתה אמור להיות מסוגל לעשות
דרך פקודה. היום שני המשטחים אינם מקבילים, והאי-סימטריה רצה לשני הכיוונים.

- <span dir="ltr">`/mycontext:search`</span> קוראת לכלי `query_items` ו**אין לה מקבילה
  בשורת הפקודה**. אין פקודת `search` בשורת הפקודה כלל.
- ל-22 מתוך 26 פקודות שורת הפקודה **אין פקודת סלאש**: <span dir="ltr">`init`, `show`,
  `rebuild`, `help`, `examples`, `doctor`, `decay`, `query`, `repair`,
  `supersede`, `edit`, `pin`, `unpin`, `harden`, `soften`</span>, שלוש פקודות
  ה-<span dir="ltr">`ingest*`</span> וארבע פקודות
  ה-<span dir="ltr">`lesson*`</span>. רק ל-`add`, ל-`list`, ל-`review` ול-`status` יש אחת.
- ל-8 מתוך 11 כלי ה-MCP **אין פקודת סלאש**: <span dir="ltr">`update_item`,
  `supersede_item`, `link_items`, `get_item`, `list_drafts`, `mycontext_help`,
  `mycontext_examples`, `ingest_document`</span>.

**למה זה חשוב.** הפער אינו קוסמטי. משתמש בתוך סשן של Claude Code שרוצה להוציא לגמלאות
פריט ששולט, לקרוא פריט אחד, או לבדוק את בריאות הקורפוס נאלץ לצאת לטרמינל. ההתרחקות של שני
המשטחים זה מזה היא איך שאחד מהם הופך בשקט לאמיתי.

**מה יהיה קיים.** פקודה מיוצרת לכל פעולה, מאותו רישום שכבר מייצר את 34 פקודות
ה-<span dir="ltr">`add-`/`list-`</span> ואת טבלת השימוש של שורת הפקודה. זה יושב בגל 5 מפני
שהגל הזה מאחד את הניתוב הכפול של שורת הפקודה לרישום אחד, וזה מה שנותן למחולל רשימה אחת
לעבוד ממנה. ייצור פקודות מול שתי רשימות מתוחזקות ביד היה משחזר בדיוק את הסטייה שהייצור
קיים כדי למנוע.

### בחירת ערך במקום לזכור אותו (גל 5, ופגם אחד בגל 2)

**הדרישה:** בכל מקום שבו לשדה יש קבוצת ערכים סגורה — קטגוריה, סטטוס, חומרה, רמת פירוט,
סוג יחס — אתה אמור לבחור מהקבוצה במקום להיזכר באיות.

**חלק מזה כבר קיים, בדרך של שמות ולא של פקד.** 17 פקודות
ה-<span dir="ltr">`/mycontext:add-<type>`</span> ו-17 פקודות
ה-<span dir="ltr">`/mycontext:list-<type>`</span> *הן* בורר הקטגוריה: הקבוצה הסגורה
מאויתת בשמות הפקודות, וההשלמה האוטומטית של Claude Code מצמצמת אותן תוך כדי הקלדה. זו
הסיבה שהן מיוצרות לכל קטגוריה במקום לקבל ארגומנט <span dir="ltr">`<type>`</span>.

**ולגבי השאר, בדיוק.** שדה ה-frontmatter `argument-hint` של פקודת סלאש מספק טקסט מציין
מקום בשורת הארגומנטים. זה רמז, לא תפריט, ולתוסף אין דרך לשלוח בורר
עבור <span dir="ltr">`--severity`</span> או <span dir="ltr">`--status`</span>. מה שכן
ישתנה הוא צורת המשטח: אותו ייצור שייתן לכל פעולה פקודה (למעלה) יכול לתת לכל ארגומנט בעל
ערכים סגורים פקודה משלו, כפי ש-<span dir="ltr">`add-<type>`</span> עושה היום.

**פגם אחד שהיה כאן וכעת תוקן**, שנמצא בהרצת
<span dir="ltr">`claude plugin validate .`</span> מול המאגר הזה: 19 מ-38 קובצי הפקודות
נשאו `argument-hint` שאינו YAML תקין, ולכן *כל* ה-frontmatter שלהם — כולל
<span dir="ltr">`disable-model-invocation: true`</span> — הושמט כש-Claude Code טען אותם.
המחולל מצטט אותו עכשיו, הקבצים נוצרו מחדש, והאימות עובר. [פרק 5](#5-שימוש) מספר את הסיפור
במלואו, כולל למה הבדיקה ששמרה על הקבצים האלה מעולם לא ראתה אותו.

### קיבוץ לפי תחום, מיקוד סשן, ויומן ביקורת בזמן ריצה (גל 6)

שלושת אלה שונים מכל השאר בפרק הזה, וההבדל ראוי שייאמר בפירוש ולא ירוכך.

**כל שלושתם רשומים בקורפוס של המאגר הזה עצמו כדרישות עם `severity: hard`
ו-<span dir="ltr">`status: active`</span>, ואף אחד מהם אינו ממומש.** מכיוון שהם פעילים,
בעלי scope ונורמטיביים, התוסף הזה מזריק אותם לכל סשן שנוגע בקבצים שהם נוקבים בהם. כלומר
my_context מזריק כרגע דרישות שהוא עצמו אינו מקיים, כהוראות מחייבות. זו הגרסה הכנה, וזו
הסיבה שהם מנויים כאן ולא הושמטו.

| דרישה רשומה | מה היא תעשה | המצב היום |
|---|---|---|
| `REQ-items-carry-a-domain` | כל פריט יישא תחום מוצהר אחד מעל הקטגוריה שלו — קבוצה סגורה ב-`config.json`, עמודה מאונדקסת אחת, מסננים בפקודות ובדוחות | אין אפשרות <span dir="ltr">`--domain`</span> בשום מקום, אין עמודה, ומפתח `domains` ב-`config.json` נזנח בלי מילה |
| `REQ-session-focus-controls-what-loads` | סשן יוכל להתמקד בתחומים, וההזרקה תצטמצם אליהם, תוך גילוי מה הוסתר במקום להסתיר בשקט | שום דבר אינו מממש את זה, במכוון: `OPENQ-how-do-filters-respect-dependencies` פעילה באותו קורפוס ואומרת לתכנן את זה לפני שמממשים |
| `REQ-changes-are-timestamped-and-audited` | יומן פעולות שרק מתווספים אליו, שנכתב בגבול השינוי, עם חותמות זמן שנשארות מחוץ ל-checksum כדי שמסע ה-Markdown הלוך ושוב יישאר זהה ברמת הבתים | אין שדות <span dir="ltr">`created_at`/`updated_at`</span>, ויומן הסשנים חי בתוך <span dir="ltr">`.index.db`</span>, שהוא מתכלה מעצם התכנון — מחקו את האינדקס והיסטוריית ההזרקות הולכת איתו |

כל אחד משלושת אלה צריך החלטה מוצרית לפני שהוא צריך מממש, ולכן הם יושבים בגל האחרון ולא
בראשון.

### דוחות שנכנסים למסך — סגור עכשיו

<span dir="ltr">`mycontext list --full`</span> הציגה בעבר כל עמודה של כל פריט בשורה אחת: 280
תווים בקורפוס של המאגר הזה עצמו, ששום טרמינל אינו שובר בצורה שימושית.
`mycontext decay` הדפיסה אזהרה קבועה בת 284 תווים בלי שבירת שורות ב*כל* רמת פירוט. שניהם
תוקנו קודם: <span dir="ltr">`--full`</span> היא גוש לכל פריט וכל פסקה נשברת, והכול נפרס
לרוחב 100 תווים ([פרק 5](#5-שימוש) מתאר את הצורות).

טבלת ברירת המחדל ו-<span dir="ltr">`--short`</span> החזיקה מעמד הכי הרבה זמן, ותוארה כאן
כמגבלה אמיתית ולא כעבודה שלא הושלמה. שתי העמודות הרחבות ביותר שלה היו המזהה והכותרת,
המזהים בקורפוס הזה מגיעים ל-64 תווים, ואסור לשבור אף אחת מהשתיים:
<span dir="ltr">`INV-a-validator-that-gates-writes-must-`</span> נקרא כמזהה שלם, כך שקורא היה מעתיק חצי מזהה
ומקבל תשובה שאין פריט כזה עבור שורה שנמצאת על המסך שלו.

המסקנה שנרשמה אז, שרק מזהים קצרים יותר יכולים לתקן את זה, שגתה באבחנה. המזהה **הוא**
הכותרת: `makeId` הופך את האחת ל-slug של השנייה, כך ששתי העמודות היו עובדה אחת שתפסה 156
מתוך 192 התווים של הטבלה. הסרת הכפילות — ולא קיצור המזהה, שהיה הופך את
<span dir="ltr">`RULE-014.md changed`</span> לחסר משמעות בהשוואת גרסאות — הביאה
את `list` ל-97 תווים ואת `decay` ל-97. גם טבלת הפריטים הקרים
ב-<span dir="ltr">`status --full`</span> איבדה את אותה עמודה מאותו נימוק.
הטבלה של <span dir="ltr">`review list`</span> לא איבדה אותה: שאר העמודות שלה הן ערכי מנייה
צרים, ולכן היא נכנסת לפריסה עם הכותרת במקומה ושומרת עליה.

<span dir="ltr">`review list --full`</span> היה הדוח האחרון שנשאר מחוץ להבטחה הזאת, ומחוץ
למבחן שאוכף אותה. כטבלה של שמונה עמודות הוא נמדד ב-210 תווים על טיוטה שהמזהה שלה ארוך
כפי ש-`slugify` מייצר — אותה אריתמטיקה של <span dir="ltr">`list --full`</span>, בפקודה
היחידה שהמעבר הקודם לא מדד. עכשיו הוא גוש לכל טיוטה, כמו כל <span dir="ltr">`--full`</span>
אחר, מה שמעמיד אותו על 81 תווים על אותה טיוטה; מבחן התקציב עובר גם עליו. מה שצורת הגושים
אינה מתקנת הן רמות הסריקה: על מזהה בן 67 תווים הטבלה ההיא נמדדת ב-112 תווים גם אם מוחקים
מתוכה את עמודת הכותרת לגמרי — זו מגבלה על אורך המזהה ולא על מערך העמודות, והסרת הכותרת לא
הייתה מצילה אותה.

שום דבר לא נקטע ולא שונה שמו בדרך לשם, ואף מזהה לא השתנה. מה שנשאר הוא התכונה הכללית ולא
פער: קורפוס שבו המזהים לבדם רחבים מהתקציב עדיין מקבל טבלה ברוחבה הטבעי, משום ששבירת מזהה
גרועה מחריגה.

### פערים קטנים יותר, כל אחד כבר רשום

שלושת אלה שהיו רשומים כאן סגורים עכשיו, וכולם היו אותה תקלה — משהו נמסר, התקבל, נזרק,
והדווח על הצלחה.

- **`mycontext add` לא יכלה לקבוע `severity`.** רק `review promote` והכלי `create_item`
  יכלו, כך שאדם שלכד אילוץ `hard` מהטרמינל לא יכול היה לומר שהוא קשה ברגע הלכידה. `add`
  מקבלת עכשיו <span dir="ltr">`--severity hard|soft`</span>, נבדקת מול אותה רשימה ומסורבת
  באותו משפט כמו `create_item` ו-`update_item`. עריכת החומרה של פריט שכבר קיים היא
  <span dir="ltr">`mycontext edit <id> --severity hard|soft`</span>, או
  <span dir="ltr">`mycontext harden`/`soften`</span>, שקיימות עכשיו.
- **`create_item` קיבל ארגומנט `relations` והשליך אותו.** הוא מסורב עכשיו, ולא ממומש.
  `createItem` בודק את היעד של יחס אך לא את הסוג שלו, ואוצר המילים הסגור של היחסים —
  כולל הסירוב לשני יחסי כיוון-ההוצאה-לגמלאות — נאכף רק בתוך `link_items`, כך שהעברת
  `relations` בזמן יצירה הייתה עוקפת את שני השערים בבת אחת. הסירוב מונה את `link_items`
  ואת `supersede_item`. אותו תיקון סגר גם את המקרה הכללי: שום כלי לא הצהיר על רשימת
  ארגומנטים סגורה, ולכן כל ארגומנט לא מוכר בכל כלי התקבל ונזרק.
- **דגל בעל ערך שניתן פעמיים שמר רק את המופע הראשון.**
  <span dir="ltr">`mycontext add rule "…" --scope "src/api/**" --scope "src/db/**"`</span>
  יצרה פריט שה-scope שלו הוא ה-glob הראשון בלבד, ודיווחה על הצלחה. זה נמצא כשהיא תחמה לא
  נכון פריט אמיתי בקורפוס של המאגר הזה עצמו. דגלים בעלי ערכי רשימה אוספים עכשיו כל מופע,
  ודגלים בעלי ערך יחיד מסרבים לחזרה במקום לבחור.

### יצירת שכבה גלובלית וכתיבה אליה (לא מתוזמן)

[השכבה הגלובלית](#השכבה-הגלובלית--ידע-שנוסע-איתך-בין-פרויקטים) נקראת בכל פקודה ובכל
הזרקה, ואין פקודה שיוצרת אחת או כותבת אליה. <span dir="ltr">`mycontext init`</span> יוצרת
<span dir="ltr">`.my_context`</span> בתיקייה שהיא רצה בה, ולכן
<span dir="ltr">`cd ~ && mycontext init`</span> מייצרת
<span dir="ltr">`~/.my_context`</span> — תיקייה שאיש אינו קורא, שכן השורש הגלובלי הוא
<span dir="ltr">`~/.my-context`</span>, עם מקף. כל נתיב כתיבה מסרב לפריט שאינו של
הפרויקט, ו-<span dir="ltr">`mycontext repair`</span> נוקבת בשם הפריטים הגלובליים שסירבה
להחתים מחדש ואומרת להריץ אותה "מסביבת העבודה של השכבה הגלובלית עצמה" — סביבת עבודה שאף
פקודה אינה מייצרת.

המסלול שעובד היום נמצא ב[אותו פרק](#איך-יוצרים-אחת-היום): לבנות את הקורפוס כסביבת עבודה
רגילה ולשנות את שם התיקייה אל מקומה. זהו מסלול אמיתי, וכל פריט שהוא מייצר נכתב בידי הקוד
שכותב כל פריט — אבל שינוי שם אינו משטח נתמך, ויכולת כה מרכזית לא אמורה להזדקק לו.
<span dir="ltr">`mycontext init --global`</span>, ודרך לכוון לכידה או עריכה אל השכבה
הגלובלית, היו סוגרים את זה. אף אחד מהם אינו קיים, ואף אחד מהם לא שובץ לגל.

### לינוקס, ושחרור שטרם נחתך (לא מתוזמן)

- **לינוקס מכוסה על ידי CI ואינה מוסמכת בהרצה שהפרויקט הזה ראה.**
  <span dir="ltr">`.github/workflows/ci.yml`</span> מריץ את חבילת הבדיקות ואת חבילת
  הביצועים על `ubuntu-latest` וגם על `windows-latest`. שום תוצאה של הרצת לינוקס אמיתית לא
  אומתה כאן, ו-Windows היא פלטפורמת היעד הראשונה — נסיגת ה-ASCII בטבלאות קיימת מפני
  ש-`cmd.exe` ישן הוא משתמש אמיתי. הסמכה פירושה להריץ ולומר מה קרה, לא לטעון שהמטריצה
  מרמזת על כך.
- **עדיין לא שוחררה ולא תויגה שום גרסה.** שיטת הגרסאות הוכרעה ונכתבה
  ([`VERSIONING.md`](../VERSIONING.md)), ההיסטוריה שוחזרה
  ([`CHANGELOG.md`](../CHANGELOG.md)), `mycontext status` מדווח על הגרסה, ובדיקה אחת
  נכשלת אם ארבעת המקומות שמצהירים עליה נפרדים זה מזה. מה שעדיין *לא* קרה הוא השחרור עצמו:
  אין תגיות git, ולכן כל מה שנעשה עד כה יושב תחת <span dir="ltr">`[Unreleased]`</span>,
  וה-`0.1.0` שהמניפסטים
  נושאים הוא הגרסה שמוכנה לשחרור, לא כזו שפורסמה. עד שתהיה תגית, ה-hash של הקומיט הוא
  עדיין התשובה המדויקת לשאלה "איזו בנייה זו".

### איך לדעת אם משהו כאן כבר נשלח

אל תסמכו על הפרק הזה שעודכן. הריצו `mycontext help` לרשימת הפקודות האמיתית,
<span dir="ltr">`claude plugin details mycontext@mycontext`</span> למצאי הרכיבים האמיתי,
ו-`mycontext help categories` לקטגוריות שמופעלות בפועל.

שתי בדיקות שומרות [על פרקים 1–7](#תוכן-העניינים) של המסמך האנגלי כנים. הראשונה: כל פקודת
שורת פקודה, פקודת סלאש וכלי MCP חייבים להיות נקובים ב-`README.md`, ושום דבר שאינו קיים
אינו יכול להיות נקוב שם. השנייה: כל דוגמה מורצת מחדש מול fixture ששמור ב-git ומושווית למה
שהפקודה מדפיסה. בדיקת הדוגמאות חלה גם על הקובץ הזה, שכן `npm run gen:docs` ממלא את שני
המסמכים מאותו fixture; בדיקת המצאי קוראת את המסמך האנגלי בלבד. **שום בדיקה אינה בודקת את
הפרק הזה**, מפני ששום בדיקה אינה יכולה לדעת מה הייתה הכוונה. זה החלק במסמך הזה שכדאי לפקפק
בו ראשון.

הראשונה מבין שתי הבדיקות האלה קוראת את הקובץ האנגלי כולו, ולכן פקודה שנקובה
ב[טבלת הדגלים](#כל-הדגלים-במקום-אחד) או ב[מילון המונחים](#9-מילון-מונחים) נבדקת שהיא
קיימת כמו כל פקודה אחרת. מה ששום בדיקה אינה בודקת בשום מקום הוא אם *דגל* מתנהג כפי שהשורה
שלו אומרת. כל שורה נכתבה מתוך הרצה של הדגל וקריאה של מה שחזר, וזו חובה אנושית בכל פעם
שאחד מהם משתנה.

## 9. מילון מונחים

כל מילה שהמסמך הזה נותן לה משמעות מסוימת, ברשימה אחת לפי סדר האלף-בית האנגלי, כדי
שנחיתה באמצע פרק לעולם לא תחייב לקרוא את הפרקים שמעליו. כל ערך הוא מה שהמילה אומרת
*כאן* — כמה מהן הן אנגלית רגילה במקומות אחרים.

| מונח | מה זה אומר ב-my_context |
|---|---|
| **active** (פעיל) | הסטטוס היחיד שכשיר להזרקה. פריט הוא פעיל מפני שאדם עשה אותו כזה: בלכידה עם `mycontext add` ואישור מפורש, או בקידום טיוטה |
| **agent** (סוכן) | הערך של `origin` בכל מה ש-Claude כתב דרך כלי MCP. אף כלי אינו מקבל `origin` כארגומנט, ולכן סוכן אינו יכול לטעון שהיה אדם |
| **always** | שדה ה-frontmatter שנועץ פריט. <span dir="ltr">`always: true`</span> פירושו הזרקה במלואו בתחילת כל סשן, בלי קשר לקבצים שאתה נוגע בהם |
| **anchor** (עוגן) | הכותרת שמעליה יושב מקטע של מסמך שנקלט, באותיות קטנות ועם מקפים: <span dir="ltr">`## Rate limits`</span> הופך ל-`rate-limits`. שני צידי שיחת הקליטה משתמשים בו כדי לנקוב באותו מקטע |
| **budget** (תקציב) | מגבלת הגודל של דרג הזרקה אחד, בטוקנים משוערים. ארבעה כאלה, אחד לכל דרג, כולם ניתנים לתצורה. מה שלא נכנס עובר spill |
| **candidate** (מועמד) | פריט מוצע שעדיין אינו קיים על הדיסק — ה-JSON שחוזר מקליטה או מגזירת כללים מלקח. ההחלה או הקבלה היא מה שיוצר את הפריט |
| **checksum** | hash של תוכן הפריט עצמו, מוחתם מחדש בכל כתיבה. `mycontext doctor` משווה אותו לקובץ כדי להבחין בעריכה ידנית |
| **compaction** (כיווץ) | Claude Code שמסכם סשן ארוך וממשיך מהסיכום. בדרך כלל נזרק בו מה שהוזרק קודם, ובגלל זה קיים הדרג המשוחזר |
| **corpus** (קורפוס) | כל הפריטים של הפרויקט: כל מה שתחת <span dir="ltr">`.my_context/items/`</span>, בכל דרג ובכל סטטוס |
| **deprecated** (מיושן) | פורש בלי שנקבו במחליף. זה מה ש-<span dir="ltr">`mycontext review discard`</span> קובעת על טיוטה. לא מוזרק, והקובץ נשאר במקומו |
| **draft** (טיוטה) | נלכד אך טרם אושר. לא מוזרק באף דרג, נספר בתור הסקירה, ממתין שאדם יקדם או ידחה. כל פריט נורמטיבי ש-Claude לוכד מתחיל כאן |
| **frontmatter** | הגוש שבין שורות ה-<span dir="ltr">`---`</span> בראש קובץ פריט: השדות שקובעים מתי הפריט חוזר ועד כמה לסמוך עליו. הפרוזה שמתחתיו היא הגוף |
| **governing** (שולט) | היות כשיר להזרקה *וגם* מנוסח כהוראה. פריטים נורמטיביים שולטים; פריטי נימוקים לעולם לא |
| **index** (אינדקס) | דרג ההזרקה הזול ביותר: שורה אחת — מזהה, סוג, כותרת — לכל פריט נורמטיבי שלא סופק במלואו, ועוד ספירות לכל השאר. זה גם השם של <span dir="ltr">`.index.db`</span>, מטמון ה-SQLite הניתן להשלכה; ההקשר מבחין ביניהם |
| **ingest** (קליטה) | הפיכת מסמך קיים לפריטי טיוטה, מקטע אחר מקטע. my_context מספק את הטקסט ומאמת את מה שחוזר; אין לו מודל משלו והוא לעולם אינו קורא לאחד |
| **injection** (הזרקה) | my_context ששם טקסט בהקשר של סשן מעצמו, בלי שאף אחד ביקש. כל המנגנון שבשבילו הפרויקט הזה קיים |
| **item** (פריט) | פיסת ידע אחת שנלכדה: קובץ Markdown אחד, מזהה אחד, קטגוריה אחת, סטטוס אחד |
| **JIT** / **just in time** (בדיוק בזמן) | דרג ההזרקה שנורה כש-Claude עומד לקרוא או לערוך קובץ שהפריט חל עליו — כזה שתואם ל-scope שלו, או כל קובץ אם לא הוגדר לו scope. נכתב `jit` בתצורת התקציבים |
| **layer** (שכבה) | היכן חי קובץ הפריט. <span dir="ltr">`.my_context/`</span> בפרויקט שאתה עובד עליו היא שכבת ה*פרויקט*; תיקיית <span dir="ltr">`.my-context`</span> בתיקיית הבית, כשקיימת כזאת, נקראת לצידה כשכבה *גלובלית*. פריטי הפרויקט מנצחים בתיקו ומסתירים פריט גלובלי עם אותו מזהה — [השכבה הגלובלית](#השכבה-הגלובלית--ידע-שנוסע-איתך-בין-פרויקטים) |
| **MCP** | Model Context Protocol — הממשק שדרכו Claude מגיע לכלים. my_context מגיש אחד-עשר מהם מעל stdio, והם המשטח היחיד של המודל אם אין לו shell |
| **normative** (נורמטיבי) | הדרג של מה שחייב להתקיים: אילוצים, אינווריאנטות, כללים, דרישות, תקנים והשאר. טקסט נורמטיבי מוזרק, בלי שביקשו, מנוסח כהוראה — ולכן אדם מאשר אותו קודם |
| **origin** (מקור) | מי כתב פריט: <span dir="ltr">`human`, `agent`, `ingest`</span>. על השדה הזה בנוי גבול האמון |
| **pending revision** (רוויזיה ממתינה) | שינוי לכותרת, לגוף או לתגיות של פריט שסוכן הציע ו**לא** יושם. הפריט ממשיך לשלוט בטקסט הנוכחי שלו; ההצעה ממתינה ביומן שרק מוסיפים לו, ל-<span dir="ltr">`mycontext review promote-revision`</span> או <span dir="ltr">`discard-revision`</span>. נוצרת ממדיניות <span dir="ltr">`agentEdits: "review"`</span>, לעולם לא מעריכה של אדם, ולעולם אינה מוזרקת |
| **pinned** (נעוץ) | דרג ההזרקה של פריטים שמסומנים <span dir="ltr">`always: true`</span>: מסופקים במלואם בתחילת כל סשן. <span dir="ltr">`mycontext review promote <id> --always`</span> מכניסה לשם טיוטה; <span dir="ltr">`mycontext pin <id>`</span> מכניסה לשם פריט ששולט |
| **rationale** (נימוקים) | הדרג של הסיבה שהפרויקט הוא כפי שהוא: החלטות, מסמכי ADR, לקחים, פשרות, הנחות, מקרי קצה, סיכונים. מאונדקס, ניתן לחיפוש, נשלף לבקשה — לעולם לא מוזרק בלי שביקשו |
| **restored** (משוחזר) | דרג ההזרקה שנורה אחרי כיווץ ומספק מחדש את מה שהיה בהקשר לפניו |
| **scope glob** (glob של scope) | תבנית של נתיב קובץ על פריט, שנבדקת מול הקובץ ש-Claude עומד לגעת בו — <span dir="ltr">`src/billing/**`</span>. <span dir="ltr">`*`</span> נשאר בתוך רמת תיקייה אחת, <span dir="ltr">`**`</span> חוצה כמה שצריך. scope מגביל, ולכן בלי scope הפריט חל על כל קובץ |
| **severity** (חומרה) | `hard` או `soft`. זה משנה את סדר הקבלה לתקציב, ותו לא: קשיח קודם |
| **slash command** (פקודת סלאש) | משהו שאתה מקליד בתוך סשן Claude Code, באיות <span dir="ltr">`/mycontext:<name>`</span>. שונה מפקודת שורת פקודה, שהיא <span dir="ltr">`mycontext <name>`</span> בטרמינל |
| **spill** | מה שקורה לפריט שאינו נכנס לתקציב הדרג שלו: הוא מדולג, ונקוב בהערה מתחת להזרקה כדי שלעולם לא ייזרק בשקט. פריט קטן יותר אחריו עדיין יכול להתקבל |
| **stale** (ישנה) | נאמר על רוויזיה ממתינה שאדם שינה את טקסט הבסיס שלה מאז שהוחזקה, בדיוק בשדה שהיא משכתבת. קידום שלה נדחה; <span dir="ltr">`--force`</span> מקדם אותה בכל זאת והורס את הטקסט החדש יותר, אחרי שהוא מראה לכם מה הוא הורס |
| **superseded** (הוחלף) | פורש לטובת מחליף שננקב בשמו, על ידי `mycontext supersede`. לא מוזרק; שני הפריטים רושמים את היחס, ושני הקבצים נשארים |
| **tier** (דרג) | שני דברים שונים, תלוי במשפט. הדרג של *קטגוריה* הוא `normative` או `rationale` ([פרק 2](#2-הרעיון)). דרג *הזרקה* הוא אחד מארבעת מסלולי האספקה — נעוץ, בדיוק בזמן, משוחזר, אינדקס ([פרק 4](#4-מתי-זה-חוזר-ומה)) |
| **validated** (מאומת) | סטטוס שמתעד שאדם אישר פריט. הוא אינו מוזרק — רק `active` מוזרק — והוא נספר עם הפורשים באינדקס הסשן, אבל סוכן אינו יכול להחליף אותו. <span dir="ltr">`mycontext edit <id> --status validated`</span> קובעת אותו, מאחורי שער האישור; גם הכלי `update_item` יכול, בכפוף לסירובים שלו |
| **watched docs** (מסמכים במעקב) | ה-globs שעריכה שלהם מייצרת שורת תזכורת אחת ללכוד את מה שהעריכה החליטה. מוגדרים תחת `watchedDocs`; הרשימה שאתה נותן מחליפה את ברירות המחדל |

---

הרישיון: MIT — הנוסח המלא נמצא ב-[`LICENSE`](../LICENSE). כל הזכויות שמורות © 2026 Dudi Bar-On.

שיטת הגרסאות: [`VERSIONING.md`](../VERSIONING.md). השינויים: [`CHANGELOG.md`](../CHANGELOG.md).

התכנון: `docs/superpowers/specs/2026-08-12-my-context-design.md`

</div>
