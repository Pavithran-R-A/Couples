import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { spacing, radii } from '../theme/tokens';
import { FONT_HEAD, FONT_BODY, FONT_MEDIUM } from '../theme/fonts';
import { FlowerSprig, KeepsakeStamp } from './Illustrations';
import { EngravedDivider } from './Ornaments';
import type { Theme } from '../theme/tokens';
import type { AdventureKind } from '../domain/types';

/* ============================================================
   Weekly Adventure — one distinct stage per kind.
   gratitude_exchange → two envelopes side by side
   tiny_date          → twilight picnic vignette
   playful_question   → two speech bubbles, one for each answer
   doodle_prompt      → real finger-drawing canvas (no fake text input)
   ============================================================ */

export interface AdventureStageProps {
  kind: AdventureKind;
  mineDone: boolean;
  mineEntry: string | null;
  partnerDone: boolean;
  partnerEntry: string | null;
  partnerName: string;
  myLabel: string;
  entry: string;
  onEntryChange: (t: string) => void;
  onSubmit: (entry?: string) => void;
  busy: boolean;
  canSubmit: boolean;
  theme: Theme;
  reducedMotion: boolean;
}

/* ---------- shared entry controls ---------- */

function EntryBox({
  theme, entry, onEntryChange, busy, canSubmit, onSubmit, placeholder, minHeight = 88,
}: {
  theme: Theme;
  entry: string;
  onEntryChange: (t: string) => void;
  busy: boolean;
  canSubmit: boolean;
  onSubmit: (entry?: string) => void;
  placeholder: string;
  minHeight?: number;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <TextInput
        value={entry}
        onChangeText={onEntryChange}
        placeholder={placeholder}
        placeholderTextColor={theme.inkFaint}
        multiline
        maxLength={500}
        style={[styles.textEntry, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.ink, minHeight }]}
      />
      <View style={styles.submitRow}>
        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit || busy}
          onPress={() => onSubmit()}
          style={({ pressed }) => [
            styles.submitBtn,
            { backgroundColor: canSubmit && !busy ? theme.gold : theme.goldSoft, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.submitText, { color: canSubmit && !busy ? '#151D32' : theme.inkSoft }]}>
            {busy ? 'Sealing…' : 'Mark it done'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function DoneChip({ theme, label, entry }: { theme: Theme; label: string; entry: string | null }) {
  return (
    <View style={[styles.doneChip, { borderColor: theme.goldSoft ?? theme.line, backgroundColor: theme.surface }]}>
      <KeepsakeStamp size={22} glyph="seed" tone={theme.gold} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.doneLabel, { color: theme.gold }]}>{label}</Text>
        {entry ? <Text style={[styles.doneEntry, { color: theme.ink }]}>{entry}</Text> : null}
      </View>
    </View>
  );
}

/* ---------- gratitude_exchange: two envelopes ---------- */

function GratitudeStage(p: AdventureStageProps) {
  const { theme } = p;
  return (
    <View style={styles.stage}>
      <View style={styles.envRow}>
        <View style={[styles.miniEnvelope, { borderColor: theme.gold }]}>
          <Text style={[styles.envLabel, { color: theme.inkFaint }]}>From you</Text>
          <FlowerSprig size={26} color={theme.gold} />
        </View>
        <View style={styles.envGap}>
          <EngravedDivider width={54} color={theme.gold} />
        </View>
        <View style={[styles.miniEnvelope, { borderColor: theme.line }]}>
          <Text style={[styles.envLabel, { color: theme.inkFaint }]}>{p.partnerName}</Text>
          <FlowerSprig size={26} color={theme.inkFaint} flip />
        </View>
      </View>
      {p.mineDone ? (
        <DoneChip theme={theme} label="Your thank-you, sealed" entry={p.mineEntry} />
      ) : (
        <EntryBox
          theme={theme} entry={p.entry} onEntryChange={p.onEntryChange}
          busy={p.busy} canSubmit={p.canSubmit} onSubmit={p.onSubmit}
          placeholder="Two genuine thank-yous — nothing too small…"
        />
      )}
      {p.partnerDone && !p.mineDone ? (
        <Text style={[styles.partnerWaiting, { color: theme.inkSoft }]}>
          {p.partnerName} has sealed a thank-you. Yours opens the exchange.
        </Text>
      ) : null}
      {p.partnerDone && p.mineDone ? null : null}
    </View>
  );
}

