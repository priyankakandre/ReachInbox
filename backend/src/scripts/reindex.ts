import { connectDB, prisma } from '../config/db.js';
import { initElasticsearch } from '../config/elasticsearch.js';
import { SearchService } from '../services/searchService.js';
import { logger } from '../utils/logger.js';

async function run() {
  await connectDB();
  await initElasticsearch();
  logger.info('Starting full Elasticsearch reindex from MySQL...');
  const count = await SearchService.reindexAll();
  logger.info(`Reindexing completed. Indexed ${count} documents.`);
  await prisma.$disconnect();
  process.exit(0);
}

run().catch((err) => {
  logger.error('Reindex script failed:', err);
  process.exit(1);
});
