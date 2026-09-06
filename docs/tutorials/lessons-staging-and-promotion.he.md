# להפוך תקרית לשיעור, מועמד לפני שהוא שולט

כל פקודה וכל בלוק פלט בעמוד הזה הורצו מול סביבת עבודה נקייה בזמן הכתיבה. אין כאן
שום דבר להמחשה בלבד.

**נבדק על:** my_context v1.0.2, <span dir="ltr">Node 24, Windows 11</span>.

הערה על הכותרות: ארבע הכותרות הנדרשות מופיעות כאן באנגלית לצד העברית, מפני שבדיקת
הקיום של המוצר מחפשת בדיוק את המחרוזות האנגליות. הטקסט עצמו מתורגם, לא מסוכם.

## What it is for — למה זה נועד

משהו השתבש, הבנת למה, וההבנה שווה שמירה. אבל *"ארגז החול של 3DS דוחה כרטיסים
תקפים באקראי"* הוא תיאור, ומה שאתה באמת רוצה בכל סשן עתידי הוא **כלל**: משהו שאדם
שלא היה שם יכול לפעול לפיו.

היכולת הזו היא הדרך בין השניים, עם עצירה מכוונת באמצע.

## How it works — איך זה עובד

**שיעור הוא רציונל.** הוא נרשם, מאונדקס וניתן לחיפוש, והוא לעולם אינו מוזרק.
כתיבת אחד אינה עולה לסשן כלום.

**גזירת כללים ממנו היא בקשה, לא חישוב.** ל-my_context אין מודל משלו;
`mycontext lesson` מדפיס בקשת גזירת כללים — השיעור, התצפיות שלו, סכמת JSON
והכללים למועמד טוב — ומי שקורא (אתה, או הסוכן שבסשן) מייצר את המועמדים.

**שום דבר שחוזר אינו מוחל.** כל מועמד *מועמד*, ממתין לאישור אנושי מפורש, "מפני
שאינוריאנט שגוי במקצת היה מוזרק לכל סשן עתידי ללא הגבלה."

**למועמד כלל יש בדיוק חמישה שדות** — <span dir="ltr">`title`, `directive`, `body`, `scope`,
`severity`</span> — וכל דבר אחר נדחה בנקיבת שם ולא נזרק.

**קבלה של אחד יוצרת כלל אמיתי, מקושר בחזרה.** הפריט החדש נושא `derived_from` אל
השיעור, כך שהמקור שורד.

**פקודת ה-slash עוצרת בכוונה לפני הסוף.** <span dir="ltr">`/mycontext:lesson-stage`</span> מדפיסה את
פקודות הקבלה והדחייה ואינה מריצה אף אחת מהן. פקודת slash שהייתה מריצה
`lesson-accept` הייתה המודל שמכריע כלל במקומך, וזה בדיוק המעשה שהזרימה הזו קיימת
כדי לשמר.

## From the CLI — מהשורה

רשום את השיעור, וקבל את בקשת הגזירה:

```console
$ mycontext lesson "The 3DS sandbox declines valid cards at random"
my_context: lesson LESSON-the-3ds-sandbox-declines-valid-cards-at-random recorded as origin: human (rationale tier — indexed, never injected).

my_context RULE DERIVATION REQUEST — LESSON-the-3ds-sandbox-declines-valid-cards-at-random

- You are deriving rules. my_context has no model of its own — it stages what you return and waits for a human.
- A lesson is descriptive ("this is what happened"); a rule is normative ("this is what must happen from now on"). Convert, do not restate.
- Emit a JSON array of rule candidates matching the schema. Two or three is usually right; return [] if the lesson supports no general rule.
- Each rule must be actionable by someone who was not present for the incident. Drop the dates, names and ticket numbers.
- Do not invent scope. Scope RESTRICTS where a rule applies, so omitting it leaves the rule applying everywhere — which is the right answer for a rule that is not about particular directories, and the honest answer when you cannot name them. A human can narrow it during review.
- NOTHING you return is applied. Every candidate is staged pending explicit human approval, because a subtly wrong invariant would be injected into every future session indefinitely.
- Call back with: mycontext lesson-stage LESSON-the-3ds-sandbox-declines-valid-cards-at-random --stdin
```

החזר מועמדים ב-stdin. מועמד עם שדה שהסכמה אינה מצהירה עליו נדחה, והדחייה נוקבת
בשדה ובכל הקבוצה החוקית:

