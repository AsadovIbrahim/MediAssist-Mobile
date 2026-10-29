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
 * - Keeps a subtle ECG baseline visible so the heart never looks blank on frame 1
 * - Sweeps the bright glowing ECG pulse across the heart at 60fps on the Native UI thread
 * - Performs a realistic lub-dub heartbeat scale & expanding ripple rings in parallel
 */
export function AnimatedPulseLogo({
  size = 92,
  showRipples = true,
}: {
  size?: number;
  showRipples?: boolean;
}) {
  const pulseProgress = useRef(new Animated.Value(0)).current;
  const heartBeat = useRef(new Animated.Value(1)).current;
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. ECG line sweep across the heart (100% useNativeDriver: true)
    const ecgLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseProgress, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(250),
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
        Animated.delay(220),
        Animated.timing(heartBeat, {
          toValue: 1.08,
          duration: 135,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heartBeat, {
          toValue: 0.98,
          duration: 105,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heartBeat, {
          toValue: 1.05,
          duration: 125,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heartBeat, {
          toValue: 1,
          duration: 315,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(200),
      ]),
    );

    // 3. Expanding ripple rings
    const ripple1Loop = Animated.loop(
      Animated.sequence([
        Animated.delay(240),
        Animated.timing(ripple1, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(ripple1, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(60),
      ]),
    );

    const ripple2Loop = Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(ripple2, {
          toValue: 1,
          duration: 700,
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
  }, [heartBeat, pulseProgress, ripple1, ripple2, showRipples]);

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
        {/* Base Layer: Shield + Heart */}
        <Image
          source={logoClean}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
        {/* Subtle ECG trace so the heart never looks blank before the bright sweep passes */}
        <Image
          source={logoFull}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: size,
            height: size,
            opacity: 0.14,
          }}
          resizeMode="contain"
        />

        {/* Native-driver progressive left-to-right bright sweep of the glowing ECG line */}
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
 * Runs completely standalone BEFORE NavigationContainer mounts, so there is 0ms lag at start or mid-animation.
 */
export function AnimatedSplash({
  ready,
  onFinish,
}: {
  ready: boolean;
  onFinish: () => void;
}) {
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

  const readyRef = useRef(ready);
  readyRef.current = ready;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const animDoneRef = useRef(false);
  const finishedRef = useRef(false);

  const completeIfReady = React.useCallback(() => {
    if (!animDoneRef.current || !readyRef.current || finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    onFinishRef.current();
  }, []);

  useEffect(() => {
    // 1. Netflix-style staggered letter-by-letter animation ("MediAssist") starting immediately at 0ms
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
      Animated.delay(60),
      Animated.parallel([
        Animated.timing(bottomWaveCoverX, {
          toValue: 220,
          duration: 950,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(480),
          Animated.parallel([
            Animated.timing(subtitleOpacity, {
              toValue: 1,
              duration: 340,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(subtitleTranslateY, {
              toValue: 0,
              duration: 340,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
    ]);

    Animated.sequence([
      Animated.parallel([...letterSequences, waveAndSubtitle]),
      Animated.delay(550),
    ]).start(() => {
      animDoneRef.current = true;
      completeIfReady();
    });
  }, [
    bottomWaveCoverX,
    completeIfReady,
    letterAnims,
    subtitleOpacity,
    subtitleTranslateY,
  ]);

  useEffect(() => {
    if (ready) {
      completeIfReady();
    }
  }, [ready, completeIfReady]);

  return (
    <View style={styles.splashContainer}>
      {/* Centered Pulsing Logo with Live ECG Heartbeat */}
      <View style={{ marginBottom: 24 }}>
        <AnimatedPulseLogo size={110} showRipples />
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
    </View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
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
