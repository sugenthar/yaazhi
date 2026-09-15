/* Yaazhi / யாழி syntax highlighter — reusable component.
 *
 * Sources of truth (do not invent syntax):
 *   compiler/src/lexer/lexer.c ......... keywords, $, Tamil digits, // # comments
 *   syntaxes/yaazhi.tmLanguage.json ..... TextMate scopes (mapped to yz-* classes)
 *   examples/*.ழி ....................... verified real programs
 *
 * Usage (static site, no framework):
 *   <pre><code>செயல் வணக்கம்(): ...</code></pre>
 *   YaazhiHL.highlightAll() auto-detects kind per block and wraps it in
 *   <figure class="yzblock"> with a யாழி label + Copy button.
 *   Overrides: <pre data-yz="yaazhi|shell|output|error|toml|plain"
 *                    data-file="வணக்கம்.ழி" data-linenos>
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.YaazhiHL = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TA = "\\u0B80-\\u0BFF";
  var W = "[\\p{L}\\p{M}\\p{N}_" + TA + "]";
  var NB = "(?<![\\p{L}\\p{M}\\p{N}_$" + TA + "])";
  var NA = "(?![\\p{L}\\p{M}\\p{N}_" + TA + "])";

  // Longest-first keyword groups (mirrors lexer.c + tmLanguage keywords).
  var DECL = ["உருவாக்குபவர்", "செயல்படுத்து", "இடைமுகம்", "எண்ணகம்", "வகுப்பு", "சேர்தல்", "உருவாக்கு", "செயல்", "வகை", "சேர்", "என"];
  var CTRL = ["இல்லையென்றால்", "இறுதியில்", "ஒவ்வொரு", "நிறுத்து", "முயற்சி", "என்றால்", "இல்லை", "தொடர்", "கொடு", "வரை", "பிழை", "இல்", "ஆக", "எறி"];
  var CTRL = ["இறுதியில்", "ஒவ்வொரு", "நிறுத்து", "முயற்சி", "என்றால்", "தொடர்", "கொடு", "வரை", "பிழை", "எறி"];
  var BUILTIN = ["அச்சிடு", "உள்ளீடு", "வரம்பு", "பிழையிடு"];
  var MOD = ["பாதுகாப்பு", "நிலையான", "பொது", "தனி"];
  var SELF = ["இது", "மேல்"];
  var LOGIC = ["மற்றும்", "அல்லது"];
  var OTHER = ["இறக்கு", "வெளியிடு", "தொகுதி", "பொருள்", "மரபு", "தன்னை"];
  var TYPES = ["தசமம்", "பட்டியல்", "தொகுப்பு", "அகராதி", "மெய்மை", "எழுத்து", "எதுவும்", "வெற்று", "சொல்", "எண்"];

  function alt(list) {
    return list.slice().sort(function (a, b) { return b.length - a.length; }).join("|");
  }

  var MASTER = new RegExp(
    "(?<block>/\\*[\\s\\S]*?(?:\\*/|$))" +
    "|(?<linec>//[^\\n]*)" +
    "|(?<hash>^[ \\t]*#[^\\n]*)" +
    "|(?<str>\\$?\"(?:\\\\.|[^\"\\\\\\n])*\"?)" +
    "|(?<chr>\\$'(?:[^'\\\\\\n]|\\\\.)'?) " .replace(/ $/, "") +
    "|(?<num>\\$[௦-௯]+(?:\\.[௦-௯]+)?)" +
    "|(?<bool>\\$(?:மெய்|பொய்|வெற்று))" +
    "|(?<err>யாழி பிழை|YZ-[A-Z]+-[0-9]+)" +
    "|(?<decl>" + NB + "(?:" + alt(DECL) + ")" + NA + ")" +
    "|(?<ctrl>" + NB + "(?:" + alt(CTRL) + ")" + NA + ")" +
    "|(?<bi>" + NB + "(?:" + alt(BUILTIN) + ")" + NA + ")" +
    "|(?<mo>" + NB + "(?:" + alt(MOD) + ")" + NA + ")" +
    "|(?<self>" + NB + "(?:" + alt(SELF) + ")" + NA + ")" +
    "|(?<logic>" + NB + "(?:" + alt(LOGIC) + ")" + NA + ")" +
    "|(?<other>" + NB + "(?:" + alt(OTHER) + ")" + NA + ")" +
    "|(?<type>" + NB + "(?:" + alt(TYPES) + ")" + NA + ")" +
    "|(?<id>" + W + "+)" +
    "|(?<op>->|=>|\\*\\*|==|!=|<=|>=|\\+=|-=|\\*=|/=|[<>=+\\-*/%!?])" +
    "|(?<pu>[:,;()\\[\\]{}.…])" +
    "|(?<ws>\\s+)" +
    "|(?<any>.)",
    "gmus"
  );

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Split a string token into $ prefix / body / escapes for inner coloring.
  function renderString(tok) {
    var out = "", m, re = /(\\.)/g, last = 0, i = 0;
    var body = tok, prefix = "";
    if (body.charAt(0) === "$") { prefix = "$"; body = body.slice(1); }
    out += '<span class="yz-dl">' + esc(prefix) + "</span>";
    while ((m = re.exec(body))) {
      out += '<span class="yz-st">' + esc(body.slice(last, m.index)) + "</span>";
      out += '<span class="yz-es">' + esc(m[1]) + "</span>";
      last = m.index + m[1].length;
      i++;
    }
    out += '<span class="yz-st">' + esc(body.slice(last)) + "</span>";
    return out;
  }

  function isDeclName(prev) {
    return prev === "செயல்" || prev === "உருவாக்கு" || prev === "உருவாக்குபவர்";
  }

  // Tokenize one line; `st` carries {block:boolean} across lines.
  function tokenizeLine(line, st, out) {
    var pos = 0;
    if (st.block) {
      var end = line.indexOf("*/");
      if (end === -1) { out.push({ c: "co", t: line }); return; }
      out.push({ c: "co", t: line.slice(0, end + 2) });
      pos = end + 2;
    }
    MASTER.lastIndex = pos;
    var m, prevSig = st.prevSig || null, prevIsDot = false;
    // prevSig context expires at line start except declaration chains; keep simple: reset per line
    prevSig = null;
    while ((m = MASTER.exec(line))) {
      if (m.index !== pos) { out.push({ c: null, t: line.slice(pos, m.index) }); }
      pos = m.index + m[0].length;
      var g = m.groups || {}, cls = null, tok = m[0];
      if (g.block !== undefined) {
        if (!/\*\//.test(tok)) st.block = true;
        cls = "co";
      }
      else if (g.linec !== undefined || g.hash !== undefined) cls = "co";
      else if (g.str !== undefined) { out.push({ c: "str", t: tok }); prevSig = "str"; prevIsDot = false; continue; }
      else if (g.chr !== undefined) cls = "st";
      else if (g.num !== undefined) cls = "nu";
      else if (g.bool !== undefined) cls = tok === "$வெற்று" ? "nl" : "bo";
      else if (g.err !== undefined) cls = "er";
      else if (g.decl !== undefined) cls = "kd";
      else if (g.ctrl !== undefined) cls = "k";
      else if (g.bi !== undefined) cls = "bi";
      else if (g.mo !== undefined) cls = "mo";
      else if (g.self !== undefined) cls = "sl";
      else if (g.logic !== undefined) cls = "k";
      else if (g.other !== undefined) cls = "k";
      else if (g.type !== undefined) cls = "ty";
      else if (g.id !== undefined) {
        var rest = line.slice(pos);
        var calls = /^\s*\(/.test(rest);
        if (prevIsDot) { cls = calls ? "fn" : "pr"; }
        else if (prevSig === "வகுப்பு" || prevSig === "இடைமுகம்" || prevSig === "எண்ணகம்" || prevSig === "வகை" || prevSig === "சேர்தல்" || prevSig === "செயல்படுத்து") cls = "cl";
        else if (prevSig === "சேர்" || prevSig === "என") cls = "ty";
        else if (isDeclName(prevSig)) cls = "fd";
        else if (calls) cls = "fn";
        else cls = "va";
        if (!prevIsDot) prevSig = tok; else prevSig = "member";
        prevIsDot = false;
        out.push({ c: cls, t: tok }); continue;
      }
      else if (g.op !== undefined) cls = "op";
      else if (g.pu !== undefined) {
        cls = "pu";
        if (tok === ".") { prevIsDot = true; out.push({ c: cls, t: tok }); continue; }
      }
      else if (g.ws !== undefined) { out.push({ c: null, t: tok }); continue; }
      else { out.push({ c: null, t: tok }); continue; }
      if (cls === "kd" || cls === "k" || cls === "bi" || cls === "mo" || cls === "ty") {
        if (!prevIsDot) prevSig = tok;
      } else if (cls !== "pu") { prevSig = cls === "co" ? prevSig : null; }
      if (cls !== "pu" || tok !== ".") prevIsDot = false;
      out.push({ c: cls, t: tok });
    }
    if (pos < line.length) out.push({ c: null, t: line.slice(pos) });
    st.prevSig = null;
  }

  function renderTokens(tokens) {
    var html = "";
    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      if (!tk.c) html += esc(tk.t);
      else if (tk.c === "str") html += renderString(tk.t);
      else if (tk.c === "sl") html += '<span class="yz-sl">' + esc(tk.t) + "</span>";
      else html += '<span class="yz-' + tk.c + '">' + esc(tk.t) + "</span>";
    }
    return html;
  }

  function highlightYaazhi(src) {
    var lines = src.split("\n"), st = { block: false }, html = [];
    for (var i = 0; i < lines.length; i++) {
      var toks = [];
      tokenizeLine(lines[i], st, toks);
      html.push(renderTokens(toks));
    }
    return html.join("\n");
  }

  // ---- yaazhi.toml (TOML with Tamil quoted keys) ----
  var TOML = new RegExp(
    "(?<co>^[ \\t]*#[^\\n]*)" +
    "|(?<se>^\\s*\\[[^\\]\\n]+\\])" +
    "|(?<st>\"(?:\\\\.|[^\"\\\\\\n])*\")" +
    "|(?<nu>(?<![\\w\"freq$ देता-])[-+]?[0-9][0-9._]*(?![\\w.]))" +
    "|(?<bo>(?<![\\w\"$])(?:true|false)(?![\\w]))" +
    "|(?<op>=)" +
    "|(?<pu>[,\\[\\]{}.])" +
    "|(?<ws>\\s+)" +
    "|(?<any>.)",
    "gm"
  );
  function highlightToml(src) {
    return esc(src).replace(TOML, function (m, co, se, st, nu, bo, op, pu, ws) {
      if (co !== undefined) return '<span class="yz-co">' + co + "</span>";
      if (se !== undefined) return '<span class="yz-se">' + se + "</span>";
      if (st !== undefined) return '<span class="yz-st">' + st + "</span>";
      if (nu !== undefined) return '<span class="yz-nu">' + nu + "</span>";
      if (bo !== undefined) return '<span class="yz-bo">' + bo + "</span>";
      if (op !== undefined) return '<span class="yz-op">' + op + "</span>";
      if (pu !== undefined) return '<span class="yz-pu">' + pu + "</span>";
      return m;
    });
  }

  // ---- shell ----
  function highlightShell(src) {
    var lines = src.split("\n");
    return lines.map(function (ln) {
      var out = "", m;
      var re = /("[^"\n]*"|'[^'\n]*'|#[^\n]*|\byaazhi\b)/g, last = 0;
      while ((m = re.exec(ln))) {
        out += esc(ln.slice(last, m.index));
        var t = m[0];
        if (t.charAt(0) === "#") out += '<span class="yz-co">' + esc(t) + "</span>";
        else if (t === "yaazhi") out += '<span class="yz-fn">' + esc(t) + "</span>";
        else out += '<span class="yz-st">' + esc(t) + "</span>";
        last = m.index + t.length;
      }
      return out + esc(ln.slice(last));
    }).join("\n");
  }

  // ---- compiler error / terminal output ----
  function highlightError(src) {
    return esc(src).replace(/(யாழி பிழை|YZ-[A-Z]+-[0-9]+|\(வரி [0-9]+\))/g, '<span class="yz-er">$1</span>');
  }

  var LABELS = {
    yaazhi: "யாழி · Yaazhi", shell: "Shell", output: "Output",
    error: "யாழி பிழை · Error", toml: "yaazhi.toml", plain: "Text"
  };

  function detectKind(text) {
    var t = text.replace(/^\s+/, "");
    if (/யாழி பிழை|YZ-[A-Z]+-[0-9]+/.test(text)) return "error";
    if (/\["திட்டம்"\]|\["சார்புகள்"\]|\["தொகுதி"\]|\["பின்தளம்"\]/.test(text)) return "toml";
    var first = (t.split("\n").filter(function (l) { return l.trim(); })[0] || "");
    if (/^(yaazhi|tar |export |sha256sum|code |cmake|cd |git |bash |mkdir |sudo |npm |pkill|chmod|cp |curl |pip )/.test(first)) return "shell";
    if (/(செயல்|என்றால்|ஒவ்வொரு|வகுப்பு|அச்சிடு|முயற்சி|வரை |கொடு|சேர் |நிறுத்து|இடைமுகம்|எண்ணகம்|\$[௦-௯"$'])/.test(text)) return "yaazhi";
    return "plain";
  }

  function renderBody(kind, src) {
    if (kind === "yaazhi") return highlightYaazhi(src);
    if (kind === "toml") return highlightToml(src);
    if (kind === "shell") return highlightShell(src);
    if (kind === "error" || kind === "output") return highlightError(src);
    return esc(src);
  }

  function renderBlock(kind, src, opts) {
    opts = opts || {};
    var body = renderBody(kind, src.replace(/\n$/, ""));
    if (opts.linenos) {
      var parts = body.split("\n");
      body = parts.map(function (l, i) {
        return '<span class="ln" data-n="' + (i + 1) + '">' + (l || " ") + "</span>";
      }).join("\n");
    }
    var file = opts.file ? '<span class="yzfile">' + esc(opts.file) + "</span>" : "";
    return '<figure class="yzblock' + (opts.linenos ? " linenos" : "") + (opts.theme === "light" ? " light" : "") +
      '" data-kind="' + kind + '"><div class="yzhead"><span class="yzlang">' +
      esc(LABELS[kind] || kind) + "</span>" + file +
      '<button type="button" class="yzcopy">Copy</button></div>' +
      "<pre><code>" + body + "</code></pre></figure>";
  }

  function enhance(pre) {
    if (pre.closest(".yzblock") || pre.closest(".flow")) return;
    var stale = pre.querySelector(".copybtn");
    if (stale) stale.remove();
    var code = pre.querySelector("code");
    var src = (code ? code.textContent : pre.textContent).replace(/\n$/, "");
    var kind = pre.getAttribute("data-yz") || (code && code.getAttribute("data-yz")) || detectKind(src);
    var tmp = document.createElement("div");
    tmp.innerHTML = renderBlock(kind, src, {
      file: pre.getAttribute("data-file") || (code && code.getAttribute("data-file")),
      linenos: pre.hasAttribute("data-linenos"),
      theme: pre.getAttribute("data-theme")
    });
    var fig = tmp.firstChild;
    pre.replaceWith(fig);
    var btn = fig.querySelector(".yzcopy");
    btn.addEventListener("click", function () {
      var done = function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy"; }, 1400); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(src + "\n").then(done, done);
      else done();
    });
  }

  function highlightAll(scope) {
    (scope || document).querySelectorAll("pre").forEach(enhance);
  }

  return {
    tokenizeLine: tokenizeLine, highlightYaazhi: highlightYaazhi,
    highlightToml: highlightToml, highlightShell: highlightShell,
    highlightError: highlightError, detectKind: detectKind,
    renderBlock: renderBlock, highlightAll: highlightAll
  };
});
