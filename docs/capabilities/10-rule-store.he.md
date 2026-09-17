<!--
  Hebrew mirror of `docs/capabilities/10-rule-store.md`. The English file is the
  source. Conventions: `docs/README.he.md` and `docs/the-store.he.md` — Hebrew
  prose and tables inside `<div dir="rtl">`, fenced blocks outside it,
  `<span dir="ltr">` around any Latin run whose edge characters are not both
  alphanumeric and around any run of two or more Latin terms joined by commas
  or slashes.

  Terminology follows `docs/the-store.he.md`, which is this project's long
  Hebrew treatment of the same subsystem: מאגר הכללים, קבוע, דרג,
  עובדה/איסור/נוהל/תקן/הגדרה, מונע/מגלה, דלת, נתיב, דחיקה, הורדה מכוננות,
  אדום ידוע, הוכחה בהסרה, המנה.

  Every pasted block — `wc -c`, `rules list`, `rules verify`, the `grep` over
  `src/hooks/`, and each `rules show` extract — is byte-identical to the English
  file, with its abridgement stated in the prose exactly as the English states
  it. A box-drawing table inside an RTL container is reversed by the bidi
  algorithm, which is the second reason these sit outside the `<div>`s.

  Heading sequence must stay identical to the English file.
-->

# פרק 10 — מאגר כללי המוצר

<div dir="rtl">

> "מאגר כללי המוצר — אל תדלגו עליו." זו היכולת האחת שנשלחת *עם הכלי עצמו*, ולא עם שום פרויקט
> שמתקין אותו, והיא הפינה המכוונת ביותר ארכיטקטונית בבסיס הקוד: מאגר שני, מבודד לחלוטין, של טקסט
> נורמטיבי שחי לצד — ולעולם לא נוגע ב — הקורפוס שמתואר ב-[פרק 1](./01-items-and-corpus.he.md).

## מה זה, ולמה זו אינה קטגוריית קורפוס

הקורפוס (<span dir="ltr">`.my_context/items/`</span>) מחזיק את מה ש*פרויקט* יודע. מאגר כללי
המוצר, <span dir="ltr">`src/rules/`</span>, מחזיק את מה ש-my_context יודעת **על עצמה** — הדברים
שכל התקנה צריכה שייאמרו לה, או שהמאגר הזה ספציפית צריך שייאמרו לו, בלי קשר לאיזה קורפוס של
פרויקט יושב לידו.

היה קל להפוך את זה ל"סתם עוד קטגוריה" כמו ש-<span dir="ltr">`rule`</span> או
<span dir="ltr">`standard`</span> כבר קיימות ([פרק 1](./01-items-and-corpus.he.md)). קובץ הסכמה
של המאגר (<span dir="ltr">`src/rules/schema.ts`</span>) והטוען שלו
(<span dir="ltr">`src/rules/store.ts`</span>) מסבירים, בהערת כותרת ארוכה, בדיוק למה זה נדחה —
בציטוט ישיר של מסמך העיצוב:

> *"אם הקורפוס יודע על זה, אז <span dir="ltr">`list`</span>, <span dir="ltr">`ready`</span>,
> <span dir="ltr">`doctor`</span>, תקציבי הדרגים, דעיכה, supersede ובורר ההזרקה כל אחד צריך
> **חריג**, וכל חריג הוא מקום לדליפה. מאגר שהקורפוס מעולם לא שמע עליו לא צריך חריגים בשום מקום.
> <span dir="ltr">`doctor`</span> הולך על תיקיות; הוא פשוט לעולם לא הולך על זו."*

זה נאכף, ולא רק נטען: <span dir="ltr">`src/rules/`</span> רשאית לייבא בדיוק דבר אחד מ-
<span dir="ltr">`src/core/`</span> — מפענח ה-frontmatter
(<span dir="ltr">`core/frontmatter.ts`</span>) — ולא יותר, נבדק על ידי
<span dir="ltr">`test/rules/isolation.test.ts`</span>, שהולך על גרף הייבוא וגם קובע (לפי שדה
ה-<span dir="ltr">`check`</span> של הרשומה <span dir="ltr">`def-the-corpus`</span> עצמה) ש-
<span dir="ltr">`doctor`</span>, <span dir="ltr">`list`</span>, <span dir="ltr">`ready`</span>
ובורר ההזרקה כל אחד מחזיר **כלום** מ-<span dir="ltr">`src/rules/entries/`</span>. הקורפוס
והמאגר אינם יכולים לראות זה את זה.

**מקרה שימוש:** צרכן מתקין את my_context בפרויקט שלו. הקורפוס שלו ריק ביום הראשון. מאגר הכללים
עדיין מוסר רשומה אחת — העובדה האחת שכל התקנה צריכה בלי קשר לתוכן הפרויקט (ראו "דרגים" למטה) —
בלי שהעובדה ההיא תצטרך להיזרע לקורפוס של כל פרויקט חדש ביד, ובלי שכלי הקורפוס יצטרכו אי פעם
לדעת שהמאגר קיים.

## העובדות שנמדדו

הורץ ישירות מול המאגר הזה:

</div>

```
$ wc -c src/rules/entries/*.md | tail -1     # re-run 2026-09-17, same figures; it was 32,516 on 2026-09-13 and 23,101 on 2026-09-12
41955 total
$ ls src/rules/entries/*.md | wc -l
16
```

<div dir="rtl">

**שש־עשרה רשומות, 41,955 בתים, נמדדו מחדש ב-2026-09-17** — אחת <span dir="ltr">`product`</span>
וחמש־עשרה <span dir="ltr">`developer`</span>. חמש־עשרה רשומות הייתה הספירה של 2026-09-13 (שלוש
נחתו באותו יום, <span dir="ltr">`72584fd0`</span>, 20:21, "three lessons enter the product":
<span dir="ltr">`a-fixture-must-not-be-what-makes-a-proof-pass`</span>,
<span dir="ltr">`a-gate-that-cannot-be-shown-to-fail-is-not-a-gate`</span> ו-
<span dir="ltr">`a-scanner-names-what-it-skips-not-what-it-scans`</span>, כולן
<span dir="ltr">`standard`/`developer`</span>). שש־עשרה נחתה ב-2026-09-15:
<span dir="ltr">`nothing-to-do-and-could-not-look-are-different-answers`</span>
(<span dir="ltr">`standard`/`developer`</span>) — הכלל שצעד שיכול להכריע "אין עבודה" חייב גם
להיות מסוגל לומר "לא הצלחתי לבדוק", ושני אלה אסור להם לעולם לחלוק ערך החזרה. שדה ה-
<span dir="ltr">`example`</span> שלו עצמו הוא האירוע שייצר אותו: מעבר העוגנים הפר-תורי (פרק 5)
השתתק לחצי שעה ב-2026-09-15 כי שדה ה-<span dir="ltr">`capped`</span> של בדיקה — שהוגדר ביום
שהמעבר נכתב — מעולם לא נקרא אפילו פעם אחת. <span dir="ltr">`mycontext rules list`</span> מאשר
שש־עשרה חיות. קראו את הספירה כקריאה מתוארכת: המאגר הזה קטן מספיק שפסיקת בעלים אחת מזיזה אותו.

<span dir="ltr">`src/rules/store.ts`</span> (155), <span dir="ltr">`src/rules/deliver.ts`</span>
(785) ו-<span dir="ltr">`src/rules/delivered.ts`</span> (430) הם **1,370 שורות** של קוד
טוען/מרנדר/פנקס סביב שש־עשרה קובצי ה-Markdown הקטנים האלה, נספרו מחדש 2026-09-16 (גרסה מוקדמת
יותר של המשפט הזה נתנה 136/659/384 = 1,179, שנסחף); <span dir="ltr">`manifest.ts`</span> (493,
ולא 645 שטיוטה מוקדמת יותר נשאה — ראו למה למטה) ו-<span dir="ltr">`schema.ts`</span> (432)
מביאים את הסך הכולל ל-2,295. **התיקייה מחזיקה גם את <span dir="ltr">`integrity.ts`</span> (243
שורות)**, שסעיף חותם המניפסט של הפרק הזה עצמו למטה מסביר שפוצל *מתוך*
<span dir="ltr">`manifest.ts`</span> — בדיוק למה <span dir="ltr">`manifest.ts`</span> התכווץ
מ-645 ל-493 בין שתי הקריאות. כולל אותו, התיקייה היא **2,538 שורות** בסך הכול, ולא 2,256 שמעבר
מוקדם יותר קבע (שגם השתמש בנתון המיושן של <span dir="ltr">`manifest.ts`</span> וגם השמיט את
<span dir="ltr">`integrity.ts`</span> לחלוטין).

## הסכמה: חמישה סוגים, והתבנית *היא* הסכמה

<span dir="ltr">`src/rules/schema.ts`</span> מגדיר קבוצה סגורה של חמישה **סוגי** רשומה, לכל אחד
החלקים שהוא דורש — והכותרת של הקובץ עצמו קובעת את כוונת העיצוב במדויק: *"התבנית היא הסכמה,
הבדיקה **וגם** הטופס — דבר אחד, לא שלושה שיכולים להיסחף: <span dir="ltr">`prohibition`</span>
בלי <span dir="ltr">`why`</span> אינו נטען, אינו מאומת, ואינו יכול להישמר בממשק התחזוקה."*

</div>

<div dir="rtl">

| סוג | החלקים שהוא דורש | כל סוג גם דורש |
|---|---|---|
| `fact` (עובדה) | <span dir="ltr">`truth`, `breaks`</span> | <span dir="ltr">`example`, `check`</span> |
| `prohibition` (איסור) | <span dir="ltr">`prohibition`, `why`</span> | <span dir="ltr">`example`, `check`</span> |
| `procedure` (נוהל) | <span dir="ltr">`steps`</span> (רשימה), <span dir="ltr">`proof`</span> | <span dir="ltr">`example`, `check`</span> |
| `standard` (תקן) | <span dir="ltr">`trigger`, `shape`</span> | <span dir="ltr">`example`, `check`</span> |
| `definition` (הגדרה) | <span dir="ltr">`term`, `means`, `confusedWith`</span> | <span dir="ltr">`example`, `check`</span> |

</div>

<div dir="rtl">

