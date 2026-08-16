# @better-you/config

Environment/config loading. Currently provides `getStubUserId()`, a development-only stand-in for a real authenticated user, configured via the `DEV_USER_ID` environment variable (see `.env.example`). This is replaced by real session/token resolution once Auth (Blueprint §4) is implemented.
