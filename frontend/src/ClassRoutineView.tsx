import React from 'react';
import { Clock, Calendar, BookOpen, User, MapPin, Printer } from 'lucide-react';
import { ClassRoutine, RoutinePeriod } from './types';

interface ClassRoutineViewProps {
  routine: ClassRoutine;
  onClose?: () => void;
  isModal?: boolean;
}

const WEEK_DAYS = [
  { key: 'SUN', label: 'Sunday' },
  { key: 'MON', label: 'Monday' },
  { key: 'TUE', label: 'Tuesday' },
  { key: 'WED', label: 'Wednesday' },
  { key: 'THU', label: 'Thursday' },
];

interface WeeklySlotFallback {
  subject: string;
  teacher: string;
  room: string;
}

const DEFAULT_WEEKLY_SUBJECTS: Record<string, Record<number, WeeklySlotFallback>> = {
  SUN: {
    1: { subject: 'Bangla 1st Paper', teacher: 'Mrs. Sultana', room: 'Room 201' },
    2: { subject: 'English 1st Paper', teacher: 'Mr. David', room: 'Room 201' },
    3: { subject: 'General Mathematics', teacher: 'Mr. Kamal', room: 'Room 201' },
    4: { subject: 'General Science', teacher: 'Dr. Farhana', room: 'Science Lab 1' },
    5: { subject: 'Bangladesh & Global Studies', teacher: 'Mr. Rafiq', room: 'Room 201' },
    6: { subject: 'ICT & Coding Lab', teacher: 'Engr. Tanvir', room: 'Computer Lab 2' },
  },
  MON: {
    1: { subject: 'General Mathematics', teacher: 'Mr. Kamal', room: 'Room 201' },
    2: { subject: 'Bangla Grammar & Essay', teacher: 'Mrs. Sultana', room: 'Room 201' },
    3: { subject: 'English Literature', teacher: 'Mr. David', room: 'Room 201' },
    4: { subject: 'ICT & Robotics Lab', teacher: 'Engr. Tanvir', room: 'Computer Lab 2' },
    5: { subject: 'Religion & Moral Studies', teacher: 'Maulana Habib', room: 'Room 201' },
    6: { subject: 'Library & Reading Hour', teacher: 'Ms. Nusrat', room: 'Central Library' },
  },
  TUE: {
    1: { subject: 'English 2nd Paper', teacher: 'Mr. David', room: 'Room 201' },
    2: { subject: 'General Science', teacher: 'Dr. Farhana', room: 'Science Lab 1' },
    3: { subject: 'General Mathematics', teacher: 'Mr. Kamal', room: 'Room 201' },
    4: { subject: 'Bangla 2nd Paper', teacher: 'Mrs. Sultana', room: 'Room 201' },
    5: { subject: 'Arts & Creative Crafts', teacher: 'Ms. Laila', room: 'Art Studio' },
    6: { subject: 'Physical Education & Sports', teacher: 'Coach Reza', room: 'Main Field' },
  },
  WED: {
    1: { subject: 'General Mathematics', teacher: 'Mr. Kamal', room: 'Room 201' },
    2: { subject: 'General Science Lab', teacher: 'Dr. Farhana', room: 'Science Lab 1' },
    3: { subject: 'Bangla Literature', teacher: 'Mrs. Sultana', room: 'Room 201' },
    4: { subject: 'English Grammar & Writing', teacher: 'Mr. David', room: 'Room 201' },
    5: { subject: 'Bangladesh & Global Studies', teacher: 'Mr. Rafiq', room: 'Room 201' },
    6: { subject: 'Debate & Public Speaking', teacher: 'Ms. Nusrat', room: 'Auditorium' },
  },
  THU: {
    1: { subject: 'Bangla Literature & Poetry', teacher: 'Mrs. Sultana', room: 'Room 201' },
    2: { subject: 'General Mathematics', teacher: 'Mr. Kamal', room: 'Room 201' },
    3: { subject: 'English Conversation', teacher: 'Mr. David', room: 'Language Lab' },
    4: { subject: 'General Science', teacher: 'Dr. Farhana', room: 'Room 201' },
    5: { subject: 'Co-Curricular Club Activity', teacher: 'Coach Reza', room: 'Club Hall' },
    6: { subject: 'Weekly Cultural Assembly', teacher: 'All Faculty', room: 'Auditorium' },
  },
};

