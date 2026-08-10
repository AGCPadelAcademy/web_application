window.onerror = (message, source, lineno, colno, errorObj) => {
  const errorDetails = errorObj ? JSON.stringify({
    name: errorObj.name,
    message: errorObj.message,
    stack: errorObj.stack,
    source,
    lineno,
    colno,
  }) : null;

  window.parent.postMessage({
    type: 'horizons-runtime-error',
    message,
    error: errorDetails
  }, '*');
};
