---
title: 'keepup 운영기 DAY 005: p6spy를 붙였더니 헬스체크 SQL이 보이지 않았다'
description: 'p6spy로 SQL과 실행 시간을 보려 했지만 기본 헬스체크에서는 로그가 0줄이었다. connection-test-query로 원인을 가르고, HikariCP 지표로 커넥션 빌리기와 SQL 실행 시간을 나눠 재 본 기록'
pubDate: 2026-10-13
tags: ['p6spy', 'hikaricp', 'actuator', 'jdbc', 'measurement']
series: 'keepup 운영기'
seriesOrder: 5
---

keepup은 Spring Boot와 MySQL로 만드는 학습 프로젝트이고, 이 글은 그 다섯 번째 기록이다. SQL과 실행 시간을 보려고 p6spy를 붙였는데, 헬스체크에서는 SQL이 한 줄도 찍히지 않았다. 그 이유를 가르는 실험을 하고, 커넥션을 빌리는 시간과 SQL 실행 시간을 나눠 재 봤다.

**요약**
1. 기본 설정의 `/actuator/health`는 p6spy에 SQL을 한 줄도 남기지 않았다. `connection-test-query=SELECT 1`을 주니 요청마다 `SELECT 1`이 1~2ms로 찍혔다. p6spy는 SQL이 들어오면 기록했다. 기본 헬스체크가 무엇으로 DB를 확인하는지는 보지 않았다.
2. 헬스체크 1번에 커넥션을 **2번** 빌렸고, SQL은 1개였다. 이유는 모른다.
3. 두 번째 요청부터 커넥션을 빌리는 시간이 0ms로 기록됐다(1ms 단위 기록이라 실제 값은 모른다). `/actuator/metrics`를 먼저 몇 번 호출한 뒤 잰 첫 헬스체크는 19ms였고, 그중 커넥션을 빌린 뒤 반납할 때까지의 합계는 6ms였다. 기동 직후 64~67ms 걸린 첫 요청은 이렇게 나눠 재지 않았다.
4. 빌리기와 SQL 실행이 둘 다 0~2ms라서, ms 단위로는 어느 쪽이 더 긴지 가릴 수 없었다.

**읽는 법:** 숫자는 macOS 로컬에서 조건마다 앱을 한 번 기동해 잰 값이다. 잰 것이 아닌 부분(추론, 가설)은 그 자리에 따로 밝힌다.

## 1. 오늘의 목표

p6spy를 붙여 헬스체크 요청 하나가 DB로 보내는 SQL과 실행 시간을 requestId와 같은 줄에서 본다.

오늘의 질문(Q2): 헬스체크 요청 하나에서 HikariCP가 커넥션을 빌려 오는 시간과 SQL을 실행하는 시간 중 어느 쪽이 더 길까? 첫 요청과 그다음 요청에서 그 비율은 달라질까?

## 2. 따라간 요청

### p6spy는 어디에 끼었나

`p6spy-spring-boot-starter`를 추가했다. starter README의 호환 표에서 Spring Boot 4.x용은 2.0.x, 3.x용은 1.12.1인 것을 보고 2.0.1을 썼다. README 설명에 따르면 이 starter는 DataSource(여기서는 HikariCP)를 감싼다. `--debug`로 기동해서 `DataSourceDecoratorAutoConfiguration matched`와 `p6SpyDataSourceDecorator` 빈이 생긴 것을 확인했다.

```
DataSource를 쓰는 코드 → [p6spy] → HikariCP → MySQL JDBC 드라이버 → MySQL
```

헬스체크가 이 경로로 SQL을 보내는지는 아래 실험에서 확인할 대상이다.

로그는 한 줄로 찍히게 형식을 정했다.

```yaml
decorator:
  datasource:
    p6spy:
      log-format: "took %(executionTime)ms | %(category) | conn %(connectionId) | %(sqlSingleLine)"
```

로그 패턴에 이미 `%X{requestId}`(요청 필터가 요청마다 MDC에 넣어 두는 requestId)가 있어서, 요청 스레드에서 실행된 SQL 줄에도 requestId가 붙었다.

### 예측

`/actuator/health`를 호출하기 전에 p6spy 로그를 예측해 봤다.
- 내 예측: "헬스 서버 상태 확인 이후 DB에 접속하는 로그가 찍힌다."
- `took`이 어디서부터 어디까지인지는 질문을 받고 "잘 모르겠다"고 답했다.

## 3. 측정값

### 기본 설정: p6spy 로그 0줄

