# Entry-point sweep

Search patterns to enumerate attack surface from source. Detection only — none of these
commands modify anything. Prefer `rg`; fall back to `grep -rn` and note the reduced
coverage.

Always exclude vendored trees: `--glob '!**/node_modules/**' --glob '!**/vendor/**'
--glob '!**/target/**' --glob '!**/dist/**'`.

## HTTP surface

```bash
# Java / Kotlin - Spring
rg -n '@(Get|Post|Put|Patch|Delete|Request)Mapping|@RestController|@Controller|@FeignClient' -g '*.java' -g '*.kt'
# Java - JAX-RS
rg -n '@(GET|POST|PUT|PATCH|DELETE)\b|@Path\(' -g '*.java'
# Node - Express / Fastify / Koa / Hapi
rg -n '\b(app|router|server|fastify)\.(get|post|put|patch|delete|all|route)\(' -g '*.ts' -g '*.js'
# Node - NestJS
rg -n '@(Get|Post|Put|Patch|Delete|All)\(|@Controller\(' -g '*.ts'
# Python - Django / Flask / FastAPI
rg -n 'urlpatterns|re_path\(|path\(|@(app|router|bp)\.(get|post|put|patch|delete|route)' -g '*.py'
# Go
rg -n 'http\.HandleFunc|mux\.(Handle|HandleFunc)|\.(GET|POST|PUT|PATCH|DELETE)\(' -g '*.go'
# .NET
rg -n '\[Http(Get|Post|Put|Patch|Delete)\]|MapGet\(|MapPost\(|\[ApiController\]' -g '*.cs'
# Route tables declared in config
rg -n 'ingress|location\s+/|proxy_pass|routes:' -g '*.yaml' -g '*.yml' -g '*.conf'
```

## Non-HTTP entry points (the ones that get missed)

```bash
# Message consumers
rg -n '@KafkaListener|@RabbitListener|@SqsListener|@JmsListener|\.subscribe\(|consumer\.on\('
# Scheduled work (runs with elevated identity, often unauthenticated by construction)
rg -n '@Scheduled|CronJob|cron\.schedule|celery|@Cron\('
# gRPC / GraphQL
rg -n 'service\s+\w+\s*\{' -g '*.proto'
rg -n 'buildSchema|typeDefs|@Resolver|Query\s*\{|Mutation\s*\{' -g '*.ts' -g '*.graphql'
# WebSocket / SSE
rg -n 'WebSocketHandler|@ServerEndpoint|new WebSocketServer|EventSource|text/event-stream'
# File and archive ingestion
rg -n 'MultipartFile|multer|FileUpload|ZipInputStream|TarArchive|extractall|unzip'
# Third-party webhooks
rg -n 'webhook|/hooks/|X-Hub-Signature|Stripe-Signature|X-Signature'
```

## Outbound calls (SSRF and supply-chain surface)

```bash
rg -n 'HttpClient|RestTemplate|WebClient|OkHttp|fetch\(|axios\.|got\(|requests\.(get|post)|urllib|net/http|HttpWebRequest'
```
For each hit, answer: is any part of the URL (scheme, host, port, path) influenced by input?

## Dangerous sinks

```bash
# Deserialisation
rg -n 'ObjectInputStream|readObject|enableDefaultTyping|@JsonTypeInfo|yaml\.load\(|pickle\.loads|Marshal\.load|unserialize\(|BinaryFormatter'
# XML / XXE
rg -n 'DocumentBuilderFactory|SAXParserFactory|XMLInputFactory|TransformerFactory|etree\.parse|libxml|XmlReader'
# Command execution
rg -n 'Runtime\.getRuntime\(\)\.exec|ProcessBuilder|child_process|exec\(|execSync|subprocess\.|os\.system|syscall\.Exec'
# Dynamic SQL
rg -n 'nativeQuery|createQuery\(|createNativeQuery|\.raw\(|knex\.raw|cursor\.execute|StringBuilder.*SELECT|\+\s*"\s*(WHERE|AND|ORDER BY)'
# Dynamic code
rg -n '\beval\(|new Function\(|setTimeout\("|Class\.forName|reflection'
# Path handling
rg -n 'new File\(|Paths\.get\(|path\.join\(|os\.path\.join|filepath\.Join|sendFile|Files\.copy'
# Template rendering with user data
rg -n 'Velocity|Freemarker|Thymeleaf|Handlebars\.compile|render_template_string|innerHTML|dangerouslySetInnerHTML|bypassSecurityTrust'
```

## Authorisation decision points

```bash
rg -n '@PreAuthorize|@PostAuthorize|@Secured|@RolesAllowed|hasRole|hasAuthority|SecurityFilterChain|authorizeHttpRequests'
rg -n 'CanActivate|AuthGuard|passport\.authenticate|requireAuth|isAuthenticated|@UseGuards'
rg -n 'permission_required|login_required|IsAuthenticated|has_perm|Depends\(get_current_user\)'
rg -n 'tenant_id|tenantId|organizationId|accountId|workspaceId'
```
Cross-reference: every route from the HTTP sweep must appear in this output or in a global
deny-by-default configuration. Routes in neither are missing-authorisation candidates
(CWE-862).

## Deployment reality

```bash
fd -H -t f 'Dockerfile|docker-compose.*\.ya?ml|\.tf$|\.tfvars$' .
fd -H -t f -e yaml -e yml . k8s manifests deploy 2>/dev/null
fd -H -t f . .github/workflows .gitlab-ci.yml Jenkinsfile 2>/dev/null
rg -n 'privileged|hostNetwork|runAsRoot|allowPrivilegeEscalation|0\.0\.0\.0|NodePort|LoadBalancer'
rg -n 'cors|CorsConfiguration|allowedOrigins|Access-Control-Allow'
```

## Surfaces teams forget

Health, readiness and metrics endpoints · actuator/admin/debug routes · Swagger/OpenAPI UI
in production · GraphQL introspection · error pages rendering user input · static file
handlers serving an upload directory · legacy `/v1` routes kept for one client · feature
flags defaulting on · impersonation and "log in as customer" support tooling · data export
and report generation · email templates rendering user content · SSR pages hydrating
untrusted data · CORS preflight-only routes · seed and migration endpoints · anything under
`internal/` that is reachable from the ingress.

## Recording

Every hit becomes a row in `entry-points.md` with the seven columns from Phase 2. A hit you
decide is not an entry point still gets a row, with the reason. Silent exclusion is how
attack surface disappears from a model.
