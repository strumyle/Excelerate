import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface Violation {
  type: 'tab_switch' | 'right_click' | 'copy' | 'print_screen';
  timestamp: string;
  count?: number;
}

export interface AntiCheatOptions {
  maxTabSwitches?: number;
  onViolation?: (type: Violation['type']) => void;
}

export class AntiCheat {
  private violations: Violation[] = [];
  private startTime: Date | null = null;
  private submissionId: string;
  private userId: string;
  private tabSwitchCount = 0;
  private rightClickCount = 0;
  private copyCount = 0;
  private printScreenCount = 0;
  private options: AntiCheatOptions;

  constructor(testId: string, userId: string, options: AntiCheatOptions = {}) {
    this.submissionId = testId;
    this.userId = userId;
    this.options = options;
  }

  initialize() {
    this.startTime = new Date();
    this.violations = [];
    
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    document.addEventListener('contextmenu', this.handleRightClick.bind(this));
    document.addEventListener('copy', this.handleCopy.bind(this));
    document.addEventListener('keydown', this.handlePrintScreen.bind(this));

    console.log('Anti-cheat system initialized');
  }

  cleanup() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    document.removeEventListener('contextmenu', this.handleRightClick.bind(this));
    document.removeEventListener('copy', this.handleCopy.bind(this));
    document.removeEventListener('keydown', this.handlePrintScreen.bind(this));
    
    return this.violations;
  }

  async submitViolations() {
    try {
      // Convert violations to a format compatible with Json type
      const jsonViolations = this.violations.map(v => ({
        type: v.type,
        timestamp: v.timestamp,
        count: v.count
      })) as Json[];
      
      const { error } = await supabase
        .from('test_submissions')
        .update({ violations: jsonViolations })
        .eq('id', this.submissionId);
      
      if (error) {
        console.error('Error submitting violations:', error);
      }
      
      return !error;
    } catch (err) {
      console.error('Error in submitViolations:', err);
      return false;
    }
  }

  getViolationsCount() {
    return {
      tabSwitches: this.tabSwitchCount,
      rightClicks: this.rightClickCount,
      copies: this.copyCount,
      printScreens: this.printScreenCount,
      total: this.tabSwitchCount + this.rightClickCount + this.copyCount + this.printScreenCount
    };
  }

  private handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      const now = new Date();
      this.violations.push({
        type: 'tab_switch',
        timestamp: now.toISOString(),
      });
      this.tabSwitchCount++;

      if (this.options.onViolation) {
        this.options.onViolation('tab_switch');
      }
    }
  }

  private handleRightClick(e: MouseEvent) {
    e.preventDefault();
    const now = new Date();
    this.violations.push({
      type: 'right_click',
      timestamp: now.toISOString(),
    });
    this.rightClickCount++;

    if (this.options.onViolation) {
      this.options.onViolation('right_click');
    }
  }

  private handleCopy(e: ClipboardEvent) {
    e.preventDefault();
    const now = new Date();
    this.violations.push({
      type: 'copy',
      timestamp: now.toISOString(),
    });
    this.copyCount++;

    if (this.options.onViolation) {
      this.options.onViolation('copy');
    }
  }

  private handlePrintScreen(e: KeyboardEvent) {
    // Check for PrintScreen key (sometimes code 44)
    if (e.key === 'PrintScreen' || e.keyCode === 44) {
      e.preventDefault();
      const now = new Date();
      this.violations.push({
        type: 'print_screen',
        timestamp: now.toISOString(),
      });
      this.printScreenCount++;

      if (this.options.onViolation) {
        this.options.onViolation('print_screen');
      }
    }
  }
}

// Keep the old functions for backward compatibility
let violations: Violation[] = [];
let startTime: Date | null = null;
let submissionId: string | null = null;
let tabSwitchCount = 0;
let rightClickCount = 0;
let copyCount = 0;
let printScreenCount = 0;

export const startMonitoring = (testSubmissionId: string) => {
  submissionId = testSubmissionId;
  startTime = new Date();
  violations = [];
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('contextmenu', handleRightClick);
  document.addEventListener('copy', handleCopy);
  document.addEventListener('keydown', handlePrintScreen);
};

export const stopMonitoring = () => {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  document.removeEventListener('contextmenu', handleRightClick);
  document.removeEventListener('copy', handleCopy);
  document.removeEventListener('keydown', handlePrintScreen);
  
  return violations;
};

export const submitViolations = async () => {
  if (!submissionId) return;
  
  try {
    // Convert violations to a format compatible with Json type
    const jsonViolations = violations.map(v => ({
      type: v.type,
      timestamp: v.timestamp,
      count: v.count
    })) as Json[];
    
    const { error } = await supabase
      .from('test_submissions')
      .update({ violations: jsonViolations })
      .eq('id', submissionId);
    
    if (error) {
      console.error('Error submitting violations:', error);
    }
    
    return !error;
  } catch (err) {
    console.error('Error in submitViolations:', err);
    return false;
  }
};

export const getViolationsCount = () => {
  return {
    tabSwitches: tabSwitchCount,
    rightClicks: rightClickCount,
    copies: copyCount,
    printScreens: printScreenCount,
    total: tabSwitchCount + rightClickCount + copyCount + printScreenCount
  };
};

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    const now = new Date();
    violations.push({
      type: 'tab_switch',
      timestamp: now.toISOString(),
    });
    tabSwitchCount++;
  }
}

function handleRightClick(e: MouseEvent) {
  e.preventDefault();
  const now = new Date();
  violations.push({
    type: 'right_click',
    timestamp: now.toISOString(),
  });
  rightClickCount++;
}

function handleCopy(e: ClipboardEvent) {
  e.preventDefault();
  const now = new Date();
  violations.push({
    type: 'copy',
    timestamp: now.toISOString(),
  });
  copyCount++;
}

function handlePrintScreen(e: KeyboardEvent) {
  // Check for PrintScreen key (sometimes code 44)
  if (e.key === 'PrintScreen' || e.keyCode === 44) {
    e.preventDefault();
    const now = new Date();
    violations.push({
      type: 'print_screen',
      timestamp: now.toISOString(),
    });
    printScreenCount++;
  }
}
