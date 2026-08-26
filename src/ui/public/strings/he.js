/**
 * Hebrew UI string table — TRANSCRIBED from the design of record, not authored here.
 *
 * `docs/design/web-ui-mockup.html` is the UI specification. Every key below is one of its
 * 398 distinct string keys — the 382 it declares with `data-t`, the 12 accessibility
 * labels it declares with `data-t-aria` and the 4 tooltips it declares with
 * `data-t-title`. Those four numbers are a READING of the file and nothing tests
 * them — `strings-parity.test.ts` derives its own count for exactly that reason. This
 * block said 396/379/12/5 against a mockup declaring 395/379/12/4, so the tooltip line
 * had been wrong since a title key left, and the total wore the error.
 *
 * The English values are the rendered text of those elements — or, for the sixteen
 * keyed by an ATTRIBUTE, that attribute’s value, because neither an
 * `aria-label` nor a `title` is reachable by the text path and both stayed English in
 * the Hebrew UI until they were keyed. The Hebrew values are the mockup’s own
 * `const HE = {…}` table. Adding a key the mockup does not declare, or dropping one it
 * does, fails `test/ui/strings-parity.test.ts` in the direction that names it. If the
 * mockup and the product are agreed to diverge, the mockup changes first.
 *
 * Three brace grammars, and two of them are value slots:
 *
 *   {name}     a value substitution, performed by t() in i18n.js and rendered as a
 *              bidi-ISOLATED element — `<span class="v">`, whose entire styling is
 *              `unicode-bidi:isolate`. The run takes the paragraph’s own direction, so
 *              a Hebrew sentence reads a Hebrew value the Hebrew way; what it does NOT
 *              do is dissolve into the prose. This block used to call it a TEXT node
 *              taking the paragraph’s direction like any other prose; the mockup’s
 *              corrected grammar says the code has never done that, and the wrong half
 *              was the COMMENT. The mockup spells it `{v:name=sample}`, because it has
 *              to keep drawing a realistic number on screen; `sample` is the mockup’s
 *              business and never travels here.
 *
 *   {mv:name}  the same substitution, rendered the way `{m:…}` is: a monospace,
 *              bidi-ISOLATED element built around the substituted value. It is what
 *              an id, a branch, a commit SHA, a path, a glob or a scope takes — data
 *              that is not prose and must not be laid out as prose. The mockup spells
 *              it `{mv:name=sample}`. It is NOT interchangeable with `{name}`: nine
 *              slots over eight keys once shipped as plain `{name}`, and two of them
 *              regressed visibly — `cap.already` and `pr.item`, a glob and an item id
 *              inside RTL prose, lost isolation they had already shipped with.
 *
 *   {m:…}      a monospace, direction-known run — an identifier, path, glob, command
 *              or flag embedded in prose. It is NOT a value slot: the text between
 *              the braces is literal and is the same in both languages. t() builds it
 *              as a real element rather than as text, so an LTR identifier inside RTL
 *              prose is isolated in both languages rather than only in English.
 *
 * So t() owes each marker one of two treatments and never a third: `{name}` becomes a
 * bidi-isolated element; `{m:…}` and `{mv:name}` become that same isolate PLUS
 * `direction:ltr` and the mono face, and the only difference between those two is
 * whether the run’s text comes from this table or from the data. All THREE build an
 * element, which is what makes the next sentence true: a t() that returns a STRING can
 * honour none of them — a string cannot carry an element, so the isolation is flattened
 * at the one moment it is needed, and an unparsed `{mv:branch}` renders its braces on
 * screen.
 *
 * A slot is NOT free of language. Hebrew is RTL and inflects, so a slot sits where
 * Hebrew grammar wants it rather than where English put it; `preview.carried` had to
 * take a numeral where the Hebrew once spelled the number out, because a slot cannot
 * inflect for gender; and `strip.inSync` writes `origin/{mv:branch}` in English but
 * `{mv:branch} ב‑origin` in Hebrew, because a bare `origin/` immediately before an
 * isolated run resolves to the wrong VISUAL order in an RTL paragraph — a reader
 * would see `main/origin`. None of those three is a defect to tidy.
 *
 * `test/ui/strings-parity.test.ts` compares the `{m:…}` runs key for key, and the
 * value-slot NAMES — `{name}` and `{mv:name}` alike — key for key in both directions.
 *
 * What no test here checks, said so a green suite is not mistaken for verified
 * Hebrew: translation freshness. A Hebrew value left stale by an English edit passes
 * every assertion. That remains a review obligation.
 */

export const lang = 'he';
export const dir = 'rtl';

