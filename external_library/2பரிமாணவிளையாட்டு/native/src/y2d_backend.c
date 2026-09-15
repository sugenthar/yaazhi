/* ===========================================================================
 * native/src/y2d_backend.c — 2பரிமாணவிளையாட்டு native backend (SDL3).
 *
 * A standalone TCP-loopback game backend process. Yaazhi games talk to it
 * ONLY through the existing `வலை.சாக்கெட்` / `சாக்கெட்.*` natives using a
 * line-based UTF-8 protocol (see PROTOCOL below). No compiler or runtime
 * changes are required: the backend is an ordinary OS process.
 *
 *   y2d_backend --serve [port]   run the backend (default port 47832)
 *   y2d_backend --probe          print VIDEO_OK/AUDIO_OK/FONT_OK, exit 0/1
 *   y2d_backend --selftest       headless render/audio self-checks
 *
 * Build: cmake -S native -B native/build && cmake --build native/build
 * Requires the vendored headers/libs in native/vendor (SDL3 + SDL3_ttf).
 * =========================================================================== */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>
#include <ctype.h>
#include <math.h>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
typedef int socklen_t;
#else
#include <unistd.h>
#include <errno.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/select.h>
#include <sys/stat.h>
#include <sys/time.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <arpa/inet.h>
#endif

#include <SDL3/SDL.h>
#include <SDL3_ttf/SDL_ttf.h>
#include "stb_image.h"
/* stb_vorbis.c compiles as its own translation unit (see CMakeLists). */
extern int stb_vorbis_decode_filename(const char* filename, int* channels, int* sample_rate, short** output);

#define Y2D_DEFAULT_PORT 47832
#define Y2D_MAX_LINE 65536
#define Y2D_MAX_TEX 256
#define Y2D_MAX_WAV 64
#define Y2D_MAX_SFX 16
#define Y2D_MAX_EVENTS 256
#define Y2D_MAX_EVJSON 128

/* ---- Tamil-capable font candidates (system paths, first hit wins) ------- */
static const char* y2d_font_candidates[] = {
    "/usr/share/fonts/google-noto-vf/NotoSansTamil[wght].ttf",
    "/usr/share/fonts/google-droid-sans-fonts/DroidSansTamil-Regular.ttf",
    "/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/liberation-sans-fonts/LiberationSans-Regular.ttf",
    NULL
};

/* ---- Global backend state ------------------------------------------------ */
typedef struct {
    int id;
    int in_use;
    SDL_Texture* tex;
    int w, h;
} Y2DTex;

typedef struct {
    int id;
    int in_use;
    Uint8* data;
    Uint32 len;
    SDL_AudioSpec spec;
} Y2DWav;

typedef struct {
    SDL_AudioStream* stream;
    Uint8* data;
    Uint32 len;
    int loop;
    int active;
} Y2DSfx;

static SDL_Window* g_win = NULL;
static SDL_Renderer* g_ren = NULL;
static int g_win_w = 0, g_win_h = 0;
static Uint8 g_clear_r = 0, g_clear_g = 0, g_clear_b = 0;
static Y2DTex g_tex[Y2D_MAX_TEX];
static Y2DWav g_wav[Y2D_MAX_WAV];
static Y2DSfx g_sfx[Y2D_MAX_SFX];
static TTF_Font* g_font = NULL;
static char g_font_path[1024] = "";
static int g_font_size = 0;
static int g_audio_ok = 0;
static float g_volume = 1.0f;
static int g_muted = 0;
/* music slot */
static Uint8* g_mus_data = NULL;
static Uint32 g_mus_len = 0;
static Uint32 g_mus_pos = 0;
static SDL_AudioStream* g_mus_stream = NULL;
static SDL_AudioSpec g_mus_spec;
static int g_mus_loop = 0;
static int g_mus_playing = 0;
/* event queue (encoded JSON fragments) */
static char* g_events[Y2D_MAX_EVENTS];
static int g_ev_count = 0;

/* ---- Multi-client server state -------------------------------------------- */
#define Y2D_MAX_CLIENTS 8

typedef struct {
    int fd;
    char line[Y2D_MAX_LINE + 1];
    size_t len;
    int active;
} Y2DClient;

static Y2DClient g_clients[Y2D_MAX_CLIENTS]; /* fd==-1 = free */
static int g_srv_fd = -1; /* listen socket (closed early on SHUTDOWN) */
static int g_verbose = 0;

/* ---- Session resource root (ROOT protocol) ------------------------------- */
/* The Yaazhi driver sends `ROOT <absolute-project-root>` after HELLO so
 * relative resource paths resolve against the project root no matter
 * where the backend process was started. Empty = legacy CWD behavior. */
static char g_root[4096] = "";
/* Set when SDL reports window close: pending quit events are delivered
 * once, then every client socket is closed so games always terminate. */
static int g_quit_seen = 0;

/* Lexical normalize: collapse `//`, `/./`, `/../`. Byte-oriented, so
 * Tamil/UTF-8 names pass through untouched. Returns 0 on success. */
static int y2d_normpath(const char* in, char* out, size_t outcap) {
    int absolute = in[0] == '/';
    char tmp[4096];
    size_t il = strlen(in);
    if (il >= sizeof(tmp)) return -1;
    memcpy(tmp, in, il + 1);
    const char* stack[512];
    size_t slen[512];
    int depth = 0;
    size_t i = 0;
    while (i <= il) {
        size_t j = i;
        while (j < il && tmp[j] != '/') j++;
        size_t seg = j - i;
        if (seg == 0 || (seg == 1 && tmp[i] == '.')) {
            /* skip */
        } else if (seg == 2 && tmp[i] == '.' && tmp[i + 1] == '.') {
            if (depth > 0) depth--;
            else if (!absolute) {
                if (depth >= 512) return -1;
                stack[depth] = tmp + i;
                slen[depth] = 2;
                depth++;
            }
        } else {
            if (depth >= 512) return -1;
            stack[depth] = tmp + i;
            slen[depth] = seg;
            depth++;
        }
        i = j + 1;
    }
    size_t o = 0;
    if (absolute) {
        if (o + 1 >= outcap) return -1;
        out[o++] = '/';
    }
    for (int k = 0; k < depth; k++) {
        if (k > 0) {
            if (o + 1 >= outcap) return -1;
            out[o++] = '/';
        }
        if (o + slen[k] >= outcap) return -1;
        memcpy(out + o, stack[k], slen[k]);
        o += slen[k];
    }
    if (o == 0) {
        if (o + 1 >= outcap) return -1;
        out[o++] = '.';
    }
    out[o] = '\0';
    return 0;
}

/* Resolve a client-supplied path. Absolute paths keep their existing
 * semantics (used as-is). Relative paths join the session root; any
 * path escaping the root is rejected (-1). Without a root, legacy CWD
 * behavior is preserved. */
static int y2d_resolve(const char* path, char* out, size_t outcap) {
    if (!path || !*path) return -1;
    if (path[0] == '/') {
        if (strlen(path) + 1 > outcap) return -1;
        strcpy(out, path);
        return 0;
    }
    if (!g_root[0]) {
        if (strlen(path) + 1 > outcap) return -1;
        strcpy(out, path);
        return 0;
    }
    char joined[8192];
    snprintf(joined, sizeof(joined), "%s/%s", g_root, path);
    char norm[8192];
    if (y2d_normpath(joined, norm, sizeof(norm)) != 0) return -1;
    size_t rl = strlen(g_root);
    if (strncmp(norm, g_root, rl) != 0 ||
        (norm[rl] != '\0' && norm[rl] != '/'))
        return -1; /* escape attempt */
    if (strlen(norm) + 1 > outcap) return -1;
    strcpy(out, norm);
    return 0;
}

static int y2d_is_dir(const char* path) {
#ifdef _WIN32
    DWORD a = GetFileAttributesA(path);
    return a != INVALID_FILE_ATTRIBUTES && (a & FILE_ATTRIBUTE_DIRECTORY);
#else
    struct stat st;
    return stat(path, &st) == 0 && S_ISDIR(st.st_mode);
#endif
}

static void y2d_close_other_clients(int keep_fd) {
    for (int i = 0; i < Y2D_MAX_CLIENTS; i++) {
        if (g_clients[i].active && g_clients[i].fd != keep_fd) {
            close(g_clients[i].fd);
            g_clients[i].fd = -1;
            g_clients[i].len = 0;
            g_clients[i].active = 0;
        }
    }
}

/* ---- Small utilities ------------------------------------------------------ */

static void y2d_push_event(const char* json) {
    if (g_ev_count >= Y2D_MAX_EVENTS) return;
    size_t n = strlen(json) + 1;
    char* c = (char*)malloc(n);
    if (!c) return;
    memcpy(c, json, n);
    g_events[g_ev_count++] = c;
}

static void y2d_clear_events(void) {
    for (int i = 0; i < g_ev_count; i++) free(g_events[i]);
    g_ev_count = 0;
}

/* JSON-escape a UTF-8 string into out (outcap incl. NUL). Returns 0 on trunc. */
static int y2d_json_escape(const char* s, char* out, size_t outcap) {
    size_t o = 0;
    for (const unsigned char* p = (const unsigned char*)s; *p; p++) {
        const char* esc = NULL;
        char tmp[8];
        if (*p == '"') esc = "\\\"";
        else if (*p == '\\') esc = "\\\\";
        else if (*p == '\n') esc = "\\n";
        else if (*p == '\r') esc = "\\r";
        else if (*p == '\t') esc = "\\t";
        else if (*p < 0x20) { snprintf(tmp, sizeof(tmp), "\\u%04x", *p); esc = tmp; }
        if (esc) {
            size_t el = strlen(esc);
            if (o + el + 1 > outcap) return 0;
            memcpy(out + o, esc, el);
            o += el;
        } else {
            if (o + 2 > outcap) return 0;
            out[o++] = (char)*p;
        }
    }
    if (o + 1 > outcap) return 0;
    out[o] = '\0';
    return 1;
}

