/* MiniFocus mockup helpers: inline SVG icon set + Android system chrome.
   Usage: <i data-i="lock" data-s="20"></i>  ->  replaced by an inline <svg>.
          <div class="sb"></div>              ->  Android status bar
          <div class="nav"></div>             ->  gesture navigation bar
   All icons are original 24x24 stroke drawings (1.8px, round caps). */
(function () {
  const S = {
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7"/>',
    shield: '<path d="M12 3.2 19 6v5.4c0 4.4-2.9 8.1-7 9.4-4.1-1.3-7-5-7-9.4V6z"/>',
    shieldcheck: '<path d="M12 3.2 19 6v5.4c0 4.4-2.9 8.1-7 9.4-4.1-1.3-7-5-7-9.4V6z"/><path d="m9 12 2.1 2.1L15.2 10"/>',
    more: '<circle cx="12" cy="5.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="18.5" r="1.5" fill="currentColor" stroke="none"/>',
    trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.8c0-.5.4-.8.8-.8h3.4c.5 0 .8.4.8.8V7"/><path d="M6.5 7l.9 12.2c.1.8.7 1.3 1.5 1.3h6.2c.8 0 1.4-.5 1.5-1.3L17.5 7"/><path d="M10.2 11v5.5M13.8 11v5.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.2 4.2"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>',
    fill: '<path d="M17 17 7.5 7.5"/><path d="M7 15V7h8"/>',
    share: '<circle cx="17.5" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="m8.7 10.8 6.6-3.9M8.7 13.2l6.6 3.9"/>',
    openin: '<path d="M14 4h6v6"/><path d="m20 4-8.5 8.5"/><path d="M18 14v4.5c0 .8-.7 1.5-1.5 1.5h-11c-.8 0-1.5-.7-1.5-1.5v-11C4 6.7 4.7 6 5.5 6H10"/>',
    desktop: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/>',
    homeadd: '<path d="M4 10.5 12 4l8 6.5"/><path d="M6 9v10.2c0 .4.4.8.8.8H11"/><path d="M18 9v3"/><path d="M17 15v6M14 18h6"/>',
    find: '<path d="M13 3.5H7c-.8 0-1.5.7-1.5 1.5v14c0 .8.7 1.5 1.5 1.5h3.5"/><path d="M13 3.5 18.5 9v1.5"/><circle cx="15.5" cy="15.5" r="3"/><path d="m17.7 17.7 2.3 2.3"/>',
    car: '<path d="M5 12.5 6.8 7.6c.3-.9 1.1-1.4 2-1.4h6.4c.9 0 1.7.5 2 1.4l1.8 4.9"/><rect x="3.5" y="12.5" width="17" height="5" rx="1.6"/><path d="M6 17.5v2M18 17.5v2"/><circle cx="7.5" cy="15" r=".9" fill="currentColor"/><circle cx="16.5" cy="15" r=".9" fill="currentColor"/>',
    gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    chevr: '<path d="m9.5 6 6 6-6 6"/>',
    chevd: '<path d="m6 9.5 6 6 6-6"/>',
    back: '<path d="M19.5 12h-15"/><path d="m10.5 6-6 6 6 6"/>',
    fwd: '<path d="M4.5 12h15"/><path d="m13.5 6 6 6-6 6"/>',
    reload: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4.2h-4.2"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5s1.2-6.1 3.5-8.5z"/>',
    cookie: '<path d="M20.5 12.5A8.5 8.5 0 1 1 11.5 3.5a3 3 0 0 0 4 3.6 3 3 0 0 0 5 5.4z"/><circle cx="8.5" cy="10" r=".9" fill="currentColor"/><circle cx="12" cy="15.5" r=".9" fill="currentColor"/><circle cx="15.8" cy="12.6" r=".9" fill="currentColor"/><circle cx="8.6" cy="15" r=".7" fill="currentColor"/>',
    code: '<path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5"/>',
    ads: '<path d="M4 9.5v5c0 .6.4 1 1 1h2l5.5 4V4.5L7 8.5H5c-.6 0-1 .4-1 1z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="m7.5 15 3.5-4 3 2.5 5-6"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.5" cy="9" r="2.6"/><path d="M16.5 14.2c2.2 0 3.8 1.5 4.3 4.3"/>',
    box: '<path d="M12 3.5 19.5 7.5v9L12 20.5 4.5 16.5v-9z"/><path d="M4.5 7.5 12 11.5l7.5-4M12 11.5v9"/>',
    music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    nav: '<path d="M12 2.8 19.5 20.5 12 16.5 4.5 20.5z"/>',
    news: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M7 8.5h10M7 12h6M7 15.5h6"/><rect x="14.5" y="11.5" width="2.5" height="4.5" rx=".5"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
    pause: '<rect x="7" y="5.5" width="3.4" height="13" rx="1" fill="currentColor" stroke="none"/><rect x="13.6" y="5.5" width="3.4" height="13" rx="1" fill="currentColor" stroke="none"/>',
    bookmark: '<path d="M7 3.8h10c.6 0 1 .4 1 1V20.5l-6-4-6 4V4.8c0-.6.4-1 1-1z"/>',
    tabs: '<rect x="3.5" y="7.5" width="13" height="13" rx="2.2"/><path d="M7.5 4h10.8c1.2 0 2.2 1 2.2 2.2V17"/>',
    home: '<path d="M4 10.5 12 4l8 6.5V19c0 .6-.4 1-1 1h-4.5v-6h-5v6H5c-.6 0-1-.4-1-1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.2-1.6-1.2-2.8 0-.9.8-1.6 1.7-1.6h2.2c2.2 0 4-1.8 4-4 0-3.8-3.8-6.9-8.5-6.9z"/><circle cx="7.8" cy="11.5" r="1" fill="currentColor"/><circle cx="10.5" cy="7.6" r="1" fill="currentColor"/><circle cx="15" cy="8" r="1" fill="currentColor"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1" fill="currentColor"/><circle cx="4.8" cy="12" r="1" fill="currentColor"/><circle cx="4.8" cy="17.5" r="1" fill="currentColor"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
    speaker: '<path d="M4 9.5v5c0 .6.4 1 1 1h2.5l5 4V4.5l-5 4H5c-.6 0-1 .4-1 1z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4" height="6.5" rx="1.5"/><rect x="16.5" y="14" width="4" height="6.5" rx="1.5"/>',
    cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 17.8 9 4.8 4.8 0 0 1 17.5 18.5z"/>',
    podcast: '<circle cx="12" cy="10" r="2.5"/><path d="M12 14.5v6"/><path d="M7.5 14.5a6.5 6.5 0 1 1 9 0"/><path d="M5 17.5a10 10 0 1 1 14 0"/>',
    exit: '<path d="M14 4.5h4c.8 0 1.5.7 1.5 1.5v12c0 .8-.7 1.5-1.5 1.5h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    phone: '<path d="M6.5 3.5h2.8l1.5 4-2 1.3a10.5 10.5 0 0 0 6.4 6.4l1.3-2 4 1.5v2.8c0 1-.8 1.8-1.8 1.8A15.7 15.7 0 0 1 4.7 5.3c0-1 .8-1.8 1.8-1.8z"/>',
    parking: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M10 16.5v-9h3a2.8 2.8 0 0 1 0 5.6h-3"/>',
    fan: '<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4c0-3 .8-6.4 3.2-6.4 2 0 2.4 2.6.8 4.2L13.4 10.6M13.6 12c3 0 6.4.8 6.4 3.2 0 2-2.6 2.4-4.2.8l-2.4-2.6M12 13.6c0 3-.8 6.4-3.2 6.4-2 0-2.4-2.6-.8-4.2l2.6-2.4M10.4 12c-3 0-6.4-.8-6.4-3.2 0-2 2.6-2.4 4.2-.8l2.4 2.6"/>',
    seat: '<path d="M8 3.5h3l1 9.5H8.5z"/><path d="M8.5 13H16c.8 0 1.5.7 1.5 1.5V17H9"/><path d="M9 17v3.5M16 17v3.5"/>',
    sparkle: '<path d="M12 3.5 13.6 10.4 20.5 12l-6.9 1.6L12 20.5l-1.6-6.9L3.5 12l6.9-1.6z"/>',
    star: '<path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>',
    eyeoff: '<path d="M3.5 3.5l17 17"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c5 0 8.5 4.5 9 6-.3.8-1.2 2.3-2.7 3.7M6.6 7.7C4.6 9 3.4 10.9 3 12c.5 1.5 4 6 9 6 1.6 0 3-.4 4.2-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    font: '<path d="M5 19.5 10.5 5h1L17 19.5"/><path d="M7.2 14h7.6"/><path d="M17 11.5h3.5M18.75 9.75v3.5"/>',
    https: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7"/><path d="m9.5 15.5 1.8 1.8 3.4-3.4"/>',
    flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.1 0-3.6 3-5.3 3.6-9.4 1.9 1.2 3 2.9 3.1 4.8 1-.6 1.7-1.6 1.9-2.8 2.4 1.9 4.4 4.4 4.4 7.4 0 3.5-2.6 6.1-6.5 6.1z"/>',
    filter: '<path d="M4 5.5h16l-6 7.2V19l-4 1.5v-7.8z"/>',
    download: '<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/>',
    wifi: '<path d="M2.5 9a14 14 0 0 1 19 0" /><path d="M5.6 12.4a9.5 9.5 0 0 1 12.8 0"/><path d="M8.8 15.8a5 5 0 0 1 6.4 0"/><circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none"/>',
    bt: '<path d="m7 7.5 10 9L12 21V3l5 4.5-10 9"/>',
    queue: '<path d="M4 6.5h12M4 11.5h12M4 16.5h7"/><path d="M15 15v6l5-3z" fill="currentColor"/>',
    skipf: '<path d="M6 5.5v13l9-6.5z" fill="currentColor"/><path d="M18 5.5v13"/>',
    skipb: '<path d="M18 5.5v13l-9-6.5z" fill="currentColor"/><path d="M6 5.5v13"/>',
    fwd30: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4.2h-4.2"/>',
    sort: '<path d="M7 4.5v15M3.5 16l3.5 3.5 3.5-3.5M17 19.5v-15M13.5 8 17 4.5 20.5 8"/>',
  };

  const svg = (name, size, sw, extra) =>
    `<svg class="ic ${extra || ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${S[name] || ''}</svg>`;

  /* Logo mark: "focus ring" — an open aperture ring with a solid core. */
  window.mfLogo = (size, ring, core) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">
       <circle cx="24" cy="24" r="17" fill="none" stroke="${ring}" stroke-width="5" stroke-linecap="round"
         stroke-dasharray="80 26.8"/>
       <circle cx="24" cy="24" r="7" fill="${core}"/>
       <circle cx="36.02" cy="11.98" r="3.2" fill="${core}"/>
     </svg>`;

  function statusBar(el) {
    const t = el.dataset.time || '10:24';
    el.innerHTML = `
      <span class="sb-time">${t}</span>
      <span class="sb-cam"></span>
      <span class="sb-icons">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5 1.2 8.6a15.6 15.6 0 0 1 21.6 0z"/></svg>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 2.5v19h-19z"/></svg>
        <span class="sb-batt"><span style="width:${el.dataset.batt || 78}%"></span></span>
      </span>`;
  }

  function render() {
    document.querySelectorAll('i[data-i]').forEach((el) => {
      const s = el.dataset.s || 24, w = el.dataset.w || 1.8;
      const span = document.createElement('span');
      span.className = 'icw ' + (el.className || '');
      if (el.getAttribute('style')) span.setAttribute('style', el.getAttribute('style'));
      span.innerHTML = svg(el.dataset.i, s, w);
      el.replaceWith(span);
    });
    document.querySelectorAll('[data-logo]').forEach((el) => {
      const [size, ring, core] = el.dataset.logo.split(',');
      el.innerHTML = window.mfLogo(size, ring, core);
    });
    document.querySelectorAll('.sb').forEach(statusBar);
    document.querySelectorAll('.nav').forEach((el) => (el.innerHTML = '<span class="nav-pill"></span>'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
