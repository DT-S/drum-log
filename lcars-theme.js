// Canonical palette setting belongs to the existing offline backup.
export const THEMES=Object.freeze(['voyager','elite','redalert']);
export const normalizeTheme=value=>THEMES.includes(value)?value:'voyager';
export function applyTheme(root,raw){
 const theme=normalizeTheme(raw);
 root.documentElement.dataset.appTheme=theme;
 const overlay=root.querySelector('#lcarsStartup');
 if(overlay)overlay.dataset.theme=theme;
 for(const button of root.querySelectorAll('[data-set-theme]'))
  button.setAttribute('aria-pressed',String(button.dataset.setTheme===theme));
 const setting=root.querySelector('#appTheme');
 if(setting)setting.value=theme;
 return theme;
}
