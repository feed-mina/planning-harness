#!/usr/bin/env bash
# 보드의 한 항목을 조정 (제안 → 승인 → 적용 → 보고 루프).
#   reconcile.sh "<제목 일부>" [--status "<Status>"] [--priority <High|Medium|Low>] \
#                [--source "<근거가 된 회의록 라인>"] [--yes]
# 기본은 dry-run (제안만 출력). --yes 를 붙여야 실제로 쓴다.
# (KIBA reconcile.sh 이식 — lib.sh 의 set_field 사용)
set -euo pipefail
_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$_DIR/lib.sh"

TITLE="${1:?usage: reconcile.sh \"<제목>\" [--status S] [--priority P] [--source Q] [--yes]}"
shift
STATUS=""; PRIORITY=""; SOURCE=""; APPLY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --status)   STATUS="$2";   shift 2;;
    --priority) PRIORITY="$2"; shift 2;;
    --source)   SOURCE="$2";   shift 2;;
    --yes)      APPLY=1;       shift;;
    *) echo "unknown arg: $1" >&2; exit 1;;
  esac
done

echo "──────────── 제안된 변경 ────────────"
echo "  항목      : $TITLE"
[[ -n "$STATUS"   ]] && echo "  Status   → $STATUS"
[[ -n "$PRIORITY" ]] && echo "  Priority → $PRIORITY"
[[ -n "$SOURCE"   ]] && echo "  근거      : $SOURCE"
echo "─────────────────────────────────────"

if [[ "$APPLY" -ne 1 ]]; then
  echo "(dry-run) 적용하려면 --yes 를 붙여 다시 실행하세요."
  exit 0
fi

require_gh
IID=$(item_id "$TITLE")
[[ -n "$STATUS"   ]] && set_field "$IID" Status   "$STATUS"
[[ -n "$PRIORITY" ]] && set_field "$IID" Priority "$PRIORITY"
echo "완료."
