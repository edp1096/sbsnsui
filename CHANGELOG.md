# Stellar Blade Nanosuit Converter - Development Log

## 프로젝트 개요
스텔라블레이드 모드용 `.dekcns.json` 파일 관리 유틸리티

## 2026-01-11 - Toast Notification 완성 ✅

### Settings 탭 Alert → Toast 변환
- **모든 Alert 제거**
  - 경로 선택 에러 (디렉토리/파일)
  - 설정 저장 성공/실패
  - 설정 리셋 성공/실패
  - 탐색기 열기 에러
- **showToast 메서드 추가** (settings.js)
  - SelectionManager와 동일한 구현
  - 성공/에러 타입 지원

### Toast UI 개선
- **표시 위치 변경**
  - 기존: 우측 하단 (bottom-right)
  - 변경: 상단 중앙 (top-center)
  - 더 눈에 잘 띄고 덜 방해되는 위치
- **애니메이션 변경**
  - 기존: 좌우 슬라이드 (translateX)
  - 변경: 상하 슬라이드 (translateY)
  - 위에서 아래로 부드럽게 나타남

### 기술 구현
- CSS: .toast-container (top: 20px, left: 50%, transform: translateX(-50%))
- 애니메이션: slideIn/slideOut (translateY -100px ↔ 0)
- 3초 후 자동 사라짐

---

## 2026-01-11 - Advanced Configuration UI 개선 ✅

### Left Pane 토글 방식 변경
- **Advanced Configuration 패널 위치 변경**
  - 기존: Right panel 하단에 표시
  - 변경: Left panel에서 토글 방식으로 표시
  - 편집 패널 열릴 때 character content, controls 숨김
  - 닫기 버튼(✕) 클릭 시 원래 화면 복원

### UI/UX 개선
- **더 넓은 편집 공간**
  - Left panel 전체를 사용하여 더 많은 설정 표시 가능
  - Flex layout으로 화면 크기에 맞춰 자동 조정
  - 스크롤 가능한 content 영역

### 기술 구현
- openUserConfigsPanel(): 다른 요소 숨김 처리
- closeUserConfigsPanel(): 원래 요소 복원
- CSS flex layout 적용

---

## 2026-01-11 - 이전 설정 복원 기능 ✅

### 자동 상태 복원
- **프로그램 시작 시 이전 설정 자동 로드**
  - sns.settings.json 파일이 존재하면 자동으로 읽기
  - Enabled, ShowPonytail 전역 옵션 복원
  - Replacements 배열에서 UniqueFitID 기반으로 항목 복원
  - 각 항목의 enabled (ON/OFF) 상태 복원
  - 순서 유지 (Replacements 배열 순서대로)

### 기술 구현
- **loadPreviousConfiguration() 메서드** (selection.js:985-1062)
  - outputPath 설정 확인
  - sns.settings.json 파일 읽기 및 파싱
  - UniqueFitID로 DB에서 파일 검색
  - selectedItems 배열 재구성
  - UI 자동 업데이트 (체크박스/라디오 버튼)

### 에러 처리
- 파일 없음, 파싱 실패 등 에러는 조용히 무시
- UniqueFitID로 파일을 찾지 못한 경우 해당 항목만 스킵
- 프로그램 시작에 영향 없음

---

## 2026-01-11 - Settings 화면 개선 ✅

### Path Validation UI 개선
- **Inline Validation**
  - Path Validation 섹션 제거 (별도 섹션 불필요)
  - 각 경로 입력 필드 아래에 validation 상태 inline 표시
  - 더 간결하고 직관적인 UI

### 탐색기 열기 기능
- **Browse 버튼 옆에 📂 버튼 추가**
  - Scan Directory: 폴더 바로 열기
  - SNS Settings Output Path: 부모 디렉토리 열기
  - 경로가 유효할 때만 버튼 활성화
- **크로스 플랫폼 지원**
  - Windows: explorer.exe
  - Linux: xdg-open
  - macOS: open
- **자동 경로 감지 및 정규화**

---

## 2026-01-11 - UserConfigs 편집 UI 구현 ✅

### 고급 설정 편집 기능
- **UserConfigs 편집 패널**
  - Selected Items에서 항목 클릭 시 편집 패널 열림
  - 5가지 설정 타입 완벽 지원
  - 실시간 값 변경 및 동기화

### 지원 설정 타입

#### 1. ShapeKeys (형태 키/모프 타겟)
- 슬라이더 + 숫자 입력 UI
- Min/Max/Step 범위 지원
- DisplayName, Description 표시
- 용도: 가슴 크기, 엉덩이 크기 등 신체 비율 조절

#### 2. MaterialToggles (재질 토글)
- 체크박스 UI
- MaterialIndex 정보 표시
- 용도: 특정 재질 표시/숨김

#### 3. ScalarControls (스칼라 파라미터)
- 슬라이더 + 숫자 입력 UI
- ParamName, MaterialIndex 정보 표시
- 용도: Metallic, Roughness 등 재질 속성 조절

