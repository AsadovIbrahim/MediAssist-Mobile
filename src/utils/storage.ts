import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  auth: 'mediassist.auth',
  apiUrl: 'mediassist.apiUrl',
  patientId: 'mediassist.patientId',
};

async function getJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function setValue(key: string, value: unknown) {
  if (value === null || value === undefined) {
    await AsyncStorage.removeItem(key);
  } else {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  }
}

export const storage = {
  getAuth: <T>() => getJson<T>(KEYS.auth),
  setAuth: (v: unknown) => setValue(KEYS.auth, v),
  getApiUrl: () => getJson<string>(KEYS.apiUrl),
  setApiUrl: (v: string | null) => setValue(KEYS.apiUrl, v),
  getPatientId: () => getJson<string>(KEYS.patientId),
  setPatientId: (v: string | null) => setValue(KEYS.patientId, v),
};

