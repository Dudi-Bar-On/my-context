<!-- Chapter 11 of 13 — my_context capabilities documentation — Hebrew mirror.

  Hebrew mirror of `docs/capabilities/11-self-improvement-loop.md`. The English
  file is the source. Conventions: `docs/README.he.md` and
  `docs/the-store.he.md` — Hebrew prose and tables inside `<div dir="rtl">`,
  fenced blocks outside it, `<span dir="ltr">` around any Latin run whose edge
  characters are not both alphanumeric, around any run of two or more Latin
  terms joined by commas or slashes, AND — per
  `KNOWN-the-hebrew-convention-says-an-identifier-with-alphanumeric`, found by
  rendering on 2026-09-17 — around any code span that BEGINS WITH A DIGIT and
  contains a hyphen, because the hyphen after a leading digit run takes the
  paragraph direction and carries the prefix to the far end.

  Every pasted block — the `contribution`, `decay` and `review list` output,
  `DEFAULT_REVIEW`, this repository's `review` config block, the replay table,
  `AUTHORABLE`/`MODEL_AUTHORABLE`, `def-the-ration` and `WHY_NO_RULE` — is
  byte-identical to the English file.

  Heading sequence must stay identical to the English file.
-->

# 11. הלולאה המשפרת את עצמה

<div dir="rtl">

## מה זה, במשפט אחד

מעבר רקע — שמופעל מה-hooks <span dir="ltr">`Stop`</span> ו-<span dir="ltr">`PreCompact`</span> —
קורא את התמליל של סשן, מסווג את מה שהוא מוצא מול מחוון קבוע, ו*יכול* לנסח הצעות לסקירה של אדם.
הוא נשלח מחווט מקצה לקצה, והוא נשלח **כבוי**: תצורת ברירת המחדל של הלולאה עצמה מבטיחה שהיא אינה
כותבת דבר לשום סביבת עבודה אלא אם אדם מסובב במכוון חוגות נפרדות —
<span dir="ltr">`enabled`</span>, <span dir="ltr">`maxProposalsPerPass`</span>, ו(מאז
2026-09-13) <span dir="ltr">`model`</span>, כל אחת נשלחת בערך שאינו עושה דבר.

זה אינו "מתוכנן" או "בקרוב". כל מודול שמתואר למטה קיים, מיובא, מופעל על ידי
<span dir="ltr">`test/review/*`</span>, ורץ היום במסלול ה-hook של המאגר הזה ממש — הוא רץ, מכריע
שאין מה לעשות (או שהוא בכלל לא דלוק), וחוזר. ההנדסה גמורה; ההרשאה ניתנת חוגה אחת בכל פעם,
ו**המאגר הזה הדליק עכשיו את כל השלוש** — אומת ישירות מול
<span dir="ltr">`.my_context/config.json`</span> ב-2026-09-16:
<span dir="ltr">`enabled: true`</span>, <span dir="ltr">`maxProposalsPerPass: 5`</span>,
<span dir="ltr">`model: "claude-opus-5"`</span>. (גרסה מוקדמת יותר של הפרק הזה אמרה שרק שתיים
מהשלוש דלוקות ושה-<span dir="ltr">`model`</span> לא הוגדר; זה הפסיק להיות נכון בשלב כלשהו אחרי
2026-09-13 והפרק הזה לא נקרא מחדש מול התצורה החיה מאז. כל מקום למטה שמתאר את
<span dir="ltr">`model`</span> כלא מוגדר ב*סביבת העבודה הזו* מתוקן במקומו, מסומן ולא מתוקן
בשקט, כי ערך תצורה שנושא כל כך הרבה משקל ראוי לסימון.) התקנה טרייה עדיין סוגרת את כל השלוש —
ההבחנה בין מה שהמוצר שולח לבין מה שהמאגר הזה מגדיר היא זו שכל הסעיף הזה קיים כדי לשמור נפרדת.

**שורש המקור:** <span dir="ltr">`src/review/`</span> מחזיק **שישה־עשר** מודולי
<span dir="ltr">`.ts`</span> היום (<span dir="ltr">`ls src/review/*.ts | wc -l`</span>,
2026-09-17). הוא החזיק **שלושה־עשר** ב-commit <span dir="ltr">`870e57c5`</span> (2026-09-13),
ושלושה־עשר אלה הם מה שהפרק הזה הולך עליהם —
<span dir="ltr">`trigger.ts`</span>, <span dir="ltr">`pass.ts`</span>,
<span dir="ltr">`input.ts`</span>, <span dir="ltr">`rubric.ts`</span>,
<span dir="ltr">`propose.ts`</span>, <span dir="ltr">`dedupe.ts`</span>,
<span dir="ltr">`claim.ts`</span>, <span dir="ltr">`decline.ts`</span>,
<span dir="ltr">`declined.ts`</span>, <span dir="ltr">`prompt.ts`</span>,
**<span dir="ltr">`pending.ts`</span>**, **<span dir="ltr">`drift.ts`</span>** ו-
**<span dir="ltr">`model.ts`</span>**. **נקיבה בספירה ההיא כ"ב-HEAD" כבר הייתה שגויה עד שגרסה
מוקדמת יותר של המשפט הזה תוקנה פעם אחת** — hash של commit הוא נקודה קבועה ו"HEAD" אינו כזו,
ושלושה מודולים נוספים נחתו מאז: <span dir="ltr">`backfill-recommendations.ts`</span>,
<span dir="ltr">`promote.ts`</span> ו-<span dir="ltr">`recommend.ts`</span>, ל**שישה־עשר** ב-HEAD
הנוכחי בפועל כשהתיקון הזה נכתב (הריצו מחדש <span dir="ltr">`ls src/review/*.ts`</span> לספירה
האמיתית בכל רגע מאוחר יותר; אל תסמכו גם על "שישה־עשר", מעבר למשפט הזה).
<span dir="ltr">`pending.ts`</span>, <span dir="ltr">`drift.ts`</span> ו-
<span dir="ltr">`model.ts`</span> נעדרו מטיוטה עוד יותר מוקדמת של הרשימה הזו;
<span dir="ltr">`drift.ts`</span> הוא **מתג כיבוי שלישי** שסעיף "מה בנוי אך כבוי" של הפרק הזה
חייב לתת עליו דין וחשבון, ו-<span dir="ltr">`model.ts`</span> — נחת 2026-09-13 — הופך את הקביעה
החוזרת ביותר בפרק הזה (ראו "הגעה למודל").

התצורה חיה ב-<span dir="ltr">`src/core/config.ts`</span> (<span dir="ltr">`ReviewConfig`</span>,
<span dir="ltr">`DEFAULT_REVIEW`</span>). מסמך העיצוב שהקוד מצטט שוב ושוב לפי מספר סעיף הוא
<span dir="ltr">`docs/superpowers/specs/2026-09-08-self-improvement-loop-design.md`</span>.