#### 4. VectorControls (벡터/색상 파라미터)
- RGBA 슬라이더 4개
- 개별 Min/Max/Step 지원
- 용도: 의상 색상, 발광색 등 색상 조절

#### 5. TextureOptions (텍스처 옵션)
- 드롭다운 선택 UI
- OptionNames 목록 표시
- 용도: 여러 텍스처 변형 중 선택

### 기술 구현
- **데이터 참조**: UserConfigs 객체를 직접 수정 (복사 없음)
- **자동 저장**: Apply Settings 클릭 시 sns.settings.json에 자동 반영
- **슬라이더 동기화**: range 슬라이더와 number 입력 양방향 동기화
- **타입별 이벤트**: 각 설정 타입에 맞는 이벤트 핸들러

### UI/UX 개선
- 설정 섹션별 아이콘 추가 (🎭🎚️🎨👁️🖼️)
- 읽기 쉬운 레이아웃 (레이블, 설명, 값)
- 숫자 입력으로 정밀한 값 조정 가능
- 패널 닫기 버튼 (✕)

---

## 2026-01-11 - 전체 구현 완료 (Phase 1-4)

### Phase 4: mod 연동 (Integration) ✅
- **저장 후 F9 안내 메시지**
  - 상세한 저장 성공 메시지
  - 파일 위치, 항목 수 표시
  - F9 리로드 가이드 포함
- **리로드 플래그 파일 생성 옵션**
  - sns.reload.flag 파일 자동 생성
  - 타임스탬프 포함
  - mod가 파일 변경을 감지하도록 지원
- **UI에 F9 키 안내 표시**
  - Selected Items 패널에 리로드 가이드 추가
  - 키보드 단축키 스타일 표시

### UI 개선 ✅
- **헤더 크기 축소 (1차)**
  - 타이틀: 28px → 20px
  - 서브타이틀: 14px → 12px
  - 패딩: 20px → 12px
- **헤더 완전 제거 및 About 탭 추가 (2차)**
  - 메인 헤더 완전 제거 (홈페이지가 아니므로 불필요)
  - 탭을 상단으로 이동 (Files / Settings / About)
  - About 화면 구성:
    - 프로젝트 정보 (이름, 버전 v0.0.1, 설명)
    - Quick Start 가이드 (7단계)
    - 참고 링크 (SNS Mod, CNS Mod, CNS Docs)
    - Thanks (vlad0337187, Dekita)
    - 라이센스 정보 (CC BY-NC-SA 4.0)
- **윈도우 크기 설정 (3차)**
  - 초기 크기: 920x768
  - 최소 크기: 800x600
  - 윈도우 타이틀: "Stellar Blade Nanosuit Converter"

---

## 2026-01-11 - Phase 1-3 구현

### Phase 1: 설정 화면 (Settings Tab) ✅
- 탭 구조 추가 (Files / Settings)
- 스캔 폴더 경로 설정 (dekcns.json 파일들)
- sns.settings.json 출력 경로 설정
- 경로 검증 기능
- Neutralino Storage에 설정 저장/로드

### Phase 2: 선택 UI (Selection) ✅
- **캐릭터별 탭**: EVE, ADAM, LILY, DRONE
- **FitMeshType별 섹션 구분**
  - 라디오 버튼 (단일 선택): BODY, FACE, HAIR, WEAPON
  - 체크박스 (다중 선택): PONYTAIL, EARS, EYES
- **포니테일 식별**: FitMeshType="Hair" + MeshSubType="PonyTail"
- **Selected Items 패널**
  - 선택된 항목 목록 표시
  - Drag & Drop으로 순서 변경 (Replacements 배열 순서)
  - 개별 항목 Enable/Disable 토글
  - 삭제 버튼
- **전역 옵션**: Enabled, ShowPonytail 체크박스

### Phase 3: 저장 기능 (Save Configuration) ✅
- sns.settings.json 생성 및 저장
- dekcns.json → sns.settings.json 형식 변환
- UniqueFitID 추출
- UserConfigs 자동 포함
- Enabled 필드 처리
- 파일 덮어쓰기 (항상 새로 생성)

### 기술 구현 상세

#### 데이터 구조
```javascript
// Selected Items
{
  file: {...},     // DB에서 로드한 파일 객체
  enabled: true,   // ON/OFF 상태
  order: 0         // 순서 (Drag & Drop)
}

// Output sns.settings.json
{
  "Enabled": true,
  "ShowPonytail": true,
  "Replacements": [
    { "UniqueFitID": "..." },
    { "UniqueFitID": "...", "Enabled": false },
    { "UniqueFitID": "...", "UserConfigs": {...} }
  ]
}
```

#### 파일 구조
```
resources/
├── js/
│   ├── settings.js      # 설정 관리
│   ├── selection.js     # 선택 UI 및 저장
│   ├── db.js            # 데이터베이스
│   ├── fileScanner.js   # 파일 스캔
│   └── main.js          # 앱 초기화
├── index.html           # 메인 UI (탭 구조)
└── styles.css           # 전체 스타일
```

