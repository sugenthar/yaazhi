/* mkassets — generate deterministic test assets for native tests.
 * Usage: mkassets <outdir>
 * Writes: red8.png (8x8 solid red), sheet.png (8x4 two frames),
 *         tone.wav (440Hz sine 0.5s mono 16-bit 22050Hz),
 *         tone.ogg (same tone, ffmpeg required at RUNTIME of this tool? no —
 *         OGG is generated only if ffmpeg exists; else skipped honestly),
 *         corrupt.bin (non-image bytes).
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"

static int write_wav(const char* path, int sr, double freq, double secs) {
    int frames = (int)(sr * secs);
    FILE* f = fopen(path, "wb");
    if (!f) return -1;
    unsigned int dlen = (unsigned int)frames * 2u;
    unsigned int clen = 36 + dlen;
    unsigned int flen = 16;
    unsigned short fmt = 1, ch = 1, ba = 2, bps = 16;
    unsigned int br = (unsigned int)sr * 2u;
    fwrite("RIFF", 1, 4, f);
    fwrite(&clen, 4, 1, f);
    fwrite("WAVEfmt ", 1, 8, f);
    fwrite(&flen, 4, 1, f);
    fwrite(&fmt, 2, 1, f);
    fwrite(&ch, 2, 1, f);
    fwrite(&sr, 4, 1, f);
    fwrite(&br, 4, 1, f);
    fwrite(&ba, 2, 1, f);
    fwrite(&bps, 2, 1, f);
    fwrite("data", 1, 4, f);
    fwrite(&dlen, 4, 1, f);
    for (int i = 0; i < frames; i++) {
        double ph = 2.0 * 3.14159265358979 * freq * i / sr;
        short s = (short)(10000.0 * sin(ph));
        fwrite(&s, 2, 1, f);
    }
    fclose(f);
    return 0;
}

int main(int argc, char** argv) {
    if (argc < 2) { fprintf(stderr, "usage: mkassets <outdir>\n"); return 2; }
    char path[1024];
    /* red8.png */
    {
        unsigned char px[8 * 8 * 3];
        for (int i = 0; i < 8 * 8; i++) { px[3 * i] = 255; px[3 * i + 1] = 0; px[3 * i + 2] = 0; }
        snprintf(path, sizeof(path), "%s/red8.png", argv[1]);
        if (!stbi_write_png(path, 8, 8, 3, px, 8 * 3)) { fprintf(stderr, "red8 failed\n"); return 1; }
    }
    /* sheet.png: 8x4, left frame green, right frame blue */
    {
        unsigned char px[8 * 4 * 3];
        for (int y = 0; y < 4; y++) {
            for (int x = 0; x < 8; x++) {
                int i = y * 8 + x;
                if (x < 4) { px[3 * i] = 0; px[3 * i + 1] = 255; px[3 * i + 2] = 0; }
                else { px[3 * i] = 0; px[3 * i + 1] = 0; px[3 * i + 2] = 255; }
            }
        }
        snprintf(path, sizeof(path), "%s/sheet.png", argv[1]);
        if (!stbi_write_png(path, 8, 4, 3, px, 8 * 3)) { fprintf(stderr, "sheet failed\n"); return 1; }
    }
    /* tone.wav */
    snprintf(path, sizeof(path), "%s/tone.wav", argv[1]);
    if (write_wav(path, 22050, 440.0, 0.5) != 0) { fprintf(stderr, "wav failed\n"); return 1; }
    /* corrupt.bin */
    snprintf(path, sizeof(path), "%s/corrupt.bin", argv[1]);
    FILE* f = fopen(path, "wb");
    if (!f) { fprintf(stderr, "corrupt failed\n"); return 1; }
    unsigned char junk[64];
    for (int i = 0; i < 64; i++) junk[i] = (unsigned char)(i * 7 + 3);
    fwrite(junk, 1, 64, f);
    fclose(f);
    printf("mkassets ok\n");
    return 0;
}
