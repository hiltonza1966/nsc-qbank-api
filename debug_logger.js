/**
 * ============================================================================
 * QBank System-Wide Debug Logger
 * Captures: HTTP requests/responses, Express errors, DB errors,
 *           uncaught exceptions, unhandled rejections, route errors
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'debug.log');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

// Ensure log file exists
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, '');
}

/**
 * Format timestamp
 */
function ts() {
  return new Date().toISOString();
}

/**
 * Rotate log if too large
 */
function rotateLog() {
  try {
    const stats = fs.statSync(LOG_FILE);
    if (stats.size > MAX_LOG_SIZE) {
      const backup = LOG_FILE + '.old';
      if (fs.existsSync(backup)) fs.unlinkSync(backup);
      fs.renameSync(LOG_FILE, backup);
      fs.writeFileSync(LOG_FILE, `[${ts()}] LOG ROTATED\n`);
    }
  } catch (e) { /* ignore */ }
}

/**
 * Core write function
 */
function writeLog(level, section, message, data = null) {
  rotateLog();
  const entry = {
    timestamp: ts(),
    level,
    section,
    message: String(message),
    data: data || undefined
  };
  const line = JSON.stringify(entry) + '\n';
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (e) {
    console.error('Failed to write to debug.log:', e.message);
  }
  // Also console output in development
  const consolePrefix = `[${level}] [${section}]`;
  if (level === 'ERROR') console.error(consolePrefix, message, data || '');
  else if (level === 'WARN') console.warn(consolePrefix, message);
  else console.log(consolePrefix, message);
}

// Exported logging functions
const debug = {
  info: (section, msg, data) => writeLog('INFO', section, msg, data),
  warn: (section, msg, data) => writeLog('WARN', section, msg, data),
  error: (section, msg, data) => writeLog('ERROR', section, msg, data),
  api: (section, msg, data) => writeLog('API', section, msg, data),
  db: (section, msg, data) => writeLog('DB', section, msg, data),
  frontend: (section, msg, data) => writeLog('FRONTEND', section, msg, data),
};

/**
 * Express middleware: Log ALL requests and responses
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  const reqId = Math.random().toString(36).substring(2, 10);
  req.debugId = reqId;

  // Capture request body
  const reqBody = req.body ? JSON.stringify(req.body).substring(0, 2000) : null;

  debug.api('REQUEST', `${req.method} ${req.originalUrl}`, {
    reqId,
    method: req.method,
    url: req.originalUrl,
    query: req.query,
    body: reqBody,
    headers: {
      'content-type': req.headers['content-type'],
      'authorization': req.headers['authorization'] ? 'Bearer ***' : undefined,
      'user-agent': req.headers['user-agent']?.substring(0, 100)
    },
    ip: req.ip || req.connection?.remoteAddress
  });

  // Capture response
  const originalSend = res.send;
  const originalJson = res.json;
  const originalStatus = res.status;
  let statusCode = 200;

  res.status = function(code) {
    statusCode = code;
    return originalStatus.call(this, code);
  };

  res.send = function(data) {
    const duration = Date.now() - start;
    const isError = statusCode >= 400;
    const level = isError ? 'ERROR' : 'API';
    const responseData = typeof data === 'string' ? data.substring(0, 2000) : JSON.stringify(data).substring(0, 2000);

    debug[level]('RESPONSE', `${req.method} ${req.originalUrl} -> ${statusCode} (${duration}ms)`, {
      reqId,
      statusCode,
      duration,
      response: responseData,
      isError
    });
    return originalSend.call(this, data);
  };

  res.json = function(data) {
    const duration = Date.now() - start;
    const isError = statusCode >= 400;
    const level = isError ? 'ERROR' : 'API';

    debug[level]('RESPONSE', `${req.method} ${req.originalUrl} -> ${statusCode} (${duration}ms)`, {
      reqId,
      statusCode,
      duration,
      response: JSON.stringify(data).substring(0, 2000),
      isError
    });
    return originalJson.call(this, data);
  };

  next();
}

/**
 * Express error handler: Catch ALL route/middleware errors
 */
function errorHandler(err, req, res, next) {
  const errorDetails = {
    reqId: req.debugId,
    message: err.message,
    stack: err.stack,
    name: err.name,
    code: err.code,
    errno: err.errno,
    sqlState: err.sqlState,
    sqlMessage: err.sqlMessage,
    route: req.originalUrl,
    method: req.method,
    body: req.body ? JSON.stringify(req.body).substring(0, 1000) : null
  };

  debug.error('EXPRESS_ERROR', `Unhandled error in ${req.method} ${req.originalUrl}`, errorDetails);

  // Send generic error to client (don't leak stack in production)
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      error: true,
      message: err.message || 'Internal Server Error',
      reqId: req.debugId,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
}

/**
 * Catch ALL unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  debug.error('UNHANDLED_REJECTION', 'Unhandled Promise Rejection', {
    reason: reason?.message || String(reason),
    stack: reason?.stack,
    promise: String(promise)
  });
});

/**
 * Catch ALL uncaught exceptions
 */
process.on('uncaughtException', (err) => {
  debug.error('UNCAUGHT_EXCEPTION', 'Uncaught Exception - Process will exit', {
    message: err.message,
    stack: err.stack,
    name: err.name
  });
  // Give time to write log then exit
  setTimeout(() => process.exit(1), 1000);
});

/**
 * Database error wrapper - wrap any DB call to log errors
 */
function wrapDbCall(dbFunction, section = 'DB') {
  return async function(...args) {
    try {
      const result = await dbFunction(...args);
      return result;
    } catch (err) {
      debug.error(section, `Database error: ${err.message}`, {
        sql: err.sql,
        sqlState: err.sqlState,
        sqlMessage: err.sqlMessage,
        code: err.code,
        errno: err.errno,
        stack: err.stack
      });
      throw err;
    }
  };
}

/**
 * Route wrapper - wrap route handlers to catch async errors
 */
function wrapRoute(handler) {
  return async function(req, res, next) {
    try {
      await handler(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Read log file for debug panel
 */
function readLogs(limit = 500, filter = null) {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    let logs = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { timestamp: 'unknown', level: 'INFO', section: 'RAW', message: line };
      }
    });

    if (filter) {
      logs = logs.filter(l =>
        l.section?.toLowerCase().includes(filter.toLowerCase()) ||
        l.message?.toLowerCase().includes(filter.toLowerCase()) ||
        l.level?.toLowerCase().includes(filter.toLowerCase())
      );
    }

    return logs.slice(-limit);
  } catch (err) {
    return [{ timestamp: ts(), level: 'ERROR', section: 'LOGGER', message: 'Failed to read logs: ' + err.message }];
  }
}

/**
 * Clear logs
 */
function clearLogs() {
  try {
    fs.writeFileSync(LOG_FILE, `[${ts()}] LOGS CLEARED\n`);
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  debug,
  requestLogger,
  errorHandler,
  wrapDbCall,
  wrapRoute,
  readLogs,
  clearLogs,
  LOG_FILE
};
