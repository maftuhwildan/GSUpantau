import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { appSettings } from '@/db/schema';
import { requireAuth, requirePermission } from '@/lib/auth';
import { internalError, validationError } from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { wsBroadcaster } from '@/lib/ws';
import {
  DEFAULT_BATCH_UPLOAD_MAX_EVENTS,
  DEFAULT_HEARTBEAT_DEGRADED_THRESHOLD_SECONDS,
  DEFAULT_HEARTBEAT_INTERVAL_SECONDS,
  DEFAULT_HEARTBEAT_OFFLINE_THRESHOLD_SECONDS,
  MAX_BATCH_UPLOAD_EVENTS,
  normalizeBatchUploadMaxEvents,
} from '@/lib/device-health';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

const updateSettingsSchema = z.object({
  siteName: z.string().min(1, 'Nama site wajib diisi.').max(200).trim(),
  siteTimezone: z.string().min(1, 'Timezone wajib diisi.').trim(),
  heartbeatOfflineThresholdSeconds: z
    .number()
    .int('Nilai detik harus berupa bilangan bulat.')
    .positive('Threshold offline harus berupa angka positif (> 0).'),
  heartbeatDegradedThresholdSeconds: z
    .number()
    .int('Nilai detik harus berupa bilangan bulat.')
    .positive('Threshold degraded harus berupa angka positif (> 0).'),
  pollingFallbackIntervalSeconds: z
    .number()
    .int('Nilai detik harus berupa bilangan bulat.')
    .positive('Interval polling fallback harus berupa angka positif (> 0).'),
  deviceBatchSize: z
    .number()
    .int('Ukuran batch harus berupa bilangan bulat.')
    .positive('Ukuran batch harus berupa angka positif (> 0).')
    .max(MAX_BATCH_UPLOAD_EVENTS, `Ukuran batch maksimal ${MAX_BATCH_UPLOAD_EVENTS}.`),
});

const DEFAULT_SETTINGS = {
  siteName: 'Poultry Receiving Counter System - RPA Jaya Abadi',
  siteTimezone: 'Asia/Jakarta',
  heartbeatOfflineThresholdSeconds: DEFAULT_HEARTBEAT_OFFLINE_THRESHOLD_SECONDS,
  heartbeatDegradedThresholdSeconds: DEFAULT_HEARTBEAT_DEGRADED_THRESHOLD_SECONDS,
  pollingFallbackIntervalSeconds: DEFAULT_HEARTBEAT_INTERVAL_SECONDS,
  deviceBatchSize: DEFAULT_BATCH_UPLOAD_MAX_EVENTS,
};

export async function GET(req: NextRequest) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const rows = await db.select().from(appSettings);
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const settings = {
      siteName: (map.get('site_name') as string) ?? DEFAULT_SETTINGS.siteName,
      siteTimezone: (map.get('site_timezone') as string) ?? DEFAULT_SETTINGS.siteTimezone,
      heartbeatOfflineThresholdSeconds:
        (map.get('heartbeat_offline_threshold_seconds') as number) ??
        DEFAULT_SETTINGS.heartbeatOfflineThresholdSeconds,
      heartbeatDegradedThresholdSeconds:
        (map.get('heartbeat_degraded_threshold_seconds') as number) ??
        DEFAULT_SETTINGS.heartbeatDegradedThresholdSeconds,
      pollingFallbackIntervalSeconds:
        (map.get('polling_fallback_interval_seconds') as number) ??
        DEFAULT_SETTINGS.pollingFallbackIntervalSeconds,
      deviceBatchSize: normalizeBatchUploadMaxEvents(
        map.get('batch_upload_max_events') ??
          map.get('device_batch_upload_max_events') ??
          map.get('device_batch_size')
      ),
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('GET /api/settings error:', error);
    return internalError();
  }
}

export async function PUT(req: NextRequest) {
  return handleUpdateSettings(req);
}

export async function PATCH(req: NextRequest) {
  return handleUpdateSettings(req);
}

