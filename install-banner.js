/* ============================================================
   install-banner.js — Invitation à installer l'application (PWA)
   • Android / Chrome : capture « beforeinstallprompt » → bouton Installer
   • iOS / Safari     : instructions « Partager → Écran d'accueil »
   • Jamais affiché en local (développement), ni dans une iframe,
     ni une fois l'app déjà installée (mode standalone).
   • Fermé pour la session → ne reapparaît pas avant une nouvelle visite.
   ============================================================ */
(function () {
  'use strict';

  var DISMISS_KEY = 'pwa-install-dismissed';

  /* ---------- utilitaires ---------- */
  function dismissed() {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
  }
  function markDismissed() {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
  }
  function isStandalone() {
    try { return window.matchMedia('(display-mode: standalone)').matches; } catch (e) { return false; }
  }

  /* ---------- API testable (affichage manuel possible) ---------- */
  var banner = null;
  var deferredPrompt = null;
  var showTimer = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function ensureStyles() {
    if (document.getElementById('pwa-install-style')) return;
    var css = [
      '.pwa-install-banner{position:fixed;left:50%;bottom:18px;transform:translate(-50%,140%);',
      'width:min(430px,calc(100vw - 24px));box-sizing:border-box;background:#ffffff;',
      'border:1px solid #e3e3d5;border-radius:18px;box-shadow:0 14px 36px rgba(0,0,0,.18);',
      'padding:16px 40px 16px 16px;display:flex;gap:13px;align-items:flex-start;z-index:9999;',
      'font-family:"Segoe UI",Verdana,Tahoma,sans-serif;transition:transform .45s cubic-bezier(.2,.9,.3,1.2),opacity .35s;opacity:0;}',
      '.pwa-install-banner.pwa-show{transform:translate(-50%,0);opacity:1;}',
      '.pwa-install-banner img{width:52px;height:52px;border-radius:13px;flex:0 0 52px;box-shadow:0 3px 8px rgba(0,0,0,.18);}',
      '.pwa-install-banner strong{display:block;font-size:1rem;color:#2f5a3d;margin:1px 0 4px;}',
      '.pwa-install-banner p{margin:0 0 10px;font-size:.85rem;line-height:1.45;color:#6b6b6b;}',
      '.pwa-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap;}',
      '.pwa-install-btn{background:#4a7c59;color:#fff;border:none;border-radius:999px;',
      'padding:9px 20px;font-size:.88rem;font-weight:800;cursor:pointer;transition:background .2s;}',
      '.pwa-install-btn:hover{background:#2f5a3d;}',
      '.pwa-later-btn{background:transparent;border:none;color:#6b6b6b;font-size:.85rem;',
      'font-weight:700;cursor:pointer;padding:8px 6px;border-radius:999px;}',
      '.pwa-later-btn:hover{color:#3a3a3a;text-decoration:underline;}',
      '.pwa-close{position:absolute;top:8px;right:10px;background:transparent;border:none;',
      'font-size:.95rem;color:#9a9a8a;cursor:pointer;padding:5px 7px;border-radius:50%;line-height:1;}',
      '.pwa-close:hover{background:#f1f1e6;color:#3a3a3a;}',
      '.pwa-ios-steps{background:#f3f7f1;border:1px dashed #a8d5a2;border-radius:12px;',
      'padding:9px 11px;font-size:.84rem;color:#2f5a3d !important;margin:0 0 10px !important;}',
      '@media (max-width:420px){.pwa-install-banner{bottom:10px;padding:13px 36px 13px 13px;}',
      '.pwa-install-banner img{width:44px;height:44px;flex-basis:44px;}}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'pwa-install-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function build(mode) {
    ensureStyles();
    var wrap = el('div', 'pwa-install-banner');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-live', 'polite');
    wrap.setAttribute('aria-label', "Installer l'application");

    var close = el('button', 'pwa-close', '✕');
    close.setAttribute('aria-label', 'Fermer');
    close.type = 'button';

    var img = document.createElement('img');
    img.src = 'icons/icon-192.png';
    img.alt = '';
    img.width = 52; img.height = 52;

    var box = el('div', 'pwa-text');
    box.appendChild(el('strong', null, "Installer l'application"));
    box.appendChild(el('p', null, 'Ajoutez « La Prière » à votre écran d’accueil pour la retrouver même hors connexion.'));

    if (mode === 'ios') {
      var steps = el('p', 'pwa-ios-steps', 'Sur iPhone / iPad : touchez Partager ⬆ puis « Sur l’écran d’accueil ».');
      box.appendChild(steps);
      var ok = el('button', 'pwa-later-btn', 'J’ai compris');
      ok.type = 'button';
      box.appendChild(ok);
      ok.addEventListener('click', function () { markDismissed(); hide(); });
    } else if (mode === 'fallback') {
      /* pas d'invitation native (navigateur sans beforeinstallprompt) :
         guider vers le menu du navigateur */
      var fb = el('p', 'pwa-ios-steps', 'Ouvrez le menu ⋮ de votre navigateur puis choisissez « Installer l’application » — ou l’icône ⊕ dans la barre d’adresse.');
      box.appendChild(fb);
      var ok2 = el('button', 'pwa-later-btn', 'J’ai compris');
      ok2.type = 'button';
      box.appendChild(ok2);
      ok2.addEventListener('click', function () { markDismissed(); hide(); });
    } else {
      var actions = el('div', 'pwa-actions');
      var install = el('button', 'pwa-install-btn', '⬇ Installer');
      install.type = 'button';
      var later = el('button', 'pwa-later-btn', 'Plus tard');
      later.type = 'button';
      actions.appendChild(install);
      actions.appendChild(later);
      box.appendChild(actions);

      install.addEventListener('click', function () {
        if (!runNativePrompt()) hide();
      });
      later.addEventListener('click', function () { markDismissed(); hide(); });
    }

    close.addEventListener('click', function () { markDismissed(); hide(); });
    wrap.appendChild(close);
    wrap.appendChild(img);
    wrap.appendChild(box);
    return wrap;
  }

  function show(force) {
    if (banner || (!force && dismissed()) || !document.body) return;
    /* sans invitation native : variante instructions sur iOS réel,
       variante menu ⋮ sinon (aperçu local ?pwa=install). */
    var isIOSUser = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    var mode = deferredPrompt ? 'install' : (isIOSUser ? 'ios' : 'fallback');
    banner = build(mode);
    document.body.appendChild(banner);
    /* animation d'entrée : rAF si l'onglet est visible, filet setTimeout sinon */
    function reveal() {
      if (banner) banner.classList.add('pwa-show');
    }
    if (window.requestAnimationFrame) {
      requestAnimationFrame(function () { requestAnimationFrame(reveal); });
    }
    setTimeout(reveal, 120);
  }

  function hide() {
    if (!banner) return;
    var b = banner;
    banner = null;
    b.classList.remove('pwa-show');
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 450);
  }

  function scheduleShow(delay) {
    if (dismissed()) return;
    clearTimeout(showTimer);
    showTimer = setTimeout(show, delay || 2000);
  }

  /* ---------- déclencheur partagé (bannière + bouton nav) ---------- */
  function runNativePrompt() {
    if (!deferredPrompt) return false;
    var p = deferredPrompt;
    deferredPrompt = null;
    try { p.prompt(); } catch (e) { return false; }
    p.userChoice.then(function () {
      markDismissed();
      hide();
    })['catch'](function () {});
    return true;
  }

  function triggerInstall() {
    if (runNativePrompt()) return;
    /* pas d'invitation native → afficher les instructions
       (force=true : ignore la fermeture précédente de la session) */
    show(true);
  }

  /* exposé pour tests / usage manuel */
  window.PWAInstallBanner = { show: show, hide: hide, schedule: scheduleShow, install: triggerInstall };

  /* ---------- bouton permanent « ↓ Installer » dans la nav ----------
     fonctionne sur TOUTES les pages, y compris en local (aperçu) */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || typeof t.closest !== 'function') return;
    if (!t.closest('.nav-install')) return;
    e.preventDefault();
    triggerInstall();
  });

  /* ---------- garde-fous : site PUBLIÉ uniquement ----------
     en local (développement), dans une iframe (aperçu), ou quand
     l'app est déjà installée : aucun déclenchement automatique.
     Exception volontaire : ?pwa=install force l'affichage (aperçu). */
  var forcePreview = /(?:\?|&)pwa=install(?:&|$)/.test(location.search);
  var host = location.hostname;
  var isLocal =
    location.protocol === 'file:' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]';
  var inIframe = window.self !== window.top;
  if (!forcePreview && (isLocal || inIframe || isStandalone())) {
    return; /* seules les fonctions manuelles restent disponibles */
  }

  /* aperçu explicite : afficher la bannière une fois (sans invitation native) */
  if (forcePreview) {
    scheduleShow(1200);
    return;
  }

  /* ---------- écoute précoce de l'événement ---------- */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    scheduleShow(1800);
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    markDismissed();
    hide();
  });

  /* ---------- iOS Safari : pas d'événement → invite manuelle ---------- */
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  var isSafari = /^((?!chrome|crios|android|fxios|edg).)*safari/i.test(navigator.userAgent);
  if (isIOS && isSafari) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      scheduleShow(2500);
    } else {
      document.addEventListener('DOMContentLoaded', function () { scheduleShow(2500); });
    }
  }
})();
