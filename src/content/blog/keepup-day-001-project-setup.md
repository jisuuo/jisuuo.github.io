---
title: 'keepup 운영기 DAY 001: 헬스체크 응답을 어디까지 보여줄 것인가'
description: 'Spring Boot + MySQL(Docker Compose)을 세팅하고, 헬스체크 응답의 판단과 표시를 나눠 본 첫날 기록'
pubDate: 2026-10-10
tags: ['spring-boot', 'mysql', 'docker-compose', 'actuator', 'curl']
series: 'keepup 운영기'
seriesOrder: 1
---

keepup는 하루 1시간씩 26주 동안 실사용자가 있는 서비스를 운영하며 기록하는 프로젝트이고, 이 글은 시리즈 「keepup 운영기」의 DAY 001(2026-10-10)이다. 첫날은 요청을 끝까지 따라가기 전에 길을 까는 날이었다. Spring Boot + MySQL 프로젝트를 만들고, 로컬 Docker Compose로 DB를 띄우고, 헬스체크가 UP으로 나오는 것까지 확인했다. 1주차에 쓸 README, 기술 스택 결정 문서(ADR-001), 학습 규칙, /today·/wrap 명령어, 템플릿도 준비했다.

이 글의 질문은 하나다. 헬스체크 응답을 밖에 어디까지 보여줄 것인가. 저장소는 https://github.com/jisuuo/keepup 이고, 아래 「따라 하기」에서 같은 확인을 자기 환경에서 해 볼 수 있다.

글 안의 내용은 세 가지 수준으로 나눠 쓴다.

- 직접 관찰: 내 로컬에서 실행해서 본 것
- 설정 의미 정리: 관찰한 결과를 바탕으로 내가 정리한 것 (어떤 문서를 읽고 옮긴 것이 아니다)
- 미확인: 아직 확인하지 못한 것

## 요청이 지나는 길

헬스체크 요청은 이렇게 지나간다.

```
curl → 톰캣(8080) → Actuator health → DB 커넥션 검사(isValid) → 응답
```

이 길의 시간을 `curl -w`로 한 번 재 봤다. `curl -w`가 찍어 주는 값은 요청 시작부터 쌓인 누적 시각이어서, 구간별 시간은 뺄셈으로 읽는다. 이 값은 헬스체크 요청 한 번이 얼마나 걸렸는지 보는 참고값이며 기준선이 아니다.

| 시점 | 누적 시각 | 구간 |
|---|---|---|
| connect | 0.22ms | |
| starttransfer | 2.98ms | 약 2.76ms, 요청 전송 + 서버 처리, 첫 바이트 도착까지 |
| total | 3.24ms | 약 0.26ms, 본문 수신이 끝날 때까지 남은 시간 |

`curl -w`는 초 단위로 출력하므로 표의 ms는 내가 환산한 값이다. 로컬 HTTP라서 DNS(`time_namelookup`)와 TLS(`time_appconnect`)는 거의 0이고, 이 값들은 5주차 HTTPS 배포 때부터 보이기 시작할 것이다.

한계도 분명하다. 이 값은 **한 번** 잰 값이라 기준선으로는 약하다. 2주차에 측정 스크립트로 여러 번 재서 중앙값으로 바꿀 예정이다. 이 글에는 원본 로그를 첨부하지 않았다.

## 정상일 때와 DB를 멈췄을 때

[직접 관찰] 정상일 때와 MySQL 컨테이너를 멈췄을 때의 응답은 이랬다.

| 상태 | HTTP 상태 코드 | 본문 |
|---|---|---|
| 정상 | 200 | `{"groups":["liveness","readiness"],"status":"UP"}` |
| MySQL 컨테이너 중지 | 503 | `{"groups":["liveness","readiness"],"status":"DOWN"}` |

DB를 내린 직후의 요청은 한참 걸린 뒤에 503이 왔다. 그런데 **걸린 시간은 재지 못했다.** 그래서 이 글에는 지연 시간의 숫자를 적지 않는다. 원인도 확정하지 못했다. HikariCP의 커넥션 획득 타임아웃(기본 30초) 때문일 가능성을 의심하고는 있지만, 확인한 것이 아니다. 이 프로젝트가 26주 동안 따라가는 질문 체크리스트(Q1~Q5) 중 커넥션 풀을 다루는 Q2를 볼 2주차에 확인할 예정이다.

## always와 never: 판단과 표시의 분리

`management.endpoint.health.show-details`가 이 글의 중심 설정이다. 저장소의 `application.properties`에는 이 줄이 따로 없다(기본값은 `never`). `management.endpoints.web.exposure.include=health`만 있다.

