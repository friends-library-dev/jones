import { evaluate } from '@friends-library/evaluator';
import { genericDpc } from '@friends-library/types';
import { State } from '../type';

export default function chapterHtml(state: State, taskId: string, path: string): string {
  const task = state.tasks.present[taskId];
  if (!task) throw new Error(`Task ${taskId} not found`);
  const file = task.files[path];
  if (!file) throw new Error(`No file with path ${path}`);
  const adoc = file.editedContent == null ? file.content : file.editedContent;
  const dpc = genericDpc();
  dpc.asciidocFiles = [{ adoc, filename: path }];
  const result = evaluate.toPdfSrcHtml(dpc);
  return result.mergedChapterHtml();
}
