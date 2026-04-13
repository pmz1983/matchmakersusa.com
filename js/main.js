/* ═══════════════════════════════════════════════════
   MATCHMAKERS — main.js
   Nav scroll state + scroll-reveal animations
   ═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  // Nav scroll state
  var nav = document.querySelector('nav');
  if (nav) {
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    });
  }

  // Scroll-reveal (IntersectionObserver)
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(function (el) {
      el.classList.add('in');
    });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(function (el) {
    io.observe(el);
  });
})();
