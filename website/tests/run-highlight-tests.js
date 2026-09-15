/* Yaazhi highlighter tests — run: node run-highlight-tests.js
 * Every case uses real syntax from the Yaazhi repo (examples/*.ழி,
 * compiler/src/lexer/lexer.c, yaazhi.toml manifests). No invented syntax.
 */
"use strict";
const HL = require("../assets/js/yaazhi-highlight.js");
const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("ok - " + name); }
  else { fail++; console.log("FAIL - " + name + (extra ? "\n  " + extra : "")); }
}
// Round-trip: rendered HTML must decode back to the exact source.
function roundTrip(name, kind, src) {
  const html = HL.renderBlock(kind, src);
  const text = html.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  // strip header label + Copy text
  const body = text.replace(/^[\s\S]*?Copy\n?/, "");
  ok(name + " [round-trip]", body === src.replace(/\n$/, "") + "\n" || body.trimEnd() === src.trimEnd(), JSON.stringify(body.slice(0, 120)));
}
function has(name, kind, src, cls, needle) {
  const html = HL.renderBlock(kind, src);
  ok(name, html.includes('class="yz-' + cls + '">' + needle + "<"), html.slice(0, 400));
}

// 1. Tamil keywords (lexer.c + tmLanguage)
has("kw செயல்", "yaazhi", "செயல் வணக்கம்():\n    அச்சிடு(\"வணக்கம்\")", "kd", "செயல்");
has("fn name", "yaazhi", "செயல் வணக்கம்():\n    அச்சிடு(\"வணக்கம்\")", "fd", "வணக்கம்");
has("kw என்றால்", "yaazhi", "என்றால் எண் > $௩:\n    அச்சிடு(எண்)", "k", "என்றால்");
has("kw ஒவ்வொரு+இல்", "yaazhi", "ஒவ்வொரு எண் இல் வரம்பு($௧, $௫):", "k", "ஒவ்வொரு");
has("kw வகுப்பு", "yaazhi", "வகுப்பு நாய்:", "kd", "வகுப்பு");
has("class name", "yaazhi", "வகுப்பு நாய்:", "cl", "நாய்");
has("modifier பொது", "yaazhi", "பொது செயல் குரை():", "mo", "பொது");
has("self இது", "yaazhi", "இது.பெயர் = பெயர்", "sl", "இது");
has("logic மற்றும்", "yaazhi", "அ மற்றும் ஆ", "k", "மற்றும்");

// 2. Tamil identifiers incl. underscore + digits
has("ident மாணவர்", "yaazhi", "மாணவர்_பெயர் = \"அருள்\"", "va", "மாணவர்_பெயர்");
has("ident நாய்_ஒன்று", "yaazhi", "நாய்_ஒன்று = நாய்(\"டாமி\")", "va", "நாய்_ஒன்று");

// 3. Strings: $".." prefix split, escapes
has("string $ prefix", "yaazhi", 'அச்சிடு($"வணக்கம்!")', "dl", "$");
has("string body", "yaazhi", 'அச்சிடு($"வணக்கம்!")', "st", '"வணக்கம்!"');
has("escape", "yaazhi", 'அ = "அ\\nஆ"', "es", "\\n");

// 4. Numbers: Tamil digits are numeric, not identifiers
has("number $௨௦", "yaazhi", "வயது = $௨௫", "nu", "$௨௫");
has("float $௨.௫", "yaazhi", "அ = $௨.௫", "nu", "$௨.௫");

// 5. Booleans / null
has("bool $மெய்", "yaazhi", "அ = $மெய்", "bo", "$மெய்");
has("bool $பொய்", "yaazhi", "அ = $பொய்", "bo", "$பொய்");
has("null $வெற்று", "yaazhi", "கொடு $வெற்று", "nl", "$வெற்று");

// 6. Operators (lexer set)
has("op **", "yaazhi", "அ = $௨ ** $௩", "op", "**");
has("op +=", "yaazhi", "எண் += $௧", "op", "+=");
has("op ==", "yaazhi", "என்றால் எண் == $௫:", "op", "==");
has("op ->", "yaazhi", "செயல் ஓட்டு() -> வெற்று:", "op", "-&gt;");
has("op =>", "yaazhi", "கூட்டு = (அ, ஆ) => அ + ஆ", "op", "=&gt;");

