# யாழி எடுத்துக்காட்டுகள் — Yaazhi Examples

Yaazhi (யாழி) — தமிழ் முதன்மை நிரலாக்க மொழி. இந்த `examples/` கோப்பகம் தற்போது செயல்படும் மொழி அம்சங்களை மட்டுமே கொண்டுள்ளது. ஒவ்வொரு `.ழி` கோப்பும் தொகுக்கப்பட்டு இயக்கக்கூடியது.

## Requirements

- The **native** C11 compiler + runtime are the only toolchain: build with
  `cmake --build compiler/build` and `cmake --build runtime/build`. There is
  no Python anywhere — the `.ழி` compiler and the C VM host are the whole
  toolchain.
- C11 VM host: `runtime/build/yaazhi_run.lnx` (auto-located by `run`).

## Running

```bash
# ஒரு கோப்பை இயக்க (native compiler + C VM)
compiler/build/yaazhi run examples/01-basics/வணக்கம்.ழி
# அல்லது
compiler/build/yaazhi run examples/01-basics/வணக்கம்.ழி

# check (தொகுக்க மட்டும், இயக்க வேண்டாம்)
compiler/build/yaazhi check examples/01-basics/வணக்கம்.ழி

# build (bytecode எழுத)
compiler/build/yaazhi build examples/01-basics/வணக்கம்.ழி -o /tmp/வணக்கம்.nbc
runtime/build/yaazhi_run.lnx /tmp/வணக்கம்.nbc   # இந்த NBC ஐ ஹோஸ்டில் இயக்க
```

> Headless/broken-expectation probes: some older examples rely on the retired
> Python reference behavior or a GUI-less sidecar (see `$வெற்றுமதிப்பு` /
> 99-errors probes that intentionally fail to compile). Each numbered folder
> that targets a real running feature has a `.ழி` probe runnable as above.
- கட்டமைக்க: `cmake --build compiler/build` (தொகுப்பி) மற்றும்
  `cmake --build runtime/build` (C VM ஹோஸ்ட்).

## இயக்குதல்

```bash
# ஒரு கோப்பை இயக்க (native compiler + C VM, ஒரே CLI)
compiler/build/yaazhi run examples/01-basics/வணக்கம்.ழி
# அல்லது
compiler/build/yaazhi run examples/01-basics/வணக்கம்.ழி

# check (தொகுக்க மட்டும், இயக்க வேண்டாம்)
compiler/build/yaazhi check examples/01-basics/வணக்கம்.ழி

# build (bytecode எழுத) + C VM ஹோஸ்டில் இயக்க
compiler/build/yaazhi build examples/01-basics/வணக்கம்.ழி -o /tmp/வணக்கம்.nbc
runtime/build/yaazhi_run.lnx /tmp/வணக்கம்.nbc

# உதவி / பதிப்பு / REPL
compiler/build/yaazhi --help
compiler/build/yaazhi --version
compiler/build/yaazhi repl
```

**தடுக்கும் சேவையகத்தை நிறுத்த:** `Ctrl+C` . சேவையகம் `select` மூலம் பல இணைப்புகளை கையாளும், `TIME_WAIT` இல் `SO_REUSEADDR` மூலம் உடனடி மறுதொடக்கம் செய்யலாம்.

- Windows: `yaazhi_run.exe`
- Linux: `yaazhi_run.lnx`
- macOS: `yaazhi_run` (via `platform/macos`)

## கோப்பக அமைப்பு

```
examples/
├── 01-basics/          # அச்சிடு, மாறிகள், சொற்கள், எண்கள், தமிழ் யூனிகோட்
├── 02-operators/       # + - * / % **, ஒப்பீடு, மற்றும்/அல்லது, +=
├── 03-control-flow/    # என்றால்/இல்லை, வரை, ஒவ்வொரு, வரம்பு, நிறுத்து/தொடர்
├── 04-functions/       # செயல், அளவுரு, கொடு, முன்னிருப்பு, மறுநிகழ்வு, லாம்ப்டா
├── 05-collections/     # பட்டியல் [], அகராதி {}, குறியீடு, மீள்செயல்
├── 06-types/           # வகை குறிப்பு, எதுவும், வெற்று
├── 07-oop/             # வகுப்பு, உருவாக்கு, இது/மேல், சேர்தல், இடைமுகம், எண்ணகம்
├── 08-errors/          # முயற்சி/பிழை/இறுதியில்/எறி
├── 09-modules/         # சேர் கணிதம்/தரவு/கோப்பு
├── 10-standard-library/# கணிதம், தொகுப்பு, நேரம், சீரற்ற, சூழல், கோப்பு
├── 11-json/            # தரவு.ஜெசன் / பகுப்பாய்வு, தமிழ் JSON
├── 12-file-system/     # கோப்பு.எழுது_மூலம்/படி_மூலம்/உள்ளதா
├── 13-networking/      # HTTP சேவையகம்: பெறு/அனுப்பு/மாற்று/நீக்கு, JSON, நிலையான, CORS, மிடில்வேர்
├── 14-http-client/     # வலை.பெறு/அனுப்பு/மாற்று/நீக்கு, தலைப்பு, தமிழ் URL, chunked, redirect
├── 15-websocket/       # இணையச்சாளரம், செய்தி/அனுப்பு/மூடு/பிங், தமிழ், அறை/:பெயர்
├── 16-real-world/      # கணிப்பான், மாணவர், todo, json-api, mini-web-app
├── 99-errors/          # எதிர்பார்க்கப்படும் தொகுப்பு பிழைகள் (தனித்து சோதிக்க)
└── README.md
```

