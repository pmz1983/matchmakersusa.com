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

  // Mobile hamburger menu
  var hamburger = document.querySelector('.hamburger');
  if (hamburger && nav) {
    hamburger.addEventListener('click', function () {
      var expanded = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', String(!expanded));
      nav.classList.toggle('menu-open');
    });
    // Close menu when a nav link is clicked
    var navLinks = document.querySelectorAll('.nav-links .nl, .nav-links .nb');
    navLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        hamburger.setAttribute('aria-expanded', 'false');
        nav.classList.remove('menu-open');
      });
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
