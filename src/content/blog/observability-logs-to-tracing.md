---
title: 'Observability는 어떻게 동작할까? — 로그 생성부터 수집, 저장, 분산 추적까지'
description: 'Spring Boot 로그가 Logback, Vector, Loki, Prometheus, OpenTelemetry를 거쳐 Grafana에서 조회되기까지 데이터가 실제로 이동하는 과정을 따라가 봤다.'
pubDate: 2026-11-04
tags: ['observability', 'spring', 'logging', 'opentelemetry', 'grafana']
series: 'Observability'
seriesOrder: 1
---

> **시리즈 1편 | Observability의 전체 흐름 이해하기**  
> Spring Boot · Logback · Vector · Loki · Prometheus · OpenTelemetry · Grafana

## 들어가며

백엔드 서버를 개발하면서 로그를 남기는 일은 익숙했다.

```java
log.info("상품 조회 완료");
log.error("주문 처리 실패");
```

하지만 로그가 실제로 어디에 기록되고, Grafana에서 어떤 과정을 거쳐 조회되는지 설명하기는 어려웠다.

처음에는 Grafana, Prometheus, ELK 같은 도구의 역할을 외우려고 했다. 그런데 도구를 아는 것과 **데이터가 실제로 이동하는 과정을 이해하는 것**은 달랐다.

이번 글에서는 다음 질문을 중심으로 Spring Boot의 Observability 흐름을 살펴본다.

- 데이터는 어디에서 생성되는가?
- 누가 수집하고 어떻게 전달하는가?
- 어디에 저장하고 어떤 기준으로 검색하는가?
- 중간에 장애가 발생하면 어떤 현상이 나타나는가?

운영체제, 네트워크, 동시성, 자료구조와 연결되는 부분은 함께 짚되, 내부 구현을 검증해야 하는 주제는 **시리즈 2편의 학습 과제**로 남겨둔다.

## 1. Observability는 왜 필요한가?

사용자가 상품 조회 API가 느리다고 제보했다고 가정하자.

```text
Client
  │ GET /products/1
  ▼
Tomcat → Controller → Service → Repository → Database
```

응답에 3초가 걸렸다는 사실만으로 DB가 원인이라고 판단할 수는 없다. DB 커넥션을 기다렸을 수도 있고, 서비스 내부의 외부 API 호출이 지연되었을 수도 있다.

**Observability(관찰 가능성)** 는 시스템이 만들어 내는 관측 데이터를 통해 내부 상태와 동작을 이해하는 능력이다.

| 데이터 | 확인할 질문 |
|---|---|
| **Logs** | 어떤 사건이나 오류가 발생했는가? |
| **Metrics** | 언제부터, 얼마나 자주, 얼마나 느리게 발생하는가? |
| **Traces** | 요청이 어디를 거쳐 어느 구간에서 시간을 썼는가? |

메트릭으로 응답시간 증가를 확인하고, 트레이스로 지연 구간을 좁힌 뒤, 로그로 해당 작업에서 발생한 사건을 살펴볼 수 있다. 세 데이터는 서로 대체하는 수단이 아니라 각기 다른 관점에서 시스템을 설명한다.

## 2. `log.info()` 호출 뒤에서는 무슨 일이 일어날까?

일반적인 Spring Boot + SLF4J + Logback 구성에서는 다음과 같이 이해할 수 있다.

```text
Spring Boot (User Space)
  │ log.info(...)
  ▼
SLF4J                 ← 로깅 API / 추상화
  ▼
Logback               ← 로깅 구현체
  ▼
Appender              ← 출력 목적지 결정
  ├── ConsoleAppender → stdout / stderr
  └── FileAppender    → /logs/app.log
                               │
                               ▼
                        OS 파일 I/O
```

SLF4J는 로깅 API이고, Logback은 실제 구현체다. 로그가 파일로 갈지, 콘솔로 갈지는 Appender 설정에 따라 달라진다.

### stdout, stderr, 파일 디스크립터

Linux 프로세스에는 관례적으로 세 개의 표준 파일 디스크립터가 제공된다.

| FD | 표준 스트림 | 역할 |
|---|---|---|
| `0` | stdin | 입력 |
| `1` | stdout | 일반 출력 |
| `2` | stderr | 오류 출력 |

