import smalltalk from 'smalltalk';
import { lintFix as fixLints } from '@friends-library/asciidoc';
import * as gh from '../lib/github-api';
import { safeLoad as ymlToJs } from 'js-yaml';
import { Slug, Url } from '@friends-library/types';
import { Task, ReduxThunk, Dispatch, State } from '../type';

export function submitTask(task: Task): ReduxThunk {
  return async (dispatch: Dispatch, getState: () => State) => {
    const { github } = getState();
    if (github.token === null) throw new Error('Github user not authenticated');

    const fixedTask = lintFix(task, dispatch, getState);
    dispatch({ type: 'SUBMITTING_TASK' });
    const pr = await tryGithub(
      async () => {
        return await gh.createNewPullRequest(fixedTask, github.user);
      },
      'SUBMIT_TASK',
      dispatch,
    );
    if (pr) {
      dispatch({
        type: 'TASK_SUBMITTED',
        payload: {
          id: task.id,
          prNumber: pr.number,
          parentCommit: pr.commit,
        },
      });
    }
  };
}

function lintFix(task: Task, dispatch: Dispatch, getState: () => State): Task {
  Object.keys(task.files).forEach(path => {
    const file = task.files[path];
    if (typeof file.editedContent !== 'string' || file.editedContent === file.content) {
      return;
    }

    const { fixed } = fixLints(file.editedContent);
    if (
      !fixed ||
      typeof fixed !== 'string' ||
      fixed.length < 8 ||
      fixed === file.editedContent
    ) {
      return;
    }

    dispatch({
      type: 'UPDATE_FILE',
      payload: { id: task.id, path, adoc: fixed },
    });
  });

  return getState().tasks.present[task.id];
}

export function resubmitTask(task: Task): ReduxThunk {
  return async (dispatch: Dispatch, getState: () => State) => {
    const { github } = getState();
    if (github.token === null) throw new Error('Github user not authenticated');

    const fixedTask = lintFix(task, dispatch, getState);
    dispatch({ type: 'RE_SUBMITTING_TASK' });
    const sha = await tryGithub(
      async () => {
        return await gh.addCommit(fixedTask, github.user);
      },
      'SUBMIT_TASK',
      dispatch,
    );
    if (sha) {
      dispatch({
        type: 'TASK_RE_SUBMITTED',
        payload: {
          id: task.id,
          parentCommit: sha,
        },
      });
    }
  };
}

export function checkout(task: Task): ReduxThunk {
  return async (dispatch: Dispatch, getState: () => State) => {
    dispatch({ type: 'START_CHECKOUT' });
    const data = await tryGithub(
      async () => {
        const repoSlug = await gh.getRepoSlug(task.repoId);
        const parentCommit = await gh.getHeadSha(repoSlug, 'master');
        const fileArray = await gh.getAdocFiles(repoSlug, parentCommit);
        const files = fileArray.reduce(
          (acc, file) => {
            acc[file.path] = file;
            return acc;
          },
          {} as any,
        );
        const yml = await fetch(friendYmlUrl(repoSlug)).then(r => r.text());
        const { documents } = ymlToJs(yml);
        const documentTitles = documents.reduce(
          (acc: any, doc: any) => {
            acc[doc.slug] = doc.title;
            return acc;
          },
          {} as { [key: string]: string },
        );
        return Promise.resolve({ documentTitles, files, parentCommit });
      },
      'CHECKOUT',
      dispatch,
    );

    if (data) {
      dispatch({
        type: 'UPDATE_TASK',
        payload: {
          id: task.id,
          data,
        },
      });
      dispatch({ type: 'END_CHECKOUT' });
    } else {
      dispatch({ type: 'CHANGE_SCREEN', payload: 'TASKS' });
    }
  };
}

type Named = { name: string };

export function fetchFriendRepos(): ReduxThunk {
  return async (dispatch: Dispatch, getState: () => State) => {
    dispatch({ type: 'REQUEST_FRIEND_REPOS' });
    let repos;
    try {
      const friendRepos = (await gh.getFriendRepos()) as Named[];
      // filter out any friend repos that don't have a yml file yet
      const ymlsPath = '/repos/:owner/:repo/contents/packages/friends/yml/en';
      const { data: ymls } = await gh.req(ymlsPath, { repo: 'friends-library' });
      repos = friendRepos.filter(repo => {
        return !!ymls.find((y: Named) => y.name === `${repo.name}.yml`);
      });
    } catch (e) {
      dispatch({ type: 'NETWORK_ERROR' });
      return;
    }
    dispatch({ type: 'RECEIVE_FRIEND_REPOS', payload: repos });
  };
}

export function requestGitHubUser(): ReduxThunk {
  return async (dispatch: Dispatch) => {
    dispatch({ type: 'REQUEST_GITHUB_USER' });
    const { data: user } = await gh.req('/user');
    dispatch({
      type: 'RECEIVE_GITHUB_USER',
      payload: {
        name: user.name,
        avatar: user.avatar_url,
        user: user.login,
      },
    });
  };
}

async function tryGithub(
  fn: () => any,
  errorType: string,
  dispatch: Dispatch,
): Promise<any> {
  let result;
  try {
    result = await fn();
  } catch (e) {
    dispatch({ type: 'NETWORK_ERROR' });
    alertGithubError(errorType);
    return false;
  }
  return result;
}

function alertGithubError(type: string) {
  smalltalk.alert('😬 <b style="color: red;">Network Error</b>', ghErrorMsgs[type]);
}

function friendYmlUrl(friendSlug: Slug): Url {
  return [
    'https://raw.githubusercontent.com/',
    `${gh.ORG}/friends-library/master/`,
    'packages/friends/yml/en/',
    `${friendSlug}.yml`,
  ].join('');
}

const ghErrorMsgs: { [key: string]: string } = {
  SUBMIT_TASK:
    'There was an error submitting your task to GitHub. Probably just a temporary glitch on their end. None of your work was lost, try submitting again in a few seconds. 🤞',
  CHECKOUT:
    'There was an error retrieving source files to edit. Probably just a temporary glitch with GitHub. Try again in a few seconds. 🤞',
};