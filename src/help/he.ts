/**
 * The Hebrew rendering of the category table's human column.
 *
 * The table itself is never translated by hand: `categoryTable` (index.ts)
 * derives every machine-checkable fact — the category name, its tier, its id
 * prefix — from the resolved config in both languages, so the Hebrew table
 * cannot disagree with the English one about anything a test can check. What
 * IS language is the "use for" column and the header row, and this module is
 * where that language lives.
 *
 * `test/help/categories-he.test.ts` asserts the keys here equal the catalogue
 * exactly, so a category added to `src/core/categories.ts` without a Hebrew
 * description fails the suite rather than shipping an English row inside the
 * Hebrew document — which is the defect this file exists to end.
 *
 * A CUSTOM category has no row here and falls back to the description the
 * project itself wrote in its config, which is the honest answer: this
 * catalogue has never seen the name and has no words of its own for it.
 */

/** The Hebrew header row of the category table, column for column. */
export const HE_TABLE_HEADER = '| סוג | דרג | קידומת מזהה | למה משמש |';

export const HE_CATEGORY_DESCRIPTIONS: Record<string, string> = {
  constraint: 'מגבלה שאינה נתונה למשא ומתן: תקציב, סטאק, רגולציה, SLA',
  invariant: 'תנאי שחייב להתקיים בכל רגע במהלך הריצה',
  rule: 'הנחיית עשה/אל-תעשה',
  requirement: 'מה שחייב להיבנות',
  standard: 'עיצוב קוד, מוסכמת כתיבה, קו מנחה ארכיטקטוני',
  pattern: 'פתרון לשימוש חוזר, או אנטי-דפוס שיש להימנע ממנו',
  glossary: 'שפה אחידה: המונח המוסכם, והמונחים שאין להשתמש בהם',
  instruction: 'מכתיב את תהליך העבודה של הסוכן, לא את התוצר',
  non_goal: 'איסור מפורש לבנות דבר-מה',
  open_question: 'הושאר פתוח במכוון; אסור לסוכן להכריע בו לבד',
  runbook: 'הצעדים לפעולה מוגדרת אחת, בסדר שבו חובה לבצעם',
  // The Latin word `runbook` stays Latin here on purpose: it is a category
  // name the reader types, and a translated one would match nothing.
  procedure: 'פעולה מסודרת שמבוצעת פעם אחת ואז נגמרת; פעולה שחוזרת על עצמה היא runbook',
  environment: 'במה הסביבות נבדלות: מה production עושה ש-local אינו עושה',
  known_issue: 'שבור, הפכפך או מבוי סתום כרגע; לא להשקיע בזה מאמץ',
  adr: 'רשומת החלטה פורמלית, בתבנית MADR',
  decision: 'החלטה קלת-משקל שאינה מצדיקה ADR מלא',
  lesson: 'מה שנלמד; חומר הגלם לכללים שנגזרים ממנו',
  tradeoff: 'מה הוקרב, ותמורת מה',
  assumption: 'הנחת יסוד שלא אומתה, עם מועד יעד לאימות',
  edge_case: 'מקרה קצה; לעיתים קרובות שווה קידום',
  risk: 'עלול להתרחש, ויזיק אם יתרחש',
  reference: 'תצלום מצב של קובץ, שמקורו מתועד כך ש-doctor מדווח על סחיפה',
  todo: 'משהו לבנות או לתקן בהמשך, שנלכד ברגע שהוא עולה בדעתכם',
  note: 'כל דבר שעלה במהלך הפיתוח ואסור שיאבד',
};
