# New World Leaderboard

This repository contains the New World Leaderboard experience, split in two
projects:

- `nwleaderboard-ui` – the progressive web application built with React.
- `nwleaderboard-api` – a Quarkus API that will expose leaderboard data.

## Front-end (nwleaderboard-ui)

The UI is a static React application bundled with a custom build script. The
generated assets are copied into the Quarkus resources directory so that the
API can serve them directly.

```
cd nwleaderboard-ui
npm install
npm run build
```

The command produces a `dist/` folder and refreshes the API's
`src/main/resources/META-INF/resources` directory with the latest `version.txt`
file required by the service worker.

## Back-end (nwleaderboard-api)

The Quarkus API serves the static UI and proxies authentication flows to
Keycloak:

- `POST /auth/login` – exchanges user credentials for an access token.
- `POST /user/register` – creates a new Keycloak account.
- `POST /user/reset-password` – triggers a password reset e-mail if the
  account exists.

Configure the Keycloak endpoints and clients through
`src/main/resources/application.properties` or environment variables before
starting the API.

```
cd nwleaderboard-api
mvn quarkus:dev
```

Running the project locally requires access to Maven Central to download the
Quarkus platform dependencies. Configure a local Maven proxy or populate a
local repository with the required artifacts if direct access is unavailable.
