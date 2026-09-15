// Base URL for the Yaazhi highlighter, captured at top-level execution.
// (document.currentScript is null inside DOMContentLoaded; resolving there
// produced /docs/yaazhi-highlight.js -> 404 on docs pages.)
var YZ_HIGHLIGHTER_URL=(function(){
  try{
    var cs=document.currentScript;
    if(cs&&cs.src)return cs.src.replace(/\/[^\/]*$/,'/')+'yaazhi-highlight.js';
  }catch(e){}
  try{
    var ss=document.getElementsByTagName('script');
    for(var i=ss.length-1;i>=0;i--){
      var s=ss[i].src||'';
      if(/main\.js/.test(s))return s.replace(/\/[^\/]*$/,'/')+'yaazhi-highlight.js';
    }
  }catch(e2){}
  return 'assets/js/yaazhi-highlight.js';
})();
document.addEventListener('DOMContentLoaded',function(){
  // Load the Yaazhi highlighter first; it enhances <pre> into .yzblock.
  try{
    var s=document.createElement('script');s.src=YZ_HIGHLIGHTER_URL;
    s.onload=function(){if(window.YaazhiHL)YaazhiHL.highlightAll();};
    s.onerror=function(){if(window.console)console.error('Yaazhi: failed to load '+s.src);};
    document.head.appendChild(s);
  }catch(e){}
  document.querySelectorAll('pre').forEach(function(pre){
    if(pre.querySelector('.copybtn'))return;
    if(pre.closest('.flow'))return;
    var b=document.createElement('button');
    b.className='copybtn';b.type='button';b.textContent='Copy';
    b.setAttribute('aria-label','Copy code');
    b.addEventListener('click',function(){
      var t=(pre.querySelector('code')||pre).innerText;
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(t).then(function(){b.textContent='Copied';setTimeout(function(){b.textContent='Copy';},1400);});
      }
    });
    pre.appendChild(b);
  });
  var box=document.getElementById('docsearch');
  if(box){
    box.addEventListener('input',function(){
      var q=box.value.trim().toLowerCase();
      document.querySelectorAll('[data-search]').forEach(function(el){
        var hay=(el.getAttribute('data-search')+' '+el.textContent).toLowerCase();
        el.style.display=(!q||hay.indexOf(q)>-1)?'':'none';
      });
    });
  }
  var y=document.getElementById('year');if(y)y.textContent=new Date().getFullYear();
});
