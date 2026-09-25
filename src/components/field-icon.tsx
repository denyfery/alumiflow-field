import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

export type FieldIconName =
  | 'arrow-right'
  | 'bell'
  | 'briefcase'
  | 'calendar'
  | 'camera'
  | 'check'
  | 'chevron-right'
  | 'clipboard'
  | 'cloud'
  | 'copy'
  | 'database'
  | 'edit'
  | 'eye'
  | 'globe'
  | 'info'
  | 'lock'
  | 'logout'
  | 'mail'
  | 'map-pin'
  | 'message'
  | 'phone'
  | 'settings'
  | 'shield'
  | 'sync'
  | 'trash'
  | 'user';

export function FieldIcon({ name, size = 20, color = '#64748B', strokeWidth = 1.9 }: {
  name: FieldIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const common = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'settings' ? <>
        <Circle cx="12" cy="12" r="3" {...common} />
        <Path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.08V21h-4v-.08A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.08-.4H3v-4h.08A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6A1.7 1.7 0 0 0 10.4 2.92V3h4v-.08A1.7 1.7 0 0 0 15.4 4a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.25.31.46.66.6 1 .13.32.2.67.2 1.02V13c0 .35-.07.7-.2 1.02-.14.34-.35.69-.6.98Z" {...common} />
      </> : null}

      {name === 'clipboard' ? <>
        <Rect x="6" y="5" width="12" height="16" rx="2" {...common} />
        <Rect x="9" y="2.5" width="6" height="4" rx="1.5" {...common} />
        <Line x1="9" y1="11" x2="15" y2="11" {...common} /><Line x1="9" y1="15" x2="15" y2="15" {...common} />
      </> : null}

      {name === 'briefcase' ? <>
        <Rect x="3" y="7" width="18" height="13" rx="2.5" {...common} />
        <Path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...common} />
        <Path d="M3 12h7v2h4v-2h7" {...common} />
      </> : null}

      {name === 'chevron-right' ? <Polyline points="9 5 16 12 9 19" {...common} /> : null}
      {name === 'arrow-right' ? <><Line x1="4" y1="12" x2="20" y2="12" {...common} /><Polyline points="14 6 20 12 14 18" {...common} /></> : null}
      {name === 'calendar' ? <><Rect x="3" y="5" width="18" height="16" rx="2.5" {...common} /><Line x1="7" y1="3" x2="7" y2="7" {...common} /><Line x1="17" y1="3" x2="17" y2="7" {...common} /><Line x1="3" y1="10" x2="21" y2="10" {...common} /></> : null}
      {name === 'map-pin' ? <><Path d="M20 10c0 5.5-8 11-8 11S4 15.5 4 10a8 8 0 1 1 16 0Z" {...common} /><Circle cx="12" cy="10" r="2.4" {...common} /></> : null}
      {name === 'phone' ? <Path d="M7.2 3.5 10 7.3 8.3 9.2c1.2 2.5 3.1 4.4 5.6 5.6l1.9-1.7 3.8 2.8-.7 3.2c-.2.8-.9 1.4-1.8 1.4C9.6 20.5 3.5 14.4 3.5 6.9c0-.9.6-1.6 1.4-1.8l2.3-.6Z" {...common} /> : null}
      {name === 'message' ? <Path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-5.5 4v-4.7A2.5 2.5 0 0 1 4 13.8v-8.3Z" {...common} /> : null}
      {name === 'mail' ? <><Rect x="3" y="5" width="18" height="14" rx="2.5" {...common} /><Polyline points="4 7 12 13 20 7" {...common} /></> : null}
      {name === 'lock' ? <><Rect x="5" y="10" width="14" height="11" rx="2.5" {...common} /><Path d="M8 10V7a4 4 0 0 1 8 0v3" {...common} /><Line x1="12" y1="14" x2="12" y2="17" {...common} /></> : null}
      {name === 'eye' ? <><Path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" {...common} /><Circle cx="12" cy="12" r="2.5" {...common} /></> : null}
      {name === 'shield' ? <><Path d="M12 3 19 6v5c0 4.7-2.8 8-7 10-4.2-2-7-5.3-7-10V6l7-3Z" {...common} /><Polyline points="8.7 12.2 11 14.5 15.6 9.8" {...common} /></> : null}
      {name === 'cloud' ? <Path d="M6.5 18H18a4 4 0 0 0 .6-7.95A6.5 6.5 0 0 0 6.3 8.3 4.9 4.9 0 0 0 6.5 18Z" {...common} /> : null}
      {name === 'database' ? <><Path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z" {...common} /><Path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" {...common} /><Path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" {...common} /></> : null}
      {name === 'camera' ? <><Path d="M4 8h3l1.5-2h7L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" {...common} /><Circle cx="12" cy="14" r="3.5" {...common} /></> : null}
      {name === 'edit' ? <><Path d="m4 20 4.2-1 10-10-3.2-3.2-10 10L4 20Z" {...common} /><Path d="m13.5 7.3 3.2 3.2" {...common} /></> : null}
      {name === 'trash' ? <><Polyline points="4 7 20 7" {...common} /><Path d="M9 3h6l1 4H8l1-4ZM6 7l1 14h10l1-14" {...common} /><Line x1="10" y1="11" x2="10.5" y2="17" {...common} /><Line x1="14" y1="11" x2="13.5" y2="17" {...common} /></> : null}
      {name === 'globe' ? <><Circle cx="12" cy="12" r="9" {...common} /><Path d="M3 12h18M12 3c2.2 2.4 3.3 5.4 3.3 9S14.2 18.6 12 21c-2.2-2.4-3.3-5.4-3.3-9S9.8 5.4 12 3Z" {...common} /></> : null}
      {name === 'bell' ? <><Path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 6.5 2.5 6.5h-17S6 15 6 9Z" {...common} /><Path d="M10 19a2.2 2.2 0 0 0 4 0" {...common} /></> : null}
      {name === 'info' ? <><Circle cx="12" cy="12" r="9" {...common} /><Line x1="12" y1="11" x2="12" y2="16" {...common} /><Circle cx="12" cy="7.5" r=".5" fill={color} /></> : null}
      {name === 'logout' ? <><Path d="M10 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5" {...common} /><Line x1="10" y1="12" x2="21" y2="12" {...common} /><Polyline points="17 8 21 12 17 16" {...common} /></> : null}
      {name === 'sync' ? <><Path d="M20 7v5h-5" {...common} /><Path d="M4 17v-5h5" {...common} /><Path d="M6.1 8.4A7 7 0 0 1 18.8 7M5.2 17A7 7 0 0 0 17.9 15.6" {...common} /></> : null}
      {name === 'user' ? <><Circle cx="12" cy="8" r="4" {...common} /><Path d="M4.5 21a7.5 7.5 0 0 1 15 0" {...common} /></> : null}
      {name === 'copy' ? <><Rect x="8" y="8" width="11" height="11" rx="2" {...common} /><Path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" {...common} /></> : null}
      {name === 'check' ? <Polyline points="5 12.5 9.5 17 19 7.5" {...common} /> : null}
    </Svg>
  );
}
