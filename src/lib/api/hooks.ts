// React bindings over the pure selectors. Screens use only these hooks, so the
// data source can change without touching UI code.
import { useMemo } from 'react';
import { useAppStore, type DeckRef } from '../store/useAppStore';
import type { Teacher } from '../data/types';
import { todayIso } from '../utils/format';
import * as S from './selectors';

export function useDb() {
  return useAppStore((s) => s.db);
}

export function useTeacher(): Teacher {
  const db = useDb();
  const teacherId = useAppStore((s) => s.teacherId);
  return useMemo(() => S.teacherById(db, teacherId) ?? db.teachers[0], [db, teacherId]);
}

export function useTeachers(): Teacher[] {
  return useDb().teachers;
}

export function useMyBatches() {
  const db = useDb();
  const teacherId = useAppStore((s) => s.teacherId);
  return useMemo(() => S.batchesFor(db, teacherId), [db, teacherId]);
}

export function useMyInstitutes() {
  const db = useDb();
  const teacherId = useAppStore((s) => s.teacherId);
  return useMemo(() => S.institutesFor(db, teacherId), [db, teacherId]);
}

/** One institute plus everything the signed-in teacher may do in it. */
export function useInstitute(id: string) {
  const db = useDb();
  const teacherId = useAppStore((s) => s.teacherId);
  return useMemo(() => {
    const inst = db.coaching_institutes.find((i) => i.id === id) ?? null;
    // Switching accounts (or being removed) closes institutes you no longer belong to.
    if (!inst || !S.isMember(inst, teacherId)) return null;
    return {
      inst,
      teacherId,
      isOwner: S.isOwner(inst, teacherId),
      role: S.roleLabel(inst, teacherId),
      canManageMembers: S.can(inst, teacherId, 'can_manage_members'),
      canCreateSections: S.can(inst, teacherId, 'can_create_sections'),
      mySections: S.mySections(inst, teacherId),
      teacherName: (tid: string) => S.teacherById(db, tid)?.name ?? 'Faculty',
      teacher: (tid: string) => S.teacherById(db, tid),
    };
  }, [db, id, teacherId]);
}

export function useInstituteAnalytics(id: string) {
  const db = useDb();
  return useMemo(() => {
    const inst = db.coaching_institutes.find((i) => i.id === id);
    return inst ? S.instituteAnalytics(db, inst) : null;
  }, [db, id]);
}