`stdout`은 터미널 그 자체가 아니다. 프로세스가 데이터를 출력하는 표준 스트림이며, 실행 환경에 따라 터미널·파이프·파일·컨테이너 로깅 드라이버 등에 연결될 수 있다.

FileAppender로 로그를 파일에 쓴다면 애플리케이션은 운영체제가 제공하는 파일 I/O 인터페이스를 사용한다. 물리적인 디스크 주소를 직접 계산해 쓰지 않는다.

> **CS 연결 — 추상화:** 애플리케이션은 파일이라는 추상화를 사용하고, 운영체제는 파일 디스크립터, 파일 시스템과 저장장치 접근을 관리한다.

또한 파일 쓰기 호출이 성공했다는 사실과 데이터가 물리적 저장장치에 영구 보존되었다는 사실은 다르다. 페이지 캐시와 동기화 과정이 있기 때문이다. 이 부분은 2편에서 `write()`, Page Cache, `fsync()`를 중심으로 검증한다.

## 3. Agent는 무슨 역할을 할까?

로그가 파일에 쓰였다고 해서 중앙 로그 저장소까지 자동으로 전달되지는 않는다. **Agent**가 로컬 데이터 소스를 읽고 다른 시스템으로 전송할 수 있다. Vector는 그런 Agent로 활용할 수 있는 프로그램이다.

```text
Linux 서버
┌──────────────────────────────┐
│ Spring Boot 프로세스         │
│          │                   │
│          ▼                   │
│     /logs/app.log            │
│          ▲                   │
│          │ 파일 읽기          │
│          │                   │
│ Vector Agent 프로세스        │
└──────────┬───────────────────┘
           │ 네트워크 전송
           ▼
          Loki
```

Spring Boot와 Vector는 **서로 다른 프로세스**다. Vector의 파일 Source는 Spring Boot의 JVM Heap을 직접 읽는 것이 아니라, 운영체제의 파일 인터페이스를 통해 로그 파일을 읽는다.

Vector 파이프라인의 기본 구성은 다음과 같다.

| 단계 | 역할 |
|---|---|
| **Source** | 파일·소켓 등에서 데이터 수집 |
| **Transform** | 파싱·변환·필드 추가 |
| **Sink** | Loki 등 목적지로 전송 |

Agent는 역할을 가리키는 이름이다. Vector를 백그라운드 서비스로 운영하면 데몬 형태로 실행할 수 있고, Linux에서는 `systemd`가 프로세스의 실행·재시작·상태를 관리하도록 구성할 수 있다. `systemd`는 수집기가 아니라 서비스 관리자다.

### 파일 오프셋과 체크포인트

파일 Source는 읽은 위치를 추적해야 한다. 프로세스가 종료되면 열린 파일 디스크립터와 그에 연결된 커널의 파일 위치 상태는 사라지므로, 재시작을 위해 진행 상태를 별도로 저장하는 **체크포인트**가 중요하다.

```text
app.log
0 ───────── 100 ───────── 200 ───────── 300
              │            │             │
             로그 B        로그 C        끝

예시: 저장된 체크포인트 = 200
```

- **파일 오프셋**: 열린 파일에서의 현재 읽기 위치.
- **체크포인트**: 재시작 후 수집을 이어가기 위해 보존하는 진행 상태.

실제 Vector의 재개 동작은 Source 설정, 파일 식별, 체크포인트 보존 상태에 영향을 받는다. 무엇보다 **읽기 위치 복구와 저장소에 정확히 한 번 전달하는 보장은 다르다.**

## 4. Agent와 Aggregator는 무엇이 다를까?

여러 서버의 로그를 중앙에서 모으려면 다음과 같이 구성할 수 있다.

```text
Server A            Server B            Server C
Spring Boot         Spring Boot         Spring Boot
    │                   │                   │
Vector Agent        Vector Agent        Vector Agent
    │                   │                   │
    └───────────────────┼───────────────────┘
                        ▼
                 Vector Aggregator
                        │
                        ▼
                       Loki
                        ▲
                        │ 조회
                     Grafana
```

- **Agent**: 각 서버에서 로그를 수집하는 역할.
- **Aggregator**: 여러 Agent가 전달한 데이터를 중앙에서 수신·가공·전달하는 역할.

