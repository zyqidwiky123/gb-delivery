const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

const LEVEL_NAMES = { 0: 'DEBUG', 1: 'INFO', 2: 'WARN', 3: 'ERROR' };

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.INFO;

function log(level, message, data = {}) {
  if (LOG_LEVELS[level] < currentLevel) return;
  const entry = {
    severity: level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  };
  if (level === 'ERROR') {
    console.error(JSON.stringify(entry));
  } else if (level === 'WARN') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

function debug(message, data) {
  log('DEBUG', message, data);
}
function info(message, data) {
  log('INFO', message, data);
}
function warn(message, data) {
  log('WARN', message, data);
}
function error(message, data) {
  log('ERROR', message, data);
}

module.exports = { log, debug, info, warn, error };
