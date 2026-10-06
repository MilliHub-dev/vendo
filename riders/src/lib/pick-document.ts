import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

import type { DocumentFile } from '@/api/types';

const MAX_BYTES = 2 * 1024 * 1024; // the server's upload limit

/** Lets the rider photograph a document or choose one from their gallery. Resolves to null if they back out. */
export async function pickDocument(title: string): Promise<DocumentFile | null> {
  const source = Platform.OS === 'web' ? 'library' : await chooseSource(title);
  if (!source) return null;

  if (source === 'camera') {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) throw new Error('Allow camera access in your phone’s settings to photograph your documents.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true, allowsEditing: false, exif: false };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset?.base64) return null;
  if (asset.base64.length * 0.75 > MAX_BYTES) throw new Error('That photo is too large. Take it again a little further away, or choose a smaller one.');
  return { base64: asset.base64, mime: asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg' };
}

const chooseSource = (title: string) =>
  new Promise<'camera' | 'library' | null>((resolve) =>
    Alert.alert(title, 'Make sure all four corners are visible and the text is easy to read.', [
      { text: 'Take a photo', onPress: () => resolve('camera') },
      { text: 'Choose from gallery', onPress: () => resolve('library') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) }),
  );