```console
$ echo '[{"title":"…","summary":"…","body":"…","directive":"dont"}]' | mycontext lesson-stage LESSON-… --stdin
my_context: 0 rule candidate(s) staged for LESSON-the-3ds-sandbox-declines-valid-cards-at-random. None of them exists as an item yet.

1 candidate rejected:
  [0] A retry must not create a second authorisation: unknown field(s) "summary". A rule candidate has exactly these fields: title, directive, body, scope, severity.
```

מועמד תקין מועמד בהצלחה, ומקבל מפתח:

```console
my_context: 1 rule candidate(s) staged for LESSON-the-3ds-sandbox-declines-valid-cards-at-random. None of them exists as an item yet.
  ┌──────────┬───────────┬────────────────────────────────────────────────┐
  │ key      │ directive │ title                                          │
  ├──────────┼───────────┼────────────────────────────────────────────────┤
  │ a6e20d13 │ dont      │ A retry must not create a second authorisation │
  └──────────┴───────────┴────────────────────────────────────────────────┘

Accept with:  mycontext lesson-accept LESSON-the-3ds-sandbox-declines-valid-cards-at-random <key> [--title "…"] [--scope "a/**,b/**"]
Discard with: mycontext lesson-discard LESSON-the-3ds-sandbox-declines-valid-cards-at-random <key>
```

הקבלה מדפיסה את הכלל לסקירה ואז יוצרת אותו:

```console
$ mycontext lesson-accept LESSON-the-3ds-sandbox-declines-valid-cards-at-random a6e20d13
my_context: about to create this rule — review before it becomes active:
  title:     A retry must not create a second authorisation
  directive: dont
  severity:  hard
  scope:     src/billing/**
  body:      Reuse the original authorisation reference on retry rather than opening a new one.

my_context: created RULE-a-retry-must-not-create-a-second-authorisation (active) with derived_from [[LESSON-the-3ds-sandbox-declines-valid-cards-at-random]].
```

<span dir="ltr">`--title`, `--scope`, `--severity`</span> ו-`--directive` על `lesson-accept` מאפשרים
לך לצמצם מועמד בזמן שאתה מקבל אותו. <span dir="ltr">`mycontext lesson-discard <lesson> <key>`</span>
דוחה אחד לצמיתות.

**פקודות ה-slash.** <span dir="ltr">`/mycontext:lesson`</span> רושמת אחד;
<span dir="ltr">`/mycontext:lesson-stage`</span> מעמידה מועמדים ועוצרת.

**מתוך סוכן**, `create_lesson` רושם את השיעור ו-`stage_rule_candidates` מעמיד את
מה שנגזר. בכוונה אין כלי קבלה.

**מה שהשורה יודעת לעשות כאן והממשק לא.** את כל הזרימה. `lesson`
ו-`lesson-stage` אינם בקטלוג הפקודות של הדפדפן, ואף מסך אינו מצייר מועמד שהועמד.

## From the UI — מהממשק

**אין מסך שיעורים.** שניים מארבעת הפעלים נגישים — `lesson-accept`
ו-`lesson-discard` נמצאים שניהם בקטלוג של **מרכיב הפקודות**, `lesson-accept` על
גבול האמון עם האישור המפורט שדה־שדה ו-`lesson-discard` מתחתיו עם האישור הפשוט —
אבל היית צריך את מזהה השיעור ואת מפתח המועמד מטרמינל קודם, מפני ששום דבר על המסך
אינו מציג אותם.

מה שהדפדפן כן מראה הוא התוצאה: הכלל שמועמד מקובל יצר מופיע במסך **קשרים** עם קשת
ה-`derived_from` שלו חזרה אל השיעור, וב**שאילתה** וב**מצב** ככל פריט אחר.

**מה שהממשק יודע לעשות כאן והשורה לא.** לצייר את המקור. קשת ה-`derived_from` מכלל
חזרה אל התקרית שהולידה אותו היא קו על גרף האגו, וזו הדרך המהירה ביותר לענות על
"למה הכלל הזה קיים?"

**מה שהממשק אינו יכול לעשות כאן.** לרשום שיעור, לבקש מועמדים, להעמיד אותם, או
להציג מה מועמד. מועמדים שהועמדו גם אינם נוסעים עם ייצוא — הם הצעות בתוך סביבת
עבודה, לא ידע על תחום.
