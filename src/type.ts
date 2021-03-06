import { ActionCreator } from 'redux';

import {
  Slug,
  Url,
  Title,
  Uuid,
  Name,
  Asciidoc,
  EditionType,
  Sha,
  FilePath,
} from '@friends-library/types';

export type Dispatch = ActionCreator<any>;

export type DateString = string;

export interface Action {
  type: string;
  payload?: any;
}

export type GitHub =
  | {
      token: null;
    }
  | {
      token: string;
      name?: Name;
      avatar: Url;
      user: string;
    };

export interface SearchResultContext {
  lineNumber: number;
  content: Asciidoc;
}

export interface SearchResult {
  documentSlug: Slug;
  editionType: string;
  path: FilePath;
  filename: string;
  dismissed?: true;
  start: {
    line: number;
    column: number;
  };
  end: {
    line: number;
    column: number;
  };
  context: SearchResultContext[];
}

export interface File {
  sha: Sha;
  path: FilePath;
  content: Asciidoc;
  editedContent: Asciidoc | null;
}

export interface Task {
  id: Uuid;
  name: string;
  created: DateString;
  updated: DateString;
  repoId: number;
  isNew: boolean;
  pullRequest?: {
    number: number;
    status?: 'open' | 'merged' | 'closed';
  };
  collapsed: { [key: string]: boolean };
  sidebarOpen: boolean;
  sidebarWidth: number;
  documentTitles: { [key: string]: Title };
  files: { [key: string]: File };
  editingFile?: FilePath;
  parentCommit?: Sha;
}

export interface Repo {
  id: number;
  slug: Slug;
  friendName: Name;
}

export interface Search {
  searching: boolean;
  regexp: boolean;
  words: boolean;
  caseSensitive: boolean;
  documentSlug?: Slug;
  editionType?: EditionType;
  filename?: string;
}

export interface Tasks {
  [key: string]: Task;
}

export interface Undoable<T> {
  past: T[];
  present: T;
  future: T[];
}

export type UndoableTasks = Undoable<Tasks>;

export interface BaseState {
  version: number;
  prefs: {
    editorFontSize: number;
  };
  github: GitHub;
  screen: string;
  currentTask?: Uuid;
  repos: Repo[];
  search: Search;
  network: string[];
}

export type State = BaseState & {
  tasks: UndoableTasks;
};

export type SavedState = BaseState & {
  tasks: Tasks;
};

export type ReduxThunk = (dispatch: Dispatch, getState: () => State) => any;