[직접 관찰] 이 값을 `always`로 바꾸면 응답에 상세가 붙는다. `components.db.details.database`에 `MySQL`이, `diskSpace.details`에는 용량 값(total, free)과 서버 폴더 경로(path)가 나온다. 이 글에는 디스크 byte 값과 실제 경로를 적지 않는다. 기본값(`never`)에서는 위 표처럼 `groups`와 `status`만 나온다. `never` 상태에서도 정상일 때는 200, DB를 멈추면 503이었다.

여기서부터는 [설정 의미 정리]다. 위에서 관찰한 응답을 보고 내가 정리한 것이고, 관리 포트로 상세를 볼 수 있다는 부분은 확인하지 않은 추측이다.

- 판단: 앱이 요청마다 DB와 디스크 등을 검사해 전체 상태를 계산하고, UP이면 200, DOWN이면 503을 돌려준다. 이 판단은 `show-details`의 영향을 받지 않는다.
- 표시: `show-details`는 응답 본문의 components 상세를 보여줄지만 정한다.

따라서 `never`는 헬스체크를 끄는 설정이 아니다. 판단은 그대로 하고 표시만 숨긴다. 로드밸런서나 모니터링은 상태 코드만으로 서버를 판단할 수 있다. 대신 어느 항목 때문에 DOWN인지는 본문으로 알 수 없어서, 서버 로그로 봐야 한다. 관리 포트를 분리하면 볼 수 있을 것으로 보지만 방법 A를 적용해 보지 않았으므로 확인한 것은 아니다. `/actuator/health/liveness`와 `/actuator/health/readiness`는 상세를 숨겨도 쓸 수 있다.

[미확인] `always` 상태에서 DB를 멈췄을 때 응답이 어떻게 나오는지는 보지 못했다. 상태 코드가 `never`일 때와 같은지도 이 글은 확인하지 않았다. 독자가 직접 확인해 볼 질문으로 남겨 둔다.

## 상세가 필요해지면: 방법 A, B, C

상세를 보고 싶어질 때의 후보를 세 가지로 정리했다. 셋 다 설정 후보로 정리한 것이고, **A와 B는 실제로 적용해 보지 않았다.**

**방법 A. 관리 포트 분리 + `show-details=always`**
`management.server.port=8081`, `management.server.address=127.0.0.1`로 관리 포트를 따로 두고 그쪽에서 `always`를 쓴다. 이렇게 하면 외부 8080에서는 계속 숨겨지고 추가 의존성도 필요 없을 것으로 본다. 적용해 보지 않았다.

**방법 B. `show-details=when-authorized` + Spring Security**
로그인 기능이 필요하다. 3주차에 GitHub OAuth를 붙일 때 같이 하는 편이 자연스럽다.

**방법 C. `always` 그대로 켜기**
DB 종류와 서버 폴더 경로가 외부에 보이므로 비추천이다.

### 지금의 선택

배포 전까지는 기본값(`never`)으로 둔다. 상세가 필요해지면 A가 유력하다. 6주차 이후 Prometheus + Grafana와 Discord 알림도 관리 포트에서 지표를 가져오는 구조가 깔끔하기 때문이다. 최종 결정은 5주차 배포 때 한다.

내 기준은 이렇다.

> 사용자에게는 쓸모없고 공격자에게는 쓸모 있는 정보(경로, DB 종류)는 숨기고, 내 서버를 판단하기 위한 정보만 남긴다.

## 따라 하기

### 전제

- 명령은 저장소를 받은 디렉터리(루트, `compose.yaml`과 `gradlew`가 있는 곳)에서 실행한다.
- Docker와 Docker Compose (DB용 MySQL 8.4 컨테이너)
- Java 21 (`build.gradle`의 Gradle 툴체인이 Java 21로 고정되어 있다)
- curl
- DB 접속 정보는 환경 변수를 따로 넣지 않아도 `compose.yaml`과 설정의 로컬 기본값이 서로 같아서 로컬에서는 바로 동작한다.

### 명령 순서

터미널 1. DB를 띄우고 서버를 실행한다. `bootRun`을 실행한 터미널은 서버가 차지하므로 나머지 명령은 다른 터미널에서 실행한다.

```bash
docker compose up -d --wait
./gradlew bootRun
```

터미널 2. 터미널 1의 서버 기동이 끝난 뒤에 실행한다. 응답 시간을 한 번 재고, 정상 상태 코드를 확인한다. 두 번째 명령의 출력 첫 줄에 `200`이 보이면 정상이다.