<span dir="ltr">`example`</span> קיים כי, במילות הסכמה עצמה, הוא "מה שמונע מרשומה להיות ניתנת
לוויכוח" — *"לעולם לא <span dir="ltr">`git add -A`</span>"* הוא חלש; *"לעולם לא
<span dir="ltr">`git add -A`</span> — ב-2026-09-09 <span dir="ltr">`git commit`</span> חשוף סחף
עבודה מבוימת של נתיב אחר לתוך commit על גבול של טבלה"* אינו. <span dir="ltr">`check`</span>
חייב להיות <span dir="ltr">`preventive:<name>`</span>,
<span dir="ltr">`detective:<name>`</span>, או <span dir="ltr">`none - <reason>`</span> — בדיקה
**מונעת** מסרבת לפעולה הרעה לפני שהיא קורית (אפשרית רק היכן שהמאגר מחזיק את נתיב הכתיבה); בדיקה
**מגלה** מדווחת עליה בדיעבד מיומן הביקורת/ארכיון השיחות (הסוג היחיד שזמין עבור כלל על הפלט של
העוזר עצמו, מכיוון ששום דבר אינו יכול לסרב לטקסט של מודל לפני שהוא מיוצר);
<span dir="ltr">`none`</span> חוקי אבל חייב לשאת סיבה, בדיוק כמו מוסכמת
<span dir="ltr">`@basis none - <reason>`</span> של הפרויקט הזה עבור טסטים
([פרק 13](./13-testing-discipline.he.md)).

**ארבעה** שדות של מחזור חיי קורפוס מוחרגים **במפורש** על ידי המפענח (בדיקת "שדה תועה" של
<span dir="ltr">`parseEntry`</span>): <span dir="ltr">`status`</span>,
<span dir="ltr">`supersedes`</span>, <span dir="ltr">`always`</span>,
<span dir="ltr">`valid_until`</span>. ההערה של הסכמה קובעת למה: *"אלה קבועים, לא פריטים עם
חיים."* רשומה שהייתה מבריחה אחד מאלה הייתה נראית כאילו יש לה מחזור חיים שאין לה.

<span dir="ltr">`parseEntry`</span> לעולם אינו זורק על קובץ רע — הוא מחזיר סירוב מוקלד שנוקב
בקובץ ובחלק החסר, ומצטט את אותה משמעת שנקובה במקום אחר בפרויקט הזה כ-
<span dir="ltr">`INV-nothing-is-dropped-silently`</span>: זריקה הייתה מפילה את כל המאגר בגלל
קובץ רע אחד; סירוב נקוב שומר על השאר נטען ואומר לכם בדיוק מה חסר.

## דרגים: <span dir="ltr">`product`</span> ו-<span dir="ltr">`developer`</span>, ומה בדיוק מכריע מי חל

</div>

```ts
// src/rules/schema.ts
export type Tier = 'product' | 'developer';
```

<div dir="rtl">

רשומות <span dir="ltr">`product`</span> מגיעות ל**כל** משתמש שמתקין את my_context. רשומות
<span dir="ltr">`developer`</span> חלות רק כש**סביבת העבודה שעובדים עליה היא מאגר המקור של
my_context עצמה** — המאגר הזה. זו כל הקביעה "במאגר של צרכן חלה רשומה **אחת**; במאגר הזה חלות
כולן", וכדאי לומר אותה במדויק כי ה**דרג** אינו דגל תצורה, קובץ סימון, או משתנה סביבה שפרויקט של
זר יכול לרכוש בטעות:

</div>

```ts
// src/rules/deliver.ts
export function workspaceIsMyContext(projectRoot: string): boolean {
  return path.resolve(path.dirname(projectRoot)) === packageRoot();
}
```

<div dir="rtl">

<span dir="ltr">`packageRoot()`</span> (<span dir="ltr">`src/rules/store.ts:51–53`</span>)
מפענח <span dir="ltr">`dirname(store.ts) + '..' + '..'`</span> — **שתי** רמות,
<span dir="ltr">`src/rules`</span> ← <span dir="ltr">`src`</span> ← שורש החבילה — כלומר, "האם
ה-<span dir="ltr">`.my_context`</span> שאני רץ מולו יושב פשוטו כמשמעו ליד המקור של חבילת התוסף
ששלחה את הכללים האלה." הערת הקוד קובעת את הנימוק ישירות: קובץ סימון "הוא דבר שפרויקט של זר רוכש
בהעתקת קובץ, ומה שתלוי בתשובה הוא האם כללים על איך **המאגר הזה** עובד הם חוק במקום אחר." זהות
נתיב אי אפשר להעתיק בטעות; קובץ סימון אפשר.

**אבל ה*מקור* של המאגר ניתן להגדרה ממשתנה סביבה, וזה ראוי לאותה בולטות כמו הדרג.**
<span dir="ltr">`MYCONTEXT_RULES_DIR`</span> (<span dir="ltr">`RULES_DIR_ENV`</span>,
<span dir="ltr">`src/rules/deliver.ts:439`</span>) מחליף את **כל** המאגר:
<span dir="ltr">`resolveStoreDir`</span> (<span dir="ltr">`:543–547`</span>) מחזיר את התיקייה
הנקובה בעדיפות על פני <span dir="ltr">`entriesDir()`</span>, ו-
<span dir="ltr">`deliverAtDoor`</span>, <span dir="ltr">`assertDoor`</span> ו — מאז 2026-09-14
(<span dir="ltr">`store/8`</span>) — כל שלוש תת-הפקודות של <span dir="ltr">`mycontext rules`</span>
עוברות דרך אותו פענוח אחד, במכוון, "כי שני היו מאפשרים לקביעה לספור מאגר אחר מזה שהדלת מסרה."
עד לתאריך ההוא שורת הפקודה לא עשתה זאת, ולכן <span dir="ltr">`rules list`</span> ו-
<span dir="ltr">`rules verify`</span> תיארו את המאגר של החבילה עצמה בעוד שהדלתות מסרו אחר —
ו-<span dir="ltr">`missedDoorLine`</span>, המשפט שאומר לקורא מה להריץ כשדלת אולי הוחמצה, נוקב
בדיוק בשתי הפקודות האלה.

זה אינו שקט. <span dir="ltr">`substitutedStoreLine`</span> (<span dir="ltr">`:341–347`</span>)
פולט, לתוך הבלוק הנמסר עצמו:

> *"**הקבועים האלה **לא** נקראו מהחבילה המותקנת.**
> <span dir="ltr">`MYCONTEXT_RULES_DIR`</span> מצביע על <span dir="ltr">`<dir>`</span>, ולכן מה
> שבא הוא מה שהתיקייה ההיא מחזיקה — מאומת מול המניפסט של עצמה, שאינו זה שנשלח. בטלו את המשתנה
> כדי לקרוא את המאגר המותקן."*

השורה אינה ריקה **רק** כשהמשתנה באמת בתוקף, מאותה סיבה שכל הערה ב-
<span dir="ltr">`core/inject.ts`</span> נשמרת באותה דרך: "משפט שמופיע בכל פעם הוא משפט שאף אחד
אינו קורא." שימו לב למה שהגילוי מודה בו ולא מסתיר: המאגר המוחלף מאומת מול המניפסט של **עצמו**,
לא מול זה שנשלח — ולכן החותם למטה הוא חותם על איזו תיקייה שנמצאת במשחק, לא על מה ש-my_context
פרסמה.

המסנן עצמו חי בטוען:

</div>

```ts
// src/rules/store.ts, loadRules()
if (parsed.tier === 'developer' && !workspaceIsMyContext) continue;
```

<div dir="rtl">

מתוך שש־עשרה הרשומות הנשלחות, **בדיוק אחת**
(<span dir="ltr">`an-unknown-category-means-a-possible-wrong-corpus`</span>,
<span dir="ltr">`fact`</span>) היא <span dir="ltr">`product`</span>; ה**חמש־עשרה** האחרות הן
<span dir="ltr">`developer`</span>. ולכן בכל פרויקט צרכן רגיל, בדיוק רשומה אחת אי פעם בתוקף;
במאגר הזה, כל השש־עשרה. אומת חי. **הבלוק למטה נהג להציג רק את ספירת שתי השורות ולהשמיט בשקט את
כל השאר שהפקודה מדפיסה** — כותרת גרסת המאגר, הערת ה-changelog שלה, וטבלת שש־עשרה השורות של
הרשומות — בעוד ש§"שש־עשרה הרשומות" בהמשך הפנה קורא בחזרה ל*"טבלת <span dir="ltr">`rules list`</span>
למעלה"* שלא הייתה שם. נלכד מחדש בשלמותו ב-**2026-09-17** בהפניית הפקודה לקובץ; הטבלה רחבה, והיא
מודפסת ברוחב האמיתי שלה ולא מוקלדת מחדש צרה יותר:

</div>

