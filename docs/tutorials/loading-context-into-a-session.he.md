# לטעון את ההקשר של הפרויקט בתחילת סשן

כל פקודה וכל בלוק פלט בעמוד הזה הורצו מול סביבת עבודה נקייה בזמן הכתיבה. אין כאן
שום דבר להמחשה בלבד.

**נבדק על:** my_context v1.0.2, ‏Node 24, ‏Windows 11.

הערה על הכותרות: ארבע הכותרות הנדרשות מופיעות כאן באנגלית לצד העברית, מפני שבדיקת
הקיום של המוצר מחפשת בדיוק את המחרוזות האנגליות. הטקסט עצמו מתורגם, לא מסוכם.

## What it is for — למה זה נועד

תיעוד ידע הוא רק חצי מהכלי. החצי השני הוא החלק שאתה לעולם לא מקליד: המאגר מגיע
לסשן, ברגע שהוא רלוונטי, בלי שאף אחד יזכור להדביק אותו.

המדריך הזה עוסק בהגעה הזו — במה שסשן חדש נפתח איתו, במה שמופיע מאוחר יותר כשנוגעים
בקובץ, ואיך לבקש את זה במכוון כשהמסלול האוטומטי לא פעל.

## How it works — איך זה עובד

**תחילת סשן שולחת אינדקס קצר, לא את המאגר.**

```markdown
_2 governing item(s) below carry a title only — the body was not delivered: CONST-card-numbers-never-reach-the-logs, RULE-every-price-is-an-integer-of-minor-units. A title names a rule; it does not tell you what it requires. Read each with `mycontext show <id>` before treating it as satisfied. Delivering every one of them in full this session would cost ~71 estimated tokens._

## my_context index
- CONST-card-numbers-never-reach-the-logs · constraint · Card numbers never reach the logs
- RULE-every-price-is-an-integer-of-minor-units · rule · Every price is an integer of minor units

2 lesson · 1 reference · 1 todo
→ use mycontext list or mycontext show <id> to browse these
```

מזהים וכותרות לפריטים הנורמטיביים — די והותר כדי שהמודל ידע שהם קיימים ויוכל
לשלוף אחד — וכל שכבת הרציונל מצומצמת למספר בלבד, מספר אחד לכל קטגוריה. השורה
הנטויה מעל האינדקס היא הגילוי: האינדקס הוא שם, לא הכלל, והוא אומר זאת במקום
לתת לכותרת להיתפס כפריט.

**ואז המאגר מגיע תוך כדי עבודה.** בקש מ‑Claude לקרוא את `src/billing/charge.ts`,
ולפני שהקריאה רצה זה מגיע להקשר שלו:

```markdown
## my_context — these govern this project

### CONST-card-numbers-never-reach-the-logs · constraint · Card numbers never reach the logs

Log the last four digits and the processor's reference.

_scope: src/billing/**_

### RULE-every-price-is-an-integer-of-minor-units · rule · Every price is an integer of minor units
```

שלושה דברים נפרדים קרו כאן, וכדאי להבחין ביניהם:

1. האילוץ הגיע מפני שהקובץ תאם את `src/billing/**`.
2. הכלל הגיע גם הוא, מפני ש**אין לו היקף**, וללא היקף פירושו שהוא חל בכל מקום.
3. השיעורים, ה‑`reference` וה‑`todo` **לא הגיעו**. הם רציונל. רציונל לעולם אינו
   מוזרק — הוא קיים כדי שתחפש בו, וכדי ש‑Claude יעיין בו במכוון.

קרא את `README.md` באותו סשן ושום דבר לא יגיע, משתי סיבות שכדאי להפריד ביניהן.
האילוץ אינו תואם את הנתיב הזה. הכלל *כן* תואם — אבל הוא כבר נמסר, ו‑my_context
אינו חוזר על עצמו בתוך סשן. הוא עוקב אחרי מה שכל סשן כבר ראה.

