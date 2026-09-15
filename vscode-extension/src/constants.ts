/** Shared Yaazhi constants. No vscode imports — safe for unit tests. */

export const LANGUAGE_ID = "yaazhi";
export const SOURCE_EXTENSION = ".ழி";
export const LEGACY_EXTENSION = ".அ";

/** Project manifest names, in lookup order. */
export const MANIFEST_NAMES = ["yazhi.toml", "திட்டம்.json"] as const;

/** Default project entry files, in lookup order. */
export const DEFAULT_ENTRIES = ["முதன்மை.ழி", "நிரல்.ழி", "main.ழி"] as const;

/**
 * Native Yaazhi compiler executable. Relative to a Yaazhi home: the
 * installed layout has `bin/yaazhi`, the development checkout has
 * `compiler/build/yaazhi`. The compiler is the single authoritative,
 * native C11 implementation.
 */
export const COMPILER_NAMES = ["yaazhi", "யாழி"] as const;
export const COMPILER_DIRS = [["bin"], ["compiler", "build"]] as const;

/**
 * Candidate directories for a host binary relative to the Yaazhi home
 * directory. The runtime/debugger resolver cross-multiplies these with the
 * platform-appropriate executable names, so a `.exe` variant is ONLY ever
 * considered on Windows and a `.lnx` variant only on Linux/macOS (never the
 * reverse). See `src/toolchain/resolveToolchain.ts`.
 */
export const HOST_DIRS = [["runtime", "build"], ["build"]] as const;

/** Debug host uses the same candidate directories as the runtime host. */
export const DEBUG_HOST_DIRS = HOST_DIRS;

/** Environment variable overriding the debug host path. */
export const YAAZHI_DEBUG_HOST_ENV = "YAAZHI_DBG_VM";

export const TERMINAL_NAME = "Yaazhi";
export const OUTPUT_CHANNEL_NAME = "Yaazhi";
export const DIAGNOSTIC_SOURCE = "yaazhi";

export const COMPILER_NOT_FOUND =
  "Yaazhi compiler was not found. Set \"yaazhi.home\" to your Yaazhi directory (a directory containing the native compiler and standard library) or the YAAZHI_HOME environment variable.";
export const RUNTIME_NOT_FOUND =
  "Yaazhi runtime was not found. Expected yaazhi-run / runtime/build/yaazhi_run under your Yaazhi home (the platform-appropriate host for this operating system), or set \"yaazhi.runtime\" / the YAAZHI_VM environment variable.";
export const DEBUG_HOST_NOT_FOUND =
  "Yaazhi debugger executable was not found. Debugging requires the (removed) Python reference compiler's debug metadata and a yaazhi_dbg host; the native-only build does not provide a debugger yet.";

/**
 * Complete Yaazhi keyword set, authoritative from the native lexer.
 * செயல்பாடு is a legacy spelling rejected by the current lexer — it is
 * NOT a valid keyword. வரம்பு is a desugared builtin function name.
 */
export const KEYWORDS = [
  "என்றால்",
  "இல்லை",
  "இல்லையென்றால்",
  "வரை",
  "ஒவ்வொரு",
  "இல்",
  "நிறுத்து",
  "தொடர்",
  "செயல்",
  "கொடு",
  "சேர்",
  "என",
  "இறக்கு",
  "வெளியிடு",
  "தொகுதி",
  "முயற்சி",
  "பிழை",
  "இறுதியில்",
  "எறி",
  "வகுப்பு",
  "சேர்தல்",
  "இடைமுகம்",
  "செயல்படுத்து",
  "எண்ணகம்",
  "வகை",
  "இது",
  "மேல்",
  "பொருள்",
  "மரபு",
  "தன்னை",
  "பொது",
  "தனி",
  "பாதுகாப்பு",
  "மற்றும்",
  "அல்லது",
] as const;

/** Type names recognized by the Yaazhi type system (language/semantic/types.py). */
export const TYPES = [
  "எண்",
  "தசமம்",
  "சொல்",
  "எழுத்து",
  "மெய்மை",
  "பட்டியல்",
  "தொகுப்பு",
  "அகராதி",
  "வெற்று",
  "எதுவும்",
] as const;

/** Built-in / injected callable names (அச்சிடு/உள்ளீடு + helper வரம்பு). */
export const BUILTINS = ["அச்சிடு", "உள்ளீடு", "வரம்பு"] as const;

/** `$`-prefixed literal words (see language/lexer/tokens.py). */
export const LITERALS = ["$மெய்", "$பொய்", "$வெற்று"] as const;

