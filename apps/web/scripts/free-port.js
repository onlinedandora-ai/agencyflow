const { execSync } = require('child_process');

const PORT = process.env.PORT || 3000;

try {
  if (process.platform === 'win32') {
    const output = execSync(`netstat -ano -p tcp | findstr :${PORT}`, {
      stdio: ['pipe', 'pipe', 'ignore'],
    }).toString();
    const lines = output.trim().split('\n');
    const pids = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5 && parts[1].endsWith(`:${PORT}`) && parts[3] === 'LISTENING') {
        const pid = parseInt(parts[4], 10);
        if (pid && pid !== process.pid) {
          pids.add(pid);
        }
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`[predev] Freed port ${PORT} by stopping process ${pid}`);
      } catch {}
    }
  } else {
    try {
      execSync(`lsof -ti:${PORT} | xargs kill -9`, { stdio: 'ignore' });
    } catch {}
  }
} catch {
  // Port is already free or findstr returned 1 (no match)
}
