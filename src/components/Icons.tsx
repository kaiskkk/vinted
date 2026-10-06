import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function make(paths: React.ReactNode) {
  return function Icon({ size = 18, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {paths}
      </svg>
    );
  };
}

export const PlusIcon = make(<path d="M12 5v14M5 12h14" />);
export const TrashIcon = make(
  <>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
  </>,
);
export const PencilIcon = make(<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />);
export const ArrowLeftIcon = make(<path d="M19 12H5M12 19l-7-7 7-7" />);
export const UndoIcon = make(<path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />);
export const RedoIcon = make(<path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />);
export const SunIcon = make(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>,
);
export const MoonIcon = make(<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />);
export const DownloadIcon = make(<path d="M12 3v12M7 10l5 5 5-5M5 21h14" />);
export const UploadIcon = make(<path d="M12 21V9M7 14l5-5 5 5M5 3h14" />);
export const SparklesIcon = make(
  <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8ZM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9ZM5 2l.6 1.4L7 4l-1.4.6L5 6l-.6-1.4L3 4l1.4-.6Z" />,
);
export const LayoutIcon = make(
  <>
    <rect x="9" y="9" width="6" height="6" rx="1" />
    <rect x="2" y="3" width="5" height="4" rx="1" />
    <rect x="2" y="17" width="5" height="4" rx="1" />
    <rect x="17" y="3" width="5" height="4" rx="1" />
    <rect x="17" y="17" width="5" height="4" rx="1" />
    <path d="M7 5h2v4M7 19h2v-4M17 5h-2v4M17 19h-2v-4" />
  </>,
);
export const XIcon = make(<path d="M18 6 6 18M6 6l12 12" />);
export const CheckIcon = make(<path d="M20 6 9 17l-5-5" />);
export const ImageIcon = make(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-5-5L5 21" />
  </>,
);
export const FileJsonIcon = make(
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6M10 13a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1M14 19a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1" />
  </>,
);
export const PanelRightIcon = make(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M15 3v18" />
  </>,
);
export const BrainIcon = make(
  <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18ZM12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18ZM12 5v13" />,
);
export const KeyboardIcon = make(
  <>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
  </>,
);

export const PaletteIcon = make(
  <>
    <path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4.5 4H16a2 2 0 0 0-1.5 3.3A1.6 1.6 0 0 1 13.3 22Z" />
    <circle cx="7.5" cy="11.5" r="1" fill="currentColor" />
    <circle cx="10.5" cy="7" r="1" fill="currentColor" />
    <circle cx="15.5" cy="7.5" r="1" fill="currentColor" />
  </>,
);
export const MoreIcon = make(
  <>
    <circle cx="5" cy="12" r="1.3" fill="currentColor" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    <circle cx="19" cy="12" r="1.3" fill="currentColor" />
  </>,
);
export const FitIcon = make(
  <>
    <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
    <circle cx="12" cy="12" r="2.5" />
  </>,
);
export const MinusIcon = make(<path d="M5 12h14" />);
export const SiblingIcon = make(
  <>
    <rect x="3" y="4" width="10" height="6" rx="2" />
    <rect x="3" y="14" width="10" height="6" rx="2" />
    <path d="M18 14v6M15 17h6" />
  </>,
);
export const RefreshIcon = make(<path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />);
export const SearchIcon = make(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);
export const WifiOffIcon = make(
  <path d="M2 8.8a15 15 0 0 1 4.2-2.6M10.7 5.1A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 5.2-2.7M16.8 11.5a10 10 0 0 1 2.2 1.4M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M2 2l20 20" />,
);
export const AlertIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4M12 16h.01" />
  </>,
);

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