static void y2d_lower_ascii(char* s) {
    for (; *s; s++) {
        if (*s >= 'A' && *s <= 'Z') *s = (char)(*s - 'A' + 'a');
    }
}

/* Send exactly len bytes (loop). Returns 0 on success. */
static int y2d_send_all(int fd, const char* buf, size_t len) {
    size_t sent = 0;
    while (sent < len) {
#ifdef _WIN32
        int n = send(fd, buf + sent, (int)(len - sent), 0);
#else
        ssize_t n = send(fd, buf + sent, len - sent, 0);
#endif
        if (n <= 0) return -1;
        sent += (size_t)n;
    }
    return 0;
}

static int y2d_send_line(int fd, const char* line) {
    char tmp[Y2D_MAX_LINE + 2];
    size_t n = strlen(line);
    if (n + 2 > sizeof(tmp)) return -1;
    memcpy(tmp, line, n);
    tmp[n] = '\n';
    tmp[n + 1] = '\0';
    return y2d_send_all(fd, tmp, n + 1);
}

/* ---- SDL event -> JSON ----------------------------------------------------- */

static void y2d_poll_sdl_events(void) {
    SDL_Event e;
    int drained = 0;
    while (drained < Y2D_MAX_EVJSON && SDL_PollEvent(&e)) {
        drained++;
        char buf[1024];
        if (e.type == SDL_EVENT_QUIT) {
            y2d_push_event("{\"t\":\"quit\"}");
            g_quit_seen = 1;
        } else if (e.type == SDL_EVENT_KEY_DOWN || e.type == SDL_EVENT_KEY_UP) {
            const char* nm = SDL_GetKeyName(e.key.key);
            char low[64];
            snprintf(low, sizeof(low), "%s", nm ? nm : "?");
            y2d_lower_ascii(low);
            char esc[128];
            y2d_json_escape(low, esc, sizeof(esc));
            snprintf(buf, sizeof(buf),
                     "{\"t\":\"key\",\"k\":\"%s\",\"down\":%d,\"rep\":%d}",
                     esc, e.type == SDL_EVENT_KEY_DOWN ? 1 : 0,
                     e.key.repeat ? 1 : 0);
            y2d_push_event(buf);
        } else if (e.type == SDL_EVENT_TEXT_INPUT) {
            char esc[512];
            y2d_json_escape(e.text.text ? e.text.text : "", esc, sizeof(esc));
            snprintf(buf, sizeof(buf), "{\"t\":\"text\",\"s\":\"%s\"}", esc);
            y2d_push_event(buf);
        } else if (e.type == SDL_EVENT_MOUSE_MOTION) {
            snprintf(buf, sizeof(buf), "{\"t\":\"mouse\",\"x\":%d,\"y\":%d,\"b\":0,\"w\":0}",
                     (int)e.motion.x, (int)e.motion.y);
            y2d_push_event(buf);
        } else if (e.type == SDL_EVENT_MOUSE_BUTTON_DOWN || e.type == SDL_EVENT_MOUSE_BUTTON_UP) {
            int b = 0;
            if (e.button.button == SDL_BUTTON_LEFT) b = 1;
            else if (e.button.button == SDL_BUTTON_MIDDLE) b = 2;
            else if (e.button.button == SDL_BUTTON_RIGHT) b = 3;
            snprintf(buf, sizeof(buf), "{\"t\":\"mouse\",\"x\":%d,\"y\":%d,\"b\":%d,\"w\":0}",
                     (int)e.button.x, (int)e.button.y, b * (e.type == SDL_EVENT_MOUSE_BUTTON_DOWN ? 1 : -1));
            y2d_push_event(buf);
        } else if (e.type == SDL_EVENT_MOUSE_WHEEL) {
            float mx = 0, my = 0;
            SDL_GetMouseState(&mx, &my);
            snprintf(buf, sizeof(buf), "{\"t\":\"mouse\",\"x\":%d,\"y\":%d,\"b\":0,\"w\":%d}",
                     (int)mx, (int)my, (int)e.wheel.y);
            y2d_push_event(buf);
        } else if (e.type == SDL_EVENT_WINDOW_RESIZED) {
            g_win_w = e.window.data1;
            g_win_h = e.window.data2;
            snprintf(buf, sizeof(buf), "{\"t\":\"resize\",\"w\":%d,\"h\":%d}", g_win_w, g_win_h);
            y2d_push_event(buf);
        } else if (e.type == SDL_EVENT_WINDOW_FOCUS_GAINED) {
            y2d_push_event("{\"t\":\"focus\",\"in\":1}");
        } else if (e.type == SDL_EVENT_WINDOW_FOCUS_LOST) {
            y2d_push_event("{\"t\":\"focus\",\"in\":0}");
        } else if (e.type == SDL_EVENT_GAMEPAD_ADDED) {
            snprintf(buf, sizeof(buf), "{\"t\":\"pad\",\"e\":\"add\",\"id\":%d}", (int)e.gdevice.which);
            y2d_push_event(buf);
        } else if (e.type == SDL_EVENT_GAMEPAD_REMOVED) {
            snprintf(buf, sizeof(buf), "{\"t\":\"pad\",\"e\":\"rem\",\"id\":%d}", (int)e.gdevice.which);
            y2d_push_event(buf);
        } else if (e.type == SDL_EVENT_GAMEPAD_BUTTON_DOWN || e.type == SDL_EVENT_GAMEPAD_BUTTON_UP) {
            snprintf(buf, sizeof(buf), "{\"t\":\"pad\",\"e\":\"button\",\"id\":%d,\"b\":%d,\"down\":%d}",
                     (int)e.gbutton.which, (int)e.gbutton.button,
                     e.type == SDL_EVENT_GAMEPAD_BUTTON_DOWN ? 1 : 0);
            y2d_push_event(buf);
        } else if (e.type == SDL_EVENT_GAMEPAD_AXIS_MOTION) {
            snprintf(buf, sizeof(buf), "{\"t\":\"pad\",\"e\":\"axis\",\"id\":%d,\"a\":%d,\"v\":%d}",
                     (int)e.gaxis.which, (int)e.gaxis.axis, (int)e.gaxis.value);
            y2d_push_event(buf);
        }
    }
}

/* Emit queued events as one EVENTS [...] line. */
static void y2d_send_events(int fd) {
    char out[Y2D_MAX_LINE];
    size_t o = 0;
    o += (size_t)snprintf(out + o, sizeof(out) - o, "EVENTS [");
    for (int i = 0; i < g_ev_count; i++) {
        if (i > 0 && o + 1 < sizeof(out)) out[o++] = ',';
        size_t el = strlen(g_events[i]);
        if (o + el + 2 > sizeof(out)) break;
        memcpy(out + o, g_events[i], el);
        o += el;
    }
    if (o + 2 > sizeof(out)) { y2d_send_line(fd, "EVENTS []"); }
    else { out[o++] = ']'; out[o] = '\0'; y2d_send_line(fd, out); }
    y2d_clear_events();
}

/* ---- Drawing helpers -------------------------------------------------------- */

static void y2d_draw_circle_outline(int cx, int cy, int rad, Uint8 r, Uint8 g, Uint8 b) {
    SDL_SetRenderDrawColor(g_ren, r, g, b, 255);
    int x = rad, y = 0, err = 0;
    while (x >= y) {
        SDL_RenderPoint(g_ren, (float)(cx + x), (float)(cy + y));
        SDL_RenderPoint(g_ren, (float)(cx + y), (float)(cy + x));
        SDL_RenderPoint(g_ren, (float)(cx - y), (float)(cy + x));
        SDL_RenderPoint(g_ren, (float)(cx - x), (float)(cy + y));
        SDL_RenderPoint(g_ren, (float)(cx - x), (float)(cy - y));
        SDL_RenderPoint(g_ren, (float)(cx - y), (float)(cy - x));
        SDL_RenderPoint(g_ren, (float)(cx + y), (float)(cy - x));
        SDL_RenderPoint(g_ren, (float)(cx + x), (float)(cy - y));
        y++;
        if (err <= 0) err += 2 * y + 1;
        else { x--; err -= 2 * x + 1; }
    }
}

static void y2d_draw_circle_fill(int cx, int cy, int rad, Uint8 r, Uint8 g, Uint8 b) {
    /* triangle fan around the center (exact for convex disc) */
    const int N = 64;
    SDL_Vertex verts[66];
    verts[0].position.x = (float)cx;
    verts[0].position.y = (float)cy;
    verts[0].color.r = r / 255.0f; verts[0].color.g = g / 255.0f;
    verts[0].color.b = b / 255.0f; verts[0].color.a = 1.0f;
    verts[0].tex_coord.x = 0; verts[0].tex_coord.y = 0;
    for (int i = 0; i <= N; i++) {
        double a = 2.0 * 3.14159265358979 * i / N;
        verts[1 + i] = verts[0];
        verts[1 + i].position.x = (float)(cx + rad * cos(a));
        verts[1 + i].position.y = (float)(cy + rad * sin(a));
    }
    int idx[64 * 3];
    for (int i = 0; i < N; i++) { idx[3 * i] = 0; idx[3 * i + 1] = 1 + i; idx[3 * i + 2] = 2 + i; }
    SDL_RenderGeometry(g_ren, NULL, verts, 66, idx, N * 3);
}

