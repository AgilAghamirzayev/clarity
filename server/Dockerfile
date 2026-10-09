FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
COPY src src
RUN mvn -B package -DskipTests
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 app
COPY --from=build /build/target/csi-api-1.0.0.jar app.jar
USER 10001
ENV API_BIND=0.0.0.0
EXPOSE 8086
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
