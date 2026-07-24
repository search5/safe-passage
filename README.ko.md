# SafePassage

[English](README.md) | [한국어](README.ko.md)

📖 전체 문서: [https://search5.github.io/safe-passage/](https://search5.github.io/safe-passage/)

SafePassage는 Obsidian을 위한 안전하고 가벼우며 고성능인 KeePass 연동 플러그인입니다. 로컬 KeePass 데이터베이스(`.kdbx`)를 연결하여 마스킹된 자격 증명 칩과 구조화된 표를 노트 안에 직접 렌더링하면서도 마스터 비밀번호는 안전하게 보호합니다.

---

## ✨ 주요 기능

- **고성능 WebAssembly 엔진**: WASM 기반 Argon2를 사용해 KeePass 데이터베이스를 매우 빠르게 복호화하여, UI 멈춤이나 메모리 부족(OOM) 문제 없이 동작합니다.
- **크로스 플랫폼 지원 (데스크톱 & 모바일)**: 데이터베이스와 키 파일을 Obsidian 자체 Vault API를 통해 읽고 쓰기 때문에, 동일한 Vault 상대 경로가 데스크톱과 모바일(iOS/Android)에서 동일하게 동작합니다.
- **안전한 마스터 키링**: 마스터 비밀번호를 보호된 세션 메모리에 캐싱하여, 보호된 노트를 열 때 자동으로 잠금 해제할 수 있습니다.
- **마스킹된 인라인 칩**: `` `{{sp:profile/path#field}}` `` 태그를 클릭 한 번으로 값을 복사할 수 있는 세련된 원형 마스킹 칩으로 자동 변환합니다. 클립보드 자동 삭제 시간도 설정할 수 있습니다.
- **인터랙티브 자격 증명 표**: 코드 블록을 사용해 자격 증명 그룹 전체를 표로 렌더링하며, 제목과 동적 인라인 조회를 자유롭게 커스터마이징할 수 있습니다.
- **엔드투엔드 쓰기 명령**: `Insert Secret` 명령 팔레트를 통해 새 비밀 정보를 KeePass 데이터베이스에 즉시 저장하고, 백틱으로 감싼 토큰을 자동 완성합니다.

---

## 🚀 설치 및 설정

1. **플러그인 설치**: `npm run build`로 플러그인을 빌드한 뒤 `main.js`, `manifest.json`, `styles.css`를 Vault의 `.obsidian/plugins/safe-passage/` 디렉터리에 복사합니다.
2. **데이터베이스 프로필 설정**:
   - Obsidian 설정 -> **SafePassage** 로 이동합니다.
   - **Add New Profile**을 클릭합니다.
   - 다음 항목을 입력합니다:
     - **Profile Name**: 알아보기 쉬운 이름 (예: `work-db`).
     - **Database File Path**: `.kdbx` 파일 경로, 현재 Vault 기준 상대 경로 (예: `Secrets/vault.kdbx`).
     - **Key File Path (선택)**: `.key` 또는 `.keyx` 파일 경로, 현재 Vault 기준 상대 경로.
     - **Session Expiry Lifetime**: 메모리 세션 만료 시점 설정 (예: 즉시 잠금, 5분, 15분, 또는 영구).

---

## 💡 사용 방법

### 1. 마스킹된 인라인 칩
노트 어디서든 백틱으로 감싼 자격 증명 토큰을 삽입할 수 있습니다:
```markdown
My twitter password is `{{sp:work-db/SNS/Twitter#Password}}` and the username is `{{sp:work-db/SNS/Twitter#UserName}}`.
```
- **잠금 상태**: `work-db: Twitter#Password (🔒)` 형태로 표시됩니다. 클릭하면 비밀번호 잠금 해제 모달이 열립니다.
- **잠금 해제 상태**: 마스킹된 칩(`••••••••`)으로 표시됩니다. 클릭하면 값이 클립보드에 복사됩니다.

### 2. 자격 증명 표
`safe-passage` 마크다운 코드 블록을 사용해 구조화된 표를 렌더링합니다:
```yaml
```safe-passage
title: "Production Servers Access Control"
profile: work-db
fields: [UserName, Password, URL]
entries:
  - SSH-Prod/[Prod] bastion
  - AWS/Admin
```
```
이렇게 하면 각 필드에 대한 열과 항목별 복사 버튼이 포함된 세련된 표가 렌더링됩니다.

### 3. 새 자격 증명 추가 (쓰기 지원)
1. 명령 팔레트를 엽니다 (`Cmd + P` 또는 `Ctrl + P`).
2. **`SafePassage: Insert Secret`** 을 검색하여 실행합니다.
3. 프로필을 선택하고, 항목 경로(예: `Database/MySQL`)를 입력한 뒤 자격 증명을 입력합니다. **[Generate]** 버튼을 사용하면 16자리 강력한 비밀번호를 즉시 생성할 수 있습니다.
4. **[Save]** 를 클릭합니다. 자격 증명이 실제 `.kdbx` 파일에 바로 저장되며, 커서 위치에 `` `{{sp:work-db/Database/MySQL#Password}}` `` 토큰이 자동으로 삽입됩니다.

---

## 🔒 보안 설계

- **평문 저장 없음**: 마스터 비밀번호와 데이터베이스 버퍼는 디스크에 평문으로 저장되지 않습니다.
- **메모리 안전성**: 복호화된 데이터베이스 인스턴스는 일시적인 JavaScript 힙에 저장되며, 세션 타임아웃 시 즉시 정리됩니다.
- **클립보드 정리**: 복사된 비밀 정보는 설정된 시간이 지나면 시스템 클립보드에서 자동으로 삭제됩니다.
- **읽기 전용 모드**: 프로필 설정에서 "Read-Only"를 활성화하면 중요한 데이터베이스에 대한 쓰기 작업을 차단할 수 있습니다.

---

## 🛠 개발자 명령어

로컬에서 코드베이스를 빌드하고 테스트하려면:

```bash
# 의존성 설치
npm install

# 빌드 실행
npm run build
```

---

## 📄 라이선스
이 프로젝트는 MIT 라이선스로 배포됩니다.
