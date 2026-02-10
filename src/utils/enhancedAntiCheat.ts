
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface EnhancedViolation {
  type: 'tab_switch' | 'window_blur' | 'right_click' | 'copy' | 'print_screen' | 'screenshot_attempt';
  timestamp: string;
  details?: {
    duration?: number;
    windowSize?: { width: number; height: number };
    userAgent?: string;
    ipAddress?: string;
  };
}

export interface AntiCheatMetrics {
  totalViolations: number;
  tabSwitches: number;
  windowBlurs: number;
  rightClicks: number;
  copyAttempts: number;
  screenshotAttempts: number;
  suspiciousActivity: boolean;
}

export class EnhancedAntiCheat {
  private violations: EnhancedViolation[] = [];
  private submissionId: string;
  private userId: string;
  private startTime: Date;
  private isActive = false;
  private focusLostTime: number | null = null;
  private violationThresholds = {
    maxTabSwitches: 3,
    maxWindowBlurs: 5,
    maxRightClicks: 10,
    maxCopyAttempts: 3
  };

  constructor(submissionId: string, userId: string) {
    this.submissionId = submissionId;
    this.userId = userId;
    this.startTime = new Date();
  }

  initialize() {
    if (this.isActive) return;
    
    this.isActive = true;
    this.violations = [];
    
    // Enhanced visibility change detection
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    window.addEventListener('blur', this.handleWindowBlur.bind(this));
    window.addEventListener('focus', this.handleWindowFocus.bind(this));
    
    // Block context menu and copy operations
    document.addEventListener('contextmenu', this.handleRightClick.bind(this));
    document.addEventListener('copy', this.handleCopy.bind(this));
    document.addEventListener('cut', this.handleCopy.bind(this));
    
    // Enhanced keyboard monitoring
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    
    // Screenshot detection (limited browser support)
    if ('getDisplayMedia' in navigator.mediaDevices) {
      this.monitorScreenCapture();
    }
    
    // Disable various shortcuts
    this.disableShortcuts();
    
    console.log('Enhanced anti-cheat system initialized');
  }

  cleanup() {
    this.isActive = false;
    
    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    window.removeEventListener('blur', this.handleWindowBlur.bind(this));
    window.removeEventListener('focus', this.handleWindowFocus.bind(this));
    document.removeEventListener('contextmenu', this.handleRightClick.bind(this));
    document.removeEventListener('copy', this.handleCopy.bind(this));
    document.removeEventListener('cut', this.handleCopy.bind(this));
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.removeEventListener('keyup', this.handleKeyUp.bind(this));
    
    return this.violations;
  }

  private async recordViolation(type: EnhancedViolation['type'], details?: any) {
    const violation: EnhancedViolation = {
      type,
      timestamp: new Date().toISOString(),
      details: {
        windowSize: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        userAgent: navigator.userAgent,
        ...details
      }
    };
    
    this.violations.push(violation);
    
    // Real-time violation reporting
    try {
      await this.submitViolations();
    } catch (error) {
      console.error('Failed to report violation in real-time:', error);
    }
    
    // Check if violation thresholds are exceeded
    this.checkSuspiciousActivity();
  }

