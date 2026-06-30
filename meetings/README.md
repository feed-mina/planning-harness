# meetings/ — 회의록 (raw는 비공개)

회의록 파이프라인의 작업 공간입니다.

```
meetings/
├── raw/                 STT 원문 (.txt) — git 추적 안 함, 절대 커밋 금지
└── summary/             요약본 (YYYY-MM-DD_meeting.md) — 추적 가능
```

## 흐름
1. 녹음 → STT → `meetings/raw/YYYY-MM-DD_meeting.txt`
2. 요약 → `meetings/summary/YYYY-MM-DD_meeting.md` ([templates/meeting_template.md](../templates/meeting_template.md) 기반)
3. 요약본의 `## 할 일` 파싱 → `/git-project-sync` → Issues + Project

## 규칙
- **`raw/` 의 원문은 절대 커밋하지 않는다** (`.gitignore` 처리됨). 민감정보 보호.
- 외부 서비스(이슈 본문·커밋 메시지 등)에 회의록 원문을 그대로 노출하지 않는다.
- 요약본은 검토 후 추적 가능 — 단, 민감정보는 제거.
