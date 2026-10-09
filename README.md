# Auth API

A production-minded authentication API built with Node.js, Express and MongoDB.

**Live demo:** https://YOUR-SERVICE.onrender.com/health (free tier: the first request after idle can take about a minute)

## Features
- Register / login with bcrypt-hashed passwords (cost 12)
- Short-lived JWT access tokens (15 min) sent as `Authorization: Bearer`
- Opaque refresh tokens in an httpOnly cookie, stored only as SHA-256 hashes
- Refresh-token rotation with reuse detection (a replayed old token revokes the whole session family)
- Role-based access control (`user`, `admin`)
- Zod input validation, Helmet security headers, rate limiting on auth routes
- Timing-safe login (same response for unknown email and wrong password)
- Integration tests with Vitest, Supertest and an in-memory MongoDB; GitHub Actions CI

## Stack
Node 22, Express 5, Mongoose, jsonwebtoken, bcryptjs, zod, helmet, express-rate-limit, Vitest

## API
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | - | Create account `{ email, password }` |
| POST | /api/auth/login | - | Returns `accessToken`, sets refresh cookie |
| POST | /api/auth/refresh | cookie | Rotates refresh token, returns new `accessToken` |
| POST | /api/auth/logout | cookie | Revokes the current refresh token |
| POST | /api/auth/logout-all | Bearer | Revokes every session for the user |
| GET | /api/auth/me | Bearer | Current user |
| GET | /api/admin/users | Bearer (admin) | List users |
| GET | /health | - | Health check |

## Run locally
```bash
git clone https://github.com/Temiloluwa-Fafiyebi/auth-api.git
cd auth-api
npm install
cp .env.example .env     # then fill in MONGO_URI and JWT_ACCESS_SECRET
npm run dev
npm test
```

## Design decisions
- **Why opaque refresh tokens?** They can be revoked individually, and only a hash is stored, so a database leak does not leak usable tokens.
- **Why rotation + reuse detection?** A stolen refresh token stops working as soon as the real user refreshes, and replaying an old one kills the session.
- **Why httpOnly cookie for refresh?** JavaScript (and therefore XSS) cannot read it.
- **Known limitations:** no email verification or password reset yet; access tokens cannot be revoked before they expire (15 min window).

## Environment variables
See `.env.example`. Never commit `.env`.
