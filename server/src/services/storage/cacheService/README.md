# Integrated Cache Services for MTD Tax Bridge

This directory contains a comprehensive, integrated caching solution for the MTD Tax Bridge application. The architecture has been redesigned to ensure all cache services work together seamlessly.

## Architecture Overview

```
┌─────────────────────────┐
│     Application Layer   │
├─────────────────────────┤
│   cache.service.js      │  ← Backward compatibility wrapper
│   (Compatibility Layer) │
├─────────────────────────┤
│     index.js            │  ← Main coordinator/factory
│   (Integration Layer)   │
├─────────────────────────┤
│  Specialized Services   │
│  ┌─────────────────────┐│
│  │ BusinessCacheService││  ← AI, HMRC, File processing
│  ├─────────────────────┤│
│  │ SessionCacheService ││  ← Auth, JWT, HMRC tokens
│  ├─────────────────────┤│
│  │   CacheUtils        ││  ← Utilities & invalidation
│  └─────────────────────┘│
├─────────────────────────┤
│     cache.service.js    │  ← Core Redis operations
│     (Core Layer)        │
├─────────────────────────┤
│        Redis            │  ← Single connection pool
└─────────────────────────┘
```

## File Structure

```
cacheService/
├── index.js                    # Main factory and coordinator
├── cache.service.js            # Core Redis operations
├── business-cache.service.js   # Business-specific caching
├── session-cache.service.js    # Authentication & session caching
├── utils/
│   └── cache-utils.js         # Cache utilities and invalidation
├── example-usage.js           # Usage examples
└── README.md                  # This file
```

## Key Integration Features

### 1. **Shared Redis Connection**
- Single Redis client shared across all services
- Connection pooling and cluster support
- Centralized health monitoring

### 2. **Cross-Service Invalidation**
- Coordinated cache invalidation across services
- Tag-based invalidation for related data
- Event-driven cache clearing

### 3. **Unified Configuration**
- Environment-based configuration
- Consistent TTL management
- Shared circuit breaker pattern

### 4. **Comprehensive Monitoring**
- Aggregated metrics across all services
- Health scoring and alerts
- Performance tracking

## Usage Examples

### Basic Setup

```javascript
const cacheFactory = require('./cacheService');

// Initialize all cache services
await cacheFactory.initialize();

// Get specific services
const mainCache = cacheFactory.getMainCache();
const businessCache = cacheFactory.getBusinessCache();
const sessionCache = cacheFactory.getSessionCache();
const utils = cacheFactory.getUtils();
```

### Backward Compatibility

```javascript
// For existing code (like file-storage.service.js)
const cacheService = require('../cache.service');

await cacheService.initialize();
await cacheService.set('key', 'value', 'medium');
const value = await cacheService.get('key');
```

### Business Operations

```javascript
// AI categorization
await businessCache.cacheCategorizationResult(
  transactionHash,
  'office_costs',
  0.95,
  { keywords: ['office', 'supplies'] }
);

// HMRC API caching
await businessCache.cacheHMRCResponse(
  'obligations',
  { nino: 'AB123456C' },
  { obligations: [...] }
);

// File processing
await businessCache.setProcessingProgress(fileId, 75, 'validation');
```

### Session Management

```javascript
// User sessions
await sessionCache.storeUserSession(userId, sessionId, sessionData, jwtToken);

// HMRC OAuth tokens
await sessionCache.storeHMRCTokens(userId, {
  accessToken: 'token',
  refreshToken: 'refresh',
  expiresIn: 3600
});
```

### Coordinated Operations

```javascript
// Invalidate user data across all services
await businessCache.invalidateUserData(userId);

// Get aggregated metrics
const metrics = await cacheFactory.getAggregatedMetrics();

// Coordinated cache warming
await cacheFactory.warmAllCaches();
```

## Configuration

Environment variables:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DATABASE=0

# Cluster Support
REDIS_CLUSTER_ENABLED=false
REDIS_CLUSTER_NODES=host1:port1,host2:port2