```
$ node src/cli/index.ts rules list     # 2026-09-17, whole, nothing cut
store version 5, published 2026-09-11T09:50:41.624Z
  the provenance of a migrated entry moves out of its body and into the `movedFrom` / `movedOn`
  fields, and the renderer discloses it to the DEVELOPER tier only. A product entry ships to every
  install, where "moved from RULE-x" names a corpus item the reader does not have and cannot fetch —
  a citation that resolves to nothing, inside the block this product says outranks every other
  source. Owner's ruling, 2026-09-11: strip it for product entries, keep it for developer ones.

my_context rules — 16 entry(s) in force here. This workspace IS my_context, so developer-tier
entries apply too.

  ┌────────────────────────────────────────────────────────┬─────────────┬───────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ id                                                     │ kind        │ tier      │ title                                                                                                                       │
  ├────────────────────────────────────────────────────────┼─────────────┼───────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ a-fixture-must-not-be-what-makes-a-proof-pass          │ standard    │ developer │ a proof's power must come from its subject, never from how its fixture happens to be arranged                               │
  │ a-gate-that-cannot-be-shown-to-fail-is-not-a-gate      │ standard    │ developer │ a gate is not wired until somebody has broken the thing it guards and watched it go red there                               │
  │ a-scanner-names-what-it-skips-not-what-it-scans        │ standard    │ developer │ a scanner enumerates what it will SKIP, never what it will scan                                                             │
  │ an-unknown-category-means-a-possible-wrong-corpus      │ fact        │ product   │ an unknown-category error may mean the wrong corpus, not a misspelled flag                                                  │
  │ commit-with-a-pathspec                                 │ prohibition │ developer │ the dispatching session commits by explicit path, never by the shared index                                                 │
  │ def-a-door                                             │ definition  │ developer │ a door is a hook where a context window begins, and it carries an obligation to deliver                                     │
  │ def-a-lane                                             │ definition  │ developer │ a lane is one delegated subagent, with its own context window and its own brief                                             │
  │ def-known-red                                          │ definition  │ developer │ known-red means already failing at HEAD, counted, and recorded with a reason                                                │
  │ def-prove-by-removal                                   │ definition  │ developer │ proving by removal breaks the line an assertion rests on and watches that assertion go red                                  │
  │ def-spill                                              │ definition  │ developer │ a spill is a candidate that did not fit its budget, and is recorded with the reason                                         │
  │ def-stand-down                                         │ definition  │ developer │ standing an item down clears the fields that make it reach a context window                                                 │
  │ def-the-corpus                                         │ definition  │ developer │ the corpus is the Markdown under .my_context/items, and it is the source of truth                                           │
  │ def-the-ration                                         │ definition  │ developer │ the ration bounds how much the self-improvement pass may put in front of a person                                           │
  │ never-a-git-command-that-writes-the-shared-tree        │ prohibition │ developer │ a lane runs no git command that writes the shared working tree                                                              │
  │ nothing-to-do-and-could-not-look-are-different-answers │ standard    │ developer │ a step that can decide there is no work must be able to say it could not look, and the two answers must never share a value │
  │ numbered-options-on-a-question-put-to-the-owner        │ standard    │ developer │ a question put to the owner carries numbered options and one marked recommendation                                          │
  └────────────────────────────────────────────────────────┴─────────────┴───────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

<div dir="rtl">

הנתון של <span dir="ltr">`product`</span> אחד החזיק בכל גרסת מאגר עד כה; ספירת ה-
<span dir="ltr">`developer`</span> היא מה שזז.

## חותם ה-checksum: על מה הוא מגן, ולמה במכוון אינו מסרב

החותם חי ב-<span dir="ltr">`src/rules/manifest.ts`</span>, נפרד לגמרי מהסכמה/הטוען (כותרת המודול
מציינת שזה הקובץ ה*יחיד* ב-<span dir="ltr">`src/rules/`</span> שכותב — "קורא בלבד" נכון לגבי
<span dir="ltr">`store.ts`</span>). לכל קובץ רשומה יש checksum של SHA-256 שנרשם ב-
<span dir="ltr">`src/rules/entries/manifest.json`</span>, שמחושב עם סופי שורה מנורמלים
(<span dir="ltr">`\r\n`</span> מקופל ל-<span dir="ltr">`\n`</span>) כך ש-checkout של Windows עם
<span dir="ltr">`core.autocrlf`</span> דלוק לא ידווח על כל רשומה כ"שונתה" ברגע ששוכפלה — ההערה
של הקובץ עצמו מציינת שפקודת אימות שהתשובה הראשונה שלה על התקנה נקייה היא "הכללים שלכם זויפו"
היא פקודה שאנשים מכבים.

<span dir="ltr">`verifyManifest`</span> בודק שלושה סוגי נזק
(<span dir="ltr">`Damage = 'missing' | 'altered' | 'unexpected'`</span>) ומדווח על **כל** בעיה
שנמצאה, לא רק הראשונה — שוב <span dir="ltr">`INV-nothing-is-dropped-silently`</span>: נקיבה
באחת משלוש רשומות פגומות הייתה גורמת לתיקון להיראות שלם בעוד ששני שלישים מהנזק נשארים.

חי, על המאגר הזה, **2026-09-17**. ההדבקה הקודמת עצרה אחרי שורת הנתיב והשמיטה את גרסת המאגר ואת
הערת ה-changelog בת חמש השורות שבאה אחריה — אותם שני דברים שהפרוזה של הפרק הזה עצמה אומרת
שהפקודה מדפיסה. בשלמותו, הפעם:

</div>

```
$ node src/cli/index.ts rules verify     # 2026-09-17, whole, nothing cut
my_context: the rule store is intact — every entry matches the checksum that shipped with it.
  D:\Users\UserC\source\repos\my-context\src\rules\entries
store version 5, published 2026-09-11T09:50:41.624Z
  the provenance of a migrated entry moves out of its body and into the `movedFrom` / `movedOn`
  fields, and the renderer discloses it to the DEVELOPER tier only. A product entry ships to every
  install, where "moved from RULE-x" names a corpus item the reader does not have and cannot fetch —
  a citation that resolves to nothing, inside the block this product says outranks every other
  source. Owner's ruling, 2026-09-11: strip it for product entries, keep it for developer ones.
