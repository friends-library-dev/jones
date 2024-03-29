import { Octokit } from '@octokit/rest';
import { Base64 } from 'js-base64';
import { Lang } from '@friends-library/types';
import { Task, File } from '../type';

const isDev = process.env.NODE_ENV === `development`;

const GITHUB_ORG = process.env.GITHUB_ORG || `friends-library`;
export const ORG = GITHUB_ORG;
export const LANG: Lang = ORG === `biblioteca-de-los-amigos` ? `es` : `en`;

type RepoSlug = string;
type BranchName = string;

export interface GitFile {
  path: string;
  sha: string;
  content: string;
}

let gh = new Octokit();

export function authenticate(token: string): void {
  gh = new Octokit({
    auth: `token ${token}`,
  });
}

export function deleteBranch(owner: string, repo: RepoSlug, branch: BranchName): void {
  owner = ORG; // while not supporting forks
  gh.git.deleteRef({ owner, repo, ref: `heads/${branch}` });
}

export async function pullRequestStatus(
  repo: RepoSlug,
  number: number,
): Promise<'open' | 'merged' | 'closed'> {
  const res = await gh.pulls.get({ owner: ORG, repo, pull_number: number });
  if (res.data.merged_at !== null) {
    return `merged`;
  }
  if (res.data.closed_at !== null) {
    return `closed`;
  }
  return `open`;
}

export async function getFriendRepos(): Promise<Record<string, any>[]> {
  const repos = await gh.paginate(`/orgs/${ORG}/repos`);
  return repos.filter((repo) => repo.name !== ORG);
}

export async function getRepoSlug(repoId: number): Promise<string> {
  const {
    data: { name: slug },
  } = await req(`/repositories/:id`, { id: repoId });
  return slug;
}

export async function getHeadSha(
  repo: RepoSlug,
  branch: BranchName = `master`,
): Promise<string> {
  const response = await req(`/repos/:owner/:repo/git/refs/:ref`, {
    repo,
    ref: `heads/${branch}`,
  });
  const {
    data: {
      object: { sha },
    },
  } = response;
  return sha;
}

export async function getAdocFiles(repo: RepoSlug, sha: string): Promise<GitFile[]> {
  const tree = await getTree(repo, sha);
  const filePromises = tree.filter(isAsciidoc).map(async (blob) => {
    const {
      data: { content },
    } = await req(`/repos/:owner/:repo/git/blobs/:sha`, {
      repo,
      sha: blob.sha,
    });
    return {
      path: blob.path,
      sha: blob.sha,
      content: Base64.decode(content),
    };
  });

  return await Promise.all(filePromises);
}

export async function getTree(
  repo: RepoSlug,
  sha: string,
): Promise<
  {
    sha: string;
    path: string;
    type: string;
  }[]
> {
  const {
    data: { tree },
  } = await req(`/repos/:owner/:repo/git/trees/:sha?recursive=1`, {
    repo,
    sha,
  });
  return tree;
}

async function createFork(repo: RepoSlug, user: string): Promise<void> {
  await req(`POST /repos/:owner/:repo/forks`, {
    repo,
  });
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      const forkExists = await hasFork(repo, user);
      if (forkExists) {
        clearInterval(interval);
        resolve();
      }
    }, 250);
  });
}

async function hasFork(repo: RepoSlug, user: string): Promise<boolean> {
  try {
    await req(`/repos/:owner/:repo`, {
      owner: user,
      repo,
    });
    return true;
  } catch (e) {
    return false;
  }
}

async function syncFork(repo: RepoSlug, user: string): Promise<void> {
  const upstream = await req(`/repos/:owner/:repo/git/refs/:ref`, {
    repo,
    ref: `heads/master`,
  });

  await req(`PATCH /repos/:owner/:repo/git/refs/:ref`, {
    sha: upstream.data.object.sha,
    owner: user,
    repo,
    ref: `heads/master`,
  });
}

export async function ensureSyncedFork(repo: RepoSlug, user: string): Promise<void> {
  const forkExists = await hasFork(repo, user);
  if (!forkExists) {
    await createFork(repo, user);
  }
  await syncFork(repo, user);
}

export async function addCommit(task: Task /*, user: string */): Promise<string> {
  const { parentCommit = ``, repoId, id, files } = task;
  const branchName = `task-${id}`;
  const repo = await getRepoSlug(repoId);
  const baseTreeSha = await getTreeSha(repo, parentCommit);
  const newTreeSha = await createTree(repo, baseTreeSha, files);
  const msg = `updates to task: ${task.name}`;
  const newCommitSha = await createCommit(repo, newTreeSha, parentCommit, msg);
  await updateHead(repo, branchName, newCommitSha);
  return newCommitSha;
}

