const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const addedNode of mutation.addedNodes) {
      if (
        addedNode.nodeType === Node.ELEMENT_NODE &&
        (
          addedNode.tagName?.toLowerCase() === 'vite-error-overlay' ||
          addedNode.classList?.contains('backdrop')
        )
      ) {
        handleViteOverlay(addedNode);
      }
    }
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

function handleViteOverlay(node) {
  if (!node.shadowRoot) {
    return;
  }

  const backdrop = node.shadowRoot.querySelector('.backdrop');

  if (backdrop) {
    const overlayHtml = backdrop.outerHTML;
    const parser = new DOMParser();
    const doc = parser.parseFromString(overlayHtml, 'text/html');
    const messageBodyElement = doc.querySelector('.message-body');
    const fileElement = doc.querySelector('.file');
    const messageText = messageBodyElement ? messageBodyElement.textContent.trim() : '';
    const fileText = fileElement ? fileElement.textContent.trim() : '';
    const error = messageText + (fileText ? ' File:' + fileText : '');

    window.parent.postMessage({
      type: 'horizons-vite-error',
      error,
    }, '*');
  }
}
