import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type ViolationType =
  | 'tab_switch'
  | 'right_click'
  | 'copy'
  | 'print_screen'
  | 'proctor_permission_denied'
  | 'camera_missing'
  | 'camera_lost'
  | 'no_face_detected'
  | 'multiple_faces_detected'
  | 'mic_muted_or_blocked'
  | 'sustained_speech_detected';

export interface Violation {
  type: ViolationType;
  timestamp: string;
  details?: Record<string, unknown>;
  count?: number;
}

export interface AntiCheatOptions {
  maxTabSwitches?: number;
  onViolation?: (type: Violation['type']) => void;
}

export class AntiCheat {
  private violations: Violation[] = [];
  private submissionId: string;
  private userId: string;
  private tabSwitchCount = 0;
  private rightClickCount = 0;
  private copyCount = 0;
  private printScreenCount = 0;
  private options: AntiCheatOptions;

  private visibilityHandler = this.handleVisibilityChange.bind(this);
  private rightClickHandler = this.handleRightClick.bind(this);
  private copyHandler = this.handleCopy.bind(this);
  private printScreenHandler = this.handlePrintScreen.bind(this);

  constructor(submissionId: string, userId: string, options: AntiCheatOptions = {}) {
    this.submissionId = submissionId;
    this.userId = userId;
    this.options = options;
  }

  async bootstrapFromSubmission() {
    try {
      const { data, error } = await supabase
        .from('test_submissions')
        .select('violations')
        .eq('id', this.submissionId)
        .maybeSingle();

      if (error) {
        console.error('Failed to bootstrap anti-cheat violations:', error);
        return;
      }

      if (!Array.isArray(data?.violations)) return;

      this.violations = data.violations
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const type = (entry as Record<string, unknown>).type;
          const timestamp = (entry as Record<string, unknown>).timestamp;
          const details = (entry as Record<string, unknown>).details;
          const count = (entry as Record<string, unknown>).count;
          if (typeof type !== 'string' || typeof timestamp !== 'string') return null;
          return {
            type: type as ViolationType,
            timestamp,
            details: typeof details === 'object' && details ? (details as Record<string, unknown>) : undefined,
            count: typeof count === 'number' ? count : undefined,
          } as Violation;
        })
        .filter((entry): entry is Violation => Boolean(entry));

      this.recomputeCounters();
    } catch (error) {
      console.error('Unexpected bootstrap error:', error);
    }
  }

  initialize() {
    document.addEventListener('visibilitychange', this.visibilityHandler);
    document.addEventListener('contextmenu', this.rightClickHandler);
    document.addEventListener('copy', this.copyHandler);
    document.addEventListener('keydown', this.printScreenHandler);

    console.log('Anti-cheat system initialized for user', this.userId);
  }

  cleanup() {
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    document.removeEventListener('contextmenu', this.rightClickHandler);
    document.removeEventListener('copy', this.copyHandler);
    document.removeEventListener('keydown', this.printScreenHandler);

    return this.violations;
  }

  async recordExternalViolation(type: ViolationType, details?: Record<string, unknown>) {
    await this.recordViolation(type, details);
  }

  async submitViolations() {
    try {
      const jsonViolations = this.violations.map((v) => ({
        type: v.type,
        timestamp: v.timestamp,
        count: v.count,
        details: v.details,
      })) as Json[];

      const { error } = await supabase
        .from('test_submissions')
        .update({
          violations: jsonViolations,
          violations_count: this.violations.length,
        })
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
      total: this.violations.length,
    };
  }

  private recomputeCounters() {
    this.tabSwitchCount = this.violations.filter((entry) => entry.type === 'tab_switch').length;
    this.rightClickCount = this.violations.filter((entry) => entry.type === 'right_click').length;
    this.copyCount = this.violations.filter((entry) => entry.type === 'copy').length;
    this.printScreenCount = this.violations.filter((entry) => entry.type === 'print_screen').length;
  }

  private async recordViolation(type: ViolationType, details?: Record<string, unknown>) {
    const now = new Date();

    this.violations.push({
      type,
      timestamp: now.toISOString(),
      details,
    });

    if (type === 'tab_switch') this.tabSwitchCount += 1;
    if (type === 'right_click') this.rightClickCount += 1;
    if (type === 'copy') this.copyCount += 1;
    if (type === 'print_screen') this.printScreenCount += 1;

    if (this.options.onViolation) {
      this.options.onViolation(type);
    }

    await this.submitViolations();
  }

  private handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      void this.recordViolation('tab_switch');
    }
  }

  private handleRightClick(e: MouseEvent) {
    e.preventDefault();
    void this.recordViolation('right_click');
  }

  private handleCopy(e: ClipboardEvent) {
    e.preventDefault();
    void this.recordViolation('copy');
  }

  private handlePrintScreen(e: KeyboardEvent) {
    if (e.key === 'PrintScreen' || e.keyCode === 44) {
      e.preventDefault();
      void this.recordViolation('print_screen');
    }
  }
}

