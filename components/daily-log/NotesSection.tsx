"use client";

import { NOTE_QUICK_PHRASES } from "@/lib/validations/daily-log";

type NotesSectionProps = {
  notes: string;
  onNotesChange: (value: string) => void;
};

export function NotesSection({ notes, onNotesChange }: NotesSectionProps) {
  function appendPhrase(phrase: string) {
    if (notes.includes(phrase)) return;
    const next = notes.length > 0 ? `${notes} ${phrase}` : phrase;
    onNotesChange(next);
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-base font-semibold text-[#0F2537]">今日の気づき・反省</span>
        <span className="text-xs text-slate-400">任意</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        {NOTE_QUICK_PHRASES.map((phrase) => (
          <button
            key={phrase}
            type="button"
            onClick={() => appendPhrase(phrase)}
            className="h-11 rounded-full bg-slate-100 px-4 text-sm font-medium text-slate-600 active:bg-slate-200"
          >
            + {phrase}
          </button>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        maxLength={500}
        rows={4}
        placeholder="タップで選ぶか、自由に入力してください（未入力でも送信できます）"
        className="w-full rounded-xl border border-slate-200 bg-white p-4 text-base text-[#0F2537] outline-none focus:border-[#0F2537] focus:ring-2 focus:ring-[#00A859]/20"
      />
    </div>
  );
}
