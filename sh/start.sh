#!/bin/sh
# dev/start.sh

DIR="$PWD"
GEDDY="`which geddy`"

# run app server
forever --spinSleepTime 1 --minUptime 1 --workingDir "$DIR" --uid "yify-pop" --append start $GEDDY