/** Networking API hover docs — only for actually implemented members. */
export const NETWORK_HOVER_DOCS: Readonly<Record<string, string>> = {
  "வலை.சேவையகம்": "Creates an HTTP server.\n\n`வலை.சேவையகம்(\"127.0.0.1\", $௮௦௮௦)` → server object",
  "வலை.பெறு": "Client HTTP GET (low-level).\n\n`வலை.பெறு(\"http://...\")`",
  "வலை.அனுப்பு": "Client HTTP POST.\n\n`வலை.அனுப்பு(\"http://...\", \"body\")`",
  "வலை.மாற்று": "Client HTTP PUT.\n\n`வலை.மாற்று(\"http://...\", \"body\")`",
  "வலை.நீக்கு": "Client HTTP DELETE.\n\n`வலை.நீக்கு(\"http://...\")`",
  "வலை.பதில்": "Creates an HTTP response.\n\n`வலை.பதில்(body, $௨௦௦, {\"Content-Type\": \"...\"})` → response object",
  "பெறு": "Registers a GET route.\n\n`சேவையகம்.பெறு(\"/\", செயல்(கோரிக்கை): ...)`",
  "அனுப்பு": "Registers a POST route.\n\n`சேவையகம்.அனுப்பு(\"/தரவு\", செயல்(கோரிக்கை): ...)`",
  "மாற்று": "Registers a PUT route.\n\n`சேவையகம்.மாற்று(\"/பயனர்\", செயல்(கோரிக்கை): ...)`",
  "நீக்கு": "Registers a DELETE route or removes a list item (overloaded by arity).\n\n`சேவையகம்.நீக்கு(\"/பயனர்\", செயல்(கோரிக்கை): ...)`",
  "இயக்கு": "Starts the HTTP server (blocking).\n\n`சேவையகம்.இயக்கு()` — listens until Ctrl+C",
  "சேவையகம்": "HTTP server object returned by `வலை.சேவையகம்`. Methods: `.பெறு`, `.அனுப்பு`, `.மாற்று`, `.நீக்கு`, `.இயக்கு`, `.கோப்பு`, `.நிலையான`",
  "வலை": "Networking module (`சேர் வலை`). Provides `வலை.சேவையகம்` and client helpers.",
  "கோப்பு": "Serves a static file.\n\n`சேவையகம்.கோப்பு(\"/\", \"public/index.html\")`",
  "கோப்பை": "Alias for கோப்பு.\n\n`சேவையகம்.கோப்பை(\"/about\", \"public/about.html\")`",
  "நிலையான": "Serves a static directory.\n\n`சேவையகம்.நிலையான(\"/static\", \"public\")` → `/static/*` maps to `public/*`",
  "தரவு": "Data module (`சேர் தரவு`). Provides `தரவு.ஜெசன்` (JSON).",
  "தரவு.ஜெசன்": "Serializes Yaazhi value to JSON.\n\n`தரவு.ஜெசன்({\"செய்தி\": \"வணக்கம்\"})` → JSON string",
  "தரவு.சரமாக்கு": "Alias for ஜெசன்.\n\n`தரவு.சரமாக்கு(value)`",
  "தரவு.பகுப்பாய்வு": "Parses JSON string.\n\n`தரவு.பகுப்பாய்வு(\"{\\\"a\\\":1}\")`",
};