/* Count pixels in rect differing from the clear color. */
static int y2d_count_pixels(int x, int y, int w, int h) {
    if (!g_ren || w <= 0 || h <= 0) return 0;
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x + w > g_win_w) w = g_win_w - x;
    if (y + h > g_win_h) h = g_win_h - y;
    if (w <= 0 || h <= 0) return 0;
    SDL_Rect rc = { x, y, w, h };
    SDL_Surface* s = SDL_RenderReadPixels(g_ren, &rc);
    if (!s) return -1;
    int count = 0;
    if (SDL_MUSTLOCK(s)) SDL_LockSurface(s);
    for (int j = 0; j < s->h; j++) {
        Uint8* row = (Uint8*)s->pixels + (size_t)j * (size_t)s->pitch;
        for (int i = 0; i < s->w; i++) {
            Uint8 r, g, b, a;
            SDL_ReadSurfacePixel(s, i, j, &r, &g, &b, &a);
            (void)row;
            if (r != g_clear_r || g != g_clear_g || b != g_clear_b) count++;
        }
    }
    if (SDL_MUSTLOCK(s)) SDL_UnlockSurface(s);
    SDL_DestroySurface(s);
    return count;
}

static unsigned long long y2d_framebuffer_sum(void) {
    if (!g_ren) return 0;
    SDL_Surface* s = SDL_RenderReadPixels(g_ren, NULL);
    if (!s) return 0;
    unsigned long long h = 1469598103934665603ULL;
    if (SDL_MUSTLOCK(s)) SDL_LockSurface(s);
    for (int j = 0; j < s->h; j++) {
        Uint8* row = (Uint8*)s->pixels + (size_t)j * (size_t)s->pitch;
        for (int i = 0; i < s->w * 4 && i < s->pitch; i++) {
            h ^= row[i];
            h *= 1099511628211ULL;
        }
    }
    if (SDL_MUSTLOCK(s)) SDL_UnlockSurface(s);
    int w = s->w, hh = s->h;
    SDL_DestroySurface(s);
    return h ^ ((unsigned long long)w << 32 | (unsigned long long)hh);
}

/* ---- Audio helpers ----------------------------------------------------------- */

static void y2d_audio_reap(void) {
    for (int i = 0; i < Y2D_MAX_SFX; i++) {
        if (g_sfx[i].active && g_sfx[i].stream) {
            if (SDL_GetAudioStreamQueued(g_sfx[i].stream) == 0) {
                if (g_sfx[i].loop && g_sfx[i].data && g_sfx[i].len > 0) {
                    SDL_PutAudioStreamData(g_sfx[i].stream, g_sfx[i].data, (int)g_sfx[i].len);
                } else {
                    SDL_DestroyAudioStream(g_sfx[i].stream);
                    g_sfx[i].stream = NULL;
                    g_sfx[i].active = 0;
                }
            }
        }
    }
}

static float y2d_eff_gain(void) {
    return g_muted ? 0.0f : g_volume;
}

/* Feed/loop the music slot. Called once per server iteration. */
static void y2d_music_pump(void) {
    if (!g_mus_playing || !g_mus_stream || !g_mus_data) return;
    int queued = SDL_GetAudioStreamQueued(g_mus_stream);
    if (queued < 0) return;
    if ((Uint32)queued < g_mus_len && g_mus_len > 0) {
        Uint32 chunk = g_mus_len - g_mus_pos;
        if (chunk > 65536) chunk = 65536;
        if (chunk == 0) {
            if (g_mus_loop) g_mus_pos = 0;
            else { g_mus_playing = 0; return; }
            chunk = g_mus_len - g_mus_pos;
            if (chunk > 65536) chunk = 65536;
        }
        SDL_PutAudioStreamData(g_mus_stream, g_mus_data + g_mus_pos, (int)chunk);
        g_mus_pos += chunk;
    }
}

/* Decode WAV (SDL) or OGG (stb_vorbis) into PCM. Caller frees *out. */
static int y2d_decode_audio(const char* path, Uint8** out, Uint32* out_len, SDL_AudioSpec* spec) {
    size_t n = strlen(path);
    if (n > 4 && (strcmp(path + n - 4, ".ogg") == 0 || strcmp(path + n - 4, ".OGG") == 0)) {
        int ch = 0, sr = 0;
        short* pcm = NULL;
        int frames = stb_vorbis_decode_filename(path, &ch, &sr, &pcm);
        if (frames <= 0 || !pcm) return -1;
        spec->format = SDL_AUDIO_S16;
        spec->channels = ch > 2 ? 2 : ch;
        if (spec->channels < 1) spec->channels = 1;
        spec->freq = sr;
        *out_len = (Uint32)frames * (Uint32)spec->channels * 2u;
        *out = (Uint8*)SDL_malloc(*out_len);
        if (!*out) { free(pcm); return -1; }
        if (ch == (int)spec->channels) {
            memcpy(*out, pcm, *out_len);
        } else {
            /* downmix to mono */
            short* d = (short*)*out;
            for (int i = 0; i < frames; i++) {
                int acc = 0;
                for (int c = 0; c < ch; c++) acc += pcm[i * ch + c];
                d[i] = (short)(acc / ch);
            }
        }
        free(pcm);
        return 0;
    }
    if (!SDL_LoadWAV(path, spec, out, out_len)) return -1;
    return 0;
}

/* ---- Command handling --------------------------------------------------------- */
/* Returns: 0 keep serving, 1 close client, 2 shutdown server. */

