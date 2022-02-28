import { Handler } from '@netlify/functions';
import fetch from 'node-fetch';

const handler: Handler = async (event) => {
  const { queryStringParameters: query } = event;
  if (!query || !query.code) {
    return { statusCode: 400 };
  }

  const url = [
    `https://github.com/login/oauth/access_token`,
    `?client_id=${process.env.JONES_OAUTH_CLIENT_ID || ``}`,
    `&client_secret=${process.env.JONES_OAUTH_CLIENT_SECRET || ``}`,
    `&code=${query.code}`,
  ].join(``);

  const response = await fetch(url, {
    method: `POST`,
    headers: { Accept: `application/json` },
  });

  const json: any = await response.json();

  if (`access_token` in json === false || typeof json.access_token !== `string`) {
    return {
      statusCode: 403,
      body: JSON.stringify(json, null, 2),
    };
  }

  return {
    statusCode: 302,
    headers: {
      location: `${process.env.JONES_OAUTH_REDIR_URI}?access_token=${json.access_token}`,
    },
  };
};

export { handler };
