// Performance monitoring utilities for mobile optimization

interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  memoryUsage: number;
  networkLatency: number;
}

class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.initializeObservers();
    this.collectInitialMetrics();
  }

  private initializeObservers() {
    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.metrics.largestContentfulPaint = lastEntry.startTime;
          this.logMetric('LCP', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (e) {
        console.warn('LCP observer not supported');
      }

      // First Input Delay
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            this.metrics.firstInputDelay = (entry as any).processingStart - entry.startTime;
            this.logMetric('FID', this.metrics.firstInputDelay);
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (e) {
        console.warn('FID observer not supported');
      }

      // Cumulative Layout Shift
      try {
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          });
          this.metrics.cumulativeLayoutShift = clsValue;
          this.logMetric('CLS', clsValue);
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (e) {
        console.warn('CLS observer not supported');
      }
    }
  }

  private collectInitialMetrics() {
    // Page load time
    window.addEventListener('load', () => {
      this.metrics.loadTime = performance.now();
      this.logMetric('Load Time', this.metrics.loadTime);
    });

    // DOM Content Loaded
    document.addEventListener('DOMContentLoaded', () => {
      this.metrics.domContentLoaded = performance.now();
      this.logMetric('DOMContentLoaded', this.metrics.domContentLoaded);
    });

    // First Contentful Paint (if supported)
    if ('getEntriesByType' in performance) {
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        this.metrics.firstContentfulPaint = fcpEntry.startTime;
        this.logMetric('FCP', fcpEntry.startTime);
      }
    }

    // Memory usage (if supported)
    if ('memory' in performance) {
      const memoryUsage = (performance as any).memory.usedJSHeapSize;
      this.metrics.memoryUsage = memoryUsage;
      this.logMetric('Memory Usage', memoryUsage);
    }
  }

  private logMetric(name: string, value: number) {
    console.log(`[Performance] ${name}: ${value.toFixed(2)}ms`);

    // Send to analytics service in production
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('event', 'web_vitals', {
        event_category: 'Performance',
        event_label: name,
        value: Math.round(value)
      });
    }
  }

  public getMetrics(): PerformanceMetrics {
    return this.metrics as PerformanceMetrics;
  }

  public measureCustomEvent(name: string, startMark: string, endMark?: string) {
    try {
      if (endMark) {
        performance.mark(endMark);
      }
      const measure = performance.measure(name, startMark, endMark);
      this.logMetric(`Custom: ${name}`, measure.duration);
      return measure.duration;
    } catch (error) {
      console.warn('Error measuring custom event:', error);
      return 0;
    }
  }

  public destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Network monitoring
class NetworkMonitor {
  private latencies: number[] = [];
  private readonly maxSamples = 10;

  constructor() {
    this.monitorNetworkChanges();
  }

  private monitorNetworkChanges() {
    // Monitor online/offline status
    window.addEventListener('online', () => {
      console.log('[Network] Connection restored');
      this.measureLatency();
    });

    window.addEventListener('offline', () => {
      console.log('[Network] Connection lost');
    });

    // Initial latency measurement
    this.measureLatency();
  }

  private async measureLatency() {
    try {
      const start = performance.now();
      // Use a small request to measure latency
      await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      const latency = performance.now() - start;
      this.addLatencySample(latency);
    } catch (error) {
      console.warn('[Network] Latency measurement failed');
    }
  }

  private addLatencySample(latency: number) {
    this.latencies.push(latency);
    if (this.latencies.length > this.maxSamples) {
      this.latencies.shift();
    }
  }

  public getAverageLatency(): number {
    if (this.latencies.length === 0) return 0;
    return this.latencies.reduce((sum, lat) => sum + lat, 0) / this.latencies.length;
  }

  public getConnectionType(): string {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      return connection.effectiveType || 'unknown';
    }
    return 'unknown';
  }
}

// Battery monitoring (if supported)
class BatteryMonitor {
  private batteryLevel = 1;
  private isCharging = true;

  constructor() {
    this.initializeBatteryMonitoring();
  }

  private async initializeBatteryMonitoring() {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        this.batteryLevel = battery.level;
        this.isCharging = battery.charging;

        battery.addEventListener('levelchange', () => {
          this.batteryLevel = battery.level;
          this.adaptToBatteryLevel();
        });

        battery.addEventListener('chargingchange', () => {
          this.isCharging = battery.charging;
          this.adaptToBatteryLevel();
        });
      } catch (error) {
        console.warn('Battery monitoring not available');
      }
    }
  }

  private adaptToBatteryLevel() {
    // Reduce performance-intensive features when battery is low
    if (this.batteryLevel < 0.2 && !this.isCharging) {
      console.log('[Battery] Low battery mode activated');
      document.body.classList.add('low-battery-mode');
    } else {
      document.body.classList.remove('low-battery-mode');
    }
  }

  public getBatteryLevel(): number {
    return this.batteryLevel;
  }

  public isBatteryCharging(): boolean {
    return this.isCharging;
  }
}

// Main performance manager
export class MobilePerformanceManager {
  private monitor: PerformanceMonitor;
  private networkMonitor: NetworkMonitor;
  private batteryMonitor: BatteryMonitor;
  private isMobile: boolean;

  constructor() {
    this.isMobile = this.detectMobile();
    this.monitor = new PerformanceMonitor();
    this.networkMonitor = new NetworkMonitor();
    this.batteryMonitor = new BatteryMonitor();

    if (this.isMobile) {
      this.applyMobileOptimizations();
    }
  }

  private detectMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || window.innerWidth <= 768;
  }

  private applyMobileOptimizations() {
    // Apply mobile-specific optimizations
    document.documentElement.classList.add('mobile-optimized');

    // Reduce animation complexity on mobile
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.style.setProperty('--animation-duration', '0.01ms');
    }

    // Optimize scrolling
    this.optimizeScrolling();

    console.log('[Mobile] Performance optimizations applied');
  }

  private optimizeScrolling() {
    // Use passive listeners for better scroll performance
    let ticking = false;

    function updateScrollEffects() {
      // Scroll-based animations go here
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollEffects);
        ticking = true;
      }
    }, { passive: true });
  }

  public getAllMetrics(): {
    performance: PerformanceMetrics;
    network: { latency: number; connectionType: string };
    battery: { level: number; charging: boolean };
    device: { isMobile: boolean; userAgent: string };
  } {
    return {
      performance: this.monitor.getMetrics(),
      network: {
        latency: this.networkMonitor.getAverageLatency(),
        connectionType: this.networkMonitor.getConnectionType()
      },
      battery: {
        level: this.batteryMonitor.getBatteryLevel(),
        charging: this.batteryMonitor.isBatteryCharging()
      },
      device: {
        isMobile: this.isMobile,
        userAgent: navigator.userAgent
      }
    };
  }

  public measureComponentLoad(componentName: string): number {
    const startMark = `${componentName}-start`;
    const endMark = `${componentName}-end`;

    performance.mark(startMark);
    return this.monitor.measureCustomEvent(`${componentName} Load`, startMark, endMark);
  }

  public destroy() {
    this.monitor.destroy();
  }
}

// Create global instance
export const mobilePerformance = new MobilePerformanceManager();

// Utility functions for components
export const measureRenderTime = (componentName: string) => {
  return mobilePerformance.measureComponentLoad(componentName);
};

export const usePerformanceMonitoring = () => {
  return {
    getMetrics: () => mobilePerformance.getAllMetrics(),
    measureComponent: (name: string) => mobilePerformance.measureComponentLoad(name)
  };
};