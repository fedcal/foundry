# Worked example — the Orders service

One service, both faces: a synchronous HTTP contract for the client applications and an
asynchronous contract for the events it publishes. Everything the SKILL.md rules ask for is
present, so this file doubles as the reference implementation of those rules.

Domain input (from `domain-modeler`): context **Sales**, aggregate **Order**, commands
`PlaceOrder`, `CancelOrder`, invariant `INV-sales-1: at every commit of Order,
sum(lines.quantity) >= 1`.

---

## `contracts/http/orders.openapi.yaml`

```yaml
openapi: 3.1.0
info:
  title: Orders API
  version: "1.4.0"          # documentation version; the interface version is the /v1 in the path
  description: |
    Sales context. Places and cancels customer orders.
    Errors are RFC 9457 problem details; every `type` is catalogued in shared/problems.yaml.
  license: { name: Apache-2.0, identifier: Apache-2.0 }
servers:
  - url: https://api.acme.com/v1
    description: production

security:
  - oauth2: [orders:read]

paths:
  /orders:
    get:
      operationId: listOrders
      summary: List orders visible to the caller, newest first
      security: [{ oauth2: [orders:read] }]
      parameters:
        - $ref: "#/components/parameters/Limit"
        - $ref: "#/components/parameters/Cursor"
        - name: status
          in: query
          schema: { type: string, enum: [placed, confirmed, cancelled] }
      responses:
        "200":
          description: >
            A page of orders sorted by (placedAt DESC, id DESC). The tiebreaker on `id` makes the
            order total, which is what makes the cursor unambiguous.
          headers:
            Link:
              description: RFC 8288 web links; `rel="next"` mirrors page.nextCursor.
              schema: { type: string }
          content:
            application/json:
              schema:
                type: object
                required: [items, page]
                properties:
                  items:
                    type: array
                    items: { $ref: "#/components/schemas/Order" }
                  page: { $ref: "#/components/schemas/PageInfo" }
              examples:
                firstPage:
                  value:
                    items:
                      - id: "ord_01HZ", status: placed, placedAt: "2026-08-27T09:12:04Z", total: { amount: "84.50", currency: EUR }
                    page: { nextCursor: "eyJwIjoiMjAyNi0wOC0yN1QwOToxMjowNFoiLCJpIjoib3JkXzAxSFoifQ" }
                lastPage:
                  value: { items: [], page: { nextCursor: null } }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "429": { $ref: "#/components/responses/TooManyRequests" }
        "500": { $ref: "#/components/responses/InternalError" }

    post:
      operationId: placeOrder
      summary: Place a new order
      security: [{ oauth2: [orders:write] }]
      parameters:
        - $ref: "#/components/parameters/IdempotencyKey"
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/PlaceOrderRequest" }
            examples:
              twoLines:
                value:
                  customerId: "cus_9F2"
                  lines:
                    - { sku: "ACME-114", quantity: 2 }
                    - { sku: "ACME-880", quantity: 1 }
      responses:
        "201":
          description: Order placed. Replaying the same Idempotency-Key returns this same response.
          headers:
            Location: { schema: { type: string, format: uri }, required: true }
            ETag:     { schema: { type: string }, required: true }
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Order" }
        "409":
          description: A request with this Idempotency-Key is still in flight.
          content:
            application/problem+json:
              schema: { $ref: "#/components/schemas/Problem" }
              example:
                type: "https://api.acme.com/problems/idempotency-key-in-flight"
                title: "A request with this idempotency key is still being processed"
                status: 409
                traceId: "01HZ8Q4P0R"
        "422":
          description: >
            Semantically rejected. Either a business rule failed (e.g. insufficient stock) or the
            Idempotency-Key was reused with a different body.
          content:
            application/problem+json:
              schema: { $ref: "#/components/schemas/Problem" }
              examples:
                businessRule:
                  value:
                    type: "https://api.acme.com/problems/insufficient-stock"
                    title: "Not enough stock to place this order"
                    status: 422
                    detail: "SKU ACME-114 has 1 unit available, 2 requested."
                    traceId: "01HZ8Q4P0R"
                    errors:
                      - { pointer: "/lines/0/quantity", code: "above_available_stock", detail: "1 available" }
                keyReuse:
                  value:
                    type: "https://api.acme.com/problems/idempotency-key-reuse"
                    title: "Idempotency key already used with a different request body"
                    status: 422
                    traceId: "01HZ8Q4P0R"
        "401": { $ref: "#/components/responses/Unauthorized" }
        "429": { $ref: "#/components/responses/TooManyRequests" }
        "500": { $ref: "#/components/responses/InternalError" }

  /orders/{orderId}:
    parameters:
      - name: orderId
        in: path
        required: true
        schema: { type: string }
    get:
      operationId: getOrder
      summary: Read one order
      security: [{ oauth2: [orders:read] }]
      responses:
        "200":
          description: The order.
          headers:
            ETag: { schema: { type: string }, required: true }
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Order" }
        "404": { $ref: "#/components/responses/NotFound" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "500": { $ref: "#/components/responses/InternalError" }

  /orders/{orderId}/cancellation:
    parameters:
      - name: orderId
        in: path
        required: true
        schema: { type: string }
    put:
      operationId: cancelOrder
      summary: Cancel an order
      description: >
        Modelled as a sub-resource rather than POST /cancelOrder: PUT is idempotent, so a retry is
        safe without an idempotency key, and the cancellation itself is addressable.
      security: [{ oauth2: [orders:write] }]
      parameters:
        - name: If-Match
          in: header
          required: true
          schema: { type: string }
          description: ETag of the order as last read. Prevents cancelling a state you have not seen.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [reason]
              properties:
                reason: { type: string, enum: [customer_request, fraud_suspected, stock_unavailable] }
                note:   { type: [string, "null"], maxLength: 500 }
      responses:
        "200":
          description: Cancelled (or already cancelled — this is idempotent).
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Order" }
        "412":
          description: If-Match did not match the current ETag; re-read and retry.
          content:
            application/problem+json:
              schema: { $ref: "#/components/schemas/Problem" }
        "422":
          description: The order is in a state that cannot be cancelled (e.g. already shipped).
          content:
            application/problem+json:
              schema: { $ref: "#/components/schemas/Problem" }
              example:
                type: "https://api.acme.com/problems/order-not-cancellable"
                title: "Order cannot be cancelled in its current state"
                status: 422
                detail: "Order ord_01HZ is in state shipped."
        "404": { $ref: "#/components/responses/NotFound" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "500": { $ref: "#/components/responses/InternalError" }

components:
  securitySchemes:
    oauth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://auth.acme.com/oauth2/authorize
          tokenUrl: https://auth.acme.com/oauth2/token
          scopes:
            orders:read: Read orders
            orders:write: Place and cancel orders

  parameters:
    Limit:
      name: limit
      in: query
      schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
    Cursor:
      name: cursor
      in: query
      schema: { type: string }
      description: Opaque. Copy it from page.nextCursor; never construct or parse it.
    IdempotencyKey:
      name: Idempotency-Key
      in: header
      required: true
      schema: { type: string, format: uuid }
      description: >
        Client-generated UUID for one logical attempt. Same key + identical body replays the
        original response. Same key + different body -> 422 idempotency-key-reuse.
        Same key while the first request is in flight -> 409. Retained 24 hours.
        (The header field is an IETF HTTPAPI Internet-Draft; these semantics are normative here.)

  responses:
    Unauthorized:
      description: Missing or invalid credentials.
      headers:
        WWW-Authenticate: { schema: { type: string }, required: true }
      content:
        application/problem+json: { schema: { $ref: "#/components/schemas/Problem" } }
    NotFound:
      description: Absent, or present but not visible to this caller.
      content:
        application/problem+json: { schema: { $ref: "#/components/schemas/Problem" } }
    TooManyRequests:
      description: Rate limited.
      headers:
        Retry-After: { schema: { type: integer }, required: true, description: "Seconds. RFC 9110 §10.2.3." }
      content:
        application/problem+json: { schema: { $ref: "#/components/schemas/Problem" } }
    InternalError:
      description: Our fault. traceId correlates with our logs.
      content:
        application/problem+json: { schema: { $ref: "#/components/schemas/Problem" } }

  schemas:
    Problem:
      $ref: "../shared/problems.yaml#/components/schemas/Problem"
    PageInfo:
      type: object
      required: [nextCursor]
      properties:
        nextCursor:
          type: [string, "null"]
          description: null means end of collection. An empty items array does not.
    Money:
      type: object
      required: [amount, currency]
      properties:
        amount:   { type: string, pattern: "^-?\\d+\\.\\d{2}$", description: "Decimal string. Never a float." }
        currency: { type: string, pattern: "^[A-Z]{3}$" }
    OrderLine:
      type: object
      required: [sku, quantity]
      properties:
        sku:      { type: string }
        quantity: { type: integer, minimum: 1 }
    Order:
      type: object
      required: [id, status, customerId, lines, placedAt, total]
      properties:
        id:         { type: string }
        status:     { type: string, enum: [placed, confirmed, shipped, cancelled],
                      description: "Clients MUST tolerate unknown values; new members may be added within v1." }
        customerId: { type: string }
        lines:      { type: array, minItems: 1, items: { $ref: "#/components/schemas/OrderLine" } }
        placedAt:   { type: string, format: date-time }
        cancelledAt:{ type: [string, "null"], format: date-time }
        total:      { $ref: "#/components/schemas/Money" }
    PlaceOrderRequest:
      type: object
      required: [customerId, lines]
      additionalProperties: false
      properties:
        customerId: { type: string }
        lines:      { type: array, minItems: 1, maxItems: 200, items: { $ref: "#/components/schemas/OrderLine" } }
```

