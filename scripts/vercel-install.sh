#!/bin/sh
set -e
cat \
  bundle/source.part.00 \
  bundle/source.part.01 \
  bundle/source.part.02 \
  bundle/source.part.03 \
  bundle/source.part.04 \
  bundle/source.part.05 \
  bundle/source.part.06.00 \
  bundle/source.part.06.01 \
  bundle/source.part.07.00 \
  bundle/source.part.07.01 \
  | base64 --decode --ignore-garbage > /tmp/degens-source.tgz

tar -tzf /tmp/degens-source.tgz >/dev/null
tar -xzf /tmp/degens-source.tgz -C .
npm install --no-audit --no-fund