static int y2d_handle(int fd, char* line) {
    if (g_verbose) fprintf(stderr, "y2d> %s\n", line);
    char* sp = strchr(line, ' ');
    char cmd[32];
    char* args = "";
    if (sp) {
        size_t cl = (size_t)(sp - line);
        if (cl >= sizeof(cmd)) cl = sizeof(cmd) - 1;
        memcpy(cmd, line, cl);
        cmd[cl] = '\0';
        args = sp + 1;
    } else {
        snprintf(cmd, sizeof(cmd), "%s", line);
    }

    if (strcmp(cmd, "HELLO") == 0) {
        y2d_send_line(fd, "OK y2d 1");
    } else if (strcmp(cmd, "ROOT") == 0) {
        /* Session resource root: `ROOT <absolute-project-root>`.
         * Relative resource paths resolve as ROOT + path; escapes
         * (`../outside`) are rejected. */
        const char* rp = args;
        while (*rp == ' ') rp++;
        if (!*rp) {
            y2d_send_line(fd, "ERR bad ROOT");
        } else if (rp[0] != '/') {
            y2d_send_line(fd, "ERR ROOT must be absolute");
        } else {
            char norm[4096];
            if (y2d_normpath(rp, norm, sizeof(norm)) != 0) {
                y2d_send_line(fd, "ERR bad ROOT");
            } else {
                size_t nl = strlen(norm);
                while (nl > 1 && norm[nl - 1] == '/') norm[--nl] = '\0';
                if (!y2d_is_dir(norm)) {
                    y2d_send_line(fd, "ERR ROOT not a directory");
                } else {
                    snprintf(g_root, sizeof(g_root), "%s", norm);
                    y2d_send_line(fd, "OK");
                }
            }
        }
    } else if (strcmp(cmd, "QUIT") == 0) {
        y2d_send_line(fd, "BYE");
        return 1;
    } else if (strcmp(cmd, "SHUTDOWN") == 0) {
        /* refuse new clients immediately so shutdown is observable */
        if (g_srv_fd >= 0) { close(g_srv_fd); g_srv_fd = -1; }
        y2d_send_line(fd, "BYE");
        return 2;
    } else if (strcmp(cmd, "WIN") == 0) {
        int w = 0, h = 0, used = 0;
        if (sscanf(args, "%d %d %n", &w, &h, &used) < 2 || w <= 0 || h <= 0 || w > 8192 || h > 8192) {
            y2d_send_line(fd, "ERR bad WIN args");
        } else {
            const char* title = args + used;
            while (*title == ' ') title++;
            if (!g_win) {
                g_win = SDL_CreateWindow(*title ? title : "y2d", w, h, SDL_WINDOW_RESIZABLE);
                if (!g_win) { char e[256]; snprintf(e, sizeof(e), "ERR %s", SDL_GetError()); y2d_send_line(fd, e); }
                else {
                    g_ren = SDL_CreateRenderer(g_win, NULL);
                    if (!g_ren) { char e[256]; snprintf(e, sizeof(e), "ERR %s", SDL_GetError()); y2d_send_line(fd, e); }
                    else { g_win_w = w; g_win_h = h; y2d_send_line(fd, "OK"); }
                }
            } else {
                if (*title) SDL_SetWindowTitle(g_win, title);
                SDL_SetWindowSize(g_win, w, h);
                g_win_w = w; g_win_h = h;
                y2d_send_line(fd, "OK");
            }
        }
    } else if (strcmp(cmd, "WTITLE") == 0) {
        if (g_win) SDL_SetWindowTitle(g_win, args);
        y2d_send_line(fd, g_win ? "OK" : "ERR no window");
    } else if (strcmp(cmd, "WSIZE") == 0) {
        int w = 0, h = 0;
        if (!g_win || sscanf(args, "%d %d", &w, &h) < 2 || w <= 0 || h <= 0) y2d_send_line(fd, "ERR bad WSIZE");
        else { SDL_SetWindowSize(g_win, w, h); g_win_w = w; g_win_h = h; y2d_send_line(fd, "OK"); }
    } else if (strcmp(cmd, "WMIN") == 0) {
        int w = 0, h = 0;
        if (!g_win || sscanf(args, "%d %d", &w, &h) < 2 || w < 0 || h < 0) y2d_send_line(fd, "ERR bad WMIN");
        else { SDL_SetWindowMinimumSize(g_win, w, h); y2d_send_line(fd, "OK"); }
    } else if (strcmp(cmd, "WFULL") == 0) {
        int f = atoi(args);
        if (!g_win) y2d_send_line(fd, "ERR no window");
        else if (!SDL_SetWindowFullscreen(g_win, f ? true : false)) y2d_send_line(fd, "ERR fullscreen failed");
        else {
            /* X11/Wayland applies mode switches asynchronously; wait for
             * the flag to settle so callers see deterministic state. */
            for (int i = 0; i < 40; i++) {
                SDL_PumpEvents();
                Uint64 fl = SDL_GetWindowFlags(g_win);
                if (((fl & SDL_WINDOW_FULLSCREEN) ? 1 : 0) == (f ? 1 : 0)) break;
                SDL_Delay(50);
            }
            y2d_send_line(fd, "OK");
        }
    } else if (strcmp(cmd, "WHIDE") == 0) {
        if (g_win) SDL_HideWindow(g_win);
        y2d_send_line(fd, g_win ? "OK" : "ERR no window");
    } else if (strcmp(cmd, "WSHOW") == 0) {
        if (g_win) SDL_ShowWindow(g_win);
        y2d_send_line(fd, g_win ? "OK" : "ERR no window");
    } else if (strcmp(cmd, "WMINIMIZE") == 0) {
        if (g_win) SDL_MinimizeWindow(g_win);
        y2d_send_line(fd, g_win ? "OK" : "ERR no window");
    } else if (strcmp(cmd, "WMAXIMIZE") == 0) {
        if (g_win) SDL_MaximizeWindow(g_win);
        y2d_send_line(fd, g_win ? "OK" : "ERR no window");
    } else if (strcmp(cmd, "WRESTORE") == 0) {
        if (g_win) SDL_RestoreWindow(g_win);
        y2d_send_line(fd, g_win ? "OK" : "ERR no window");
    } else if (strcmp(cmd, "WINFO") == 0) {
        if (!g_ren) { y2d_send_line(fd, "ERR no window"); }
        else {
            int w = 0, h = 0;
            SDL_GetWindowSize(g_win, &w, &h);
            g_win_w = w; g_win_h = h;
            Uint64 fl = SDL_GetWindowFlags(g_win);
            char out[256];
            snprintf(out, sizeof(out), "OK {\"w\":%d,\"h\":%d,\"full\":%d,\"visible\":%d,\"focused\":%d,\"min\":%d,\"max\":%d}",
                     w, h,
                     (fl & SDL_WINDOW_FULLSCREEN) ? 1 : 0,
                     (fl & SDL_WINDOW_HIDDEN) ? 0 : 1,
                     (fl & SDL_WINDOW_INPUT_FOCUS) ? 1 : 0,
                     (fl & SDL_WINDOW_MINIMIZED) ? 1 : 0,
                     (fl & SDL_WINDOW_MAXIMIZED) ? 1 : 0);
            y2d_send_line(fd, out);
        }
    } else if (strcmp(cmd, "DISPLAY?") == 0) {
        int n = 0;
        SDL_DisplayID* ds = SDL_GetDisplays(&n);
        char out[256];
        if (ds && n > 0) {
            SDL_Rect b = { 0, 0, 0, 0 };
            SDL_GetDisplayBounds(ds[0], &b);
            const char* nm = SDL_GetDisplayName(ds[0]);
            char esc[128];
            y2d_json_escape(nm ? nm : "?", esc, sizeof(esc));
            snprintf(out, sizeof(out), "OK {\"n\":%d,\"w\":%d,\"h\":%d,\"name\":\"%s\"}", n, b.w, b.h, esc);
        } else {
            snprintf(out, sizeof(out), "OK {\"n\":0,\"w\":0,\"h\":0,\"name\":\"?\"}");
        }
        if (ds) SDL_free(ds);
        y2d_send_line(fd, out);
    } else if (strcmp(cmd, "VSYNC") == 0) {
        int v = atoi(args);
        if (!g_ren) y2d_send_line(fd, "ERR no window");
        else y2d_send_line(fd, SDL_SetRenderVSync(g_ren, v ? 1 : 0) ? "OK" : "ERR vsync failed");
    } else if (strcmp(cmd, "BLEND") == 0) {
        SDL_BlendMode m = SDL_BLENDMODE_NONE;
        if (strcmp(args, "blend") == 0) m = SDL_BLENDMODE_BLEND;
        else if (strcmp(args, "add") == 0) m = SDL_BLENDMODE_ADD;
        else if (strcmp(args, "mod") == 0) m = SDL_BLENDMODE_MOD;
        if (!g_ren) y2d_send_line(fd, "ERR no window");
        else y2d_send_line(fd, SDL_SetRenderDrawBlendMode(g_ren, m) ? "OK" : "ERR blend failed");
    } else if (strcmp(cmd, "CLIP") == 0) {
        if (!g_ren) y2d_send_line(fd, "ERR no window");
        else if (strcmp(args, "off") == 0) y2d_send_line(fd, SDL_SetRenderClipRect(g_ren, NULL) ? "OK" : "ERR clip failed");
        else {
            int x = 0, y = 0, w = 0, h = 0;
            if (sscanf(args, "%d %d %d %d", &x, &y, &w, &h) < 4) y2d_send_line(fd, "ERR bad CLIP");
            else { SDL_Rect r = { x, y, w, h }; y2d_send_line(fd, SDL_SetRenderClipRect(g_ren, &r) ? "OK" : "ERR clip failed"); }
        }
    } else if (strcmp(cmd, "VIEWPORT") == 0) {
        if (!g_ren) y2d_send_line(fd, "ERR no window");
        else if (strcmp(args, "off") == 0) y2d_send_line(fd, SDL_SetRenderViewport(g_ren, NULL) ? "OK" : "ERR viewport failed");
        else {
            int x = 0, y = 0, w = 0, h = 0;
            if (sscanf(args, "%d %d %d %d", &x, &y, &w, &h) < 4) y2d_send_line(fd, "ERR bad VIEWPORT");
            else { SDL_Rect r = { x, y, w, h }; y2d_send_line(fd, SDL_SetRenderViewport(g_ren, &r) ? "OK" : "ERR viewport failed"); }
        }
    } else if (strcmp(cmd, "CLEAR") == 0) {
        int r = 0, g = 0, b = 0;
        if (!g_ren || sscanf(args, "%d %d %d", &r, &g, &b) < 3) y2d_send_line(fd, "ERR bad CLEAR");
        else {
            g_clear_r = (Uint8)r; g_clear_g = (Uint8)g; g_clear_b = (Uint8)b;
            SDL_SetRenderDrawColor(g_ren, g_clear_r, g_clear_g, g_clear_b, 255);
            y2d_send_line(fd, SDL_RenderClear(g_ren) ? "OK" : "ERR clear failed");
        }
    } else if (strcmp(cmd, "RECT") == 0) {
        int x = 0, y = 0, w = 0, h = 0, r = 0, g = 0, b = 0, f = 0;
        if (!g_ren || sscanf(args, "%d %d %d %d %d %d %d %d", &x, &y, &w, &h, &r, &g, &b, &f) < 8)
            y2d_send_line(fd, "ERR bad RECT");
        else {
            SDL_FRect rc = { (float)x, (float)y, (float)w, (float)h };
            SDL_SetRenderDrawColor(g_ren, (Uint8)r, (Uint8)g, (Uint8)b, 255);
            y2d_send_line(fd, (f ? SDL_RenderFillRect(g_ren, &rc) : SDL_RenderRect(g_ren, &rc)) ? "OK" : "ERR rect failed");
        }
    } else if (strcmp(cmd, "CIRC") == 0) {
        int x = 0, y = 0, rad = 0, r = 0, g = 0, b = 0, f = 0;
        if (!g_ren || sscanf(args, "%d %d %d %d %d %d %d", &x, &y, &rad, &r, &g, &b, &f) < 7 || rad < 0)
            y2d_send_line(fd, "ERR bad CIRC");
        else {
            if (f) y2d_draw_circle_fill(x, y, rad, (Uint8)r, (Uint8)g, (Uint8)b);
            else y2d_draw_circle_outline(x, y, rad, (Uint8)r, (Uint8)g, (Uint8)b);
            y2d_send_line(fd, "OK");
        }
    } else if (strcmp(cmd, "LINE") == 0) {
        int x1 = 0, y1 = 0, x2 = 0, y2 = 0, r = 0, g = 0, b = 0;
        if (!g_ren || sscanf(args, "%d %d %d %d %d %d %d", &x1, &y1, &x2, &y2, &r, &g, &b) < 7)
            y2d_send_line(fd, "ERR bad LINE");
        else {
            SDL_SetRenderDrawColor(g_ren, (Uint8)r, (Uint8)g, (Uint8)b, 255);
            y2d_send_line(fd, SDL_RenderLine(g_ren, (float)x1, (float)y1, (float)x2, (float)y2) ? "OK" : "ERR line failed");
        }
    } else if (strcmp(cmd, "TRI") == 0) {
        int x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0, r = 0, g = 0, b = 0, f = 0;
        if (!g_ren || sscanf(args, "%d %d %d %d %d %d %d %d %d %d", &x1, &y1, &x2, &y2, &x3, &y3, &r, &g, &b, &f) < 10)
            y2d_send_line(fd, "ERR bad TRI");
        else if (!f) {
            SDL_SetRenderDrawColor(g_ren, (Uint8)r, (Uint8)g, (Uint8)b, 255);
            bool ok = SDL_RenderLine(g_ren, (float)x1, (float)y1, (float)x2, (float)y2)
                && SDL_RenderLine(g_ren, (float)x2, (float)y2, (float)x3, (float)y3)
                && SDL_RenderLine(g_ren, (float)x3, (float)y3, (float)x1, (float)y1);
            y2d_send_line(fd, ok ? "OK" : "ERR tri failed");
        } else {
            SDL_Vertex v[3];
            for (int i = 0; i < 3; i++) {
                v[i].color.r = r / 255.0f; v[i].color.g = g / 255.0f;
                v[i].color.b = b / 255.0f; v[i].color.a = 1.0f;
                v[i].tex_coord.x = 0; v[i].tex_coord.y = 0;
            }
            v[0].position.x = (float)x1; v[0].position.y = (float)y1;
            v[1].position.x = (float)x2; v[1].position.y = (float)y2;
            v[2].position.x = (float)x3; v[2].position.y = (float)y3;
            y2d_send_line(fd, SDL_RenderGeometry(g_ren, NULL, v, 3, NULL, 0) ? "OK" : "ERR trifill failed");
        }
    } else if (strcmp(cmd, "FONT") == 0) {
        /* Forms: "FONT path size" (explicit) | "FONT size" (auto-pick) |
         * "FONT" (auto-pick, default size). sscanf %d at end-of-string
         * does NOT match, so count single tokens explicitly. */
        char path[1024] = "";
        int size = 0;
        int n = sscanf(args, "%1023s %d", path, &size);
        const char* use_path = NULL;
        int use_size = 24;
        if (n == 2) {
            use_path = path;
            use_size = size;
        } else if (n == 1) {
            char* end = NULL;
            long v = strtol(path, &end, 10);
            if (end && *end == '\0' && v > 0 && v <= 256) use_size = (int)v;
            else use_path = path;
        }
        if (use_path) {
            if (use_size <= 0 || use_size > 256) {
                y2d_send_line(fd, "ERR bad FONT size");
            } else {
                char rpath[2048];
                if (y2d_resolve(use_path, rpath, sizeof(rpath)) != 0) {
                    y2d_send_line(fd, "ERR font path escapes resource root");
                } else {
                    FILE* t = fopen(rpath, "rb");
                    if (!t) {
                        y2d_send_line(fd, "ERR font file missing");
                    } else {
                        fclose(t);
                        TTF_Font* f = TTF_OpenFont(rpath, (float)use_size);
                        if (!f) {
                            y2d_send_line(fd, "ERR font open failed");
                        } else {
                            if (g_font) TTF_CloseFont(g_font);
                            g_font = f; g_font_size = use_size;
                            snprintf(g_font_path, sizeof(g_font_path), "%s", use_path);
                            char esc[1050], out[1150];
                            y2d_json_escape(use_path, esc, sizeof(esc));
                            snprintf(out, sizeof(out), "OK {\"font\":\"%s\",\"size\":%d}", esc, use_size);
                            y2d_send_line(fd, out);
                        }
                    }
                }
            }
        } else {
            const char* found = NULL;
            for (int i = 0; y2d_font_candidates[i] && !found; i++) {
                FILE* t = fopen(y2d_font_candidates[i], "rb");
                if (t) { fclose(t); found = y2d_font_candidates[i]; }
            }
            if (!found) { y2d_send_line(fd, "ERR no font available"); }
            else {
                TTF_Font* f = TTF_OpenFont(found, (float)use_size);
                if (!f) { y2d_send_line(fd, "ERR font open failed"); }
                else {
                    if (g_font) TTF_CloseFont(g_font);
                    g_font = f; g_font_size = use_size;
                    snprintf(g_font_path, sizeof(g_font_path), "%s", found);
                    char out[1100];
                    snprintf(out, sizeof(out), "OK {\"font\":\"%s\",\"size\":%d}", found, use_size);
                    y2d_send_line(fd, out);
                }
            }
        }
    } else if (strcmp(cmd, "TEXT") == 0) {
        int x = 0, y = 0, size = 0, r = 0, g = 0, b = 0, used = 0;
        if (!g_ren || sscanf(args, "%d %d %d %d %d %d %n", &x, &y, &size, &r, &g, &b, &used) < 6)
            y2d_send_line(fd, "ERR bad TEXT");
        else if (!g_font || size != g_font_size) {
            /* (re)open current font path at requested size */
            const char* fp = g_font_path[0] ? g_font_path : NULL;
            if (!fp) {
                for (int i = 0; y2d_font_candidates[i] && !fp; i++) {
                    FILE* t = fopen(y2d_font_candidates[i], "rb");
                    if (t) { fclose(t); fp = y2d_font_candidates[i]; }
                }
            }
            if (!fp || size <= 0 || size > 256) y2d_send_line(fd, "ERR no font");
            else {
                TTF_Font* f = TTF_OpenFont(fp, (float)size);
                if (!f) y2d_send_line(fd, "ERR font open failed");
                else {
                    if (g_font) TTF_CloseFont(g_font);
                    g_font = f; g_font_size = size;
                    snprintf(g_font_path, sizeof(g_font_path), "%s", fp);
                    goto do_text;
                }
            }
        } else {
        do_text:;
            const char* text = args + used;
            while (*text == ' ') text++;
            SDL_Color col = { (Uint8)r, (Uint8)g, (Uint8)b, 255 };
            SDL_Surface* s = TTF_RenderText_Blended(g_font, text, strlen(text), col);
            if (!s) { y2d_send_line(fd, "ERR text render failed"); }
            else {
                SDL_Texture* t = SDL_CreateTextureFromSurface(g_ren, s);
                int tw = s->w, th = s->h;
                SDL_DestroySurface(s);
                if (!t) { y2d_send_line(fd, "ERR text texture failed"); }
                else {
                    SDL_FRect d = { (float)x, (float)y, (float)tw, (float)th };
                    bool ok = SDL_RenderTexture(g_ren, t, NULL, &d);
                    SDL_DestroyTexture(t);
                    char out[64];
                    snprintf(out, sizeof(out), "OK {\"w\":%d,\"h\":%d}", tw, th);
                    y2d_send_line(fd, ok ? out : "ERR text draw failed");
                }
            }
        }
    } else if (strcmp(cmd, "IMG") == 0) {
        int id = -1, used = 0;
        if (sscanf(args, "%d %n", &id, &used) < 1 || id < 0 || id >= Y2D_MAX_TEX) {
            y2d_send_line(fd, "ERR bad IMG id");
        } else {
            const char* path = args + used;
            while (*path == ' ') path++;
            char rpath[2048];
            if (y2d_resolve(path, rpath, sizeof(rpath)) != 0) {
                y2d_send_line(fd, "ERR image path escapes resource root");
            } else {
                int w = 0, h = 0, comp = 0;
                unsigned char* px = stbi_load(rpath, &w, &h, &comp, 4);
                if (!px) {
                    y2d_send_line(fd, "ERR image decode failed");
                } else if (!g_ren) {
                    stbi_image_free(px);
                    y2d_send_line(fd, "ERR no window");
                } else {
                    SDL_Surface* s = SDL_CreateSurfaceFrom(w, h, SDL_PIXELFORMAT_RGBA32, px, w * 4);
                    if (!s) {
                        stbi_image_free(px);
                        y2d_send_line(fd, "ERR image surface failed");
                    } else {
                        SDL_Texture* t = SDL_CreateTextureFromSurface(g_ren, s);
                        SDL_DestroySurface(s);
                        stbi_image_free(px);
                        if (!t) {
                            y2d_send_line(fd, "ERR texture failed");
                        } else {
                            if (g_tex[id].in_use && g_tex[id].tex) SDL_DestroyTexture(g_tex[id].tex);
                            g_tex[id].tex = t; g_tex[id].w = w; g_tex[id].h = h; g_tex[id].in_use = 1;
                            char out[64];
                            snprintf(out, sizeof(out), "OK {\"w\":%d,\"h\":%d}", w, h);
                            y2d_send_line(fd, out);
                        }
                    }
                }
            }
        }
    } else if (strcmp(cmd, "DRAW") == 0) {
        int id = -1, x = 0, y = 0;
        if (sscanf(args, "%d %d %d", &id, &x, &y) < 3 || id < 0 || id >= Y2D_MAX_TEX || !g_tex[id].in_use)
            y2d_send_line(fd, "ERR bad DRAW");
        else if (!g_ren) y2d_send_line(fd, "ERR no window");
        else {
            SDL_FRect d = { (float)x, (float)y, (float)g_tex[id].w, (float)g_tex[id].h };
            y2d_send_line(fd, SDL_RenderTexture(g_ren, g_tex[id].tex, NULL, &d) ? "OK" : "ERR draw failed");
        }
    } else if (strcmp(cmd, "DRAWEX") == 0) {
        int id = -1, x = 0, y = 0, w = 0, h = 0, flip = 0, alpha = 255;
        double angle = 0;
        if (sscanf(args, "%d %d %d %d %d %d %lf %d", &id, &x, &y, &w, &h, &flip, &angle, &alpha) < 8
            || id < 0 || id >= Y2D_MAX_TEX || !g_tex[id].in_use)
            y2d_send_line(fd, "ERR bad DRAWEX");
        else if (!g_ren) y2d_send_line(fd, "ERR no window");
        else {
            SDL_SetTextureAlphaMod(g_tex[id].tex, (Uint8)alpha);
            SDL_FRect d = { (float)x, (float)y, (float)w, (float)h };
            SDL_FlipMode fm = SDL_FLIP_NONE;
            if (flip == 1) fm = SDL_FLIP_HORIZONTAL;
            else if (flip == 2) fm = SDL_FLIP_VERTICAL;
            else if (flip == 3) fm = (SDL_FlipMode)(SDL_FLIP_HORIZONTAL | SDL_FLIP_VERTICAL);
            y2d_send_line(fd, SDL_RenderTextureRotated(g_ren, g_tex[id].tex, NULL, &d, angle, NULL, fm) ? "OK" : "ERR drawex failed");
        }
    } else if (strcmp(cmd, "IMGSRC") == 0) {
        int id = -1, sx = 0, sy = 0, sw = 0, sh = 0, dx = 0, dy = 0;
        if (sscanf(args, "%d %d %d %d %d %d %d", &id, &sx, &sy, &sw, &sh, &dx, &dy) < 7
            || id < 0 || id >= Y2D_MAX_TEX || !g_tex[id].in_use)
            y2d_send_line(fd, "ERR bad IMGSRC");
        else if (!g_ren) y2d_send_line(fd, "ERR no window");
        else {
            SDL_FRect s = { (float)sx, (float)sy, (float)sw, (float)sh };
            SDL_FRect d = { (float)dx, (float)dy, (float)sw, (float)sh };
            y2d_send_line(fd, SDL_RenderTexture(g_ren, g_tex[id].tex, &s, &d) ? "OK" : "ERR imgsrc failed");
        }
    } else if (strcmp(cmd, "IMGDEL") == 0) {
        int id = atoi(args);
        if (id < 0 || id >= Y2D_MAX_TEX || !g_tex[id].in_use) y2d_send_line(fd, "ERR bad IMGDEL");
        else { SDL_DestroyTexture(g_tex[id].tex); g_tex[id].tex = NULL; g_tex[id].in_use = 0; y2d_send_line(fd, "OK"); }
    } else if (strcmp(cmd, "IMGCOUNT") == 0) {
        int n = 0;
        for (int i = 0; i < Y2D_MAX_TEX; i++) if (g_tex[i].in_use) n++;
        char out[32];
        snprintf(out, sizeof(out), "OK {\"n\":%d}", n);
        y2d_send_line(fd, out);
    } else if (strcmp(cmd, "WAV") == 0) {
        int id = -1, used = 0;
        if (sscanf(args, "%d %n", &id, &used) < 1 || id < 0 || id >= Y2D_MAX_WAV) {
            y2d_send_line(fd, "ERR bad WAV id");
        } else if (!g_audio_ok) {
            y2d_send_line(fd, "ERR audio unavailable");
        } else {
            const char* path = args + used;
            while (*path == ' ') path++;
            char rpath[2048];
            if (y2d_resolve(path, rpath, sizeof(rpath)) != 0) {
                y2d_send_line(fd, "ERR audio path escapes resource root");
            } else {
                Uint8* data = NULL;
                Uint32 len = 0;
                SDL_AudioSpec spec;
                memset(&spec, 0, sizeof(spec));
                if (y2d_decode_audio(rpath, &data, &len, &spec) != 0) {
                    y2d_send_line(fd, "ERR audio decode failed");
                } else {
                    if (g_wav[id].in_use && g_wav[id].data) SDL_free(g_wav[id].data);
                    g_wav[id].data = data; g_wav[id].len = len; g_wav[id].spec = spec; g_wav[id].in_use = 1;
                    char out[96];
                    snprintf(out, sizeof(out), "OK {\"len\":%u,\"freq\":%d,\"ch\":%d}", len, spec.freq, (int)spec.channels);
                    y2d_send_line(fd, out);
                }
            }
        }
    } else if (strcmp(cmd, "WAVDEL") == 0) {
        int id = atoi(args);
        if (id < 0 || id >= Y2D_MAX_WAV || !g_wav[id].in_use) y2d_send_line(fd, "ERR bad WAVDEL");
        else { SDL_free(g_wav[id].data); g_wav[id].data = NULL; g_wav[id].in_use = 0; y2d_send_line(fd, "OK"); }
    } else if (strcmp(cmd, "WAVCOUNT") == 0) {
        int n = 0;
        for (int i = 0; i < Y2D_MAX_WAV; i++) if (g_wav[i].in_use) n++;
        char out[32];
        snprintf(out, sizeof(out), "OK {\"n\":%d}", n);
        y2d_send_line(fd, out);
    } else if (strcmp(cmd, "PLAY") == 0) {
        int id = -1, loop = 0;
        if (sscanf(args, "%d %d", &id, &loop) < 1 || id < 0 || id >= Y2D_MAX_WAV || !g_wav[id].in_use)
            y2d_send_line(fd, "ERR bad PLAY");
        else if (!g_audio_ok) y2d_send_line(fd, "ERR audio unavailable");
        else {
            y2d_audio_reap();
            int slot = -1;
            for (int i = 0; i < Y2D_MAX_SFX; i++) if (!g_sfx[i].active) { slot = i; break; }
            if (slot < 0) { y2d_send_line(fd, "ERR too many sounds"); }
            else {
                SDL_AudioStream* st = SDL_OpenAudioDeviceStream(SDL_AUDIO_DEVICE_DEFAULT_PLAYBACK, &g_wav[id].spec, NULL, NULL);
                if (!st) { y2d_send_line(fd, "ERR play failed"); }
                else {
                    SDL_SetAudioStreamGain(st, y2d_eff_gain());
                    SDL_PutAudioStreamData(st, g_wav[id].data, (int)g_wav[id].len);
                    SDL_ResumeAudioStreamDevice(st);
                    g_sfx[slot].stream = st;
                    g_sfx[slot].data = g_wav[id].data;
                    g_sfx[slot].len = g_wav[id].len;
                    g_sfx[slot].loop = loop ? 1 : 0;
                    g_sfx[slot].active = 1;
                    y2d_send_line(fd, "OK");
                }
            }
        }
    } else if (strcmp(cmd, "MUSPLAY") == 0) {
        int used = 0, loop = 0;
        char path[1024] = "";
        if (sscanf(args, "%1023s %d %n", path, &loop, &used) < 1) {
            y2d_send_line(fd, "ERR bad MUSPLAY");
        } else if (!g_audio_ok) {
            y2d_send_line(fd, "ERR audio unavailable");
        } else {
            char rpath[2048];
            if (y2d_resolve(path, rpath, sizeof(rpath)) != 0) {
                y2d_send_line(fd, "ERR music path escapes resource root");
            } else {
                Uint8* data = NULL;
                Uint32 len = 0;
                SDL_AudioSpec spec;
                memset(&spec, 0, sizeof(spec));
                if (y2d_decode_audio(rpath, &data, &len, &spec) != 0) {
                    y2d_send_line(fd, "ERR audio decode failed");
                } else {
                    if (g_mus_stream) { SDL_DestroyAudioStream(g_mus_stream); g_mus_stream = NULL; }
                    if (g_mus_data) { SDL_free(g_mus_data); g_mus_data = NULL; }
                    g_mus_stream = SDL_OpenAudioDeviceStream(SDL_AUDIO_DEVICE_DEFAULT_PLAYBACK, &spec, NULL, NULL);
                    if (!g_mus_stream) { SDL_free(data); y2d_send_line(fd, "ERR music failed"); }
                    else {
                        SDL_SetAudioStreamGain(g_mus_stream, y2d_eff_gain());
                        g_mus_data = data; g_mus_len = len; g_mus_spec = spec;
                        g_mus_pos = 0; g_mus_loop = loop ? 1 : 0; g_mus_playing = 1;
                        SDL_ResumeAudioStreamDevice(g_mus_stream);
                        y2d_send_line(fd, "OK");
                    }
                }
            }
        }
    } else if (strcmp(cmd, "MUSSTOP") == 0) {
        g_mus_playing = 0;
        if (g_mus_stream) { SDL_DestroyAudioStream(g_mus_stream); g_mus_stream = NULL; }
        if (g_mus_data) { SDL_free(g_mus_data); g_mus_data = NULL; g_mus_len = 0; }
        y2d_send_line(fd, "OK");
    } else if (strcmp(cmd, "VOLUME") == 0) {
        int v = atoi(args);
        if (v < 0) v = 0;
        if (v > 100) v = 100;
        g_volume = v / 100.0f;
        for (int i = 0; i < Y2D_MAX_SFX; i++)
            if (g_sfx[i].active && g_sfx[i].stream) SDL_SetAudioStreamGain(g_sfx[i].stream, y2d_eff_gain());
        if (g_mus_stream) SDL_SetAudioStreamGain(g_mus_stream, y2d_eff_gain());
        y2d_send_line(fd, "OK");
    } else if (strcmp(cmd, "MUTE") == 0) {
        g_muted = atoi(args) ? 1 : 0;
        for (int i = 0; i < Y2D_MAX_SFX; i++)
            if (g_sfx[i].active && g_sfx[i].stream) SDL_SetAudioStreamGain(g_sfx[i].stream, y2d_eff_gain());
        if (g_mus_stream) SDL_SetAudioStreamGain(g_mus_stream, y2d_eff_gain());
        y2d_send_line(fd, "OK");
    } else if (strcmp(cmd, "AUDIO?") == 0) {
        int pads = 0;
        SDL_JoystickID* js = SDL_GetJoysticks(&pads);
        if (js) SDL_free(js);
        char out[96];
        snprintf(out, sizeof(out), "OK {\"audio\":%d,\"pads\":%d}", g_audio_ok ? 1 : 0, pads);
        y2d_send_line(fd, out);
    } else if (strcmp(cmd, "PRESENT") == 0) {
        if (!g_ren) y2d_send_line(fd, "ERR no window");
        else {
            SDL_RenderPresent(g_ren);
            y2d_poll_sdl_events();
            y2d_send_events(fd);
            if (g_quit_seen) {
                /* Window closed: the quit event was just delivered; now
                 * drop every client so games always terminate (no orphans). */
                g_quit_seen = 0;
                y2d_close_other_clients(fd);
                return 1;
            }
        }
    } else if (strcmp(cmd, "POLL") == 0) {
        y2d_poll_sdl_events();
        y2d_send_events(fd);
        if (g_quit_seen) {
            g_quit_seen = 0;
            y2d_close_other_clients(fd);
            return 1;
        }
    } else if (strcmp(cmd, "SHOT") == 0) {
        while (*args == ' ') args++;
        if (!g_ren || !*args) {
            y2d_send_line(fd, "ERR bad SHOT");
        } else {
            char rpath[2048];
            if (y2d_resolve(args, rpath, sizeof(rpath)) != 0) {
                y2d_send_line(fd, "ERR shot path escapes resource root");
            } else {
                SDL_Surface* s = SDL_RenderReadPixels(g_ren, NULL);
                if (!s) y2d_send_line(fd, "ERR shot failed");
                else {
                    bool ok = SDL_SaveBMP(s, rpath);
                    int w = s->w, h = s->h;
                    SDL_DestroySurface(s);
                    char out[64];
                    if (ok) snprintf(out, sizeof(out), "OK {\"w\":%d,\"h\":%d}", w, h);
                    else snprintf(out, sizeof(out), "ERR shot save failed");
                    y2d_send_line(fd, out);
                }
            }
        }
    } else if (strcmp(cmd, "PIXELS") == 0) {
        int x = 0, y = 0, w = 0, h = 0;
        if (!g_ren || sscanf(args, "%d %d %d %d", &x, &y, &w, &h) < 4) y2d_send_line(fd, "ERR bad PIXELS");
        else {
            int n = y2d_count_pixels(x, y, w, h);
            char out[64];
            if (n < 0) snprintf(out, sizeof(out), "ERR pixels failed");
            else snprintf(out, sizeof(out), "OK {\"n\":%d}", n);
            y2d_send_line(fd, out);
        }
    } else if (strcmp(cmd, "INJECT") == 0) {
        char kind[16] = "";
        int used = 0;
        if (sscanf(args, "%15s %n", kind, &used) < 1) y2d_send_line(fd, "ERR bad INJECT");
        else if (strcmp(kind, "key") == 0) {
            char k[64] = "";
            int down = 0;
            if (sscanf(args + used, "%63s %d", k, &down) < 2) y2d_send_line(fd, "ERR bad INJECT key");
            else {
                char esc[128], out[200];
                y2d_json_escape(k, esc, sizeof(esc));
                snprintf(out, sizeof(out), "{\"t\":\"key\",\"k\":\"%s\",\"down\":%d,\"rep\":0}", esc, down ? 1 : 0);
                y2d_push_event(out);
                y2d_send_line(fd, "OK");
            }
        } else if (strcmp(kind, "mouse") == 0) {
            int x = 0, y = 0, b = 0, w = 0;
            if (sscanf(args + used, "%d %d %d %d", &x, &y, &b, &w) < 4) y2d_send_line(fd, "ERR bad INJECT mouse");
            else {
                char out[128];
                snprintf(out, sizeof(out), "{\"t\":\"mouse\",\"x\":%d,\"y\":%d,\"b\":%d,\"w\":%d}", x, y, b, w);
                y2d_push_event(out);
                y2d_send_line(fd, "OK");
            }
        } else if (strcmp(kind, "quit") == 0) {
            y2d_push_event("{\"t\":\"quit\"}");
            y2d_send_line(fd, "OK");
        } else {
            y2d_send_line(fd, "ERR bad INJECT kind");
        }
    } else if (strcmp(cmd, "CURSOR") == 0) {
        if (!g_win) y2d_send_line(fd, "ERR no window");
        else y2d_send_line(fd, (atoi(args) ? SDL_ShowCursor() : SDL_HideCursor()) ? "OK" : "ERR cursor failed");
    } else if (strcmp(cmd, "WARP") == 0) {
        int x = 0, y = 0;
        if (!g_win || !g_ren || sscanf(args, "%d %d", &x, &y) < 2) y2d_send_line(fd, "ERR bad WARP");
        else { SDL_WarpMouseInWindow(g_win, (float)x, (float)y); y2d_send_line(fd, "OK"); }
    } else {
        y2d_send_line(fd, "ERR unknown command");
    }
    return 0;
}

