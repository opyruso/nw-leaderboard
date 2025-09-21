import App from './App.js';
import { LangProvider } from './i18n.js';
import { ThemeProvider } from './theme.js';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <LangProvider>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </LangProvider>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js');
  });
}