*(הפרק הזה מתאר את <span dir="ltr">`src/review/`</span> **כפי שנעשה לו commit ב-HEAD**, שזז שלוש
פעמים במהלך הגרסה הזו — <span dir="ltr">`0d683f2b`</span>, <span dir="ltr">`5388f018`</span>,
<span dir="ltr">`870e57c5`</span>, כולם ב-2026-09-13. היכן שקביעה כאן חדשה משאר הפרק, היא אומרת
זאת ונוקבת ב-commit.)*

## למה זה קיים

הקורפוס (פרק [פריטים והקורפוס](./01-items-and-corpus.he.md)) נכתב על ידי אנשים. תת-המערכת הזו
שואלת שאלה צרה יותר: האם ה*תהליך עצמו* — קריאות הכלים והתורים האמיתיים של סשן אמיתי — יכול
להבחין בדפוסים ששווה להפוך לפריט שולט, בדרך שסוקר אנושי שמעלעל בתמליל היה עושה? ואם כן, האם הוא
יכול לנסח את התצפית ההיא בלי אי פעם לכתוב בשקט לקורפוס, בדיוק כפי ש[יצירה והשערים](./03-creation-and-gates.he.md)
לעולם אינם מאפשרים ל-<span dir="ltr">`add`</span> או ל-<span dir="ltr">`edit`</span> לעקוף
סקירה?

הסיבה המוצהרת של העיצוב לבנות את זה בכלל, ולשמור על זה בדיוק כמה שזה שמור, היא תקדים ממעלה
הזרם: מתג ההרג של פרויקט לא קשור (מצוטט בקוד כ"issue #82708 של מעלה הזרם") היה כבוי על הנייר
בעוד שמסלול קוד שני המשיך ליצור פריטים בכל זאת, כי מצב ה"כבוי" היה אחד מכמה מתגים ולא אחד.
ההערה של <span dir="ltr">`DEFAULT_REVIEW`</span> ב-<span dir="ltr">`src/core/config.ts`</span>
נוקבת בזה ישירות וקובעת את הכלל שהיא שאבה ממנו: **מתג אחד, לתת-מערכת אחת**
(<span dir="ltr">`ReviewConfig.enabled`</span>) — לעולם לא משפחה של חוגות שכל אחת מהן, אם נשארה
דלוקה, מסכלת את האחרות.

## מכשור: מה באמת נמדד

שני אותות בלתי תלויים מזינים את הפרק הזה, וכדאי להיות מדויקים שהם *אינם* אותה תת-מערכת, אף
שקורא שמגיע מ"הלולאה המשפרת את עצמה" עשוי לצפות שהם דבר אחד:

### 1. תרומה — ספירות מסירה שנקראות מיומן הביקורת

<span dir="ltr">`node src/cli/index.ts contribution --short`</span>, שהורץ מול הקורפוס החי של
המאגר הזה ב-**2026-09-12**, הדפיס (כל ספירה עולה בכל ירי hook, ולכן זו קריאה ולא קבוע):

</div>

```
my_context contribution — how often each item was actually delivered into a session, read backwards
out of the audit log. The log holds 2841 injection record(s) of 44858 total, naming 183 distinct
id(s); the corpus holds 1108 item(s), of which 158 could be chosen by `select` today.

A record is one DELIVERY, not one session: 1384 jit, 1376 subagent-start, 54 session-start, 25
compact-restore, 2 manual. So a high count is mostly a count of subagent dispatches and hook fires,
and reading any figure below as a number of sessions would overstate it by more than an order of
magnitude.
```

<div dir="rtl">

זהו <span dir="ltr">`src/core/contribution.ts`</span> שקורא את היומן של
<span dir="ltr">`src/core/audit.ts`</span> לאחור: בכל פעם ש[הזרקה](./02-injection.he.md) באמת
מסרה פריט, זו שורה אחת. זו מדידה של *שימוש*, לעולם לא של *נכונות* — הכלי מפורש שקריאה,
<span dir="ltr">`show`</span>, או <span dir="ltr">`get_item`</span> ב-MCP אינם משאירים עקבה כאן,
ולכן פריט "קר" עשוי פשוט להיות כזה שאף אחד לא נזקק למשוך מחדש.

### 2. דעיכה — פריטים שהשתתקו

<span dir="ltr">`node src/cli/index.ts decay --full`</span> מדווח על פריטים שלא הוזרקו אוטומטית
על פני חלון של סשנים אחרונים. על הקורפוס הזה, **2026-09-12**:

</div>

```
my_context decay — items not injected in the last 20 session(s). The ledger holds 26 session(s).
...
cold (1) — not auto-injected in the window; check before acting:
  RULE-never-weaken-byte-identity
    type           rule
    injections     0
    last injected  never
    scope          test/core/rebuild.test.ts test/core/item.test.ts
    title          Never weaken a byte-identity or round-trip assertion to make it pass

unrestricted (124) — active and normative with no scope, so they apply to every file and compete for
the jit budget on every file operation.
```

<div dir="rtl">

גם <span dir="ltr">`contribution`</span> וגם <span dir="ltr">`decay`</span> הן **פקודות דיווח
לקריאה בלבד** שאדם מריץ ביד. אף אחת מהן, בפני עצמה, אינה כותבת הצעה — הן חומר הגלם ש-
<span dir="ltr">`src/core/retire.ts`</span> (למטה) נשען עליו כשהוא *טוען* האם כלל גניזה יכול
להתקיים.

## הטריגר: מתי המעבר בכלל מסתכל

<span dir="ltr">`src/review/trigger.ts::reviewTrigger`</span> נקרא מ-
<span dir="ltr">`Stop`</span> ומ-<span dir="ltr">`PreCompact`</span> ומכריע, בפונקציה סינכרונית
אחת ש**לעולם אינה זורקת** (<span dir="ltr">`INV-hooks-fail-open`</span>, מכובד במפורש ב-
<span dir="ltr">`catch`</span> שמחזיר <span dir="ltr">`null`</span>), האם לשגר תהליך ילד מנותק
שעושה את הקריאה בפועל. השערים רצים בסדר הזה, הזול ראשון:

1. **לא בתוך נתיב.** אם <span dir="ltr">`agent_id`</span> מוגדר, זהו תת-סוכן, לא סשן — סרבו מיד
   כדי שעשרה נתיבים שמסיימים בבת אחת לא יהפכו לעשרה מעברים על תמליל הורה אחד.
2. **סביבת עבודה, ותצורה שמתפענחת.**
3. **<span dir="ltr">`review.enabled`</span>** — המתג האחד. <span dir="ltr">`false`</span> מחזיר
   <span dir="ltr">`null`</span>: אין פסק, אין שורת ביקורת, אין קובץ מצב, אין ילד. זהו המתג
   שהאירוע במעלה הזרם עסק בו, והערת הקוד אומרת זאת.
4. **המנה על ה*הסתכלות*, <span dir="ltr">`maxFiresPerSession`</span>.** ברגע שסשן ירה את התקרה
   שלו של מעברים, הטריגר מסרב ואומר זאת
   (<span dir="ltr">`"the session's ration of N pass(es) is spent"`</span>).
