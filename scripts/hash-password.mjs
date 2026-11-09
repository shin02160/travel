import { randomBytes, scryptSync } from 'node:crypto';
// Supply a password via stdin (no password or hash is committed to git).
let password = '';
for await (const chunk of process.stdin) {
  password += chunk.toString('utf8');
  if (password.length > 256) throw new Error('Password too long');
}
password = password.replace(/\r?\n$/, '');
if (password.length < 12) throw new Error('Use a password of 12+ characters');
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
console.log(`${salt.toString('base64url')}:${hash.toString('base64url')}`);
