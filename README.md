# Vilarci Teacher

The teacher app for **Vilarci Study**, built with Expo (SDK 58). Teachers run
their own tuition batches and coaching institutes; parents and students follow
along in the Vilarci Study app.

The app keeps a copy of the teacher's batches on the phone (SQLite), so every
screen opens instantly and attendance, marks, fees, notices and batch edits
work **offline** — they upload when the internet is back.

## What a teacher can do

**Private batches**
- Create batches (subject, class, board, room, weekly timetable, monthly fee, seats, course months); edit, delete and restore them.
- Add students with a QR code, a join link or a join code; accept or decline requests; remove students.
- **Attendance:** today's classes on Home; mark present / late / absent; cancel a class with a reason or add an extra one; a month register with each student's percentage; monthly remarks for parents.
- **Tests & marks:** create tests, enter marks (or absent) for the whole class; parents see their child's score and the class average.
- **Notices:** post, pin, edit and delete notices for every parent in the batch.
- **Fees:** a month-by-month ledger per student (paid / waived), a student's own fee, WhatsApp reminders.
- **WhatsApp** a parent straight from the batch, the attendance day or the fees page.

**Coaching institutes**
- Create an institute (name, logo letters, colour, contact details) and become its owner, or join one with its **teachers' code** — the owner or an admin approves.
- **Roles:** the owner makes admins; admins add sections, subjects and teachers, approve students and record fees; teachers take attendance, tests and notices in the subjects they teach.
- **Sections** (e.g. *Class 10-A*) are what students join — one **institute code / QR** lists them all, or each section has its own code. A section has its fee, seats and course.
- **Subjects** belong to a section, each with its own teacher, room and timetable. Every student of the section is in each subject automatically.

Other screens (Honours, Homework, Syllabus…) are still shown as *Coming soon*; the **Demo** button on Home opens a preview of them with sample data.

## Run

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase URL and publishable key
npx expo start               # press a / i / w for Android, iOS or web
npm run check                # typecheck
npm run lint                 # lint
```

Use `npx expo install <package>` to add packages so versions match the SDK.
On web the local copy runs SQLite as WebAssembly (see `metro.config.js`).
