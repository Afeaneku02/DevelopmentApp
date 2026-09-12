# services/mentor-feedback

The read-only, optional mentor-feedback integration with the separate
DevelopmentApp_AI_Models project (ADR 0026) - the read-side sibling of
Roadmap's `RoadmapGenerator` (ADR 0020/0023/0024).

`MentorFeedbackClient` (`getFeedback(userId, contextKey?)`) is the one seam
mentor-feedback content enters Better You through. `UnavailableMentorFeedbackClient`
is the default and makes no network call; `HttpMentorFeedbackClient` only
activates when `AI_MODELS_BASE_URL` is configured (`apps/api/src/server.ts`),
calling the AI project's `GET /users/{user_id}/mentor-feedback`.

Unlike `RoadmapGenerator`, this client's contract is **never throw**: a
network error, timeout, non-2xx response, or a response body that doesn't
match the expected shape all resolve to a normal `MentorFeedbackResult` with
`status: 'unavailable'`, not an exception. Mentor feedback is a passive,
supplementary read, not a user-initiated action the way generating a roadmap
is - a failed or unconfigured integration must never turn into an app error;
it degrades to "nothing to show yet."

Only a path-scoped user id and an optional `context_key` query parameter
(a policy-selector string, never free text) ever cross this boundary -
never profile data, check-in notes, or a goal's free-text description.

`MentorFeedbackService` is a thin pass-through with **no persistence**: it
reads nothing from and writes nothing to any Better You repository, and
never touches Goals, Roadmap, Check-ins, Profile, or Activity. The read-only
route is `GET /api/v1/mentor-feedback` (`apps/api/src/routes/mentorFeedback.ts`).