둘은 서로 다른 제품명이 아니라 **배치 위치와 책임의 차이**다. 같은 Vector를 양쪽 역할로 사용할 수도 있다. 또한 중앙 Aggregator는 필수는 아니며 Agent가 Loki로 직접 전송하는 구성이 가능하다.

### SPOF와 가용성

Aggregator가 한 대뿐이고 모든 Agent가 해당 서버를 거쳐야 한다면 Aggregator 장애가 수집 경로 전체에 영향을 준다. 이것이 **SPOF(Single Point of Failure)** 다.

Aggregator를 두 대로 늘려도 앞단 로드 밸런서가 한 대이고 대체 경로가 없다면 로드 밸런서가 새로운 SPOF가 될 수 있다.

> **CS 연결 — 가용성:** 가용성을 판단할 때는 특정 컴포넌트의 개수보다 **데이터가 지나는 전체 경로와 우회 가능성**을 살펴봐야 한다.

## 5. 전송에 실패하면 로그는 어떻게 될까?

Vector가 로그를 전송한 후 응답을 받지 못하는 상황을 생각해 보자.

```text
Vector                          Loki
   │                             │
   ├──── HTTP 요청 ──────────────▶│
   │                             │ 로그 처리
   │       응답 유실 X ◀──────────┤
   │
   └── 처리 성공 여부를 모름
```

Loki가 요청을 처리했어도 응답이 유실되면 Vector는 성공을 확인하지 못한다. 재시도 정책에 따라 **같은 로그를 다시 보낼 가능성**이 있다.

TCP의 ACK는 TCP 바이트 수신을 확인하는 메커니즘이다. 이것이 곧 Loki가 로그를 애플리케이션 수준에서 성공적으로 처리하고 보존했다는 뜻은 아니다.

### 전달 보장과 재시도

**At-least-once**는 중복을 허용하는 대신 적어도 한 번 전달하는 것을 목표로 하는 의미론이다. 실제로 어떤 장애까지 보장하는지는 Vector Source·Sink의 확인 응답 처리, 버퍼 설정, 저장소의 동작에 달려 있다. 모든 구성이 자동으로 At-least-once를 보장하는 것은 아니다.

| 전략 | 이유 |
|---|---|
| Timeout | 무한정 응답을 기다리지 않기 위해 |
| Exponential Backoff | 반복 실패 시 재시도 간격을 늘리기 위해 |
| Jitter | 여러 Agent가 동시에 재시도하는 현상을 줄이기 위해 |

**Timeout은 상대편 작업이 반드시 실패했다는 증거가 아니다.** 확인 시간이 초과되었다는 의미다. 따라서 재시도는 중복 가능성과 함께 설계해야 한다.

### Buffer와 Backpressure

수집 속도가 전송 속도보다 빠르면 버퍼에 로그가 쌓인다.

```text
로그 생성 빠름
    ↓
Vector Source
    ↓
Buffer 누적
    ↓
Sink 전송 지연 (Loki 느림)
    ↓
버퍼 한계 접근
    ↓
Backpressure 또는 버퍼 정책에 따른 처리
```

메모리 버퍼는 일반적으로 빠르지만 프로세스 종료에 취약하다. 디스크 버퍼는 재시작 복구에 유리할 수 있으나 디스크 용량과 I/O 비용을 고려해야 한다. 실제 유실·차단·복구 특성은 설정에 달려 있다.

버퍼가 가득 찼을 때 수집 단계의 속도를 제한하는 것이 **애플리케이션 수준의 Backpressure**다. TCP 흐름 제어와는 책임이 다르다. TCP는 전송계층에서 수신 버퍼에 맞춰 바이트 전송을 조절하고, 애플리케이션 Backpressure는 파이프라인의 처리량을 조절한다.

> **자료구조 연결:** 데이터를 생산하는 쪽과 소비하는 쪽의 처리 속도 차이를 이해하려면 Queue와 생산자–소비자 모델이 도움이 된다. Vector가 내부에서 어떤 자료구조를 사용하는지는 실제 구현을 확인해야 한다.

## 6. 왜 구조화된 로그를 사용할까?

```text
2026-11-03 21:30:00 ERROR Payment failed
```

