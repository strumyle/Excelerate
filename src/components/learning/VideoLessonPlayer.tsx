import React, { useRef, useEffect, useState } from 'react';
import { VideoPlayer } from '@/components/VideoPlayer';
import type { CourseModule } from '@/lib/learning';

interface VideoLessonPlayerProps {
  lesson: CourseModule;
  onProgressUpdate: (completed: boolean) => void;
}

export function VideoLessonPlayer({ lesson, onProgressUpdate }: VideoLessonPlayerProps) {
  const [hasReached90Percent, setHasReached90Percent] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || hasReached90Percent) return;

    const progress = (video.currentTime / video.duration) * 100;
    
    // Mark as completed when user reaches 90% of the video
    if (progress >= 90) {
      setHasReached90Percent(true);
      onProgressUpdate(true);
    } else if (progress >= 10) {
      // Mark as in progress when they've watched at least 10%
      onProgressUpdate(false);
    }
  };

  // Set up event listeners for HTML5 video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.addEventListener('timeupdate', handleVideoTimeUpdate);
    
    return () => {
      video.removeEventListener('timeupdate', handleVideoTimeUpdate);
    };
  }, [hasReached90Percent]);

  // Determine video source and type
  const getVideoProps = () => {
    if (lesson.content_url && lesson.type === 'video') {
      // Check if it's a YouTube URL
      if (lesson.content_url.includes('youtube.com') || lesson.content_url.includes('youtu.be')) {
        return {
          videoType: 'youtube' as const,
          videoUrl: lesson.content_url
        };
      } else {
        // Determine video type from URL extension
        const url = lesson.content_url.toLowerCase();
        if (url.includes('.webm')) {
          return { videoType: 'webm' as const, videoUrl: lesson.content_url };
        } else if (url.includes('.ogg')) {
          return { videoType: 'ogg' as const, videoUrl: lesson.content_url };
        } else {
          return { videoType: 'mp4' as const, videoUrl: lesson.content_url };
        }
      }
    }
    
    return null;
  };

  const videoProps = getVideoProps();

  if (!videoProps) {
    return (
      <div className="bg-muted rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No video content available for this lesson.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        {videoProps.videoType === 'youtube' ? (
          <VideoPlayer
            {...videoProps}
            title={lesson.title}
            className="w-full"
            width="100%"
            height="400"
          />
        ) : (
          <div className="relative">
            <VideoPlayer
              {...videoProps}
              title={lesson.title}
              className="w-full"
              width="100%"
              height="400"
            />
            {/* Hidden ref for progress tracking on direct video files */}
            <video
              ref={videoRef}
              style={{ display: 'none' }}
              src={videoProps.videoUrl}
              onTimeUpdate={handleVideoTimeUpdate}
            />
          </div>
        )}
      </div>
      
      {hasReached90Percent && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-green-800 font-medium">
            🎉 Lesson completed! You've watched enough of this video.
          </p>
        </div>
      )}
      
      {lesson.duration_minutes && (
        <p className="text-sm text-muted-foreground">
          Estimated duration: {lesson.duration_minutes} minutes
        </p>
      )}
    </div>
  );
}