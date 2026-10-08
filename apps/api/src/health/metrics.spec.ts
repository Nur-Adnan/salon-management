import { describe, expect, it } from 'vitest';
import { MetricsService } from './metrics.service.js';

describe('MetricsService', () => {
  it('records requests and generates standard Prometheus metrics output', () => {
    const service = new MetricsService();
    service.recordRequest('get', '/health', 200, 15.5);
    service.recordRequest('get', '/health', 200, 12.3);
    service.recordRequest('post', '/sales/checkout', 201, 85.0);
    service.setWebSocketConnections(14);

    const output = service.getPrometheusFormat();

    expect(output).toContain('process_uptime_seconds');
    expect(output).toContain('active_websocket_connections 14');
    expect(output).toContain('http_requests_total{method="GET",route="/health",status="200"} 2');
    expect(output).toContain('http_requests_total{method="POST",route="/sales/checkout",status="201"} 1');
    expect(output).toContain('http_request_duration_ms_sum{method="GET",route="/health",status="200"} 27.80');
  });
});
