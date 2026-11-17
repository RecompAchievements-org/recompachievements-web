# Build: docker build -t recompachievements-api backend
# Multi-stage: the SDK image compiles and publishes; the runtime image is Microsoft's minimal
# "chiseled" ASP.NET image (no shell or package manager, runs as a non-root user).

FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG TARGETARCH
WORKDIR /src

# Restore first so this layer is cached until project files or package versions change.
COPY global.json Directory.Build.props Directory.Packages.props ./
COPY src/RecompAchievements.Api/RecompAchievements.Api.csproj src/RecompAchievements.Api/
RUN dotnet restore src/RecompAchievements.Api/RecompAchievements.Api.csproj -a $TARGETARCH -p:PublishReadyToRun=true

COPY src/ src/
# ReadyToRun precompiles to native code for fast startup; JIT and Dynamic PGO still optimize hot paths.
RUN dotnet publish src/RecompAchievements.Api/RecompAchievements.Api.csproj \
    -c Release -a $TARGETARCH --no-restore \
    -p:PublishReadyToRun=true \
    -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled AS runtime
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "RecompAchievements.Api.dll"]
