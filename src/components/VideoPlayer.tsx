import React from 'react';

interface VideoPlayerProps {
  videoType: 'youtube' | 'mp4' | 'webm' | 'ogg';
  videoUrl: string;
  title: string;
  className?: string;
  width?: string;
  height?: string;
}

export function VideoPlayer({ 
  videoType, 
  videoUrl, 
  title, 
  className = "",
  width = "100%",
  height = "315"
}: VideoPlayerProps) {
  const extractYouTubeId = (url?: string | null) => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return match ? match[1] : null;
  };
  if (videoType === 'youtube') {
    const youtubeId = extractYouTubeId(videoUrl);
    if (!youtubeId) {
      return (
        <div className={`bg-gray-100 rounded-lg p-4 text-center ${className}`}>
          <p className="text-gray-600">Invalid YouTube URL</p>
        </div>
      );
    }

    return (
      <iframe
        width={width}
        height={height}
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1`}
        title={title}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
        allowFullScreen
        className={`rounded ${className}`}
      />
    );
  }

  // Handle direct video files (MP4, WebM, OGG)
  return (
    <video
      width={width}
      height={height}
      controls
      className={`rounded ${className}`}
      title={title}
    >
      <source src={videoUrl} type={`video/${videoType}`} />
      Your browser does not support the video tag.
    </video>
  );
}