export const ClassRoutineView: React.FC<ClassRoutineViewProps> = ({
  routine,
  onClose,
  isModal = false,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const isMorning = routine.shift.toLowerCase().includes('morning') || routine.startTime.startsWith('07');

  const timeSlots = isMorning
    ? [
        { period: 1, label: 'Period 1', startTime: '07:30', endTime: '08:15' },
        { period: 2, label: 'Period 2', startTime: '08:15', endTime: '09:00' },
        { period: 3, label: 'Period 3', startTime: '09:00', endTime: '09:45' },
        { period: 0, label: 'Tiffin & Recess Break', startTime: '09:45', endTime: '10:15', isBreak: true },
        { period: 4, label: 'Period 4', startTime: '10:15', endTime: '11:00' },
        { period: 5, label: 'Period 5', startTime: '11:00', endTime: '11:30' },
        { period: 6, label: 'Period 6', startTime: '11:30', endTime: '12:00' },
      ]
    : [
        { period: 1, label: 'Period 1', startTime: '12:30', endTime: '13:15' },
        { period: 2, label: 'Period 2', startTime: '13:15', endTime: '14:00' },
        { period: 3, label: 'Period 3', startTime: '14:00', endTime: '14:45' },
        { period: 0, label: 'Tiffin & Prayer Break', startTime: '14:45', endTime: '15:15', isBreak: true },
        { period: 4, label: 'Period 4', startTime: '15:15', endTime: '16:00' },
        { period: 5, label: 'Period 5', startTime: '16:00', endTime: '16:30' },
        { period: 6, label: 'Period 6', startTime: '16:30', endTime: '17:00' },
      ];

  const findPeriodCell = (dayKey: string, periodNum: number, defaultStart: string, defaultEnd: string): RoutinePeriod => {
    const apiMatch = routine.periods.find(
      (p) => p.day.toUpperCase().startsWith(dayKey) && p.period === periodNum
    );
    if (apiMatch) return apiMatch;

    const fallback = DEFAULT_WEEKLY_SUBJECTS[dayKey]?.[periodNum] || {
      subject: 'Academic Session',
      teacher: 'Faculty Member',
      room: 'Room 101',
    };

    return {
      period: periodNum,
      day: dayKey,
      startTime: defaultStart,
      endTime: defaultEnd,
      subject: fallback.subject,
      teacher: fallback.teacher,
      room: fallback.room,
    };
  };

  const content = (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-3">
      <div className="flex justify-between items-start flex-wrap gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 uppercase">
              {routine.shift} Shift
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
              Weekly Academic Calendar
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
            {routine.className} — Weekly Class Routine
          </h3>
          <p className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
            <Clock size={13} className="text-emerald-600" />
            <span>
              School Operating Hours: <strong className="text-slate-800">{routine.startTime} — {routine.endTime}</strong>
            </span>
            <span className="mx-1">•</span>
            <Calendar size={13} className="text-emerald-600" />
            <span>5 Days / Week (Sunday – Thursday)</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition flex items-center gap-1.5"
            onClick={handlePrint}
            title="Print Routine"
          >
            <Printer size={13} className="text-amber-400" />
            <span>Print Calendar</span>
          </button>
          {isModal && onClose && (
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Weekly Calendar Matrix Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left border-collapse min-w-[780px]">
          <thead>
            <tr className="bg-slate-900 text-white text-[11px] font-extrabold uppercase tracking-wider">
              <th className="py-2.5 px-3 border-r border-slate-800 w-36">Time & Period</th>
              {WEEK_DAYS.map((day) => (
                <th key={day.key} className="py-2.5 px-3 border-r border-slate-800 last:border-r-0 text-center">
                  <div>{day.label}</div>
                  <div className="text-[9px] font-mono text-emerald-300 font-semibold mt-0.5">{routine.className}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {timeSlots.map((slot) => {
              if (slot.isBreak) {
                return (
                  <tr key="break-row" className="bg-amber-50/90">
                    <td className="py-2 px-3 border-r border-amber-200 font-extrabold text-amber-950">
                      <div className="text-[11px]">{slot.label}</div>
                      <div className="text-[10px] font-mono text-amber-800 flex items-center gap-1 mt-0.5">
                        <Clock size={10} /> {slot.startTime} - {slot.endTime}
                      </div>
                    </td>
                    <td colSpan={5} className="py-2 px-4 text-center font-bold text-amber-900 tracking-wide text-xs">
                      {slot.label} ({slot.startTime} – {slot.endTime}) • Dining & Prayer Interval for {routine.className}
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={slot.period} className="hover:bg-slate-50/60 transition">
                  <td className="py-2.5 px-3 border-r border-slate-200 bg-slate-50/80 align-top">
                    <div className="font-extrabold text-slate-900 text-xs">{slot.label}</div>
                    <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono text-[10px] font-bold">
                      <Clock size={10} className="text-emerald-700" />
                      {slot.startTime} - {slot.endTime}
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold mt-1 truncate">
                      {routine.className}
                    </div>
                  </td>
                  {WEEK_DAYS.map((day) => {
                    const cell = findPeriodCell(day.key, slot.period, slot.startTime, slot.endTime);
                    return (
                      <td key={`${day.key}-${slot.period}`} className="p-2 border-r border-slate-100 last:border-r-0 align-top">
                        <div className="p-2 rounded-lg bg-white border border-slate-200/90 shadow-2xs hover:border-emerald-400 transition h-full flex flex-col justify-between gap-1.5">
                          <div>
                            <div className="flex items-center justify-between gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50/80 px-1.5 py-0.5 rounded">
                              <span>{cell.startTime} - {cell.endTime}</span>
                              <span className="text-[9px] uppercase text-slate-500">P{slot.period}</span>
                            </div>
                            <div className="font-extrabold text-slate-900 text-xs mt-1.5 leading-snug flex items-start gap-1">
                              <BookOpen size={12} className="text-emerald-600 shrink-0 mt-0.5" />
                              <span>{cell.subject}</span>
                            </div>
                            <div className="text-[10px] font-semibold text-indigo-700 mt-0.5 truncate">
                              {routine.className}
                            </div>
                          </div>
                          <div className="pt-1 border-t border-slate-100 flex flex-col gap-0.5 text-[10px] text-slate-500">
                            {cell.teacher && (
                              <span className="flex items-center gap-1 truncate">
                                <User size={10} className="text-slate-400 shrink-0" />
                                {cell.teacher}
                              </span>
                            )}
                            {cell.room && (
                              <span className="flex items-center gap-1 font-semibold text-slate-700">
                                <MapPin size={10} className="text-emerald-600 shrink-0" />
                                {cell.room}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Routine Quick Notice for Parents */}
      <div className="p-2.5 bg-slate-900 text-slate-200 rounded-lg text-xs flex items-start gap-2">
        <Clock size={15} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="text-[11px]">
          <strong className="text-white">Punctuality & Assembly:</strong> Students must arrive on school premises at least 15 minutes prior to the first period ({routine.startTime}). The morning national anthem & assembly takes place before Period 1.
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="max-w-6xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    );
  }

  return content;
};
