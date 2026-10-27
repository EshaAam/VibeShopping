import { execFileSync } from 'node:child_process';

// Playwright stops the web server by killing its process tree, which on
// Windows skips the server's own cleanup - so remove the database here too.
export default function globalTeardown() {
  try {
    execFileSync('docker', ['rm', '-f', 'vibe-e2e-db'], { stdio: 'pipe' });
  } catch {
    // already gone
  }
}
