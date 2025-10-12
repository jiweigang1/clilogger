import { execSync } from 'child_process';
import os from 'os';
import LogManager from './logger-manager.js';

const logger = LogManager.getSystemLogger();

function getParentPidSync(pid) {
  if (os.platform() === 'win32') {
    const stdout = execSync(`wmic process where (ProcessId=${pid}) get ParentProcessId /format:list`, { encoding: 'utf8' });
    const m = stdout.match(/ParentProcessId=(\d+)/i);
    return m ? Number(m[1]) : null;
  } else {
    const stdout = execSync(`ps -o ppid= -p ${pid}`, { encoding: 'utf8' });
    const txt = stdout.trim();
    return txt ? Number(txt) : null;
  }
}

const parent = process.ppid;
const grand = getParentPidSync(parent);
logger.debug('parent:', parent, 'grandparent:', grand);
