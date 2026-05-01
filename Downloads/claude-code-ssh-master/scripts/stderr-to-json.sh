#!/bin/bash
# Converts stderr lines to Railway-compatible structured JSON on stdout.
# Usage: command 2>&1 >/dev/null | stderr-to-json.sh
#    or: some-command 2> >(stderr-to-json.sh)
# Reads lines from stdin, outputs: {"level":"info","message":"..."}
while IFS= read -r line; do
    # Escape backslashes and double quotes for valid JSON
    line="${line//\\/\\\\}"
    line="${line//\"/\\\"}"
    printf '{"level":"info","message":"%s"}\n' "$line"
done
