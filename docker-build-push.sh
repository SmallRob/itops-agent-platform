#!/bin/bash
# ============================================================
# ITOps Agent Platform - Docker Build & Push Script
# ============================================================
# Usage:
#   ./docker-build-push.sh [OPTIONS]
#
# Options:
#   -r, --registry    Container registry (default: docker.io)
#   -u, --username    Registry username (required for push)
#   -v, --version     Image version tag (default: latest)
#   --push            Push images to registry after build
#   --no-cache        Build without cache
#   --help            Show help
#
# Examples:
#   # Build locally
#   ./docker-build-push.sh
#
#   # Build and push to Docker Hub
#   ./docker-build-push.sh -u your-username -v v1.0.0 --push
#
#   # Build and push to custom registry
#   ./docker-build-push.sh -r registry.example.com -u your-org -v 1.0.0 --push
# ============================================================

set -euo pipefail

# Default values
REGISTRY="docker.io"
USERNAME=""
VERSION="latest"
PUSH=false
NO_CACHE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -u|--username)
            USERNAME="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        --push)
            PUSH=true
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --help)
            head -24 "$0" | tail -18
            exit 0
            ;;
        *)
            error "Unknown argument: $1"
            ;;
    esac
done

# Validate required parameters
if [ "$PUSH" = true ] && [ -z "$USERNAME" ]; then
    error "Username (-u) is required when pushing images"
fi

# Build image names
BACKEND_IMAGE="${REGISTRY}/${USERNAME}/itops-backend:${VERSION}"
FRONTEND_IMAGE="${REGISTRY}/${USERNAME}/itops-frontend:${VERSION}"

# If no username and not pushing, use local names
if [ -z "$USERNAME" ] && [ "$PUSH" = false ]; then
    BACKEND_IMAGE="itops-backend:${VERSION}"
    FRONTEND_IMAGE="itops-frontend:${VERSION}"
    warn "No registry username specified, building local images only"
fi

# Build options
BUILD_OPTS=""
if [ "$NO_CACHE" = true ]; then
    BUILD_OPTS="--no-cache"
fi

# Print configuration
echo "=========================================="
echo " ITOps Agent Platform - Docker Build"
echo "=========================================="
echo "Registry:  ${REGISTRY}"
echo "Username:  ${USERNAME:-local}"
echo "Version:   ${VERSION}"
echo "Backend:   ${BACKEND_IMAGE}"
echo "Frontend:  ${FRONTEND_IMAGE}"
echo "Push:      ${PUSH}"
echo "No Cache:  ${NO_CACHE}"
echo "=========================================="

# Build Backend Image
info "Building backend image..."
docker build \
    ${BUILD_OPTS} \
    -f docker/Dockerfile.backend \
    -t "${BACKEND_IMAGE}" \
    .

success "Backend image built successfully"

# Build Frontend Image
info "Building frontend image..."
docker build \
    ${BUILD_OPTS} \
    -f docker/Dockerfile.frontend \
    -t "${FRONTEND_IMAGE}" \
    .

success "Frontend image built successfully"

# Push images if requested
if [ "$PUSH" = true ]; then
    info "Pushing images to ${REGISTRY}..."
    
    # Login to registry
    if [ "${REGISTRY}" = "docker.io" ]; then
        info "Please login to Docker Hub..."
        docker login
    else
        info "Please login to ${REGISTRY}..."
        docker login "${REGISTRY}"
    fi
    
    # Push backend
    info "Pushing backend image..."
    docker push "${BACKEND_IMAGE}"
    success "Backend image pushed: ${BACKEND_IMAGE}"
    
    # Push frontend
    info "Pushing frontend image..."
    docker push "${FRONTEND_IMAGE}"
    success "Frontend image pushed: ${FRONTEND_IMAGE}"
    
    # If version is latest, also push with version tag
    if [ "${VERSION}" = "latest" ]; then
        info "Images pushed with 'latest' tag"
    else
        info "You may want to also push as 'latest' for convenience:"
        echo "  docker tag ${BACKEND_IMAGE} ${REGISTRY}/${USERNAME}/itops-backend:latest"
        echo "  docker push ${REGISTRY}/${USERNAME}/itops-backend:latest"
    fi
fi

# Show image sizes
info "Image sizes:"
docker images | grep -E "itops-backend|itops-frontend" || true

success "All operations completed successfully!"

# Show usage instructions
echo ""
echo "=========================================="
echo " Next Steps:"
echo "=========================================="
if [ "$PUSH" = false ]; then
    echo "To test locally:"
    echo "  docker run -d -p 3001:3001 --name itops-backend ${BACKEND_IMAGE}"
    echo "  docker run -d -p 8080:80 --name itops-frontend ${FRONTEND_IMAGE}"
    echo ""
    echo "To push to registry:"
    echo "  $0 -u <username> -v <version> --push"
else
    echo "Users can now pull your images with:"
    echo "  docker pull ${BACKEND_IMAGE}"
    echo "  docker pull ${FRONTEND_IMAGE}"
    echo ""
    echo "Run with docker-compose:"
    echo "  1. Update docker-compose.yml image fields"
    echo "  2. docker-compose up -d"
fi
echo "=========================================="
