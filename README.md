# Travel

My Travel Hub의 여행 정보를 읽는 React 앱입니다. 여행 데이터는 Notion에서 관리하고, 앱에서 최신 정보를 조회합니다.

## 로컬 실행

Node.js 24에서 아래 명령을 실행합니다.

```sh
npm ci
npm run dev
npm run lint
npm run build
npm test
```

테스트는 임시 인증 값을 생성하고 루프백에서 Vite HTTP 서버를 시작합니다. Notion 응답은 목을 사용하므로 테스트에 실제 토큰이 필요 없습니다.

## 관리자 인증과 배포

1. Git 이력에 노출된 기존 관리자 비밀번호를 폐기하고, 길고 무작위인 새 비밀번호를 설정합니다. 새 비밀번호를 표준 입력으로 `node scripts/hash-password.mjs`에 전달해 해시를 생성합니다.
2. `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`로 별도의 세션 서명 키를 생성합니다.
3. 로컬에서는 [.env.example](.env.example)을 참고해 `.env.local`에 `ADMIN_PASSWORD_HASH`와 `SESSION_SECRET`을 설정합니다. 배포할 때는 Vercel 프로젝트의 서버 환경변수로 등록합니다. 두 값에 `VITE_` 접두사를 붙이면 브라우저에 노출될 수 있습니다.
4. Vercel에서 Vite 프레임워크, 빌드 명령 `npm run build`, 출력 폴더 `dist`를 사용합니다. Vite 개발 미들웨어와 Vercel Node 함수 `api/auth.js`가 각각 `/api/auth`를 제공합니다. 배포 후 HTTPS에서 로그인과 로그아웃을 확인합니다. 정적 호스팅과 `vite preview`만으로는 이 API가 실행되지 않아 관리자 로그인에 실패합니다.

프로덕션 세션 쿠키는 `Secure`, `HttpOnly`, `SameSite=Strict`이며 1시간 후 만료됩니다. 쿠키가 유효하면 앱을 새로고침한 뒤에도 조회할 수 있습니다. 로그아웃은 브라우저의 쿠키를 삭제하며 이미 복제된 쿠키는 만료 시까지 유효합니다. 서명 키를 교체하면 기존 쿠키가 모두 무효화됩니다. 로그인 시도 제한은 실행 인스턴스별로 적용됩니다. 공개 운영 환경에서는 배포 계층의 공용 요청 제한을 추가로 구성해야 합니다.

## P1 Notion My Travel Hub 읽기 전용 연동

Notion을 여행 데이터의 원본으로 사용합니다. 생성, 수정, 삭제, 체크 상태 변경, 영수증 첨부는 모두 Notion에서 합니다. 앱에서는 조회와 필터링을 제공하고, 수정이 필요한 화면에는 해당 Notion 페이지를 여는 링크를 표시합니다. 앱에는 여행 데이터 편집과 내보내기 기능이 없습니다.

### 확인한 데이터 소스

My Travel Hub의 DB 7개를 조회해 아래 구조를 확인했습니다. 모든 하위 DB에는 여행 마스터를 가리키는 `여행` 관계가 있습니다.

| DB | 앱에서 읽을 항목 |
| --- | --- |
| 여행 마스터 | 여행명, 여행지, 여행기간, 상태, 메모, 총예산·총지출·잔여예산 |
| 여행 일정 | 일정명, 일시, 구분, 장소, 진행상태 |
| 예약 관리 | 예약명, 예약유형, 예약상태, 이용일, 결제상태 |
| 예산 관리 | 예산항목, 분류, 예산 KRW, 사용금액, 잔액 |
| 지출 내역 | 지출명, 분류, 결제일, 현지 금액·통화, 원화 확정액, 집계 금액 |
| 영수증 관리 | 영수증명, 처리상태, 연결된 지출, Notion 페이지 링크 |
| 여행 체크리스트 | 할 일, 분류, 상태, 단계, 기한 |

