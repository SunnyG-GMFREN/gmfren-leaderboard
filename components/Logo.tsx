export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-label="GMFREN"
      role="img"
    >
      <circle cx="24" cy="24" r="22" fill="#FFC93C" stroke="#0A111E" strokeWidth="2" />
      <path
        d="M24 6c2.4 3.4 4 6.6 4 9.4 0 2.4-1.8 4.2-4 4.2s-4-1.8-4-4.2c0-2.8 1.6-6 4-9.4Z"
        fill="#0A111E"
      />
      <circle cx="16.5" cy="26" r="2.4" fill="#0A111E" />
      <circle cx="31.5" cy="26" r="2.4" fill="#0A111E" />
      <path
        d="M14 32c3 3 6.8 4.6 10 4.6s7-1.6 10-4.6"
        stroke="#0A111E"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