문자열만 있어도 사람이 읽을 수는 있지만, 필드별 분석에는 파싱이 필요하다. 처음부터 구조화된 형태로 출력하는 방법도 있다.

```json
{
  "timestamp": "2026-11-03T21:30:00+09:00",
  "level": "ERROR",
  "event": "PAYMENT_FAILED",
  "errorCode": "PAYMENT_TIMEOUT",
  "orderId": 1001,
  "traceId": "abc123"
}
```

`event`, `errorCode`처럼 의미가 정해진 필드를 사용하면 오류 집계와 검색이 쉬워진다. 다만 **JSON이라고 해서 모든 필드가 자동으로 인덱싱되는 것은 아니다.**

여기서 오류를 구조화해 다루는 **Typed Error**와 연결할 수도 있다. 애플리케이션 내부에서 오류 유형을 모델링하고, API 응답과 로그에서 일관된 코드로 표현하는 것이다.

```text
상품이 이미 판매됨
      ↓
ProductAlreadySoldException
      ├── API 계약에 따라 409 Conflict 매핑
      └── 로그에 errorCode=PRODUCT_ALREADY_SOLD 기록
```

HTTP 상태 코드는 예외 이름에서 자동으로 결정되는 것이 아니라 **애플리케이션의 예외 매핑과 API 계약**에 의해 정해진다.

## 7. Loki의 인덱스는 PostgreSQL과 어떻게 다를까?

PostgreSQL의 B-tree 인덱스는 특정 컬럼 값을 기준으로 관련 행을 효율적으로 탐색할 때 사용한다. Loki는 Label 조합으로 로그 스트림을 구분하고 관련 Chunk를 찾아 검색 범위를 좁힌다.

```logql
{service="order-api", env="prod"} |= "결제 실패"
```

이 쿼리는 `service`, `env` Label로 대상을 좁힌 후 로그 내용에서 문자열을 찾는 예다.

**Cardinality**는 서로 다른 값의 개수다. `service`는 값의 종류가 비교적 적을 수 있지만, `orderId`는 주문마다 다른 값이 생긴다. 고유값이 많은 필드를 Label로 사용하면 로그 스트림 수와 인덱스 비용이 크게 증가할 수 있다.

| 정보 | 고려할 저장 위치 |
|---|---|
| `service`, `env` | Indexed Label |
| `orderId`, `traceId` | Structured Metadata 또는 로그 본문 |
| 상세 메시지 | Log Line |

Structured Metadata는 로그에 딸린 키-값 데이터를 인덱싱하지 않고 보관하는 방식이다. JSON 본문을 보관하고 조회 시 `| json`으로 파싱하는 방식도 가능하다.

수집 시 파싱과 조회 시 파싱은 비용을 발생시키는 위치가 다르다. 실제 조회 빈도, 데이터 크기, 검색 범위, CPU·메모리·저장 비용을 검토해야 한다.

> **자료구조 연결:** B-tree 계열의 탐색, 역색인, Posting List, 로그 Chunk가 각각 어떤 역할을 하는지는 2편에서 실제 Loki 인덱스 구조와 비교해 본다.

## 8. Metrics와 Traces는 어떻게 수집될까?

### Metrics — Prometheus Pull

Spring Boot Actuator와 Micrometer를 사용하면 요청 수와 응답시간 등의 메트릭을 노출할 수 있다.

```text
Spring Boot
/actuator/prometheus
      ▲
      │ 주기적으로 수집
 Prometheus
      ▲
      │ 조회
   Grafana
```

Prometheus가 대상 엔드포인트를 주기적으로 호출하는 구성을 **Pull** 방식이라고 한다. Counter, Gauge, Histogram의 의미를 구분하고, 평균뿐 아니라 p95·p99 응답시간도 살펴볼 필요가 있다.

### Traces — 요청 흐름과 Span

하나의 요청은 여러 작업으로 나뉠 수 있다.

```text
Trace ID = T-100

Order API       Span S-1 (부모 없음)
    └─ HTTP    Span S-2 (부모 S-1)
         └─ Payment API  Span S-3 (부모 S-2)
                └─ DB    Span S-4 (부모 S-3)
```

- **Trace ID**: 전체 요청 흐름을 구분한다.
- **Span ID**: 개별 작업을 구분한다.
- **Parent Span ID**: 작업 간 부모·자식 관계를 나타낸다.

