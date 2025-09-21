# New World Leaderboard

This repository contains the New World Leaderboard experience, split in two
projects:

- `nwleaderboard-ui` – the progressive web application built with React.
- `nwleaderboard-api` – a Quarkus API that will expose leaderboard data.

## Front-end (nwleaderboard-ui)

The UI is a static React application bundled with a custom build script. The
generated assets are copied into the Quarkus resources directory so that the
API can serve them directly.

```bash
cd nwleaderboard-ui
npm run build
```

The command produces a `dist/` folder and refreshes the API's
`src/main/resources/META-INF/resources` directory with the latest `version.txt`
file required by the service worker.

## Back-end (nwleaderboard-api)

The Quarkus API currently only contains the scaffolding required to host the
front-end. Running the project locally requires access to Maven Central to
download the Quarkus platform dependencies.

```bash
cd nwleaderboard-api
mvn quarkus:dev
```

If Maven is unable to resolve dependencies because of network restrictions,
configure a local Maven proxy or populate a local repository with the required
artifacts before running the command.
