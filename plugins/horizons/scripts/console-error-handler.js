const originalConsoleError = console.error;
const MATCH_LINE_COL_REGEX = /:(\d+):(\d+)\)?\s*$/; // regex to match the :lineNum:colNum
const MATCH_AT_REGEX = /^\s*at\s+(?:async\s+)?(?:.*?\s+)?\(?/; // regex to remove the 'at' keyword and any 'async' or function name
const MATCH_PATH_REGEX = /^\//; // regex to remove the leading slash

function parseStackFrameLine(line) {
  const lineColMatch = line.match(MATCH_LINE_COL_REGEX);
  if (!lineColMatch) return null;
  const [, lineNum, colNum] = lineColMatch;
  const suffix = `:${lineNum}:${colNum}`;
  const idx = line.lastIndexOf(suffix);
  if (idx === -1) return null;
  const before = line.substring(0, idx);
  const path = before.replace(MATCH_AT_REGEX, '').trim();
  if (!path) return null;

  try {
    const pathname = new URL(path).pathname;
    const filePath = pathname.replace(MATCH_PATH_REGEX, '') || pathname;
    return `${filePath}:${lineNum}:${colNum}`;
  } catch (e) {
    const filePath = path.replace(MATCH_PATH_REGEX, '') || path;
    return `${filePath}:${lineNum}:${colNum}`;
  }
}

function getFilePathFromStack(stack, skipFrames = 0) {
  if (!stack || typeof stack !== 'string') return null;
  const lines = stack.split('\n').slice(1);

  const frames = lines.map(line => parseStackFrameLine(line.replace(/\r$/, ''))).filter(Boolean);

  return frames[skipFrames] ?? null;
}

console.error = function(...args) {
  originalConsoleError.apply(console, args);

  let errorString = '';
  let filePath = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg instanceof Error) {
      filePath = getFilePathFromStack(arg.stack, 0);
      errorString = `${arg.name}: ${arg.message}`;
      if (filePath) {
        errorString = `${errorString} at ${filePath}`;
      }
      break;
    }
  }

  if (!errorString) {
    errorString = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    const stack = new Error().stack;
    filePath = getFilePathFromStack(stack, 1);
    if (filePath) {
      errorString = `${errorString} at ${filePath}`;
    }
  }

  window.parent.postMessage({
    type: 'horizons-console-error',
    error: errorString
  }, '*');
};
