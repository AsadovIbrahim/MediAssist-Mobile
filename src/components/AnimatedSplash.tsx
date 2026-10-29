import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

const logoClean = require('../assets/logo_no_pulse.png');
const logoFull = require('../assets/logo.png');

const LETTERS = [
  { char: 'M', accent: false },
  { char: 'e', accent: false },
  { char: 'd', accent: false },
  { char: 'i', accent: false },
  { char: 'A', accent: true },
  { char: 's', accent: true },
  { char: 's', accent: true },
  { char: 'i', accent: true },
  { char: 's', accent: true },
  { char: 't', accent: true },
];

/**
 * 100% Native-Driver animated logo:
 * - Sweeps the glowing ECG pulse across the heart using counter-translateX clipping (60fps UI thread)
 * - Performs a realistic lub-dub heartbeat scale & expanding ripple rings in parallel
 */
export function AnimatedPulseLogo({
  size = 92,
  showRipples = true,
  active = true,
}: {
  size?: number;
  showRipples?: boolean;
  active?: boolean;
}) {
  const pulseProgress = useRef(new Animated.Value(0)).current;
  const heartBeat = useRef(new Animated.Value(1)).current;
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      return;
    }

    // 1. ECG line sweep across the heart (100% useNativeDriver: true)
    const ecgLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseProgress, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(320),
        Animated.timing(pulseProgress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    // 2. Realistic lub-dub heartbeat scale when the ECG wave hits the center R-peak
    const beatLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(260),
        Animated.timing(heartBeat, {
          toValue: 1.08,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heartBeat, {
          toValue: 0.98,
          duration: 110,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heartBeat, {
          toValue: 1.05,
          duration: 130,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heartBeat, {
          toValue: 1,
          duration: 340,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(240),
      ]),
    );

    // 3. Expanding ripple rings
    const ripple1Loop = Animated.loop(
      Animated.sequence([
        Animated.delay(280),
        Animated.timing(ripple1, {
          toValue: 1,
          duration: 860,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(ripple1, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(80),
      ]),
    );

    const ripple2Loop = Animated.loop(
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(ripple2, {
          toValue: 1,
          duration: 770,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(ripple2, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    ecgLoop.start();
    beatLoop.start();
    if (showRipples) {
      ripple1Loop.start();
      ripple2Loop.start();
    }

    return () => {
      ecgLoop.stop();
      beatLoop.stop();
      ripple1Loop.stop();
      ripple2Loop.stop();
    };
  }, [active, heartBeat, pulseProgress, ripple1, ripple2, showRipples]);

  const sweepDist = size * 0.78;
  const wrapperTranslateX = pulseProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-sweepDist, 0],
  });
  const childTranslateX = pulseProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [sweepDist, 0],
  });

  const borderRadius = Math.round(size * 0.22);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {showRipples ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.rippleRing,
              {
                width: size,
                height: size,
                borderRadius,
                opacity: ripple1.interpolate({
                  inputRange: [0, 0.2, 1],
                  outputRange: [0, 0.36, 0],
                }),
                transform: [
                  {
                    scale: ripple1.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.45],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.rippleRing,
              {
                width: size,
                height: size,
                borderRadius,
                borderColor: '#38BDF8',
                opacity: ripple2.interpolate({
                  inputRange: [0, 0.2, 1],
                  outputRange: [0, 0.26, 0],
                }),
                transform: [
                  {
                    scale: ripple2.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.28],
                    }),
                  },
                ],
              },
            ]}
          />
        </>
      ) : null}

      <Animated.View
        collapsable={false}
        style={{
          width: size,
          height: size,
          borderRadius,
          overflow: 'hidden',
          transform: [{ scale: heartBeat }],
        }}>
        {/* Base Layer: Shield + Clean Heart without ECG line */}
        <Image
          source={logoClean}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />

        {/* Native-driver progressive left-to-right reveal of the glowing ECG line */}
        <Animated.View
          collapsable={false}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: size,
            height: size,
            overflow: 'hidden',
            transform: [{ translateX: wrapperTranslateX }],
          }}>
          <Animated.Image
            source={logoFull}
            style={{
              width: size,
              height: size,
              transform: [{ translateX: childTranslateX }],
            }}
            resizeMode="contain"
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/**
 * Full-screen Netflix-style letter-by-letter reveal + parallel live ECG pulse splash screen.
 * Waits until `ready` is true and the background screen has finished mounting BEFORE starting
 * the animation, so there is zero frame drop or freeze mid-animation.
 */
