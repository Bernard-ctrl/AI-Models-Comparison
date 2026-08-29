(() => {
  const STORAGE_KEY = "ai-models-comparison-theme";
  const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");

  function getTheme() {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : mediaQuery.matches ? "light" : "dark";
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }

  applyTheme(getTheme());

  function addThemeControl() {
    const controls = document.querySelector(".controls");
    if (!controls || controls.querySelector("#themeToggle")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn themeToggle";
    button.id = "themeToggle";
    button.addEventListener("click", () => {
      const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      applyTheme(nextTheme);
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
      updateThemeControl(button, nextTheme);
    });

    controls.append(button);
    updateThemeControl(button, getTheme());
  }

  function updateThemeControl(button, theme) {
    const nextTheme = theme === "light" ? "dark" : "light";
    button.textContent = nextTheme === "light" ? "Light mode" : "Dark mode";
    button.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
    button.setAttribute("title", `Switch to ${nextTheme} mode`);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addThemeControl);
  else addThemeControl();
})();
