# Yaazhi package registry mirror layout

`YAAZHI_REGISTRY` points at a base URL (`http://...` or `file://...`)
serving this layout (see `docs/PACKAGES.md`):

```
api/v1/packages/<name>.json            latest metadata
api/v1/packages/<name>/<version>.json  pinned metadata
api/v1/packages/                       directory listing (file:// search)
packages/<name>-<version>.yzp          archives (SHA-256 verified)
```

Metadata JSON: `name`, `version`, `archive` (relative or absolute URL),
`sha256` (hex), `size` (bytes), `license`, `dependencies` (name->spec).