별도 메모·장소 DB는 확인한 7개에 포함되지 않습니다. 여행 마스터의 메모와 일정의 장소를 사용하고, 정보가 비어 있으면 빈 상태를 표시합니다. 예산과 지출 합계는 Notion의 KRW 롤업·수식 값을 기준으로 표시합니다. 현지 금액과 통화는 별도로 표시하고 P0의 JPY 환율로 다시 계산하지 않습니다.

### 조회 API와 접근 범위

1. 앱은 같은 출처의 `GET /api/trips`와 `GET /api/trips/:tripId`로 조회합니다. 서버는 읽기 권한만 부여된 Notion 통합 토큰과 허용된 7개 데이터 소스 ID를 서버 환경변수로 관리합니다. Notion의 [데이터 소스 조회 API](https://developers.notion.com/reference/query-a-data-source)는 HTTP POST를 사용하지만 데이터 변경을 수행하지 않습니다.
2. 여행 ID는 여행 마스터의 Notion 페이지 ID를 사용합니다. 서버에서 여행 마스터 소속과 삭제 여부를 확인한 뒤 하위 데이터 소스를 `여행` 관계로 필터링합니다. 관계가 없거나 다른 여행과 함께 연결된 행은 초기 버전에서 제외합니다. 연관 지출 등 교차 링크도 같은 여행에 속한 경우에만 노출합니다.
3. 초기 접근은 P0 서버 세션이 있는 사용자로 제한합니다. 이 세션은 단일 관리자 계정으로 동작하므로 공유 사용자별 권한이 필요해지면 별도 인증과 여행별 접근 제어를 설계합니다. 응답은 `Cache-Control: private, no-store`를 사용하고 허용 필드만 반환합니다. 예약번호·결제자 정보·영수증 이미지 URL은 초기 응답에서 제외합니다.
4. 사용자가 새로고침하면 Notion에서 최신 값을 조회합니다. 페이지네이션을 끝까지 처리하고 429의 `Retry-After`와 제한된 조회 재시도를 적용합니다. Notion 오류와 실제 빈 여행은 별도로 표시합니다. 여행 전환 중 이전 응답은 새 여행 화면에 적용하지 않습니다.

### 앱 연동 설정과 검증

1. My Travel Hub에 연결할 Notion 내부 통합에 콘텐츠 읽기 권한을 부여합니다. 통합에 아래 7개 데이터 소스의 상위 DB 접근을 부여합니다.
2. 로컬에서는 `.env.local`에, 배포 환경에서는 Vercel 서버 환경변수에 `NOTION_TRAVEL_TOKEN`을 등록합니다. 다음 키에는 각 DB의 **데이터 소스 ID**를 넣습니다. Notion API에서 DB를 조회하면 응답의 `data_sources`에서 확인할 수 있습니다.

   | 환경변수 | Notion DB |
   | --- | --- |
   | `NOTION_TRAVEL_TRIPS_SOURCE_ID` | 여행 마스터 |
   | `NOTION_TRAVEL_SCHEDULE_SOURCE_ID` | 여행 일정 |
   | `NOTION_TRAVEL_BOOKINGS_SOURCE_ID` | 예약 관리 |
   | `NOTION_TRAVEL_BUDGETS_SOURCE_ID` | 예산 관리 |
   | `NOTION_TRAVEL_EXPENSES_SOURCE_ID` | 지출 내역 |
   | `NOTION_TRAVEL_RECEIPTS_SOURCE_ID` | 영수증 관리 |
   | `NOTION_TRAVEL_CHECKLIST_SOURCE_ID` | 여행 체크리스트 |

3. 조회 코드는 위 표의 확인된 Notion 속성명을 사용합니다. DB에서 속성명을 바꾸면 서버 매핑을 같이 갱신해야 합니다. 계산값을 Notion이 제공하지 않으면 화면에는 대시를 표시합니다.
4. 목 테스트로 미인증 조회, 쓰기 요청 거부, 여행 ID와 관계 검증, 페이지네이션, 민감 필드 제외, 429·권한 오류를 검증합니다. 실제 배포 확인에서는 로그인 후 두 여행의 목록과 하위 항목을 비교하고, Notion에서 수정된 값이 앱을 새로고침한 뒤 반영되는지 확인합니다.