5. **המרווח, <span dir="ltr">`everyNToolCalls`</span>** — מוותרים עליו רק ב-
   <span dir="ltr">`PreCompact`</span> עם <span dir="ltr">`onPreCompact: true`</span>, כי ההקשר
   עומד לאבוד.
6. **משהו חדש לקרוא** — <span dir="ltr">`stat`</span> אחד מול היסט הבתים שהמעבר האחרון עצר בו.

שלושה ערכי תצורה שומרים על *האם המעבר רץ, מציע, או מגיע למודל*, וכל השלושה נשלחים בערך שאינו
עושה דבר. <span dir="ltr">`DEFAULT_REVIEW`</span> ב-<span dir="ltr">`src/core/config.ts`</span>:

</div>

```ts
export const DEFAULT_REVIEW: ReviewConfig = {
  enabled: false,
  everyNToolCalls: 15,
  onPreCompact: true,
  maxFiresPerSession: 3,
  readWholeTranscript: true,
  includeSubagents: true,
  maxProposalsPerPass: 0,
  queueCeiling: 15,
  model: null,          // added 870e57c5 — see "Reaching a model"
};
```

<div dir="rtl">

<span dir="ltr">`enabled: false`</span> הוא מתג הכיבוי הראשון והבוטה יותר — כשהוא לא מוגדר,
הטריגר מחזיר <span dir="ltr">`null`</span> לפני שהוא קורא בית אחד של תמליל, ושום ילד לעולם לא
משוגר. אלה **ברירות המחדל הנשלחות**, והן מה שהתקנה טרייה מקבלת.

**המאגר הזה כבר אינו רץ עליהן, וכל שלושת השערים פתוחים כאן.** בלוק ה-
<span dir="ltr">`review`</span> של <span dir="ltr">`.my_context/config.json`</span>, שנקרא
2026-09-17 ומצוטט בשלמותו:

</div>

```json
  "review": {
    "enabled": true,
    "maxProposalsPerPass": 5,
    "model": "claude-opus-5"
  }
```

<div dir="rtl">

שורת ה-<span dir="ltr">`"model"`</span> נהגה לחסור מההדבקה הזו, והיא החוגה השלישית — זו שהפתיחה
של הפרק הזה עצמו אומרת שהפכה *"שתיים משלוש"* ל*"כל השלוש"*. הדבקה שמשמיטה אותה היא ראיה לקריאה
שהפרק בדיוק גנז, וזה גרוע יותר מאין הדבקה.

