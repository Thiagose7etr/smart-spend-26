import fs from 'fs';
import path from 'path';

const src = path.join(process.cwd(), 'src', 'assets', 'thc-logo.jpg');
const publicDir = path.join(process.cwd(), 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

try {
  fs.copyFileSync(src, path.join(publicDir, 'favicon.ico'));
  fs.copyFileSync(src, path.join(publicDir, 'apple-touch-icon.png'));
  fs.copyFileSync(src, path.join(publicDir, 'logo.jpg'));
  console.log('Logo copied to public folder successfully!');
} catch (err) {
  console.error('Error copying logo:', err.message);
}
