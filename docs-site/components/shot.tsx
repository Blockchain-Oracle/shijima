'use client';

import { useEffect, useRef } from 'react';

type ShotProps = { name: string; alt: string; caption: string; lightOnly?: boolean };
type ClipProps = { name: string; caption: string };

export function Shot({ name, alt, caption, lightOnly = false }: ShotProps) {
  return (
    <figure className="walkthrough-shot not-prose">
      <img className={lightOnly ? undefined : 'walkthrough-light'} src={`/walkthrough/${name}-light.png`} width={1440} height={900} alt={alt} loading="lazy" decoding="async" />
      {!lightOnly && <img className="walkthrough-dark" src={`/walkthrough/${name}-dark.png`} width={1440} height={900} alt={alt} loading="lazy" decoding="async" />}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function Clip({ name, caption }: ClipProps) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      if (motion.matches) video.current?.pause();
      else void video.current?.play().catch(() => {});
    };
    sync();
    motion.addEventListener('change', sync);
    return () => motion.removeEventListener('change', sync);
  }, []);

  return (
    <figure className="walkthrough-clip not-prose">
      <video ref={video} muted loop playsInline controls preload="metadata" poster={`/walkthrough/${name}-poster.png`} aria-label={caption}>
        <source src={`/walkthrough/${name}.webm`} type="video/webm" />
        <source src={`/walkthrough/${name}.mp4`} type="video/mp4" />
      </video>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
