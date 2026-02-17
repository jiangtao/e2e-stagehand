/**
 * 扫描可用目标的 API
 * GET /api/targets/scan
 */

import { NextResponse } from 'next/server';
import { targetAutoDetector } from '@/lib/target/auto-detector';

export async function GET() {
  try {
    const targets = await targetAutoDetector.scan();

    return NextResponse.json({
      success: true,
      targets: targets.map((t) => ({
        id: `localhost:${t.port}`,
        name: t.title || `Application on port ${t.port}`,
        displayName: t.title || `Application on port ${t.port}`,
        type: t.type,
        port: t.port,
        url: t.url,
        favicon: t.favicon,
        autoDetected: true,
      })),
    });
  } catch (error) {
    console.error('Failed to scan targets:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to scan targets',
      },
      { status: 500 }
    );
  }
}
