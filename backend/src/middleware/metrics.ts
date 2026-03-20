import { Request, Response, NextFunction } from 'express';
import os from 'os';

// Basic in-memory counters for tracking
export const metrics = {
  requestCount: 0,
  errorCount: 0,
  totalLatency: 0,
};

/**
 * Middleware: Collects request counts and durations safely.
 */
export const metricsCollector = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    metrics.requestCount++;
    metrics.totalLatency += (Date.now() - start);
    
    if (res.statusCode >= 400) {
      metrics.errorCount++;
    }
  });

  next();
};

/**
 * Controller: Renders Prometheus Text Exposition format.
 */
export const metricsEndpoint = (req: Request, res: Response) => {
  const avgLatency = metrics.requestCount > 0 ? metrics.totalLatency / metrics.requestCount : 0;
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  
  const responseText = [
    `# HELP http_requests_total Total number of HTTP requests`,
    `# TYPE http_requests_total counter`,
    `http_requests_total ${metrics.requestCount}`,
    
    `# HELP http_request_errors_total Total number of HTTP errors`,
    `# TYPE http_request_errors_total counter`,
    `http_request_errors_total ${metrics.errorCount}`,
    
    `# HELP http_request_duration_average_ms Average request latency in ms`,
    `# TYPE http_request_duration_average_ms gauge`,
    `http_request_duration_average_ms ${avgLatency.toFixed(2)}`,
    
    `# HELP node_memory_free_bytes Free memory in bytes`,
    `# TYPE node_memory_free_bytes gauge`,
    `node_memory_free_bytes ${freeMem}`,
    
    `# HELP node_memory_total_bytes Total memory in bytes`,
    `# TYPE node_memory_total_bytes gauge`,
    `node_memory_total_bytes ${totalMem}`
  ].join('\n') + '\n';

  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(responseText);
};
