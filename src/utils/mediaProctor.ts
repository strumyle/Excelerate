import type { ViolationType } from '@/utils/antiCheat';

export type ProctoringConsent = 'granted' | 'denied' | 'unsupported' | 'unknown';
export type ProctoringStatus = 'inactive' | 'active' | 'declined' | 'limited';

interface FaceDetectorLike {
  detect: (input: HTMLVideoElement) => Promise<Array<unknown>>;
}

interface FaceDetectorConstructorLike {
  new (options?: { maxDetectedFaces?: number; fastMode?: boolean }): FaceDetectorLike;
}

interface StartResult {
  consent: ProctoringConsent;
  enabled: boolean;
  status: ProctoringStatus;
  reason?: string;
}

interface MediaProctorOptions {
  onViolation: (type: ViolationType, details?: Record<string, unknown>) => void;
}

const AUDIO_THRESHOLD_RMS = 0.07;
const NO_FACE_THRESHOLD_MS = 20_000;
const MULTI_FACE_WINDOW_MS = 10_000;
const MULTI_FACE_HITS_REQUIRED = 3;
const SUSTAINED_SPEECH_THRESHOLD_MS = 12_000;

export class MediaProctor {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private faceDetector: FaceDetectorLike | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private audioData: Uint8Array | null = null;
  private faceIntervalId: number | null = null;
  private audioIntervalId: number | null = null;
  private noFaceSince: number | null = null;
  private noFaceFlagged = false;
  private multiFaceHits: number[] = [];
  private speechSince: number | null = null;
  private speechFlagged = false;
  private violationCooldowns = new Map<ViolationType, number>();
  private options: MediaProctorOptions;
  private started = false;

  constructor(options: MediaProctorOptions) {
    this.options = options;
  }

  async start(): Promise<StartResult> {
    if (this.started) {
      return { consent: 'granted', enabled: true, status: this.faceDetector ? 'active' : 'limited' };
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return {
        consent: 'unsupported',
        enabled: false,
        status: 'limited',
        reason: 'Browser does not support media capture APIs.',
      };
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      this.started = true;
    } catch (error: any) {
      const name = String(error?.name || '');
      const denied = name === 'NotAllowedError' || name === 'SecurityError';
      const unavailable = name === 'NotFoundError' || name === 'NotReadableError';

      if (unavailable) {
        this.emitViolation('camera_missing', { error: name });
      }

      return {
        consent: denied ? 'denied' : 'unsupported',
        enabled: false,
        status: denied ? 'declined' : 'limited',
        reason: error?.message || 'Could not access camera/microphone.',
      };
    }

    const videoTrack = this.stream.getVideoTracks()[0];
    const audioTrack = this.stream.getAudioTracks()[0];

    if (!videoTrack) {
      this.emitViolation('camera_missing');
      return {
        consent: 'unsupported',
        enabled: false,
        status: 'limited',
        reason: 'No video track was available from the device.',
      };
    }

    if (!audioTrack) {
      this.emitViolation('mic_muted_or_blocked', { reason: 'missing_audio_track' });
    }

    videoTrack.addEventListener('ended', () => {
      this.emitViolation('camera_lost', { reason: 'video_track_ended' });
    });
    audioTrack?.addEventListener('ended', () => {
      this.emitViolation('mic_muted_or_blocked', { reason: 'audio_track_ended' });
    });

    await this.initializeVideoElement(this.stream);
    const faceSupport = this.startFaceDetection();
    this.startAudioMonitoring(audioTrack);

    return {
      consent: 'granted',
      enabled: true,
      status: faceSupport ? 'active' : 'limited',
      reason: faceSupport ? undefined : 'FaceDetector API unavailable; running fallback checks.',
    };
  }

