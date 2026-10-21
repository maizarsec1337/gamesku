# Taste — Security

- Never hardcode passwords, tokens, or administrator credentials in JavaScript, frontend files, or the repository. Confidence: 0.85
- Never store passwords (or sensitive tokens/credentials) in localStorage or sessionStorage; use the backend's existing session/token mechanism. Confidence: 0.8
- Never trust roles or authorization data supplied by the frontend; enforce authentication and authorization on the backend/server for admin routes and administrative endpoints. Confidence: 0.8
- Never disable or bypass security protections (auth, CSRF, XSS safeguards) just to make a feature appear to work. Confidence: 0.75
- Handle HTTP failures honestly and explicitly (401, 403, 404, 422, 429, 500) rather than masking them. Confidence: 0.7
- Backend must derive the requester's identity (e.g. `user_id`/`pelanggan_id`) from the session or validated auth token — never trust identity supplied in the request body or headers. Confidence: 0.85
- For "at most one active record per owner while terminal/rejected rows may repeat," prefer a generated/computed column (e.g. `aktif` = 1 when status is active, NULL otherwise) with a `UNIQUE(pelanggan_id, aktif)` instead of a per-status unique key that wrongly blocks re-application after rejection. Confidence: 0.8
- Sanitize/redact sensitive information (passwords, tokens, credentials, cookies, private keys) from logs and monitoring dashboards — never display secrets even in development; redact at the point of emission without altering application logic or masking the underlying error. Confidence: 0.85
