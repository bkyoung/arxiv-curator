#!/bin/bash
set -e

echo "========================================"
echo "Testing Production Build Locally"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${YELLOW}Warning: .env.production not found${NC}"
    echo "Creating from .env.example..."
    cp .env.example .env.production
    echo -e "${YELLOW}Please edit .env.production with your settings before continuing${NC}"
    exit 1
fi

echo -e "${GREEN}Step 1: Building Docker images${NC}"
docker compose -f docker-compose.prod.yml build

echo ""
echo -e "${GREEN}Step 2: Starting database and storage${NC}"
docker compose -f docker-compose.prod.yml up -d postgres minio

echo ""
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
sleep 10

echo ""
echo -e "${GREEN}Step 3: Running database migrations${NC}"
docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy

echo ""
echo -e "${GREEN}Step 4: Seeding database${NC}"
docker compose -f docker-compose.prod.yml run --rm app npx prisma db seed

echo ""
echo -e "${GREEN}Step 5: Starting all services${NC}"
docker compose -f docker-compose.prod.yml up -d

echo ""
echo -e "${YELLOW}Waiting for app to be ready...${NC}"
sleep 15

echo ""
echo -e "${GREEN}Step 6: Testing health endpoint${NC}"
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "Check logs with: docker compose -f docker-compose.prod.yml logs app"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================"
echo "✓ Production build test successful!"
echo "========================================${NC}"
echo ""
echo "Services running:"
echo "  - App:           http://localhost:3000"
echo "  - MinIO Console: http://localhost:9001"
echo ""
echo "Useful commands:"
echo "  - View logs:     docker compose -f docker-compose.prod.yml logs -f"
echo "  - Stop services: docker compose -f docker-compose.prod.yml down"
echo "  - Clean up:      docker compose -f docker-compose.prod.yml down -v"
echo ""
