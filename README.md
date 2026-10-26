# Vilarci Teacher

The educator app for **Vilarci Study**: the mobile version of the Vilarci Study Partner portal, built with Expo (SDK 57) and the same design system as the student app.

## What a teacher can do

**Two realms**

- **My Private Batches**: your own tuition batches across classes. Filter by class, create batches, and rename or reschedule them.
- **Coaching Institutes**: institutes you own or teach at. Join by a 6-character code or create your own. Each institute workspace has:
  - My sections
  - All sections (admins)
  - Faculty (invite / remove)
  - Notices
  - Analytics
  - Profile

**The batch command deck.** A private batch and a coaching section open the same deck:

| View | Features |
| --- | --- |
| Students | Roster, attendance and fee status, family contacts (call / WhatsApp), invite link & join code, manual registration, remove student |
| Classes | Real class calendar: regular weekly days (usually 1–2 for private batches), extra classes, cancellations with reasons, WhatsApp notices to parents, registers still owed |
| Attendance | P/L/A marking on actual class dates, rotating classroom check-in code, parent WhatsApp alerts, date-by-date register; a register on an unscheduled day is saved as an extra class |
| Homework | Give homework (due at the next real class), check it per student as Full / Partial / None, parent nudges, per-student homework record |
| Points | Award +50…+200 with category and citation; leaderboard re-ranks live |
| Tests | Schedule tests, enter marks, mark absentees, weak-topic feedback, ranks / average / pass rate, CBSE grades |
| Syllabus | Planned target vs actual coverage, live delay calculation, status cycling, add / remove topics |
| Fees | Month-by-month ledger, record payments, per-student fee setup and history, WhatsApp reminders. No receipts are issued. |
| Settings | Name, room, fee, 7-day schedule editor with the canonical JSON |

Permissions follow the portal: visiting faculty cannot manage members or sections, and they see fees as read-only where the institute manages them centrally.

**Today** shows the day's classes from every realm (including extra and cancelled ones), a *Needs attention* list of unmarked registers and homework waiting to be checked, outstanding dues, topics behind schedule, and recent honours. Use **More → Switch account** to explore as any demo educator.

## Run

```bash
npm install
npx expo start        # press a / i / w for Android, iOS or web
npm run check         # typecheck
```

All data is local demo data persisted on the device. Use **Settings → Reset demo data** to restore it.