  stop() {
    this.started = false;

    if (this.faceIntervalId !== null) {
      window.clearInterval(this.faceIntervalId);
      this.faceIntervalId = null;
    }
    if (this.audioIntervalId !== null) {
      window.clearInterval(this.audioIntervalId);
      this.audioIntervalId = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // no-op
      }
      this.sourceNode = null;
    }
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {
        // no-op
      }
      this.analyser = null;
    }
    if (this.audioContext) {
      void this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement.remove();
      this.videoElement = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.noFaceSince = null;
    this.noFaceFlagged = false;
    this.multiFaceHits = [];
    this.speechSince = null;
    this.speechFlagged = false;
    this.violationCooldowns.clear();
  }

  private async initializeVideoElement(stream: MediaStream) {
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.style.position = 'fixed';
    video.style.left = '-99999px';
    video.style.width = '1px';
    video.style.height = '1px';
    video.setAttribute('aria-hidden', 'true');
    document.body.appendChild(video);
    this.videoElement = video;

    try {
      await video.play();
    } catch {
      // Some browsers still require a gesture. Monitoring fallback still runs.
    }
  }

  private getFaceDetectorConstructor(): FaceDetectorConstructorLike | null {
    const candidate = (window as unknown as { FaceDetector?: FaceDetectorConstructorLike }).FaceDetector;
    return typeof candidate === 'function' ? candidate : null;
  }

  private startFaceDetection(): boolean {
    const FaceDetectorCtor = this.getFaceDetectorConstructor();
    if (!FaceDetectorCtor || !this.videoElement) {
      return false;
    }

    this.faceDetector = new FaceDetectorCtor({ maxDetectedFaces: 5, fastMode: true });
    this.faceIntervalId = window.setInterval(() => {
      void this.checkFaces();
    }, 3000);

    return true;
  }

  private async checkFaces() {
    if (!this.videoElement || !this.faceDetector) return;
    if (this.videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    try {
      const faces = await this.faceDetector.detect(this.videoElement);
      const now = Date.now();

      if (!faces || faces.length === 0) {
        if (this.noFaceSince === null) {
          this.noFaceSince = now;
        }
        if (!this.noFaceFlagged && now - this.noFaceSince >= NO_FACE_THRESHOLD_MS) {
          this.noFaceFlagged = true;
          this.emitViolation('no_face_detected', { durationMs: now - this.noFaceSince });
        }
      } else {
        this.noFaceSince = null;
        this.noFaceFlagged = false;
      }

      if (faces.length > 1) {
        this.multiFaceHits.push(now);
        this.multiFaceHits = this.multiFaceHits.filter((ts) => now - ts <= MULTI_FACE_WINDOW_MS);
        if (this.multiFaceHits.length >= MULTI_FACE_HITS_REQUIRED) {
          this.multiFaceHits = [];
          this.emitViolation('multiple_faces_detected', { count: faces.length });
        }
      } else {
        this.multiFaceHits = [];
      }
    } catch (error: any) {
      this.emitViolation('camera_lost', { reason: 'face_detection_failed', message: error?.message });
    }
  }

  private startAudioMonitoring(audioTrack?: MediaStreamTrack) {
    if (!this.stream || !audioTrack) {
      this.emitViolation('mic_muted_or_blocked', { reason: 'missing_audio_track' });
      return;
    }

    try {
      const audioContextCtor =
        (window as any).AudioContext || (window as any).webkitAudioContext || null;

      if (!audioContextCtor) {
        this.emitViolation('mic_muted_or_blocked', { reason: 'audio_context_not_supported' });
        return;
      }

      this.audioContext = new audioContextCtor();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
      this.sourceNode.connect(this.analyser);
      this.audioData = new Uint8Array(this.analyser.fftSize);

      this.audioIntervalId = window.setInterval(() => {
        this.checkAudio(audioTrack);
      }, 1000);
    } catch (error: any) {
      this.emitViolation('mic_muted_or_blocked', { reason: 'audio_monitor_init_failed', message: error?.message });
    }
  }

  private checkAudio(audioTrack: MediaStreamTrack) {
    if (!this.analyser || !this.audioData) return;

    if (!audioTrack.enabled || audioTrack.muted || audioTrack.readyState !== 'live') {
      this.emitViolation('mic_muted_or_blocked', {
        enabled: audioTrack.enabled,
        muted: audioTrack.muted,
        readyState: audioTrack.readyState,
      });
      return;
    }

    this.analyser.getByteTimeDomainData(this.audioData);

    let sumSquares = 0;
    for (let i = 0; i < this.audioData.length; i += 1) {
      const centered = (this.audioData[i] - 128) / 128;
      sumSquares += centered * centered;
    }
    const rms = Math.sqrt(sumSquares / this.audioData.length);
    const now = Date.now();

    if (rms >= AUDIO_THRESHOLD_RMS) {
      if (this.speechSince === null) {
        this.speechSince = now;
      }
      if (!this.speechFlagged && now - this.speechSince >= SUSTAINED_SPEECH_THRESHOLD_MS) {
        this.speechFlagged = true;
        this.emitViolation('sustained_speech_detected', {
          durationMs: now - this.speechSince,
          rms,
        });
      }
    } else {
      this.speechSince = null;
      this.speechFlagged = false;
    }
  }

  private emitViolation(type: ViolationType, details?: Record<string, unknown>) {
    const now = Date.now();
    const last = this.violationCooldowns.get(type) || 0;
    const cooldownMs = type === 'mic_muted_or_blocked' ? 30_000 : 10_000;
    if (now - last < cooldownMs) return;

    this.violationCooldowns.set(type, now);
    this.options.onViolation(type, details);
  }
}