**כל זה נעשה על ידי hooks.** התוסף רושם היום שמונה־עשרה אירועי hook; טבלת
ה‑hooks ב‑`README.md` §5 ("Using it") נגזרת מחדש מתוך `hooks/hooks.json` בכל
הרצת בדיקות, והיא זו שכדאי לסמוך עליה לגבי מה מפעיל כל אחד.

## From the CLI — מהשורה

אין פועל `mycontext load`, וההיעדר הזה הוא התכנון: הזרקה היא עבודה של hook, לא
של פקודה. מה שהטרמינל נותן לך הוא הצורה המכוונת של אותו הדבר.

**פקודת ה‑slash היא המשטח.** ‏`/mycontext:LoadMyContext` טוענת את הידע של הפרויקט
לסשן שאתה נמצא בו, עכשיו. הושט אליה יד כשסשן התחיל לפני שהתוסף עלה, כשתת‑סוכן
צריך את המאגר שההורה שלו כבר מחזיק, או אחרי מעקף ארוך שבסופו אתה רוצה לראות שוב
את הפריטים השולטים.

כדי לקבע פריט אחד לתוך *כל* תחילת סשן, במלואו:

```bash
mycontext pin CONST-card-numbers-never-reach-the-logs --yes
mycontext unpin CONST-card-numbers-never-reach-the-logs --yes
```

השתמש בקיבוע במשורה. פריט מקובע עולה טוקנים בכל סשן, לתמיד. היקף הוא הכלי הזול
יותר: הוא מוסר את הפריט בדיוק כשהוא רלוונטי.

לפעולה חד‑פעמית במקום קיבוע קבוע, ‏`mycontext carry <id>` מסמן פריט אחד להזרקה
הבאה ואז שוכח אותו:

```console
about to mark CONST-card-numbers-never-reach-the-logs ("Card numbers never reach the logs") for
  delivery at the next injection, regardless of its own budget. It is a front-of-queue index line —
  the same disclosure a cross-session carry already gets — not the full item text, and not a change
  to what governs it. The mark is spent by that one injection, whether or not the line is admitted,
  and is not renewed.
```

**מתוך סוכן**, ‏`load_context` עונה מה היה מוזרק כעת, ו‑`focus_context` מצמצם.

**מה שהשורה יודעת לעשות כאן והממשק לא.** כל מה שמשנה את מה שמגיע: ‏`pin`,
‏`unpin` ו‑`carry` הם פעולות טרמינל. הדפדפן מרכיב `pin` ו‑`unpin` בקטלוג של מרכיב
הפקודות ומריץ אותם מאחורי אישור; ‏`carry` אינו בקטלוג כלל.

## From the UI — מהממשק

הממשק אינו מזריק דבר — אין לו סשן להזריק אליו. מה שהוא כן עושה הוא להראות לך את
אותה בחירה מבחוץ, בשלושה מסכים תחת `nav.inj` — *הזרקה — מה מגיע*:

- **תצוגת הזרקה** — בחר קובץ, וראה מה היה מגיע בנגיעה בו, ומה נשפך החוצה.
- **מוזרק כעת** — מה סשן אמיתי באמת קיבל, נקרא מקובץ ה"נראה" של אותו סשן ולא
  מהיטל משוחזר.
- **כיסוי היקף** — כל נתיב שנסרק, צבוע לפי מה ששולט בו.

לכל אחד מהם יש מדריך משלו. יחד הם התשובה לשאלה "למה הפריט הזה הגיע, ולמה זה לא?"

**מה שהממשק יודע לעשות כאן והשורה לא.** להראות את הבחירה עבור קובץ שלא נגעת בו,
ועבור סשן שאינך נמצא בו, לצד הטקסט המרונדר שהיה נמסר.

**מה שהממשק אינו יכול לעשות כאן.** לטעון הקשר לסשן. אין סשן בצד השני של לשונית
דפדפן; המשטחים היחידים שמזריקים הם ה‑hooks ו‑`/mycontext:LoadMyContext`.
