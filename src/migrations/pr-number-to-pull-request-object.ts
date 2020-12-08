import { SavedState } from '../type';

export default function migrate(state: Partial<SavedState>): Partial<SavedState> {
  const { tasks, version } = state;
  if (typeof version == `number` && version > 1) {
    return state;
  }

  for (const id in tasks) {
    const task = tasks[id] as any;
    if (typeof task.prNumber === `number`) {
      task.pullRequest = { number: task.prNumber };
      delete task.prNumber;
    }
  }

  return state;
}