`T-100`, `S-1` 등은 설명을 위한 축약 표기이며 실제 W3C 식별자 형식은 정해진 길이의 16진수를 사용한다.

OpenTelemetry 계측은 Span 정보를 생성·전달할 수 있으며, Collector를 거쳐 Tempo에 저장하는 구성을 사용할 수 있다. Grafana는 Tempo에 질의하여 트레이스를 시각화한다.

## 9. Trace ID는 다른 스레드와 서버까지 어떻게 갈까?

### 스레드 사이 — MDC와 ThreadLocal

Spring Boot의 로그에 Trace ID를 포함할 때 MDC가 사용될 수 있다. 일반적인 SLF4J MDC 구현은 현재 스레드에 연결된 진단 정보를 관리한다.

```text
Thread-A (Tomcat)
  │ MDC traceId=AAA
  ▼
OrderService
  │ @Async 작업 제출
  ▼
Thread-B (Executor)
  │ MDC 전파 설정이 없다면 traceId 누락 가능
  ▼
NotificationService
```

`ThreadLocal`은 스레드마다 독립적인 값을 유지하도록 도와준다. 따라서 다른 스레드로 작업을 넘길 때 기존 값을 자동으로 공유한다고 가정할 수 없다.

`TaskDecorator`나 Micrometer Context Propagation 등을 이용하면 실행 컨텍스트를 캡처·복원할 수 있다. 그리고 스레드 풀에서는 작업 종료 후 컨텍스트를 정리하거나 기존 상태로 돌려놓아야 한다. 그렇지 않으면 다음 작업의 로그가 이전 요청의 Trace ID로 기록될 위험이 있다.

**MDC에 Trace ID 문자열이 보이는 것과 실제 Span Context가 전파되는 것은 구분해야 한다.**

### 서버 사이 — HTTP `traceparent`

서로 다른 JVM 프로세스는 ThreadLocal을 공유하지 않는다. 따라서 HTTP 요청에서는 W3C Trace Context의 `traceparent` 헤더 등을 이용해 컨텍스트를 전달한다.

```text
Order API
  │ Trace ID = AAA
  │ HTTP 요청 + traceparent
  ▼
Payment API
  │ 상위 Trace Context 추출
  │ 동일 Trace ID를 사용하는 새 Span 생성
  ▼
PaymentService
```

헤더 전파가 누락되면 Payment API가 별도의 Trace를 시작할 수 있다. 이때 **HTTP 호출은 성공했어도 트레이스만 끊어져 보일 수 있다.**

## 10. 장애가 발생하면 무엇부터 확인할까?

**상황: 주문 API 응답시간이 갑자기 5초로 증가했다.**

```text
[현상] 주문 API 느림
        │
        ▼
[Metrics] 언제부터 얼마나 느려졌는가?
        │
        ▼
[Traces]  어느 서비스와 Span에서 시간이 걸렸는가?
        │
        ▼
[Logs]    어떤 오류나 사건이 기록되었는가?
        │
        ▼
[검증]    코드·DB·외부 API·인프라에서 가설 검증
```

반드시 이 순서를 따라야 하는 것은 아니다. 로그에서 먼저 출발할 수도 있고, 트레이스 자체가 수집되지 않았을 수도 있다.

Grafana에서 로그가 보이지 않는다면 **로그가 생성되지 않은 것인지, 수집되지 않은 것인지, 전송되지 않은 것인지, 저장·검색되지 않는 것인지**부터 구분해야 한다.

```text
Spring Boot
    ↓
Logback
    ↓
로그 파일 또는 stdout
    ↓
Vector Agent
    ↓
Vector Aggregator (선택)
    ↓
Loki
    ↓
Grafana 조회
```

이 구조를 알면 특정 도구를 막연히 의심하는 대신 어느 구간까지 정상인지 확인할 수 있다.

## 마치며

처음에는 Grafana, Prometheus, Loki의 역할을 알면 Observability를 이해한 것이라고 생각했다. 하지만 로그 한 줄의 경로를 따라가면서 도구보다 중요한 것은 **데이터가 어디에서 생성되고, 누가 어떤 책임으로 처리하며, 어디에서 실패할 수 있는지 설명하는 능력**이라는 점을 배웠다.

