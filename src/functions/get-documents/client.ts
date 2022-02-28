import fetch from 'cross-fetch';
import { getClient, ClientType } from '@friends-library/db';

export function client(): ClientType {
  const env = getEnv();
  const token = process.env[tokenKey(env)];
  return getClient({ env, token, fetch });
}

function getEnv(): 'staging' | 'dev' | 'production' {
  if (process.env.NETLIFY && process.env.CONTEXT !== `production`) {
    return `staging`;
  } else if (process.env.API_DEV) {
    return `dev`;
  } else {
    return `production`;
  }
}

function tokenKey(env: 'staging' | 'dev' | 'production'): string {
  switch (env) {
    case `dev`:
      return `FLP_API_TOKEN_DEV`;
    case `staging`:
      return `FLP_API_TOKEN_STAGING`;
    case `production`:
      return `FLP_API_TOKEN_PROD`;
  }
}
