/* ═══════════════════════════════════════════════════
   MATCHMAKERS — main.js
   Nav scroll state + scroll-reveal animations
   ═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  // Prevent browser scroll restoration (smooth scroll-behavior causes page to load scrolled)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  // Nav scroll state
  var nav = document.querySelector('nav');
  if (nav) {
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    });
  }

  // Mobile hamburger menu (legacy nav — inner pages)
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

  // Sticky-bar dropdown menu (homepage)
  var stickyNavBtn = document.querySelector('.hp-sticky-bar__nav');
  var stickyMenu = document.getElementById('hp-sticky-menu');
  if (stickyNavBtn && stickyMenu) {
    var setStickyMenu = function (open) {
      stickyNavBtn.setAttribute('aria-expanded', String(open));
      if (open) stickyMenu.removeAttribute('hidden');
      else stickyMenu.setAttribute('hidden', '');
    };
    stickyNavBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var expanded = stickyNavBtn.getAttribute('aria-expanded') === 'true';
      setStickyMenu(!expanded);
    });
    // Close on link click
    stickyMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setStickyMenu(false); });
    });
    // Close on outside click
    document.addEventListener('click', function (e) {
      if (stickyNavBtn.getAttribute('aria-expanded') !== 'true') return;
      if (stickyMenu.contains(e.target) || stickyNavBtn.contains(e.target)) return;
      setStickyMenu(false);
    });
    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && stickyNavBtn.getAttribute('aria-expanded') === 'true') {
        setStickyMenu(false);
        stickyNavBtn.focus();
      }
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