`log.info()` 뒤에는 로깅 API와 구현체, 운영체제의 파일 I/O가 있다. Vector를 거치면 프로세스 간 데이터 전달과 파일 오프셋, 체크포인트, 버퍼, 재시도가 등장한다. 저장소로 넘어가면 Label과 인덱스, 검색 비용이 중요해지고, 여러 서비스의 요청을 연결하려면 Trace Context 전파까지 고려해야 한다.

다만 이번 글은 **전체 실행 흐름과 책임을 이해한 단계**다. Vector의 내부 자료구조나 Loki의 실제 인덱스 구현, 장애 상황에서의 전달 보장을 실험으로 확인한 것은 아니다. 이해한 범위와 아직 검증하지 않은 범위를 구분해 두고, 다음 편에서 내부 동작으로 더 깊이 들어가려고 한다.

## 시리즈 2편 예고 — Observability 내부 동작을 CS로 검증하기

다음 편에서는 이 글에서 열린 질문으로 남겨둔 주제를 운영체제·자료구조·네트워크·동시성 관점에서 살펴볼 계획이다.

### 1. OS: Vector의 파일 읽기는 실제로 어떻게 동작할까?

- `read()` 시스템 콜과 User Space / Kernel Space
- VFS, inode, 파일 디스크립터
- Page Cache, 디스크 I/O, `fsync()`
- 로그 파일 Rotation 시 기존 파일과 새 파일 식별

**검증 질문:** 파일 이름이 변경되거나 파일이 삭제된 뒤에도 열려 있던 FD로 데이터를 읽을 수 있을까?

### 2. 자료구조: 로그 버퍼에 데이터가 쌓이면 어떻게 될까?

- Queue, FIFO, Ring Buffer의 특성
- 생산자–소비자 모델과 처리량 차이
- 버퍼 용량, 메모리 비용, 동시 접근
- 개념적인 자료구조와 Vector의 실제 구현 구분

**검증 질문:** 생산 속도가 소비 속도보다 지속적으로 빠르면 메모리와 처리량에 어떤 변화가 발생할까?

### 3. 저장소: Loki는 로그를 어떤 구조로 찾아낼까?

- B-tree/B+Tree 계열과 역색인
- Posting List, Loki TSDB 인덱스와 Chunk
- Cardinality가 스트림 수·검색 비용에 미치는 영향
- Label과 Structured Metadata의 트레이드오프

**검증 질문:** `orderId`를 Indexed Label로 넣었을 때와 Structured Metadata로 넣었을 때 어떤 차이가 발생할까?

### 4. 네트워크·분산 시스템: 전달 성공은 어디까지 보장할 수 있을까?

- TCP ACK, 소켓 버퍼, Window와 HTTP 응답 구분
- At-most-once / At-least-once / Exactly-once의 조건
- Timeout, 재시도, Backoff, Jitter
- ACK 시점과 체크포인트, 버퍼 영속성

**검증 질문:** Loki가 로그를 처리한 직후 응답이 끊기면 Agent는 어떻게 판단하고 재시도할까?

### 5. JVM·동시성: 관측 데이터를 만드는 비용은 얼마일까?

- JVM Heap, 객체 할당, GC Pause
- Vector와 Logstash의 실행 환경 차이
- ThreadLocal, 스레드 풀, MDC 오염
- TaskDecorator와 Context Propagation
- `traceparent` 전파 실패와 Span 연결

**1편에서는 전체 경로를 이해했다. 2편에서는 그 경로를 구성하는 OS·자료구조·네트워크의 내부 동작을 실제로 검증한다.**

---

## 참고 자료

- [Spring Boot — Observability](https://docs.spring.io/spring-boot/reference/actuator/observability.html)
- [Vector — Documentation](https://vector.dev/docs/)
- [Vector — File Source](https://vector.dev/docs/reference/configuration/sources/file/)
- [Grafana Loki — Documentation](https://grafana.com/docs/loki/latest/)
- [Prometheus — Overview](https://prometheus.io/docs/introduction/overview/)
- [OpenTelemetry — Documentation](https://opentelemetry.io/docs/)
- [W3C — Trace Context](https://www.w3.org/TR/trace-context/)
- [PostgreSQL — Indexes](https://www.postgresql.org/docs/current/indexes.html)
