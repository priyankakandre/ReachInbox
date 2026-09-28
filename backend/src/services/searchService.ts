import { esClient, EMAILS_INDEX } from '../config/elasticsearch.js';
import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';

export interface EmailDocument {
  id: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  createdAt: string;
}

export class SearchService {
  /**
   * Index or update an email document in Elasticsearch
   */
  public static async indexEmail(email: {
    id: string;
    userId: string;
    senderId: string;
    recipient: string;
    subject: string;
    body: string;
    status: string;
    scheduledAt: Date;
    sentAt?: Date | null;
    createdAt: Date;
  }): Promise<void> {
    try {
      await esClient.index({
        index: EMAILS_INDEX,
        id: email.id,
        document: {
          id: email.id,
          userId: email.userId,
          senderId: email.senderId,
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          status: email.status,
          scheduledAt: email.scheduledAt.toISOString(),
          sentAt: email.sentAt ? email.sentAt.toISOString() : null,
          createdAt: email.createdAt.toISOString(),
        },
      });
      logger.debug(`[ES] Indexed email: ${email.id}`);
    } catch (error: any) {
      logger.warn(`[ES] Failed to index email ${email.id}:`, error.message);
    }
  }

  /**
   * Update the status and sentAt of an email document
   */
  public static async updateEmailStatus(
    id: string,
    status: string,
    sentAt?: Date | null,
    previewUrl?: string | null
  ): Promise<void> {
    try {
      await esClient.update({
        index: EMAILS_INDEX,
        id,
        doc: {
          status,
          sentAt: sentAt ? sentAt.toISOString() : null,
          previewUrl: previewUrl || null,
        },
      });
      logger.debug(`[ES] Updated email status: ${id} -> ${status}`);
    } catch (error: any) {
      logger.warn(`[ES] Failed to update email ${id} in Elasticsearch:`, error.message);
    }
  }

  /**
   * Search emails by keyword across recipient, subject, and body
   */
  public static async searchEmails(params: {
    userId: string;
    query: string;
    status?: string;
    limit?: number;
  }): Promise<any[]> {
    try {
      const mustClauses: any[] = [{ term: { userId: params.userId } }];

      if (params.status) {
        mustClauses.push({ term: { status: params.status } });
      }

      if (params.query && params.query.trim()) {
        mustClauses.push({
          multi_match: {
            query: params.query.trim(),
            fields: ['recipient^3', 'subject^2', 'body'],
            fuzziness: 'AUTO',
          },
        });
      }

      const response = await esClient.search({
        index: EMAILS_INDEX,
        size: params.limit || 50,
        query: {
          bool: {
            must: mustClauses,
          },
        },
        sort: [{ scheduledAt: { order: 'desc' } }],
      });

      const hits = response.hits.hits.map((hit: any) => hit._source);
      return hits;
    } catch (error: any) {
      logger.warn('[ES] Elasticsearch search failed, falling back to MySQL query:', error.message);

      // MySQL fallback
      const where: any = {
        userId: params.userId,
      };

      if (params.status) {
        where.status = params.status;
      }

      if (params.query && params.query.trim()) {
        const q = params.query.trim();
        where.OR = [
          { recipient: { contains: q } },
          { subject: { contains: q } },
          { body: { contains: q } },
        ];
      }

      const fallbackResults = await prisma.email.findMany({
        where,
        take: params.limit || 50,
        orderBy: { scheduledAt: 'desc' },
        include: { sender: true },
      });

      return fallbackResults;
    }
  }

  /**
   * Reindex all emails from MySQL into Elasticsearch
   */
  public static async reindexAll(): Promise<number> {
    try {
      const allEmails = await prisma.email.findMany();
      logger.info(`[ES Reindex] Found ${allEmails.length} emails in MySQL to reindex.`);

      let count = 0;
      for (const email of allEmails) {
        await this.indexEmail(email);
        count++;
      }

      logger.info(`[ES Reindex] Reindexed ${count} emails.`);
      return count;
    } catch (error: any) {
      logger.error('[ES Reindex] Reindexing failed:', error.message);
      throw error;
    }
  }
}