export async function createNewPullRequest(
  task: Task,
  user: string,
): Promise<{ number: number; commit: string }> {
  const { parentCommit = ``, repoId, id, files } = task;
  const branchName = `task-${id}`;
  const repo = await getRepoSlug(repoId);
  // create branch WITHIN org for now, because lint action doesn't have
  // permission to create a check: https://github.community/t/115708
  // await ensureSyncedFork(repo, user);
  await createBranch(repo, branchName, parentCommit);
  const baseTreeSha = await getTreeSha(repo, parentCommit);
  const newTreeSha = await createTree(repo, baseTreeSha, files);
  const newCommitSha = await createCommit(repo, newTreeSha, parentCommit, task.name);
  await updateHead(repo, branchName, newCommitSha);
  const prNumber = await openPullRequest(repo, branchName, task.name, user);
  return {
    commit: newCommitSha,
    number: prNumber,
  };
}

async function openPullRequest(
  repo: RepoSlug,
  branch: BranchName,
  title: string,
  user: string,
): Promise<number> {
  const body = getPrBody(user);
  const {
    data: { number },
  } = await req(`POST /repos/:owner/:repo/pulls`, {
    repo,
    title,
    owner: ORG,
    head: branch, // fork: `${user}:${branch}`,
    base: `master`,
    body,
    maintainer_can_modify: true,
  });
  return number;
}

function getPrBody(user: string): string {
  if (isDev || user === `jaredh159` || user === `Henderjay`) {
    return ``;
  }

  if (ORG === `biblioteca-de-los-amigos`) {
    return `@Henderjay`;
  }

  return ORG === `friends-library` ? `@jaredh159 @Henderjay` : ``;
}

async function updateHead(
  repo: RepoSlug,
  branch: BranchName,
  sha: string,
  owner: string = ORG,
): Promise<void> {
  await req(`PATCH /repos/:owner/:repo/git/refs/:ref`, {
    repo,
    owner,
    ref: `heads/${branch}`,
    sha,
  });
}

async function createCommit(
  repo: RepoSlug,
  treeSha: string,
  parent: string,
  message: string,
  owner: string = ORG,
): Promise<string> {
  const {
    data: { sha },
  } = await req(`POST /repos/:owner/:repo/git/commits`, {
    owner,
    repo,
    message,
    tree: treeSha,
    parents: [parent],
  });
  return sha;
}

async function createTree(
  repo: RepoSlug,
  baseTreeSha: string,
  files: { [key: string]: File },
  owner: string = ORG,
): Promise<string> {
  const {
    data: { sha },
  } = await req(`POST /repos/:owner/:repo/git/trees`, {
    repo,
    owner,
    base_tree: baseTreeSha,
    tree: Object.values(files)
      .filter(validContent)
      .map((f) => ({
        path: f.path,
        mode: `100644`,
        type: `blob`,
        content: f.editedContent,
      })),
  });
  return sha;
}

function validContent(file: File): boolean {
  if (!file.editedContent) {
    return false;
  }
  if (file.editedContent === `null`) {
    return false;
  }
  return true;
}

export async function createBranch(
  repo: RepoSlug,
  newBranchName: BranchName,
  parentCommit: string,
  owner: string = ORG,
): Promise<{ branch: BranchName; sha: string }> {
  const res = (await gh.git.createRef({
    owner,
    repo,
    sha: parentCommit,
    ref: `refs/heads/${newBranchName}`,
  })) as any;
  if (res.status === 201) {
    return res.data.object.sha;
  }
  throw new Error(`Failed to create branch ¯\\_(ツ)_/¯`);
}

export async function getTreeSha(
  repo: RepoSlug,
  sha: string,
  owner: string = ORG,
): Promise<string> {
  const res = await req(`/repos/:owner/:repo/git/commits/:sha`, {
    owner,
    repo,
    sha,
  });
  return res.data.tree.sha;
}

export async function req(route: string, opts: any = {}): Promise<any> {
  if (route.match(/:owner/) && !opts.owner) {
    opts = { ...opts, owner: ORG };
  }
  return gh.request(route, opts);
}

function isAsciidoc(node: { type: string; path: string }): boolean {
  return node.type === `blob` && !!node.path.match(/\.adoc$/);
}
