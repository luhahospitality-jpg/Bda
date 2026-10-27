/* BDA enquiry forms, shared by the home pop-up, /plaza and /agrelo:
   - campaign tags (utm_*, gclid, fbclid) kept for the whole visit, so an enquiry from /plaza still knows the ad that brought the visitor to the home
   - international phone field (intl-tel-input), sent as +5491155555555
   - one HubSpot form per project and language, with a copy to info@bda-realty.com through FormSubmit
   Every storage access is wrapped: if the browser blocks it, the forms work the same. */
(function(){
  var PORTAL = '149609961';
  var HS_FORMS = {
    plaza: { es: '7ceea8df-3f81-4e81-bf33-80443ed65799', en: '8cd42fa7-fbdd-4aca-8950-54b311dc0573' },
    'alto-agrelo': { es: '23918c31-b657-4010-9584-790db149f607', en: 'dec81d04-9fb2-4b20-a004-120110cc8e30' }
  };
  var PROJECTS = {
    plaza: { id: 'plaza', name: 'Plaza Hotel & Residences' },
    'alto-agrelo': { id: 'alto_agrelo', name: 'Reserva Alto Agrelo' }
  };
  /* HubSpot tracking code: stays off until the HubSpot cookie banner is set to ask for consent first */
  var HS_TRACKING = false;
  var ITI = '/assets/vendor/iti-29.5.3/';
  var TAGS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'];

  if(HS_TRACKING){
    var hs = document.createElement('script'); hs.id = 'hs-script-loader'; hs.async = true; hs.defer = true;
    hs.src = 'https://js-eu1.hs-scripts.com/' + PORTAL + '.js'; document.head.appendChild(hs);
  }

  /* campaign tags: a new arrival with tags replaces the stored ones for this visit */
  var fromUrl = (function(){
    var q = new URLSearchParams(location.search), o = {}, any = false;
    TAGS.forEach(function(k){ var v = q.get(k); if(v){ o[k] = v.slice(0, 200); any = true; } });
    return any ? o : null;
  })();
  if(fromUrl){ try{ sessionStorage.setItem('bda_utm', JSON.stringify(fromUrl)); }catch(e){} }
  function campaign(){
    if(fromUrl) return fromUrl;
    try{ var s = JSON.parse(sessionStorage.getItem('bda_utm') || 'null'); if(s && typeof s === 'object') return s; }catch(e){}
    return {};
  }

  /* phone: country picker with dial code; the starting country comes from the browser's language region */
  function region(){
    var m = /-([a-z]{2})(?:-|$)/i.exec(navigator.language || '');
    if(m) return m[1].toLowerCase();
    return (navigator.language || '').toLowerCase().indexOf('es') === 0 ? 'es' : 'us';
  }
  function phone(input, lang){
    if(!input || input._iti) return input && input._iti;
    if(!window.intlTelInput) return null;
    var opts = { countryOrder: ['es', 'ar', 'uy', 'us', 'mx', 'cl', 'br', 'gb'], separateDialCode: true, countrySearch: true, strictMode: true,
      countryNameLocale: lang === 'en' ? 'en' : 'es', loadUtils: function(){ return import(ITI + 'js/utils.js'); },
      uiTranslations: lang === 'en' ? { searchPlaceholder: 'Search country' } : { searchPlaceholder: 'Buscar país', searchEmptyState: 'Sin resultados',
        countryListAriaLabel: 'Lista de países', clearSearchAriaLabel: 'Borrar búsqueda', closeCountrySelectorAriaLabel: 'Cerrar', noCountrySelected: 'Elige el país del teléfono' } };
    try{ input._iti = window.intlTelInput(input, Object.assign({ initialCountry: region() }, opts)); }
    catch(e){ try{ input._iti = window.intlTelInput(input, Object.assign({ initialCountry: 'es' }, opts)); }catch(e2){ input._iti = null; } }
    return input._iti;
  }
  /* the number in international format, and whether it looks valid */
  function number(input){
    var it = input._iti, digits = input.value.replace(/\D/g, '');
    if(it){
      var valid = it.isValidNumber();
      if(valid !== null) return { number: it.getNumber(), valid: valid };
      var c = it.getSelectedCountry();  /* number rules not loaded yet: build it from the dial code */
      if(c && c.dialCode) return { number: '+' + c.dialCode + digits.replace(/^0+/, ''), valid: digits.length >= 6 };
    }
    var raw = input.value.trim().replace(/[^\d+]/g, '');
    return { number: raw, valid: digits.length >= 6 };
  }

  function cookie(n){ var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; }
  function within(p, ms){ return Promise.race([p, new Promise(function(_, no){ setTimeout(function(){ no(new Error('timeout')); }, ms); })]); }

  /* d = { project: 'plaza' | 'alto-agrelo', lang: 'es' | 'en', origin: 'home_popup' | 'proyecto_arriba' | 'proyecto_final', first, last, email, phone }
     resolves true when the enquiry reached HubSpot or, failing that, the email copy */
  function send(d){
    var pj = PROJECTS[d.project], lang = d.lang === 'en' ? 'en' : 'es', utm = campaign(), page = location.origin + location.pathname;
    var tags = Object.keys(utm).map(function(k){ return k + '=' + utm[k]; }).join(' · ') || 'Directo / sin campaña';
    var note = ['Proyecto: ' + pj.name, 'Idioma: ' + lang.toUpperCase(), 'Origen: ' + d.origin, 'Campaña: ' + tags, 'Página: ' + page].join('\n');
    var fields = [
      { name: 'firstname', value: d.first }, { name: 'lastname', value: d.last },
      { name: 'email', value: d.email }, { name: 'phone', value: d.phone },
      { name: 'hs_language', value: lang }, { name: 'bda_proyecto', value: pj.id }, { name: 'bda_formulario_origen', value: d.origin }
    ];
    TAGS.slice(0, 5).forEach(function(k){ if(utm[k]) fields.push({ name: k, value: utm[k] }); });
    fields.push({ name: 'message', value: note });
    var context = { pageUri: location.href, pageName: document.title }, hutk = cookie('hubspotutk');
    if(hutk) context.hutk = hutk;

    var hubspot = within(fetch('https://api-eu1.hsforms.com/submissions/v3/integration/submit/' + PORTAL + '/' + HS_FORMS[d.project][lang], {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: fields, context: context,
        legalConsentOptions: { consent: { consentToProcess: true, text: 'Acepta la Política de privacidad de BDA International.' } } })
    }).then(function(r){ if(!r.ok) throw new Error('hubspot ' + r.status); }), 15000);

    /* the copy goes out once HubSpot has answered, so its subject can flag an enquiry that has to be loaded by hand */
    var copy = hubspot.then(function(){ return true; }, function(){ return false; }).then(function(inHubSpot){
      var subject = (inHubSpot ? '' : '⚠ HubSpot falló — ') + 'Consulta web — ' + pj.name + ' (' + lang.toUpperCase() + ')';
      return within(fetch('https://formsubmit.co/ajax/info@bda-realty.com', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ Proyecto: pj.name, Nombre: d.first, Apellido: d.last, Email: d.email, Telefono: d.phone, Idioma: lang.toUpperCase(),
          Formulario: d.origin, Campana: tags, Pagina: page, HubSpot: inHubSpot ? 'Registrado' : 'FALLÓ: cargar a mano',
          Consentimiento: 'Acepta la Política de privacidad (' + new Date().toISOString().slice(0, 10) + ')',
          _subject: subject, _replyto: d.email, _template: 'table', _captcha: 'false' })
      }).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if(!r.ok || j.success === false || j.success === 'false') throw new Error('mail'); }); }), 20000);
    });
    copy.catch(function(){});
    return hubspot.then(function(){ return true; }, function(){ return copy.then(function(){ return true; }, function(){ return false; }); });
  }

  window.BDAForms = { phone: phone, number: number, send: send, campaign: campaign };
})();
