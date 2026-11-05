import { Helmet } from 'react-helmet-async';

const NewFrontendPage = () => (
  <>
    <Helmet>
      <title>AGC Padel Academy — New</title>
      <meta name="description" content="AGC Padel Academy homepage concept." />
    </Helmet>
    <iframe
      title="AGC Padel Academy new frontend"
      src="/prototypes/agc-v28.html"
      className="w-full flex-grow border-0 bg-[#f8f8f4]"
      style={{ minHeight: 'calc(100dvh - 1.75rem)' }}
    />
  </>
);

export default NewFrontendPage;
