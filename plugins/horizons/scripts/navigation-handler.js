if (window.navigation && window.self !== window.top) {
  window.navigation.addEventListener('navigate', (event) => {
    const url = event.destination.url;

    try {
      const destinationUrl = new URL(url);
      const destinationOrigin = destinationUrl.origin;
      const currentOrigin = window.location.origin;

      if (destinationOrigin === currentOrigin) {
        return;
      }
    } catch (error) {
      return;
    }

    window.parent.postMessage({
      type: 'horizons-navigation-error',
      url,
    }, '*');
  });
}
