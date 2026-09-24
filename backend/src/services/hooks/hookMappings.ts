/**
 * Hook 来源映射表（标准化核心）
 *
 * 声明式地把异构告警体映射为平台标准告警：
 *   { source: 'prometheus', label: 'Prometheus', adapter: adaptPrometheus }
 *
 * 新增一家监控源只需在此追加一条；厂商字段差异全部由 alertSourceAdapters 承担，
 * 调用方（路由 / 定时任务 / MQ 消费者）不再写任何 if/else 解析分支。
 */
import {
  adaptAliyun,
  adaptGrafana,
  adaptPrometheus,
  adaptTencentCloud,
  adaptZabbix,
  detectSourceType,
} from '@services/alert/alertSourceAdapters';
import type { AlertAdapterResult } from '@services/alert/alertSourceAdapters';
import type { HookSource } from './types';

export interface HookSourceMapping {
  source: HookSource;
  label: string;
  /** 归一化适配器：异构 payload → 标准告警列表 */
  adapter: (payload: unknown) => AlertAdapterResult;
  /** 是否为通用/自动识别来源 */
  autoDetect?: boolean;
}

export const HOOK_SOURCE_MAPPINGS: HookSourceMapping[] = [
  { source: 'prometheus', label: 'Prometheus Alertmanager', adapter: adaptPrometheus },
  { source: 'zabbix', label: 'Zabbix', adapter: adaptZabbix },
  { source: 'grafana', label: 'Grafana', adapter: adaptGrafana },
  { source: 'aliyun', label: '阿里云监控', adapter: adaptAliyun },
  { source: 'tencent', label: '腾讯云监控', adapter: adaptTencentCloud },
  {
    source: 'generic',
    label: '通用/自动识别',
    autoDetect: true,
    adapter: (payload: unknown) => adaptByDetectedType(payload),
  },
];

const MAPPING_BY_SOURCE = new Map(HOOK_SOURCE_MAPPINGS.map((mapping) => [mapping.source, mapping]));

export function getSourceMapping(source: string): HookSourceMapping | undefined {
  return MAPPING_BY_SOURCE.get(source as HookSource);
}

export function listSourceMappings(): Array<Pick<HookSourceMapping, 'source' | 'label' | 'autoDetect'>> {
  return HOOK_SOURCE_MAPPINGS.map(({ source, label, autoDetect }) => ({ source, label, autoDetect }));
}

/** 通用来源：按 payload 形态自动选择适配器 */
export function adaptByDetectedType(payload: unknown): AlertAdapterResult {
  const detected = detectSourceType(payload) as HookSource | 'unknown';
  const mapping = MAPPING_BY_SOURCE.get(detected as HookSource);
  if (mapping && !mapping.autoDetect) {
    return mapping.adapter(payload);
  }
  // 兜底：按通用结构解析
  return adaptGeneric(payload);
}

/** 通用告警体：{ title|name, severity|level, host|instance|target, description|message, status } */
export function adaptGeneric(payload: unknown): AlertAdapterResult {
  const body = (payload || {}) as Record<string, any>;
  const items = Array.isArray(body.alerts) ? body.alerts : [body];
  const errors: string[] = [];

  const alerts = items.map((item: Record<string, any>, index: number) => {
    const title = item.title || item.name || item.alertname || item.summary || `告警事件 ${index + 1}`;
    if (!title) errors.push(`第 ${index + 1} 条缺少标题`);
    return {
      external_id: String(item.id || item.fingerprint || item.eventId || ''),
      source: 'generic',
      severity: normalizeSeverity(item.severity || item.level || item.priority),
      title: String(title).slice(0, 200),
      content: String(item.description || item.message || item.content || item.summary || title),
      host: item.host || item.instance || item.target || item.ip || undefined,
      status: /resolved|recovered|ok|恢复|已解决/i.test(String(item.status || item.state || ''))
        ? ('resolved' as const)
        : ('firing' as const),
      metadata: { source: 'generic', raw: item },
    };
  });

  return { alerts, errors };
}

function normalizeSeverity(value: unknown): string {
  const text = String(value || '').toLowerCase();
  if (['critical', 'disaster', 'emergency', 'fatal', '严重', '紧急'].some((key) => text.includes(key))) return 'critical';
  if (['high', 'error', 'major', '高'].some((key) => text.includes(key))) return 'high';
  if (['warning', 'warn', 'average', '中'].some((key) => text.includes(key))) return 'warning';
  if (['info', 'low', 'notice', '低'].some((key) => text.includes(key))) return 'info';
  return 'warning';
}