export const strings = {
  // Chrome — the top bar, the session and focus popovers, the rail
  'top.focus': 'מיקוד',
  'top.session': 'שיחה',
  'title.empty': 'מעבר לתצוגת אפס נתונים',
  'aria.sesspop': 'שיחה',
  'sess.title': 'שיחה',
  'sess.name': 'שמות הם רשות ו‑mycontext מחזיקה בהם. שיחה שאיש לא נתן לה שם שומרת על המזהה והקידומת שלה — לא מומצא לה דבר, כי שם נגזר עלול להיות שגוי ומתן שם הוא בדיוק הרגע שבו יודעים למה השיחה שימשה. {m:mycontext session name} · {m:/mycontext-session} — בחירה ומתן שם עובדים גם בלי הממשק הזה.',
  'sess.cold': 'שיחה קרה',
  'sess.coldn': 'ללא קבוצת נראו',
  'sess.coldhelp': 'שאלה אחרת, לא תצוגה אחרת: מה שיחה חדשה לגמרי הייתה מקבלת על הקובץ הזה.',
  'sess.parent': 'התצוגות המקדימות הן של השרשור ההורה. לסוכן משנה יש מפתח משלו.',
  'aria.focuspop': 'מיקוד',
  'focus.title': 'מיקוד',
  'focus.live': 'המיקוד שמוגדר',
  'focus.off': 'ללא מיקוד',
  'focus.offn': 'ללא צמצום',
  'focus.help': 'ללא מיקוד עונה על שאלה אחרת. ברירת המחדל היא תמיד מה ש‑Claude באמת מקבל.',
  'aria.rail': 'מסכים',
  'nav.inj': 'הזרקה — מה מגיע',
  's.preview': 'תצוגת הזרקה',
  's.coverage': 'כיסוי היקף',
  's.gaps': 'פערי כיסוי',
  's.simulate': 'סימולטור תקציב',
  's.injected': 'מוזרק כעת',
  'nav.ev': 'ראיות — למה כן או לא',
  's.watch': 'זרם ביקורת',
  's.ask': 'שאילתה',
  's.doctor': 'אבחון',
  's.decay': 'דעיכה',
  's.graph': 'קשרים',
  's.status': 'מצב',
  'nav.ch': 'שינוי — מורכב, לא מורץ',
  's.work': 'תור סקירה',
  's.capture': 'תיעוד',
  's.palette': 'מרכיב פקודות',
  's.config': 'הגדרות',
  's.proc': 'נהלים',
  's.port': 'ייצוא / ייבוא',
  's.packs': 'חבילות תבנית',
  'nav.read': 'קריאה',
  's.docs': 'תיעוד',
  's.tut': 'מדריכים',
  's.learn': 'לימוד',
  // Injection preview
  'preview.h': 'תצוגת הזרקה',
  'preview.v': 'בדיוק מה ש‑Claude מקבל',
  'preview.sub': 'מה שהשיחה האחרונה קיבלה בתחילתה. בחרו קובץ כדי לראות אירוע כלי במקום.',
  'preview.ev': 'אירוע',
  'preview.evl': 'אירוע',
  'help.more': 'מה מכריע כאן',
  'help.p1': 'חמישה קלטים מצמצמים זאת — כולם, אחרת זו שאלה אחרת.',
  'help.p2': 'המסך הזה קורא בלבד.',
  'preview.delivered': 'נמסר',
  'preview.cap': '{items} פריטים, {used} מתוך {budget} אסימונים',
  'th.item': 'פריט',
  'th.tier': 'רמה',
  'tier.carried': 'הועבר',
  'preview.carried': '{lines} שורות אינדקס הועברו מהשיחה {mv:session}. מוצג כאן וב‑{m:mycontext context} באופן זהה — פריט שמגיע ממקום שאינכם רואים הוא אותו פגם כמו פריט שנשמט בשקט, רק מהכיוון ההפוך.',
  // The other three clauses of the same disclosure. The ids and their reasons
  // stay together in ONE isolated LTR run: the reason is English because
  // `core/select.ts` · `function carriedDropReason(` · ~502 is the only place
  // it is spelled, and an English run inside Hebrew prose is read left to right
  // or it is not read at all.
  'index.carriedDropped': '{dropped} מזהים שהועברו לא קיבלו שורה: {mv:ids}.',
  'index.carriedDisplaced': '{displaced} משורותיה של השיחה הזו עצמה נדחקו כדי לפנות מקום: {mv:ids}.',
  'index.carriedFetch': 'שלפו כל אחד מהם באמצעות {m:mycontext show <id>}.',
  'preview.why': 'למה לא — השער הראשון שנכשל',
  'aria.gatepick': 'פריט',
  'preview.whyn': 'השערים בסדר של {m:select()} עצמו — כשירות, רמה, מיקוד, היקף, נראו, תקציב — כי הסדר הוא ההסבר: רשימה של שש סיבות היא רעש, והסיבה הכובלת נושאת משמעות רק במקום שהיא תופסת. השלבים שמעליה עברו, השלב עצמו נושא את האבחנה, וכל מה שמתחתיו לא נבדק כלל ולא עבר. הרכבת התיקון נשענת על קוד יציב ב‑{m:injection()}, כך שכל סיבה מזוהה בקוד ולא רק בניסוח האנגלי.',
  'preview.ribbon': 'סרט התקציב — ארבע רמות, ומה נשר מכל אחת',
  'preview.ribbonn': 'מקטע אחד לכל פריט שהתקבל, ברוחב ה‑{m:itemCost} האמיתי שלו. מתחת לכל מסלול נמצאת נתיב הרפאים: כל פריט שנשפך, ברוחב שהיה תופס, במקום שבו הבורר שקל אותו. רפאים רחבים ואחריהם מילוי צר הם first-fit במלוא כנותו — ציור השפיכות כזנב היה מסלף את האלגוריתם. רמה שהאירוע הזה אינו מגיע אליה מצוירת כנעדרת, מקווקוות ומוסברת; מסלול ריק היה טוען שהיא רצה ולא מסרה דבר, וזו עובדה אחרת. עוקב אחרי בורר האירועים שלמעלה במקום להוסיף שני.',
  // Scope coverage
  'cov.h': 'כיסוי היקף',
  'cov.v': 'הפערים הם העיקר',
  'cov.sub': 'כל נתיב, צבוע לפי מה שחל עליו — דרך {m:matchesScope} ו‑{m:injection()}, לעולם לא התאמת גלוב חשופה.',
  'cov.pin': 'מוצמד — חל על כל נתיב',
  'help.whyTree': 'למה אלה אינם בעץ',
  'cov.pinhelp': 'פריט {m:always:true} חל על כל נתיב. צביעה לפי נתיב היא הסיבה שספרייה שכן נשלטת נראתה כפער.',
  'cov.tree': 'מאגר',
  'cov.magn': 'כל שורה נושאת גודל, לא רק מצב: הפס הוא נשלט / ללא כלל / לא נבדק מבין הקבצים המקובצים תחתיה, והמניין הוא {m:governed of total}. ארבע נקודות קטגוריות אמרו אילו שורות אפלות; הן לא יכלו לומר כמה. הנקודה נשארת כי צורתה שורדת מונוכרום; העומק הוא צעד {m:data-depth}, ולכן הוא מתהפך נכון.',
  'cov.k1': 'בהיקף',
  'cov.k2': 'פריט אחד',
  'cov.k3': 'פער',
  'cov.k4': 'לא נבדק',
  'cov.gov': 'מה חל על',
  'cov.e1': 'עדיין דבר אינו חל על הפרויקט הזה.',
  'cov.e2': 'זהו המצב הרגיל של סביבה חדשה. משפט אחד, פעם אחת.',
  'btn.refresh': 'רענון',
  'btn.copy': 'העתקה',
  // Coverage gaps
  'gaps.h': 'פערי כיסוי',
  'gaps.v': 'מציין מה חסר',
  'gaps.sub': 'ספריות שאף פריט אינו מכסה, וקטגוריות ריקות.',
  'th.where': 'היכן',
  'th.what': 'מה',
  'th.act': 'הבא',
  'gaps.r1': '{files} קבצים, אף פריט אינו בהיקף כאן',
  'btn.compose': 'הרכבה',
  'gaps.r2': 'מעבר למגבלת הקבצים',
  'gaps.cat': 'קטגוריה {m:open_question}',
  'gaps.r3': 'ריקה',
  'gaps.note': '"לא נבדק" הוא מצב שלישי, לעולם לא מקופל לתוך "פער".',
  // Budget simulator
  'sim.h': 'סימולטור תקציב',
  'sim.v': 'כל ארבע הרמות',
  'sim.sub': 'גררו תקציב וראו מה נכנס. העלאת תקציב יכולה לפלוט פריט.',
  'sim.stair': 'גרם מדרגות הקבלה — כמה פריטים נכנסים, לפי תקציב',
  'aria.tierBudget': 'תקציב הרמה באסימונים',
  'aria.tierpick': 'רמה',
  'sim.stairn': 'הסריקה מדויקת ואינה נדגמת — הבורר מורץ מחדש בכל עלות מצטברת של מועמד, ולכן דבר אינו מומצא בין שתי מדרגות. העלויות לפי פריט הן {m:itemCost}, שהיום פרטי ב‑{m:select.ts}: ייצוא אחד, והתרשים חי.',
  'sim.thresh': 'ספים',
  'sim.snap': 'כל ערך בין שתי מדרגות מתנהג באופן זהה, ולכן המחוון נצמד למדרגות — הגרירה נוחתת על משמעות ולא על {offrung}. מדרגה אדומה היא פינוי: יותר תקציב, פחות פריטים.',
  'sim.tier': 'רמה',
  'sim.budget': 'תקציב',
  'sim.fits': 'נכנס',
  'sim.spills': 'נשפך',
  'sim.chipn': 'עמודת הנכנסים היא יחס, לא מניין: "{fits} מתוך {eligible}" אומר כמה ממה שהיה כשיר באמת הגיע, והשבב מתהפך בגבול. השורה של הרמה הנגררת עוקבת אחרי המחוון.',
  'help.whyBudget': 'למה העלאת תקציב עלולה להסיר פריט',
  'sim.evict': '{m:fitToBudget} הוא first-fit: תקציב גדול יותר מכניס פריט גדול מוקדם, שיכול לדחוק שניים קטנים.',
  'sim.ratio': 'נבחר, ואז לא נמסר',
  'sim.ration': 'הנמסר גדל מהמרכז לכיוון תחילת הקריאה, הנשפך לכיוון סופה, ושניהם מנורמלים למניין הגדול בטבלה. חצי אדום ארוך נוקב באיזה תקציב קטן מדי — השאלה שהסימולטור הזה קיים כדי לענות עליה. שני המספרים מגיעים מ‑{m:audit_item.role} דרך {m:topItems} — כבר מיוצא, כבר מאונדקס, נקרא פעמיים.',
  // Injected now
  'inj.h': 'מוזרק כעת',
  'inj.v': 'חי, לא היפותטי',
  'inj.sub': 'מה שחלון ההקשר קיבל בפועל, מקובץ הנראו.',
  'th.when': 'מתי',
  'inj.note': 'נקרא מקובץ הנראו, לא מ‑{m:Ledger.seen} — זו הקרנה משוחזרת.',
  // Audit stream
  'watch.h': 'זרם ביקורת',
  'watch.v': 'התיעוד היחיד של מה שנשפך',
  'watch.sub': 'שישה סוגי רשומות. שינוי מיקוד הוא שינוי משטר.',
  'watch.pulsen': 'דופק פעילות — עמודה לכל עשר שניות, החדשה בקצה הקריאה. הגובה הוא מספר הרשומות באותה עמודה, הצבע הוא סוג הרשומה. זה הדבר היחיד שגורם לזרם חי להיראות חי, ודליי הזמן שהוא דורש כבר מאונדקסים ב‑{m:idx_audit_at}.',
  'aria.wfilters': 'סינון',
  'watch.all': 'הכול',
  'th.at': 'בשעה',
  'th.kind': 'סוג',
  'watch.shown': '{records} רשומות',
  'watch.streamWaiting': 'מחובר — ממתין לרשומה הבאה',
  'watch.streamFault': 'הזרם סירב להמשיך: {error}',
  'watch.resync': 'יומן הביקורת התחלף או הועבר — הקריאה ממשיכה מעכשיו; רשימת ההיסטוריה שלמטה נטענה מחדש',
  'watch.delivered': '{delivered} נמסרו',
  'watch.spilled': '{spilled} נשפכו',
  'watch.tokens': '{tokens} אסימונים מוערכים, חושבו בזמן ההזרקה',
  'watch.tokensNotRecorded': 'אסימונים: לא נרשם — הרשומה קודמת לשדה. לא אפס.',
  'title.tokensNotRecorded': 'אסימונים לא נרשמו',
  'watch.voidn': 'שורת הזרקה נושאת פס זהב של עלותה מול תקציב {budget} האסימונים. כאשר {m:tokens} חסר, השורה מציירת חלל מקווקו ואומרת זאת: השדה אופציונלי ב‑{m:AuditRecord} ורשומות שנכתבו לפני 1.0.1 מעולם לא נשאו אותו. פס באורך אפס היה טענה שהרשומה אינה טוענת.',
  // Ask
  'ask.h': 'שאילתה',
  'ask.v': 'מסננים, למי שאינו כותב SQL',
  'ask.sub': 'שדות, אופרטורים וערכים — נקשרים כפרמטרים בשרת.',
  'aria.askTabs': 'את מי שואלים',
  'ask.tab.audit': 'היסטוריית ביקורת',
  'ask.tab.corpus': 'הקורפוס',
  'ask.field': 'שדה',
  'ask.field.type': 'קטגוריה',
  'ask.field.status': 'סטטוס',
  'ask.field.layer': 'שכבה',
  'ask.field.always': 'מוצמד (always)',
  'ask.field.scoped': 'יש היקף',
  'ask.field.title': 'הכותרת מכילה',
  'ask.field.any': '(הכול)',
  'ask.run': 'הרצה',
  'ask.updatedAtTrap': '{m:updated_at} הוא זמן הכתיבה לאינדקס, לא חותמת זמן של התוכן — והמסך הזה לעולם אינו בונה את האינדקס מחדש (הוא קורא בדיוק את מה שהווים קוראים), ולכן השורות הן כפי שהריצה האחרונה של וו או של שורת הפקודה הותירה אותן.',
  'ask.predefined': 'שאילתות מוגדרות מראש',
  'ask.predefined.ops': 'פעולות לפי כמות',
  'ask.predefined.spilled': 'הפריטים שנשפכו הכי הרבה',
  'ask.predefined.injected': 'הפריטים שהוזרקו הכי הרבה',
  'ask.predefined.sessions': 'שיחות',
  'ask.sqlh': 'השאילתה שהורכבה',
  'ask.sqlCaption': 'ה‑SQL שהתשובה הזאת הריצה — מוצג כדי שילמד. ה‑{m:LIMIT} האחרון כובל שורה אחת יותר מהתקרה: השורה הנוספת היא סימן הקטיעה, והיא מושמטת לפני התצוגה.',
  'ask.sqln': 'מוצגת, לעולם לא מוקלדת. השרת הרכיב אותה מהשדות שלמעלה וכרך כל ערך כפרמטר; הטקסט כאן כדי שמבנה הקורפוס יהיה ניתן ללמידה, לא כדי שניתן יהיה לערוך אותו. אין נתיב מהתיבה הזאת חזרה למסד הנתונים — {m:/api/ask} מקבל את השדות, לעולם לא את המשפט.',
  'ask.whyq': 'למה אין תיבת SQL',
  'ask.why': "חיבור {m:readOnly:true} עדיין מתיר {m:VACUUM INTO '<any path>'}. הסרת הקלט מסירה את הבעיה.",
  'ask.rows': '{rows} שורות',
  'th.role': 'תפקיד',
  'ask.truncated': 'נקטע ב‑{rows} שורות — נמצאו עוד; העלו את התקרה כדי לראות אותן',
  'list.allOf': 'מוצגים כל {total}.',
  'list.admittedOf': 'מוצגים {shown} הראשונים מתוך {total}, בסדר שבו הבורר קיבל אותם.',
  'list.recentOf': 'מוצגים {shown} העדכניים ביותר מתוך {total}.',
  'list.displayOnly': 'מגבלת תצוגה. כל {total} נכללו בהזרקה — דבר לא הושמט.',
  'list.showAll': 'הצג את כל {total}',
  'list.showFewer': 'הצג פחות',
  'doc.zero': 'נבדק — אין ממצאים ברמה זו.',
  'inj.zeroLines': 'הסשן נקרא ולא קיבל עדין דבר.',
  'inj.noSession': 'לא נבחר סשן, לכן לא נקרא דבר — וזה אינו דומה לסשן שלא קיבל דבר.',
  'rail.cntSome': 'ממתינים לטיפול: {count}',
  'rail.cntZero': 'אין דבר הדורש טיפול',
  'rail.cntNone': 'לא נמדד — נקודת הקצה של המסך הזה סירבה',
  'ask.noRows': 'לא נמצאו שורות תואמות',
  'ask.recallq': 'למה חיפוש עשוי לא להחזיר דבר',
  'ask.recall1': 'ההתאמה היום מילולית, ולכן {m:search "silently drop"} לא מוצא דבר בעוד הקורפוס אומר "dropped silently". הוחלט על חיפוש טקסט מלא עם גזירת שורשים — רק מאחורי {m:search} ו‑{m:query_items}, לעולם לא ב‑{m:select()}, כך שמה שמוזרק נשאר דטרמיניסטי.',
  'ask.recall2': 'העניין הוא היקף האחזור, לא דירוג. ההבחנה נושאת משקל: {m:core/search.ts} נושא החלטה כתובה נגד דירוג, וזה אינו נוגע בה. זו גם הסיבה שהשינוי מגיע עם מבחן שקילות — נמדד ששינוי נאיבי הוריד שאילתה אחת מארבע‑עשרה תוצאות לאחת.',
  // Doctor
  'doc.h': 'אבחון',
  'doc.v': 'רשימת ממצאים שנשטחה ל‑exit 1 היא מה שהמסוף מאבד',
  'doc.sub': 'מקובץ לפי קוד ממצא, שלוש רמות נפרדות.',
  'doc.d1': 'מסמך המקור השתנה מאז התצלום',
  'doc.d2': 'ההיקף {mv:scope} אינו תואם אף קובץ',
  'doc.d3': 'אף קובץ אינו תואם לאף תבנית נצפית, ולכן הדחיפה לתיעוד לא תוכל לפעול לעולם. ברירות המחדל מציינות שלושה נתיבים מתוך תהליך עבודה אחד; במאגר הזה אין אף אחד מהם.',
  'doc.notice': 'הודעה',
  'doc.d4': 'קיים במכונה הזו מאגר ידע נוסף החוצה פרויקטים. mycontext לעולם אינה קוראת או כותבת אליו — הדבר מדווח כדי שתדעו זאת מכאן ולא מהפתעה.',
  'doc.d5': 'תוסף אחר כותב כאן לקחים מתמשכים — אותו סוג ידע כמו {m:lesson}, באיות שני וללא מזהים משותפים. זהו נתיב נצפה, ולכן עריכה דוחפת ואדם מכריע.',
  // Decay
  'dec.h': 'דעיכה',
  'dec.v': 'תרשים, לא טבלה — של שיחות',
  'dec.sub': 'פריטים שלא הוזרקו ב‑N השיחות האחרונות. היחידה היא שיחות ולא שבועות: הפנקס מחזיק שורה אחת לכל (שיחה, פריט, רמה), והזרקה חוזרת בתוך אותה שיחה מתנגשת — ולכן מה שנשמר הוא קבוצת הזרקות ראשונות ולא זרם אירועים, וציר מול שעון היה שגוי כאן גם היכן שהיה נראה טוב יותר. היסטוריית המסירה בכרטיס השני היא מדידה אחרת ממקור אחר.',
  'dec.comb': 'מסרק רעננות — שן אחת לכל פריט, ללא דליים',
  'dec.warm': 'חמים',
  'dec.cold': 'קר',
  'dec.never': 'מעולם לא הוזרק — סוג, לא מספר גדול',
  'dec.badpin': 'מוצמד וגם קר — סימן לתקלה, לא דעיכה',
  'dec.unres': 'ללא הגבלה — מבט רוחב על קר ∪ חם, ולעולם לא דלי שלישי',
  'help.whyCold': 'מה "קר" אומר ומה אינו אומר',
  'dec.help': 'הפנקס מתעד הזרקה, לא קריאה או הסתמכות. פריט {m:always:true} קר הוא באג בבחירה, לא דעיכה.',
  'dec.heat': 'מסירה ל‑90 יום, לפי פריט — נמסר מול נשפך',
  'dec.heatn': 'תא אחד ליום. העוצמה היא כמה נמסר באותו יום, תא מקווקו הוא יום שבו הפריט נשפך, ותא ריק הוא יום שבו לא קרה דבר — שישה שבועות שקטים הם שישה שבועות של תאים ריקים ואינם דורשים קריאה. זו התצוגה היחידה שמפרידה בין "שקט" לבין "נבחר ונזרק שוב ושוב". המקור אינו הפנקס, שמתעד מסירות בלבד: הוא {m:audit_item.role} מצורף ל‑{m:audit.at}, שניהם מאונדקסים, עם מסנני {m:since} ו‑{m:until} שכבר קיימים.',
  // Relations
  'gr.h': 'קשרים',
  'gr.v': 'גרף אגו, לא סבך',
  'gr.sub': 'פריט אחד במוקד, רדיוס 1, פריסה דטרמיניסטית.',
  'gr.lfocus': 'מוקד',
  'gr.lmiss': 'היעד אינו בקורפוס',
  'gr.lsup': 'הוחלף',
  'gr.lbear': 'נושא משקל',
  'gr.lref': 'התייחסותי',
  'gr.ldang': 'תלוי באוויר',
  'gr.note': 'הצמתים נושאים מזהים, לא כותרות — מה שמוציא טקסט דו‑כיווני מכל SVG במוצר. כל קשת נושאת את סוג הקשר שלה, וסגנון הקו נושא את החומרה, כי אלה שתי עובדות שונות: {m:isLoadBearing} כבר מסווג את אוצר המילים, ולכן {m:relates_to} תלוי הוא רעש ואילו {m:constrains} תלוי הוא אזעקה. בלי זה גרף יכול להראות שבירות בלבד, לעולם לא כמה היא חשובה — ולכן הקשתות התלויות אינן זקוקות לטבלה נפרדת. הכיוון הוא הפריסה: העמודה קובעת לאן הקשר מצביע, ואין מה לדמות.',
  // Status
  'st.h': 'מצב',
  'st.v': 'טבלה היא מגרש הבית של המסוף — חריג מתועד',
  'st.sub': 'לא מסך הנחיתה.',
  'st.items': 'פריטים',
  'st.drafts': 'טיוטות הממתינות לסקירה',
  'st.pending': 'גרסאות ממתינות',
  'st.staged': 'לקחים מועמדים',
  'st.ingest': 'קליטות שלא הושלמו',
  'st.four': 'ישנם ארבעה תורים, לא אחד. {m:mycontext review} מציגה שניים מהם.',
  // Review queue
  'work.h': 'תור סקירה',
  'work.v': 'ההפרש הוא היכולת; האישור הוא הדבקה',
  'work.sub': 'התיישנות לפי שדה. דבר כאן אינו כותב.',
  'work.field': 'שדה',
  'work.now': 'בתוקף',
  'work.prop': 'מוצע',
  'work.moved': 'השתנה מאז ההעמדה',
  'work.blocked': 'הקידום מסרב עד לבסיס מחדש',
  'work.diffn': 'עמודת המוצע היא הפרש ברמת המילה, לא פסקה שנייה להשוואה בעין: תוספות נצבעות, מחיקות נמחקות בקו, ושתיהן אלמנטים אמיתיים {m:<ins>} ו‑{m:<del>} — כך שקורא מסך מכריז על השינוי בלי שום ARIA נוסף. השדה המיושן נושא קו בקצה תחילת הקריאה שלו — ההיסט הפיזי היחיד בגיליון, והמראה שלו נכתב לצדו במקום להתגלות מאוחר יותר.',
  'state.armed': 'דרוך',
  'work.state': 'הועתק, טרם נצפתה נחיתה',
  'help.land': 'איך תדעו שזה עבד',
  'work.h1': 'הריצו במעטפת שלכם. הכלי הזה לעולם אינו כותב.',
  'work.h2': 'הקבלה: רשומת ביקורת עם {m:op: promote-revision}.',
  'work.h3': 'אם הגוף זז קודם, הקידום מסרב ונוקב בשני הערכים — הסירוב הוא המוצר עובד.',
  // Capture
  'cap.h': 'תיעוד',
  'cap.v': 'מראה מה כבר חל לפני שמוסיפים עוד',
  'cap.sub': 'מרכיב פקודת {m:add}. מה שהוא מוסיף הוא בדיקת החפיפה.',
  'cap.already': 'כבר חל על {mv:scope}',
  'cap.o1': 'אינווריאנטה, נורמטיבי',
  'cap.o2': 'תקן, נורמטיבי',
  'cap.nosim': 'אלה הפריטים שההיקף שלהם תואם. אין דירוג דמיון, כי אין מדד דמיון במוצר.',
  'cap.warn': 'זו כתיבה. הריצו במעטפת שלכם.',
  // Composer
  'pal.h': 'מרכיב פקודות',
  'pal.v': 'בוררים אמיתיים ובודק גלוב חי',
  'pal.sub': 'בונה פקודה מבחירות. רשימת הארגומנטים מוצגת כשבבים.',
  'pal.argv': 'ארגומנטים',
  'pal.block': 'ההעתקה חסומה. ארגומנט אחד מכיל תחביר החלפה של מעטפת. מרכאות כפולות אינן מנטרלות {m:$(…)}.',
  'pal.glob': 'בודק גלוב',
  'pal.pattern': 'תבנית היקף',
  'pal.globn': 'כל קובץ במאגר, כשההתאמות נדלקות תוך כדי ההקלדה. מניין לבדו — "{matches} קבצים" — הוא מניין שאי אפשר לבדוק, ומניין שאי אפשר לבדוק הוא מניין שאי אפשר לסמוך עליו: התוצאה הריקה והתוצאה כמעט‑ריקה נראות זהות עד שרואים אילו קבצים. ההתאמה עוברת דרך אותו מטמון {m:globToRegExp} שהבורר משתמש בו, מעל {m:listRepoFiles}.',
  // Configure
  'cfg.h': 'הגדרות',
  'cfg.v': 'ה"מסוף לא יכול" החזק ביותר',
  'cfg.sub': 'כל שינוי כהפרש של מה שיחול, מאומת מול אותו {m:resolveConfig} שיקרא אותו.',
  'cfg.budgets': 'תקציבים',
  'cfg.effect': 'מה משתנה',
  'cfg.deltan': 'כל שורה היא הזוג, לא הכיוון לבדו: הערך הישן מחוק בקו, החדש מודגש, והשורה נצבעת לפי הכיוון שאליו זזה. "מה זה היה קודם" הוא חצי מ"מה משתנה", ושבב {m:+1} לבדו שומר על הכיוון ומאבד את ההצמדה.',
  'aria.scopepolicy': 'scopePolicy',
  'cfg.spn': 'צבע המסגרת והמניין הם רדיוס הפגיעה: כמה מהקורפוס מפסיק לעבוד אם הערך הזה משתנה. {m:inert} הוא השינוי ההרסני ביותר שההגדרות מציעות, ו‑{m:scopePolicyFor} הופך את השפעתו למחושבת במדויק ולא למשוערת — הפריטים נקובים בשם, ומה שמעבר לחתך נספר ולא מוסתר.',
  'cfg.apply': 'להחיל',
  'cfg.nocmd': 'אין פקודה שעורכת תקציב. ההגדרות הן קובץ — {m:.my_context/config.json} — וכך אומר הוו.',
  'btn.copypatch': 'העתקת התיקון',
  'cfg.watched': 'מסמכים נצפים',
  'cfg.watchednote': '{m:init} כותב את מה שיש למאגר הזה בפועל, במקום לשלוח שלושה נתיבים מתהליך עבודה אחד שאינם תואמים דבר כאן. הרשימה מחליפה ולעולם אינה ממזגת — רשימה שכתבתם אינה אמורה לקבל בשקט תבניות שלא כתבתם.',
  'cfg.h1': 'ערכו את הקובץ בעצמכם. דבר כאן אינו כותב אותו.',
  'cfg.h2': 'הקבלה: המסך קורא את {m:config.json} מחדש בכל טעינה — או שדה {m:parseError} אם ה‑JSON נשבר.',
  // Procedures
  'pr.h': 'נהלים',
  'pr.sub': 'קבוצה מסודרת של צעדים המבוצעת פעם אחת ואז מסתיימת — בניגוד לכלל, שהוא הוראה אחת החלה בכל פעם. כלל הוא הוראה יחידה; נוהל הוא רצף. הוחלט; דבר עדיין אינו מממש זאת.',
  'pr.states': 'ארבעה מצבים, ובדיוק אחד מהם מזריק',
  'th.state': 'מצב',
  'pr.mean': 'משמעות',
  'pr.inj': 'הזרקה',
  'pr.s1': 'נכתב, לא אושר. סוכן רשאי לכתוב כאן',
  'pr.none': 'אינו מוזרק',
  'pr.s2': 'אישרתם אותו',
  'pr.idx': 'שורת אינדקס בלבד',
  'pr.s3': 'יזמתם אותו',
  'pr.full': 'במלואו, בכל שיחה',
  'pr.s4': 'הושלם',
  'pr.why': 'הזרקה רק במצב {m:active} היא המנגנון, לא משפט שמבקש מהמודל להמתין. נוהל שהמודל מחזיק במלואו הוא נוהל שהוא עשוי להתחיל לבצע, ולכן הוא נמסר רק במצב שאתם שמתם אותו בו במכוון. הכשל שמפניו נשמרים אינו המובן מאליו: הוא נוהל שנשאר {m:active} לנצח ומוזרק במלואו הרבה אחרי שהעבודה הסתיימה.',
  'pr.item': '{mv:item}',
  'pr.steps': 'צעדים',
  'pr.k1': 'הוסיפו את עמודת השלמים לצד העשרונית',
  'pr.k2': 'מלאו לאחור, ואמתו שהשתיים מסכימות בכל שורה',
  'pr.k3': 'העבירו קריאות לעמודת השלמים',
  'pr.k4': 'העבירו כתיבות, מאחורי הדגל',
  'pr.k5': 'מחקו את העמודה העשרונית',
  'pr.md': 'הצעדים הם מקטע {m:## Steps} ב‑Markdown, מנותח כפי ש‑{m:## Observations} כבר מנותח. "{done} מתוך {steps}" נספר ולעולם אינו נשמר — אין מקום שני שבו נוהל יוכל לסתור את עצמו.',
  'pr.write': 'מי רשאי לסמן תיבה',
  'pr.w1': '{m:mycontext procedure step} רשאית להפוך תיבה אחת, לפי תבנית קפדנית, ואינה רשאית להגיע לאף בית אחר בפריט. היא אינה עוברת בשער הטיוטות.',
  'pr.w2': 'זו הבחנה, לא פטור. השער קיים כדי למנוע מסוכן לשנות תוכן נורמטיבי; תיבת סימון היא התקדמות. כל היפוך נרשם בביקורת, כך שההקלה גלויה ולא שקטה.',
  'pr.w3': 'מה שאינו מוקל: המצב. {m:active → done} נשאר שלכם. סימון התיבה האחרונה אינו סוגר את הנוהל — הוא מאפשר לסוכן לשאול. סוכן שיכול לסמן את הנוהל שלו כהושלם יכול להכריז על ניצחון.',
  'pr.aband': 'נטוש ולא הושלם הוא {m:superseded} — הסטטוס הקיים כבר אומר בדיוק את זה, ואיות חמישי לרעיון אחד הוא הפגם שהפרויקט הזה שילם עליו ארבע פעמים.',
  // Export / import
  'port.h': 'ייצוא / ייבוא',
  'port.sub': 'נבנה, והמסך הזה מדווח על כך. הוא נהג למנות חמש שאלות פתוחות; כולן נענו, ולכן הוא מונה כעת את התשובות.',
  'port.what': 'מה עובר',
  'port.yes': 'עובר',
  'port.filtered': 'מסונן',
  'port.no': 'נבנה מחדש',
  'port.hist': 'ההיסטוריה עוברת, והיא מסוננת. שינויים עוברים; הזרקות, פעולות וו, רשומות מיקוד, בקשות שנדחו וסימוני נהלים אינן עוברות — הן מתארות מכונה, לא קורפוס. רשומות מיובאות נוחתות ב‑{m:.audit/imported/} כך שהמקבל תמיד יכול להבחין בין מה שראה בעצמו לבין מה שסופר לו.',
  'port.fmt': 'הפורמט, לפי סדר העדפה',
  'port.f1': 'תיקייה רגילה',
  'port.f1n': 'הקנוני. קריא, ניתן להשוואה, ואינו דורש כלי כדי לפתוח אותו',
  'port.f2n': 'היכן שגיט קיים — נושא היסטוריה אמיתית, בקובץ אחד',
  'port.f3': 'ZIP דטרמיניסטי',
  'port.f3n': 'אחרת. סדר קבוע וחותמות זמן קבועות, כך שאותו קורפוס הוא אותם בתים',
  'port.git': 'מה זה מוסיף מעבר לגיט: הקורפוס כבר חי במאגר, ולכן זה נועד למי שאינו משתף אותו — סביבת עבודה אחרת, צוות אחר, או מכונה שאין לה מרוחק משותף.',
  'port.coll': 'בייבוא — שלוש קבוצות, ודבר אינו מוחל ללא אישור',
  'th.bucket': 'קבוצה',
  'th.example': 'דוגמה',
  'port.b1': 'חדש',
  'port.b2': 'אותו מזהה, תוכן שונה',
  'port.b3': 'זהה',
  // Template packs
  'pk.h': 'חבילות תבנית',
  'pk.sub': 'קורפוס שנכתב מראש ופורסם בידי מישהו — "הטעם של תעשייה מפוקחת" — מיובא ב‑{m:init} כדי להתחיל מדעה במקום מתיקייה ריקה.',
  'pk.trust': 'היכן זה נוחת, ולמה יש הבדל',
  'pk.active': 'טיוטה',
  'pk.draft': 'טיוטה',
  'pk.trustn': 'שני המסלולים נוחתים באותו אופן, והוא טיוטה — יש מאחוריהם מייבא אחד, והוא כותב כל פריט שחבילה מביאה כהצעה. בחירת חבילה ב‑init נראית כמעשה האמון, אך קורפוס ריק הוא בדיוק המקום שבו הכי קשה להבחין בדעה שלא נסקרה, ולכן הייבוא שואל במקום להניח. אין דגל {m:--trust}; גבול שדגל יכול לעקוף אינו גבול.',
  'pk.what': 'מה חבילה רשאית לשאת',
  'pk.cats': 'תצורת קטגוריות',
  'pk.never': 'לעולם לא',
  'pk.line': 'הקו, פעם אחת: חבילה נושאת את מה שהמחבר יודע על התחום; לעולם לא הגדרה שמתארת אתכם — את תקציב ההקשר שלכם או את מבנה המאגר שלכם. המחבר אינו רואה אף אחד מהם.',
  'pk.man': 'שלמות, מתוארת במדויק',
  'pk.m1': 'טביעה',
  'pk.m1n': 'מלאה, לכל קובץ, ממוינת',
  'pk.m2': 'גרסה',
  'pk.m2n': 'תיאורית, שהמחבר מספק בעת האריזה — אין כתובת גיט שממנה לגזור אחת',
  'pk.m3': 'גילוי',
  'pk.m3n': 'רשימה מלוקטת בתיעוד. אין מרשם, אין שליפה מחדש, אין בדיקת גרסה ברשת',
  'pk.m4': 'עדכון',
  'pk.m4n': 'ייבאו שוב; שלוש הקבוצות מראות מה השתנה',
  'pk.theatre': 'מה שהטביעה אינה מוכיחה. סכום ביקורת שחבילה נושאת על עצמה הוא שלמות בהעברה — הקבצים הגיעו שלמים. אין בו ראיה שהמחבר ראוי לאמון, והוא לעולם אינו משמש שער להפעלה. שדה ה‑{m:checksum} של פריט הוא קיצוץ ל‑16 תווים לזיהוי סטייה והוא דבר אחר לגמרי; מניפסט חבילה אינו עושה בו שימוש חוזר.',
  // Documentation
  'dv.h': 'תיעוד',
  'dv.v': 'מקושר לקורפוס שלכם, מה שאתר תיעוד אינו יכול',
  'dv.sub': 'ה‑README של המאגר, מוצג כאן וממוען לפי סדר הכותרת.',
  'dv.toc': 'תוכן',
  'dv.t1': 'מה זה',
  'dv.t2': 'התקנה',
  'dv.t3': 'ארבע הרמות',
  'dv.t4': 'היקף',
  'dv.t7': 'גבול האמון',
  'dv.parity': 'מתג EN/HE מנטרל את עצמו כשמבחן הזהות אדום.',
  'dv.rendered': '§{ordinal} — {heading}',
  'dv.mdnote': 'מוצג במעבד תת‑קבוצה שנכתב ביד: שום מחרוזת HTML אינה נוצרת.',
  // Tutorials
  'tu.h': 'מדריכים',
  'tu.v': 'כל אחד נושא שם של משימה, לא של תכונה',
  'tu.sub': 'שישה במקום שניים. כל תמליל הוא בלוק מיוצר.',
  'tu.t': 'מדריך',
  'tu.job': 'המשימה שהוא עונה עליה',
  'tu.1': 'עשרים הדקות הראשונות',
  'tu.j1': 'זה עתה התקנתי',
  'tu.todo': 'לכתיבה',
  'tu.2': 'כשזה לא נורה',
  'tu.j2': 'המודל עשה את הדבר האסור',
  'tu.3': 'היקף וההיקף הריק',
  'tu.j3': 'מה חל על הקובץ הזה',
  'tu.4': 'תקציבים ושפיכה',
  'tu.j4': 'למה זה לא הגיע',
  'tu.5': 'סקירה וגרסאות',
  'tu.j5': 'לסגור את מה שפתוח',
  'tu.6': 'קליטת מסמך שכבר כתבתם',
  'tu.j6': 'יש לי מפרט, לא פריטים',
  'tu.gap': 'עברית מוצגת כ"לכתיבה" ולא כמתג שהיה נופל בשקט לאנגלית.',
  // Learn
  'ln.h': 'לימוד',
  'ln.v': 'מעבר מותנה — הקישורים לקורפוס מזכים בו',
  'ln.sub': 'ארבעת נושאי העזרה, מקושרים לפריטים בקורפוס הזה.',
  'ln.c': 'אילו נורמטיביות',
  'ln.s': 'איך היקף מגביל',
  'ln.p': 'מה לתעד, ומתי',
  'ln.w': 'התור, גרסאות, החלפה',
  'aria.pane': 'פרטי פריט',
  'aria.paneclose': 'סגירה',
  // Chrome — the item detail pane, the status strip, the exit banner
  'pane.type': 'סוג',
  'pane.status': 'מצב',
  'pane.tier': 'רמה',
  'pane.scope': 'היקף',
  'pane.gov': 'חל',
  'pane.file': 'קובץ',
  'pane.hist': 'נמסר — שנים‑עשר שבועות',
  'pane.histn': 'שנים‑עשר דליים שבועיים מהקרנת הביקורת, מקווקווים בשבוע שבו הפריט נשפך ואפורים בשבוע שבו לא נמסר דבר. זו התשובה הזולה ביותר לשאלה "האם הדבר הזה עדיין חי", וההיסטוריה היחידה ששייכת לכל פריט ולא למסך נפרד.',
  'pane.body': 'גוף — כפי שנכתב',
  'pane.well': 'טקסט קורפוס יושב בגומחה ובתוך {m:<bdi>}.',
  'aria.prov': 'מקור',
  'title.gitState': 'לחצו כדי לעבור בין ששת מצבי git שהמפרט דורש',
  'strip.branch': 'ענף {mv:branch} @ {mv:commit}',
  'strip.detached': 'HEAD מנותק @ {mv:commit}',
  'strip.inSync': 'מסונכרן עם {mv:branch} ב‑origin',
  'strip.differs': 'שונה מ‑{mv:branch} ב‑origin',
  'strip.noUpstream': 'ללא מקור מרוחק',
  'strip.unknownTip': 'לא ניתן לקרוא את הקצה המקומי',
  'strip.notARepo': 'אינו מאגר git',
  'strip.items': 'פריטים',
  'strip.inj': 'הזרקות היום',
  'title.ctx': 'לחצו כדי לעבור בין חמשת מצבי ההקשר ובין שלוש התשובות על ידע הפרויקט',
  'strip.ctx.known': 'הקשר {pct}% ({used} מתוך {size}) — נכון לתגובה האחרונה, לפני {age}',
  'strip.ctx.notYetKnown': 'ההקשר טרם ידוע — לא הייתה קריאת API מאז הדחיסה האחרונה',
  'strip.ctx.unknown': 'ההקשר לא ידוע — גרסת Claude Code הזאת אינה שולחת {m:context_window}',
  'strip.ctx.noBridge': 'מוצג רק מה ש‑mycontext הזריקה — זה כל מה שהמספר הזה אומר. גשר שורת המצב אינו מותקן; {m:mycontext statusline install} מראה מה ההתקנה תשנה, ושואל.',
  'strip.ctx.cold': 'שיחה קרה — להשערה אין מספר הקשר חי',
  'strip.myctx': '{tokens} מתוך זה מהידע של הפרויקט ({injections} הזרקות)',
  'strip.myctxPartial': '≥{tokens} מתוך זה מהידע של הפרויקט ({injections} הזרקות, {unrecorded} לא נרשמו)',
  'strip.myctxUnavailable': 'חלקו של ידע הפרויקט אינו זמין: {error}',
  'strip.append': 'הוספת ביקורת p95',
  'strip.meas': 'נמדד',
  'strip.rt': 'הדמיית שקיפות מופחתת',
  // The provenance bar — one home for the qualifications every screen owes
  'prov.projFresh': 'כבר מעודכנת',
  'prov.projCaughtUp': '{mv:state} והשלימה לפני המענה',
  'prov.projFailed': 'לא הצליחה להשלים — לא מוצגת תשובה חלקית: {error}',
  'ex.msg': 'השרת יצא. הדף מציג את מה שידע לאחרונה.',
  'ex.stale': 'אין חיבור. רעננו את הדף — אם המצב נמשך, אין לדפדפן הזה הרשאה לשרת, והקישור שהוא הדפיס הוא הדרך חזרה.',
  'ex.ok': 'הבנתי',
};