```

<div dir="rtl">

**למה החותם מסרב, ולמה במפורש לא.** <span dir="ltr">`assertStoreWritable`</span> זורק
<span dir="ltr">`StoreDamagedError`</span> על כל ניסיון כתיבה כל עוד המאגר חולק על המניפסט שלו —
אבל הערת התיעוד של מחלקת השגיאה עצמה מותחת קו חד: *"הוא מסרב ל**כתיבות בלבד**.
<span dir="ltr">`loadRules`</span> לעולם אינו קורא לזה ואסור לו לעולם לקרוא: חסימת קריאות מענישה
משתמש על התקנה פגומה שהוא עדיין יכול להתאושש ממנה, וכלי שהפסיק לענות הוא כזה שהוא אינו יכול
להתאושש ממנו בכלל. זו נעילת בטיחות, לא לקיחת בן ערובה."* מאגר פגום עדיין מוסר מה שהוא יכול
לפענח; הוא פשוט לא יקבל עריכות דרך מסלול התחזוקה.

### החותם נבדק בכל דלת נכון ל-2026-09-14, ו-<span dir="ltr">`--restore`</span> נגיש עכשיו

שתי המגבלות למטה היו אמיתיות ונרשמות כפי שהיו, כי התיקון קריא רק מולן.

**נהג להיות שדבר לא התייעץ עם המניפסט אלא אם אדם ביקש.** ל-<span dir="ltr">`verifyManifest`</span>
היה בדיוק קורא אחד ב-<span dir="ltr">`src/`</span> מחוץ לצמד
<span dir="ltr">`assertStoreWritable`/`writeEntry`</span> שמיועד לתחזוקה בלבד —
<span dir="ltr">`cmdRulesVerify`</span>, פקודת שורת פקודה שאדם בוחר להריץ. שום hook, שום דלת,
שום בדיקת <span dir="ltr">`doctor`</span> ושום שלב CI לא התייעצו איתו, ו-
<span dir="ltr">`loadRules`</span> עושה <span dir="ltr">`readdirSync`</span> לתיקיית הרשומות
ועדיין לעולם אינו שואל את המניפסט, ולכן **כל <span dir="ltr">`.md`</span> שהושלך לתוך
<span dir="ltr">`src/rules/entries/`</span> פוענח ונמסר כקבוע שולט** בלי שנאמר עליו דבר. דוח 6
הוכיח את זה בעותק טיוטה: <span dir="ltr">`verifyManifest`</span> דיווח על
<span dir="ltr">`evil.md`</span> כ-<span dir="ltr">`unexpected`</span> ו-
<span dir="ltr">`loadRules`</span> מסר אותו (<span dir="ltr">`store/6`</span>).

**מה שהשתנה הוא הדלת, לא נתיב הקריאה.** <span dir="ltr">`deliverAtDoor`</span> קורא עכשיו ל-
<span dir="ltr">`renderStoreIntegrity(dir)`</span> (<span dir="ltr">`src/rules/deliver.ts`</span>)
ומקדים את התוצאה, ולכן לכל תחילת סשן, שחזור-אחרי-כיווץ ותחילת תת-סוכן נאמר כשהרשומות שנמסרות לו
חולקות על המניפסט — נקוב קובץ אחר קובץ, בדרך ש-<span dir="ltr">`renderRefusals`</span> כבר נוקב
ברשומה שלא נטענה. **גילוי אינו חסימה, והפסיקה למעלה ללא נגיעה**: כל רשומה עדיין נטענת ועדיין
נמסרת, כולל בלתי צפויות, כי *"חסימת קריאות מענישה משתמש על התקנה פגומה שהוא עדיין יכול להתאושש
ממנה."* <span dir="ltr">`loadRules`</span> עדיין לעולם אינו קורא ל-
<span dir="ltr">`verifyManifest`</span>. עלות על המאגר הנשלח בן 15 הרשומות: **p50 1.74
מילישניות, p95 2.77 מילישניות** לדלת (נמדד 2026-09-14, מול המאגר כפי שעמד באותו יום; לא נמדד
מחדש למעבר הזה, והמאגר גדל מאז ל-16 רשומות).

זה דרש פיצול של <span dir="ltr">`src/rules/integrity.ts`</span> מתוך
<span dir="ltr">`manifest.ts`</span>. <span dir="ltr">`test/rules/budget.test.ts`</span> אוסר על
<span dir="ltr">`store.ts`</span> ועל <span dir="ltr">`deliver.ts`</span> להגיע למודול שמחזיק
את התקציב — *"התקנה של משתמש **לעולם** אינה מסרבת על גודל"* — ובעוד שהאימות חי לצד התקציב,
השער ההוא גם אסר על דלת אי פעם לשאול אם הרשומות שלה הן אלה שנשלחו. קריאת המניפסט היא קריאה
שדלת רשאית לעשות; התקציב, שלב הפרסום וכל כתיבה נשארים ב-<span dir="ltr">`manifest.ts`</span>
ונשארים בלתי נגישים מהמסירה. השער ללא שינוי, עדיין עובר, ועכשיו גם נוקב ב**סמלים** של התקציב,
ולכן העברתם ל-<span dir="ltr">`integrity.ts`</span> הייתה נכשלת ולא הולכת בשקט.

**<span dir="ltr">`rules verify --restore`</span> לא היה יכול להגיע ל-
<span dir="ltr">`restoreEntries`</span>.** <span dir="ltr">`cmdRulesVerify`</span> הקצה את שני
השמות מאותה פונקציה:

</div>

```ts
const packageStore = entriesDir();
const store = entriesDir();
```

<div dir="rtl">

ואז שמר על השחזור ב-<span dir="ltr">`path.resolve(packageStore) !== path.resolve(store)`</span>,
שהיה **תמיד שקר**. הוא הדפיס את התשובה הישרה במקום, והמקור תייג זאת ככזו — *"ממצא ולא יכולת"*:

> <span dir="ltr">`nothing was restored: the store being verified IS the installed package (<dir>), so there is no second copy here to restore from. Reinstall the package to put back what shipped.`</span>

**השם השני הוא עכשיו <span dir="ltr">`storeDir()`</span>**, ה-
<span dir="ltr">`resolveStoreDir()`</span> של הדלת עצמה — התיקון
<span dir="ltr">`store/8`</span> למטה — ולכן השניים שונים בכל פעם ש-
<span dir="ltr">`MYCONTEXT_RULES_DIR`</span> מוגדר, ו-<span dir="ltr">`restoreEntries`</span>
מעתיק את הרשומות שנשלחו לתוך התיקייה ההיא ונוקב (לעולם לא מוחק) בכל דבר שהחבילה אינה מזהה. כשהמשתנה
לא מוגדר שניהם עדיין מתפענחים לחבילה והמשפט הישר למעלה הוא עדיין מה שמודפס, וזה נכון: עדיין אין
עותק שני על המכונה, והמאגר בצד סביבת העבודה שהמפרט דוחה לשלב 2 הוא עדיין הדבר שהיה מספק אחד.

**ההשלכה ל-<span dir="ltr">`StoreDamagedError`</span>:** התרופה שלו נוקבת ב-
<span dir="ltr">`mycontext rules verify --restore`</span>, שהוא עכשיו ענף שיכול לירות — אבל רק
עבור מאגר מוחלף. עבור מאגר *מותקן* פגום התרופה שעובדת היא עדיין **להתקין מחדש את החבילה**, וזה
מה שהפקודה אומרת.

יש סירוב שני ו*שונה* שמודול המניפסט מממש ונזהר להבחין בינו לבין סירוב הנזק: סירוב **תקציב** בזמן
פרסום (<span dir="ltr">`planPublish`/`publishStore`</span>), שבודק את גודל הבתים הכולל של דרג ה-
<span dir="ltr">`product`</span> מול ברירת מחדל של 20,000 בתים
(<span dir="ltr">`DEFAULT_BUDGET_BYTES`</span>) ומסרב לפרסם גרסת מאגר חדשה שחורגת ממנה — כי, לפי
המפרט, *"הכול במאגר מוזרק, בלי יוצא מן הכלל"* בהתקנה של משתמש, ולכן משתמש לעולם לא צריך לראות
סירוב תקציב שנגרם מהמאגר של הפרויקט הזה עצמו שגדל. השער הזה קיים רק במסלול הפרסום (שכרגע לא
נקרא בייצור), לא בשום דבר שצרכן אי פעם מריץ.

## מסירה מול קביעה — הדלתות, במדויק

התדריך קובע: נמסר ב-<span dir="ltr">`session-start`</span> וב-
<span dir="ltr">`subagent-start`</span>; נקבע ב-<span dir="ltr">`pre-compact`</span> וב-
<span dir="ltr">`pre-tool-use`</span>. אומת במדויק, ב-grep ובקריאת כל hook:

</div>

```
$ grep -rn "deliverAtDoor\|assertDoor" src/hooks/*.ts     # re-run 2026-09-17
src/hooks/pre-compact.ts:13:import { assertDoor } from '../rules/deliver.ts';
src/hooks/pre-compact.ts:225:    const missedStore = assertDoor(ws.projectRoot, sessionId);
src/hooks/pre-tool-use.ts:18:import { assertDoor } from '../rules/deliver.ts';
src/hooks/pre-tool-use.ts:708:    return assertDoor(root, key);
src/hooks/session-start.ts:9:import { deliverAtDoor } from '../rules/deliver.ts';
src/hooks/session-start.ts:134:    const delivered = deliverAtDoor({
src/hooks/subagent-start.ts:7:import { deliverAtDoor } from '../rules/deliver.ts';
src/hooks/subagent-start.ts:319:    const delivered = deliverAtDoor({
```

<div dir="rtl">

**הבלוק הזה היה קודם מיושן וסותר את עצמו** — גרסה מוקדמת יותר הציגה
<span dir="ltr">`session-start.ts:130`</span> ו-<span dir="ltr">`subagent-start.ts:316`</span>
עם הטקסט <span dir="ltr">`return deliverAtDoor({...`</span> /
<span dir="ltr">`const store = deliverAtDoor({...`</span>, בעוד שהפרוזה למטה (נכון, בשתי הפעמים)
ציטטה את <span dir="ltr">`:134`</span> ואת <span dir="ltr">`:319`</span> עם שם המשתנה האמיתי,
<span dir="ltr">`delivered`</span>. ראיות "אומת במדויק" מודבקות של פרק שחולקות על הפרוזה של
עצמו שלוש פסקאות אחר כך הן הצורה המסוכנת ביותר שנתון מיושן יכול ללבוש, כי ההדבקה נקראת כהוכחה
ומפרקת מנשקו קורא שאחרת היה מפקפק בפרוזה. הפקודה למעלה היא פלט אמיתי ולא ערוך מהמאגר הזה כפי
שהוא עומד; שורות ה-<span dir="ltr">`import`</span> כלולות כי זה מה שהפקודה באמת מדפיסה, לא
קוצצו לשם הסדר.

**מסירה** (<span dir="ltr">`deliverAtDoor`</span>, <span dir="ltr">`src/rules/deliver.ts`</span>)
מרנדרת את טקסט הכללים המלא, המסונן לפי דרג, ומוסרת אותו למודל. היא נקראת מבדיוק שני קובצי hook:
- <span dir="ltr">`session-start.ts`</span> — עבור סשן חדש לגמרי או מחודש
  (<span dir="ltr">`door: 'session-start'`</span>), *וגם* עבור הסשן שבא אחרי כיווץ
  (<span dir="ltr">`door: 'compact-restore'`</span>, כש-<span dir="ltr">`options.source === 'compact'`</span>).
  שניהם אותו קובץ hook; תווית הדלת רק משתנה עם הטריגר.
- <span dir="ltr">`subagent-start.ts`</span> — כל תת-סוכן מקבל מסירה מלאה משלו,
  <span dir="ltr">`door: 'subagent-start'`</span>.

טיפוס ה-<span dir="ltr">`Door`</span> עצמו (<span dir="ltr">`src/rules/delivered.ts:165`</span>)
הוא איחוד סגור — <span dir="ltr">`'session-start' | 'compact-restore' | 'subagent-start' | 'manual'`</span>
— וההערה שלו קובעת ישירות: *"<span dir="ltr">`pre-compact`</span> **אינו** כאן, וההיעדר שלו הוא
מדידה ולא פספוס."*

**<span dir="ltr">`'manual'`</span> הוא חבר בטיפוס ששום דבר במוצר לעולם אינו כותב.**
ל-<span dir="ltr">`deliverAtDoor`</span> יש בדיוק שני קוראים ב-<span dir="ltr">`src/`</span> ואף
אחד מהם אינו יכול לפלוט אותו: <span dir="ltr">`session-start.ts:134`</span> פולט
<span dir="ltr">`'compact-restore' | 'session-start'`</span>,
<span dir="ltr">`subagent-start.ts:319`</span> פולט <span dir="ltr">`'subagent-start'`</span>.
שום שורת מסירה ב-<span dir="ltr">`.rules/delivered.jsonl`</span> מעולם לא נשאה
<span dir="ltr">`door: 'manual'`</span> ממסלול מוצר. (ה-<span dir="ltr">`'manual'`</span> ש*כן*
נורה הוא **אירוע הזרקת הקורפוס** של <span dir="ltr">`core/inject.ts`</span> — מנגנון אחר, טיפוס
אחר, וה-skill <span dir="ltr">`/LoadMyContext`</span> מגיע לזה, לא לזה.) חבר האיחוד הוא משטח
שמור, לא התנהגות מתוארת.

**קביעה** (<span dir="ltr">`assertDoor`</span> ←
<span dir="ltr">`assertDelivered`</span>, <span dir="ltr">`src/rules/delivered.ts`</span>) אינה
מוסרת דבר. היא בודקת אם למפתח הסשן/תת-הסוכן הנוכחי כבר יש שורת מסירה רשומה בפנקס, ואם לא, מייצרת
משפט "דלת שהוחמצה". היא נקראת מבדיוק שני מקומות:
- <span dir="ltr">`pre-compact.ts:225`</span> — ממש לפני כיווץ, כדי לתפוס סשן שאיכשהו מעולם לא
  קיבל את המסירה הפותחת שלו.
- <span dir="ltr">`pre-tool-use.ts:708`</span> — ה-hook המוקדם ביותר שרץ *אחרי* כל דלת. **לא בכל
  קריאה לכלי**: <span dir="ltr">`PreToolUse`</span> רשום ב-<span dir="ltr">`hooks/hooks.json`</span>
  עם matcher <span dir="ltr">`Read|Edit|MultiEdit|Write|NotebookEdit|Agent`</span>, ולכן הוא נורה
  על שישה שמות כלים. קריאת <span dir="ltr">`Bash`</span> אינה מגיעה אליו.

**לאן הולך משפט ה"דלת שהוחמצה" אינו לתוך ההקשר של המודל.**
<span dir="ltr">`pre-tool-use.ts:747`</span> כותב אותו עם
<span dir="ltr">`process.stderr.write`</span> — הוא מופנה לאדם בטרמינל, לא לסוכן, וזו הסיבה שדלת
שהוחמצה היא דבר שאדם מבחין בו ולא דבר שנאמר לסשן.

**שני דברים על קובץ הפנקס עצמו**, שניהם חדשים ב-2026-09-13 (<span dir="ltr">`dc0f14fb`</span>)
או לא נאמרו קודם:

- **השורות של טסט הולכות לקובץ אח.** <span dir="ltr">`deliveredFile(root)`</span> מחזיר
  <span dir="ltr">`.rules/delivered.test.jsonl`</span> כש-<span dir="ltr">`isTestProcess()`</span>
  — פרדיקט, לא פרמטר, "כי פרמטר הוא דבר שקורא מעביר, וכל קורא ששוכח אותו כותב שורת ייצור שהיא
  שקר." <span dir="ltr">`recordDelivery`</span>, <span dir="ltr">`deliveries`</span>,
  <span dir="ltr">`wasDelivered`</span> ו-<span dir="ltr">`assertDelivered`</span> כולם מסתעפים
  באותה דרך. הוא ממופתח על <span dir="ltr">`NODE_TEST_CONTEXT`</span> של Node, שמריץ הטסטים
  מגדיר וכל ילד יורש, ולכן שום טסט אינו יכול לבחור לא להיות מסומן ושום hook ש-Claude Code מריץ
  אינו יכול להיות מסומן בטעות. מה שהוא במכוון **אינו** מכסה נאמר בקול רם: מריץ שאינו
  <span dir="ltr">`node --test`</span> (סוויטת Playwright תחת <span dir="ltr">`e2e/`</span>, או
  בדיקה שמורצת ביד) אינו מסומן. 157 שורות מזהמות נמדדו ב-2026-09-13 וכולן פרט לאחת היו
  <span dir="ltr">`node --test`</span>.
- **היומן תחום.** <span dir="ltr">`MAX_ROWS = 5000`</span>
  (<span dir="ltr">`delivered.ts:233`</span>) גוזם את הקובץ; הוא רק-מוסיף ונקרא בספירה, כש-
  <span dir="ltr">`.audit/`</span> היא התקדים שלו, כולל ה-<span dir="ltr">`*`</span> ב-.gitignore.

ההערה של <span dir="ltr">`pre-compact.ts`</span> עצמו מיישבת את מה שעשוי להיראות כסתירה: הוא אינו
מוסר בעצמו, כי הסשן שבא אחרי הכיווץ (<span dir="ltr">`SessionStart(source: 'compact')`</span>)
כבר הוא דלת וכבר מוסר — קביעה ב-<span dir="ltr">`pre-compact`</span> ומסירה ב-
<span dir="ltr">`session-start`</span> ה*בא* הם שני רגעים שונים שמשרתים את אותה ערובה, לא שתי
מסירות של אותו דבר.

הרשומה <span dir="ltr">`def-a-door`</span> עצמה נותנת את הסיבה שההבחנה הזו קיימת בכלל — שום דבר
אינו יכול לבחון את חלון ההקשר של מודל, ולכן *"מה שניתן לאימות הוא שהזרקנו בכל דלת ושאף אחת לא
הוחמצה — ספירה ולא הבטחה."* מסירה כותבת שורה; קביעה קוראת לחיפוש היעדר השורה. ההערה המורחבת של
<span dir="ltr">`deliver.ts`</span> עצמו (בלוק גדול, נשמר במכוון ולא נקרא, סביב מנגנון "תיקון"
היפותטי באמצע סשן) מסבירה שלוש עלויות קונקרטיות נפרדות של הפיכת
<span dir="ltr">`PreToolUse`</span> לדלת מסירה במקום לנקודת קביעה — ערוץ מודל סגור, החזקת בתי
"לפני" מיושנים בנתיב החם, והשחתת ספירת ה"דלת שהוחמצה" עצמה ש-<span dir="ltr">`assertDoor`</span>
קיים כדי לייצר — ומתיישבת על כך שקביעה היא הצורה הנכונה, מגובה בעלות מדודה של
<span dir="ltr">`p50 0.371 ms / p95 0.503 ms`</span> למסלול הקביעה במאגר הזה.

**מקרה שימוש:** תת-סוכן משוגר באמצע סשן. הוא מקבל חלון הקשר טרי בלי זיכרון של מה שנאמר לסשן
ההורה שלו — <span dir="ltr">`subagent-start`</span> מוסר מחדש את טקסט הכללים המלא לתוך החלון
הטרי ההוא, כי (לפי <span dir="ltr">`def-a-door`</span>, בציטוט המדידה שלו עצמו) *"1,082 התחלות
תת-סוכן מול 54 התחלות סשן ב-36,024 רשומות — ולכן עיצוב ששומר רק על תחילת סשן שומר על האירוע
הנדיר ביותר."*

## עדיפות על הקורפוס, וזיהוי סתירות

כל בלוק שנמסר נושא פתיח קבוע שקובע מה הוא (<span dir="ltr">`PREAMBLE`</span> ב-
<span dir="ltr">`deliver.ts`</span>) ומשפט עדיפות קבוע (<span dir="ltr">`PRECEDENCE`</span>),
שנמסר בין אם נמצאה סתירה ובין אם לא:

> *"קבוע מוצר גובר על כל מקור אחר, כולל הקורפוס של הפרויקט הזה עצמו — הוא קובע איך הכלי מתנהג,
> וזה נכון מה שלא יירשם עליו. היכן שאחד חולק על פריט שאתם גם מחזיקים, הקבוע שולט וההסכמה נקובה
> למטה במקום להיסגר בשתיקה."*

**תוקן 2026-09-14 (<span dir="ltr">`rulings/75`</span>), והסוגריים הם הסיבה שהציטוט הזה משוחזר
במלואו.** עד אז המשפט הסתיים ב-
<span dir="ltr">`(`STD-the-precedence-order-when-four-sources-of-truth-disagree`)`</span> — **מזהה
פריט קורפוס**, בתוך הבלוק שהמוצר אומר שגובר על כל מקור אחר, שנשלח לכל התקנה, שבה שום קורפוס של
צרכן אינו מחזיק את המזהה ההוא ושום פקודה אינה יכולה למשוך אותו: ציטוט שמתפענח לכלום, בדיוק במקום
שבו ציטוט תלוי עולה הכי הרבה. הוא נמסר עכשיו באותה דרך ש-<span dir="ltr">`movedFrom`</span> נמסר,
מאחורי רשימת היתר: <span dir="ltr">`TIERS_THAT_CITE_THE_CORPUS = ['developer']`</span>, ולכן
המצביע נשמר לקורא שיכול לפתוח את הפריט ונמנע ממי שאינו יכול. הציטוט למעלה הוא הטקסט של
ה**צרכן**. <span dir="ltr">`test/rules/consumer-citation.test.ts`</span> סורק את כל הבלוק שנמסר
לצרכן לאיתור כל מזהה בצורת קורפוס ומוכיח שהסורק יכול למצוא אחד בהרצתו על בלוק המפתחים באותו קובץ.

<span dir="ltr">`findConflicts(entries, itemIds)`</span> בודק אם מזהה של רשומת מאגר כללים שנמסרה
מתנגש (לפי "חלזון", כלומר מזהה שהוסרה ממנו כל תחילית קטגוריה <span dir="ltr">`PREFIX-`</span>)
עם מזהה פריט שכבר נמסר מהקורפוס באותו סשן — הקורא מעביר פנימה את מזהי פריטי הקורפוס שנמסרים;
מודול מאגר הכללים עצמו לעולם אינו קורא את הקורפוס, בעקביות עם כלל הבידוד למעלה.

## גילוי מקוריות: <span dir="ltr">`movedFrom`/`movedOn`</span>, נשמר לפי דרג

כמה רשומות כאן *הועברו החוצה מהקורפוס* — שלוש היו קודם פריטי קורפוס
<span dir="ltr">`RULE-`/`LESSON-`</span> שהבעלים קידם למאגר ב-2026-09-11 (נראה ב-changelog של
<span dir="ltr">`manifest.json`</span>, משוחזר למטה). רשומה שהועברה נושאת שדות
<span dir="ltr">`movedFrom`/`movedOn`</span>, אבל **האם המקוריות ההיא מוצגת לקורא תלוי בדרג**:

</div>

```ts
export const TIERS_THAT_DISCLOSE_PROVENANCE: readonly Tier[] = ['developer'];
```

<div dir="rtl">

הנימוק, מההערה של <span dir="ltr">`deliver.ts`</span>: רשומה מדרג
<span dir="ltr">`developer`</span> נקראת אי פעם רק בתוך המאגר ה*הזה*, שבו פריט הקורפוס הגנוז
שהיא נוקבת בו עדיין על הדיסק ובמרחק <span dir="ltr">`mycontext show <id>`</span> אחד — ולכן
הכותרת התחתונה היא מקוריות אמיתית. רשומה מדרג <span dir="ltr">`product`</span> נשלחת ל*כל*
התקנה, שבה אותו מזהה נוקב בפריט שהקורפוס של הקורא ההוא מעולם לא החזיק, אינו יכול למשוך, ואין לו
דרך לאמת שהיה אי פעם אמיתי — ציטוט תלוי בתוך הבלוק עצמו שטוען שהוא גובר על כל מקור אחר. לבעלים
הוצעו שלוש אפשרויות ב-2026-09-11 (להסיר עבור product, לשמור-ולתעד, או לבודד את המתקן) והוא בחר
להסיר עבור <span dir="ltr">`product`</span> בלבד — נראה ישירות בהערה של ה-changelog של המניפסט
עצמו לגרסה 5.

**v5 לא סגרה את מחלקת הפגם, רק מופע אחד שלה — והמופע השני נסגר ב-2026-09-14.** הקבוע
<span dir="ltr">`PRECEDENCE`</span> שנמסר באותו בלוק גם הסתיים במזהה קורפוס
(<span dir="ltr">`STD-the-precedence-order-when-four-sources-of-truth-disagree`</span>) ששום
התקנת צרכן לא יכלה לפענח; ראו את הסעיף למעלה לתיקון. **למה v5 פספסה אותו הוא החלק ששווה
לשמור**: הפסיקה עסקה ב**רשומה**, ולכן המנגנון שהיא ייצרה תלוי ב-
<span dir="ltr">`entry.tier`</span> — ו-<span dir="ltr">`PRECEDENCE`</span> הוא טקסט *מסגרת*,
שאינו שייך לשום רשומה ואינו נושא דרג, ולכן למנגנון ההוא לא היה על מה לפעול שם אפילו עקרונית.
הדרג של הקורא (<span dir="ltr">`RuleSet.readerTier`</span>, שמוגדר על ידי
<span dir="ltr">`loadRules`</span> מאותה שאלה שהוא כבר שאל כדי לסנן את הרשומות) הוא מה שהמסגרת
תלויה בו עכשיו.

**מה שעוצר שלישי הוא סריקה, לא החלטה להיזהר.**
<span dir="ltr">`test/rules/consumer-citation.test.ts`</span> מרנדר את מה שהתקנה של זר מקבלת —
דרך <span dir="ltr">`renderRules`</span> ודרך <span dir="ltr">`deliverAtDoor`</span> אמיתי —
וקובע ש**שום** מזהה בצורת קורפוס אינו מופיע בשום מקום בו: מסגרת, רשומות, גופים, כותרות תחתונות.
רשומת המוצר הבאה שמצטטת <span dir="ltr">`RULE-…`</span> בגוף שלה נכשלת שם, וכך גם הפסקה הבאה
שתתווסף למסגרת. אותה סריקה על בלוק המפתחים מוצאת עשרה, וזה מה שהופך את השתיקה שלה על בלוק הצרכן
לשווה משהו.

## ה-changelog המלא של המניפסט (אמיתי, מ-<span dir="ltr">`src/rules/entries/manifest.json`</span>)

</div>

<div dir="rtl">

| גרסה | תאריך | מה זז |
|---|---|---|
| 1 | 2026-09-11 06:15 | זרע: תקן המספור, ועוד 8 הגדרות <span dir="ltr">`def-*`</span> |
| 2 | 2026-09-11 06:26 | כותרות ההגדרות נכתבו מחדש כמשפטים מלאים ("מילה נפוצה אינה יכולה לשמש גם כטביעת אצבע של דליפה") |
| 3 | 2026-09-11 06:27 | <span dir="ltr">`def-lane`</span> ← <span dir="ltr">`def-a-lane`</span> ("מזהה בן שמונה תווים אינו מובחן מספיק כדי לשמש טביעת אצבע של דליפה") |
| 4 | 2026-09-11 08:40 | שלושה פריטי קורפוס נגנזו וקודמו למאגר: עובדת הקטגוריה הלא מוכרת, איסור אל-תכתבו-לעץ-המשותף, ואיסור ה-commit-לפי-נתיב |
| 5 | 2026-09-11 09:50 | המקוריות עברה מפרוזה בגוף לשדות <span dir="ltr">`movedFrom`/`movedOn`</span> הייעודיים, והגילוי הוגבל לדרג המפתחים (הפסיקה שתוארה למעלה) |

</div>

<div dir="rtl">

**ה-changelog אינו משחזר את המאגר, והפער אינו שגיאת עיגול — והוא התרחב מאז 2026-09-13.** שחזור
כל רשימת <span dir="ltr">`added`</span> מריק, לפי סדר, מניב **11** רשומות שעדיין קיימות בתיקייה
הנוכחית של **16** (חושב 2026-09-16 בהליכה על מערכי <span dir="ltr">`store.changelog`</span> ו-
<span dir="ltr">`entries`</span> של <span dir="ltr">`manifest.json`</span> עצמו — קבוצת ה-
<span dir="ltr">`added`</span> הגולמית מכילה למעשה 12 מחרוזות נבדלות, אבל אחת מהן,
<span dir="ltr">`def-lane`</span>, היא השם שלפני שינוי השם מ-v1 וכבר אינה נוקבת בשום קובץ ב-
<span dir="ltr">`src/rules/entries/`</span>, מאז ש-v3 שינתה את שמה ל-
<span dir="ltr">`def-a-lane`</span>; ספירתה כרשומה משוחזרת הייתה ספירת שם שאינו קיים היום). חמש
רשומות אינן מופיעות בשום רשימת <span dir="ltr">`added`</span>, אף פעם:

- <span dir="ltr">`numbered-options-on-a-question-put-to-the-owner`</span> — נוכחת תחת
  <span dir="ltr">`changed`</span> של v1, לעולם לא תחת <span dir="ltr">`added`</span>. (הפירוש
  של שורה 1 "תקן המספור, ועוד 8 הגדרות <span dir="ltr">`def-*`</span>" הוא מה שמסתיר את זה: תקן
  המספור הוא הרשומה, והוא אינו ב-<span dir="ltr">`added`</span> של v1.)
- <span dir="ltr">`a-fixture-must-not-be-what-makes-a-proof-pass`</span>,
  <span dir="ltr">`a-gate-that-cannot-be-shown-to-fail-is-not-a-gate`</span>,
  <span dir="ltr">`a-scanner-names-what-it-skips-not-what-it-scans`</span> — נוספו על ידי
  <span dir="ltr">`72584fd0`</span> ב-**2026-09-13**, שעדכן את
  <span dir="ltr">`entries`</span> של <span dir="ltr">`manifest.json`</span> (ולכן את
  ה-checksums שלו — <span dir="ltr">`rules verify`</span> עובר) אבל הוסיף **שום** שורת changelog.
- <span dir="ltr">`nothing-to-do-and-could-not-look-are-different-answers`</span> — נוספה
  **2026-09-15**, אותו דפוס: <span dir="ltr">`entries`</span> גדל,
  <span dir="ltr">`store.changelog`</span> לא.

המאגר עדיין מפרסם את עצמו כ**גרסה 5**, ללא שינוי מאז 2026-09-11 09:50, דרך עוד יומיים של גידול
אמיתי.

ולכן ל-<span dir="ltr">`manifest.json`</span> יש שני חצאים שעונים על שאלות שונות, ורק אחד מהם
עדכני: <span dir="ltr">`entries`</span> (16, מגובב, נכון) ו-<span dir="ltr">`store.changelog`</span>
(5 גרסאות, 11 רשומות ניתנות לשחזור, מפגר). קורא שמתייחס ל-changelog כהיסטוריה של המאגר יחסרו לו
חמש רשומות ולפחות קפיצת גרסה אחת — והפער גדל ברשומה אחת בין שתי הביקורות האחרונות של הסימוכין
הזה (2026-09-13 ← 2026-09-16), וזה עצמו ראיה שדבר אינו מייצר מחדש את ה-changelog אוטומטית ושום
דבר אינו שומר עליו מפני סחיפה נוספת.

## <span dir="ltr">`mycontext rules verify|list|show`</span> — משטח שורת הפקודה

כל השלוש לקריאה בלבד.

</div>

```
$ node src/cli/index.ts rules list
```

<div dir="rtl">

מדפיס את הטבלה שכבר שוחזרה למעלה — מזהה, סוג, דרג, כותרת, לכל רשומה שבתוקף כרגע בסביבת העבודה
הזו, עם שורת כותרת שקובעת את הספירה והאם דרג המפתחים חל כאן.

</div>

```
$ node src/cli/index.ts rules verify
my_context: the rule store is intact — every entry matches the checksum that shipped with it.
```

<div dir="rtl">

מריץ את <span dir="ltr">`verifyManifest`</span> ומדווח עובר/נכשל **מול המאגר שדלת הייתה קוראת**
— <span dir="ltr">`resolveStoreDir()`</span>, ולכן
<span dir="ltr">`MYCONTEXT_RULES_DIR`</span> מכוון אותו בדיוק כפי שהוא מכוון את הדלתות, והפקודה
אומרת כשהיא אינה מתארת את החבילה המותקנת (<span dir="ltr">`store/8`</span>). הוא גם מדפיס את
**גרסת המאגר ואת הערת ה-changelog האחרונה**, שעד 2026-09-14 רק
<span dir="ltr">`src/ui/maintenance/`</span> יכול היה לקרוא ו-<span dir="ltr">`package.json`</span>
מחריג את זה מהחבילה המפורסמת (<span dir="ltr">`store/9`</span>).
<span dir="ltr">`--restore`</span> נורה רק כששתי התיקיות שונות; כשהמשתנה לא מוגדר הוא עדיין אומר
זאת בשם ("nothing was restored… Reinstall the package"). ראו "החותם נבדק בכל דלת" למעלה.
<span dir="ltr">`restoreEntries`</span> עצמו, כשקיים עותק שני לשחזר ממנו, מעתיק את הרשומות
שנשלחו בחזרה ונוקב — לעולם לא מוחק — בכל קובץ שהחבילה אינה מזהה.

</div>

```
$ node src/cli/index.ts rules show <id>
```

<div dir="rtl">

מרנדר רשומה אחת במלואה. **סדר הכותרת הוא <span dir="ltr">`id · kind · tier`</span> ראשון, הכותרת
בשורה השנייה** — אומת חי מול
<span dir="ltr">`rules show an-unknown-category-means-a-possible-wrong-corpus`</span> — ואז כל
חלק בסדר התבנית, ואז פרוזת הגוף, ו — רק לרשומות שיש להן אחת ורק בדרג המפתחים — כותרת המקוריות
התחתונה. הוא גם מדפיס את שדה ה-<span dir="ltr">`request`</span> כשהוא נוכח, מתויג "asked for as
(verbatim, never injected)" — מילותיו של הבעלים עצמו, שנשמרות לתיעוד אבל, לפי הערת הסכמה, "לעולם
לא מוזרקות" לשום מסירה ממשית.

## הרשומות במלואן

כל אחת עם פלט ה-<span dir="ltr">`rules show`</span> שלה, **מקוצץ**: הבלוקים למטה משמיטים את זנב
ה-<span dir="ltr">`check:`</span> ואת רוב פרוזת הגוף כדי לשמור על הפרק קריא, אז קראו אותם כצורה
ולא כרשומה כולה. הריצו <span dir="ltr">`rules show <id>`</span> לטקסט המלא. שלוש הרשומות שנוספו
ב-2026-09-13 (<span dir="ltr">`a-fixture-must-not-be-what-makes-a-proof-pass`</span>,
<span dir="ltr">`a-gate-that-cannot-be-shown-to-fail-is-not-a-gate`</span>,
<span dir="ltr">`a-scanner-names-what-it-skips-not-what-it-scans`</span>) **אינן משוחזרות כאן**;
הן מנויות בטבלת <span dir="ltr">`rules list`</span> למעלה.

### 1. <span dir="ltr">`an-unknown-category-means-a-possible-wrong-corpus`</span> — <span dir="ltr">`fact`</span> · **<span dir="ltr">product</span>**

הרשומה ה*יחידה* שכל התקנת צרכן אי פעם רואה.

</div>

```
an-unknown-category-means-a-possible-wrong-corpus · fact · product
an unknown-category error may mean the wrong corpus, not a misspelled flag

  truth: categories are per-corpus configuration, so a name valid in one corpus is invalid in
  another. The refusal names the accepted list and never names the corpus it consulted, so one
  message carries two meanings.
  breaks: the flag gets respelled until something is accepted, against a corpus that was never the
  intended one — and the write lands somewhere nobody is looking.
  example: check which `.my_context` answered before changing the spelling of the flag.
  check: none - the refusal would have to name the corpus it consulted for this to be checkable,
  and it does not.
```

<div dir="rtl">

הועברה מפריט הקורפוס
<span dir="ltr">`RULE-read-an-unknown-category-error-as-a-possible-wrong-corpus`</span>
ב-2026-09-11 (המקוריות אינה מוצגת כאן מכיוון שזהו דרג המוצר).

**מקרה שימוש:** אתם מריצים <span dir="ltr">`mycontext add badcategory "..."`</span> ומקבלים סירוב
שמונה קטגוריות מקובלות. לפני שאתם מאייתים מחדש את שם הקטגוריה, בדקו *איזו* תיקיית
<span dir="ltr">`.my_context`</span> ענתה — אתם אולי בסביבת עבודה מקוננת של הפרויקט הלא נכון,
ושום כמות של איות נכון אינה מתקנת את זה.

### 2. <span dir="ltr">`commit-with-a-pathspec`</span> — <span dir="ltr">`prohibition`</span> · <span dir="ltr">developer</span>

</div>

```
commit-with-a-pathspec · prohibition · developer
the dispatching session commits by explicit path, never by the shared index

  prohibition: with a lane running, never `git commit` bare and never stage the whole index — use
  `git commit -- <paths>`, or read `git diff --cached` first and know what is in it.
  why: the index is shared with every lane on the machine. A bare commit takes whatever is staged,
  including work a lane staged for a different subject, and the commit message then describes a
  change it does not contain.
  example: a bare `git commit` on 2026-09-09 swept another lane's staged work into a commit about
  a table border.
  check: none - git offers no hook that can tell a deliberate pathspec from a lucky one.
```

<div dir="rtl">

זהו בדיוק הזיכרון שסשן המשתמש כבר נושא
(<span dir="ltr">`commit-stages-the-shared-index-not-my-paths`</span>) — זהו אותו כלל, שנשלח
עכשיו כרשומת <span dir="ltr">`developer`</span> במאגר המוצר ולא חי רק כהערת זיכרון אישית. הועבר
מפריט הקורפוס
<span dir="ltr">`LESSON-stage-what-an-agent-reported-touching-not-what-you-told-it`</span>.

**מקרה שימוש:** בזמן כתיבת משימת התיעוד הזו ממש, ארבעה נתיבים אחרים דווחו כפעילים במאגר הזה.
ביום עם <span dir="ltr">`git commit -- docs/capabilities/10-rule-store.md`</span> ולא
<span dir="ltr">`git commit`</span> חשוף הוא הכלל הזה מיושם ישירות.

### 3. <span dir="ltr">`def-a-door`</span> — <span dir="ltr">`definition`</span> · <span dir="ltr">developer</span>

כבר צוטטה למעלה במלואה ("הדלתות: במדויק"). זו הרשומה שמגדירה את אוצר המילים שמנגנון
המסירה/הקביעה עצמו בנוי עליו.

### 4. <span dir="ltr">`def-a-lane`</span> — <span dir="ltr">`definition`</span> · <span dir="ltr">developer</span>

</div>

```
def-a-lane · definition · developer
a lane is one delegated subagent, with its own context window and its own brief

  means: one delegated subagent, dispatched with a written brief, that owns one unit of work and
  reports back. It runs in its own process with its own context window, it is told which files it
  may touch, and it commits nothing — the dispatching session commits, staging by explicit path.
  confusedWith: a thread, and a task. ... A task is the corpus ITEM that says what is to be done;
  a lane is who does it, and one task may be worked by several lanes over several days.
  example: measured in this workspace on 2026-09-11, the archive holds 304 lane transcripts
  against 2 session transcripts.
```

<div dir="rtl">

**מקרה שימוש:** הפרק הזה ממש נכתב על ידי fork/נתיב ששוגר עם תדריך שנוקב בדיוק בקובץ אחד שהוא
מחזיק (<span dir="ltr">`docs/capabilities/10-rule-store.md`</span>) — ההגדרה של הרשומה הזו עצמה
מתארת את המנגנון שייצר אותו.

### 5. <span dir="ltr">`def-known-red`</span> — <span dir="ltr">`definition`</span> · <span dir="ltr">developer</span>

</div>

```
def-known-red · definition · developer
known-red means already failing at HEAD, counted, and recorded with a reason

  means: a test or gate that was ALREADY failing before your change — verified at HEAD, counted,
  and recorded with the reason it is red. The point of the label is the count: if the baseline is
  eleven, any twelfth failure is yours.
```

<div dir="rtl">

הפניה צולבת: [פרק 13](./13-testing-discipline.he.md) מכסה את משמעת הבדיקות שהמונח הזה שייך לה.

### 6. <span dir="ltr">`def-prove-by-removal`</span> — <span dir="ltr">`definition`</span> · <span dir="ltr">developer</span>

</div>

```
def-prove-by-removal · definition · developer
proving by removal breaks the line an assertion rests on and watches that assertion go red

  means: proving one assertion by BREAKING exactly the line it rests on, watching THAT assertion
  go red — identified by the failing stack's line number, not by the test's name — and then
  writing the original bytes back. One mutation per assertion.
  example: on 2026-09-10 a harness reported the `test(...)` declaration line for helper-wrapped
  tests, so three separate mutations all looked like one line.
```

<div dir="rtl">

זו ההגדרה המדויקת מאחורי "הוכחות הסרה, אחת לכל קביעה" של [פרק 13](./13-testing-discipline.he.md).

### 7. <span dir="ltr">`def-spill`</span> — <span dir="ltr">`definition`</span> · <span dir="ltr">developer</span>

</div>

```
def-spill · definition · developer
a spill is a candidate that did not fit its budget, and is recorded with the reason

  means: an item that was an eligible candidate for injection and did not fit its tier's budget.
  It is RECORDED with the reason that refused it (`Selection.spilled`), never dropped.
  example: the pinned tier oversubscribed by twelve items, one of which spilled 482 times.
```

<div dir="rtl">

זהו המונח המדויק ש-[פרק 2](./02-injection.he.md) מתעד מכנית כחלק מאלגוריתם התקציב/ה-first-fit
של ההזרקה — קראו את הרשומה הזו לאוצר המילים, ואת הפרק ההוא למנגנון.

### 8. <span dir="ltr">`def-stand-down`</span> — <span dir="ltr">`definition`</span> · <span dir="ltr">developer</span>

</div>

```
def-stand-down · definition · developer
standing an item down clears the fields that make it reach a context window

  means: retiring an item also clears the fields that make it reach a context window — `always`
  back to false, `severity` back to soft — in the SAME act as the retirement, and writes an
  observation on the item recording what moved and why it is quiet now.
  example: `supersedeItem` computes `standDownFields` BEFORE it assigns the new status.
```

<div dir="rtl">

זהו המנגנון מאחורי קשתות ההחלפה של [פרק 3](./03-creation-and-gates.he.md) — פריט גנוז אינו יכול
להמשיך לשלוט בטעות.

### 9. <span dir="ltr">`def-the-corpus`</span> — <span dir="ltr">`definition`</span> · <span dir="ltr">developer</span>

</div>

```
def-the-corpus · definition · developer
the corpus is the Markdown under .my_context/items, and it is the source of truth

  means: this project's knowledge as Markdown files under `.my_context/items/**` — one file per
  item, frontmatter plus body. The FILES are the source of truth; the SQLite index beside them is
  derived, and can be thrown away and rebuilt from disk without losing anything.
  example: INV-markdown-is-the-source-of-truth, and 1,085 item files in this workspace on
  2026-09-11.
```

<div dir="rtl">

זו האמירה מחדש הקנונית והתמציתית של קביעת הפתיחה של [פרק 1](./01-items-and-corpus.he.md) — והיא
עצמה ההוכחה שהבידוד של המאגר מהקורפוס מכוון: המשפט המגדיר של הקורפוס עצמו נשלח כרשומת *מאגר
מוצר*, ולא כפריט קורפוס.

### 10. <span dir="ltr">`def-the-ration`</span> — <span dir="ltr">`definition`</span> · <span dir="ltr">developer</span>

כבר צוטטה למעלה במלואה. זהו המונח שהלולאה המשפרת את עצמה הבנויה-אך-כבויה של
[פרק 11](./11-self-improvement-loop.he.md) בנויה סביבו:
<span dir="ltr">`maxProposalsPerPass`</span> (כרגע 0) ו-<span dir="ltr">`queueCeiling`</span>
(15).

### 11. <span dir="ltr">`never-a-git-command-that-writes-the-shared-tree`</span> — <span dir="ltr">`prohibition`</span> · <span dir="ltr">developer</span>

כבר צוטטה במלואה למעלה; הכלל עם רדיוס הנזק הרחב ביותר בכל המאגר, ואב הקדמון בקורפוס של מוסכמת
"לעולם לא <span dir="ltr">`git add -A`</span>" של המאגר הזה עצמו (נראה בהנחיות הכלים הצמודות
ל-CLAUDE.md ברמה העליונה שמצוטטות במקום אחר בפרויקט הזה).

### 12. <span dir="ltr">`numbered-options-on-a-question-put-to-the-owner`</span> — <span dir="ltr">`standard`</span> · <span dir="ltr">developer</span>

כבר צוטטה במלואה למעלה. בולטת כמדידה העצמית של המאגר עצמו: על פני 2,657 תורי עוזר בתמלילים של
סביבת העבודה הזו, 108 שאלות הוצגו לבעלים, ו**אפס** עקבו אחר צורת האפשרויות-הממוספרות/ההמלצה
המסומנת לפני שהתקן הזה היה קיים — מספר אמיתי על הפער בין "נרשם כהעדפה" לבין "באמת מצייתים לו",
שמוצג ברשומה עצמה כטיעון לכך שכל המאגר קיים.

## מה **לא** בנוי / בנוי אך כבוי

- **טופס ממשק התחזוקה** שהערת הסכמה מתארת ("שלב 3… נדרש לגזור את השדות שלו מ-
  [<span dir="ltr">`TEMPLATE`</span>]") מוזכר לאורך <span dir="ltr">`schema.ts`</span> כצרכן
  מתוכנן של טבלת התבנית, אבל שום דבר בחקירה הזו לא מצא מסך תחזוקה נשלח ומחווט לכתיבת רשומות מאגר
  כללים ביד מחוץ לעריכה ישירה של קובצי ה-Markdown — כתבו רשומות חדשות בכתיבת קובץ
  <span dir="ltr">`.md`</span> שתואם את הסכמה ובעדכון המניפסט, ולא דרך ממשק.
- **מנגנון ה"תיקון" באמצע סשן** (<span dir="ltr">`renderCorrection`</span>,
  <span dir="ltr">`correctionAtDoor`</span>, <span dir="ltr">`SESSION_SCOPE_DOORS`</span> ב-
  <span dir="ltr">`deliver.ts`</span>) בנוי במלואו ויש לו קובץ טסט משלו
  (<span dir="ltr">`test/rules/update-correction.test.ts`</span>, שתים־עשרה קביעות לפי ההערה) אבל
  הוא נקרא על ידי **שום דבר** בייצור. פסיקת הבעלים, מצוטטת ישירות בקוד, היא שזהו מצב סופי מכוון,
  לא צעד לא גמור — הוא קיים כך ש*אם* כלי התחזוקה אי פעם יישלח ומאגר ישתנה באמצע סשן, המכניקה כבר
  בדוקה ואין צורך לגזור אותה מחדש. עד אז, עדכון מאגר תחת סשן רץ פשוט אינו צף באמצע סשן; הדלת
  הטרייה הבאה (סשן חדש, או תת-סוכן) קולטת אותו.
- **סירוב תקציב בזמן פרסום** (<span dir="ltr">`DEFAULT_BUDGET_BYTES = 20_000`</span>,
  <span dir="ltr">`planPublish`</span>, <span dir="ltr">`publishStore`</span>) קיים ונבדק אבל,
  לפי ההערה שלו עצמו, "שום דבר שמשתמש מריץ אינו מתייעץ איתו" — הוא שער בזמן-תחזוקה-בלבד על גודל
  דרג ה-<span dir="ltr">`product`</span>, בלתי נראה לכל התקנת צרכן.
- כלי הקורפוס עצמו (<span dir="ltr">`doctor`</span>, <span dir="ltr">`list`</span>,
  <span dir="ltr">`ready`</span>, דעיכה, בורר ההזרקה) בנויים *במכוון* כך שלא ידעו דבר על המאגר
  הזה כלל — זה אינו פער, זה הבידוד שכל העיצוב טוען בעדו, ו-
  <span dir="ltr">`test/rules/isolation.test.ts`</span> קיים במיוחד כדי לשמור על זה.
- ~~**שום דבר אינו מאמת את החותם אוטומטית**~~ — **נסגר 2026-09-14
  (<span dir="ltr">`store/6`</span>)**: כל דלת קוראת עכשיו ל-
  <span dir="ltr">`renderStoreIntegrity`</span> ונוקבת ברשומה לא רשומה או שהשתנתה בבלוק שהיא
  מוסרת. <span dir="ltr">`loadRules`</span> עדיין לעולם אינו שואל את המניפסט, ו-
  <span dir="ltr">`.md`</span> לא רשום עדיין **נמסר** — גילוי אינו חסימה — אבל הוא כבר לא נמסר
  בשקט. עדיין פתוח: **שום דבר אינו מריץ <span dir="ltr">`mycontext rules verify`</span> כשער** —
  לא hook, לא <span dir="ltr">`doctor`</span>, לא CI. החצי ההוא שייך לנושא "שער שאינו שער"
  (**D71**) ול-<span dir="ltr">`doctor`</span>, שה-<span dir="ltr">`checks.ts`</span> שלו היה של
  נתיב אחר אחר הצהריים ההוא.
- ~~**<span dir="ltr">`rules verify --restore`</span> הוא קוד בלתי ניתן להגעה**~~ — **ניתן להגעה
  נכון ל-2026-09-14 (<span dir="ltr">`store/8`</span>)** בכל פעם ש-
  <span dir="ltr">`MYCONTEXT_RULES_DIR`</span> נוקב במאגר אחר משל החבילה. התרופה של
  <span dir="ltr">`StoreDamagedError`</span> יכולה עכשיו לירות; עבור מאגר *מותקן* פגום התשובה היא
  עדיין להתקין מחדש, והפקודה אומרת זאת.
- ~~**אין מסלול MCP למאגר הכללים כלל — <span dir="ltr">`rules verify|list|show`</span> הן
  רק-שורת-פקודה.**~~ **שקר, ותוקן 2026-09-16.** <span dir="ltr">`list_rules`</span> ו-
  <span dir="ltr">`verify_rules`</span> הם כלי MCP אמיתיים ורשומים
  (<span dir="ltr">`src/mcp/tools/rule-store.ts`</span>), ו-<span dir="ltr">`list_rules(id)`</span>
  ספציפית מכסה את <span dir="ltr">`rules show`</span> וגם את <span dir="ltr">`rules list`</span>
  — ראו [פרק 9](./09-cli-and-mcp.he.md), שנשא את השגיאה הזהה פעמיים ומתוקן גם שם. מה ש*כן* עדיין
  נכון, והוא הגרסה הצרה באמת של הסעיף הזה: **ל-<span dir="ltr">`--restore`</span> אין מקבילת
  MCP**, מוחרג בשמו מהסכמה של <span dir="ltr">`verify_rules`</span> ולא בהשמטה. משפט "הדלת
  שהוחמצה" הוא עדיין טקסט שנכתב *עבור מודל* ועדיין אומר לקורא להריץ
  <span dir="ltr">`mycontext rules list`</span> במעטפת ולא נוקב ב-
  <span dir="ltr">`list_rules`</span> — אותו חצי של הנקודה המקורית שורד: סוכן שקורא את המשפט ויש
  לו רק קריאות לכלים עדיין צריך לתרגם אותו, אף שקיים כלי שהיה מגיש את אותה תשובה. (המשפט ההוא
  הולך ל-**stderr**, לאדם, ולא לתוך ההקשר של המודל — <span dir="ltr">`pre-tool-use.ts:747`</span>.)
- **הבלוק שנמסר משמיט את הדרג ש-<span dir="ltr">`rules show`</span> מדפיס**
  (<span dir="ltr">`deliver.ts:200`</span>), ולכן קורא של מסירה אינו יכול להבחין בין קבוע
  <span dir="ltr">`product`</span> לבין <span dir="ltr">`developer`</span>.
- ~~**גרסת המאגר וה-changelog ניתנים לקריאה רק מ-<span dir="ltr">`src/ui/maintenance/`</span>**~~
  — **נסגר 2026-09-14 (<span dir="ltr">`store/9`</span>)**:
  <span dir="ltr">`rules verify`</span> ו-<span dir="ltr">`rules list`</span> מדפיסים את הגרסה,
  את תאריך הפרסום ואת הערת ה-changelog האחרונה, ושניהם נושאים
  <span dir="ltr">`storeVersion`/`publishedAt`</span> ב-<span dir="ltr">`--json`</span>. ההחרגה
  של כלי התחזוקה ללא נגיעה, וזו הנקודה — התיקון היה משטח נשלח, לא החרגה קטנה יותר. **עדיין נכון
  ולא תוקן כאן:** ה-changelog מפגר בחמש רשומות ולפחות גרסה אחת אחרי התיקייה נכון ל-2026-09-16
  (<span dir="ltr">`store/10`</span>; הוא פיגר בארבע רשומות ב-2026-09-13 — ראו "ה-changelog המלא
  של המניפסט" למעלה), ולכן קורא ש*כן* יכול עכשיו להתייעץ איתו מתייעץ עם משהו מיושן, והפער מתרחב
  באופן פעיל ולא קפוא בארבע.
- **רינדור <span dir="ltr">`RuleSet.refused`</span>** — מה שצרכן באמת רואה כשרשומה נכשלת בפענוח —
  אינו מתואר בפרק הזה.
- **ה-<span dir="ltr">`means`</span> של <span dir="ltr">`def-a-door`</span> עצמו נוקב ב-
  <span dir="ltr">`PreCompact`</span> כדלת**, והקוד מחריג אותו מ-<span dir="ltr">`Door`</span>
  וקובע שם במקום. הפרק הזה מצטט את <span dir="ltr">`def-a-door`</span> פעמיים כסמכות לפיצול
  המסירה/הקביעה שהוא סותר. זהו קבוע ומימוש שחולקים זה על זה לגבי אוצר המילים של המוצר עצמו; זה
  דורש פסיקת בעלים, ו-[פרק 2](./02-injection.he.md) נוקב בזה גם כן במקום שאחד מהפרקים יבחר צד.

## ראו גם

- [00 — אינדקס](./00-index.he.md)
- [01 — פריטים והקורפוס](./01-items-and-corpus.he.md) — המאגר המקביל-אך-מבודד שהמאגר של הפרק הזה
  במכוון אינו נוגע בו
- [02 — הזרקה](./02-injection.he.md) — מנגנון התקציב/הדחיקה ש-<span dir="ltr">`def-spill`</span>
  נוקב בו, מיושם על פריטי קורפוס ולא על רשומות מאגר כללים
- [09 — שורת הפקודה ו-MCP](./09-cli-and-mcp.he.md) —
  <span dir="ltr">`rules list|verify|show`</span> בהקשר של סימוכין הפקודות המלא
- [11 — הלולאה המשפרת את עצמה](./11-self-improvement-loop.he.md) — בנויה סביב אוצר המילים של
  <span dir="ltr">`def-the-ration`</span>
- [13 — משמעת הבדיקות](./13-testing-discipline.he.md) —
  <span dir="ltr">`def-prove-by-removal`</span> ו-<span dir="ltr">`def-known-red`</span> הם אוצר
  המילים של הפרויקט הזה עצמו לפרקטיקות שמתועדות שם

</div>
