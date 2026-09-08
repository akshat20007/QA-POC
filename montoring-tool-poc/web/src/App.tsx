import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { CheckDetailPage } from './pages/CheckDetail';
import { Dashboard } from './pages/Dashboard';

function readCheckId() {
  return new URLSearchParams(window.location.search).get('check');
}

export default function App() {
  const [checkId, setCheckId] = useState<string | null>(readCheckId);

  useEffect(() => {
    const onPop = () => setCheckId(readCheckId());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function openCheck(id: string) {
    setCheckId(id);
    history.pushState({}, '', `?check=${encodeURIComponent(id)}`);
  }

  function goHome() {
    setCheckId(null);
    history.pushState({}, '', '/');
  }

  return (
    <Layout>
      {checkId ? <CheckDetailPage id={checkId} onBack={goHome} /> : <Dashboard onOpen={openCheck} />}
    </Layout>
  );
}