/* ---------- tiny_date: twilight picnic vignette ---------- */

function TinyDateStage(p: AdventureStageProps) {
  const { theme } = p;
  return (
    <View style={styles.stage}>
      <Svg width="100%" height={92} viewBox="0 0 300 92">
        <Circle cx={252} cy={26} r={16} fill={theme.gold} opacity={0.85} />
        <Circle cx={252} cy={26} r={24} fill="none" stroke={theme.gold} strokeWidth={1} opacity={0.3} />
        <Circle cx={40} cy={20} r={1.6} fill={theme.gold} opacity={0.7} />
        <Circle cx={66} cy={34} r={1.2} fill={theme.gold} opacity={0.5} />
        <Circle cx={92} cy={14} r={1.4} fill={theme.gold} opacity={0.6} />
        <Path d="M 60 74 Q 78 60 96 74 Z" fill={theme.accentSoft ?? '#3A2B3D'} />
        <Path d="M 96 74 Q 114 60 132 74 Z" fill={theme.accentSoft ?? '#3A2B3D'} />
        <Rect x={128} y={52} width={44} height={22} rx={3} fill={theme.coral} opacity={0.85} />
        <Rect x={170} y={58} width={30} height={16} rx={3} fill={theme.mint} opacity={0.8} />
        <Circle cx={60} cy={80} r={4.5} fill={theme.gold} opacity={0.9} />
        <Circle cx={140} cy={82} r={4.5} fill={theme.gold} opacity={0.9} />
        <Path d="M 20 84 Q 150 76 280 84" stroke={theme.line} strokeWidth={1.2} fill="none" />
      </Svg>
      {p.mineDone ? (
        <DoneChip theme={theme} label="Your part, kept" entry={p.mineEntry} />
      ) : (
        <EntryBox
          theme={theme} entry={p.entry} onEntryChange={p.onEntryChange}
          busy={p.busy} canSubmit={p.canSubmit} onSubmit={p.onSubmit}
          placeholder="When and where — leave a note for the date…"
        />
      )}
      {p.partnerDone && !p.mineDone ? (
        <Text style={[styles.partnerWaiting, { color: theme.inkSoft }]}>
          {p.partnerName} is in. The date is half-planned.
        </Text>
      ) : null}
    </View>
  );
}

/* ---------- playful_question: two speech bubbles ---------- */

function PlayfulQuestionStage(p: AdventureStageProps) {
  const { theme } = p;
  return (
    <View style={styles.stage}>
      <View style={styles.bubbleRow}>
        <View style={[styles.bubble, { borderColor: theme.gold, backgroundColor: theme.surface }]}>
          <Text style={[styles.bubbleLabel, { color: theme.gold }]}>{p.myLabel}</Text>
          <Text style={[styles.bubbleHint, { color: theme.inkFaint }]}>your answer goes here</Text>
        </View>
        <View style={[styles.bubble, { borderColor: theme.line, backgroundColor: theme.surfaceSoft }]}>
          <Text style={[styles.bubbleLabel, { color: theme.inkSoft }]}>{p.partnerName}</Text>
          <Text style={[styles.bubbleHint, { color: theme.inkFaint }]}>sealed until both answer</Text>
        </View>
      </View>
      {p.mineDone ? (
        <DoneChip theme={theme} label="Your answer, sealed" entry={p.mineEntry} />
      ) : (
        <EntryBox
          theme={theme} entry={p.entry} onEntryChange={p.onEntryChange}
          busy={p.busy} canSubmit={p.canSubmit} onSubmit={p.onSubmit}
          placeholder="Answer honestly — the sillier the better…"
        />
      )}
      {p.partnerDone && !p.mineDone ? (
        <Text style={[styles.partnerWaiting, { color: theme.inkSoft }]}>
          {p.partnerName} has answered. One more voice and both answers appear.
        </Text>
      ) : null}
    </View>
  );
}