/* ---- Server --------------------------------------------------------------- */

static int y2d_make_server(int port) {
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) return -1;
    int one = 1;
    setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));
    struct sockaddr_in a;
    memset(&a, 0, sizeof(a));
    a.sin_family = AF_INET;
    a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    a.sin_port = htons((unsigned short)port);
    if (bind(fd, (struct sockaddr*)&a, sizeof(a)) != 0) { close(fd); return -1; }
    if (listen(fd, 4) != 0) { close(fd); return -1; }
    return fd;
}

static int y2d_init_sdl(int with_video, int with_audio) {
    Uint32 flags = 0;
    if (with_video) flags |= SDL_INIT_VIDEO;
    if (with_audio) flags |= SDL_INIT_AUDIO;
    flags |= SDL_INIT_GAMEPAD | SDL_INIT_EVENTS;
    if (!SDL_Init(flags)) {
        fprintf(stderr, "y2d: SDL_Init failed: %s\n", SDL_GetError());
        return -1;
    }
    if (with_audio) {
        /* probe: try opening + closing a throwaway stream */
        SDL_AudioSpec spec;
        SDL_zero(spec);
        spec.format = SDL_AUDIO_S16;
        spec.channels = 1;
        spec.freq = 22050;
        SDL_AudioStream* st = SDL_OpenAudioDeviceStream(SDL_AUDIO_DEVICE_DEFAULT_PLAYBACK, &spec, NULL, NULL);
        if (st) {
            g_audio_ok = 1;
            SDL_DestroyAudioStream(st);
        } else {
            fprintf(stderr, "y2d: audio unavailable: %s\n", SDL_GetError());
        }
    }
    if (!TTF_Init()) {
        fprintf(stderr, "y2d: TTF_Init failed: %s\n", SDL_GetError());
    }
    return 0;
}

