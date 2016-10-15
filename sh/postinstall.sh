#!/bin/sh
# dev/postinstall.sh

DIR="$PWD"
GEDDY="`which geddy`"

# go to app dir
cd "$DIR"

# generate secrets
echo "{}" > config/secrets.json
geddy gen secret
