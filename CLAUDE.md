# Dev environment

The user runs everything under process-compose (`process-compose.yml`: `db`, `server` via bacon, `client` via vite), started with:

    process-compose up -f process-compose.yml -U -u /tmp/kuutar-pc.sock

Control the running instance with the same socket flags, e.g.:

    process-compose process restart server -U -u /tmp/kuutar-pc.sock
    process-compose process logs server -n 50 -U -u /tmp/kuutar-pc.sock

Never kill the server/client by PID, and never start a second copy; restart through process-compose. Don't pass `-f` to `logs` (it would block); use `-n`.
