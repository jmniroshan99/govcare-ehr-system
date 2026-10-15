# Windows frontend port startup fix

## Observed failure

`npm run dev:full` previously forced Vite to bind `127.0.0.1:5300` with
`--strictPort`. Windows returned `listen EACCES`, so Vite exited. The existing
`concurrently -k` behavior then stopped Spring Boot. The Spring exit in this
particular log is a consequence of the Vite failure, not evidence of a backend
error. A Windows reserved/excluded port is one possible cause; the supplied log
alone does not identify which Windows policy denied binding.

## Changed files

- `package.json`: route full-stack aliases through the port-aware launcher and
  include port tests in `test:startup`.
- `scripts/frontend-port.cjs`: probe loopback ports before starting Vite, trying
  5300 first and other local ports when it cannot bind. A configured
  `GOVCARE_FRONTEND_PORT` is used exactly or fails with a useful message.
- `scripts/run-full-stack.cjs`: print the actual frontend URL, launch the
  existing Vite and Spring commands under `concurrently -k`, and pass the
  selected port to the Spring launcher.
- `scripts/run-spring.mjs`: after loading `spring-api/.env`, add only the selected
  loopback origins to its existing CORS list.
- `scripts/start-full-dev.cjs`: use the same selected port for the browser-opening
  startup alias.
- `scripts/run-full-stack.test.cjs`, `scripts/run-spring.test.mjs`: regression
  checks for occupied ports, launch arguments, and backend CORS propagation.
- `README.md`, `run-windows.bat`: explain and display the selected URL.

No clinical, role, API business logic, database schema, or migration was changed.

## Run on Windows

1. Extract this ZIP into a **new folder**.
2. From that folder run `npm install` if dependencies are absent, then
   `npm run dev:full` (or `run-windows.bat`).
3. Open the exact `Frontend: http://127.0.0.1:<port>` address printed in the
   terminal. The API remains on `http://127.0.0.1:4002` by default.
4. If the chosen frontend port is undesirable, in PowerShell set
   `$env:GOVCARE_FRONTEND_PORT='18080'` before `npm run dev:full`.
5. If **every** port fails with `EACCES`, inspect
   `netsh interface ipv4 show excludedportrange protocol=tcp` and choose a
   permitted frontend port. Do not remove Windows reservations or kill other
   applications without identifying their purpose.

## Verification and limits

`npm run test:startup`: 12 passed. This includes actual loopback socket
selection and launcher/CORS behavior with an isolated Maven fixture.
JavaScript syntax checks passed. Windows reserved-port behavior and an actual
Java 21 + PostgreSQL login flow were not runnable in the verification
environment. Full frontend dependency installation/build was also unavailable
there because the required packages were not cached and npm registry access
was restricted. Follow up on the separately identified access-role issues
before any production deployment.
