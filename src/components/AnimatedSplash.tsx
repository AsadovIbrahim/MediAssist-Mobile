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
 * Reusable animated logo where the ECG pulse inside the heart sweeps left-to-right
 * in sync with a realistic lub-dub heartbeat scale & ripple effect.
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
    // Continuous ECG sweep inside the heart + realistic lub-dub heartbeat
    const loop = Animated.loop(
      Animated.parallel([
        // ECG line sweep across the heart (left -> right, hold, reset)
        Animated.sequence([
          Animated.timing(pulseProgress, {
            toValue: 1,
            duration: 1050,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: false,
          }),
          Animated.delay(350),
          Animated.timing(pulseProgress, {
            toValue: 0,
            duration: 0,
            useNativeDriver: false,
          }),
        ]),
        // Lub-dub heartbeat scale animation when the ECG hits the center R-peak
        Animated.sequence([
          Animated.delay(320),
          Animated.timing(heartBeat, {
            toValue: 1.09,
            duration: 140,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(heartBeat, {
            toValue: 0.98,
            duration: 120,
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
          Animated.delay(350),
        ]),
        // Expanding pulse ripple 1
        Animated.sequence([
          Animated.delay(340),
          Animated.timing(ripple1, {
            toValue: 1,
            duration: 950,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(ripple1, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.delay(110),
        ]),
        // Expanding pulse ripple 2
        Animated.sequence([
          Animated.delay(520),
          Animated.timing(ripple2, {
            toValue: 1,
            duration: 880,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(ripple2, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [heartBeat, pulseProgress, ripple1, ripple2]);

  // Sweep reveal width across the ECG zone (from 20% to 82% of the icon width)
  const revealWidth = pulseProgress.interpolate({
    inputRange: [0, 0.12, 0.88, 1],
    outputRange: [size * 0.21, size * 0.24, size * 0.8, size * 0.85],
  });

  // Glowing scanner bar that travels at the leading edge of the ECG wave
  const scannerLeft = pulseProgress.interpolate({
    inputRange: [0, 0.12, 0.88, 1],
    outputRange: [size * 0.2, size * 0.23, size * 0.78, size * 0.83],
  });

  const scannerOpacity = pulseProgress.interpolate({
    inputRange: [0, 0.1, 0.5, 0.85, 1],
    outputRange: [0, 0.95, 1, 0.9, 0],
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
                  outputRange: [0, 0.38, 0],
                }),
                transform: [
                  {
                    scale: ripple1.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.48],
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
                  outputRange: [0, 0.28, 0],
                }),
                transform: [
                  {
                    scale: ripple2.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.32],
                    }),
                  },
                ],
              },
            ]}
          />
        </>
      ) : null}

      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [{ scale: heartBeat }],
        }}>
        {/* Base Layer: Shield + Clean Blue Heart (without static ECG line) */}
        <Image
          source={logoClean}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />

        {/* Animated Reveal Layer: Sweeps the glowing cyan/white ECG pulse across the heart */}
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: size,
            width: revealWidth,
            overflow: 'hidden',
          }}>
          <Image
            source={logoFull}
            style={{ width: size, height: size }}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Leading glowing cyan pulse head inside the heart */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: size * 0.39,
            height: size * 0.26,
            width: Math.max(4, size * 0.045),
            borderRadius: 99,
            backgroundColor: '#7DD3FC',
            left: scannerLeft,
            opacity: scannerOpacity,
            shadowColor: '#38BDF8',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.95,
            shadowRadius: 8,
          }}
        />
      </Animated.View>
    </View>
  );
}

/**
 * Full-screen Netflix-style letter-by-letter reveal + parallel live ECG pulse splash screen.
 */
export function AnimatedSplash({
  ready,
  onFinish,
}: {
  ready: boolean;
  onFinish: () => void;
}) {
  const logoIntroScale = useRef(new Animated.Value(0.82)).current;
  const logoIntroOpacity = useRef(new Animated.Value(0)).current;

  // Per-letter animations (Netflix style: opacity + scale 1.65->1 + translateY)
  const letterAnims = useRef(
    LETTERS.map(() => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(1.65),
      translateY: new Animated.Value(16),
    })),
  ).current;

  // Parallel bottom ECG wave reveal + subtitle fade
  const bottomWaveWidth = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(8)).current;

  // Final screen exit animation
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const containerScale = useRef(new Animated.Value(1)).current;
  const minTimeDone = useRef(false);
  const exitStarted = useRef(false);

  const tryExit = React.useCallback(() => {
    if (!minTimeDone.current || !ready || exitStarted.current) {
      return;
    }
    exitStarted.current = true;
    Animated.parallel([
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 380,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(containerScale, {
        toValue: 1.06,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinish();
    });
  }, [containerOpacity, containerScale, onFinish, ready]);

  useEffect(() => {
    // 1. Logo entrance
    Animated.parallel([
      Animated.timing(logoIntroOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoIntroScale, {
        toValue: 1,
        friction: 7,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Netflix-style staggered letter-by-letter animation ("MediAssist")
    const letterSequences = letterAnims.map((anim, index) =>
      Animated.sequence([
        Animated.delay(240 + index * 95),
        Animated.parallel([
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(anim.scale, {
            toValue: 1,
            friction: 6,
            tension: 90,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateY, {
            toValue: 0,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    // 3. Parallel lower ECG line sweep & subtitle reveal
    const waveAndSubtitle = Animated.sequence([
      Animated.delay(350),
      Animated.parallel([
        Animated.timing(bottomWaveWidth, {
          toValue: 220,
          duration: 1150,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.sequence([
          Animated.delay(650),
          Animated.parallel([
            Animated.timing(subtitleOpacity, {
              toValue: 1,
              duration: 420,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(subtitleTranslateY, {
              toValue: 0,
              duration: 420,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
    ]);

    Animated.parallel([...letterSequences, waveAndSubtitle]).start();

    const timer = setTimeout(() => {
      minTimeDone.current = true;
      tryExit();
    }, 2450);

    return () => clearTimeout(timer);
  }, [
    bottomWaveWidth,
    letterAnims,
    logoIntroOpacity,
    logoIntroScale,
    subtitleOpacity,
    subtitleTranslateY,
    tryExit,
  ]);

  useEffect(() => {
    if (ready) {
      tryExit();
    }
  }, [ready, tryExit]);

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
      <Animated.View
        style={{
          opacity: logoIntroOpacity,
          transform: [{ scale: logoIntroScale }],
          marginBottom: 26,
        }}>
        <AnimatedPulseLogo size={112} showRipples />
      </Animated.View>

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
      <View style={styles.waveWrapper}>
        <Animated.View style={{ width: bottomWaveWidth, overflow: 'hidden', height: 28 }}>
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
        </Animated.View>
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
    alignItems: 'flex-start',
    justifyContent: 'center',
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