/** Concise hover documentation for keywords and built-ins. */
export const HOVER_DOCS: Readonly<Record<string, string>> = {
  "செயல்": "Declares a Yaazhi function.\n\n`செயல் பெயர்(அளவுருக்கள்):` … `கொடு மதிப்பு`\n\nAlso anonymous form in calls: `செயல்(கோரிக்கை): கொடு \"...\"`",
  "கொடு": "Returns a value from a Yaazhi function.",
  "என்றால்": "Yaazhi if-branch. `<நிபந்தனை> என்றால்:`",
  "இல்லையென்றால்": "Yaazhi else-if branch.",
  "இல்லை": "Yaazhi else branch (also unary NOT, disambiguated by position).",
  "வரை": "Yaazhi while loop. `<நிபந்தனை> வரை:`",
  "ஒவ்வொரு": "Yaazhi for loop. `ஒவ்வொரு உருப்படி இல் தொகுப்பு:`",
  "இல்": "Membership keyword used with ஒவ்வொரு loops.",
  "நிறுத்து": "Breaks out of the enclosing loop.",
  "தொடர்": "Continues with the next loop iteration.",
  "முயற்சி": "Starts a Yaazhi try block.",
  "பிழை": "Catches an error in a முயற்சி block.",
  "இறுதியில்": "Finally block of a முயற்சி statement.",
  "எறி": "Raises (throws) an error.",
  "சேர்": "Imports a module or file. `சேர் \"கோப்பு.ழி\"`",
  "என": "Import alias. `சேர் X என Y`",
  "மற்றும்": "Logical AND operator.",
  "அல்லது": "Logical OR operator.",
  "அச்சிடு": "Yaazhi built-in used to print a value to standard output.",
  "உள்ளீடு": "Yaazhi built-in used to read a line from standard input.",
  "வரம்பு": "Yaazhi range helper. `வரம்பு(தொடக்கம், முடிவு)` — end-exclusive.",
  "$மெய்": "Yaazhi boolean literal: true. Numbers and booleans use the `$` prefix.",
  "$பொய்": "Yaazhi boolean literal: false.",
  "$வெற்று": "Yaazhi nil (empty) literal.",
  "வகுப்பு": "Declares a Yaazhi class. `வகுப்பு பெயர் [சேர்தல் மேல்நிலை]:` with fields, `செயல் உருவாக்கு(...)` (constructor) and methods in its body.",
  "சேர்தல்": "Class inheritance keyword. `வகுப்பு B சேர்தல் A:`.",
  "இடைமுகம்": "Interface declaration keyword. `இடைமுகம் பெயர்:`.",
  "செயல்படுத்து": "Implements keyword. `வகுப்பு A செயல்படுத்து I, J:`.",
  "எண்ணகம்": "Enum declaration keyword. `எண்ணகம் பெயர்:`.",
  "வகை": "Type alias keyword. `வகை பெயர் = வகை:`.",
  "இது": "Inside a method/constructor, refers to the current object (receiver). `இது.புலம்` reads/writes a field; `இது.முறை()` calls a method.",
  "மேல்": "Calls the superclass implementation from a class method. `மேல்.முறை(...)` / `மேல்.உருவாக்கு(...)`.",
  "பொது": "Public visibility (default): accessible from anywhere.",
  "தனி": "Private visibility: accessible only from the declaring class.",
  "பாதுகாப்பு": "Protected visibility: accessible from the declaring class and its subclasses.",
  "மரபு": "Legacy alias for class inheritance (`வகுப்பு X < Y`).",
  "பொருள்": "Legacy object/instance keyword.",
  "தன்னை": "Legacy self/this keyword.",
  "எண்": "Integer type.",
  "தசமம்": "Float type.",
  "சொல்": "String type.",
  "எழுத்து": "Character type.",
  "மெய்மை": "Boolean type.",
  "பட்டியல்": "List type.",
  "தொகுப்பு": "Set type.",
  "அகராதி": "Dictionary type.",
  "வெற்று": "Nil (empty) literal.",
  "எதுவும்": "Any type.",
  // Networking
  "வலை": "Networking module (`சேர் வலை`). Provides `வலை.சேவையகம்` and client helpers.",
  "வலை.சேவையகம்": "Creates an HTTP server.\n\n`வலை.சேவையகம்(\"127.0.0.1\", $௮௦௮௦)` → server object",
  "வலை.பெறு": "Client HTTP GET (low-level).\n\n`வலை.பெறு(\"http://...\")`",
  "வலை.அனுப்பு": "Client HTTP POST.\n\n`வலை.அனுப்பு(\"http://...\", \"body\")`",
  "வலை.மாற்று": "Client HTTP PUT.\n\n`வலை.மாற்று(\"http://...\", \"body\")`",
  "வலை.நீக்கு": "Client HTTP DELETE.\n\n`வலை.நீக்கு(\"http://...\")`",
  "சேவையகம்": "HTTP server object returned by `வலை.சேவையகம்`. Methods: `.பெறு`, `.அனுப்பு`, `.மாற்று`, `.நீக்கு`, `.இயக்கு`",
  "பெறு": "Registers a GET route.\n\n`சேவையகம்.பெறு(\"/\", செயல்(கோரிக்கை): ...)`",
  "அனுப்பு": "Registers a POST route.\n\n`சேவையகம்.அனுப்பு(\"/தரவு\", செயல்(கோரிக்கை): ...)`",
  "மாற்று": "Registers a PUT route.\n\n`சேவையகம்.மாற்று(\"/பயனர்\", செயல்(கோரிக்கை): ...)`",
  "நீக்கு": "Registers a DELETE route or removes a list item (overloaded by arity).\n\n`சேவையகம்.நீக்கு(\"/பயனர்\", செயல்(கோரிக்கை): ...)`",
  "இயக்கு": "Starts the HTTP server (blocking).\n\n`சேவையகம்.இயக்கு()` — listens until Ctrl+C",
  "கோரிக்கை": "HTTP request object passed to route callbacks. Fields: `.முறை` (method), `.பாதை` (path), `.உடல்` (body), `method`/`path`/`body` (English aliases), `.தலைப்புகள்`, `.வினவல்`",
  "முறை": "Request field: HTTP method (GET/POST/PUT/DELETE).",
  "பாதை": "Request field: URL path.",
  "உடல்": "Request field: body string.",
  "தலைப்புகள்": "Request field: headers dictionary (if provided).",
  "வினவல்": "Request field: query string / query dictionary.",
};
