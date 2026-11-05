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
      body { padding-top: 0 !important; }
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
      className="w-full border-0 bg-[#f8f8f4] block"
      style={{ minHeight: '70vh' }}
    />
  );
};

export default NewHomePage;
