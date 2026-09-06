# לכתוב נוהל ולהריץ אותו

כל פקודה וכל בלוק פלט בעמוד הזה הורצו מול סביבת עבודה נקייה בזמן הכתיבה. אין כאן
שום דבר להמחשה בלבד.

**נבדק על:** my_context v1.0.2, <span dir="ltr">Node 24, Windows 11</span>.

הערה על הכותרות: ארבע הכותרות הנדרשות מופיעות כאן באנגלית לצד העברית, מפני שבדיקת
הקיום של המוצר מחפשת בדיוק את המחרוזות האנגליות. הטקסט עצמו מתורגם, לא מסוכם.

## What it is for — למה זה נועד

`runbook` הוא הצעדים לדבר שאתה עושה בכל פעם שהוא עולה. **נוהל** הוא הצעדים לדבר
שאתה עושה **פעם אחת** ואז פורש: מיגרציה, מעבר, מילוי אחורי חד-פעמי.

שניהם נורמטיביים, מפני ששניהם חייבים להגיע לסשן כדי שיפעלו לפיהם. מה שמייחד נוהל
הוא שהוא אמור להסתיים — והיכולת בנויה סביב הדאגה לכך שאכן יסתיים.

## How it works — איך זה עובד

**חמישה מצבים, ובדיוק אחד מהם מזריק.**

| מצב | משמעות | הזרקה |
|---|---|---|
| `proposed` | נכתב, לא אושר. סוכן רשאי לכתוב אחד כאן | לא מוזרק |
| `ready` | אישרת אותו | לא מוזרק, ואפילו לא שורת אינדקס |
| `active` | יזמת אותו | במלואו, בכל סשן |
| `done` | הושלם | לא מוזרק |
| `abandoned` | עצרת אותו, והוא `superseded` ולא גמור | לא מוזרק |

**ההזרקה רק ב-`active` היא המנגנון, לא בקשה שהמודל יכול להתעלם ממנה.** נוהל
שמוחזק במלואו עשוי שיפעלו לפיו, ולכן הוא נמסר רק כשאתה קובע את המצב במכוון. הסיכון
האמיתי שזה שומר מפניו הוא נוהל שנשאר `active` לנצח ומזריק זמן רב אחרי שהעבודה
הסתיימה.

**נוהל `ready` אינו מוזרק ואינו נקוב באינדקס.** המודל אינו לומד שהוא קיים עד
שתפעיל אותו. שום דבר אינו אובד: הוא טיוטה, ו-`mycontext procedure list` הוא המקום
שבו הוא נראה.

**הצעדים הם מקטע `## Steps` ב-Markdown**, שנקרא באותה דרך שבה `## Observations`
נקרא. <span dir="ltr">`"1 of 3"`</span> הוא **נספר, לעולם לא נשמר** — אין מקום שני שבו המספר יכול לחלוק
על התיבות.

**סימון תיבה הוא רשומת התקדמות, לא עריכת פריט.** `mycontext procedure step`
מתאים תיבת סימון אחת לפי תבנית קפדנית וכותב *רשומת ביקורת*; קובץ הפריט אינו נוגע
כלל. זו הבחנה ולא פטור: שער הטיוטה מונע מסוכן לשנות *תוכן* נורמטיבי, ותיבת סימון
היא *התקדמות*. כל היפוך מבוקר, ולכן הוא נשאר גלוי.

**מה שאינו מוקל הוא המצב.** `active → done` נשאר שלך. התיבה האחרונה אינה סוגרת
את הנוהל — היא מאפשרת לסוכן *לשאול*.

**ההתקדמות היא לכל סביבת עבודה, לא לכל סשן.** שני טרמינלים על אותה סביבת עבודה
חולקים קבוצת רשומות אחת.

## From the CLI — מהשורה

```bash
mycontext add procedure "Move prices to integer minor units" \
  --summary "The one-off migration that moves stored prices from a decimal column to an integer minor-units column." \
  --step "Add the integer column beside the decimal one" \
  --step "Backfill, and verify the two agree on every row" \
  --step "Switch reads to the integer column" --yes
```

```console
$ mycontext procedure list
active:
  PROC-move-prices-to-integer-minor-units · active · 0 of 3 · Move prices to integer minor units

note: progress is recorded per workspace, not per session — two terminals on this workspace share
      one record set.
```

הפריט עצמו נושא את הצעדים כמקטע Markdown רגיל:

```markdown
# Move prices to integer minor units

## Steps
- [ ] Add the integer column beside the decimal one
- [ ] Backfill, and verify the two agree on every row
- [ ] Switch reads to the integer column
```

סימון אחד אומר בדיוק מה הוא עשה, ומה לא:

```console
$ mycontext procedure step PROC-move-prices-to-integer-minor-units 1
my_context: step 1 ticked — 1 of 3. The item file is unchanged; this is one record in the audit log.
```

וסיומו הוא החלטה, שמוצגת ככזו בתצוגה מקדימה:

```console
$ mycontext procedure done PROC-move-prices-to-integer-minor-units
about to finish:
  procedure   PROC-move-prices-to-integer-minor-units
  title       Move prices to integer minor units
  status      active -> deprecated
  progress    1 of 3

  after this it is no longer injected, and it is not deleted either: the file, its body and its
  steps all stay, and it is counted in the session banner's "N retired" rather than vanishing from
  every tally.
  the progress line above is what it is — this command checks nothing and concludes nothing. A
  procedure is finished when a human says it is.
```

קרא את ההערה האחרונה. הוא הסתיים עם אחת משלוש תיבות מסומנת ואמר זאת; הוא לא סירב,
והוא לא העמיד פנים שהספירה אומרת משהו.

```bash
mycontext procedure list                    # מה מוכן, מה רץ ומה הסתיים
mycontext procedure show <id>               # אחד, בשלמותו
mycontext procedure activate <id>           # ready → active, ומכאן הוא מתחיל להזריק
mycontext procedure step <id> <n>           # סמן תיבה אחת
mycontext procedure done <id>               # סיים אותו, והפסק להזריק אותו
```

**פקודת ה-slash.** <span dir="ltr">`/mycontext:procedure`</span>.

**מתוך סוכן**, `read_procedure` קורא אחד. סוכן יכול לכתוב נוהל כטיוטה `proposed`
ויכול לסמן תיבה; הוא אינו יכול להפעיל או לסיים אחד.

**מה שהשורה יודעת לעשות כאן והממשק לא.** כל דבר שמשנה נוהל: הפעלה, צעד וסיום. אף
אחת מתת-הפקודות של `procedure` אינה בקטלוג הפקודות של הדפדפן.

## From the UI — מהממשק

מסך **נהלים** (`nav.ch`) הוא שלושה כרטיסים. הראשון הוא טבלת חמשת המצבים שלמעלה,
עם הנימוק לצידה. השני הוא **חי** — כרטיס אחד לכל נוהל במאגר הזה, מצויר מנקודת הקצה
האמיתית, עם השלב שלו ועם ההתקדמות הנספרת שלו. השלישי הוא הפרוזה של "מי רשאי לסמן
תיבה".

`nav.ch` הוא *שינוי — מורכב, לא מורץ*, והמסך הזה הוא בדיוק זה: שום דבר כאן אינו
כותב, והשורה האחת שהוא מרכיב הולכת ללוח העריכה.

שני דברים שהוא זהיר לגביהם:

- **המקרה הריק מצויר ונקוב בשם.** מאגר בלי אף נוהל אומר *"אין נוהל במאגר הזה.
  מחזור החיים שלמעלה הוא מה שנוהל היה; שום דבר עדיין לא נכתב"* — מאגר ריק ומסך
  שנכשל אינם יכולים להיראות זהים.
- **הגילויים הם של נקודת הקצה עצמה**, תחת כותרת שאומרת שהם *נכונים בין אם כרטיס
  שלמעלה אומר זאת ובין אם לא*: ההתקדמות היא לכל סביבת עבודה; רשומות התקדמות
  שהבנייה הזו לא יכלה לקרוא אינן נספרות לשום כיוון; סימון שנכתב ביד לתוך ה-Markdown
  אינו רשומת התקדמות, והשניים יכולים לחלוק זה על זה; ואם קטגוריית `procedure`
  כבויה בהגדרות, הרשימה הריקה אומרת *את זה* ולא "אין נהלים".

**מה שהממשק יודע לעשות כאן והשורה לא.** להציג את מחזור החיים ואת הנהלים של המאגר
הזה במסך אחד, כך שנוהל שנשאר `active` זמן רב אחרי שהעבודה הסתיימה נראה במבט ולא
נמצא בחיפוש.

**מה שהממשק אינו יכול לעשות כאן.** להפעיל, לסמן או לסיים משהו. הוא מרכיב את השורה
ועוצר.