static void y2d_cleanup(void) {
    for (int i = 0; i < Y2D_MAX_TEX; i++) {
        if (g_tex[i].in_use && g_tex[i].tex) SDL_DestroyTexture(g_tex[i].tex);
        g_tex[i].in_use = 0;
    }
    for (int i = 0; i < Y2D_MAX_WAV; i++) {
        if (g_wav[i].in_use && g_wav[i].data) SDL_free(g_wav[i].data);
        g_wav[i].in_use = 0;
    }
    for (int i = 0; i < Y2D_MAX_SFX; i++) {
        if (g_sfx[i].stream) SDL_DestroyAudioStream(g_sfx[i].stream);
        g_sfx[i].stream = NULL;
        g_sfx[i].active = 0;
    }
    if (g_mus_stream) { SDL_DestroyAudioStream(g_mus_stream); g_mus_stream = NULL; }
    if (g_mus_data) { SDL_free(g_mus_data); g_mus_data = NULL; }
    if (g_font) { TTF_CloseFont(g_font); g_font = NULL; }
    TTF_Quit();
    y2d_clear_events();
    if (g_ren) { SDL_DestroyRenderer(g_ren); g_ren = NULL; }
    if (g_win) { SDL_DestroyWindow(g_win); g_win = NULL; }
    SDL_Quit();
}

