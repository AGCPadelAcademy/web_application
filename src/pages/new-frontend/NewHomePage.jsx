import { useRef } from 'react';

// The chat link is added here when the academy sends it.
const WHATSAPP_URL = '';
const WHATSAPP_LABEL = 'Contact with us using WhatsApp';

const WhatsAppMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M20.52 3.48A11.8 11.8 0 0 0 12.06 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.59 5.95L0 24l6.3-1.65a11.9 11.9 0 0 0 5.76 1.47h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.16-3.45-8.44zM12.07 21.3h-.01a9.86 9.86 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.98c0 5.45-4.44 9.9-9.89 9.9zm5.43-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z"
    />
  </svg>
);

const WhatsAppBubble = () => {
  const inner = (
    <>
      <WhatsAppMark />
      <span className="nf-whatsapp-note">{WHATSAPP_LABEL}</span>
    </>
  );

  if (!WHATSAPP_URL) {
    return (
      <button type="button" className="nf-whatsapp" aria-label={WHATSAPP_LABEL}>
        {inner}
      </button>
    );
  }

  return (
    <a className="nf-whatsapp" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  );
};

const NewHomePage = () => {
  const frameRef = useRef(null);

  const onLoad = () => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    const view = doc?.defaultView;
    if (!doc || !view || !doc.body) return;

    const fit = () => {
      const height = Math.max(
        ...Array.from(doc.body.children, (el) => {
          if (view.getComputedStyle(el).display === 'none') return 0;
          return el.offsetTop + el.offsetHeight;
        }),
      );
      if (height > 0) frame.style.height = `${height}px`;
    };

    fit();
    view.requestAnimationFrame(() => {
      fit();
      view.requestAnimationFrame(fit);
    });
    if (view.ResizeObserver) {
      const observer = new view.ResizeObserver(fit);
      const main = doc.querySelector('main');
      if (main) observer.observe(main);
    }
  };

  return (
    <>
      <iframe
        ref={frameRef}
        title="AGC Padel Academy new homepage"
        src="/prototypes/agc-v28.html?embed=1"
        onLoad={onLoad}
        className="nf-home-frame w-full border-0 bg-[#c2cea5] block"
        scrolling="no"
        style={{ minHeight: '70vh' }}
      />
      <WhatsAppBubble />
    </>
  );
};

export default NewHomePage;
