import { Client } from '@elastic/elasticsearch';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

export const esClient = new Client({
  node: config.elasticsearch.node,
});

export const EMAILS_INDEX = 'reachinbox_emails';

export async function initElasticsearch() {
  try {
    const isAlive = await esClient.ping();
    if (!isAlive) {
      logger.warn('Elasticsearch ping failed, will retry later.');
      return;
    }
    logger.info('Connected to Elasticsearch');

    const indexExists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (!indexExists) {
      await esClient.indices.create({
        index: EMAILS_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              senderId: { type: 'keyword' },
              recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      logger.info(`Elasticsearch index '${EMAILS_INDEX}' created successfully.`);
    } else {
      logger.info(`Elasticsearch index '${EMAILS_INDEX}' ready.`);
    }
  } catch (error: any) {
    logger.error('Elasticsearch initialization error:', error.message || error);
  }
}
