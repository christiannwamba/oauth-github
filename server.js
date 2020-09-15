// RESOURCES
// https://developer.github.com/apps/building-oauth-apps/authorizing-oauth-apps/
// https://auth0.com/docs/protocols/state-parameters
// https://www.youtube.com/watch?v=hKYjSgyCd60&ab_channel=JuniorDeveloperCentral

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const querystring = require('querystring');
const shortid = require('shortid');
const fetch = require('node-fetch');

const app = express();

app.use(express.json());
app.use(session({ secret: 'shhhhh', resave: false, saveUninitialized: false }));
app.set('view engine', 'ejs');

const apiBase = 'https://api.github.com';
const authorizationEndpoint = 'https://github.com/login/oauth/authorize';
const tokenEndpoint = 'https://github.com/login/oauth/access_token';

app.get('/', function (req, res) {
  if (req.session.accessToken) {
    const query = querystring.encode({
      sort: 'created',
      direction: 'desc',
    });
    fetch(`${apiBase}/user/repos?${query}`, {
      headers: {
        Authorization: `Bearer ${req.session.accessToken}`,
      },
    })
      .then((res) => res.json())
      .then((repos) => {
        res.render('index', {repos});
      })
      .catch((err) => {
        console.error(err);
        res.redirect('/error');
      });
  } else {
    req.session.localRedirect = '/';
    startAuthFlow(req, res);
  }
});

app.get('/dashboard', function (req, res) {
  if (req.session.accessToken) {
    res.render('dashboard');
  } else {
    req.session.localRedirect = '/dashboard';
    startAuthFlow(req, res);
  }
});

app.get('/error', function (req, res) {
  res.render('error');
});

app.get('/callback', function (req, res) {
  const query = req.query;
  if (query.code) {
    if (query.state !== req.session.state) {
      res.redirect('/error');
    }

    fetch(tokenEndpoint, {
      method: 'post',
      body: JSON.stringify({
        code: query.code,
        redirect_uri: createRedirectUrl(req),
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        grant_type: 'authorization_code',
      }),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    })
      .then((fetchRes) => fetchRes.json())
      .then((data) => {
        console.log(data);
        req.session.accessToken = data.access_token;
        res.redirect(req.session.localRedirect);
      });
  }
});

app.listen(4300, () => {
  console.log('App listening at http://localhost:4300');
});

function createRedirectUrl(req) {
  return `${req.protocol}://${req.hostname}:4300/callback`;
}

function startAuthFlow(req, res) {
  req.session.state = shortid.generate();
  const query = querystring.encode({
    response_type: 'code',
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: createRedirectUrl(req),
    scope: 'user public_repo',
    state: req.session.state,
  });
  res.redirect(`${authorizationEndpoint}?${query}`);
}
