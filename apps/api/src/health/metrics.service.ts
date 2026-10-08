import { Injectable } from '@nestjs/common';

interface RequestMetric {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
}

@Injectable()
export class MetricsService {
  private readonly requestCounts = new Map<string, number>();
  private readonly requestDurationSums = new Map<string, number>();
  private activeWebSockets = 0;

  recordRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    const key = `${method.toUpperCase()}_${route}_${statusCode}`;
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);
    this.requestDurationSums.set(key, (this.requestDurationSums.get(key) || 0) + durationMs);
  }

  setWebSocketConnections(count: number): void {
    this.activeWebSockets = Math.max(0, count);
  }

  getPrometheusFormat(): string {
    const lines: string[] = [
      '# HELP process_uptime_seconds Process uptime in seconds.',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${Math.floor(process.uptime())}`,
      '',
      '# HELP process_heap_bytes Process heap memory usage in bytes.',
      '# TYPE process_heap_bytes gauge',
      `process_heap_bytes ${process.memoryUsage().heapUsed}`,
      '',
      '# HELP active_websocket_connections Current active real-time WebSocket clients.',
      '# TYPE active_websocket_connections gauge',
      `active_websocket_connections ${this.activeWebSockets}`,
      '',
      '# HELP http_requests_total Total number of HTTP requests processed.',
      '# TYPE http_requests_total counter',
    ];

    for (const [key, count] of this.requestCounts.entries()) {
      const parts = key.split('_');
      const method = parts[0];
      const statusCode = parts.pop();
      const route = parts.slice(1).join('_');
      lines.push(`http_requests_total{method="${method}",route="${route}",status="${statusCode}"} ${count}`);
    }

    lines.push(
      '',
      '# HELP http_request_duration_ms_sum Total duration of HTTP requests in milliseconds.',
      '# TYPE http_request_duration_ms_sum counter',
    );

    for (const [key, sum] of this.requestDurationSums.entries()) {
      const parts = key.split('_');
      const method = parts[0];
      const statusCode = parts.pop();
      const route = parts.slice(1).join('_');
      lines.push(
        `http_request_duration_ms_sum{method="${method}",route="${route}",status="${statusCode}"} ${sum.toFixed(2)}`,
      );
    }

    return lines.join('\n') + '\n';
  }
}