שני commits, שש־עשרה דקות זה מזה ב-2026-09-13: <span dir="ltr">`0d683f2b`</span> (20:17,
*"the self-improvement loop is on — and the ration stays at 0, which is what the code argues for"*)
פתח שער אחד, ו-<span dir="ltr">`5388f018`</span> (20:33, *"the ration goes to the number the
design printed, and the loop is proved end to end"*) העלה את שער שתיים ל-**5** — הנתון שסעיף 11
של מסמך העיצוב הדפיס כל הזמן, ש-<span dir="ltr">`DEFAULT_REVIEW`</span> שולח במכוון כ-
<span dir="ltr">`0`</span>.

<span dir="ltr">`review list`</span> עדיין עונה
<span dir="ltr">`my_context: no drafts pending review`</span> בסביבת העבודה הזו (הורץ
2026-09-13, אחרי שני ה-commits) — מנה פתוחה היא הרשאה להציע, לא הצעה.

**הטיעון שהפרק הזה בנוי עליו לא השתנה, וכדאי להיות מדויקים לגבי מה זז ומה לא.** שתי חוגות בלתי
תלויות, לא אחת, עדיין העיצוב — הקביעה ההיא עוסקת ב-<span dir="ltr">`DEFAULT_REVIEW`</span>,
ו-<span dir="ltr">`DEFAULT_REVIEW`</span> עדיין שולח <span dir="ltr">`enabled: false`</span>
**וגם** <span dir="ltr">`maxProposalsPerPass: 0`</span>, ולכן סביבת עבודה שמדליקה את הלולאה
ואינה משנה דבר אחר עדיין קוראת, מדווחת וכותבת כלום. מה שהשתנה הוא התשובה של סביבת עבודה אחת
לחוגות האלה: זו, הפרויקט שאוכל את האוכל של עצמו, אחרי הרצה יבשה. התנאי של המקור עצמו להעלאתה
היה *"של הבעלים, אחרי קריאת שבוע של <span dir="ltr">`review-last-pass.json`</span>"* — אז קראו
את התצורה של המאגר הזה כהפעלת אותו שיקול דעת, ולא כברירת מחדל חדשה.

קורא שבודק את מצב הלולאה **בפרויקט שלו** צריך להריץ
<span dir="ltr">`node src/cli/index.ts review list`</span> ולא להסיק אותו מכאן.

### למה <span dir="ltr">`Stop`</span> ו-<span dir="ltr">`PreCompact`</span>, ולא <span dir="ltr">`SessionEnd`</span>

הערת הכותרת של <span dir="ltr">`trigger.ts`</span> עצמו נותנת סיבה מדודה לבחירת שני ה-hooks
האלה על פני <span dir="ltr">`SessionEnd`</span>, שנשמע כהתאמה טבעית יותר: נספר ביומן הביקורת של
הפרויקט הזה עצמו על פני חמישה־עשר ימים ושלושה סשנים, לא הייתה **אף שורת
<span dir="ltr">`session-end`</span> אחת**, מול 1,094 שורות <span dir="ltr">`stop`</span>, 17
<span dir="ltr">`pre-compact`</span>, ו-54 <span dir="ltr">`session-start`</span>. טריגר
שממופתח ל-<span dir="ltr">`SessionEnd`</span> היה נורה אפס פעמים בחיי הפרויקט הזה עצמו עד כה.

### המחוון — להכריע ש*מקטע* שווה קריאה, לפני שמעורב בזה מודל

<span dir="ltr">`src/review/rubric.ts::worthAPass`</span> הוא היוריסטיקה קבועה, לא קריאה למודל —
והוא נשאר כזו עכשיו כשמסלול מודל קיים, כי הוא השער שמכריע אם החצי היקר רץ בכלל.
ציטוט ה-arXiv של העיצוב עצמו (<span dir="ltr">`arXiv:2606.23525`</span>) משמש להצדקת שמירה לפי
תוכן המסלול ולא לפי מונה קריאות כלים גולמי, אבל המחוון כאן הוא סיווג דטרמיניסטי מעל מה שהטריגר
כבר קרא בזול, לא LLM ששופט את המקטע. סקריפט שחזור
(<span dir="ltr">`scripts/review-trigger-replay.ts`</span>) שהורץ על תמליל הסשן של הבעלים עצמו
בן 87 MB ו-36,448 שורות ב-<span dir="ltr">`everyNToolCalls: 15`</span> הנשלח מדד:

</div>

```
considerations                    261
the rubric fires                  164   (62.8%)
the rubric declines                97   (37.2%)
passes that actually run            3   ← maxFiresPerSession
```

<div dir="rtl">

ההערה של המחוון עצמו מפורשת ש**הוא אינו המנה** — <span dir="ltr">`maxFiresPerSession`</span>
הוא: 164 מקטעים חיוביים למחוון התכווצו ל-3 מעברים בפועל באותו סשן, מול 766 מעברים היפותטיים אילו
<span dir="ltr">`Stop`</span> היה יורה את המעבר בכל קריאה בודדת.

## מה מעבר אחד עושה: <span dir="ltr">`src/review/pass.ts`</span>

מעבר שנורה רץ ב**תהליך ילד מנותק ולא-ref'ד** —
<span dir="ltr">`spawn(..., {detached: true, stdio: 'ignore'}).unref()`</span> — במיוחד כדי ש-hook
שבו "מישהו בוהה בשאלה" (במילות הקובץ עצמו) לעולם לא ייחסם עליו, ובמיוחד עם מאזין
<span dir="ltr">`'error'`</span> מחובר, כי <span dir="ltr">`EventEmitter`</span> בלי כזה זורק
מחדש שיגור שנכשל כחריגה לא נתפסת שהייתה מפילה את כל ה-hook.

המעבר:

1. **אוסף** (<span dir="ltr">`src/review/input.ts::gather`</span>) את המקטע החדש של התמליל מאז
   ההיסט הרשום של המעבר האחרון (או את כל התמליל, אם
   <span dir="ltr">`readWholeTranscript`</span> נכון — ברירת המחדל הנשלחת), ועוד תמלילי
   תת-סוכנים אם <span dir="ltr">`includeSubagents`</span> נכון.
2. **מסווג** תצפיות ל-<span dir="ltr">`POINT_CATEGORIES`</span>
   (<span dir="ltr">`src/core/session-summary.ts`</span>) — אותה טקסונומיה שאדם שמעלעל בתמליל
   לאיתור "האם היה כאן משהו ששווה לשמור" היה משתמש בה.
3. **כותב דוח אחד**, תמיד, ל-<span dir="ltr">`<corpusRoot>/state/review-last-pass.json`</span> —
   ב-gitignore, ממצא מקומי של סביבת העבודה, לעולם לא פריט קורפוס בפני עצמו. הדוח נכתב **לפני**
   שמשהו מוצע, ולכן כישלון בחצי המציע לעולם אינו עולה את רישום הכיסוי.
4. **רק אז**, אם המנה מרשה, קורא לתוך <span dir="ltr">`propose.ts`</span>.

## הצעות: איך הצעה באמת הייתה נראית היום

זהו הדבר הכי משמעותי לדייק בו בפרק הזה, כי הוא סותר את מה שקורא עשוי להניח ש"הצעות שנוצרו על ידי
בינה מלאכותית" אומר. הכותרת של <span dir="ltr">`src/review/propose.ts`</span> עצמו קובעת זאת בלי
להסתייג:

> "שום דבר במוצר הזה אינו קורא למודל, והמודול הזה גם לא. <span dir="ltr">`prompt.ts`</span> הוא
> הממצא שסשן מפוצל היה נושא … והוא בנוי, נבדק ולא בשימוש על ידי מסלול הקוד למטה. מה שרץ היום הוא
> **מציע דטרמיניסטי**."

**הציטוט הזה הוא עדיין הכותרת של <span dir="ltr">`propose.ts`</span> מילה במילה, והוא עדיין נכון
לגבי <span dir="ltr">`propose.ts`</span>** — המציע הדטרמיניסטי הוא מה שהמודול ההוא הוא. הוא
**כבר אינו נכון לגבי המוצר**, נכון ל-<span dir="ltr">`870e57c5`</span> (2026-09-13): מסלול המודל
חי ב-<span dir="ltr">`src/review/pass.ts`</span>, לצד <span dir="ltr">`propose`</span>, לא
בתוכו. ראו "הגעה למודל" למטה, וקראו את הכותרת כקביעה על מודול אחד ולא על הכלי.

<span dir="ltr">`src/review/prompt.ts`</span> — prompt מודל בנוי במלואו, 250 שורות, שמוצמד
מבנית על ידי הטסט שלו עצמו — היה במשך ימים מיובא על ידי שום דבר מלבד הטסט ההוא. מה שהמציע
הדטרמיניסטי עושה הוא סיווג מבוסס-כללים של תצפיות שכבר נאספו, בלי שלב ייצור, והוא במכוון צר יותר
ממה שהעיצוב מדמיין בדרך אחת נוספת:

</div>

```ts
export type Artifact = 'check' | 'rule' | 'lesson';
export const AUTHORABLE: readonly Artifact[] = ['check'];
```

<div dir="rtl">

מתוך שלושת סוגי הטיוטה שהעיצוב מדמיין שהלולאה הזו יכולה בסופו של דבר לכתוב, **המציע
הדטרמיניסטי** מוגבל ל-<span dir="ltr">`check`</span> (שנוחת כפריט <span dir="ltr">`task`</span>)
לבדו. הנימוק של הקוד עצמו: מציע נטול-מודל יכול *לבחור* תצפית היטב, אבל אינו יכול *לחבר* — כל
טיוטה שהוא היה כותב ל-<span dir="ltr">`rule`</span> או ל-<span dir="ltr">`lesson`</span> הייתה
רק משפט שנשלף מילה במילה מתוך תמליל, והפרויקט שפט שזה מקובל עבור
<span dir="ltr">`task`</span> ("עבודה שיש לבנות") אבל לא מקובל להגיש, בלי שנקרא, לתוך קורפוס
שהפרויקט הזה ממש שולט בעצמו על פיו.

**למסלול המודל יש קבוצה רחבה יותר משלו**, והשניים שונים כי שני המציעים שונים:

</div>

```ts
export const MODEL_AUTHORABLE: readonly Artifact[] = ['check', 'rule', 'lesson'];
```

<div dir="rtl">

הטיעון של <span dir="ltr">`AUTHORABLE`</span> היה באורך משפט אחד והוא עסק במציע *לקסיקלי* —
"מציע לקסיקלי יכול לבחור תצפית. הוא אינו יכול לכתוב כלל" — הנחה שהיא שקרית לגבי משהו שמחבר.
המקור מפורש שזו אינה הרפיה: הצעת מודל עוברת **כל** שער שהדטרמיניסטית עוברת — המסך של סעיף 12,
שער הרלוונטיות של §5c שנבדק מול הראיות שהמודל עצמו ציטט, פנקס הדחיות של §8, דיכוי
הכפילויות-הקרובות של §5b מול אותה רשימת <span dir="ltr">`pending`</span> — וסדר הממצאים של §4
עדיין חל, כי ה-prompt קובע אותו ו-<span dir="ltr">`parseReply`</span> מסרב לכל דרג מחוץ לו.
**והמנה ללא שינוי:** הרחבת *מה* מותר לכתוב אינה מרחיבה *כמה*.

## הגעה למודל

*(חדש ב-<span dir="ltr">`870e57c5`</span>, 2026-09-13. הסעיף הזה מאוחר לשאר הפרק.)*

**המנגנון הוא שורת הפקודה של המעטפת עצמה, ללא ראש.**
<span dir="ltr">`src/review/model.ts`</span> משגר
<span dir="ltr">`claude --print --model <name> --output-format text`</span> דרך
<span dir="ltr">`node:child_process`</span>, כשה-prompt על **stdin** — לעולם לא ב-argv, כי
ה-prompt נושא קטעי תמליל ומשתרע על עשרות קילו-בתים, Windows חוסם שורת פקודה בסביבות 32K, ושורת
פקודה של Windows ניתנת לקריאה על ידי כל חשבון מקומי למשך חיי השיגור.
<span dir="ltr">`cliInvocation(model)`</span> מיוצא בדיוק כדי שטסט יוכל לקרוא את ה-argv בלי
לשגר.

**<span dir="ltr">`CONST-zero-runtime-dependencies`</span> ללא נגיעה, והמקור טוען זאת ולא קובע
זאת.** <span dir="ltr">`node:child_process`</span> הוא מובנה, ולכן שום דבר אינו נכנס ל-
<span dir="ltr">`dependencies`</span>. שורת הפקודה אינה חבילה שהמוצר הזה תלוי בה — *"היא התוכנית
הסביבתית ש**הפעילה** את ה-hook מלכתחילה, ולכן נוכחותה היא התנאי המקדים לקיום המעבר ולא הנחה
שהמעבר מוסיף."* היא נושאת את האישורים של המשתמש עצמו, ולכן המוצר הזה עדיין אינו מחזיק אף אחד.
שלוש חלופות נדחו, כל אחת בשמה: <span dir="ltr">`node:https`</span> ביד (דורש מפתח API שהמוצר הזה
לעולם לא צריך להחזיק), משטח ה-MCP (הפוך — MCP הופך את המוצר הזה ל*ספק* כלים, לא לקורא), ו-prompt
שנכתב לדיסק כדי שמישהו יישא (*"הדבר שנראה כמו קריאה למודל ואינו כזה"*). רביעית, שיגור תת-סוכן,
**אינה זמינה מעצם הבנייה**: המעבר הוא ילד מנותק של hook עם
<span dir="ltr">`stdio: 'ignore'`</span>, ולכן אין סוכן בתהליך ההוא שישגר משהו.

**<span dir="ltr">`review.model`</span> הוא מפתח תצורה אמיתי עכשיו**,
<span dir="ltr">`string | null`</span>, עם ברירת מחדל **<span dir="ltr">`null`</span>** — שההערה
של <span dir="ltr">`DEFAULT_REVIEW`</span> עצמו אומרת שפירושה "שום מודל אינו מושג בשום מסלול",
מאותה סיבה ש-<span dir="ltr">`maxProposalsPerPass`</span> נשלח ב-0: *"סביבת עבודה שמגדירה
<span dir="ltr">`enabled: true`</span> ואינה משנה דבר אחר אסור לה להתחיל להוציא אסימונים
על תת-מערכת שאף אחד עוד לא קרא את הפלט שלה."* סעיף 11 הדפיס
<span dir="ltr">`"model": "haiku"`</span>; השם שסעיף 11 הדפיס הוא השם להגדיר אותו אליו, וההגדרה
היא של הבעלים. **הוא כבר אינו מפתח נדחה** — <span dir="ltr">`model`</span> עזב את
<span dir="ltr">`REVIEW_LATER_KEYS`</span>, שמחזיק עכשיו רק את
<span dir="ltr">`crossSessionSameCwd`</span>, והמקור רושם למה: *"הוא נדחה כל עוד הדחייה הייתה
נכונה."*

**אתר הקריאה הוא ב-<span dir="ltr">`pass.ts:445–502`</span>, לא ב-
<span dir="ltr">`propose.ts`</span>** (<span dir="ltr">`const modelCandidates`</span> פותח את
הבלוק ב-<span dir="ltr">`:445`</span>, <span dir="ltr">`if (options.model !== null)`</span> ב-
<span dir="ltr">`:446`</span>, <span dir="ltr">`reviewPrompt(input)`</span> ב-
<span dir="ltr">`:447`</span>, <span dir="ltr">`callAgentCli`</span> ב-
<span dir="ltr">`:449`</span>), והמיקום נטען בהערה ממש מעליו, ב-
<span dir="ltr">`:440–444`</span>: הוא רץ *לפני* בלוק ההצעה והתוצאה שלו מקופלת פנימה, כך
ש**קריאת מודל שנכשלת עדיין משאירה דוח שאומר שהיא נוסתה ולמה**, וכך ש-
<span dir="ltr">`propose`</span> נשאר בר-בדיקה בלי תעבורה.
<span dir="ltr">`options.model === null`</span> מקצר את כל הבלוק. הקריאה חסומה על ידי
<span dir="ltr">`MODEL_TIMEOUT_MS = 180_000`</span> ו-
<span dir="ltr">`MAX_REPLY_BYTES = 1_000_000`</span>, ו-
<span dir="ltr">`isUsableModelName`</span> נבדק פעמיים — פעם עבור הדוח, פעם בגבול שהבתים באמת
חוצים — עם הדקדוק מיובא מ-<span dir="ltr">`core/config.ts`</span> ולא נאמר מחדש, "כך שהשם
שתצורה מקבלת והשם ששיגור מקבל אינם יכולים להיסחף זה מזה".

**המקוריות נוסעת על <span dir="ltr">`by`</span>, ו-<span dir="ltr">`origin`</span> במכוון לא
פוצל.** <span dir="ltr">`origin === 'review'`</span> הוא גבול האמון, שמושווה כליטרל בשבעה
מודולים; הרחבתו כדי להבחין בטיוטה שנכתבה על ידי מודל הייתה מרחיבה גבול אמון כדי לשאת עובדה לא
קשורה. במקום זה <span dir="ltr">`Proposer`</span> הוא
<span dir="ltr">`'deterministic' | 'model'`</span> והדרישה — *שפריט אומר מי ייצר אותו* — מסופקת
שלוש פעמים על ציר שאי אפשר לבלבל עם אמון: התגית <span dir="ltr">`proposer:`</span> על הפריט
(<span dir="ltr">`proposerTag`</span>), השורה הראשונה של תדריך הסקירה שאדם באמת קורא, ועמודת
<span dir="ltr">`by`</span> בכל שורה של <span dir="ltr">`review-last-pass.json`</span>.

**נמדד:** שתי הרצות חיות ב-2026-09-13, 79.2 שניות, שהחזירו 2 מועמדים שהחצי מבוסס-הכללים לא היה
יכול לחבר. **תוקן 2026-09-16: זה כבר אינו נכון.**
<span dir="ltr">`.my_context/config.json`</span> מגדיר
<span dir="ltr">`review.model: "claude-opus-5"`</span> בסביבת העבודה הזו — אומת בקריאת הקובץ
ישירות — ולכן מסלול המודל חי כאן, לא רדום. המדידה של 2026-09-13 למעלה היא עדיין הרצה אמיתית
וניתנת לשחזור של המנגנון; מה שהשתנה הוא רק האם ל*מאגר הספציפי הזה* יש כרגע את המתג דלוק. אל
תסמכו על המשפט "שום דבר אינו מופעל בסביבת העבודה הזו" בשום מקום אחר בפרק הזה בלי לבדוק את
התצורה החיה קודם — ראו את התיקון בראש הפרק הזה.

## המנה — המנגנון המדויק, ולמה זה אינו תקציב

המונח **המנה** הוא מונח מוגדר ב[מאגר כללי המוצר](./10-rule-store.he.md) הנשלח, ברשומה
<span dir="ltr">`def-the-ration`</span> (דרג: <span dir="ltr">`developer`</span> — אחת הרשומות
שחלות במאגר הזה ספציפית):

</div>

```
means: "the cap on how much the self-improvement pass may put in front of a
person: `review.maxProposalsPerPass` bounds ONE pass, and `review.queueCeiling`
bounds the QUEUE — past the ceiling a pass writes nothing at all and says so,
while capture continues and proposals wait."

confusedWith: "an injection budget. A budget bounds what is DELIVERED into a
context window and spills the rest; the ration bounds what is WRITTEN for a
human to review, and HOLDS the rest. And it is not a throttle for cost: it
exists because oversight has a capacity, and past it reviewer reliability
decays so that MORE escalation makes the system LESS safe."
```

<div dir="rtl">

ולכן המנה במכוון *אינה* אותו מושג כמו תקציב ההזרקה ב[הזרקה](./02-injection.he.md) — תקציב דוחק
עודף לשורת אינדקס בחלון הקשר; המנה מחזיקה עודף בתור עבור אדם, על התיאוריה (מצוטטת ל-
<span dir="ltr">`arXiv:2606.08919`</span>) שהסלמת הכול לסוקר מעבר לקיבולת האמיתית שלו הופכת את
הפיקוח ל*פחות* אמין, לא ליותר.

שני מספרים מממשים אותה, שניהם חיים ב-<span dir="ltr">`ReviewConfig`</span>:

- **<span dir="ltr">`maxProposalsPerPass`</span>** חוסם מעבר אחד. **הוא נשלח ב-
  <span dir="ltr">`0`</span>** — אף שהמאגר הזה מגדיר אותו עכשיו ל-<span dir="ltr">`5`</span>;
  ראו את בלוק התצורה למעלה.
- **<span dir="ltr">`queueCeiling`</span>** חוסם את כל התור הממתין. הוא נשלח ב-
  <span dir="ltr">`15`</span> — שהקוד קובע שהוא *נגזר*, לא נבחר: ערכי הדוגמה המודפסים של העיצוב
  עצמו הם <span dir="ltr">`maxProposalsPerPass: 5`</span> ×
  <span dir="ltr">`maxFiresPerSession: 3`</span> = 15, כלומר בדיוק שווי סשן אחד של הצעות במנה
  מלאה. הנימוק שניתן: אם שווי סשן מלא של הצעות עדיין יושב בלי סקירה, התגובה הנכונה היא להפסיק
  להוסיף לתור, לא להעלות את התקרה.

אומת ישירות ב-<span dir="ltr">`src/core/config.ts`</span> (שורה 737):

</div>

```ts
  maxProposalsPerPass: 0,
```

<div dir="rtl">

עם ההערה שסביבו שמסבירה במדויק למה ברירת המחדל הנשלחת סוטה מהדוגמה המודפסת של מסמך העיצוב עצמו
של <span dir="ltr">`5`</span>: הרצה יבשה ראשונה על תמליל אמיתי הראתה שהמציע הדטרמיניסטי בוחר
היטב אך מחבר גרוע, והפרויקט שפט שהגשת טיוטות כאלה ללא השגחה לתוך הקורפוס השולט של עצמו אינה
ניתנת להגנה. ההערה נחתמת בציטוט התוכנית של הפרויקט עצמו: *"אל תמשיכו על סמך טסטים ירוקים לבדם.
קראו את הטיוטות."* — העלאת המנה נאמרת כהכרעה של הבעלים, אחרי קריאת שבוע של דוחות
<span dir="ltr">`review-last-pass.json`</span> אמיתיים.

**אז: היום, במאגר הזה ובכל סביבת עבודה שלא עקפה זאת במפורש, הלולאה המשפרת את עצמה קוראת את
האותות של עצמה, מסווגת אותם, וכותבת דוח כיסוי — ומציעה כלום. היא בנויה ומחווטת מקצה לקצה; הברז
סגור עד שאדם מעלה את המספר.**

## שום דבר אינו מושמט בשקט על ידי המנה

גם הרשומה <span dir="ltr">`def-the-ration`</span> וגם ההערות של התצורה עצמה נחרצות בנקודה אחת:
מעבר לכל אחת מהתקרות, **הלכידה עדיין קורית**. מעבר ב-
<span dir="ltr">`maxProposalsPerPass: 0`</span> עדיין קורא, עדיין מסווג, עדיין כותב
<span dir="ltr">`review-last-pass.json`</span> — שדה ה-<span dir="ltr">`proposed.rationed`</span>
של הדוח הוא כמה תצפיות *היו* מוצעות, ו-<span dir="ltr">`held`</span> (ברגע שתקרת התור היא מה
שעצר) אומר איזו תקרה הייתה הסיבה. שום דבר שנצפה אינו נזרק; הוא פשוט לא הופך לטיוטה שאדם חייב
להסתכל עליה.

## גניזה: למה עדיין אין כלל גניזה

<span dir="ltr">`src/core/retire.ts`</span> מגדיר את הצורה שכלל גניזה *היה* לובש
(<span dir="ltr">`RetirementRule`</span>, <span dir="ltr">`RetirementCandidate`</span>) אבל שולח
אותו כ-<span dir="ltr">`null`</span>:

</div>

```ts
export const RETIREMENT_RULE: RetirementRule | null = null;
```

<div dir="rtl">

לא ברירת מחדל של אפס בתצורה — <span dir="ltr">`null`</span> ממשי, כך ששום דבר במורד הזרם אינו
יכול להגיע ל-<span dir="ltr">`candidates`</span> בלי שקורא יבנה קודם כלל וינקוב במדידה שמאחוריו.
הסיבות נרשמות כעובדות מדודות (<span dir="ltr">`WHY_NO_RULE`</span>, מתוארכות 2026-09-11 מול
הקורפוס ויומן הביקורת של המאגר הזה עצמו), והן נקשרות ישירות חזרה לכך שהמנה היא אפס:

</div>

```ts
export const WHY_NO_RULE: string[] = [
  'the population a rule could ever touch is empty: 0 items of origin `review` exist, because '
  + '`review.maxProposalsPerPass` ships at 0 and the loop has never proposed anything',
  'both signals the design names fire on nothing: 0 injectable items have never been delivered, '
  + 'and 0 were ever spilled without also being delivered',
  'the low tail of every exposure-corrected delivery statistic is the PINNED tier — all 39 '
  + '`always: true` items rank in the least-delivered 69 of 157, and not one reaches the '
  + 'most-delivered 89',
];
```

<div dir="rtl">

במילים פשוטות: כלל לגניזה אוטומטית של פריטים עם תרומה נמוכה עדיין אינו יכול להיכתב באחריות, כי
האוכלוסייה עצמה שהוא היה מנטר (פריטים ש*מקורם* בלולאה הזו) ריקה, וכי האות התמים ("פריטים נעוצים
צריכים להימסר לעיתים קרובות") הפוך באופן מדיד בקורפוס הזה — פריטים נעוצים מדורגים בין
ה*פחות*-נמסרים כי הם מוזרקים פעם אחת לכל תחילת סשן ולא שוב ושוב לכל קריאת כלי, מה שהיה גורם לכלל
תמים להעניש בדיוק את הפריטים שהפרויקט בחר לנעוץ.

## דוגמה מעובדת: קריאת המצב הנוכחי מקצה לקצה

</div>

```
$ node src/cli/index.ts review list
my_context: no drafts pending review.

$ node src/cli/index.ts decay --full
my_context decay — items not injected in the last 20 session(s). The ledger holds 26 session(s).
...
cold (1) — not auto-injected in the window; check before acting:
  RULE-never-weaken-byte-identity  ...

$ node src/cli/index.ts contribution --short
my_context contribution — how often each item was actually delivered into a session, read backwards
out of the audit log. ... 158 could be chosen by `select` today.
```

<div dir="rtl">

**מקרה שימוש.** צוות מדליק <span dir="ltr">`review.enabled: true`</span> בפרויקט חדש, משאיר את
<span dir="ltr">`maxProposalsPerPass`</span> ב-<span dir="ltr">`0`</span> הנשלח שלו, ועובד רגיל
במשך שבוע. שום דבר אינו מופיע ב-<span dir="ltr">`review list`</span> — בעיצוב. מה שהם מקבלים
במקום הוא שבוע של דוחות כיסוי <span dir="ltr">`review-last-pass.json`</span> שהם יכולים לקרוא
ביד, שעונים על "אילו זה היה דלוק לגמרי, מה זה היה מציע, וכמה טובות ההצעות ההן באמת היו?" לפני
שהם אי פעם מעלים את המנה מעל אפס. שלב הקריאה ההוא הוא מסלול הכניסה המיועד, לא באג בברירת המחדל.

## מה **לא** בנוי / בנוי אך כבוי

כל הפרק הזה מתאר מנגנון ש**בנוי, נבדק ומחווט למסלול ה-hook האמיתי — ונשלח כבוי בשתי ברירות מחדל
בלתי תלויות** (שלוש, בספירת <span dir="ltr">`drift`</span> למטה):

- **<span dir="ltr">`review.enabled`</span> מקבל ברירת מחדל <span dir="ltr">`false`</span>.**
  שום תהליך ילד לעולם אינו משוגר משום hook עד שסביבת עבודה מגדירה את זה במפורש. **המאגר הזה
  מגדיר אותו ל-<span dir="ltr">`true`</span>** נכון ל-<span dir="ltr">`0d683f2b`</span>; ברירת
  המחדל היא מה שהתקנה טרייה מקבלת.
- **<span dir="ltr">`maxProposalsPerPass`</span> מקבל ברירת מחדל <span dir="ltr">`0`</span>**,
  גם ברגע ש-<span dir="ltr">`enabled`</span> מודלק. סביבת עבודה שמדליקה רק את
  <span dir="ltr">`enabled`</span> עדיין כותבת כלום — המנה היא חוגה שנייה ובלתי תלויה, והערת
  הקוד אומרת במפורש שזה מכוון ואינו "מתג הרג שני". **המאגר הזה מגדיר אותו עכשיו ל-
  <span dir="ltr">`5`</span>** נכון ל-<span dir="ltr">`5388f018`</span>, שהוא הנתון המודפס של
  העיצוב עצמו.
- **<span dir="ltr">`drift.enabled`</span> מקבל ברירת מחדל <span dir="ltr">`false`</span>, והוא
  מתג כיבוי שלישי שהפרק הזה קודם לא נקב בו.**
  <span dir="ltr">`DEFAULT_DRIFT: DriftConfig = { enabled: false }`</span>
  (<span dir="ltr">`src/review/drift.ts:122`</span>). שני דברים עליו שכדאי לדעת לפני שמחפשים
  אותו במקום הלא נכון:
  - **המפתח הוא <span dir="ltr">`drift`</span> ברמה העליונה, לא
    <span dir="ltr">`review.drift`</span>**, וזה נכפה ולא נבחר:
    <span dir="ltr">`requireReview`</span> מסרב לכל מפתח שאינו מוכר לו בתוך בלוק ה-
    <span dir="ltr">`review`</span>, ולכן <span dir="ltr">`{"review": {"drift": …}}`</span> לא
    היה מדליק אותו — הוא היה **עוצר את טעינת כל התצורה**. מפתח ברמה העליונה הוא הצורה האחת
    שמפתח לא מוכר שורד בה, כי מפתחות לא מוכרים ברמה העליונה מדולגים ומגולים (ראו
    <span dir="ltr">`skippedKeys`</span>, [פרק 2](./02-injection.he.md)).
  - כל מצב שאינו ניתן לקריאה מתפענח לכבוי, במכוון, ו-<span dir="ltr">`DEFAULT_DRIFT`</span> הוא
    ערך ולא <span dir="ltr">`false`</span> מוטבע כך של"מה זה עושה אם לא אעשה דבר" תהיה תשובה
    שאפשר לקרוא ולא להסיק.
  Drift מודד סשן מול **עוגן** ([פרק 5](./05-anchors.he.md)) — שני טקסטים שהבעלים ייצר — לעולם לא
  מול ניחוש כוונה, וכל סירוב (אין עוגן, עוגן בלי שם בתוכו, מקטע שהמחוון דחה) נאמר ולא מוחזר כ-
  <span dir="ltr">`false`</span> חשוף.
- **מודל **יכול** עכשיו להיקרא, ו-<span dir="ltr">`review.model`</span> מקבל ברירת מחדל
  <span dir="ltr">`null`</span> כך ששום דבר אינו מגיע לאחד — כברירת מחדל של המוצר.** הסעיף הזה
  נהג לומר "שום מודל לעולם אינו נקרא"; <span dir="ltr">`870e57c5`</span> (2026-09-13) הפך את זה
  לשקר. <span dir="ltr">`src/review/model.ts`</span> משגר את שורת הפקודה של המעטפת עצמה ללא ראש
  ו-<span dir="ltr">`src/review/prompt.ts`</span> — לא מיובא על ידי המוצר במשך ימים — הוא עכשיו
  מה שהוא שולח. ראו "הגעה למודל" למעלה. ה**מתג** עצמו,
  <span dir="ltr">`DEFAULT_REVIEW.model`</span>, הוא <span dir="ltr">`null`</span> בברירת המחדל
  הנשלחת — אבל **סביבת העבודה הזו כן מגדירה אותו**:
  <span dir="ltr">`.my_context/config.json`</span> נושא
  <span dir="ltr">`review.model: "claude-opus-5"`</span>, אומת 2026-09-16. ולכן המשפט המדויק
  עבור *המאגר הזה* הוא "מודל מושג, בתצורה של המאגר הזה עצמו", ולא "שום מודל אינו מושג בשום
  מסלול". התקנה טרייה עדיין מקבלת את ה-<span dir="ltr">`null`</span> הכבוי כברירת מחדל.
- **<span dir="ltr">`src/review/drift.ts`</span> עדיין מיובא על ידי שום דבר מלבד הטסט שלו
  עצמו** — המייבא היחיד שלו בכל מקום הוא <span dir="ltr">`test/review/drift.test.ts`</span>.
  (גרסה מוקדמת יותר של הסעיף הזה נקבה גם ב-<span dir="ltr">`test/core/retrieval-return.test.ts`</span>
  כמייבא; הקובץ ההוא רק *מזכיר* את <span dir="ltr">`drift.test.ts`</span> בתוך שתי הערות, הוא
  אינו מייבא את המודול — אומת מחדש ישירות מול שני הקבצים.) ב-18,498 בתים (2026-09-17) הוא הגדול
  משני המודולים שהפרק הזה נהג לתאר כלא מחווטים, והוא עכשיו היחיד.
- **<span dir="ltr">`src/review/pending.ts`</span>, לעומת זאת, **כן** מחווט**, והפרק הזה דן ב-
  <span dir="ltr">`queueCeiling`</span> באריכות בלי לנקוב במודול שמחשב את התור:
  <span dir="ltr">`src/cli/commands/status.ts`</span>, <span dir="ltr">`statusline.ts`</span>,
  <span dir="ltr">`statusline-powerline.ts`</span>, <span dir="ltr">`src/core/questions.ts`</span>,
  <span dir="ltr">`src/ui/read-model.ts`</span> ו-<span dir="ltr">`src/ui/public/app.js`</span>
  כולם קוראים אותו.
- **המציע הדטרמיניסטי כותב טיוטות <span dir="ltr">`check`</span> (משימה) בלבד**
  (<span dir="ltr">`AUTHORABLE = ['check']`</span>), כי הוא אינו יכול לחבר פרוזה מספיק טוב כדי
  שיסמכו עליו עם הדרג הנורמטיבי. **מסלול המודל כותב את כל השלושה**
  (<span dir="ltr">`MODEL_AUTHORABLE = ['check', 'rule', 'lesson']`</span>) — שתי קבוצות, כי שני
  מציעים, וכל שער חל על שניהם.
- **שום כלל גניזה אינו קיים.** <span dir="ltr">`RETIREMENT_RULE`</span> הוא
  <span dir="ltr">`null`</span>, עם הסיבות המדודות המדויקות שנרשמות ב-
  <span dir="ltr">`WHY_NO_RULE`</span> ולא מושארות משתמעות.
- **<span dir="ltr">`crossSessionSameCwd`</span> הוא המפתח האחד שמסמך העיצוב (סעיף 11) מדפיס
  שסכמת התצורה עדיין דוחה** — <span dir="ltr">`REVIEW_LATER_KEYS = ['crossSessionSameCwd']`</span>.
  הוא נדחה ולא מתקבל בשקט ומדולג, על אותו גבול שהקובץ הזה נוקב בו עבור
  <span dir="ltr">`maxProposalsPerPass`</span>: מפתח תצורה שנראה חי ואינו עושה דבר גרוע יותר
  משגיאת פענוח. הסיבה שניתנת ספציפית — פנקס הצפיות חי *בתוך* שורש קורפוס אחד, ולכן "אותו cwd"
  אינו הגדרה, הוא הדבר היחיד שהקובץ יכול לבטא, וקבלת המפתח "הייתה מבטיחה השוואה ששום דבר אינו
  מבצע." **<span dir="ltr">`model`</span> נהג להיות ברשימה ההיא ואינו עוד**
  (<span dir="ltr">`870e57c5`</span>). המקור רושם את המעבר ולא מוחק אותו: *"הוא נדחה כל עוד
  הדחייה הייתה נכונה — 'שום דבר במוצר הזה אינו קורא למודל' — ו-
  <span dir="ltr">`src/review/model.ts`</span> סיים את זה."* כל משפט שאומר ש-
  <span dir="ltr">`review.model`</span> נדחה הוא עכשיו שגוי; הוא מתקבל, מאומת מול דקדוק שמות,
  ומקבל ברירת מחדל <span dir="ltr">`null`</span>.
- **<span dir="ltr">`src/lesson/`</span> (<span dir="ltr">`derive.ts`</span>,
  <span dir="ltr">`staging.ts`</span>) אינו מתואר בסימוכין הזה כלל**, אף ש-
  <span dir="ltr">`mycontext lesson`</span> / <span dir="ltr">`lesson-stage`</span> /
  <span dir="ltr">`lesson-accept`</span> הם החצי שנכתב בידי אדם של אותו צינור שהפרק הזה עוסק בו.
- **שער שלישי שכבוי כברירת מחדל קיים מחוץ לתת-המערכת הזו והסיכום של האינדקס מפספס אותו:**
  <span dir="ltr">`dispatchGate`</span> / <span dir="ltr">`dispatchGate.enabled`</span>
  (<span dir="ltr">`src/core/config.ts:600`</span>,
  <span dir="ltr">`DEFAULT_DISPATCH_GATE = { enabled: false }`</span>) — האם שיגור
  <span dir="ltr">`Agent`</span> חייב לנקוב בפריט משימה. כמו <span dir="ltr">`review`</span> הוא
  נשלח כבוי, נדחה ולא מדולג על תת-מפתח לא מוכר, ו — כמו <span dir="ltr">`review`</span> —
  **המאגר הזה מדליק אותו** (<span dir="ltr">`"dispatchGate": {"enabled": true}`</span> ב-
  <span dir="ltr">`.my_context/config.json`</span>). הוא שייך לאותו סיכום כמו שתי החוגות למעלה.

## ראו גם

- [00 — אינדקס](./00-index.he.md)
- [03 — יצירה והשערים](./03-creation-and-gates.he.md) — אותה עמדת אישור-אנושי מיושמת על כל דרך
  אחרת שבה פריט נכנס לקורפוס, לא רק על הטיוטות של הלולאה הזו.
- [09 — שורת הפקודה ושרת ה-MCP](./09-cli-and-mcp.he.md) — <span dir="ltr">`review`</span>,
  <span dir="ltr">`decay`</span> ו-<span dir="ltr">`contribution`</span> כפקודות שורת פקודה.
- [10 — מאגר כללי המוצר](./10-rule-store.he.md) — <span dir="ltr">`def-the-ration`</span>,
  רשומת דרג המפתחים שנוקבת במונח שהפרק הזה בנוי עליו ומגדירה אותו.

</div>
