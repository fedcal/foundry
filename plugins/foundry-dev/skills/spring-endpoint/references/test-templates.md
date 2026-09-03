# Test templates

Original templates, Apache-2.0. Adapt names to the project; **do not** paste them unchanged
without checking the detection matrix first. Class and annotation names are stable Spring/JUnit
API; the availability of `@ServiceConnection` is version-dependent — probe for it before use
(see `references/stack-versions.json`, `featureProbes.springConfigurationProperty`).

## 1. Shared Testcontainers base

Start **one** container for the whole suite. A container per test class turns a 40 s suite into
a 12 min suite.

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
abstract class AbstractIntegrationTest {

    // Pin the SAME major as production. Read the tag from the project, never "latest".
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>(DockerImageName.parse(System.getProperty(
                    "test.postgres.image", "postgres:<MAJOR-FROM-YOUR-PROJECT>")));

    static { POSTGRES.start(); }   // JVM-lifetime container, reused by every subclass

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        // Migrations must run exactly as they do in production.
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }
}
```

If `@ServiceConnection` exists in your resolved Spring Boot version, prefer it over
`@DynamicPropertySource` — it removes the property wiring entirely. Probe, do not assume.

## 2. Slice test — routing, validation, error body

```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired MockMvc mvc;          // field injection is acceptable ONLY in tests
    @MockitoBean PlaceOrderUseCase placeOrder;   // name depends on your Spring version; probe

    @Test
    @WithMockUser(roles = "CUSTOMER")
    void rejects_a_request_with_a_blank_reference() throws Exception {
        mvc.perform(post("/v1/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"reference": "", "lines": []}
                                 """)
                        .with(csrf()))
           .andExpect(status().isBadRequest())
           // asserting the status alone lets a wrong body pass
           .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
           .andExpect(jsonPath("$.type").value("https://errors.example.test/validation-failed"))
           .andExpect(jsonPath("$.errors[0].field").value("reference"));

        verifyNoInteractions(placeOrder);   // validation must fail before the use case runs
    }

    @Test
    void rejects_an_unauthenticated_request() throws Exception {
        mvc.perform(get("/v1/orders/{id}", UUID.randomUUID()))
           .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "CUSTOMER")
    void clamps_an_oversized_page_size() throws Exception {
        mvc.perform(get("/v1/orders").param("size", "100000"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.size").value(lessThanOrEqualTo(200)));
    }
}
```

## 3. Integration test — the real path

```java
class PlaceOrderIT extends AbstractIntegrationTest {

    @Autowired TestRestTemplate http;      // or WebTestClient bound to the random port
    @Autowired OrderRepository orders;

    @Test
    void creates_an_order_and_returns_its_location() {
        var request = new PlaceOrderRequest("REF-1", List.of(new OrderLineRequest("SKU-1", 2)));

        var response = http.withBasicAuth("customer", "secret")
                           .postForEntity("/v1/orders", request, OrderResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getHeaders().getLocation()).isNotNull();
        assertThat(orders.count()).isEqualTo(1);
    }

    @Test
    void returns_409_when_the_reference_already_exists() {
        // ... seed, then repeat the call
        // 409 with a stable problem type, never a 500 from a constraint violation
    }
}
```

## 4. Statement-count regression guard

The only way an N+1 fix stays fixed. Uses Hibernate's own statistics — no extra dependency.

```java
class OrderListStatementCountIT extends AbstractIntegrationTest {

    @Autowired EntityManagerFactory emf;
    @Autowired OrderQueryService orderQuery;

    @Test
    void listing_orders_issues_a_constant_number_of_statements() {
        seedOrders(20);                       // 20 parents, each with lines
        Statistics stats = emf.unwrap(SessionFactory.class).getStatistics();
        stats.setStatisticsEnabled(true);
        stats.clear();

        orderQuery.list(PageRequest.of(0, 20));

        // The assertion that matters: constant, not proportional to 20.
        assertThat(stats.getPrepareStatementCount())
                .as("statement count must not scale with the number of rows")
                .isLessThanOrEqualTo(3);
    }
}
```

Run the same test with 1 row and with 20 rows. If the count changes, it is an N+1 regardless of
how fast it looks on a warm local database.

## 5. Optimistic-lock conflict

```java
@Test
void returns_409_when_the_aggregate_was_modified_concurrently() {
    var id = seedOrder();
    var stale = http.getForEntity("/v1/orders/{id}", OrderResponse.class, id);
    String staleEtag = stale.getHeaders().getETag();

    updateOrderOutOfBand(id);   // someone else writes, version bumps

    var headers = new HttpHeaders();
    headers.setIfMatch(staleEtag);
    var conflict = http.exchange("/v1/orders/{id}", HttpMethod.PUT,
            new HttpEntity<>(body, headers), ProblemDetail.class, id);

    assertThat(conflict.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
}
```

Missing `If-Match` on an unsafe method should give 428 Precondition Required; a stale one, 412
or 409 depending on the documented policy — pick one and assert it.

## Assertions that make a test worthless

- Asserting only the status code on an error path (the body is where the contract lives).
- `assertThat(result).isNotNull()` as the only assertion.
- Depending on data seeded by another test — every test seeds its own and cleans up, or the
  suite is order-dependent and will fail in CI at the worst time.
- Using `@Transactional` on the test to roll back: it hides commit-time failures (constraint
  violations, flush ordering) and gives a different persistence-context lifetime than
  production. Prefer explicit cleanup or a truncation strategy.
- Mocking the repository in an integration test — then it is not one.