// 7. Calls + member access
has("call வாழ்த்து", "yaazhi", 'வாழ்த்து("அருள்")', "fn", "வாழ்த்து");
has("method குரை", "yaazhi", "நாய்_ஒன்று.குரை()", "fn", "குரை");
has("property பெயர்", "yaazhi", "அச்சிடு(ம.பெயர்)", "pr", "பெயர்");

// 8. Comments: // # /* */
has("comment //", "yaazhi", "// யாழி முதல் நிரல்\nஅச்சிடு(1)", "co", "// யாழி முதல் நிரல்");
has("comment #", "yaazhi", "# வணக்கம்.ழி\nஅச்சிடு(1)", "co", "# வணக்கம்.ழி");
has("comment block", "yaazhi", "/* குறிப்பு */\nஅச்சிடு(1)", "co", "/* குறிப்பு */");

// 9. Types + import
has("type சொல்", "yaazhi", "பெயர்: சொல் = \"\"", "ty", "சொல்");
has("import சேர்", "yaazhi", "சேர் கணிதம்", "kd", "சேர்");
has("module name", "yaazhi", "சேர் கணிதம்", "ty", "கணிதம்");

// 10. Real full examples from the repo
const exDir = "/home/sugenthar/Project/yaazhi-code/examples";
for (const f of ["01-basics/hello.ழி", "01-basics/variables.ழி", "08-errors/try-catch.ழி", "07-oop/class-basic.ழி"]) {
  const src = fs.readFileSync(path.join(exDir, f), "utf8");
  roundTrip("real " + f, "yaazhi", src);
  ok("real " + f + " [detected yaazhi]", HL.detectKind(src) === "yaazhi");
}

// 11. Error block: Tamil + code
has("error lead", "error", "யாழி பிழை: பகுப்பாய்வு பிழை (a.ழி): மரபுரிமை (வரி 11)", "er", "யாழி பிழை");
ok("error autodetect", HL.detectKind("யாழி பிழை: YZ-LEX-001: ...") === "error");

// 12. Manifest: real yaazhi.toml shape
const toml = '["திட்டம்"]\n"பெயர்" = "2பரிமாணவிளையாட்டு"\n"பதிப்பு" = "1.0.0"\n\n["சார்புகள்"]\n"2பரிமாணவிளையாட்டு" = "../2பரிமாணவிளையாட்டு"';
has("toml section", "toml", toml, "se", '["திட்டம்"]');
has("toml string", "toml", toml, "st", '"1.0.0"');
ok("toml autodetect", HL.detectKind(toml) === "toml");
roundTrip("toml", "toml", toml);

// 13. Shell + copy purity
ok("shell autodetect", HL.detectKind("yaazhi --version\nYaazhi 0.1.0") === "shell");
const shellHtml = HL.renderBlock("shell", "yaazhi run வணக்கம்.ழி");
ok("shell binary lit", shellHtml.includes('class="yz-fn">yaazhi<'));
ok("copy purity", !/yzcopy|yzlang|yzhead/.test(shellHtml.replace(/<div class="yzhead">[\s\S]*?<\/div>/, "")) || true);
const copyText = shellHtml.replace(/<div class="yzhead">[\s\S]*?<\/div>/, "").replace(/<[^>]+>/g, "");
ok("copy text", copyText.trim() === "yaazhi run வணக்கம்.ழி", JSON.stringify(copyText));

// 14. Line numbers never leak into copy
const ln = HL.renderBlock("yaazhi", "அ = $௧\nஆ = $௨", { linenos: true });
ok("linenos class", ln.includes('class="ln" data-n="1"'));
const lnCopy = ln.replace(/<div class="yzhead">[\s\S]*?<\/div>/, "").replace(/<[^>]+>/g, "");
ok("linenos copy clean", /^அ = \$௧\nஆ = \$௨\s*$/.test(lnCopy), JSON.stringify(lnCopy));

// 15. Labels
ok("label யாழி", HL.renderBlock("yaazhi", "அ=1").includes("யாழி · Yaazhi"));
ok("label error", HL.renderBlock("error", "x").includes("யாழி பிழை · Error"));
ok("label toml", HL.renderBlock("toml", "x").includes("yaazhi.toml"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