export function AnimatedSplash({
  ready,
  onFinish,
}: {
  ready: boolean;
  onFinish: () => void;
}) {
  const [animStarted, setAnimStarted] = React.useState(false);

  // Per-letter animations (Netflix style: opacity + scale + translateY, all useNativeDriver: true)
  const letterAnims = useRef(
    LETTERS.map(() => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(1.55),
      translateY: new Animated.Value(14),
    })),
  ).current;

  // Bottom ECG wave cover slide (slides from 0 to 220 using translateX on native UI thread)
  const bottomWaveCoverX = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(8)).current;

  // Final screen exit animation
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const containerScale = useRef(new Animated.Value(1)).current;

  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const startedRef = useRef(false);

  useEffect(() => {
    if (!ready || startedRef.current) {
      return;
    }
    startedRef.current = true;

    // Wait 180ms after `ready` becomes true so NavigationContainer & initial screen
    // finish mounting on the native UI thread BEFORE the animation begins!
    const startTimer = setTimeout(() => {
      setAnimStarted(true);

      // 1. Netflix-style staggered letter-by-letter animation ("MediAssist")
      const letterSequences = letterAnims.map((anim, index) =>
        Animated.sequence([
          Animated.delay(index * 80),
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: 1,
              duration: 240,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.spring(anim.scale, {
              toValue: 1,
              friction: 6,
              tension: 95,
              useNativeDriver: true,
            }),
            Animated.timing(anim.translateY, {
              toValue: 0,
              duration: 240,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
      );

      // 2. Parallel lower ECG line sweep & subtitle reveal
      const waveAndSubtitle = Animated.sequence([
        Animated.delay(80),
        Animated.parallel([
          Animated.timing(bottomWaveCoverX, {
            toValue: 220,
            duration: 980,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(520),
            Animated.parallel([
              Animated.timing(subtitleOpacity, {
                toValue: 1,
                duration: 360,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.timing(subtitleTranslateY, {
                toValue: 0,
                duration: 360,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
            ]),
          ]),
        ]),
      ]);

      // Run letter reveal + wave, then pause briefly and smoothly fade out
      Animated.sequence([
        Animated.parallel([...letterSequences, waveAndSubtitle]),
        Animated.delay(650),
        Animated.parallel([
          Animated.timing(containerOpacity, {
            toValue: 0,
            duration: 320,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(containerScale, {
            toValue: 1.05,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        onFinishRef.current();
      });
    }, 180);

    return () => clearTimeout(startTimer);
  }, [
    bottomWaveCoverX,
    containerOpacity,
    containerScale,
    letterAnims,
    ready,
    subtitleOpacity,
    subtitleTranslateY,
  ]);

  return (
    <Animated.View
      style={[
        styles.splashContainer,
        {
          opacity: containerOpacity,
          transform: [{ scale: containerScale }],
        },
      ]}>
      {/* Centered Pulsing Logo with Live ECG Heartbeat */}
      <View style={{ marginBottom: 24 }}>
        <AnimatedPulseLogo size={110} showRipples active={animStarted} />
      </View>

      {/* Netflix-style Letter-by-Letter "MediAssist" Reveal */}
      <View style={styles.wordRow}>
        {LETTERS.map((item, idx) => (
          <Animated.Text
            key={idx}
            style={[
              styles.letter,
              {
                color: item.accent ? '#1E6FD9' : '#0F172A',
                opacity: letterAnims[idx].opacity,
                transform: [
                  { scale: letterAnims[idx].scale },
                  { translateY: letterAnims[idx].translateY },
                ],
              },
            ]}>
            {item.char}
          </Animated.Text>
        ))}
      </View>

      {/* Parallel Sweeping Cardiogram Line under MediAssist */}
      <View collapsable={false} style={styles.waveWrapper}>
        <Svg width={220} height={28} viewBox="0 0 220 28">
          <Defs>
            <LinearGradient id="ecgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#1E6FD9" stopOpacity="0" />
              <Stop offset="25%" stopColor="#1E6FD9" stopOpacity="0.85" />
              <Stop offset="50%" stopColor="#00C6FF" stopOpacity="1" />
              <Stop offset="75%" stopColor="#1E6FD9" stopOpacity="0.85" />
              <Stop offset="100%" stopColor="#1E6FD9" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Path
            d="M 4 15 L 74 15 L 84 9 L 93 20 L 104 3 L 114 25 L 124 8 L 132 15 L 216 15"
            stroke="url(#ecgGrad)"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.waveCover,
            {
              transform: [{ translateX: bottomWaveCoverX }],
            },
          ]}
        />
      </View>

      {/* Subtitle */}
      <Animated.Text
        style={[
          styles.subtitle,
          {
            opacity: subtitleOpacity,
            transform: [{ translateY: subtitleTranslateY }],
          },
        ]}>
        RƏQƏMSAL TİBBİ ASSİSTENT
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  rippleRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#1E6FD9',
    backgroundColor: 'rgba(30, 111, 217, 0.06)',
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: 'RedditSans',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  waveWrapper: {
    width: 220,
    height: 28,
    marginTop: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 220,
    height: 28,
    backgroundColor: '#FFFFFF',
  },
  subtitle: {
    fontFamily: 'RedditSans',
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 2.4,
    marginTop: 6,
  },
});