பழைய `examples/*.ழி` கோப்புகள் (வணக்கம்.ழி, மாறிகள்.ழி etc.) பின்னோக்கி பொருந்தக்கூடியதாக வைக்கப்பட்டுள்ளன, ஆனால் புதிய கற்றல் பாதை `01-..16-` ஆகும்.

## கற்றல் பாதை

1. **01-basics** → 2. **02-operators** → 3. **03-control-flow** → 4. **04-functions** → 5. **05-collections** → 6. **06-types** → 7. **07-oop** → 8. **08-errors** → 9. **09-modules** → 10. **10-standard-library** → 11. **11-json** → 12. **12-file-system** → 13. **13-networking** → 14. **14-http-client** → 15. **15-websocket** → 16. **16-real-world**

## நெட்வொர்க்கிங்

**HTTP சேவையகம்** (`13-networking`): ஒவ்வொரு சேவையகமும் வெவ்வேறு துறையைப் பயன்படுத்துகிறது (`18080..18091`). 
```bash
compiler/build/yaazhi run examples/13-networking/01-basic-server/Server.ழி
curl http://127.0.0.1:18080/
```

**HTTP கிளையன்ட்** (`14-http-client`): ஒரு சேவையகம் தேவை (`Client.ழி` default `127.0.0.1:18090`). முழு சோதனைக்கு `13-networking` இன் ஒரு `.ழி` சேவையகத்தை இயக்கி, கிளையன்ட்டில் URL திருத்தவும்.

**WebSocket** (`15-websocket`): 
```bash
compiler/build/yaazhi run examples/15-websocket/01-basic/WebSocket.ழி
# தனி முனையத்தில் WebSocket கிளையன்ட் மூலம் சோதிக்க
```

## தமிழ் முதன்மை
எடுத்துக்காட்டுகள் `பெயர், வயது, மாணவர், சேவையகம், கோரிக்கை, பதில், தரவு` போன்ற தமிழ் அடையாளங்களை விரும்புகின்றன. HTTP தலைப்புகள் (`Content-Type`) ஆங்கிலத்தில் இருக்கும், ஏனெனில் நெறிமுறை அவ்வாறு தேவைப்படுகிறது.

## சரிபார்ப்பு
```bash
compiler/build/yaazhi check examples/13-networking/01-basic-server/Server.ழி
compiler/build/yaazhi --version
cd vscode-extension && npm test     # native extension suite
compiler/build/yaazhi run examples/01-basics/வணக்கம்.ழி   # அனைத்து .ழி தொகுப்பு + இயக்க சோதனை
```
`test_examples.py` சேவையகங்களை தனியாக `timeout` உடன் சோதிக்கிறது, `99-errors` ஐ தவிர்க்கிறது, `Ctrl+C` க்கு பிறகு `SO_REUSEADDR` மூலம் துறை மறுபயன்பாட்டை சரிபார்க்கிறது.

## Windows / Linux
- பாதைகள் `127.0.0.1` மற்றும் `public/` போன்ற ஒப்பீட்டு பாதைகளைப் பயன்படுத்துகின்றன; `C:/...` அல்லது `/home/...` இல்லை.
- `yaazhi_run` ஹோஸ்ட் பெர்னரி தானாக native compiler `run` மூலம் தேர்ந்தெடுக்கப்படும் (சேரும் `runtime/build/`).

## துறைகள்
- `13-networking/01` 18080, `02` 18081, `03` 18082, `04` 18083, `05` 18084, `06` 18085, `07` 18086, `08` 18087, `09` 18088, `10` 18089, `11` 18090, `12` 18091
- `15-websocket` 18082..18086
- `14-http-client` சோதனை சேவையகம் 18091, `16-real-world/mini-web-app` 18080

