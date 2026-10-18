(function(){
  var d=document, b=d.body, S=window.SITE||{};
  var $=function(s,r){return (r||d).querySelector(s);};
  var $$=function(s,r){return Array.prototype.slice.call((r||d).querySelectorAll(s));};
  var mq=window.matchMedia('(max-width:1023px)');
  var RTL=(d.documentElement.getAttribute('dir')||'rtl')==='rtl', LANG=d.documentElement.lang||'ar';

  /* ---------- Drawer (mobile/tablet) ---------- */
  var menuBtn=$('#menu-btn'), nav=$('#site-nav'), backdrop=$('#nav-backdrop'), lastFocus=null;
  function focusables(root){return $$('a[href],button:not([disabled]),input:not([disabled]),select',root).filter(function(el){return el.offsetParent!==null;});}
  function openNav(){lastFocus=d.activeElement;nav.classList.add('is-open');backdrop.classList.add('is-open');b.classList.add('nav-open');menuBtn.setAttribute('aria-expanded','true');nav.setAttribute('role','dialog');nav.setAttribute('aria-modal','true');var f=focusables(nav);if(f.length)f[0].focus();}
  function closeNav(){if(!nav||!nav.classList.contains('is-open'))return;nav.classList.remove('is-open');backdrop.classList.remove('is-open');b.classList.remove('nav-open');menuBtn.setAttribute('aria-expanded','false');nav.removeAttribute('role');nav.removeAttribute('aria-modal');if(lastFocus&&lastFocus.focus)lastFocus.focus();}
  if(menuBtn&&nav){
    menuBtn.addEventListener('click',function(){nav.classList.contains('is-open')?closeNav():openNav();});
    var nc=$('#nav-close');if(nc)nc.addEventListener('click',closeNav);
    if(backdrop)backdrop.addEventListener('click',closeNav);
  }

  /* ---------- Search panel ---------- */
  var sBtn=$('#search-btn'), panel=$('#search-panel');
  function toggleSearch(force){if(!panel)return;var o=typeof force==='boolean'?force:!panel.classList.contains('is-open');panel.classList.toggle('is-open',o);sBtn.setAttribute('aria-expanded',o?'true':'false');if(o){var i=$('input',panel);if(i)i.focus();}else sBtn.focus();}
  if(sBtn)sBtn.addEventListener('click',function(){toggleSearch();});

  d.addEventListener('keydown',function(e){
    if(e.key==='Escape'){
      if(nav&&nav.classList.contains('is-open'))return closeNav();
      if(panel&&panel.classList.contains('is-open'))return toggleSearch(false);
    }
    if(e.key==='Tab'&&nav&&nav.classList.contains('is-open')){
      var f=focusables(nav);if(!f.length)return;var first=f[0],last=f[f.length-1];
      if(e.shiftKey&&d.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&d.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  var onMq=function(){if(!mq.matches)closeNav();};
  if(mq.addEventListener)mq.addEventListener('change',onMq);else if(mq.addListener)mq.addListener(onMq);

  /* Current page in menu */
  $$('.main-nav a').forEach(function(a){try{var h=a.getAttribute('href');if(h&&h.charAt(0)!=='#'&&new URL(a.href,location.href).pathname===location.pathname)a.setAttribute('aria-current','page');}catch(err){}});

  /* ---------- Tabs (homepage: latest by section) ---------- */
  $$('[data-tabs]').forEach(function(root){
    var tabs=$$('[role="tab"]',root), panels=$$('[role="tabpanel"]',root);
    // hide tabs whose panel has no items
    tabs.forEach(function(t,i){if(panels[i]&&!panels[i].querySelector('li')){t.hidden=true;}});
    var vis=tabs.filter(function(t){return !t.hidden;});
    if(!vis.length){root.hidden=true;return;}
    function select(t,focus){
      tabs.forEach(function(x,i){var on=x===t;x.setAttribute('aria-selected',on?'true':'false');x.tabIndex=on?0:-1;if(panels[i])panels[i].hidden=!on;});
      if(focus)t.focus();
    }
    tabs.forEach(function(t){
      t.addEventListener('click',function(){select(t);});
      t.addEventListener('keydown',function(e){
        var i=vis.indexOf(t);if(i<0)return;
        // Forward key follows reading direction: ArrowLeft in Arabic, ArrowRight in English
        var fwd=RTL?'ArrowLeft':'ArrowRight', back=RTL?'ArrowRight':'ArrowLeft';
        if(e.key===fwd){e.preventDefault();select(vis[(i+1)%vis.length],true);}
        else if(e.key===back){e.preventDefault();select(vis[(i-1+vis.length)%vis.length],true);}
        else if(e.key==='Home'){e.preventDefault();select(vis[0],true);}
        else if(e.key==='End'){e.preventDefault();select(vis[vis.length-1],true);}
      });
    });
    select(vis[0]);
  });

  /* ---------- Carousels ---------- */
  $$('[data-carousel]').forEach(function(w){
    $$('.car-btn',w).forEach(function(btn){btn.addEventListener('click',function(){
      var list=$('.tab-panel:not([hidden]) .card-list',w)||$('.card-list',w);if(!list)return;
      var dir=(btn.getAttribute('data-dir')==='next'?-1:1)*(RTL?1:-1);
      list.scrollBy({left:dir*list.clientWidth*0.9,behavior:'smooth'});
    });});
  });

  /* ---------- WhatsApp + call: message carries the page H1 ---------- */
  var phone=S.phone||'';
  var h1=$('h1');
  var title=(h1&&h1.textContent.replace(/\s+/g,' ').trim())||d.title;
  var canon=$('link[rel="canonical"]');
  var pageUrl=(canon&&canon.href)||location.href.split('#')[0].split('?')[0];
  var msg=(S.waIntro||'مرحبًا، أريد الاستفسار عن:')+' '+title+'\n'+pageUrl;
  $$('a[data-wa]').forEach(function(a){a.href='https://wa.me/'+phone+'?text='+encodeURIComponent(msg);a.target='_blank';a.rel='noopener';});
  $$('a[data-wa],a[data-call]').forEach(function(a){a.addEventListener('click',function(){
    var method=a.hasAttribute('data-wa')?'whatsapp':'phone';
    try{if(window.gtag)window.gtag('event','contact_click',{method:method,placement:a.getAttribute('data-place')||'',page_title:title});
      (window.dataLayer=window.dataLayer||[]).push({event:'contact_click',method:method,placement:a.getAttribute('data-place')||'',page_title:title});}catch(err){}
  });});

  /* ---------- Calculators ---------- */
  var nf=function(n,dg){try{return Number(n).toLocaleString(LANG==='en'?'en-US':'ar-EG',{maximumFractionDigits:dg==null?0:dg});}catch(e){return String(Math.round(n));}};
  var num=function(f){if(!f)return 0;var v=String(f.value).replace(/[٠-٩]/g,function(c){return '٠١٢٣٤٥٦٧٨٩'.indexOf(c);}).replace(/[^\d.]/g,'');return parseFloat(v)||0;};
  function out(root,key,val){var e=$('[data-out="'+key+'"]',root);if(e)e.textContent=val;}
  var CALC={
    installment:function(r){
      var price=num(r.elements.price),dp=num(r.elements.dp),years=num(r.elements.years),per=num(r.elements.per)||12;
      var down=price*dp/100,rest=price-down,n=Math.max(1,Math.round(years*per));
      out(r,'down',price?nf(down):'');out(r,'rest',price?nf(rest):'');out(r,'inst',price&&years?nf(rest/n):'');out(r,'count',price&&years?nf(n):'');
    },
    mortgage:function(r){
      var loan=num(r.elements.loan),rate=num(r.elements.rate)/100/12,years=num(r.elements.years),n=Math.round(years*12),m=0;
      if(loan&&n){m=rate?loan*rate/(1-Math.pow(1+rate,-n)):loan/n;}
      out(r,'monthly',m?nf(m):'');out(r,'total',m?nf(m*n):'');out(r,'interest',m?nf(m*n-loan):'');
    },
    yield:function(r){
      var price=num(r.elements.price),rent=num(r.elements.rent)*12,cost=num(r.elements.cost);
      out(r,'gross',price?nf(rent/price*100,2)+(LANG==='en'?'%':'٪'):'');out(r,'net',price?nf((rent-cost)/price*100,2)+(LANG==='en'?'%':'٪'):'');out(r,'payback',rent-cost>0&&price?nf(price/(rent-cost),1):'');
    }
  };
  $$('form[data-calc]').forEach(function(f){
    var fn=CALC[f.getAttribute('data-calc')];if(!fn)return;
    f.addEventListener('input',function(){fn(f);});
    f.addEventListener('submit',function(e){e.preventDefault();fn(f);});
    fn(f);
  });

  /* ---------- Contact form: composes a WhatsApp message; nothing is sent to a server ---------- */
  $$('form[data-wa-form]').forEach(function(f){
    f.addEventListener('submit',function(e){
      e.preventDefault();
      var g=function(n){var el=f.elements[n];return el?String(el.value||'').trim():'';};
      var L=f.dataset;
      if(!g('message')){var m=f.elements.message;if(m){m.focus();}var er=$('.form-error',f);if(er)er.hidden=false;return;}
      var lines=[S.waIntro||''];
      if(g('name'))lines.push(L.lName+': '+g('name'));
      if(g('country'))lines.push(L.lCountry+': '+g('country'));
      if(g('topic'))lines.push(L.lTopic+': '+g('topic'));
      lines.push(L.lMessage+': '+g('message'));
      lines.push(location.href.split('#')[0].split('?')[0]);
      var url='https://wa.me/'+(S.phone||'')+'?text='+encodeURIComponent(lines.join('\n'));
      try{(window.dataLayer=window.dataLayer||[]).push({event:'contact_click',method:'whatsapp',placement:'contact-form'});}catch(err){}
      window.open(url,'_blank','noopener');
    });
  });
})();
