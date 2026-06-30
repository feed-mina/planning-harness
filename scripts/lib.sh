#!/usr/bin/env bash
# 공통 헬퍼: GitHub Project 의 노드 ID(PVT_/PVTSSF_/PVTI_…)를 사람이 읽는 이름에서
# 런타임에 해석한다. 호출부는 ID 를 하드코딩하지 않는다.
# 요구: `gh` (project 스코프), python3 또는 python.
# (KIBA project_management_with_ai_agent/scripts/lib.sh 를 일반화해 이식)
set -euo pipefail
_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$_LIB_DIR/config.env"

# Windows 콘솔 코드페이지(cp949 등)와 무관하게 python 입출력을 UTF-8 로 강제.
# (한글 제목이 cp949 로 인코딩돼 손상되는 것을 방지)
export PYTHONUTF8=1
export PYTHONIOENCODING=utf-8

# 실제로 실행되는 python 을 고른다. Windows 의 python3 는 Microsoft Store 더미
# 스텁일 수 있으므로 `-c` 실행이 성공하는 후보만 채택한다.
_detect_python() {
  local c
  for c in python3 python py; do
    if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys' >/dev/null 2>&1; then
      echo "$c"; return 0
    fi
  done
  return 1
}
PYTHON="${PYTHON:-$(_detect_python || true)}"
[[ -n "$PYTHON" ]] || { echo "동작하는 python3/python 이 필요합니다." >&2; exit 1; }

require_gh() {
  command -v gh >/dev/null 2>&1 || { echo "gh CLI 가 필요합니다 (또는 scripts/github_sync.py 보조 경로 사용)." >&2; exit 1; }
  gh auth status >/dev/null 2>&1 || { echo "gh 미인증: 'gh auth login' 후 다시 시도하세요." >&2; exit 1; }
}

_fields_json() { gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json; }
_items_json()  { gh project item-list  "$PROJECT_NUMBER" --owner "$OWNER" --limit 200 --format json; }

project_id() { gh project view "$PROJECT_NUMBER" --owner "$OWNER" --format json --jq '.id'; }

# field_id "<Field Name>"
field_id() {
  _fields_json | "$PYTHON" -c "import sys,json
d=json.load(sys.stdin)['fields']
m=[f for f in d if f['name']==sys.argv[1]]
if not m: sys.exit('no field named: '+sys.argv[1])
print(m[0]['id'])" "$1"
}

# option_id "<Field Name>" "<Option Name>"
option_id() {
  _fields_json | "$PYTHON" -c "import sys,json
d=json.load(sys.stdin)['fields']
f=[x for x in d if x['name']==sys.argv[1]][0]
m=[o for o in f.get('options',[]) if o['name']==sys.argv[2]]
if not m: sys.exit('no option %r in field %r'%(sys.argv[2],sys.argv[1]))
print(m[0]['id'])" "$1" "$2"
}

# item_id "<title substring>" — 0개/2개 이상이면 에러 (조용한 추측 금지)
item_id() {
  _items_json | "$PYTHON" -c "import sys,json
subs=sys.argv[1]
items=json.load(sys.stdin)['items']
m=[i for i in items if subs in i.get('title','')]
if not m: sys.exit('no item matches: '+subs)
if len(m)>1: sys.exit('ambiguous (%d matches) for: %s'%(len(m),subs))
print(m[0]['id'])" "$1"
}

# set_field <item-id> <Field> <Option>  — 필드/옵션 없으면 경고만 하고 건너뜀(멱등·관용)
set_field() {
  local iid="$1" field="$2" opt="$3" pid fid oid
  pid="$(project_id)"
  fid="$(field_id "$field" 2>/dev/null)" || { echo "  (필드 '$field' 없음 — 건너뜀)"; return 0; }
  oid="$(option_id "$field" "$opt" 2>/dev/null)" || { echo "  (옵션 '$opt' 없음 — 건너뜀)"; return 0; }
  gh project item-edit --id "$iid" --project-id "$pid" --field-id "$fid" --single-select-option-id "$oid" >/dev/null
  echo "  ✓ $field → $opt"
}
