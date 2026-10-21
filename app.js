(() => {
  'use strict';

  function ready() {
    const header = document.getElementById('siteHeader');
    const menuToggle = document.getElementById('menuToggle');
    const navigation = document.getElementById('primaryNav');
    const navigationLinks = navigation
      ? [...navigation.querySelectorAll('a[href^="#"]')]
      : [];
    const sections = navigationLinks.map((link) => {
      const id = link.getAttribute('href').slice(1);
      return { link, section: document.getElementById(id) };
    }).filter(({ section }) => section);

    function setMenu(open, returnFocus = false) {
      if (!menuToggle || !navigation) return;
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      navigation.classList.toggle('is-open', open);
      if (returnFocus) menuToggle.focus();
    }

    menuToggle?.addEventListener('click', () => {
      setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
    });

    navigationLinks.forEach((link) => {
      link.addEventListener('click', () => setMenu(false));
    });

    document.addEventListener('click', (event) => {
      if (navigation?.classList.contains('is-open') &&
          !navigation.contains(event.target) &&
          !menuToggle?.contains(event.target)) {
        setMenu(false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && navigation?.classList.contains('is-open')) {
        setMenu(false, true);
      }
    });

    let scrollScheduled = false;
    function updateScrollState() {
      scrollScheduled = false;
      header?.classList.toggle('is-scrolled', window.scrollY > 24);
      const readingLine = (header?.offsetHeight || 90) + 100;
      let current = sections[0];
      sections.forEach((entry) => {
        if (entry.section.getBoundingClientRect().top <= readingLine) current = entry;
      });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = sections.at(-1);
      }
      sections.forEach(({ link }) => {
        if (link === current?.link) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    function scheduleScrollUpdate() {
      if (scrollScheduled) return;
      scrollScheduled = true;
      window.requestAnimationFrame(updateScrollState);
    }

    window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
    window.addEventListener('resize', scheduleScrollUpdate, { passive: true });
    updateScrollState();

    const year = document.getElementById('year');
    if (year) year.textContent = String(new Date().getFullYear());

    setupGallery();
    setupHeroVideo();
    loadTour();
    setupAnalytics();
  }

  function setupHeroVideo() {
    const video = document.getElementById('heroVideo');
    const toggle = document.getElementById('visualToggle');
    if (!video || !toggle) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let manuallyPaused = reducedMotion.matches;
    function updateToggle() {
      const paused = video.paused;
      toggle.textContent = paused ? 'Play visual ▷' : 'Pause visual Ⅱ';
      toggle.setAttribute('aria-pressed', String(paused));
    }
    async function play() {
      if (!video.getAttribute('src')) video.src = video.dataset.src;
      video.muted = true;
      try { await video.play(); } catch { /* The still image remains if autoplay is unavailable. */ }
      updateToggle();
    }
    video.addEventListener('playing', () => video.classList.add('is-playing'));
    video.addEventListener('play', updateToggle);
    video.addEventListener('pause', updateToggle);
    video.addEventListener('error', () => {
      video.classList.remove('is-playing');
      toggle.hidden = true;
    });
    toggle.addEventListener('click', () => {
      manuallyPaused = !video.paused;
      if (video.paused) play();
      else video.pause();
    });
    reducedMotion.addEventListener('change', () => {
      manuallyPaused = reducedMotion.matches;
      if (manuallyPaused) video.pause();
      else play();
    });
    new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) video.pause();
      else if (!manuallyPaused) play();
    }, { threshold: .05 }).observe(video);
    if (!reducedMotion.matches) play();
    else updateToggle();
  }

  function setupGallery() {
    const items = [...document.querySelectorAll('.gallery-item[data-image]')];
    const dialog = document.getElementById('galleryDialog');
    const image = document.getElementById('galleryImage');
    const caption = document.getElementById('galleryCaption');
    const close = document.getElementById('galleryClose');
    const previous = document.getElementById('galleryPrev');
    const next = document.getElementById('galleryNext');
    if (!items.length || !dialog || !image || typeof dialog.showModal !== 'function') return;

    let index = 0;
    let opener = null;

    function showImage(nextIndex) {
      index = (nextIndex + items.length) % items.length;
      const item = items[index];
      image.src = item.dataset.image;
      image.alt = item.dataset.alt || item.querySelector('img')?.alt || 'Kenny Pham live';
      if (caption) caption.textContent = `${image.alt} · ${index + 1} / ${items.length}`;
    }

    items.forEach((item, itemIndex) => {
      item.addEventListener('click', (event) => {
        event.preventDefault();
        opener = item;
        showImage(itemIndex);
        dialog.showModal();
        close?.focus();
      });
    });

    close?.addEventListener('click', () => dialog.close());
    previous?.addEventListener('click', () => showImage(index - 1));
    next?.addEventListener('click', () => showImage(index + 1));

    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showImage(index - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        showImage(index + 1);
      }
    });

    dialog.addEventListener('close', () => {
      image.removeAttribute('src');
      opener?.focus();
    });

    if (items.length < 2) {
      if (previous) previous.hidden = true;
      if (next) next.hidden = true;
    }
  }

  function loadTour() {
    const list = document.getElementById('tourEvents');
    const status = document.getElementById('tourStatus');
    const widget = document.getElementById('bandsintownWidget');
    if (!list || !widget) return;

    const excluded = 'script, style, link, template, noscript, .bit-widget-initializer, [hidden]';
    let fallbackTimer;

    function isVisible(element) {
      if (element.closest(excluded)) return false;
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' &&
        element.getClientRects().length > 0;
    }

    function hasRenderedContent() {
      // A script, stylesheet, or empty widget wrapper does not confirm a loaded show widget.
      const frames = [...widget.querySelectorAll('iframe[src]')];
      if (frames.some((frame) => {
        const source = frame.getAttribute('src');
        return source && source !== 'about:blank' && isVisible(frame);
      })) return true;

      const walker = document.createTreeWalker(widget, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.trim() && node.parentElement && isVisible(node.parentElement)) return true;
      }
      return false;
    }

    function updateWidgetState() {
      if (!hasRenderedContent()) return false;
      list.hidden = true;
      if (status) status.textContent = 'Show updates from Bandsintown.';
      window.clearTimeout(fallbackTimer);
      observer.disconnect();
      return true;
    }

    const observer = new MutationObserver(updateWidgetState);
    observer.observe(widget, { childList: true, subtree: true, characterData: true, attributes: true });
    if (updateWidgetState()) return;

    fallbackTimer = window.setTimeout(() => {
      if (updateWidgetState()) return;
      const heading = list.querySelector('h3');
      if (heading) heading.textContent = 'Find your next show.';
      if (status) status.textContent = 'Visit Bandsintown for the latest show announcements.';
    }, 12000);
  }

  function setupAnalytics() {
    const productionHosts = new Set(['kennyphammusic.com', 'www.kennyphammusic.com']);
    if (!productionHosts.has(window.location.hostname.toLowerCase())) return;

    if (typeof window.fbq !== 'function') {
      const fbq = function () {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
        else fbq.queue.push(arguments);
      };
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.queue = [];
      window.fbq = fbq;
      if (!window._fbq) window._fbq = fbq;
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.append(script);
    }

    window.fbq('init', '912570121617717');
    window.fbq('track', 'PageView');
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('.spotify-link') && typeof window.fbq === 'function') {
        window.fbq('track', 'ViewContent', { content_name: 'Spotify Click' });
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
