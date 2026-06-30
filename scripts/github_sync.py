#!/usr/bin/env python3
"""Python 보조 경로 — gh CLI 가 없는 환경에서 회의록 할 일을 GitHub 에 반영.

표준 라이브러리만 사용(urllib). 인증: 환경변수 GITHUB_TOKEN (repo + project 스코프).
설정: scripts/config.env (OWNER/PROJECT_NUMBER/REPO/PROJECT_TITLE/DEFAULT_LABELS),
       또는 동명 환경변수로 override.

사용:
    GITHUB_TOKEN=ghp_xxx python github_sync.py <YYYY-MM-DD | summary.md> [--yes]
기본 dry-run. --yes 로 실제 생성. gh 의 create_issues.sh 와 동작을 맞춘다(멱등·중복방지).
"""
import os, sys, json, argparse, datetime
import urllib.request, urllib.error, urllib.parse
from parse_actions import parse_actions

API = "https://api.github.com"
GQL = "https://api.github.com/graphql"


def load_config():
    cfg = {}
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, "config.env")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            cfg[k.strip()] = v.split("#")[0].strip().strip('"').strip("'")
    # 환경변수 override
    for k in ("OWNER", "PROJECT_NUMBER", "REPO", "PROJECT_TITLE", "DEFAULT_LABELS"):
        if os.environ.get(k):
            cfg[k] = os.environ[k]
    return cfg


def _req(url, token, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", f"Bearer {token}")
    r.add_header("Accept", "application/vnd.github+json")
    r.add_header("X-GitHub-Api-Version", "2022-11-28")
    try:
        with urllib.request.urlopen(r) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f"GitHub API {e.code}: {e.read().decode()[:300]}")


def gql(token, query, variables):
    return _req(GQL, token, "POST", {"query": query, "variables": variables})


def issue_exists(token, repo, title):
    q = urllib.parse.quote(f'repo:{repo} in:title type:issue "{title}"')
    res = _req(f"{API}/search/issues?q={q}", token)
    return any(it.get("title") == title for it in res.get("items", []))


def project_meta(token, owner, number):
    """user→org 순으로 ProjectV2 id + 단일선택 필드(옵션) 조회."""
    q = """query($owner:String!,$n:Int!){
      %s(login:$owner){ projectV2(number:$n){ id
        fields(first:50){ nodes{ ... on ProjectV2SingleSelectField{ id name options{ id name } } } } } } }"""
    for scope in ("user", "organization"):
        res = gql(token, q % scope, {"owner": owner, "n": int(number)})
        node = (res.get("data") or {}).get(scope)
        if node and node.get("projectV2"):
            return node["projectV2"]
    return None


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    ap = argparse.ArgumentParser()
    ap.add_argument("source", help="YYYY-MM-DD 또는 summary.md 경로")
    ap.add_argument("--yes", action="store_true", help="실제 생성(기본 dry-run)")
    a = ap.parse_args(argv)

    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        sys.exit("GITHUB_TOKEN 환경변수가 필요합니다.")
    cfg = load_config()
    owner, repo = cfg["OWNER"], cfg["REPO"]
    labels = [x for x in cfg.get("DEFAULT_LABELS", "").split(",") if x]

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = a.source
    if len(src) == 10 and src[4] == "-" and src[7] == "-":
        src = os.path.join(root, "meetings", "summary", f"{src}_meeting.md")
    if not os.path.exists(src):
        sys.exit(f"회의록 요약 없음: {src}")

    items = parse_actions(open(src, encoding="utf-8").read())
    if not items:
        print("## 할 일 항목이 없습니다.")
        return 0

    print(f"회의록: {src}")
    print(f"대상  : {repo} / {cfg.get('PROJECT_TITLE')} (#{cfg['PROJECT_NUMBER']}, owner={owner})")
    print(f"──────── 제안된 변경 ({'APPLY' if a.yes else 'dry-run'}) ────────")

    proj = project_meta(token, owner, cfg["PROJECT_NUMBER"]) if a.yes else None
    created, skipped = [], []
    for i, it in enumerate(items, 1):
        title = it["title"]
        if issue_exists(token, repo, title):
            print(f"{i}. [건너뜀] \"{title}\" — 이미 이슈 존재")
            skipped.append(title)
            continue
        print(f"{i}. [이슈 생성] \"{title}\"  labels: {','.join(labels)}")
        for k in ("assignee", "due", "priority"):
            if it[k]:
                print(f"     {k}: {it[k]}")
        if not a.yes:
            continue
        body = (f"회의록에서 도출된 할 일.\n- 담당: {('@'+it['assignee']) if it['assignee'] else ''}\n"
                f"- 마감: {it['due']}\n- 우선순위: {it['priority']}\n- 출처: {os.path.basename(src)}")
        issue = _req(f"{API}/repos/{repo}/issues", token, "POST",
                     {"title": title, "body": body, "labels": labels})
        print(f"     ✓ 생성: {issue['html_url']}")
        if proj:
            add = gql(token,
                      "mutation($p:ID!,$c:ID!){addProjectV2ItemById(input:{projectId:$p,contentId:$c}){item{id}}}",
                      {"p": proj["id"], "c": issue["node_id"]})
            iid = (((add.get("data") or {}).get("addProjectV2ItemById") or {}).get("item") or {}).get("id")
            if iid:
                _set_field(token, proj, iid, "Status", "Todo")
                if it["priority"]:
                    _set_field(token, proj, iid, "Priority", it["priority"])
        created.append({"title": title, "url": issue["html_url"]})
    print("──────────────────────────────────────────────")

    if not a.yes:
        print("(dry-run) 적용하려면 --yes 를 붙여 다시 실행하세요.")
        return 0
    outdir = os.path.join(root, "outputs", datetime.date.today().isoformat())
    os.makedirs(outdir, exist_ok=True)
    rep = {"project": cfg.get("PROJECT_TITLE"), "created": created, "skipped": skipped}
    json.dump(rep, open(os.path.join(outdir, "git-sync.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    print(f"리포트: {os.path.join(outdir, 'git-sync.json')}")
    return 0


def _set_field(token, proj, item_id, field_name, option_name):
    field = next((f for f in proj["fields"]["nodes"] if f.get("name") == field_name), None)
    if not field:
        print(f"     (필드 '{field_name}' 없음 — 건너뜀)"); return
    opt = next((o for o in field.get("options", []) if o["name"] == option_name), None)
    if not opt:
        print(f"     (옵션 '{option_name}' 없음 — 건너뜀)"); return
    gql(token,
        """mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){updateProjectV2ItemFieldValue(input:{
            projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){projectV2Item{id}}}""",
        {"p": proj["id"], "i": item_id, "f": field["id"], "o": opt["id"]})
    print(f"     ✓ {field_name} → {option_name}")


if __name__ == "__main__":
    sys.exit(main())
