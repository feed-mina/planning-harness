#!/usr/bin/env bash
# 현재 보드를 출력 (각 항목의 Status / Priority).
# (KIBA board.sh 이식 — config.env 로 일반화)
set -euo pipefail
_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$_DIR/lib.sh"
require_gh

echo "── $PROJECT_TITLE  (owner=$OWNER, project #$PROJECT_NUMBER) ──"
gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --limit 200 --format json --jq \
  '.items | sort_by(.priority, .title)[]
   | "  " + (.title | .[0:48]) + "  [" + (.status // "-") + " / " + (.priority // "-") + "]"'