# Cache Settings
CACHE_WARMING_ENABLED=true
CACHE_USE_SCAN=true
CACHE_HEALTH_CHECK_INTERVAL=30000

# Security
SESSION_ENCRYPTION_KEY=your_encryption_key
CACHE_ENCRYPTION_KEY=your_cache_encryption_key
MAX_CONCURRENT_SESSIONS=5
```

## Service-Specific Features

### Main Cache Service (`cache.service.js`)
- Core Redis operations (get, set, delete, exists)
- Batch operations and pipelines
- Pattern-based operations
- Circuit breaker pattern
- Health monitoring
- Database query caching
- System configuration caching

### Business Cache Service (`business-cache.service.js`)
- AI categorization result caching
- HMRC API response caching with rate limiting
- File processing progress and results
- Bulk operations for transactions/files
- Business data invalidation strategies

### Session Cache Service (`session-cache.service.js`)
- JWT session management
- HMRC OAuth token caching with auto-refresh
- Active user tracking
- Session expiry handling
- Concurrent session limits
- Security features (encryption)
- Audit logging

### Cache Utils (`utils/cache-utils.js`)
- Tag-based invalidation
- Time-based cleanup
- Performance monitoring
- Compression for large values
- Encryption for sensitive data
- Testing utilities

## Error Handling

The integrated cache system includes:

1. **Circuit Breaker Pattern**: Prevents cascade failures
2. **Graceful Degradation**: Continues operation with degraded performance
3. **Automatic Recovery**: Self-healing mechanisms
4. **Comprehensive Logging**: Detailed error tracking
5. **Health Monitoring**: Continuous system health checks

## Performance Features

1. **Connection Sharing**: Single Redis connection pool
2. **Batch Operations**: Bulk get/set operations
3. **Pipeline Support**: Redis pipeline operations
4. **Compression**: Automatic compression for large values
5. **TTL Management**: Intelligent expiry handling
6. **Hit Ratio Tracking**: Cache performance monitoring

## Testing

Use the mock cache service for testing:

```javascript
const cacheUtils = require('./utils/cache-utils');
const mockCache = cacheUtils.mockCacheService();

// Use mockCache in your tests
await mockCache.set('test:key', 'value');
const value = await mockCache.get('test:key');
```

## Migration from Old Architecture

If you have existing cache usage:

1. **Update imports**: Change from individual service imports to the factory
2. **Initialize once**: Call `cacheFactory.initialize()` at application startup
3. **Use compatibility layer**: Existing `require('../cache.service')` calls will work
4. **Gradual migration**: Move to specialized services over time

## Monitoring and Metrics

Get comprehensive cache statistics:

```javascript
const metrics = await cacheFactory.getAggregatedMetrics();
console.log('Cache health score:', metrics.aggregated.healthScore);
console.log('Total memory usage:', metrics.aggregated.memoryUsage);
console.log('Active users:', metrics.sessions.activeUsers);
```

## Best Practices

1. **Initialize Early**: Initialize cache services at application startup
2. **Use Appropriate TTLs**: Choose correct TTL for your data type
3. **Tag Related Data**: Use tags for coordinated invalidation
4. **Monitor Performance**: Regular health checks and metrics review
5. **Handle Failures**: Always include error handling for cache operations
6. **Batch When Possible**: Use batch operations for multiple keys

## Troubleshooting

Common issues and solutions:

1. **"Cache services not initialized"**: Call `cacheFactory.initialize()` first
2. **High memory usage**: Check TTL settings and implement cleanup
3. **Poor hit ratios**: Review caching strategy and key patterns
4. **Connection issues**: Check Redis configuration and network connectivity
5. **Circuit breaker open**: Monitor error rates and implement recovery procedures

## Support

For issues or questions about the integrated cache services, check:

1. Application logs for detailed error messages
2. Cache health status via `getHealthStatus()`
3. Metrics and performance data
4. Redis server status and connectivity