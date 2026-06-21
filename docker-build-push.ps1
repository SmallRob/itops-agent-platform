# ============================================================
# ITOps Agent Platform - Docker Build & Push Script (PowerShell)
# ============================================================
# Usage:
#   .\docker-build-push.ps1 [OPTIONS]
#
# Examples:
#   # Build locally
#   .\docker-build-push.ps1
#
#   # Build and push to Docker Hub
#   .\docker-build-push.ps1 -Username your-username -Version v1.0.0 -Push
#
#   # Build and push to custom registry
#   .\docker-build-push.ps1 -Registry registry.example.com -Username your-org -Version 1.0.0 -Push
# ============================================================

param(
    [string]$Registry = "docker.io",
    [string]$Username = "",
    [string]$Version = "latest",
    [switch]$Push,
    [switch]$NoCache
)

$ErrorActionPreference = "Stop"

# Build image names
if ([string]::IsNullOrEmpty($Username) -and -not $Push) {
    $BackendImage = "itops-backend:$Version"
    $FrontendImage = "itops-frontend:$Version"
    Write-Host "[WARN] No registry username specified, building local images only" -ForegroundColor Yellow
} else {
    $BackendImage = "$Registry/$Username/itops-backend:$Version"
    $FrontendImage = "$Registry/$Username/itops-frontend:$Version"
}

# Build options
$BuildOpts = @()
if ($NoCache) {
    $BuildOpts += "--no-cache"
}

# Print configuration
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " ITOps Agent Platform - Docker Build" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Registry:  $Registry"
Write-Host "Username:  $(if ([string]::IsNullOrEmpty($Username)) {'local'} else {$Username})"
Write-Host "Version:   $Version"
Write-Host "Backend:   $BackendImage"
Write-Host "Frontend:  $FrontendImage"
Write-Host "Push:      $Push"
Write-Host "No Cache:  $NoCache"
Write-Host "==========================================" -ForegroundColor Cyan

# Build Backend Image
Write-Host "[INFO] Building backend image..." -ForegroundColor Blue
docker build @BuildOpts -f docker/Dockerfile.backend -t $BackendImage .
if ($LASTEXITCODE -ne 0) {
    throw "Backend image build failed"
}
Write-Host "[SUCCESS] Backend image built successfully" -ForegroundColor Green

# Build Frontend Image
Write-Host "[INFO] Building frontend image..." -ForegroundColor Blue
docker build @BuildOpts -f docker/Dockerfile.frontend -t $FrontendImage .
if ($LASTEXITCODE -ne 0) {
    throw "Frontend image build failed"
}
Write-Host "[SUCCESS] Frontend image built successfully" -ForegroundColor Green

# Push images if requested
if ($Push) {
    if ([string]::IsNullOrEmpty($Username)) {
        throw "Username is required when pushing images"
    }

    Write-Host "[INFO] Pushing images to $Registry..." -ForegroundColor Blue
    
    # Login to registry
    if ($Registry -eq "docker.io") {
        Write-Host "[INFO] Please login to Docker Hub..." -ForegroundColor Blue
        docker login
    } else {
        Write-Host "[INFO] Please login to $Registry..." -ForegroundColor Blue
        docker login $Registry
    }
    
    # Push backend
    Write-Host "[INFO] Pushing backend image..." -ForegroundColor Blue
    docker push $BackendImage
    if ($LASTEXITCODE -ne 0) {
        throw "Backend image push failed"
    }
    Write-Host "[SUCCESS] Backend image pushed: $BackendImage" -ForegroundColor Green
    
    # Push frontend
    Write-Host "[INFO] Pushing frontend image..." -ForegroundColor Blue
    docker push $FrontendImage
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend image push failed"
    }
    Write-Host "[SUCCESS] Frontend image pushed: $FrontendImage" -ForegroundColor Green
}

# Show image sizes
Write-Host "[INFO] Image sizes:" -ForegroundColor Blue
docker images | Select-String "itops-backend|itops-frontend"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " All operations completed successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# Show next steps
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Next Steps:" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if (-not $Push) {
    Write-Host "To test locally:"
    Write-Host "  docker run -d -p 3001:3001 --name itops-backend $BackendImage"
    Write-Host "  docker run -d -p 8080:80 --name itops-frontend $FrontendImage"
    Write-Host ""
    Write-Host "To push to registry:"
    Write-Host "  .\docker-build-push.ps1 -Username <username> -Version <version> -Push"
} else {
    Write-Host "Users can now pull your images with:"
    Write-Host "  docker pull $BackendImage"
    Write-Host "  docker pull $FrontendImage"
    Write-Host ""
    Write-Host "Run with docker-compose:"
    Write-Host "  1. Update docker-compose.yml image fields"
    Write-Host "  2. docker-compose up -d"
}

Write-Host "==========================================" -ForegroundColor Cyan
