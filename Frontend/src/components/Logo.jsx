// KeyNova logo. Uses the pre-sized rounded PNGs in /public.
// 192px source up to ~96px on screen (crisp on retina); 320px above that (512px is kept for social/OG sharing).
export default function Logo({ size = 44, className = '', priority = false }) {
  const src = size > 96 ? '/keynova-logo-320.png' : '/keynova-logo-192.png';
  return (
    <img
      className={`kn-logo ${className}`.trim()}
      src={src}
      alt="KeyNova logo"
      width={size}
      height={size}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
    />
  );
}