### Why each awkward choice is the right one

| Choice | Reason |
|---|---|
| `PUT /orders/{id}/cancellation` instead of `POST /orders/{id}/cancel` | PUT is idempotent (RFC 9110 §9.2.2), so retries need no idempotency key, and the cancellation becomes an addressable thing |
| `amount` as a decimal **string** | IEEE-754 doubles cannot represent 0.10; a JSON number invites every client to lose cents |
| `additionalProperties: false` on the **request**, absent on the **response** | strict on input protects the server; strict on output would let a new optional response field break old clients |
| `status` enum with a tolerate-unknowns note | lets you add a member within v1 without a major bump — but only because the contract said so up front |
| 422 for business rules, 400 reserved for parse failures | lets clients distinguish "my code is wrong" from "the world says no" |
| `errors[].pointer` as a JSON Pointer (RFC 6901) | the client can highlight the exact form field without string matching |

---

## `contracts/async/orders.asyncapi.yaml`

```yaml
asyncapi: 3.0.0
info:
  title: Orders events
  version: "1.2.0"
  description: |
    Events published by the Sales context. Delivery is at-least-once: consumers MUST deduplicate
    on the envelope `id`. Ordering is guaranteed only per partition key (`subject` = order id).
servers:
  production:
    host: kafka.acme.internal:9093
    protocol: kafka-secure
    description: mTLS, SASL disabled.

channels:
  orderLifecycle:
    address: sales.orders.v1
    description: >
      Partition key is the order id, so all events for one order are ordered relative to each
      other and to nothing else. Retention 7 days. DLQ sales.orders.v1.dlq after 5 attempts.
    messages:
      orderPlaced:    { $ref: "#/components/messages/OrderPlaced" }
      orderCancelled: { $ref: "#/components/messages/OrderCancelled" }

operations:
  publishOrderLifecycle:
    action: send            # the Orders service is the document owner and it SENDS these
    channel: { $ref: "#/channels/orderLifecycle" }
    messages:
      - { $ref: "#/channels/orderLifecycle/messages/orderPlaced" }
      - { $ref: "#/channels/orderLifecycle/messages/orderCancelled" }

components:
  messageTraits:
    cloudEvent:
      headers:
        type: object
        required: [ce_id, ce_type, ce_source, ce_time, ce_subject, ce_dataschema]
        properties:
          ce_id:         { type: string, description: "Unique per event. Consumers dedupe on this." }
          ce_type:       { type: string, description: "e.g. com.acme.sales.order.placed.v1" }
          ce_source:     { type: string, format: uri }
          ce_time:       { type: string, format: date-time }
          ce_subject:    { type: string, description: "Order id. Also the partition key." }
          ce_dataschema: { type: string, format: uri }
      description: CloudEvents 1.0, Kafka binary binding — attributes travel as ce_* headers.

  messages:
    OrderPlaced:
      name: OrderPlaced
      title: An order was placed
      contentType: application/json
      traits: [{ $ref: "#/components/messageTraits/cloudEvent" }]
      payload:
        type: object
        required: [orderId, customerId, lines, placedAt, total]
        properties:
          orderId:    { type: string }
          customerId: { type: string }
          lines:
            type: array
            minItems: 1
            items:
              type: object
              required: [sku, quantity]
              properties:
                sku:      { type: string }
                quantity: { type: integer, minimum: 1 }
          placedAt: { type: string, format: date-time }
          total:
            type: object
            required: [amount, currency]
            properties:
              amount:   { type: string }
              currency: { type: string }
    OrderCancelled:
      name: OrderCancelled
      title: An order was cancelled
      contentType: application/json
      traits: [{ $ref: "#/components/messageTraits/cloudEvent" }]
      payload:
        type: object
        required: [orderId, reason, cancelledAt]
        properties:
          orderId:     { type: string }
          reason:      { type: string, enum: [customer_request, fraud_suspected, stock_unavailable] }
          cancelledAt: { type: string, format: date-time }
```

### The three things reviewers catch in AsyncAPI documents

1. **`action` written from the consumer's perspective.** This document belongs to the Orders
   service, so `send` is correct. A consumer's own document would describe the same channel with
   `action: receive`. Getting this backwards inverts every generated client.
2. **No ordering key stated.** Without "partition key is the order id" written in the channel
   description, a consumer will assume global ordering and build a broken projection.
3. **Event payloads that mirror the database row.** `OrderPlaced` carries what a consumer needs
   to act, not every column. Publishing internal state makes every schema migration a public
   breaking change.

---

## Checks to run on this pair

```bash
npx --yes @stoplight/spectral-cli lint contracts/http/orders.openapi.yaml
npx --yes @redocly/cli lint contracts/http/orders.openapi.yaml
npx --yes @asyncapi/cli validate contracts/async/orders.asyncapi.yaml
oasdiff breaking origin/main:contracts/http/orders.openapi.yaml contracts/http/orders.openapi.yaml
```

Pin each CLI to the version in `${CLAUDE_PLUGIN_ROOT}/references/stack-versions.json`.