재기동 후 3초 기다렸다가 DAY 004에서 만든 curl 구간 측정 스크립트로 5번 호출했다.

- **curl wait**: curl이 요청을 보내기 직전부터 응답 첫 바이트를 받을 때까지(클라이언트 쪽 시간)
- **필터**: 서버의 요청 로그 필터가 찍은 처리 시간(정수 ms)

| # | curl wait (ms) | 필터 (ms) | 처리 스레드 |
|---|---|---|---|
| 1 | 108.22 | 67 | exec-1 |
| 2 | 3.55 | 2 | exec-2 |
| 3 | 2.73 | 2 | exec-4 |
| 4 | 2.83 | 2 | exec-6 |
| 5 | 2.62 | 1 | exec-8 |

예측과 달리 p6spy 로그는 **한 줄도 없었다.** 전체 로그 56줄에서 `p6spy`, `took`, `statement`, `select`를 찾아봤지만 0건이었다.

### 원인 가르기: A인가 B인가

가능성은 두 가지였다.
- **A**: 헬스체크가 SQL 문장 없이 DB를 확인해서 p6spy가 기록할 게 없었다.
- **B**: p6spy가 설정은 됐지만 로그를 남기지 못한다.

SQL을 **확실히** 보내는 조건을 만들면 둘이 갈린다. HikariCP의 `connection-test-query`(커넥션이 살아 있는지 검사할 때 쓸 SQL을 직접 지정하는 설정)를 `SELECT 1`로 주고 다시 기동했다. 처음에는 `./gradlew bootRun --args='--...=SELECT 1'`로 넘겼는데, MySQL 문법 오류(`near '' at line 1`)로 기동이 실패했다. 오류 메시지로 보아 공백에서 인자가 잘려 `SELECT`만 넘어간 것으로 보인다(추론). 그래서 환경 변수 `SPRING_DATASOURCE_HIKARI_CONNECTIONTESTQUERY='SELECT 1'`로 다시 넘겼다. 기본 설정 때와 같이 기동 후 3초 기다렸다가 curl 스크립트로 3번 호출했다.

```
[exec-1] [a401687c] p6spy - took 2ms | statement | conn 3 | SELECT 1
[exec-1] [a401687c] RequestLogFilter - GET /actuator/health -> 200 64ms
[exec-2] [644ba94a] p6spy - took 1ms | statement | conn 5 | SELECT 1
[exec-2] [644ba94a] RequestLogFilter - GET /actuator/health -> 200 3ms
[exec-4] [0d8d5408] p6spy - took 1ms | statement | conn 7 | SELECT 1
[exec-4] [0d8d5408] RequestLogFilter - GET /actuator/health -> 200 2ms
```

| 조건 (호출 횟수) | p6spy 로그 | 첫 요청 필터 | 이후 요청 필터 |
|---|---|---|---|
| 기본 설정 (5번) | 0줄 | 67ms | 1~2ms |
| `SELECT 1` (3번) | 요청마다 1줄 | 64ms | 2~3ms |

p6spy 설정은 그대로였는데 SQL을 보내니 로그가 찍혔다(표의 둘째 줄). p6spy는 자기를 거친 SQL은 기록하므로 B는 틀렸다. 이 `SELECT 1`을 정확히 누가 보냈는지(헬스체크 쪽인지 다른 곳인지)는 확인하지 않았다. 남는 설명은 기본 헬스체크가 p6spy를 거치는 SQL 문장을 보내지 않았다는 것이다(추론). 기본 설정에서는 커넥션 대여 지표를 재지 않았기 때문에, 기본 헬스체크가 커넥션을 빌려 DB에 닿았는지, 닿았다면 무엇으로 확인했는지는 직접 보지 않았다. DAY 001에서 DB를 멈추면 헬스체크가 503이 된 것으로 보아 DB 상태를 반영하기는 한다.

### 커넥션 빌리기 vs SQL 실행

HikariCP는 커넥션을 빌리는 시간(`hikaricp.connections.acquire`, Actuator 설명은 "Connection acquire time")과 빌린 뒤 반납할 때까지의 시간(`hikaricp.connections.usage`, 이름에서 짐작한 정의이고 설명은 확인하지 않았다)을 지표로 남긴다. 환경 변수 `MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE=health,metrics`로 Actuator `metrics` 엔드포인트를 잠깐 열고(`SELECT 1`도 켠 상태), 헬스체크 1번마다 두 지표의 증가분을 읽었다.

