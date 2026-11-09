// Vercel Node.js serverless function. No credential is sent to the browser bundle.
import { handleAuth } from '../server/auth-core.js';
export default function handler(req, res) {
  return handleAuth(req, res, process.env, { behindVercel: true });
}
