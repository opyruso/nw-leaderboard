const ThemeContext = React.createContext({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  document.documentElement.dataset.theme = theme;
}

function ThemeProvider({ children }) {
  const [theme, setTheme] = React.useState(() => {
    const stored = localStorage.getItem('theme');
    return stored === 'light' ? 'light' : 'dark';
  });

  React.useEffect(() => {
    localStorage.setItem('theme', theme);
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = React.useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export { ThemeContext, ThemeProvider };