static int y2d_serve(int port) {
    if (y2d_init_sdl(1, 1) != 0) return 1;
    int srv = y2d_make_server(port);
    if (srv < 0) { fprintf(stderr, "y2d: cannot listen on 127.0.0.1:%d\n", port); y2d_cleanup(); return 1; }
    g_srv_fd = srv;
    /* Machine-readable readiness for supervisors (`--serve 0` asks the
     * OS for an ephemeral port; report the actual bound port). */
    {
        struct sockaddr_in bound;
        socklen_t bl = sizeof(bound);
        int show = port;
        if (getsockname(srv, (struct sockaddr*)&bound, &bl) == 0)
            show = (int)ntohs(bound.sin_port);
        printf("PORT %d\n", show);
        fflush(stdout);
    }
    fprintf(stderr, "y2d: serving on 127.0.0.1:%d (video+audio init attempted)\n", port);
    for (int i = 0; i < Y2D_MAX_CLIENTS; i++) { g_clients[i].fd = -1; g_clients[i].len = 0; g_clients[i].active = 0; }
    int running = 1;
    while (running) {
        fd_set rfds;
        FD_ZERO(&rfds);
        int maxfd = -1;
        if (g_srv_fd >= 0) { FD_SET(g_srv_fd, &rfds); maxfd = g_srv_fd; }
        for (int i = 0; i < Y2D_MAX_CLIENTS; i++) {
            if (g_clients[i].active) {
                FD_SET(g_clients[i].fd, &rfds);
                if (g_clients[i].fd > maxfd) maxfd = g_clients[i].fd;
            }
        }
        if (maxfd < 0) break;
        struct timeval tv;
        tv.tv_sec = 0;
        tv.tv_usec = 10000;
        int nready = select(maxfd + 1, &rfds, NULL, NULL, &tv);
        y2d_music_pump();
        y2d_audio_reap();
        if (nready < 0) continue;
        if (g_srv_fd >= 0 && FD_ISSET(g_srv_fd, &rfds)) {
            struct sockaddr_in c;
            socklen_t cl = sizeof(c);
            int fd = accept(g_srv_fd, (struct sockaddr*)&c, &cl);
            if (fd >= 0) {
                int one = 1;
                setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one));
                int placed = 0;
                for (int i = 0; i < Y2D_MAX_CLIENTS; i++) {
                    if (!g_clients[i].active) {
                        g_clients[i].fd = fd;
                        g_clients[i].len = 0;
                        g_clients[i].active = 1;
                        placed = 1;
                        break;
                    }
                }
                if (!placed) close(fd);
            }
        }
        for (int i = 0; i < Y2D_MAX_CLIENTS; i++) {
            if (!g_clients[i].active || !FD_ISSET(g_clients[i].fd, &rfds)) continue;
            char tmp[4096];
#ifdef _WIN32
            int n = recv(g_clients[i].fd, tmp, sizeof(tmp), 0);
#else
            ssize_t n = recv(g_clients[i].fd, tmp, sizeof(tmp), 0);
#endif
            if (n <= 0) {
                close(g_clients[i].fd);
                g_clients[i].fd = -1;
                g_clients[i].len = 0;
                g_clients[i].active = 0;
                continue;
            }
            for (int k = 0; k < n; k++) {
                if (g_clients[i].len + 1 >= sizeof(g_clients[i].line)) {
                    /* overlong line: drop client */
                    close(g_clients[i].fd);
                    g_clients[i].fd = -1;
                    g_clients[i].len = 0;
                    g_clients[i].active = 0;
                    break;
                }
                if (tmp[k] == '\n') {
                    g_clients[i].line[g_clients[i].len] = '\0';
                    /* strip trailing \r */
                    size_t ll = g_clients[i].len;
                    while (ll > 0 && g_clients[i].line[ll - 1] == '\r') g_clients[i].line[--ll] = '\0';
                    g_clients[i].len = 0;
                    int r = y2d_handle(g_clients[i].fd, g_clients[i].line);
                    if (r == 1) {
                        close(g_clients[i].fd);
                        g_clients[i].fd = -1;
                        g_clients[i].active = 0;
                        break;
                    }
                    if (r == 2) running = 0;
                } else {
                    g_clients[i].line[g_clients[i].len++] = tmp[k];
                }
            }
        }
    }
    for (int i = 0; i < Y2D_MAX_CLIENTS; i++) {
        if (g_clients[i].active) { close(g_clients[i].fd); g_clients[i].active = 0; }
    }
    if (g_srv_fd >= 0) { close(g_srv_fd); g_srv_fd = -1; }
    (void)srv;
    y2d_cleanup();
    return 0;
}

