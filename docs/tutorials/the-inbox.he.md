# למיין תיעודים מהירים מתוך תיבת הדואר הנכנס

כל פקודה וכל בלוק פלט בעמוד הזה הורצו מול סביבת עבודה נקייה בזמן הכתיבה. אין כאן
שום דבר להמחשה בלבד.

**נבדק על:** my_context v1.0.2, <span dir="ltr">Node 24, Windows 11</span>.

הערה על הכותרות: ארבע הכותרות הנדרשות מופיעות כאן באנגלית לצד העברית, מפני שבדיקת
הקיום של המוצר מחפשת בדיוק את המחרוזות האנגליות. הטקסט עצמו מתורגם, לא מסוכם.

## What it is for — למה זה נועד

רוב מה שעולה לך בראש באמצע משימה עדיין אינו ידע. "לבדוק אם מסלול הניסיון החוזר
של 3DS מחייב פעמיים" הוא חשש, לא כלל; לכפות עליו הכרעת קטגוריה ברגע שהוא עולה
בדעתך היא בדיוק הסיבה שהוא לעולם לא נכתב בכלל.

תיבת הדואר הנכנס היא המקום לדברים האלה. תעד עכשיו, החלט אחר כך — וכשתחליט, קדם
את התיעוד לקטגוריה שהוא באמת היה, בלי לאבד את השביל חזרה למקום שממנו הגיע.

## How it works — איך זה עובד

`todo` ו-`note` הן קטגוריות רגילות בשכבת ה**רציונל**, ומיקום השכבה הזה הוא כל
המנגנון:

- `todo` לעולם אינו מוזרק לסשן במלואו. אינדקס הסשן מצמצם את כל הקטגוריה למספר
  בלבד ואינו נוקב באף אחד מהפריטים — כך שתיבה עם ארבעים דברים שאיש עוד לא בנה
  עולה לסשן כמעט כלום.
- שום דבר אינו מכריח תיעוד בתיבה להיות `draft`, ולכן הוא אינו נכנס לתור הסקירה.
  `mycontext review` שואל מה צריך לשלוט בפרויקט הזה, והתיבה אינה חלק מהשאלה.

**קידום הוא יצירה ופרישה, ושניהם מתועדים.** `inbox-promote` יוצר פריט חדש תחת
הקטגוריה שהתיעוד באמת היה, מעביר את הכותרת, הגוף והתגיות, מקשר את הפריט החדש
חזרה ב-`derived_from`, ומסמן את ה-todo כ-`deprecated`. שום דבר אינו נמחק: ה-todo
שקודם שומר את הקובץ שלו, את הגוף ואת התצפיות, ו-`mycontext todo --all` עדיין
מציג אותו.

ה-`origin` נישא הלאה ולעולם אינו מוטבע מחדש — `todo` שאתה כתבת נשאר `human`
כשהוא הופך לשאלה פתוחה.

## From the CLI — מהשורה

```bash
mycontext add todo "Check whether the 3DS retry path double-charges" \
  --summary "An unverified worry that retrying a 3D Secure authorisation may charge the customer twice." --yes
```

תקציר נדרש כאן בדיוק כמו בכל תיעוד אחר — התיבה זולה בטקס, לא במשפט האחד שקורא
עתידי יזדקק לו.

```console
$ mycontext todo
┌──────────────────────────────────────────────────────┬────────┬────────┬─────────────────────────┐
│ id                                                   │ status │ tags   │ title                   │
├──────────────────────────────────────────────────────┼────────┼────────┼─────────────────────────┤
│ TODO-check-whether-the-3ds-retry-path-double-charges │ active │ (none) │ Check whether the 3DS   │
│                                                      │        │        │ retry path              │
│                                                      │        │        │ double-charges          │
└──────────────────────────────────────────────────────┴────────┴────────┴─────────────────────────┘
```

קידום אחד מראה לך את כל העסקה לפני שהיא קורית:

```console
$ mycontext inbox-promote TODO-check-whether-the-3ds-retry-path-double-charges --to open_question
about to promote out of the inbox:
  from        TODO-check-whether-the-3ds-retry-path-double-charges
  type        todo
  title       Check whether the 3DS retry path double-charges
  status      active -> deprecated
  kept        the file, its body, its observations and its relations all stay, and
              it stays searchable and counted

  to          a new open_question (its id is allocated when it is written)
  title       Check whether the 3DS retry path double-charges
  origin      human (carried from TODO-check-whether-the-3ds-retry-path-double-charges, never restamped)
  status      active
  governs     no scope — unrestricted, so nothing narrows it and it is injected on the first file touched in a session
  linked      the new item will carry "derived_from TODO-check-whether-the-3ds-retry-path-double-charges"

my_context: refusing without confirmation — stdin is not interactive. Rerun with --yes to confirm, or run this from an interactive terminal.
```

קרא את שורת ה-`governs` לפני שאתה מאשר. קידום לקטגוריה נורמטיבית ללא היקף הוא
הדרך שבה פריט חסר היקף נכנס למאגר בטעות.

`mycontext todo` מקבל `--tag`, <span dir="ltr">`--all`</span> (כולל אלה שקודמו ונפרשו), <span dir="ltr">`--limit`</span>,
שלושת דגלי הרוחב ו-`--json`.

**פקודות ה-slash.** <span dir="ltr">`/mycontext:todo`</span> מציגה את התיבה ו-`/mycontext:inbox-promote`
מובילה קידום, שתיהן בתוך סשן.

**מתוך סוכן**, `list_todos` קורא את התיבה. אין כלי קידום: סוכן רשאי להוסיף
לתיבה, ואדם מוציא ממנה.

**מה שהשורה יודעת לעשות כאן והממשק לא.** את הכול. ליכולת הזו אין מסך: לא `todo`
ולא `inbox-promote` נמצאים בקטלוג הפקודות של הדפדפן, ואף מסך אינו מצייר את התיבה
כרשימה.

## From the UI — מהממשק

**אין מסך תיבת דואר נכנס, וזה פער אמיתי ולא החלטת עיצוב.** הכי קרוב שהדפדפן מגיע
הוא מסך **שאילתה**, שבו `todo` היא קטגוריה ככל קטגוריה ושורת סינון תציג את
התיעודים שלך; ומסך **מצב**, שבו ספירת ה-todo מופיעה בטבלת הקטגוריות.

**מה שהממשק יודע לעשות כאן והשורה לא.** כלום. זו אחת מהיכולות שבהן הטרמינל מקדים
בבירור.

**מה שהממשק אינו יכול לעשות כאן.** לצייר את התיבה כתיבה, או לקדם ממנה דבר. מסך
התיעוד ירכיב `add todo` כמו כל קטגוריה אחרת, ולכן תיעוד מהדפדפן אפשרי; המיון
שאחריו הוא פעולת טרמינל.
