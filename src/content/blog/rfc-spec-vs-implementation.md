---
title: 'RFC 스펙과 실제 구현체의 차이'
description: 'WebSocket Ping/Pong을 예로 RFC 6455가 정의한 규칙이 Tomcat에서는 어떻게 구현되어 있는지 비교하며 스펙과 구현체를 읽는 방법을 정리했다.'
pubDate: 2026-11-04
tags: ['network', 'websocket', 'rfc', 'tomcat']
topic: 'cs/network'
---

멘토링 내용을 다시 보면서 RFC 스펙과 실제 구현체를 비교해 보라는 부분이 잘 이해되지 않아 정리했다.

처음에는 RFC에서 동작을 정의했다면 실제 프로그램도 당연히 그 규칙대로 동작해야 하는 것 아닌가 싶었다. 그런데 막상 비교하려고 하니 무엇을 기준으로 봐야 하는지 몰랐다.

이번에는 WebSocket의 Ping/Pong을 예로 들어 RFC에서 정의한 규칙이 Tomcat에서는 어떻게 구현되어 있는지 살펴봤다.

## RFC 스펙이란?

RFC(Request for Comments)는 인터넷에서 사용하는 프로토콜의 동작과 규칙 등을 설명하는 문서다.

예를 들어 HTTP에는 메서드와 상태 코드의 의미 등이 정의되어 있고, WebSocket에는 프레임 구조, Ping/Pong, 연결 종료 방식 등이 정의되어 있다.

브라우저와 서버가 서로 다른 프로그램이어도 통신할 수 있는 이유는 공통된 프로토콜 규칙을 따르기 때문이다. 다만 모든 RFC가 표준인 것은 아니고, 문서마다 성격과 상태가 다르다.

## 스펙과 구현체의 차이

처음에는 스펙과 구현체의 차이를 단순히 규칙과 코드의 차이라고 이해했다.

- **스펙:** 어떻게 동작해야 하는지 정의한 규칙
- **구현체:** 정의된 규칙을 실제 코드로 구현한 소프트웨어

예를 들어 RFC 6455는 WebSocket 프로토콜의 규칙을 정의하고, Tomcat은 WebSocket을 처리하는 기능을 구현한다.

여기서 중요한 것은 **같은 동작을 기준으로 비교해야 한다**는 점이다. RFC에서 Ping/Pong의 동작을 정의했다면 Tomcat에서도 Ping/Pong을 처리하는 코드를 찾아봐야 한다.

Tomcat과 Jetty는 같은 WebSocket 규칙을 따르면서도 내부 구현 방식은 다를 수 있다. 스펙이 구현체의 모든 내부 코드 구조까지 정하는 것은 아니기 때문이다.

## WebSocket Ping/Pong으로 비교해 보기

RFC와 구현체를 실제로 어떻게 비교하는지 이해하기 위해 WebSocket의 Ping/Pong을 살펴봤다.

### 1. RFC에서는 어떻게 정의할까?

WebSocket에서는 데이터를 프레임(Frame)이라는 단위로 주고받는다. 프레임에는 `opcode`라는 값이 있다.

opcode는 Operation Code의 약자로, WebSocket에서는 수신한 프레임이 어떤 종류인지 구분하는 데 사용한다.

| opcode | 종류 | 의미 |
|---|---|---|
| `0x1` | Text | 텍스트 데이터 |
| `0x2` | Binary | 바이너리 데이터 |
| `0x8` | Close | 연결 종료 |
| `0x9` | Ping | 상대방에게 응답을 요청하는 제어 프레임 |
| `0xA` | Pong | Ping에 대한 응답 등에 사용하는 제어 프레임 |

RFC 6455 Section 5.5.2에서는 Ping 프레임을 수신하면 Pong 프레임으로 응답해야 한다고 정의한다. 단, 이미 Close 프레임을 수신했다면 예외다.

여기서 RFC는 `MUST`라는 표현을 사용한다. MUST는 반드시 지켜야 한다는 뜻이다.

처음에는 MUST라는 표현이 있으면 어떤 상황에서든 무조건 실행해야 한다고 생각했다. 하지만 Ping/Pong 규칙에는 Close 프레임을 이미 수신한 경우라는 예외가 있다.

따라서 RFC를 읽을 때는 반드시 해야 한다는 표현뿐 아니라 **그 규칙이 적용되는 조건과 예외도 함께 확인해야 한다.**

또한 Ping에 대한 응답 Pong은 Ping과 동일한 애플리케이션 데이터를 포함해야 한다.

### 2. Tomcat에서는 어떻게 구현했을까?

Tomcat의 `WsFrameBase.java`에서 WebSocket 제어 프레임을 처리하는 `processDataControl()` 메서드를 살펴봤다.

Ping 프레임을 처리하는 부분에는 다음과 같은 코드가 있다.

```java
if (opCode == Constants.OPCODE_PING) {
    if (wsSession.isOpen()) {
        try {
            wsSession.getBasicRemote()
                     .sendPong(controlBufferBinary);
        } catch (IllegalStateException | EOFException e) {
            if (!wsSession.isClosing()) {
                throw e;
            }
        }
    }
}
```

코드를 하나씩 살펴보면 다음과 같다.

**`opCode == Constants.OPCODE_PING`**

수신한 프레임이 Ping인지 확인한다. RFC에서 Ping의 opcode를 `0x9`로 정의하고 있기 때문에 Tomcat에서도 이 값에 해당하는 상수를 통해 프레임의 종류를 구분한다.

**`wsSession.isOpen()`**

현재 WebSocket 세션이 열려 있는지 확인한다.

