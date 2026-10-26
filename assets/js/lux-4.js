/* BDA shared motion layer: smooth scroll (Lenis), custom cursor, page transitions, line reveals.
   Exposes window.BDA = {lenis, stop, start, scrollTo, split}. */
(function(){
  var doc = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var BDA = window.BDA = {lenis: null};

  /* photos and videos: no "save image" menu and no dragging them out of the page */
  var MEDIA = 'img, video, picture, .ph, .pimg, .shot, .hero-media, .slide, .m-stage, .lb';
  document.addEventListener('contextmenu', function(e){ if(e.target.closest && e.target.closest(MEDIA)) e.preventDefault(); });
  document.addEventListener('dragstart', function(e){ if(e.target.closest && e.target.closest('img, video')) e.preventDefault(); });
  function lockMedia(root){ (root || document).querySelectorAll('img').forEach(function(i){ i.setAttribute('draggable', 'false'); }); (root || document).querySelectorAll('video').forEach(function(v){ v.setAttribute('controlslist', 'nodownload noplaybackrate'); v.disablePictureInPicture = true; }); }
  lockMedia(); new MutationObserver(function(ms){ ms.forEach(function(m){ m.addedNodes.forEach(function(n){ if(n.nodeType === 1){ if(n.matches('img, video')) lockMedia(n.parentNode); else lockMedia(n); } }); }); }).observe(document.documentElement, {childList: true, subtree: true});

  /* smooth scroll */
  if(!reduce && window.Lenis){
    BDA.lenis = new Lenis({lerp: .085, wheelMultiplier: .95, autoRaf: true, anchors: {duration: 1.6}, allowNestedScroll: true, stopInertiaOnNavigate: true});
  }
  BDA.stop = function(){ if(BDA.lenis) BDA.lenis.stop(); };
  BDA.start = function(){ if(BDA.lenis) BDA.lenis.start(); };
  BDA.scrollTo = function(target, opts){
    if(BDA.lenis) BDA.lenis.scrollTo(target, opts || {});
    else if(typeof target === 'number') window.scrollTo(0, target);
    else if(target && target.scrollIntoView) target.scrollIntoView();
  };

  /* page transitions: a black curtain with the BDA mark between pages of the site */
  var pt = document.querySelector('.pt');
  function reveal(){ if(!pt || !doc.classList.contains('pt-in')) return; requestAnimationFrame(function(){ requestAnimationFrame(function(){ pt.classList.add('leave'); doc.classList.remove('pt-in'); }); }); }
  if(document.readyState === 'complete') setTimeout(reveal, 80); else window.addEventListener('load', function(){ setTimeout(reveal, 80); });
  setTimeout(reveal, 1600); /* never leave the curtain down if a slow asset holds the load event */
  window.addEventListener('pageshow', function(e){ if(e.persisted && pt){ pt.classList.remove('cover'); pt.classList.add('leave'); } });
  document.addEventListener('click', function(e){
    if(!pt || reduce || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if(!a || a.target === '_blank' || a.hasAttribute('download')) return;
    var url; try{ url = new URL(a.getAttribute('href'), location.href); }catch(err){ return; }
    if(url.origin !== location.origin) return;
    var here = location.pathname.replace(/(index)?(\.html)?$/, ''), there = url.pathname.replace(/(index)?(\.html)?$/, '');
    if(here === there) return; /* same page: anchors are handled by the smooth scroll */
    e.preventDefault();
    pt.classList.remove('leave'); void pt.offsetWidth; pt.classList.add('cover');
    BDA.stop();
    setTimeout(function(){ location.href = url.href; }, 760);
  });

  /* headings that rise line by line: words are wrapped once, lines get staggered delays when they enter */
  function unsplit(el){ el.querySelectorAll('.w').forEach(function(w){ w.replaceWith(document.createTextNode(w.textContent)); }); el.normalize(); }
  function split(el){
    if(reduce) return;
    unsplit(el);
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [], n;
    while((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function(t){
      var parts = t.nodeValue.split(/(\s+)/); if(parts.length < 2 && !parts[0].trim()) return;
      var frag = document.createDocumentFragment();
      parts.forEach(function(p){
        if(!p) return;
        if(/^\s+$/.test(p)){ frag.appendChild(document.createTextNode(p)); return; }
        var w = document.createElement('span'); w.className = 'w';
        var i = document.createElement('span'); i.className = 'wi'; i.textContent = p;
        w.appendChild(i); frag.appendChild(w);
      });
      t.parentNode.replaceChild(frag, t);
    });
    stagger(el);
  }
  function stagger(el){
    var tops = [], ws = el.querySelectorAll('.w');
    ws.forEach(function(w){ var t = Math.round(w.offsetTop / 4); if(tops.indexOf(t) < 0) tops.push(t); });
    tops.sort(function(a, b){ return a - b; });
    ws.forEach(function(w){ w.firstChild.style.transitionDelay = (tops.indexOf(Math.round(w.offsetTop / 4)) * .11).toFixed(2) + 's'; });
  }
  BDA.split = function(){ document.querySelectorAll('[data-split]').forEach(split); };
  var sio = 'IntersectionObserver' in window && !reduce ? new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ stagger(e.target); e.target.classList.add('in'); sio.unobserve(e.target); } });
  }, {rootMargin: '0px 0px -10% 0px', threshold: .1}) : null;
  BDA.split();
  document.querySelectorAll('[data-split]').forEach(function(el){ if(sio) sio.observe(el); else el.classList.add('in'); });
  var rz = null; window.addEventListener('resize', function(){ clearTimeout(rz); rz = setTimeout(function(){ document.querySelectorAll('[data-split]').forEach(stagger); }, 200); });

  /* custom cursor: a tiny light-blue square that follows the pointer.
     Starts right away with a mouse, or on the first trackpad/mouse movement on touch screens (tablets, touch laptops). */
  var curReady = false;
  function initCursor(e0){
    if(curReady || reduce) return; curReady = true;
    var dot = document.createElement('div'); dot.className = 'cur-dot';
    document.body.appendChild(dot);
    doc.classList.add('has-cur');
    var tx = -100, ty = -100, x = -100, y = -100, seen = false;
    function track(e){
      if(e.pointerType === 'touch') return; /* finger taps also fire mouse-like events: follow only a real mouse or trackpad */
      tx = e.clientX; ty = e.clientY;
      if(!seen){ seen = true; x = tx; y = ty; }
      doc.classList.add('cur-on');
    }
    window.addEventListener(window.PointerEvent ? 'pointermove' : 'mousemove', track, {passive: true});
    if(e0) track(e0);
    document.addEventListener('mouseleave', function(){ doc.classList.remove('cur-on'); });
    window.addEventListener('pointerdown', function(e){ if(e.pointerType === 'touch') doc.classList.remove('cur-on'); }, {passive: true});
    (function loop(){
      x += (tx - x) * .45; y += (ty - y) * .45;
      dot.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      requestAnimationFrame(loop);
    })();
  }
  if(fine) initCursor();
  else if(!reduce && window.PointerEvent){
    window.addEventListener('pointermove', function first(e){
      if(e.pointerType !== 'mouse') return;
      window.removeEventListener('pointermove', first);
      initCursor(e);
    }, {passive: true});
  }
})();
