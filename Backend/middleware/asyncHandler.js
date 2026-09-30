// Express 4 does not catch rejected promises from async handlers; without
// this a single DB error would leave the request hanging (and on modern Node
// can crash the process). Wrap async route handlers with asyncH(...).
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