  private handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      this.focusLostTime = Date.now();
      this.recordViolation('tab_switch', {
        action: 'tab_hidden'
      });
    } else if (document.visibilityState === 'visible' && this.focusLostTime) {
      const duration = Date.now() - this.focusLostTime;
      this.recordViolation('tab_switch', {
        action: 'tab_visible',
        duration
      });
      this.focusLostTime = null;
    }
  }

  private handleWindowBlur() {
    this.focusLostTime = Date.now();
    this.recordViolation('window_blur', {
      action: 'window_lost_focus'
    });
  }

  private handleWindowFocus() {
    if (this.focusLostTime) {
      const duration = Date.now() - this.focusLostTime;
      this.recordViolation('window_blur', {
        action: 'window_gained_focus',
        duration
      });
      this.focusLostTime = null;
    }
  }

  private handleRightClick(e: MouseEvent) {
    e.preventDefault();
    this.recordViolation('right_click', {
      x: e.clientX,
      y: e.clientY
    });
    return false;
  }

  private handleCopy(e: ClipboardEvent) {
    e.preventDefault();
    this.recordViolation('copy', {
      type: e.type
    });
    return false;
  }

  private handleKeyDown(e: KeyboardEvent) {
    // Block PrintScreen
    if (e.key === 'PrintScreen' || e.keyCode === 44) {
      e.preventDefault();
      this.recordViolation('print_screen');
      return false;
    }
    
    // Block F12 (Developer Tools)
    if (e.key === 'F12') {
      e.preventDefault();
      this.recordViolation('screenshot_attempt', { key: 'F12' });
      return false;
    }
    
    // Block Ctrl+Shift+I (Developer Tools)
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      this.recordViolation('screenshot_attempt', { key: 'Ctrl+Shift+I' });
      return false;
    }
    
    // Block various other shortcuts
    if (e.ctrlKey) {
      const blockedKeys = ['a', 'c', 'v', 'x', 's', 'p', 'u'];
      if (blockedKeys.includes(e.key.toLowerCase())) {
        e.preventDefault();
        this.recordViolation('copy', { key: `Ctrl+${e.key.toUpperCase()}` });
        return false;
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    // Additional monitoring if needed
  }

  private disableShortcuts() {
    // Disable drag and drop
    document.addEventListener('dragstart', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
    
    // Disable text selection
    document.addEventListener('selectstart', (e) => e.preventDefault());
    
    // Disable image dragging
    const images = document.getElementsByTagName('img');
    for (let i = 0; i < images.length; i++) {
      images[i].addEventListener('dragstart', (e) => e.preventDefault());
    }
  }

  private monitorScreenCapture() {
    // Limited browser support for detecting screen capture
    try {
      navigator.mediaDevices.addEventListener('devicechange', () => {
        this.recordViolation('screenshot_attempt', {
          reason: 'device_change_detected'
        });
      });
    } catch (error) {
      console.log('Screen capture monitoring not supported');
    }
  }

  private checkSuspiciousActivity() {
    const metrics = this.getMetrics();
    
    if (
      metrics.tabSwitches > this.violationThresholds.maxTabSwitches ||
      metrics.windowBlurs > this.violationThresholds.maxWindowBlurs ||
      metrics.rightClicks > this.violationThresholds.maxRightClicks ||
      metrics.copyAttempts > this.violationThresholds.maxCopyAttempts
    ) {
      // Flag as suspicious but don't auto-submit the test
      console.warn('Suspicious activity detected - high violation count');
      this.recordViolation('screenshot_attempt', {
        reason: 'threshold_exceeded',
        metrics
      });
    }
  }

  async submitViolations() {
    try {
      const jsonViolations = this.violations.map(v => ({
        type: v.type,
        timestamp: v.timestamp,
        details: v.details
      })) as Json[];
      
      const { error } = await supabase
        .from('test_submissions')
        .update({ 
          violations: jsonViolations,
          violations_count: this.violations.length
        })
        .eq('id', this.submissionId);
      
      if (error) {
        console.error('Error submitting violations:', error);
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Error in submitViolations:', err);
      return false;
    }
  }

  getMetrics(): AntiCheatMetrics {
    const tabSwitches = this.violations.filter(v => v.type === 'tab_switch').length;
    const windowBlurs = this.violations.filter(v => v.type === 'window_blur').length;
    const rightClicks = this.violations.filter(v => v.type === 'right_click').length;
    const copyAttempts = this.violations.filter(v => v.type === 'copy').length;
    const screenshotAttempts = this.violations.filter(v => v.type === 'screenshot_attempt').length;
    
    return {
      totalViolations: this.violations.length,
      tabSwitches,
      windowBlurs,
      rightClicks,
      copyAttempts,
      screenshotAttempts,
      suspiciousActivity: (
        tabSwitches > this.violationThresholds.maxTabSwitches ||
        windowBlurs > this.violationThresholds.maxWindowBlurs ||
        rightClicks > this.violationThresholds.maxRightClicks ||
        copyAttempts > this.violationThresholds.maxCopyAttempts
      )
    };
  }

  getViolationSummary(): string {
    const metrics = this.getMetrics();
    return `Total violations: ${metrics.totalViolations} (Tab switches: ${metrics.tabSwitches}, Window blurs: ${metrics.windowBlurs}, Right clicks: ${metrics.rightClicks}, Copy attempts: ${metrics.copyAttempts})`;
  }
}
