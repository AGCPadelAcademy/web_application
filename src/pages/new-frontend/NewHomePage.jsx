import { useRef } from 'react';

const NewHomePage = () => {
  const frameRef = useRef(null);

  const onLoad = () => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc) return;
    const style = doc.createElement('style');
    style.textContent = `
      .nav, .footer, .demo, .agc-reading-track { display: none !important; }
      html, body { padding-top: 0 !important; background: #c2cea5 !important; }
      #home.agc-v23-hero,
      #home.agc-v23-hero .agc-v23-heading { background: #c2cea5 !important; }
      #home.agc-v23-hero .agc-v23-heading { padding-top: 18px !important; }
    `;
    doc.head.appendChild(style);
    frame.style.height = `${Math.max(doc.documentElement.scrollHeight, 2400)}px`;
  };

  return (
    <iframe
      ref={frameRef}
      title="AGC Padel Academy new homepage"
      src="/prototypes/agc-v28.html"
      onLoad={onLoad}
      className="w-full border-0 bg-[#c2cea5] block"
      style={{ minHeight: '70vh' }}
    />
  );
};

export default NewHomePage;
