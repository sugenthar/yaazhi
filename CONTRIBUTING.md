# Contributing to Yaazhi

## Clone and build

```sh
git clone https://github.com/sugenthar/yaazhi-code
cd yaazhi-code
cmake -S compiler -B compiler/build -DCMAKE_BUILD_TYPE=Release
cmake --build compiler/build
bash build_runtime.sh   # -> runtime/build/yaazhi_run.lnx
```

## Run tests

```sh
cd test && ./run.sh
./http/run_http.sh
./db/run_db.sh
cd ../vscode-extension && npm test
```

## Make changes

- Keep Tamil syntax; do not rename working APIs without reason.
- Keep `NBC v1` compatibility unless a versioned migration is agreed.
- Update `examples/` + docs together so they never drift from behaviour.
- Verify every documented command by running it (`yaazhi --help` is truth).

## Submit

- Open an issue first for large changes.
- Pull requests: small, tested, with updated docs/examples where relevant.
- Never commit secrets, tokens, local paths, or build intermediates.
