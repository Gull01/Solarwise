export type Theme = "system" | "light" | "dark";
export const THEME_KEY = "theme";

// Runs in <head> before first paint so a saved theme never flashes the wrong colors.
// "system" is stored as no attribute, which lets the CSS media query decide.
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