### 알려진 제한사항
- Phase 4 (mod 연동) 미구현
- UserConfigs 상세 편집 UI 없음 (있는 그대로 복사)
- 썸네일/프리뷰 이미지 미지원

---

## 2026-01-11 - 초기 개발

### 구현된 기능

#### 1. 데이터베이스 시스템 (SQLite + sql.js)
- **sql.js (WebAssembly SQLite)** 통합
- 브라우저 내에서 SQLite 데이터베이스 실행
- Neutralino Storage API를 통한 영구 저장
- Base64 인코딩/디코딩으로 바이너리 데이터 저장

**주요 이슈 해결:**
- **문제**: DB 로드 후 테이블이 사라지는 현상
- **원인**: `base64ToArrayBuffer()`가 ArrayBuffer를 반환했으나 SQL.js는 Uint8Array 필요
- **해결**: Uint8Array를 직접 반환하도록 수정
- **결과**: 데이터 영속성 정상 작동 확인

#### 2. 파일 스캔 시스템
- **재귀적 디렉토리 탐색** 구현
- `*.dekcns.json` 패턴 매칭 (대소문자 구분 없음)
- 경로 정규화 (Windows/Linux 호환)
- 진행 상황 표시 (스캔 → 발견 → 가져오기 → 완료)

**주요 이슈 해결:**
- **문제 1**: 파일 확장자 오타 (deckcns vs dekcns)
- **해결**: `.dekcns.json`으로 통일
- **문제 2**: JSON 파싱 실패 (trailing comma)
- **해결**: `fixJsonString()` 함수로 자동 수정

#### 3. 데이터 분류 시스템
- **CharacterID 기반 분류**: EVE, ADAM, LILY, DRONE
  - JSON 배열 첫 번째 요소에서 추출
  - 대문자로 정규화
  - 없으면 기본값 'EVE'

- **FitMeshType 기반 분류**: BODY, HAIRSKIN, COSTUMESKIN 등
  - JSON 배열 첫 번째 요소에서 추출
  - 대문자로 정규화
  - 없으면 기본값 'BODY' (UNKNOWN 대신)

#### 4. 필터링 UI
- **Character 필터**: 고정 순서 (EVE → ADAM → LILY → DRONE)
- **Mesh Type 필터**: 알파벳 순서
- **다중 필터 지원**: 두 필터 동시 적용 가능

#### 5. 파일 목록 표시
- **DisplayName 추출**: JSON 배열 첫 번째 요소의 DisplayName 사용
- **표시 형식**: "DisplayName / 파일명"
- **정렬**: DisplayName 기준 알파벳 순 (대소문자 구분 없음)

#### 6. 상세 정보 패널
- 파일명, 경로, 캐릭터, 메시 타입
- 생성/수정 시간
- 전체 JSON 내용 표시

### 데이터베이스 스키마

```sql
CREATE TABLE deckcns_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT UNIQUE NOT NULL,
    file_name TEXT NOT NULL,
    content TEXT NOT NULL,
    character_id TEXT DEFAULT 'EVE',
    fit_mesh_type TEXT DEFAULT 'BODY',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_file_path ON deckcns_files(file_path);
CREATE INDEX idx_file_name ON deckcns_files(file_name);
CREATE INDEX idx_character_id ON deckcns_files(character_id);
CREATE INDEX idx_fit_mesh_type ON deckcns_files(fit_mesh_type);
```

### 기술 스택
- **Frontend**: Vanilla JavaScript (ES6+)
- **Database**: sql.js (SQLite WASM)
- **Framework**: Neutralino.js v6.4.0
- **Storage**: Neutralino Storage API

### 파일 구조
```
my-app/
├── neutralino.config.json       # Neutralino 설정
├── resources/
│   ├── index.html               # 메인 UI
│   ├── styles.css               # 스타일시트
│   └── js/
│       ├── neutralino.js        # Neutralino 클라이언트
│       ├── sql-wasm.js          # SQL.js 라이브러리
│       ├── sql-wasm.wasm        # SQL.js WASM
│       ├── db.js                # 데이터베이스 관리
│       ├── fileScanner.js       # 파일 스캔 로직
│       └── main.js              # 메인 애플리케이션 로직
└── bin/                         # Neutralino 바이너리
```

### 향후 개발 예정 기능
- [ ] 게임 화면 캡처 및 썸네일 생성
- [ ] 파일 내보내기/가져오기
- [ ] 검색 기능
- [ ] 정렬 옵션 추가
- [ ] 파일 편집 기능

### 알려진 제한사항
- Chrome DevTools JSON 파일 누락 경고 (동작에 영향 없음)
- 대용량 디렉토리 스캔 시 시간 소요

### 성능
- 스캔 속도: ~150 파일/초
- DB 크기: ~600KB (73개 파일 기준)
- 로드 시간: <1초

---

**작성일**: 2026-01-11
**작성자**: Claude Sonnet 4.5
**버전**: 0.0.1
