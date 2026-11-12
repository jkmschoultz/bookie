import { useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { canInstall, onInstallChange, promptInstall } from '@/library/installPrompt';

const ICON = '#e8e2d8';

const icon = StyleSheet.create({
  share: { width: 20, height: 22, alignItems: 'center' },
  shareBox: { position: 'absolute', bottom: 0, width: 16, height: 13, borderWidth: 2, borderTopWidth: 0, borderColor: ICON, borderRadius: 3 },
  shareStem: { position: 'absolute', top: 1, width: 2, height: 14, backgroundColor: ICON },
  shareHead: {
    position: 'absolute',
    top: 1,
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: ICON,
    transform: [{ rotate: '45deg' }],
  },
  plusSquare: { width: 18, height: 18, borderWidth: 1.5, borderColor: ICON, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  plus: { color: ICON, fontSize: 14, lineHeight: 16, fontWeight: '600' },
  dots: { gap: 3, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: ICON },
});

const styles = StyleSheet.create({
  guides: { gap: 10, marginTop: 4 },
  install: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  installText: { color: Colors.accentText, fontSize: 16, fontWeight: '700' },
  card: { padding: 14, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  name: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  number: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  numberText: { color: Colors.accentText, fontSize: 12, fontWeight: '700' },
  text: { flex: 1, color: Colors.textMuted, fontSize: 14, lineHeight: 20 },
  shotSlot: { width: 118, alignItems: 'center' },
  shot: { minWidth: 44, minHeight: 36, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#2c2c30', alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: 2, borderColor: Colors.accent },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuText: { color: ICON, fontSize: 11, fontWeight: '500', flexShrink: 1 },
  link: { color: '#4da3ff', fontSize: 15, fontWeight: '600' },
});

/** Safari's Share button: a box with an arrow leaving the top of it. */
function ShareIcon() {
  return (
    <View style={icon.share}>
      <View style={icon.shareBox} />
      <View style={icon.shareStem} />
      <View style={icon.shareHead} />
    </View>
  );
}

function PlusSquare() {
  return (
    <View style={icon.plusSquare}>
      <Text style={icon.plus}>+</Text>
    </View>
  );
}

/** Chrome's ⋮ menu button. */
function Dots() {
  return (
    <View style={icon.dots}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={icon.dot} />
      ))}
    </View>
  );
}

/** A stand-in for the bit of browser screen you need to tap, with the thing to tap ringed. */
function Shot({ children, ring }: { children: ReactNode; ring?: boolean }) {
  return <View style={[styles.shot, ring && styles.ring]}>{children}</View>;
}

const Row = ({ label, left }: { label: string; left: ReactNode }) => (
  <View style={styles.menuRow}>
    <Text style={styles.menuText}>{label}</Text>
    {left}
  </View>
);

interface GuideStep {
  text: string;
  shot: ReactNode;
}

const GUIDES: { name: string; steps: GuideStep[] }[] = [
  {
    name: 'iPhone or iPad (Safari)',
    steps: [
      {
        text: 'Tap the Share button, the square with an arrow pointing up.',
        shot: (
          <Shot ring>
            <ShareIcon />
          </Shot>
        ),
      },
      {
        text: 'Scroll down and tap “Add to Home Screen”.',
        shot: (
          <Shot ring>
            <Row label="Add to Home Screen" left={<PlusSquare />} />
          </Shot>
        ),
      },
      {
        text: 'Tap “Add”. Bookie now opens like an app.',
        shot: (
          <Shot ring>
            <Text style={styles.link}>Add</Text>
          </Shot>
        ),
      },
    ],
  },
  {
    name: 'Android (Chrome)',
    steps: [
      {
        text: 'Tap the ⋮ menu at the top right.',
        shot: (
          <Shot ring>
            <Dots />
          </Shot>
        ),
      },
      {
        text: 'Tap “Install app” or “Add to Home screen”.',
        shot: (
          <Shot ring>
            <Row label="Install app" left={<PlusSquare />} />
          </Shot>
        ),
      },
      {
        text: 'Tap “Install”. Bookie now opens like an app.',
        shot: (
          <Shot ring>
            <Text style={styles.link}>Install</Text>
          </Shot>
        ),
      },
    ],
  },
];

/** Install button (where the browser allows it) and a how-to with pictures for putting the web app on a phone's home screen. Web only. */
export function HomeScreenGuide() {
  // Chrome can do it for you with one tap. Where it can't (Safari), only the steps below are shown.
  const installable = useSyncExternalStore(onInstallChange, canInstall);

  return (
    <View style={styles.guides}>
      {installable && (
        <Pressable style={styles.install} onPress={promptInstall} accessibilityRole="button">
          <Text style={styles.installText}>Add Bookie to my home screen</Text>
        </Pressable>
      )}
      {GUIDES.map((g) => (
        <View key={g.name} style={styles.card}>
          <Text style={styles.name}>{g.name}</Text>
          {g.steps.map((s, i) => (
            <View key={s.text} style={styles.row}>
              <View style={styles.number}>
                <Text style={styles.numberText}>{i + 1}</Text>
              </View>
              <Text style={styles.text}>{s.text}</Text>
              <View style={styles.shotSlot}>{s.shot}</View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