```bash
curl -s -o /dev/null -w "connect=%{time_connect}s starttransfer=%{time_starttransfer}s total=%{time_total}s\n" localhost:8080/actuator/health
curl -s -i localhost:8080/actuator/health | head -1
```

터미널 2. DB를 멈추고 같은 요청을 다시 보낸다. 출력 첫 줄에 `503`이 보인다. 응답이 한참 걸릴 수 있으니 멈춘 것처럼 보여도 기다린다. 걸린 시간은 이 글에서 재지 못했다.

```bash
docker stop keepup-mysql
curl -s -i localhost:8080/actuator/health | head -1
docker start keepup-mysql
```

종료는 서버 터미널에서 Ctrl+C, DB는 `docker compose stop`이다. 데이터는 `docker/mysql/data/`에 남는다. 컨테이너 이름 `keepup-mysql`은 `compose.yaml`의 `container_name`이고, 3306 포트와 `./docker/mysql/data` 볼륨을 쓴다.

### show-details 바꿔 보기

`application.properties`에 `management.endpoint.health.show-details=always` 한 줄을 추가하고 서버를 다시 시작한 뒤 같은 curl로 본문을 보면 상세가 붙는다. 앞에서 말했듯이 이 상태에서 DB를 멈춘 응답은 내가 보지 못했으니, 직접 확인해 볼 질문이다.

## DB 비밀번호와 스택 선택

### DB 비밀번호

저장소가 공개라서 비밀번호 값은 설정 파일에 적지 않고 환경 변수 `DB_PASSWORD`로 받는다. 환경 변수가 없을 때 쓰는 로컬 개발용 기본값이 설정에 있는데, 공개 저장소에 들어 있는 값이므로 배포에서 그대로 쓰면 안 된다. 이 글에도 그 값은 적지 않는다. `.env`와 `application-local.*`는 `.gitignore`에 넣었다.

### 스택을 고른 기준과 이유

ADR-001에서 Java 21 + Spring Boot(web, data-jpa, actuator) + MySQL 8.4(로컬 Docker Compose)를 골랐다. 기준은 앞서 말한 질문 체크리스트 Q1~Q5 중 Q2~Q4의 대상, 즉 스레드 풀·커넥션 풀·락·인덱스를 기본 설정 그대로 관찰할 수 있는가다. 톰캣 기본 스레드 200, HikariCP 기본 풀 10 같은 값이 그 예다.

검토한 대안은 세 가지였다.

- Kotlin + Spring Boot: 언어 학습이 병행되어 Q1~Q5 공부 시간을 잠식한다.
- NestJS + PostgreSQL: 이벤트 루프라 스레드 풀 관찰 대상이 다르다.
- Java + PostgreSQL: MySQL을 택한 이유는 ADR에 있다. `SELECT … FOR UPDATE SKIP LOCKED`와 InnoDB 인덱스·갭 락 실험이다.

내 이유는 이렇게 적어 두었다.

> Java와 Spring은 써 본 적이 있지만 깊게 파는 것은 이번이 처음이다. 어느 정도 익숙하니 언어·프레임워크 학습량이 줄어, 그만큼 Q1~Q5 공부에 시간을 쓸 수 있을 것이라고 기대한다. (기대일 뿐, 실제로 줄었는지는 2주차 이후에 돌아본다.)

## 아직 확인하지 못한 것과 다음에 볼 것

- DB 중지 후 응답이 오래 걸린 시간과 원인: 재지 못했다. HikariCP 커넥션 획득 타임아웃(기본 30초)인지는 확인하지 못했고, 2주차 Q2에서 확인한다.
- 응답 시간 기준선: 한 번 잰 값이다. 2주차 curl 측정 스크립트로 반복 측정한다.
- `always` 상태에서 DB를 멈췄을 때의 응답: 보지 못했다.
- 방법 A(관리 포트 분리) 적용 여부: 5주차 배포 때 결정한다. A와 B 모두 실제로 적용해 본 적은 없다.
- `/today`, `/wrap` 명령어: 만들기만 했고 실제로 실행해 보지 않았다. DAY 002 시작 때 확인한다.
- 이 스택이 목표 회사군(커머스·핀테크·플랫폼)에서 흔한지: 아직 공고를 찾아보는 중이다.

저장소를 받아 위 순서대로 정상/중지 상태의 상태 코드를 확인해 보고, 자기 서비스의 `show-details` 값이 지금 무엇인지도 한 번 점검해 보면 좋겠다.