/* ---------- doodle_prompt: real drawing canvas ---------- */

interface Stroke {
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

function pathFrom(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const pt = points[0];
    return `M ${pt.x} ${pt.y} L ${pt.x + 0.01} ${pt.y + 0.01}`;
  }
  // Smooth with quadratic curves through midpoints — pencil-soft lines.
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y} ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

const INK_COLORS = ['#151D32', '#533755', '#E67883', '#F5C779', '#5E9B85', '#FFF8F1'];

function DoodleStage(p: AdventureStageProps) {
  const { theme } = p;
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [ink, setInk] = useState(INK_COLORS[0]);
  const canvasRef = useRef<View>(null);
  const { width: winW } = useWindowDimensions();

  const canvasWidth = Math.min(winW - 64, 320);
  const canvasHeight = Math.round(canvasWidth * 0.72);

  const toLocal = (evt: { nativeEvent: { locationX: number; locationY: number } }) => ({
    x: Math.max(0, Math.min(evt.nativeEvent.locationX, canvasWidth)),
    y: Math.max(0, Math.min(evt.nativeEvent.locationY, canvasHeight)),
  });

  const onStart = (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
    setDrawing(true);
    setCurrent({ color: ink, width: 2.4, points: [toLocal(evt)] });
  };
  const onMove = (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (!drawing || !current) return;
    const pt = toLocal(evt);
    setCurrent((c) => (c ? { ...c, points: [...c.points, pt] } : c));
  };
  const onEnd = useCallback(() => {
    setDrawing(false);
    setCurrent((c) => {
      if (c && c.points.length > 0) setStrokes((s) => [...s, c]);
      return null;
    });
  }, []);

  const undo = () => setStrokes((s) => s.slice(0, -1));
  const clear = () => setStrokes([]);

  // Doodles are stored as a compact serialized vector summary — the entry
  // stays a string (same DB contract), it simply carries the drawing.
  const serializeDoodle = (): string => {
    if (strokes.length === 0) return '';
    const parts = strokes.map((s) => `${s.color.slice(1)}:${s.width}:${s.points.length}`);
    return `[doodle v1; ${strokes.length} strokes] ${parts.join(' ')}`;
  };

  // The parent's entry state has not re-rendered yet at submit time, so the
  // serialized doodle must travel with the submit call, not through
  // onEntryChange state.
  const submitDoodle = () => {
    p.onSubmit(serializeDoodle());
  };

  return (
    <View style={styles.stage}>
      <View style={[styles.canvas, { backgroundColor: theme.surface, borderColor: theme.line, width: canvasWidth, height: canvasHeight }]}>
        <View
          ref={canvasRef}
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => drawing}
          onResponderGrant={onStart}
          onResponderMove={onMove}
          onResponderRelease={onEnd}
          onResponderTerminate={onEnd}
        >
          {strokes.map((s, i) => (
            <Svg key={i} width={canvasWidth} height={canvasHeight} style={StyleSheet.absoluteFill}>
              <Path d={pathFrom(s.points)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          ))}
          {current ? (
            <Svg width={canvasWidth} height={canvasHeight} style={StyleSheet.absoluteFill}>
              <Path d={pathFrom(current.points)} stroke={current.color} strokeWidth={current.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          ) : null}
        </View>
        {strokes.length === 0 && !current ? (
          <View pointerEvents="none" style={styles.canvasHint}>
            <KeepsakeStamp size={30} glyph="seed" tone={theme.inkFaint} />
            <Text style={[styles.canvasHintText, { color: theme.inkFaint }]}>Draw here with your finger</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.inkRow}>
        {INK_COLORS.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`Ink color ${c}`}
            onPress={() => setInk(c)}
            style={[styles.inkDot, ink === c && styles.inkDotActive, { backgroundColor: c, borderColor: ink === c ? theme.gold : theme.line }]}
          />
        ))}
        <Pressable accessibilityRole="button" onPress={undo} style={[styles.canvasAction, { borderColor: theme.line }]}>
          <Text style={[styles.canvasActionText, { color: theme.inkSoft }]}>Undo</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={clear} style={[styles.canvasAction, { borderColor: theme.line }]}>
          <Text style={[styles.canvasActionText, { color: theme.inkSoft }]}>Clear</Text>
        </Pressable>
      </View>
      {p.mineDone ? (
        <DoneChip theme={theme} label="Your doodle, framed" entry={p.mineEntry} />
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={strokes.length === 0 || p.busy}
          onPress={submitDoodle}
          style={({ pressed }) => [
            styles.submitBtn,
            { alignSelf: 'stretch' },
            { backgroundColor: strokes.length > 0 && !p.busy ? theme.gold : theme.goldSoft, opacity: p.busy ? 0.6 : pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.submitText, { color: strokes.length > 0 && !p.busy ? '#151D32' : theme.inkSoft }]}>
            {p.busy ? 'Sealing…' : 'Seal the doodle'}
          </Text>
        </Pressable>
      )}
      {p.partnerDone && !p.mineDone ? (
        <Text style={[styles.partnerWaiting, { color: theme.inkSoft }]}>
          {p.partnerName} has drawn something. Yours completes the pair.
        </Text>
      ) : null}
    </View>
  );
}

