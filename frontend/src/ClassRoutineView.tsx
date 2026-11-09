import React, { useState } from 'react';
import { Clock, Calendar, BookOpen, User, MapPin, Printer } from 'lucide-react';
import { ClassRoutine, RoutinePeriod } from './types';

interface ClassRoutineViewProps {
  routine: ClassRoutine;
  onClose?: () => void;
  isModal?: boolean;
}

const DAY_LABELS: Record<string, string> = {
  SAT: 'Saturday',
  SUN: 'Sunday',
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
};

export const ClassRoutineView: React.FC<ClassRoutineViewProps> = ({
  routine,
  onClose,
  isModal = false,
}) => {
  const [selectedDay, setSelectedDay] = useState<string>(routine.days[0] || 'SUN');

  const handlePrint = () => {
    window.print();
  };

  // Group periods by day
  const periodsByDay: Record<string, RoutinePeriod[]> = {};
  for (const day of routine.days) {
    periodsByDay[day] = routine.periods
      .filter((p) => p.day.toUpperCase() === day.toUpperCase())
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  const content = (
    <div className="routine-view-card">
      <div className="routine-header flex justify-between items-start flex-wrap gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-primary">{routine.shift} Shift</span>
            {routine.isDefault && (
              <span className="badge badge-muted text-xs">Standard Shift Schedule</span>
            )}
          </div>
          <h3 className="text-xl font-bold text-slate-800 mt-1">{routine.className} — Class Routine</h3>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
            <Clock size={13} className="text-indigo-600" />
            <span>
              School Operating Hours: <strong>{routine.startTime} — {routine.endTime}</strong>
            </span>
            <span className="mx-1">•</span>
            <Calendar size={13} className="text-emerald-600" />
            <span>{routine.days.length} Days / Week ({routine.days.join(', ')})</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm flex items-center gap-1"
            onClick={handlePrint}
            title="Print Routine"
          >
            <Printer size={14} />
            <span>Print Routine</span>
          </button>
          {isModal && onClose && (
            <button
              type="button"
              className="btn btn-muted btn-sm"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Weekday Switcher Tabs */}
      <div className="routine-day-tabs flex gap-2 mt-4 pb-2 border-b border-slate-100 overflow-x-auto">
        {routine.days.map((day) => (
          <button
            key={day}
            type="button"
            className={`btn btn-sm ${
              selectedDay === day ? 'btn-primary' : 'btn-outline text-slate-600'
            }`}
            onClick={() => setSelectedDay(day)}
          >
            {DAY_LABELS[day] || day}
          </button>
        ))}
      </div>

      {/* Periods Timeline for selected day */}
      <div className="routine-periods-grid mt-4">
        {periodsByDay[selectedDay] && periodsByDay[selectedDay].length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {periodsByDay[selectedDay].map((period, idx) => {
              const isBreak = period.period === 0 || period.subject.toLowerCase().includes('break');
              return (
                <div
                  key={`${period.day}-${idx}`}
                  className={`routine-period-card p-3 rounded-lg border ${
                    isBreak
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-white border-slate-200 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs font-semibold mb-1">
                    <span
                      className={`px-2 py-0.5 rounded ${
                        isBreak ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isBreak ? 'Recess / Break' : `Period ${period.period}`}
                    </span>
                    <span className="mono text-slate-500 flex items-center gap-1">
                      <Clock size={11} />
                      {period.startTime} - {period.endTime}
                    </span>
                  </div>

                  <h4 className="font-bold text-base text-slate-800 flex items-center gap-1.5 mt-1">
                    <BookOpen size={16} className={isBreak ? 'text-amber-600' : 'text-indigo-600'} />
                    <span>{period.subject}</span>
                  </h4>

                  {!isBreak && (
                    <div className="text-xs text-slate-500 mt-2 flex flex-col gap-1 border-t border-slate-100 pt-2">
                      {period.teacher && (
                        <div className="flex items-center gap-1">
                          <User size={12} className="text-slate-400" />
                          <span>Teacher: {period.teacher}</span>
                        </div>
                      )}
                      {period.room && (
                        <div className="flex items-center gap-1">
                          <MapPin size={12} className="text-slate-400" />
                          <span>Room: {period.room}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400">
            No periods scheduled for {DAY_LABELS[selectedDay] || selectedDay}.
          </div>
        )}
      </div>

      {/* Routine Quick Notice for Parents */}
      <div className="routine-footer-note mt-6 p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 flex items-start gap-2">
        <Clock size={16} className="text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <strong>Punctuality & Assembly:</strong> Students must arrive on school premises at least 15 minutes prior to the first period ({routine.startTime}). The morning national anthem & assembly takes place before Period 1.
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div
          className="modal-container routine-modal max-w-4xl w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    );
  }

  return content;
};