async function handleUpdateSettings(req: NextRequest) {
  const { user: currentUser, errorResponse } = await requirePermission(
    req,
    'settings:manage'
  );
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(
        'Input tidak valid.',
        parsed.error.flatten().fieldErrors as Record<string, unknown>
      );
    }

    const {
      siteName,
      siteTimezone,
      heartbeatOfflineThresholdSeconds,
      heartbeatDegradedThresholdSeconds,
      pollingFallbackIntervalSeconds,
      deviceBatchSize,
    } = parsed.data;

    // Degraded threshold must be lower than offline threshold
    if (heartbeatDegradedThresholdSeconds >= heartbeatOfflineThresholdSeconds) {
      return validationError(
        'Threshold degraded harus lebih kecil dari threshold offline.',
        {
          heartbeatDegradedThresholdSeconds: [
            'Threshold degraded (peringatan) harus lebih kecil dari threshold offline.',
          ],
        }
      );
    }

    // Existing settings for audit beforeData
    const existingRows = await db.select().from(appSettings);
    const beforeMap = new Map(existingRows.map((r) => [r.key, r.value]));

    const beforeData = {
      siteName: beforeMap.get('site_name') ?? DEFAULT_SETTINGS.siteName,
      siteTimezone: beforeMap.get('site_timezone') ?? DEFAULT_SETTINGS.siteTimezone,
      heartbeatOfflineThresholdSeconds:
        beforeMap.get('heartbeat_offline_threshold_seconds') ??
        DEFAULT_SETTINGS.heartbeatOfflineThresholdSeconds,
      heartbeatDegradedThresholdSeconds:
        beforeMap.get('heartbeat_degraded_threshold_seconds') ??
        DEFAULT_SETTINGS.heartbeatDegradedThresholdSeconds,
      pollingFallbackIntervalSeconds:
        beforeMap.get('polling_fallback_interval_seconds') ??
        DEFAULT_SETTINGS.pollingFallbackIntervalSeconds,
      deviceBatchSize: normalizeBatchUploadMaxEvents(
        beforeMap.get('batch_upload_max_events') ??
          beforeMap.get('device_batch_upload_max_events') ??
          beforeMap.get('device_batch_size')
      ),
    };

    const afterData = {
      siteName,
      siteTimezone,
      heartbeatOfflineThresholdSeconds,
      heartbeatDegradedThresholdSeconds,
      pollingFallbackIntervalSeconds,
      deviceBatchSize,
    };

    const settingsToUpsert = [
      { key: 'site_name', value: siteName },
      { key: 'site_timezone', value: siteTimezone },
      { key: 'heartbeat_offline_threshold_seconds', value: heartbeatOfflineThresholdSeconds },
      { key: 'heartbeat_degraded_threshold_seconds', value: heartbeatDegradedThresholdSeconds },
      { key: 'polling_fallback_interval_seconds', value: pollingFallbackIntervalSeconds },
      { key: 'batch_upload_max_events', value: deviceBatchSize },
      { key: 'device_batch_upload_max_events', value: deviceBatchSize },
      { key: 'device_batch_size', value: deviceBatchSize },
    ];

    const result = await db.transaction(async (tx) => {
      for (const item of settingsToUpsert) {
        const [existing] = await tx
          .select()
          .from(appSettings)
          .where(eq(appSettings.key, item.key));

        if (existing) {
          await tx
            .update(appSettings)
            .set({
              value: item.value,
              updatedBy: currentUser!.id,
              updatedAt: new Date(),
            })
            .where(eq(appSettings.key, item.key));
        } else {
          await tx.insert(appSettings).values({
            key: item.key,
            value: item.value,
            updatedBy: currentUser!.id,
          });
        }
      }

      const auditLog = await createAuditLog(
        {
          actorId: currentUser!.id,
          actorRole: currentUser!.roles[0] ?? null,
          action: 'UPDATE_SETTINGS',
          entityType: 'settings',
          entityId: 'app_settings',
          beforeData,
          afterData,
          source: 'WEB',
        },
        tx
      );

      return { settings: afterData, auditLog };
    });

    wsBroadcaster.broadcast('audit.created', {
      audit_log_id: result.auditLog.id,
      action: result.auditLog.action,
      entity_type: result.auditLog.entityType,
      entity_id: result.auditLog.entityId,
    });

    return NextResponse.json({ settings: result.settings });
  } catch (error) {
    console.error('PUT/PATCH /api/settings error:', error);
    return internalError();
  }
}
