# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY SchoolAdmission.sln ./
COPY SchoolAdmission.Api/SchoolAdmission.Api.csproj SchoolAdmission.Api/
COPY SchoolAdmission.Tests/SchoolAdmission.Tests.csproj SchoolAdmission.Tests/
RUN dotnet restore SchoolAdmission.sln

COPY . .
RUN dotnet publish SchoolAdmission.Api/SchoolAdmission.Api.csproj -c Release -o /app/publish --no-restore

# Test target (used by `docker compose --profile test run --rm backend-tests`)
FROM build AS test
WORKDIR /src
RUN dotnet build SchoolAdmission.Tests/SchoolAdmission.Tests.csproj -c Release --no-restore
ENTRYPOINT ["dotnet", "test", "SchoolAdmission.Tests/SchoolAdmission.Tests.csproj", "-c", "Release", "--no-build", "--logger", "console;verbosity=normal"]

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]