| # | 빌린 횟수 | 빌리기 합계 | 빌린 뒤 반납까지 합계 | p6spy `SELECT 1` | p6spy conn | 필터 |
|---|---|---|---|---|---|---|
| 1 | **2** | 2ms | 6ms | 1ms | 3 | 19ms |
| 2 | **2** | 0ms | 1ms | 1ms | 5 | 2ms |
| 3 | **2** | 0ms | 2ms | 1ms | 7 | 2ms |
| 4 | **2** | 0ms | 2ms | 1ms | 9 | 2ms |
| 5 | **2** | 0ms | 3ms | 2ms | 11 | 3ms |

- 지표 증가분이 2000.0μs, 0.0μs처럼 정확히 1ms 단위로만 나왔다. 이 지표도 ms 단위로 기록되는 것으로 보인다. 1ms보다 짧은 값이 버려지는지 반올림되는지는 확인하지 않았다. 그래서 아래에서 0ms는 "0ms로 기록됨"으로만 읽는다.
- 이번 첫 요청(19ms)은 헬스체크 전에 `/actuator/metrics`를 몇 번 호출한 뒤라서, 앞의 64~67ms와 조건이 다르다.

## 4. 배운 것: 한 층 아래

- **기본 헬스체크는 p6spy에 SQL 문장을 남기지 않았다.** 헬스체크 응답은 200이었지만 p6spy 로그는 0줄이었다. 헬스체크가 DB 상태를 반영한다고 해서(DAY 001의 503) p6spy에 SQL이 찍히는 것은 아니었다.
- **두 번째 요청부터 빌리기는 0ms로 기록됐다.** 풀에 이미 있던 커넥션을 꺼내 쓴 것으로 보인다(추론).
- **metrics 호출 뒤 첫 헬스체크는 필터 19ms, 커넥션 사용 합계 6ms였다.** 6ms는 커넥션 2번 대여의 합계다. 두 대여가 겹쳤는지 모르고 지표도 1ms 단위라서, 19에서 6을 뺀 값을 DB 밖 시간으로 읽지는 않는다. 기동 직후 64~67ms 요청은 이렇게 나눠 재지 않았다.
- **측정 도구의 해상도가 답을 정한다.** 서버 로그, p6spy, Hikari 지표 모두 ms 단위였다. 로컬에서는 빌리기와 SQL 실행이 둘 다 1ms 근처라서, 오늘 질문인 "어느 쪽이 더 긴가"에는 답할 수 없었다.

오늘 질문(Q2)에 대한 답: 로컬에서 두 번째 요청부터는 빌리기가 0ms로 기록됐고, `SELECT 1` 실행은 1~2ms였다. 숫자만 보면 SQL 실행 쪽이 길어 보이지만, 위의 해상도 문제로 단정하지 않는다. metrics 호출 뒤 첫 요청에서는 빌리기가 2ms로 늘었고, 19ms 중 커넥션 사용 합계는 6ms였다.

## 5. 막힌 것 / 다음에 볼 것

- **헬스체크는 왜 커넥션을 2번 빌릴까?** SQL은 1개뿐이고, p6spy conn 번호도 3, 5, 7, 9, 11로 2씩 건너뛰었다. SQL 없이 빌린 한 번이 무엇을 하는지 모른다.
- **기본 헬스체크는 DB를 어떻게 확인할까?** 커넥션을 빌리기는 하는지, 빌린다면 SQL 없이 무엇으로 확인하는지 모른다. p6spy에 아무것도 안 남는다는 것까지만 확인했다.
- **아직 μs로 재지 못했다.** 오늘 쓴 서버 로그, p6spy, Hikari 지표가 모두 ms 단위였다. 빌리기와 SQL 실행을 비교하려면 1ms보다 정밀하게 재야 한다.
- **기동 직후 첫 요청(64~67ms)은 DB 구간을 나눠 재지 않았다.** metrics를 먼저 부르지 않은 조건에서 다시 재야 한다.
- **두 번째 요청부터 처리 스레드가 짝수 번호로 돌았다.** 기본 설정에서 첫 요청은 exec-1, 이후는 exec-2, 4, 6, 8이었다. DAY 004와 비슷한 패턴인데 이유는 아직 모른다.
- **p6spy `took`이 어디서부터 어디까지인지 확인하지 않았다.** 그래서 Hikari 빌리기 지표와 `took`을 같은 기준으로 비교할 수 있는지도 모른다.
- 모든 값은 조건마다 1번 기동해서 잰 값이다.
