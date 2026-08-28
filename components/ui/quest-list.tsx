import { es, fill } from "@/lib/copy/es";

/**
 * The three daily quests (PRD F8).
 *
 * Progress, never a deadline. A quest the learner does not finish simply ends
 * the day unfinished — there is no countdown, no warning, and no copy for
 * failing one, because the product does not have that idea. The speaking quest
 * comes first because it is the one the whole thing is for.
 */
export type QuestView = {
  type: keyof typeof es.home.quests;
  target: number;
  progress: number;
  completed: boolean;
};

export function QuestList({ quests }: { quests: QuestView[] }) {
  if (quests.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-muted">{es.home.questsTitle}</h2>
      <ul className="flex flex-col gap-2">
        {quests.map((quest) => (
          <li
            key={quest.type}
            className="flex items-center gap-3 rounded-2xl border-2 border-line bg-surface px-4 py-3"
          >
            <Tick done={quest.completed} />
            <span className={`flex-1 text-base ${quest.completed ? "text-faint" : "text-ink"}`}>
              {fill(es.home.quests[quest.type], { target: quest.target })}
            </span>
            <span className="text-base text-faint">
              {quest.completed ? es.home.questDone : `${quest.progress}/${quest.target}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tick({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
        done ? "border-primary bg-primary text-primary-ink" : "border-line"
      }`}
    >
      {done && (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3.5"
             strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 13 4 4L19 7" />
        </svg>
      )}
    </span>
  );
}
