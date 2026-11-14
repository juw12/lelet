// Runs before first paint so a stored theme does not flash. Kept as a file (not inline) for the CSP.
(function () {
  try {
    var saved = JSON.parse(localStorage.getItem('lelet.v1') || '{}');
    if (saved.theme === 'light' || saved.theme === 'dark') document.documentElement.dataset.theme = saved.theme;
    if (saved.lang === 'en') document.documentElement.lang = 'en';
  } catch (error) {
    // unreadable storage: fall back to the system theme
  }
})();
