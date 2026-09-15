# native/vendor — மூன்றாம் தரப்பு ஆதாரங்கள் ( provenance )

இயங்குநிலைப் பின்தளத்தை (y2d_backend) இங்கேயே கட்டவும் சோதிக்கவும்
தேவையான, கணினியில் நிறுவ முடியாத (root இல்லை) நூலகங்கள்.
அனைத்தும் அதிகாரப்பூர்வ Fedora 44 RPM-களிலிருந்து (`dnf download`,
root தேவையில்லை) பிரித்தெடுக்கப்பட்டவை — மூலக் குறியீடு மாற்றமில்லை.

| கோப்பு/அடைவு | மூலம் | பதிப்பு | உரிமம் |
|---|---|---|---|
| `include/SDL3/`, `lib/libSDL3.so*` | SDL3, SDL3-devel (fedora/updates) | 3.4.16 | Zlib |
| `include/SDL3_ttf/`, `lib/libSDL3_ttf.so*` | SDL3_ttf, SDL3_ttf-devel (fedora) | 3.2.2 | Zlib |
| `lib/libplutosvg.so*` | plutosvg (fedora) | 0.0.8 | MIT |
| `lib/libplutovg.so*` | plutovg (fedora) | 1.3.3 | MIT |
| `stb_image.h` | https://github.com/nothings/stb (master) | v2.30 | Public domain / MIT |
| `stb_image_write.h` | https://github.com/nothings/stb (master) | v2.30 | Public domain / MIT |

இயக்கநேரச் சார்புகள் (கணினியில் ஏற்கனவே உள்ளவை — தொகுப்பில் இல்லை):
HarfBuzz, FreeType, libpng16 (SDL3_ttf வழி — தமிழ் வடிவமைப்புக்கு),
X11/Wayland (SDL3 வழி), PulseAudio/ALSA (SDL3 ஒலி வழி).

மீளுருவாக்கம்: `dnf download SDL3 SDL3-devel SDL3_ttf SDL3_ttf-devel
plutosvg plutovg` (x86_64) → `rpm2cpio | cpio -idm` → `usr/include`
+ தேவையான `usr/lib64/lib*.so*` இங்கே நகலெடுக்கவும்.

இயங்குதளக் குறிப்பு: இவை Linux x86_64-க்கானவை. Windows/macOS-க்கு
அந்தந்த SDL3 வெளியீடுகள் தேவை (DESIGNED — NOT VERIFIED).
