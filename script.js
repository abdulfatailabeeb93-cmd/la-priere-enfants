/* ============================================================
   Script partagé — Site « La Prière du Prophète ﷺ »
   1) Accordéon des chapitres détaillés
   2) Bouton PDF : téléchargement fiable + confirmation visuelle
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {

  /* ---------- 1. Accordéon des chapitres ---------- */
  document.querySelectorAll('.chapter-head').forEach(function (head) {
    head.addEventListener('click', function () {
      var chapter = head.parentElement;
      var wasOpen = chapter.classList.contains('open');
      document.querySelectorAll('.chapter.open').forEach(function (c) {
        c.classList.remove('open');
      });
      if (!wasOpen) {
        chapter.classList.add('open');
      }
    });
  });

  /* ---------- 2. Bouton PDF ---------- */
  document.querySelectorAll('a.btn-pdf').forEach(function (btn) {
    var url = btn.getAttribute('href') || '';
    // Ne traiter que les vrais liens PDF (ex: le bouton « Retour » de quiz.html)
    if (!/\.pdf($|\?)/i.test(url)) return;

    var original = btn.innerHTML;
    btn.addEventListener('click', function (e) {

      // Confirmation visuelle IMMÉDIATE au clic
      btn.textContent = '⏳ Téléchargement en cours…';

      function done() {
        btn.textContent = '✅ Fichier téléchargé !';
        setTimeout(function () { btn.innerHTML = original; }, 3000);
      }

      if (location.protocol === 'file:') {
        // file:// : fetch est bloqué (CORS) -> ouvrir dans un nouvel onglet
        e.preventDefault();
        var w = window.open(url, '_blank');
        if (w) {
          done();
        } else {
          // popup bloqué : laisser le comportement natif (attribut download)
          btn.innerHTML = original;
        }
        return;
      }

      // http(s) : télécharger en blob
      e.preventDefault();
      fetch(url)
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.blob();
        })
        .then(function (blob) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'Description_priere_et_adhkar_francais.pdf';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
          done();
        })
        .catch(function () {
          window.open(url, '_blank');
          done();
        });
    });
  });

});
