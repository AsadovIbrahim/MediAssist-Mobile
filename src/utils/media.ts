import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import type { LocalFile } from '../api/types';

async function requestAndroid(permission: (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS], label: string) {
  if (Platform.OS !== 'android') {
    return true;
  }
  const result = await PermissionsAndroid.request(permission);
  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return true;
  }
  Alert.alert('İcazə lazımdır', `${label} üçün icazə verilmədi.`);
  return false;
}

export const requestCameraPermission = () =>
  requestAndroid(PermissionsAndroid.PERMISSIONS.CAMERA, 'Kamera');

export const requestMicPermission = () =>
  requestAndroid(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, 'Səs yazma');

function assetToFile(a: Asset): LocalFile | null {
  if (!a.uri) {
    return null;
  }
  const ext = (a.type?.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  return {
    uri: a.uri,
    name: a.fileName || `sekil_${Date.now()}.${ext}`,
    type: a.type || 'image/jpeg',
    size: a.fileSize,
    kind: 'image',
  };
}

export async function pickImages(limit = 0): Promise<LocalFile[]> {
  const res = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: limit,
    quality: 0.8,
    maxWidth: 2000,
    maxHeight: 2000,
  });
  if (res.errorCode) {
    Alert.alert('Xəta', res.errorMessage || 'Şəkil seçilmədi.');
    return [];
  }
  return (res.assets ?? []).map(assetToFile).filter(Boolean) as LocalFile[];
}

export async function takePhoto(): Promise<LocalFile[]> {
  if (!(await requestCameraPermission())) {
    return [];
  }
  const res = await launchCamera({
    mediaType: 'photo',
    quality: 0.8,
    maxWidth: 2000,
    maxHeight: 2000,
    saveToPhotos: false,
  });
  if (res.errorCode) {
    Alert.alert('Xəta', res.errorMessage || 'Kamera açılmadı.');
    return [];
  }
  return (res.assets ?? []).map(assetToFile).filter(Boolean) as LocalFile[];
}

export async function pickDocuments(): Promise<LocalFile[]> {
  try {
    const files = await pick({
      type: [types.pdf, types.doc, types.docx, types.images],
      allowMultiSelection: true,
    });
    return files.map(f => {
      const isImage = (f.type ?? '').startsWith('image/');
      return {
        uri: f.uri,
        name: f.name || `sened_${Date.now()}`,
        type: f.type || 'application/octet-stream',
        size: f.size ?? undefined,
        kind: isImage ? 'image' : 'document',
      } as LocalFile;
    });
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
      return [];
    }
    Alert.alert('Xəta', (e as Error).message);
    return [];
  }
}

export function isImageFile(f: { type: string; fileName?: string; name?: string }) {
  const name = (f.fileName ?? f.name ?? '').toLowerCase();
  return f.type === 'Image' || f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/.test(name);
}

export function isAudioFile(f: { type: string; fileName?: string; name?: string }) {
  const name = (f.fileName ?? f.name ?? '').toLowerCase();
  return (
    f.type === 'VoiceRecording' ||
    f.type.startsWith('audio/') ||
    /\.(m4a|mp3|wav|ogg|aac|mp4)$/.test(name)
  );
}

/** PDF / DOC label for document badges. */
export function docLabel(f: { type: string; fileName: string }) {
  const name = f.fileName.toLowerCase();
  if (f.type === 'Pdf' || name.endsWith('.pdf')) {
    return 'PDF';
  }
  if (f.type === 'Doc' || /\.docx?$/.test(name)) {
    return 'DOC';
  }
  if (isImageFile(f)) {
    return 'Şəkil';
  }
  return 'Fayl';
}

