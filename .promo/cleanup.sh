#!/usr/bin/env bash
# Removes the player-app link start.sh made — never a real deployment's folder.
[[ -L server/public-player ]] && rm -f server/public-player
true
