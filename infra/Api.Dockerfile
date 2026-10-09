FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /build
COPY server/pom.xml ./pom.xml
RUN mvn -q dependency:go-offline
COPY server/src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN groupadd --system csi && useradd --system --gid csi csi
WORKDIR /app
COPY --from=build /build/target/csi-api-1.0.0.jar /app/api.jar
USER csi
ENV API_BIND=0.0.0.0
EXPOSE 8086
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=70", "-jar", "/app/api.jar"]
