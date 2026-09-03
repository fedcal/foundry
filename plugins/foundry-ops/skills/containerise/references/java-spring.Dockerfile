# syntax=docker/dockerfile:1
#
# Spring Boot with layered-jar extraction. Resolve every <PLACEHOLDER>:
#   docker buildx imagetools inspect <JDK-IMAGE>:<TAG> --format '{{ .Manifest.Digest }}'
#   docker buildx imagetools inspect <JRE-IMAGE>:<TAG> --format '{{ .Manifest.Digest }}'
# JAVA-VER: read it from the build file, do not assume.
#   mvn help:evaluate -Dexpression=maven.compiler.release -q -DforceStdout

# --------------------------------------------------------------- build ----
FROM <JDK-IMAGE>:<TAG>@sha256:<DIGEST> AS build
WORKDIR /build

# Maven: manifests first so the dependency layer survives source edits.
COPY pom.xml ./
COPY .mvn/ .mvn/
COPY mvnw ./
RUN --mount=type=cache,target=/root/.m2,sharing=locked \
    ./mvnw -B -ntp dependency:go-offline

COPY src/ src/
RUN --mount=type=cache,target=/root/.m2,sharing=locked \
    ./mvnw -B -ntp -DskipTests package

# Gradle equivalent:
#   COPY build.gradle.kts settings.gradle.kts gradle.properties ./
#   COPY gradle/ gradle/
#   COPY gradlew ./
#   RUN --mount=type=cache,target=/home/gradle/.gradle,sharing=locked \
#       ./gradlew --no-daemon dependencies
#   COPY src/ src/
#   RUN --mount=type=cache,target=/home/gradle/.gradle,sharing=locked \
#       ./gradlew --no-daemon bootJar -x test

# ------------------------------------------------------------- extract ----
# Layered extraction splits the fat jar into layers that change at different
# rates: dependencies (rarely) ... application (every commit). Without this the
# whole jar is one layer and every commit re-pushes ~50 MB of unchanged libraries.
FROM <JDK-IMAGE>:<TAG>@sha256:<DIGEST> AS extract
WORKDIR /extracted
COPY --from=build /build/target/*.jar app.jar
RUN java -Djarmode=tools -jar app.jar extract --layers --destination . \
 || java -Djarmode=layertools -jar app.jar extract
# Two jarmodes exist across Spring Boot generations; the fallback keeps this
# template working on both. Check which one your version supports and keep one.

# ----------------------------------------------------------------- dev ----
FROM <JDK-IMAGE>:<TAG>@sha256:<DIGEST> AS dev
WORKDIR /app
COPY . .
EXPOSE 8080 5005
# Remote debugging bound to all interfaces is acceptable in dev ONLY.
CMD ["./mvnw", "-B", "-ntp", "spring-boot:run", \
     "-Dspring-boot.run.jvmArguments=-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005"]

# ------------------------------------------------------------- runtime ----
# JRE, not JDK: no compiler, no jlink tooling, far less to scan and to pull.
FROM <JRE-IMAGE>:<TAG>@sha256:<DIGEST> AS runtime
WORKDIR /app

# Layer order = change frequency order. Dependencies first, application last.
COPY --from=extract --chown=10001:10001 /extracted/dependencies/ ./
COPY --from=extract --chown=10001:10001 /extracted/spring-boot-loader/ ./
COPY --from=extract --chown=10001:10001 /extracted/snapshot-dependencies/ ./
COPY --from=extract --chown=10001:10001 /extracted/application/ ./

# MaxRAMPercentage makes the heap a fraction of the CGROUP limit. A JVM that
# sizes itself from host memory will be OOMKilled in a container. Leave room for
# metaspace, code cache, thread stacks and direct buffers - the heap is not the
# whole footprint. 70-75 is the usual starting range; verify with a load test.
# ExitOnOutOfMemoryError turns a wedged, unrecoverable heap into a clean restart.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=<PERCENT> -XX:+ExitOnOutOfMemoryError -XX:+UseContainerSupport" \
    TMPDIR=/tmp \
    SERVER_PORT=8080

USER 10001:10001
EXPOSE 8080

LABEL org.opencontainers.image.source="<REPO-URL>" \
      org.opencontainers.image.revision="<GIT-SHA>" \
      org.opencontainers.image.licenses="<SPDX-ID>"

# Exec form. The JVM handles SIGTERM by running shutdown hooks; Spring Boot's
# graceful shutdown must be enabled explicitly:
#   server.shutdown=graceful
#   spring.lifecycle.timeout-per-shutdown-phase=<DURATION>
# and the Kubernetes terminationGracePeriodSeconds must exceed that value plus
# the preStop delay, or the kubelet SIGKILLs mid-request.
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
# Older Spring Boot generations use org.springframework.boot.loader.JarLauncher.
# Check which class your extracted layout contains before pinning this line.
