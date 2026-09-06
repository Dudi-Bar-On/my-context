# לחלץ פריטים מתוך מסמך שכבר כתבת

כל פקודה וכל בלוק פלט בעמוד הזה הורצו מול סביבת עבודה נקייה בזמן הכתיבה. אין כאן
שום דבר להמחשה בלבד.

**נבדק על:** my_context v1.0.2, ‏Node 24, ‏Windows 11.

הערה על הכותרות: ארבע הכותרות הנדרשות מופיעות כאן באנגלית לצד העברית, מפני שבדיקת
הקיום של המוצר מחפשת בדיוק את המחרוזות האנגליות. הטקסט עצמו מתורגם, לא מסוכם.

## What it is for — למה זה נועד

רוב הצוותים כבר כתבו את זה. ‏PRD, הערת ארכיטקטורה, ‏runbook, מסמך עיצוב — מלאים
בדברים שחייבים להתקיים, ושום דבר מהם אינו נגיש לסשן.

‏Ingest הוא הדרך שבה המסמך הזה הופך לפריטים, נתח אחר נתח, בלי שאיש יקליד אותו
מחדש ובלי שמודל יחליט בשקט מה שולט.

## How it works — איך זה עובד

**ל‑my_context אין מודל משלו והוא לעולם אינו קורא לאחד.** זו הצורה של כל היכולת:
‏`ingest` פולט *בקשת חילוץ* — הנתח, הכללים וסכמת JSON — ו**אתה** (או הסוכן שאתה
משוחח איתו) הוא המחלץ. הכלי מאמת את מה שחוזר.

**כל מועמד חייב לשאת ציטוט מילה במילה** מתוך הנתח, שנבדק בהתאמה מדויקת אחרי צמצום
רווחים. ניסוח מחדש נדחה. כך נתפס פריט מומצא.

**הכול נוחת כ‑`draft`.** שום דבר שחולץ אינו שולט בעבודה עתידית עד שאדם מקדם אותו
עם `mycontext review promote`.

**שתי תכונות של פריט שיובא ב‑ingest** שכדאי להכיר:

- הוא נושא `origin: ingest`, נבדל גם מ‑`human` וגם מ‑`agent` ביומן הביקורת.
- הוא נכתב עם `always: false`. **שום פריט שיובא ב‑ingest אינו יכול לטעון הצמדה**,
  מה שהמסמך לא יגיד.

**‏Refresh הוא החצי השני של אותה יכולת**, עבור מסמך שאתה ממשיך לעקוב אחריו במקום
לכרות אותו פעם אחת. פריט `reference` מצלם קובץ; כשהקובץ ממשיך הלאה, ‏`doctor`
מדווח על הסטייה ו‑`refresh` לוקח צילום חדש — מחליף את הגוף, בשלמותו, ומשאיר את
הכותרת, התצפיות, הקשרים, ההיקף והתגיות ללא נגיעה.

## From the CLI — מהשורה

```console
$ mycontext ingest docs/ARCHITECTURE.md
my_context EXTRACTION REQUEST — docs/ARCHITECTURE.md § architecture (chunk 1 of 1, 1 pending)

- You are the extractor. my_context has no model of its own and never calls one — it hands you the text and validates what you return.
- Read the chunk below, taken from docs/ARCHITECTURE.md under the anchor "architecture", and extract every piece of NORMATIVE knowledge it establishes: things that must hold, must be built, must not be done, or are deliberately left open.
- Do not extract narrative, status updates, or descriptions of what was done — that is claude-mem's job, not this one.
- Emit a JSON array matching the "schema" field. Return [] when the chunk establishes nothing normative — that is a correct and common answer, and the common case for prose that isn't a spec.
- Every candidate MUST carry a "quote": a span copied VERBATIM from the chunk. It is checked by exact match after whitespace collapsing, and a paraphrase is rejected. This is how an invented item is caught.
```

הבקשה ממשיכה עם הכללים ל‑`title`, ‏`summary`, ‏`body`, ‏`scope`, ‏`tags`,
‏`severity`, ‏`observations` ו‑`extra`, אחר כך הנתח עצמו וסכמת ה‑JSON, ומסתיימת
בנקיבת שם החזרה:

```
- Then call back with the results. CLI: mycontext ingest-apply ING-docs-architecture-md-ff21b6b9-e308f1fc --anchor architecture --stdin — pipe your JSON array to stdin.
- This is the last pending chunk in this document.
```

אז הלולאה היא שלוש פקודות, והמזהים הם של הכלי ולא שלך:

```bash
mycontext ingest docs/prd.md                                  # בקש מועמדים לנתח הבא
mycontext ingest-apply <session-id> --anchor <anchor> --stdin  # החזר את התשובות
mycontext ingest-status                                        # מה נשאר
```

‏`/mycontext:ingest` מנהלת את שלושתן מתוך סשן, וזו הדרך להשתמש בזה —
‏`ingest-apply` ו‑`ingest-status` הם שלבים בתוכה ולא פקודות שהיית מריץ ביד.

אחר כך הטיוטות עוברות בתור הרגיל:

```bash
mycontext review
mycontext review promote <id> --scope "src/billing/**" --yes
```

לחצי של המסמך במעקב:

```bash
mycontext add reference "Architecture overview" --file docs/ARCHITECTURE.md --summary "…" --yes
mycontext doctor                        # מדווח source_drift כשהקובץ ממשיך הלאה
mycontext refresh REF-architecture-overview
```

**פקודות ה‑slash.** ‏`/mycontext:ingest` ו‑`/mycontext:refresh`.

**מתוך סוכן**, ‏`ingest_document` עושה את שני השלבים בקריאה אחת — הוא מקבל את אותם
ארגומנטים שהחזרה בשורה נוקבת בהם, בתוספת מערך `candidates` — ו‑`refresh_item` מצלם
מחדש reference.

**מה שהשורה יודעת לעשות כאן והממשק לא.** את כל ה‑ingest. ‏`ingest`,
‏`ingest-apply` ו‑`ingest-status` אינם בקטלוג הפקודות של הדפדפן, ואף מסך אינו
מצייר סשן ingest.

## From the UI — מהממשק

**אין מסך ingest, וזה פער אמיתי ולא החלטת עיצוב.** ‏Ingest הוא היכולת הגדולה
היחידה במוצר הזה שאין לה משטח דפדפן כלל.

מה שהדפדפן כן מגיע אליו:

- **‏`refresh`** נמצא בקטלוג של **מרכיב הפקודות**, מעל גבול האמון, ולכן אפשר לצלם
  מחדש reference מהדפדפן מאחורי אישור מלא.
- **הטיוטות ש‑ingest ייצר** נוחתות במסך **תור הסקירה** כמו כל טיוטה אחרת, עם
  ה‑diff ברמת השדה ועם צמד הקבלה/דחייה.
- **‏`doctor`** מצייר את ממצא ה‑`source_drift` שאומר לך שנדרש refresh.

**מה שהממשק יודע לעשות כאן והשורה לא.** להציג טיוטה שיובאה לצד הטקסט שבתוקף, שדה
מול שדה, לפני שאתה מקבל אותה.

**מה שהממשק אינו יכול לעשות כאן.** להתחיל ingest, להחזיר מועמדים, או לדווח מה נשאר
באחד. ל‑`mycontext ingest-status` אין מקבילה בדפדפן.
