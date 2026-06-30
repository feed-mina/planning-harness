#!/usr/bin/env bash
# 회의록 요약의 `## 할 일` → GitHub Issues + Project 추가.
#   create_issues.sh <YYYY-MM-DD | summary.md 경로> [--yes]
# 기본 dry-run: 제안 목록만 출력. --yes 로 실제 생성.
# 멱등: 같은 제목 이슈가 이미 있으면 건너뜀(중복 방지).
set -euo pipefail
_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$_DIR/lib.sh"
ROOT="$(cd "$_DIR/.." && pwd)"

ARG="${1:?usage: create_issues.sh <YYYY-MM-DD | summary.md> [--yes]}"; shift || true
APPLY=0
[[ "${1:-}" == "--yes" ]] && APPLY=1

# 입력 해석: 날짜면 표준 경로, 아니면 경로 그대로
if [[ "$ARG" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  SUMMARY="$ROOT/meetings/summary/${ARG}_meeting.md"
else
  SUMMARY="$ARG"
fi
[[ -f "$SUMMARY" ]] || { echo "회의록 요약 없음: $SUMMARY" >&2; exit 1; }

TODAY="$(date +%F)"
OUTDIR="$ROOT/outputs/$TODAY"; mkdir -p "$OUTDIR"

echo "회의록: $SUMMARY"
echo "대상  : $REPO  /  $PROJECT_TITLE (#$PROJECT_NUMBER, owner=$OWNER)"
echo

# 파싱 (TSV: title \t assignee \t due \t priority)
mapfile -t ROWS < <("$PYTHON" "$_DIR/parse_actions.py" "$SUMMARY" --format tsv)
[[ ${#ROWS[@]} -gt 0 ]] || { echo "## 할 일 항목이 없습니다."; exit 0; }

require_gh
RESULTS_CREATED=(); RESULTS_SKIPPED=()
n=0
echo "──────── 제안된 변경 ($([[ $APPLY -eq 1 ]] && echo APPLY || echo dry-run)) ────────"
for row in "${ROWS[@]}"; do
  IFS=$'\t' read -r TITLE ASSIGNEE DUE PRIO <<<"$row"
  [[ -n "$TITLE" ]] || continue
  n=$((n+1))
  # 중복 확인 (제목 일치)
  EXISTS="$(gh issue list --repo "$REPO" --state all --search "\"$TITLE\" in:title" --json title --jq '.[].title' 2>/dev/null | grep -Fx "$TITLE" || true)"
  if [[ -n "$EXISTS" ]]; then
    echo "$n. [건너뜀] \"$TITLE\" — 이미 이슈 존재"
    RESULTS_SKIPPED+=("$TITLE")
    continue
  fi
  echo "$n. [이슈 생성] \"$TITLE\"  labels: $DEFAULT_LABELS"
  [[ -n "$ASSIGNEE" ]] && echo "     담당: @$ASSIGNEE"
  [[ -n "$DUE"      ]] && echo "     마감: $DUE"
  [[ -n "$PRIO"     ]] && echo "     priority: $PRIO"
  echo "     → Project '$PROJECT_TITLE' 추가, Status=Todo"

  if [[ $APPLY -eq 1 ]]; then
    BODY="회의록에서 도출된 할 일.
- 담당: ${ASSIGNEE:+@}$ASSIGNEE
- 마감: $DUE
- 우선순위: $PRIO
- 출처: $(basename "$SUMMARY")"
    URL="$(gh issue create --repo "$REPO" --title "$TITLE" --body "$BODY" --label "$DEFAULT_LABELS")"
    echo "     ✓ 생성: $URL"
    ITEM_JSON="$(gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$URL" --format json)"
    IID="$(echo "$ITEM_JSON" | "$PYTHON" -c 'import sys,json;print(json.load(sys.stdin)["id"])')"
    set_field "$IID" Status Todo
    [[ -n "$PRIO" ]] && set_field "$IID" Priority "$PRIO"
    RESULTS_CREATED+=("$TITLE|$URL")
  fi
done
echo "──────────────────────────────────────────────"

if [[ $APPLY -ne 1 ]]; then
  echo "(dry-run) 승인 후 적용하려면 --yes 를 붙여 다시 실행하세요."
  exit 0
fi

# 결과 리포트 (outputs/<오늘>/git-sync.json)
{
  printf '{\n  "project": "%s",\n  "created": [' "$PROJECT_TITLE"
  for i in "${!RESULTS_CREATED[@]}"; do
    IFS='|' read -r t u <<<"${RESULTS_CREATED[$i]}"
    [[ $i -gt 0 ]] && printf ','
    printf '\n    {"title": %s, "url": "%s"}' "$("$PYTHON" -c 'import json,sys;print(json.dumps(sys.argv[1],ensure_ascii=False))' "$t")" "$u"
  done
  printf '\n  ],\n  "skipped": ['
  for i in "${!RESULTS_SKIPPED[@]}"; do
    [[ $i -gt 0 ]] && printf ','
    printf '\n    %s' "$("$PYTHON" -c 'import json,sys;print(json.dumps(sys.argv[1],ensure_ascii=False))' "${RESULTS_SKIPPED[$i]}")"
  done
  printf '\n  ]\n}\n'
} > "$OUTDIR/git-sync.json"
echo "리포트: $OUTDIR/git-sync.json"
