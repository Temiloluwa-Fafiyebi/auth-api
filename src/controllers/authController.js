import bcrypt from "bcryptjs";
import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import { config } from "../config.js";
import { AppError } from "../utils/AppError.js";
import { signAccessToken, newRefreshToken, hashToken, newFamilyId } from "../utils/tokens.js";

const COOKIE_NAME = "refreshToken";

function cookieOptions() {
  const prod = config.env === "production";
  return {
    httpOnly: true,
    secure: prod || config.cookieSameSite === "none",
    sameSite: config.cookieSameSite,
    path: "/api/auth",
    maxAge: config.refreshDays * 24 * 60 * 60 * 1000,
  };
}

async function issueRefreshToken(userId, family) {
  const token = newRefreshToken();
  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(token),
    family,
    expiresAt: new Date(Date.now() + config.refreshDays * 24 * 60 * 60 * 1000),
  });
  return token;
}

const publicUser = (u) => ({ id: u._id, email: u.email, role: u.role });

// A real bcrypt hash of a throwaway string. Compared when the email doesn't exist
// so login takes the same time either way (stops account enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", config.bcryptRounds);

export async function register(req, res) {
  const { email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const user = await User.create({ email, passwordHash }); // duplicate email -> 11000 -> 409
  res.status(201).json({ user: publicUser(user) });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, "Invalid email or password");

  const refreshToken = await issueRefreshToken(user._id, newFamilyId());
  res.cookie(COOKIE_NAME, refreshToken, cookieOptions());
  res.json({ accessToken: signAccessToken(user), user: publicUser(user) });
}

export async function refresh(req, res) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw new AppError(401, "No refresh token");

  const stored = await RefreshToken.findOne({ tokenHash: hashToken(token) });
  if (!stored) throw new AppError(401, "Invalid refresh token");

  // Reuse detection: a revoked token being presented again means it was stolen
  // (or replayed). Kill the whole family so the attacker's copy dies too.
  if (stored.revokedAt) {
    await RefreshToken.updateMany({ family: stored.family, revokedAt: null }, { revokedAt: new Date() });
    throw new AppError(401, "Refresh token reuse detected. Please log in again.");
  }
  if (stored.expiresAt < new Date()) throw new AppError(401, "Refresh token expired");

  // Atomic rotate: only one concurrent request can flip revokedAt from null
  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: stored._id, revokedAt: null },
    { revokedAt: new Date() }
  );
  if (!claimed) throw new AppError(401, "Refresh token already used");

  const user = await User.findById(stored.user);
  if (!user) throw new AppError(401, "User no longer exists");

  const newToken = await issueRefreshToken(user._id, stored.family);
  res.cookie(COOKIE_NAME, newToken, cookieOptions());
  res.json({ accessToken: signAccessToken(user) });
}

export async function logout(req, res) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    await RefreshToken.updateOne({ tokenHash: hashToken(token), revokedAt: null }, { revokedAt: new Date() });
  }
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
}

export async function logoutAll(req, res) {
  await RefreshToken.updateMany({ user: req.user.id, revokedAt: null }, { revokedAt: new Date() });
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
}

export async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError(404, "User not found");
  res.json({ user: publicUser(user) });
}