**`sendPong(controlBufferBinary)`**

Pong 프레임 전송을 시도한다. 수신한 Ping의 데이터를 전달하여 응답 Pong에 동일한 데이터를 포함하도록 처리한다.

이 코드를 통해 Tomcat이 Ping을 구분하고, 세션 상태를 확인한 뒤 Pong 전송을 시도한다는 것을 알 수 있었다.

### 3. RFC와 Tomcat의 조건은 같은 의미일까?

여기서 한 가지 궁금한 점이 생겼다.

RFC에서는 이미 Close 프레임을 수신했다면 Pong을 보내지 않아도 된다고 설명한다. 그런데 Tomcat 코드에서는 `wsSession.isOpen()`으로 세션이 열려 있는지 확인한다.

처음에는 세션이 닫혀 있다는 것이 Close 프레임을 받았다는 의미라고 생각했다. 하지만 둘은 완전히 같은 의미가 아니었다.

예를 들어 클라이언트가 서버로 Close 프레임을 보냈다면 서버는 Close를 수신하고 연결 종료를 처리하게 된다. 반대로 서버가 먼저 연결 종료를 시작할 수도 있다.

두 번째 경우에는 세션이 열려 있지 않더라도 상대방의 Close 프레임을 이미 수신했다고 볼 수는 없다.

즉, 두 조건은 서로 다른 질문이다.

- **RFC:** 상대방의 Close 프레임을 이미 수신했는가?
- **Tomcat:** 현재 세션이 열려 있는가?

따라서 `isOpen()`이 false라는 사실만으로 RFC의 예외 조건에 해당한다고 단정해서는 안 된다.

세션이 왜 닫혔는지, Close 프레임을 언제 주고받았는지 등 실제 종료 흐름까지 확인해야 한다. 또한 WebSocket 연결 종료에는 별도의 프로토콜 규칙이 있으므로 Ping/Pong 규칙만 가지고 모든 종료 상황을 판단할 수는 없다.

이 부분을 공부하면서 **스펙에서 사용하는 조건과 구현체의 내부 상태값을 같은 의미라고 가정하면 안 된다**는 것을 알게 되었다.

## 실제 동작과 비교한다는 것은?

처음에는 실행 흐름을 추적한다는 말 자체가 막연했다.

이번에는 클라이언트가 Ping을 보냈지만 Pong을 받지 못했다고 가정해 봤다. 이 상황에서 바로 Tomcat이 RFC를 지키지 않았다고 판단할 수 있을까?

먼저 다음 내용을 확인해야 한다.

1. 클라이언트가 실제 Ping 프레임을 전송했는가?
2. Tomcat이 Ping 프레임을 수신했는가?
3. 수신한 프레임이 유효한 Ping 프레임인가?
4. Tomcat에서 Ping 처리 코드까지 실행했는가?
5. 그전에 Close 프레임을 수신했는가?
6. `isOpen()`이 false라면 세션이 언제, 왜 닫혔는가?
7. Pong 전송을 시도했고 실제로 전송되었는가?

이 순서로 확인해야 문제가 발생한 범위를 좁힐 수 있다.

특히 `sendPong()`을 호출했다는 사실과 클라이언트가 Pong을 실제로 수신했다는 사실도 구분해야 한다. 전송을 시도했더라도 네트워크 문제 등으로 클라이언트가 받지 못할 수 있기 때문이다.

이번에는 RFC 문서와 Tomcat 소스 코드를 비교한 것이고, 실제 Ping/Pong 장애를 재현하거나 테스트한 것은 아니다.

## 정리

이번에 공부하면서 스펙과 구현체를 비교한다는 말이 조금 더 구체적으로 이해됐다.

처음에는 RFC에서 정한 동작과 코드가 같은지만 확인하면 된다고 생각했다. 하지만 실제로는 **스펙이 요구하는 동작과 조건을 확인하고, 구현체가 그 요구사항을 어떤 코드와 상태 판단으로 처리하는지 확인하는 과정**이었다.

앞으로 예상과 다른 동작이 발생하면 다음 순서로 확인해 보려고 한다.

1. 내가 기대한 동작은 무엇인가?
2. 그 기대는 어디에 정의되어 있는가?
3. 스펙에서는 어떤 조건과 예외를 정하고 있는가?
4. 실제 구현체에서는 어떤 코드로 처리하고 있는가?
5. 실제 실행 흐름에서 어떤 결과가 발생했는가?

이전에는 문제가 발생하면 바로 구현 코드부터 찾아보려고 했다. 이제는 내가 기대한 동작이 어디에서 정의된 것인지 먼저 확인하고, 그 동작을 실제로 처리하는 코드를 찾아봐야겠다.

모든 문제에서 RFC를 확인할 필요는 없다. 먼저 어떤 규칙이나 계약과 관련된 문제인지 구분하는 습관부터 들이려고 한다.

## 참고 자료

- [RFC 6455 - The WebSocket Protocol](https://www.rfc-editor.org/rfc/rfc6455)
- [RFC 6455 - Section 5.5.2 Ping](https://datatracker.ietf.org/doc/html/rfc6455#section-5.5.2)
- [RFC 6455 - Section 5.5.3 Pong](https://datatracker.ietf.org/doc/html/rfc6455#section-5.5.3)
- [Apache Tomcat - WsFrameBase.java](https://github.com/apache/tomcat/blob/main/java/org/apache/tomcat/websocket/WsFrameBase.java)

*Tomcat 소스는 GitHub main 브랜치를 참고했다. 실제 특정 버전의 동작을 분석할 때는 해당 버전의 소스를 기준으로 확인해야 한다.*
