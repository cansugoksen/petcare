import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { storage } from '@/lib/firebase';

function uriToBlob(uri) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('Fotograf dosyasi okunamadi.'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

export async function pickImageFromLibrary() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Fotograf erisim izni verilmedi.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  return result.assets[0];
}

export async function uploadPetPhoto({ uid, petId, uri }) {
  return uploadImageToStorage({
    uri,
    path: `users/${uid}/pets/${petId}/photo-${Date.now()}.jpg`,
  });
}

export async function uploadSocialPostImage({ uid, uri }) {
  return uploadImageToStorage({
    uri,
    path: `social/posts/${uid}/post-${Date.now()}.jpg`,
  });
}

async function uploadImageToStorage({ uri, path }) {
  let blob;
  try {
    if (!uri) {
      throw new Error('Fotograf URI bulunamadi.');
    }

    try {
      const response = await fetch(uri);
      blob = await response.blob();
    } catch {
      blob = await uriToBlob(uri);
    }

    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    const downloadURL = await getDownloadURL(storageRef);
    return { photoUrl: downloadURL, photoPath: path };
  } catch (error) {
    const code = error?.code || '';

    if (code === 'storage/unauthorized') {
      throw new Error('Fotograf yukleme izni yok. Firebase Storage Rules kontrol edilmeli.');
    }

    if (code === 'storage/unknown') {
      throw new Error(
        'Fotograf yuklenemedi (storage/unknown). Storage aktif mi, bucket dogru mu ve rules anonim kullaniciya izin veriyor mu kontrol edin.'
      );
    }

    if (error?.serverResponse) {
      throw new Error(`Fotograf yuklenemedi: ${error.serverResponse}`);
    }

    throw new Error(error?.message || 'Fotograf yuklenemedi.');
  } finally {
    // Some React Native Blob implementations throw on close() even after a successful upload.
    if (blob?.close instanceof Function) {
      try {
        blob.close();
      } catch {}
    }
  }
}