/* ---------- router ---------- */

export function AdventureStage(props: AdventureStageProps) {
  switch (props.kind) {
    case 'gratitude_exchange': return <GratitudeStage {...props} />;
    case 'tiny_date': return <TinyDateStage {...props} />;
    case 'playful_question': return <PlayfulQuestionStage {...props} />;
    case 'doodle_prompt': return <DoodleStage {...props} />;
    default: return <GratitudeStage {...props} />;
  }
}

const styles = StyleSheet.create({
  stage: { gap: spacing.md, marginTop: spacing.xs },
  envRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  miniEnvelope: { borderWidth: 1.4, borderRadius: radii.sm, padding: spacing.md, minWidth: 108, alignItems: 'center', gap: 4 },
  envLabel: { fontFamily: FONT_MEDIUM, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  envGap: { alignItems: 'center' },
  bubbleRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  bubble: { flex: 1, minWidth: 140, borderWidth: 1.4, borderRadius: radii.md, padding: spacing.md, gap: 2 },
  bubbleLabel: { fontFamily: FONT_HEAD, fontSize: 14 },
  bubbleHint: { fontFamily: FONT_BODY, fontSize: 12 },
  textEntry: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.lg,
    fontSize: 15,
    fontFamily: FONT_MEDIUM,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  submitRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  submitBtn: {
    borderRadius: radii.pill,
    paddingVertical: 10,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontFamily: FONT_HEAD, fontSize: 14.5, letterSpacing: 0.4 },
  doneChip: { flexDirection: 'row', gap: spacing.sm, borderWidth: 1, borderRadius: radii.sm, padding: spacing.md, alignItems: 'center' },
  doneLabel: { fontSize: 10.5, letterSpacing: 1.2, fontFamily: FONT_MEDIUM, textTransform: 'uppercase', marginBottom: 2 },
  doneEntry: { fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 21 },
  partnerWaiting: { fontFamily: FONT_BODY, fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
  canvas: { borderRadius: radii.md, borderWidth: 1.4, overflow: 'hidden', alignSelf: 'center' },
  canvasHint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 6 },
  canvasHintText: { fontFamily: FONT_BODY, fontSize: 13 },
  inkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center', flexWrap: 'wrap' },
  inkDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2.4 },
  inkDotActive: { transform: [{ scale: 1.15 }] },
  canvasAction: { borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  canvasActionText: { fontFamily: FONT_MEDIUM, fontSize: 12.5 },
});
