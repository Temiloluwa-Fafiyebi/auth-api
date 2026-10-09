import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../src/app.js";
import User from "../src/models/User.js";
import RefreshToken from "../src/models/RefreshToken.js";

let mongod;
const creds = { email: "Lowe@Example.com", password: "supersecret1" };

beforeAll(async () => {
  if (process.env.TEST_MONGO_URI) {
    await mongoose.connect(process.env.TEST_MONGO_URI); // use any MongoDB you already have
  } else {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }
  await User.init();
  // Some MongoDB look-alikes don't support TTL indexes; real MongoDB and the memory server do.
  await RefreshToken.init().catch((e) => {
    if (!process.env.TEST_MONGO_URI) throw e;
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await RefreshToken.deleteMany({});
});

const cookieOf = (res) => (res.headers["set-cookie"] || []).find((c) => c.startsWith("refreshToken="));

describe("register", () => {
  it("creates a user, lowercases the email, never returns the hash", async () => {
    const res = await request(app).post("/api/auth/register").send(creds);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("lowe@example.com");
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
    const stored = await User.findOne({ email: "lowe@example.com" });
    expect(stored.passwordHash).not.toBe(creds.password);
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it("rejects a duplicate email with 409", async () => {
    await request(app).post("/api/auth/register").send(creds);
    const res = await request(app).post("/api/auth/register").send(creds);
    expect(res.status).toBe(409);
  });

  it("rejects bad input with 400", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "nope", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBe(2);
  });

  it("cannot self-assign admin", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...creds, role: "admin" });
    expect(res.body.user.role).toBe("user");
  });
});

describe("login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send(creds);
  });

  it("returns an access token and sets an httpOnly refresh cookie", async () => {
    const res = await request(app).post("/api/auth/login").send(creds);
    expect(res.status).toBe(200);
    expect(res.body.accessToken.split(".").length).toBe(3);
    expect(cookieOf(res)).toMatch(/HttpOnly/i);
    expect(res.body.refreshToken).toBeUndefined();
  });

  it("gives the same error for wrong password and unknown email", async () => {
    const a = await request(app).post("/api/auth/login").send({ ...creds, password: "wrongwrong1" });
    const b = await request(app).post("/api/auth/login").send({ email: "who@example.com", password: "wrongwrong1" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });
});

describe("protected routes", () => {
  it("blocks requests without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("blocks a tampered token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer abc.def.ghi");
    expect(res.status).toBe(401);
  });

  it("allows a valid token", async () => {
    await request(app).post("/api/auth/register").send(creds);
    const login = await request(app).post("/api/auth/login").send(creds);
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("lowe@example.com");
  });

  it("returns 403 for a normal user on an admin route, 200 once promoted", async () => {
    await request(app).post("/api/auth/register").send(creds);
    let login = await request(app).post("/api/auth/login").send(creds);
    let res = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(403);

    await User.updateOne({ email: "lowe@example.com" }, { role: "admin" });
    login = await request(app).post("/api/auth/login").send(creds);
    res = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(1);
  });
});

describe("refresh rotation", () => {
  async function loggedInAgent() {
    await request(app).post("/api/auth/register").send(creds);
    const res = await request(app).post("/api/auth/login").send(creds);
    return { cookie: cookieOf(res).split(";")[0], res };
  }

  it("issues a new access token and a different refresh token", async () => {
    const { cookie } = await loggedInAgent();
    const res = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(cookieOf(res).split(";")[0]).not.toBe(cookie);
  });

  it("detects reuse of an old token and revokes the whole family", async () => {
    const { cookie: oldCookie } = await loggedInAgent();
    const first = await request(app).post("/api/auth/refresh").set("Cookie", oldCookie);
    const newCookie = cookieOf(first).split(";")[0];

    const replay = await request(app).post("/api/auth/refresh").set("Cookie", oldCookie);
    expect(replay.status).toBe(401);
    expect(replay.body.error).toMatch(/reuse/i);

    // the legitimate newest token is now dead too
    const after = await request(app).post("/api/auth/refresh").set("Cookie", newCookie);
    expect(after.status).toBe(401);
  });

  // Needs a real MongoDB (atomic single-document updates). Skipped on look-alike servers.
  it.skipIf(!!process.env.TEST_MONGO_URI)("two simultaneous refreshes with the same token: exactly one succeeds", async () => {
    const { cookie } = await loggedInAgent();
    const [a, b] = await Promise.all([
      request(app).post("/api/auth/refresh").set("Cookie", cookie),
      request(app).post("/api/auth/refresh").set("Cookie", cookie),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 401]);
  });

  it("logout revokes the refresh token", async () => {
    const { cookie } = await loggedInAgent();
    const out = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(out.status).toBe(204);
    const res = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    expect(res.status).toBe(401);
  });

  it("stores only a hash of the refresh token", async () => {
    const { cookie } = await loggedInAgent();
    const raw = cookie.split("=")[1];
    const docs = await RefreshToken.find();
    expect(docs.length).toBe(1);
    expect(docs[0].tokenHash).not.toBe(raw);
    expect(docs[0].tokenHash).toHaveLength(64);
  });
});

describe("misc", () => {
  it("health check works and unknown routes 404 as JSON", async () => {
    expect((await request(app).get("/health")).body).toEqual({ status: "ok" });
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it("sets security headers", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});
