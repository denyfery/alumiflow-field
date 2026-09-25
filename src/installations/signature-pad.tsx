import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import type { SignatureStroke } from '@/types/api';

type Props = {
  value: SignatureStroke[];
  onChange: (strokes: SignatureStroke[]) => void;
  disabled?: boolean;
  clearLabel: string;
  hint: string;
};

const MIN_POINT_DISTANCE = 0.006;
const MAX_POINTS = 1800;
const MAX_STROKES = 20;

export function SignaturePad({ value, onChange, disabled = false, clearLabel, hint }: Props) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const strokesRef = useRef<SignatureStroke[]>(value);

  useEffect(() => { strokesRef.current = value; }, [value]);

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: (event) => {
      if (disabled || strokesRef.current.length >= MAX_STROKES) return;
      const point = normalizePoint(event.nativeEvent.locationX, event.nativeEvent.locationY, size.width, size.height);
      const next = [...strokesRef.current, [point]];
      strokesRef.current = next;
      onChange(next);
    },
    onPanResponderMove: (event) => {
      if (disabled) return;
      const current = strokesRef.current;
      if (current.length === 0 || totalPoints(current) >= MAX_POINTS) return;
      const point = normalizePoint(event.nativeEvent.locationX, event.nativeEvent.locationY, size.width, size.height);
      const lastStroke = current[current.length - 1];
      const lastPoint = lastStroke?.[lastStroke.length - 1];
      if (lastPoint && Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < MIN_POINT_DISTANCE) return;
      const nextStroke = [...(lastStroke ?? []), point];
      const next = [...current.slice(0, -1), nextStroke];
      strokesRef.current = next;
      onChange(next);
    },
  }), [disabled, onChange, size.height, size.width]);

  return (
    <View style={styles.wrapper}>
      <View
        {...responder.panHandlers}
        onLayout={(event) => setSize({ width: Math.max(1, event.nativeEvent.layout.width), height: Math.max(1, event.nativeEvent.layout.height) })}
        style={[styles.pad, disabled && styles.disabled]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 1000 320" preserveAspectRatio="none">
          {value.map((stroke, index) => (
            <Polyline
              key={`${index}-${stroke.length}`}
              points={stroke.map((point) => `${point.x * 1000},${point.y * 320}`).join(' ')}
              fill="none"
              stroke="#0f172a"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
        {value.length === 0 ? <View pointerEvents="none" style={styles.hintWrap}><Text style={styles.hint}>{hint}</Text></View> : null}
      </View>
      <Pressable disabled={disabled || value.length === 0} onPress={() => onChange([])} style={styles.clearButton}>
        <Text style={[styles.clearText, (disabled || value.length === 0) && styles.clearDisabled]}>{clearLabel}</Text>
      </Pressable>
    </View>
  );
}

function normalizePoint(x: number, y: number, width: number, height: number) {
  return {
    x: Math.max(0, Math.min(1, Number((x / width).toFixed(4)))),
    y: Math.max(0, Math.min(1, Number((y / height).toFixed(4)))),
  };
}

function totalPoints(strokes: SignatureStroke[]) {
  return strokes.reduce((sum, stroke) => sum + stroke.length, 0);
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  pad: { height: 190, borderWidth: 1, borderColor: '#94a3b8', borderStyle: 'dashed', borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden' },
  disabled: { opacity: 0.55 },
  hintWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hint: { color: '#94a3b8', textAlign: 'center', fontSize: 12 },
  clearButton: { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 2 },
  clearText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },
  clearDisabled: { opacity: 0.35 },
});
