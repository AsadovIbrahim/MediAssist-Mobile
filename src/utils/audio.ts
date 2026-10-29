import { useEffect, useState } from 'react';
import Sound from 'react-native-nitro-sound';

/**
 * Tiny global audio player store on top of react-native-nitro-sound
 * (the native player is a singleton, so only one clip plays at a time).
 */
export interface AudioState {
  uri: string | null;
  playing: boolean;
  position: number;
  duration: number;
}

let state: AudioState = { uri: null, playing: false, position: 0, duration: 0 };
const listeners = new Set<(s: AudioState) => void>();
/** Remember durations of clips that were already loaded. */
const knownDurations = new Map<string, number>();

function setState(patch: Partial<AudioState>) {
  state = { ...state, ...patch };
  if (state.uri && state.duration > 0) {
    knownDurations.set(state.uri, state.duration);
  }
  listeners.forEach(l => l(state));
}

function detach() {
  try {
    Sound.removePlayBackListener();
    Sound.removePlaybackEndListener();
  } catch {
    // ignore
  }
}

export async function stopAudio() {
  detach();
  if (state.uri) {
    try {
      await Sound.stopPlayer();
    } catch {
      // ignore
    }
  }
  setState({ uri: null, playing: false, position: 0, duration: 0 });
}

export async function toggleAudio(uri: string) {
  if (state.uri === uri) {
    try {
      if (state.playing) {
        await Sound.pausePlayer();
        setState({ playing: false });
      } else {
        await Sound.resumePlayer();
        setState({ playing: true });
      }
    } catch {
      await stopAudio();
    }
    return;
  }

  await stopAudio();
  setState({ uri, playing: true, position: 0, duration: knownDurations.get(uri) ?? 0 });
  Sound.addPlayBackListener(e => {
    if (state.uri !== uri) {
      return;
    }
    setState({ position: e.currentPosition, duration: e.duration || state.duration });
  });
  Sound.addPlaybackEndListener(() => {
    if (state.uri === uri) {
      detach();
      setState({ playing: false, position: 0, uri: null });
    }
  });
  try {
    await Sound.startPlayer(uri);
  } catch (e) {
    await stopAudio();
    throw e;
  }
}

export function useAudio(uri: string | undefined) {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  const active = !!uri && s.uri === uri;
  return {
    active,
    playing: active && s.playing,
    position: active ? s.position : 0,
    duration: active ? s.duration : (uri && knownDurations.get(uri)) || 0,
  };
}

export { Sound };

