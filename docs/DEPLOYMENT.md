# ArXiv Curator - Deployment Guide

This guide covers deploying ArXiv Curator to production using Docker Compose on a VPS.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#server-setup)
3. [Initial Configuration](#initial-configuration)
4. [Database Setup](#database-setup)
5. [Building and Deploying](#building-and-deploying)
6. [SSL/HTTPS Setup (Optional)](#sslhttps-setup-optional)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Server Requirements

- **VPS Provider**: DigitalOcean, Hetzner, Linode, AWS EC2, etc.
- **OS**: Ubuntu 22.04 LTS (recommended) or Debian 12
- **RAM**: Minimum 4GB (8GB recommended for LLM operations)
- **Storage**: 50GB SSD minimum (100GB recommended)
- **CPU**: 2+ cores

### Software Requirements

- Docker 24+
- Docker Compose v2+
- Git
- Node.js 22+ (LTS)
- (Optional) Ollama for local LLM support

---

## Server Setup

### 1. Initial Server Configuration

```bash
# SSH into your server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y curl git ufw

# Configure firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Create non-root user
adduser arxiv
usermod -aG sudo arxiv

# Switch to new user
su - arxiv
```

### 2. Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
exit
ssh arxiv@your-server-ip

# Verify Docker installation
docker --version
docker compose version
```

### 3. (Optional) Install Ollama for Local LLM

If you want to run local LLMs for cost savings:

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull recommended models
ollama pull gemma2:27b        # For critiques
ollama pull nomic-embed-text  # For embeddings (alternative)

# Ollama will run on http://localhost:11434
```

---

## Initial Configuration

### 1. Clone Repository

```bash
# Clone your repository
cd ~
git clone https://github.com/yourusername/arxiv-curator.git
cd arxiv-curator
```

### 2. Create Production Environment File

```bash
# Copy example environment file
cp .env.example .env.production

# Edit with your settings
nano .env.production
```

**Required Configuration:**

```bash
# ===========================
# Database Configuration
# ===========================
POSTGRES_USER=postgres
POSTGRES_PASSWORD=CHANGE_THIS_TO_SECURE_PASSWORD
POSTGRES_DB=arxiv_curator

# ===========================
# MinIO S3 Storage
# ===========================
MINIO_ACCESS_KEY=CHANGE_THIS_RANDOM_STRING
MINIO_SECRET_KEY=CHANGE_THIS_RANDOM_STRING_MIN_32_CHARS

# ===========================
# Authentication
# ===========================
# Generate with: openssl rand -base64 32
AUTH_SECRET=PASTE_RANDOM_32_CHAR_STRING_HERE
NEXTAUTH_URL=https://your-domain.com

# ===========================
# AI Services (Optional)
# ===========================
# Google AI API Key (for cloud LLM operations)
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# Ollama (if using local LLM)
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

**Generate secure secrets:**

```bash
# Generate AUTH_SECRET
openssl rand -base64 32

# Generate MINIO_SECRET_KEY
openssl rand -base64 32

# Generate POSTGRES_PASSWORD
openssl rand -base64 24
```

---

## Database Setup

### 1. Start Database and Storage Services

```bash
# Start only database and storage first
docker compose -f docker-compose.prod.yml up -d postgres minio

# Wait for services to be healthy
docker compose -f docker-compose.prod.yml ps

# Check logs if needed
docker compose -f docker-compose.prod.yml logs -f postgres
```

### 2. Run Database Migrations

```bash
# Build the app image first (needed for Prisma CLI)
docker compose -f docker-compose.prod.yml build app

# Run migrations
docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy

# Seed initial data
docker compose -f docker-compose.prod.yml run --rm app npx prisma db seed
```

---

## Building and Deploying

### 1. Build Images

```bash
# Build all images
docker compose -f docker-compose.prod.yml build

# This will build:
# - Next.js app (with standalone output)
# - Background worker
```

### 2. Start All Services

```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# Verify all services are running
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

### 3. Verify Deployment

```bash
# Check health endpoints
curl http://localhost:3000/api/health

# Expected response:
# {"status":"healthy","timestamp":"...","services":{"database":"connected","storage":"connected"}}

# Test the app
curl http://localhost:3000
```

### 4. Access the Application

Open your browser and navigate to:
- **App**: `http://your-server-ip:3000`
- **MinIO Console**: `http://your-server-ip:9001` (for debugging)

---

## SSL/HTTPS Setup (Optional)

For production, you'll want HTTPS. Here's how to set up Let's Encrypt SSL:

### 1. Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Get SSL Certificate

```bash
# Stop nginx if running
docker compose -f docker-compose.prod.yml stop nginx

# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Certificates will be saved to:
# /etc/letsencrypt/live/your-domain.com/
```

### 3. Update Docker Compose for SSL

Edit `docker-compose.prod.yml`:

```yaml
services:
  nginx:
    # ... existing config ...
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt/live/your-domain.com:/etc/nginx/certs:ro
    profiles: []  # Remove 'production' profile to enable by default
```

### 4. Update Nginx Configuration

Edit `nginx.conf` and uncomment the HTTPS server block, updating:
- `server_name your-domain.com;`
- SSL certificate paths

### 5. Restart Services

```bash
docker compose -f docker-compose.prod.yml up -d nginx
```

### 6. Setup Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot will auto-renew via systemd timer
# Verify with:
sudo systemctl status certbot.timer
```

---

## Monitoring and Maintenance

### Daily Operations

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f worker

# Check service status
docker compose -f docker-compose.prod.yml ps
```

### Database Backups

```bash
# Create backup script
cat > ~/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="$HOME/backups"
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/arxiv_curator_$DATE.sql.gz"

docker compose -f ~/arxiv-curator/docker-compose.prod.yml exec -T postgres \
  pg_dump -U postgres arxiv_curator | gzip > "$BACKUP_FILE"

echo "Backup created: $BACKUP_FILE"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "arxiv_curator_*.sql.gz" -mtime +7 -delete
EOF

chmod +x ~/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add this line:
# 0 2 * * * /home/arxiv/backup-db.sh >> /home/arxiv/backup.log 2>&1
```

### Restore from Backup

```bash
# Stop services
docker compose -f docker-compose.prod.yml stop app worker

# Restore database
gunzip -c ~/backups/arxiv_curator_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres -d arxiv_curator

# Restart services
docker compose -f docker-compose.prod.yml start app worker
```

### Updates and Deployments

```bash
# Pull latest code
cd ~/arxiv-curator
git pull

# Rebuild and restart
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Run migrations if schema changed
docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy
```

### Resource Monitoring

```bash
# Check disk usage
df -h

# Check memory usage
free -h

# Check Docker resource usage
docker stats

# Check container logs size
du -sh /var/lib/docker/containers/*/*-json.log

# Prune old Docker data (be careful!)
docker system prune -a
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs service-name

# Common issues:
# 1. Database not ready - wait for health check
# 2. Missing environment variables - check .env.production
# 3. Port conflicts - check if ports are already in use
lsof -i :3000
lsof -i :5432
```

### Database Connection Errors

```bash
# Check database is running
docker compose -f docker-compose.prod.yml ps postgres

# Check database logs
docker compose -f docker-compose.prod.yml logs postgres

# Test connection from app
docker compose -f docker-compose.prod.yml exec app \
  npx prisma db push --skip-generate
```

### Out of Memory

```bash
# Check memory usage
free -h
docker stats

# If using local LLM, consider:
# 1. Use smaller model (gemma2:9b instead of 27b)
# 2. Increase swap space
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make swap permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Worker Not Processing Jobs

```bash
# Check worker logs
docker compose -f docker-compose.prod.yml logs -f worker

# Check pg-boss jobs table
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -d arxiv_curator -c "SELECT * FROM pgboss.job ORDER BY createdon DESC LIMIT 10;"

# Restart worker
docker compose -f docker-compose.prod.yml restart worker
```

### Reset Everything (DESTRUCTIVE)

```bash
# WARNING: This will delete all data!
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d postgres minio
# Wait for services to be healthy
docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy
docker compose -f docker-compose.prod.yml run --rm app npx prisma db seed
docker compose -f docker-compose.prod.yml up -d
```

---

## Performance Tuning

### PostgreSQL Tuning

Edit `docker-compose.prod.yml` to add PostgreSQL performance settings:

```yaml
services:
  postgres:
    command:
      - "postgres"
      - "-c"
      - "shared_buffers=256MB"
      - "-c"
      - "effective_cache_size=1GB"
      - "-c"
      - "maintenance_work_mem=128MB"
      - "-c"
      - "checkpoint_completion_target=0.9"
      - "-c"
      - "wal_buffers=16MB"
      - "-c"
      - "max_connections=100"
```

### Nginx Tuning

For high traffic, increase worker connections in `nginx.conf`:

```nginx
events {
    worker_connections 2048;
}
```

---

## Cost Estimation

### Monthly Costs (Example)

- **VPS** (Hetzner CPX31): ~$15/month (4 vCPU, 8GB RAM, 160GB SSD)
- **Domain**: ~$12/year (~$1/month)
- **Google AI API** (if using cloud LLM): $0-5/month (depends on usage)
- **Total**: ~$16-21/month

### Cost Optimization

1. **Use local LLM** with Ollama (free, requires more RAM)
2. **Use local embeddings** instead of cloud (free)
3. **Limit Depth C critiques** (most expensive cloud LLM operations)
4. **Cache aggressively** (summaries, analyses are cached by default)

---

## Security Checklist

- [ ] Changed all default passwords
- [ ] AUTH_SECRET is cryptographically random (32+ characters)
- [ ] Firewall configured (UFW)
- [ ] SSH key-based authentication (disable password auth)
- [ ] SSL/HTTPS enabled for production
- [ ] Regular backups configured
- [ ] Database not exposed to public internet
- [ ] MinIO not exposed to public internet (except through app)
- [ ] Keep system and Docker images updated

---

## Next Steps

After successful deployment:

1. **Create your user account** at `/signup`
2. **Configure preferences** at `/settings`
3. **Trigger first paper ingestion** (manually or wait for scheduled job)
4. **Generate your first briefing** at `/briefings/latest`
5. **Set up monitoring** (optional: Grafana + Prometheus)
6. **Configure domain and SSL** for production use

---

**Need Help?**

- Check logs: `docker compose -f docker-compose.prod.yml logs`
- Review issues on GitHub
- Consult documentation in `/docs`

**Last Updated:** 2025-10-25
