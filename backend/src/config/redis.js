const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

redis.on('error', (err) => {
  console.error('[redis] erreur de connexion', err.message);
});

module.exports = { redis };