/* ---- Self-test (headless; dummy video driver) ------------------------------ */

static int y2d_selftest(void) {
    SDL_SetHint(SDL_HINT_VIDEO_DRIVER, "dummy");
    SDL_SetHint(SDL_HINT_AUDIO_DRIVER, "dummy");
    if (y2d_init_sdl(1, 1) != 0) { printf("SELFTEST init=FAIL\n"); return 1; }
    int fails = 0;
    g_win = SDL_CreateWindow("selftest", 320, 240, 0);
    if (!g_win) { printf("SELFTEST window=FAIL %s\n", SDL_GetError()); return 1; }
    g_ren = SDL_CreateRenderer(g_win, NULL);
    if (!g_ren) { printf("SELFTEST renderer=FAIL %s\n", SDL_GetError()); return 1; }
    g_win_w = 320; g_win_h = 240;
    /* draw pattern */
    g_clear_r = 0; g_clear_g = 0; g_clear_b = 0;
    SDL_SetRenderDrawColor(g_ren, 0, 0, 0, 255);
    SDL_RenderClear(g_ren);
    SDL_SetRenderDrawColor(g_ren, 255, 0, 0, 255);
    SDL_FRect r = { 10, 10, 100, 50 };
    SDL_RenderFillRect(g_ren, &r);
    SDL_SetRenderDrawColor(g_ren, 0, 255, 0, 255);
    SDL_RenderLine(g_ren, 0, 0, 319, 239);
    y2d_draw_circle_fill(200, 100, 30, 0, 0, 255);
    SDL_RenderPresent(g_ren);
    unsigned long long sum = y2d_framebuffer_sum();
    printf("SELFTEST framebuffer=0x%llx\n", sum);
    if (sum == 0) { printf("SELFTEST blank=FAIL\n"); fails++; }
    int nred = y2d_count_pixels(10, 10, 100, 50);
    printf("SELFTEST redrect=%d\n", nred);
    if (nred < 4000) { printf("SELFTEST redrect=FAIL\n"); fails++; }
    /* font + Tamil text */
    const char* fp = NULL;
    for (int i = 0; y2d_font_candidates[i] && !fp; i++) {
        FILE* t = fopen(y2d_font_candidates[i], "rb");
        if (t) { fclose(t); fp = y2d_font_candidates[i]; }
    }
    if (!fp) { printf("SELFTEST font=SKIP\n"); }
    else {
        TTF_Font* f = TTF_OpenFont(fp, 24);
        if (!f) { printf("SELFTEST fontopen=FAIL\n"); fails++; }
        else {
            SDL_Color col = { 255, 255, 255, 255 };
            SDL_Surface* s = TTF_RenderText_Blended(f, "வணக்கம்", strlen("வணக்கம்"), col);
            if (!s) { printf("SELFTEST tamil=FAIL\n"); fails++; }
            else {
                printf("SELFTEST tamil_wh=%d,%d\n", s->w, s->h);
                if (s->w < 10 || s->h < 10) { printf("SELFTEST tamil=FAIL\n"); fails++; }
                SDL_Texture* t = SDL_CreateTextureFromSurface(g_ren, s);
                SDL_DestroySurface(s);
                if (!t) { printf("SELFTEST tamiltex=FAIL\n"); fails++; }
                else {
                    SDL_FRect d = { 10, 200, 200, 30 };
                    SDL_RenderTexture(g_ren, t, NULL, &d);
                    SDL_DestroyTexture(t);
                    SDL_RenderPresent(g_ren);
                    int npx = y2d_count_pixels(10, 200, 200, 30);
                    printf("SELFTEST tamil_px=%d\n", npx);
                    if (npx < 20) { printf("SELFTEST tamil_px=FAIL\n"); fails++; }
                }
            }
            TTF_CloseFont(f);
        }
    }
    /* WAV synth in memory -> decode */
    {
        int sr = 22050, frames = 2205;
        int16_t* pcm = (int16_t*)malloc((size_t)frames * 2);
        for (int i = 0; i < frames; i++) {
            double ph = 2.0 * 3.14159265358979 * 440.0 * i / sr;
            pcm[i] = (int16_t)(10000.0 * sin(ph));
        }
        /* minimal WAV container in memory */
        unsigned char hdr[44];
        memcpy(hdr, "RIFF", 4);
        Uint32 dlen = (Uint32)frames * 2;
        Uint32 clen = 36 + dlen;
        memcpy(hdr + 4, &clen, 4);
        memcpy(hdr + 8, "WAVEfmt ", 8);
        Uint32 flen = 16;
        memcpy(hdr + 16, &flen, 4);
        Uint16 fmt = 1, ch = 1;
        memcpy(hdr + 20, &fmt, 2);
        memcpy(hdr + 22, &ch, 2);
        memcpy(hdr + 24, &sr, 4);
        Uint32 br = (Uint32)sr * 2;
        memcpy(hdr + 28, &br, 4);
        Uint16 ba = 2;
        memcpy(hdr + 32, &ba, 2);
        Uint16 bps = 16;
        memcpy(hdr + 34, &bps, 2);
        memcpy(hdr + 36, "data", 4);
        memcpy(hdr + 40, &dlen, 4);
        SDL_AudioSpec spec;
        Uint8* ab = NULL;
        Uint32 al = 0;
        FILE* tf = fopen("/tmp/y2d_selftest.wav", "wb");
        if (tf) {
            fwrite(hdr, 1, 44, tf);
            fwrite(pcm, 1, dlen, tf);
            fclose(tf);
            if (SDL_LoadWAV("/tmp/y2d_selftest.wav", &spec, &ab, &al)) {
                printf("SELFTEST wav=%u,%d\n", al, spec.freq);
                if (al != dlen) { printf("SELFTEST wav=FAIL\n"); fails++; }
                SDL_free(ab);
            } else { printf("SELFTEST wav=FAIL\n"); fails++; }
            remove("/tmp/y2d_selftest.wav");
        } else { printf("SELFTEST wav=FAIL\n"); fails++; }
        free(pcm);
    }
    printf("SELFTEST fails=%d\n", fails);
    y2d_cleanup();
    return fails ? 1 : 0;
}

/* ---- Probe: can SDL video/audio/font init here? ----------------------------- */

static int y2d_probe(void) {
    if (y2d_init_sdl(1, 1) != 0) { printf("VIDEO_OK=0\n"); return 1; }
    SDL_Window* w = SDL_CreateWindow("probe", 64, 64, SDL_WINDOW_HIDDEN);
    printf("VIDEO_OK=%d\n", w ? 1 : 0);
    printf("AUDIO_OK=%d\n", g_audio_ok ? 1 : 0);
    const char* fp = NULL;
    for (int i = 0; y2d_font_candidates[i] && !fp; i++) {
        FILE* t = fopen(y2d_font_candidates[i], "rb");
        if (t) { fclose(t); fp = y2d_font_candidates[i]; }
    }
    printf("FONT_OK=%d\n", fp ? 1 : 0);
    int pads = 0;
    SDL_JoystickID* js = SDL_GetJoysticks(&pads);
    if (js) SDL_free(js);
    printf("PADS=%d\n", pads);
    if (w) SDL_DestroyWindow(w);
    y2d_cleanup();
    return 0;
}

/* ---- main -------------------------------------------------------------------- */

int main(int argc, char** argv) {
#ifdef _WIN32
    WSADATA wd;
    WSAStartup(MAKEWORD(2, 2), &wd);
#endif
    if (argc >= 2 && strcmp(argv[1], "--probe") == 0) return y2d_probe();
    if (argc >= 2 && strcmp(argv[1], "--selftest") == 0) return y2d_selftest();
    int port = Y2D_DEFAULT_PORT;
    if (argc >= 3 && strcmp(argv[1], "--serve") == 0) port = atoi(argv[2]);
    else if (argc >= 2 && strcmp(argv[1], "--serve") != 0) {
        fprintf(stderr, "usage: %s [--serve [port] [-v] | --probe | --selftest]\n", argv[0]);
        return 2;
    }
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-v") == 0 || strcmp(argv[i], "--verbose") == 0) g_verbose = 1;
    }
    return y2d_serve(port);
}
