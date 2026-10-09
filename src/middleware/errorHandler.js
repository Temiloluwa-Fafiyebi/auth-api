export function notFound(req, res) {
  res.status(404).json({ error: "Route not found" });
}

// Express 5 forwards errors from async handlers here automatically
export function errorHandler(err, req, res, next) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.code === 11000) return res.status(409).json({ error: "Already exists" });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
