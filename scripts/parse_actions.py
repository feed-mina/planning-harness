#!/usr/bin/env python3
"""회의록 요약(md)의 `## 할 일` 섹션을 구조화 항목으로 파싱한다.

라인 형식 (유연하게 처리):
    - [ ] <할 일> — @담당자 ~YYYY-MM-DD [priority:High|Medium|Low]
- 체크된 `- [x]` 는 기본 제외(완료로 간주). --include-done 으로 포함.
- 메타(@담당자 / ~마감 / priority)는 모두 선택. 없으면 빈 값.

사용:
    python parse_actions.py <summary.md> [--format json|tsv] [--include-done]
gh 경로(create_issues.sh)와 Python 보조 경로(github_sync.py)가 공유한다.
"""
import sys, re, json, argparse

_SECTION = re.compile(r'^\s*##\s*할\s*일', re.IGNORECASE)
_NEXT_H2 = re.compile(r'^\s*##\s+')
_ITEM = re.compile(r'^\s*[-*]\s*\[(?P<done>[ xX])\]\s*(?P<rest>.+?)\s*$')
_PRIORITY = re.compile(r'\[?priority:\s*(High|Medium|Low)\]?', re.IGNORECASE)
_ASSIGNEE = re.compile(r'@([\w./-]+)')
_DUE = re.compile(r'~\s*(\d{4}-\d{2}-\d{2})')


def parse_actions(text, include_done=False):
    lines = text.splitlines()
    in_section = False
    out = []
    for ln in lines:
        if _SECTION.match(ln):
            in_section = True
            continue
        if in_section and _NEXT_H2.match(ln):
            break
        if not in_section:
            continue
        m = _ITEM.match(ln)
        if not m:
            continue
        if m.group('done').strip().lower() == 'x' and not include_done:
            continue
        rest = m.group('rest')
        # 제목 = 첫 구분자(— 또는 -- ) 앞. 구분자 없으면 메타만 떼고 전체가 제목.
        title_part = re.split(r'\s+[—–]\s+|\s+--\s+', rest, maxsplit=1)
        title = title_part[0].strip()
        meta = title_part[1] if len(title_part) > 1 else ''
        # 제목에 메타 토큰이 섞여 있으면(구분자 미사용) 제목에서도 떼어낸다.
        scan = rest if not meta else meta
        prio = _PRIORITY.search(scan)
        assignee = _ASSIGNEE.search(scan)
        due = _DUE.search(scan)
        if not meta:
            # 구분자가 없던 경우 제목에서 메타 토큰 제거
            title = _PRIORITY.sub('', title)
            title = _ASSIGNEE.sub('', title)
            title = _DUE.sub('', title).strip(' -—–')
        out.append({
            'title': title,
            'assignee': assignee.group(1) if assignee else '',
            'due': due.group(1) if due else '',
            'priority': prio.group(1).capitalize() if prio else '',
        })
    return out


def main(argv=None):
    # Windows 콘솔(cp949)에서도 UTF-8 로 출력 (한글 손상 방지)
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    ap = argparse.ArgumentParser()
    ap.add_argument('file')
    ap.add_argument('--format', choices=['json', 'tsv'], default='json')
    ap.add_argument('--include-done', action='store_true')
    a = ap.parse_args(argv)
    with open(a.file, encoding='utf-8') as f:
        items = parse_actions(f.read(), include_done=a.include_done)
    if a.format == 'json':
        print(json.dumps(items, ensure_ascii=False, indent=2))
    else:
        for it in items:
            print('\t'.join([it['title'], it['assignee'], it['due'], it['priority']]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
