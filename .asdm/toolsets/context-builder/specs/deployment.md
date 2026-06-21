# Deployment Configuration

## Overview
This document describes the deployment architecture, configuration, and processes for this workspace. It provides AI models with the necessary information to understand and work with the deployment environment.

## Deployment Architecture

### System Architecture Diagram
```mermaid
graph TB
    subgraph "Cloud Provider"
        subgraph "VPC"
            subgraph "Public Subnet"
                LB[Load Balancer]
            end
            
            subgraph "Private Subnet"
                subgraph "Application Tier"
                    APP1[App Server 1]
                    APP2[App Server 2]
                    APP3[App Server 3]
                end
                
                subgraph "Data Tier"
                    DB[(Primary Database)]
                    DB_REPLICA[(Read Replica)]
                    CACHE[Redis Cache]
                end
                
                subgraph "Storage Tier"
                    S3[S3/Object Storage]
                    CDN[CDN]
                end
            end
        end
    end
    
    USER[Users] --> LB
    LB --> APP1
    LB --> APP2
    LB --> APP3
    APP1 --> DB
    APP2 --> DB
    APP3 --> DB
    APP1 --> DB_REPLICA
    APP2 --> DB_REPLICA
    APP3 --> DB_REPLICA
    APP1 --> CACHE
    APP2 --> CACHE
    APP3 --> CACHE
    APP1 --> S3
    APP2 --> S3
    APP3 --> S3
    S3 --> CDN
```

### Component Description
| Component | Purpose | Technology | Scaling |
|-----------|---------|------------|---------|
| **Load Balancer** | Distributes traffic, SSL termination | AWS ALB / Nginx | Auto-scaling |
| **Application Servers** | Hosts the main application | Node.js / Docker | Horizontal scaling |
| **Primary Database** | Main data storage | PostgreSQL RDS | Vertical scaling |
| **Read Replica** | Read-only queries | PostgreSQL | Horizontal scaling |
| **Cache** | Session and data caching | Redis ElastiCache | Vertical scaling |
| **Object Storage** | File storage | AWS S3 | Unlimited |
| **CDN** | Static content delivery | CloudFront / Akamai | Global |

## Environment Configuration

### Development Environment
```yaml
# config/development.yml
environment: development
debug: true
log_level: debug

database:
  host: localhost
  port: 5432
  name: app_dev
  username: dev_user
  password: dev_password

cache:
  host: localhost
  port: 6379

storage:
  type: local
  path: ./uploads

api:
  base_url: http://localhost:3000
  cors_origins: ["http://localhost:8080"]
```

### Staging Environment
```yaml
# config/staging.yml
environment: staging
debug: false
log_level: info

database:
  host: staging-db.cluster-xxx.us-east-1.rds.amazonaws.com
  port: 5432
  name: app_staging
  username: ${DB_USERNAME}
  password: ${DB_PASSWORD}

cache:
  host: staging-cache.xxx.ng.0001.use1.cache.amazonaws.com
  port: 6379

storage:
  type: s3
  bucket: app-staging-files
  region: us-east-1

api:
  base_url: https://staging-api.example.com
  cors_origins: ["https://staging.example.com"]
```

### Production Environment
```yaml
# config/production.yml
environment: production
debug: false
log_level: warn

database:
  host: production-db.cluster-xxx.us-east-1.rds.amazonaws.com
  port: 5432
  name: app_production
  username: ${DB_USERNAME}
  password: ${DB_PASSWORD}
  ssl: true
  pool:
    max: 20
    min: 5
    idle_timeout: 30000

cache:
  host: production-cache.xxx.ng.0001.use1.cache.amazonaws.com
  port: 6379
  tls: true

storage:
  type: s3
  bucket: app-production-files
  region: us-east-1
  cdn_url: https://cdn.example.com

api:
  base_url: https://api.example.com
  cors_origins: ["https://www.example.com"]
  rate_limit:
    window: 900000  # 15 minutes
    max: 100
```

## Deployment Process

### Continuous Deployment Pipeline
```mermaid
graph LR
    A[Code Commit] --> B[CI Pipeline]
    B --> C{Build & Test}
    C --> D[Deploy to Dev]
    D --> E{Automated Tests}
    E --> F[Deploy to Staging]
    F --> G{Manual Approval}
    G --> H[Deploy to Production]
    H --> I[Post-Deployment Tests]
    I --> J[Monitor & Alert]
```

### Deployment Steps

#### 1. Development Deployment
```bash
# Build the application
npm run build

# Run tests
npm test

# Build Docker image
docker build -t app:dev .

# Deploy to development
docker-compose -f docker-compose.dev.yml up -d

# Run database migrations
npm run migrate:up
```

#### 2. Staging Deployment
```bash
# Build for staging
npm run build:staging

# Run integration tests
npm run test:integration

# Push to container registry
docker tag app:dev registry.example.com/app:staging
docker push registry.example.com/app:staging

# Deploy to Kubernetes
kubectl apply -f k8s/staging/

# Verify deployment
kubectl get pods -n staging
kubectl get services -n staging
```

