const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const key = 'GOVCARE_RENAL_JWT_SECRET';
const files = ['spring-api', 'ML_Server'].map(dir => path.join(root, dir, '.env'));
const contents = files.map(file => fs.readFileSync(fs.existsSync(file) ? file : file + '.example', 'utf8'));
const readSecret = text => {
  const line = text.split(/\r?\n/).find(line => line.trim().startsWith(key + '='));
  return line ? line.trim().slice(key.length + 1).trim().replace(/^(['"])(.*)\1$/, '$2') : '';
};
const existing = [...new Set(contents.map(readSecret).filter(Boolean))];
if (existing.length > 1) throw new Error('The two existing renal service secrets differ. Align them before configuring.');
const secret = existing[0] || crypto.randomBytes(48).toString('hex');
if (Buffer.byteLength(secret, 'utf8') < 32) throw new Error('The existing renal service secret must contain at least 32 UTF-8 bytes.');
for (let i = 0; i < files.length; i++) {
  const lines = contents[i].split(/\r?\n/).filter(line => !line.trim().startsWith(key + '='));
  fs.writeFileSync(files[i], lines.join('\n').replace(/\n*$/, '\n') + key + '=' + secret + '\n', {mode: 0o600});
  fs.chmodSync(files[i], 0o600);
}
console.log('Dedicated renal service credential configured in both local services. No secret is printed.');
