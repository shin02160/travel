# Travel

My Travel Hub의 여행 정보를 읽는 React 앱입니다. 여행 목록은 공개하고, 상세는 여행별 숫자 4자리 PIN으로 잠급니다. 여행 데이터는 Notion에서 관리합니다.

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

## Vercel 배포

Vercel에서 Vite 프레임워크, 빌드 명령 `npm run build`, 출력 폴더 `dist`를 사용합니다. Vite 개발 미들웨어와 Vercel Node 함수가 조회와 PIN 인증 API를 제공합니다. 정적 호스팅이나 `vite preview`에서는 API가 실행되지 않습니다.

## P1 Notion My Travel Hub 읽기 전용 연동

생성, 수정, 삭제, 체크 상태 변경, 영수증 첨부는 모두 Notion에서 합니다. 앱에서는 조회와 필터링을 제공하고 Notion 페이지 링크는 표시하지 않습니다.

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

### 공개 목록과 여행별 PIN

1. `GET /api/trips`는 로그인 없이 모든 여행의 ID, 여행명, 여행지, 여행기간, 상태만 반환합니다. 메모와 예산 등 상세 데이터는 별도 API에서 제공합니다.
2. `POST /api/trips/:tripId`는 해당 여행의 PIN만 확인합니다. 일치하면 여행별로 서명된 30분짜리 HttpOnly 쿠키를 발급합니다. 운영 쿠키에는 Secure가 적용됩니다. PIN을 바꾸거나 제거하면 기존 쿠키도 무효화됩니다.
3. `GET /api/trips/:tripId`는 해당 여행의 유효한 쿠키가 필요합니다. 여행 마스터 소속을 확인하고, 하위 데이터는 `여행` 관계가 정확히 해당 여행을 가리키는 경우만 반환합니다. 응답은 저장되지 않도록 `Cache-Control: private, no-store`를 사용하며 예약번호·결제자 정보·영수증 이미지 URL도 제외합니다.
4. 모든 서버 인스턴스가 환경과 여행별로 같은 Redis 카운터를 사용합니다. 첫 입력부터 1시간 동안 성공·실패 합계 10회를 허용하며, Redis를 사용할 수 없으면 새 PIN 인증은 실패합니다. 한 여행의 제한이 다른 여행에 적용되지는 않습니다. 4자리 PIN은 단순 열람 제한이며, 해당 여행의 시도 한도가 소진되면 올바른 PIN을 가진 사용자도 만료까지 기다려야 합니다.

### PIN과 요청 제한 설정

`.env.example`을 참고해 로컬에서는 `.env.local`에, Vercel에서는 적용할 Preview 또는 Production의 서버 환경변수에 아래 값을 등록합니다.

| 환경변수 | 설정 |
| --- | --- |
| `TRAVEL_DETAIL_PINS` | Notion **여행 페이지 ID**를 키로, 4자리 PIN 문자열을 값으로 둔 JSON. 예시 `{"00000000-0000-4000-8000-000000000001":"0427"}`. 하이픈이 있는 소문자 UUID를 사용합니다. |
| `SESSION_SECRET` | 기존 서버 서명 키를 사용하거나 32자 이상의 별도 무작위 키를 생성합니다. |
| `TRAVEL_REDIS_REST_URL` | Upstash Redis HTTPS REST 엔드포인트. |
| `TRAVEL_REDIS_REST_TOKEN` | 카운터 갱신이 가능한 Upstash REST 토큰. 기존 `UPSTASH_REDIS_REST_TOKEN`도 사용할 수 있습니다. |

PIN 매핑, 서명 키, Redis 토큰은 비밀 환경변수로 저장합니다. 새 여행은 공개 목록에 바로 나타나며, 운영 환경에 PIN을 등록하고 재배포한 뒤 상세를 열 수 있습니다. 동일 PIN을 여러 여행에 재사용하면 사용자가 각각에 같은 PIN을 직접 입력할 수 있으므로 여행별로 다른 값을 사용합니다.

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
4. 목 테스트로 공개 목록, PIN 검증·만료·여행 간 격리, 시도 제한 장애, 쓰기 요청 거부, Notion 관계 검증과 페이지네이션을 확인합니다. 실제 배포에서 PIN 설정 후 두 여행의 상세가 각각 열리는지, Notion 변경이 새로고침에 반영되는지 확인합니다.