#### 3. Production Deployment
```bash
# Build for production
npm run build:production

# Security scan
npm run security:scan

# Push production image
docker tag app:dev registry.example.com/app:production
docker push registry.example.com/app:production

# Blue-green deployment
# Step 1: Deploy new version (green)
kubectl apply -f k8s/production-green/

# Step 2: Test new version
./scripts/test-production.sh

# Step 3: Switch traffic
kubectl apply -f k8s/load-balancer-green/

# Step 4: Monitor
./scripts/monitor-deployment.sh

# Step 5: Clean up old version (blue)
kubectl delete -f k8s/production-blue/
```

## Infrastructure as Code

### Docker Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

### Kubernetes Deployment
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-deployment
  namespace: production
  labels:
    app: webapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
    spec:
      containers:
      - name: app
        image: registry.example.com/app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Terraform Configuration
```hcl
# infrastructure/main.tf
provider "aws" {
  region = "us-east-1"
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  
  tags = {
    Name = "app-vpc"
  }
}

resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
  
  tags = {
    Name = "app-public-subnet"
  }
}

resource "aws_rds_cluster" "database" {
  cluster_identifier = "app-database"
  engine            = "aurora-postgresql"
  engine_version    = "13.7"
  database_name     = "appdb"
  master_username   = var.db_username
  master_password   = var.db_password
  
  backup_retention_period = 7
  preferred_backup_window = "07:00-09:00"
  
  tags = {
    Name = "app-database"
  }
}
```

## Monitoring and Observability

### Metrics Collection
```yaml
# prometheus/config.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'app'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'
    
  - job_name: 'database'
    static_configs:
      - targets: ['database:9187']
      
  - job_name: 'cache'
    static_configs:
      - targets: ['cache:9121']
```

### Alert Rules
```yaml
# alertmanager/rules.yml
groups:
  - name: app_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}%"
          
      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
          description: "95th percentile latency is {{ $value }}s"
```

### Logging Configuration
```javascript
// logger.config.js
const winston = require('winston');
const { CloudWatchTransport } = require('winston-cloudwatch');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new CloudWatchTransport({
      logGroupName: process.env.CLOUDWATCH_LOG_GROUP,
      logStreamName: process.env.CLOUDWATCH_LOG_STREAM,
      awsRegion: process.env.AWS_REGION
    })
  ]
});

module.exports = logger;
```

## Security Configuration

### Network Security
```yaml
# security/network-policies.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: app-network-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: webapp
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: cache
    ports:
    - protocol: TCP
      port: 6379
```

### Secret Management
```bash
# Store secrets
kubectl create secret generic app-secrets \
  --from-literal=database-url=postgresql://user:pass@host/db \
  --from-literal=api-key=secret-key \
  --namespace=production

# Use secrets in deployment
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: app-secrets
        key: database-url
```

## Backup and Disaster Recovery

### Backup Strategy
```bash
#!/bin/bash
# scripts/backup.sh

# Database backup
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > /backup/db-$(date +%Y%m%d).sql

# Upload to S3
aws s3 cp /backup/db-$(date +%Y%m%d).sql s3://backup-bucket/database/

# Rotate old backups (keep 30 days)
find /backup -name "*.sql" -mtime +30 -delete
```

### Recovery Procedure
```bash
#!/bin/bash
# scripts/recovery.sh

# Stop application
kubectl scale deployment app-deployment --replicas=0

# Restore database
psql -h $DB_HOST -U $DB_USER $DB_NAME < /backup/db-latest.sql

# Restart application
kubectl scale deployment app-deployment --replicas=3

# Verify recovery
./scripts/health-check.sh
```

## Performance Optimization

### Caching Strategy
```javascript
// cache.config.js
const redis = require('redis');
const { promisify } = require('util');

const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  tls: process.env.NODE_ENV === 'production'
});

const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);

const cache = {
  async get(key) {
    try {
      const value = await getAsync(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },
  
  async set(key, value, ttl = 3600) {
    try {
      await setAsync(key, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }
};

module.exports = cache;
```

### Database Optimization
```sql
-- Index optimization
CREATE INDEX idx_orders_user_id_status ON orders(user_id, status);
CREATE INDEX idx_products_category_id_price ON products(category_id, price);

-- Query optimization
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123 AND status = 'COMPLETED';

-- Partition large tables
CREATE TABLE orders_2024 PARTITION OF orders
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

## Deployment Checklist

### Pre-Deployment
- [ ] All tests pass
- [ ] Code review completed
- [ ] Security scan passed
- [ ] Performance tests completed
- [ ] Database migrations tested
- [ ] Rollback plan prepared

### During Deployment
- [ ] Deploy to staging first
- [ ] Run smoke tests
- [ ] Monitor metrics
- [ ] Verify functionality
- [ ] Update documentation

### Post-Deployment
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify backups
- [ ] Update deployment log
- [ ] Notify stakeholders

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database connectivity
nc -zv database-host 5432

# Check database status
kubectl exec -it database-pod -- psql -U postgres -c "\l"

# Check connection pool
SHOW max_connections;
SHOW idle_in_transaction_session_timeout;
```

#### Application Crashes
```bash
# Check logs
kubectl logs -f deployment/app-deployment

# Check resource usage
kubectl top pods

# Check events
kubectl get events --sort-by='.lastTimestamp'

# Debug container
kubectl exec -it app-pod -- /bin/sh
```

#### Performance Issues
```bash
# Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

# Check cache hit ratio
SELECT 
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit)  as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;
```

---

*This deployment documentation should be updated whenever infrastructure or deployment processes change. Use the `/context-update-instruction` to keep this document current.*