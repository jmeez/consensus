import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Site from './Site.jsx';

/* Hash routing: the marketing site lives at /, the platform at #/app.
 * "Sign in" / "Enter Nova" on the site navigates to #/app; the app's
 * sign-out returns to the site. */
function Root() {
  const [route, setRoute] = useState(window.location.hash);
  useEffect(() => {
    const f = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return route.startsWith('#/app') ? <App /> : <Site />;
}

createRoot(document.getElementById('root')).render(<Root />);
