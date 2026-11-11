import { useRef } from 'react';

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
      <button
        type="button"
        className="nf-backtop"
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        ↑
      </button>
    </>
  );
};

export default NewHomePage;
