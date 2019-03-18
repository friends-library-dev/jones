import { createReducer } from 'redux-starter-kit';
import { Repo } from '../type';

type GitHubRepo = {
  id: number;
  name: string;
  description: string;
};

export default createReducer([], {
  RECEIVE_FRIEND_REPOS: (
    state: Repo[],
    { payload: repos }: { payload: GitHubRepo[] },
  ) => {
    return repos.map(repo => ({
      id: repo.id,
      slug: repo.name,
      friendName: repo.description.replace(
        /^.. (.+) \(\d.+$/,
        (_: any, name: string) => name,
      ),
    }));
  },
});