/** Everything a batch command deck renders, recomputed on any store edit. */
export function useDeck(ref: DeckRef) {
  const db = useDb();
  const teacherId = useAppStore((s) => s.teacherId);
  return useMemo(() => {
    const deck = S.resolveDeck(db, ref, teacherId);
    if (!deck) return null;
    const roster = S.studentsOf(db, deck.studentIds);
    const sessions = S.sessionsFor(db, deck.ref.id);
    const homework = S.homeworkFor(db, deck.ref.id);
    const today = todayIso();
    return {
      deck,
      roster,
      sessions,
      today,
      rateOf: (studentId: string) => {
        const st = roster.find((s) => s.id === studentId);
        return st ? S.attendanceRate(st, sessions) : 0;
      },
      homework,
      homeworkToCheck: S.homeworkToCheck(homework, today),
      homeworkOf: (studentId: string) => S.studentHomework(studentId, homework),
      /** Calendar between two ISO dates, cancellations included. */
      calendar: (from: string, to: string) => S.classCalendar(db, deck, from, to),
      todayClass: S.heldClasses(db, deck, today, today)[0] ?? null,
      nextClass: S.nextClassAfter(db, deck, today),
      nextClassAfter: (date: string) => S.nextClassAfter(db, deck, date),
      upcoming: (count: number) => S.upcomingClasses(db, deck, today, count),
      unmarked: S.unmarkedClasses(db, deck, today, 14),
      tests: S.testsFor(db, deck.ref.id),
      topics: S.topicsFor(db, deck.ref.id),
      dispatches: S.dispatchesFor(db, { deckId: deck.ref.id }),
    };
    // ref is a fresh object on every navigation render; key on its fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, teacherId, ref.type, ref.id, ref.instituteId]);
}

export function useTodayPlan(date = todayIso()) {
  const db = useDb();
  const teacherId = useAppStore((s) => s.teacherId);
  return useMemo(() => S.classesOn(db, teacherId, date), [db, teacherId, date]);
}

/** Portfolio rollup for the Today screen. */
export function usePortfolio() {
  const db = useDb();
  const teacherId = useAppStore((s) => s.teacherId);
  return useMemo(() => {
    const today = todayIso();
    const month = today.slice(0, 7);
    const refs = S.allDecksFor(db, teacherId);
    const decks = refs.map((r) => S.resolveDeck(db, r, teacherId)).filter((d): d is S.Deck => Boolean(d));
    const studentIds = new Set(decks.flatMap((d) => d.studentIds));

    // Fee dues only count where this teacher actually collects.
    const dues = decks
      .filter((d) => d.canManageFees)
      .map((d) => {
        const roster = S.studentsOf(db, d.studentIds);
        const owing = roster
          .map((s) => ({ student: s, cells: S.arrears(s, month) }))
          .filter((x) => x.cells.length > 0);
        return {
          deck: d,
          owing,
          amount: owing.reduce((sum, x) => sum + x.cells.reduce((a, c) => a + c.amount, 0), 0),
        };
      })
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const delayed = decks.flatMap((d) =>
      S.topicsFor(db, d.ref.id)
        .filter((t) => t.status !== 'covered' && S.topicVariance(t, today).delayed)
        .map((t) => ({ deck: d, topic: t, variance: S.topicVariance(t, today) })),
    );

    const dispatches = S.dispatchesFor(db, { teacherId });
    const monthPoints = dispatches.filter((d) => d.date.startsWith(month)).reduce((sum, d) => sum + d.points, 0);
    const markedToday = new Set(db.attendance_sessions.filter((s) => s.date === today).map((s) => s.context_id));

    // Classes already held this week with no register saved yet.
    const unmarked = decks.flatMap((d) => S.unmarkedClasses(db, d, today, 7).map((c) => ({ deck: d, occurrence: c })));
    // Homework due by today that nobody has checked.
    const toCheck = decks.flatMap((d) =>
      S.homeworkToCheck(S.homeworkFor(db, d.ref.id), today).map((h) => ({ deck: d, homework: h })),
    );

    return {
      today,
      decks,
      batchCount: S.batchesFor(db, teacherId).length,
      instituteCount: S.institutesFor(db, teacherId).length,
      studentCount: studentIds.size,
      dues,
      // A student's ledger is shared across batches, so count each student once.
      duesTotal: [...new Map(dues.flatMap((d) => d.owing).map((o) => [o.student.id, o])).values()].reduce(
        (sum, o) => sum + o.cells.reduce((a, c) => a + c.amount, 0),
        0,
      ),
      delayed,
      unmarked,
      toCheck,
      recentDispatches: dispatches.slice(0, 4),
      monthPoints,
      isMarkedToday: (deckId: string) => markedToday.has(deckId),
    };
  }, [db, teacherId]);
}

export function useDispatchLog() {
  const db = useDb();
  const teacherId = useAppStore((s) => s.teacherId);
  return useMemo(() => S.dispatchesFor(db, { teacherId }), [db, teacherId]);
}

/** Next real class (extra classes and cancellations applied) per private batch. */
export function useBatchNextClasses() {
  const db = useDb();
  const teacherId = useAppStore((s) => s.teacherId);
  return useMemo(() => {
    const today = todayIso();
    const out: Record<string, S.ClassOccurrence | null> = {};
    for (const b of S.batchesFor(db, teacherId)) {
      const deck = S.resolveDeck(db, { type: 'private_batch', id: b.id }, teacherId);
      out[b.id] = deck ? S.upcomingClasses(db, deck, today, 1)[0] ?? null : null;
    }
    return { today, next: out };
  }, [db, teacherId]);
}
