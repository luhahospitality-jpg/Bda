/* BDA shared motion layer: smooth scroll (Lenis), custom cursor, page transitions, line reveals.
   Exposes window.BDA = {lenis, stop, start, scrollTo, split}. */
(function(){
  var doc = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var BDA = window.BDA = {lenis: null};

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

  /* custom cursor: a small inverted dot that grows over links and becomes a label over images */
  if(fine && !reduce){
    var dot = document.createElement('div'), lbl = document.createElement('div');
    dot.className = 'cur-dot'; dot.innerHTML = '<i></i>'; lbl.className = 'cur-lbl'; lbl.innerHTML = '<i></i>';
    document.body.appendChild(dot); document.body.appendChild(lbl);
    doc.classList.add('has-cur');
    var tx = -100, ty = -100, x = -100, y = -100, lx = -100, ly = -100, seen = false;
    window.addEventListener('mousemove', function(e){
      tx = e.clientX; ty = e.clientY;
      if(!seen){ seen = true; x = lx = tx; y = ly = ty; }
      doc.classList.add('cur-on');
    }, {passive: true});
    document.addEventListener('mouseleave', function(){ doc.classList.remove('cur-on'); });
    window.addEventListener('mousedown', function(){ doc.classList.add('cur-down'); });
    window.addEventListener('mouseup', function(){ doc.classList.remove('cur-down'); });
    function label(el){
      var v = el.getAttribute('data-cursor') || ''; var p = v.split('|');
      return (doc.lang === 'en' && p[1]) ? p[1] : p[0];
    }
    document.addEventListener('mouseover', function(e){
      var t = e.target, el = t.closest && t.closest('[data-cursor], a, button, label, [role="button"], .nitem, .node, input, textarea, select');
      doc.classList.remove('cur-link', 'cur-label', 'cur-text');
      if(!el) return;
      if(el.matches('input:not([type="checkbox"]), textarea, select')) doc.classList.add('cur-text');
      else if(el.hasAttribute('data-cursor')){ lbl.firstChild.textContent = label(el); doc.classList.add('cur-label'); }
      else doc.classList.add('cur-link');
    });
    (function loop(){
      x += (tx - x) * .28; y += (ty - y) * .28; lx += (tx - lx) * .16; ly += (ty - ly) * .16;
      dot.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      lbl.style.transform = 'translate3d(' + lx.toFixed(1) + 'px,' + ly.toFixed(1) + 'px,0)';
      requestAnimationFrame(loop);
    })();
  }
})();