// Legacy exports retained for compatibility with older imports.
let legacyViolations: Violation[] = [];
let legacySubmissionId: string | null = null;
let legacyTabSwitchCount = 0;
let legacyRightClickCount = 0;
let legacyCopyCount = 0;
let legacyPrintScreenCount = 0;

const recordLegacyViolation = (type: ViolationType) => {
  legacyViolations.push({ type, timestamp: new Date().toISOString() });
  if (type === 'tab_switch') legacyTabSwitchCount += 1;
  if (type === 'right_click') legacyRightClickCount += 1;
  if (type === 'copy') legacyCopyCount += 1;
  if (type === 'print_screen') legacyPrintScreenCount += 1;
};

const handleLegacyVisibilityChange = () => {
  if (document.visibilityState === 'hidden') {
    recordLegacyViolation('tab_switch');
  }
};

const handleLegacyRightClick = (event: MouseEvent) => {
  event.preventDefault();
  recordLegacyViolation('right_click');
};

const handleLegacyCopy = (event: ClipboardEvent) => {
  event.preventDefault();
  recordLegacyViolation('copy');
};

const handleLegacyPrintScreen = (event: KeyboardEvent) => {
  if (event.key === 'PrintScreen' || event.keyCode === 44) {
    event.preventDefault();
    recordLegacyViolation('print_screen');
  }
};

export const startMonitoring = (testSubmissionId: string) => {
  legacySubmissionId = testSubmissionId;
  legacyViolations = [];
  legacyTabSwitchCount = 0;
  legacyRightClickCount = 0;
  legacyCopyCount = 0;
  legacyPrintScreenCount = 0;

  document.addEventListener('visibilitychange', handleLegacyVisibilityChange);
  document.addEventListener('contextmenu', handleLegacyRightClick);
  document.addEventListener('copy', handleLegacyCopy);
  document.addEventListener('keydown', handleLegacyPrintScreen);
};

export const stopMonitoring = () => {
  document.removeEventListener('visibilitychange', handleLegacyVisibilityChange);
  document.removeEventListener('contextmenu', handleLegacyRightClick);
  document.removeEventListener('copy', handleLegacyCopy);
  document.removeEventListener('keydown', handleLegacyPrintScreen);

  return legacyViolations;
};

export const submitViolations = async () => {
  if (!legacySubmissionId) return false;

  try {
    const jsonViolations = legacyViolations.map((v) => ({
      type: v.type,
      timestamp: v.timestamp,
      count: v.count,
      details: v.details,
    })) as Json[];

    const { error } = await supabase
      .from('test_submissions')
      .update({
        violations: jsonViolations,
        violations_count: legacyViolations.length,
      })
      .eq('id', legacySubmissionId);

    if (error) {
      console.error('Error submitting violations:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in submitViolations:', err);
    return false;
  }
};

export const getViolationsCount = () => ({
  tabSwitches: legacyTabSwitchCount,
  rightClicks: legacyRightClickCount,
  copies: legacyCopyCount,
  printScreens: legacyPrintScreenCount,
  total: legacyViolations.length,
});
