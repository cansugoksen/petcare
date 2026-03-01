import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { getDownloadURL, getStorage, ref, uploadBytes, uploadString } from 'firebase/storage';

import { firebaseApp, storage, storageBucketCandidates } from '@/lib/firebase';

let FS_DOCUMENT_DIR = '';
try {
  // expo-file-system API surface varies by SDK/runtime; runtime lookup is intentional.
  // eslint-disable-next-line import/namespace
  FS_DOCUMENT_DIR = FileSystem['documentDirectory'] || '';
} catch {
  FS_DOCUMENT_DIR = '';
}

if (!FS_DOCUMENT_DIR) {
  try {
    // eslint-disable-next-line import/namespace
    FS_DOCUMENT_DIR = FileSystem['cacheDirectory'] || '';
  } catch {
    FS_DOCUMENT_DIR = '';
  }
}

let FS_BASE64_ENCODING = 'base64';
try {
  // eslint-disable-next-line import/namespace
  FS_BASE64_ENCODING = FileSystem['EncodingType']?.Base64 || 'base64';
} catch {
  FS_BASE64_ENCODING = 'base64';
}

function uriToBlob(uri) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('Fotoğraf dosyası okunamadı.'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

export async function pickImageFromLibrary() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Fotoğraf erişim izni verilmedi.');
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

export async function pickImageFromCamera() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Kamera erişim izni verilmedi.');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  return result.assets[0];
}

export async function pickDocumentFile() {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      type: ['application/pdf', 'image/*', '*/*'],
    });

    if (result.canceled || !result.assets?.length) {
      return null;
    }

    return result.assets[0];
  } catch (error) {
    throw new Error(error?.message || 'Belge seçilemedi.');
  }
}

export async function uploadPetPhoto({ uid, petId, uri }) {
  return uploadImageToStorage({
    uri,
    path: `users/${uid}/pets/${petId}/photo-${Date.now()}.jpg`,
  });
}

export async function savePetPhotoLocal({ uid, petId, uri }) {
  if (!uri) {
    throw new Error('Fotoğraf URI bulunamadı.');
  }

  const baseDir = `${FS_DOCUMENT_DIR}petcare/users/${uid}/pets/${petId}/`;
  const fileName = `profile-${Date.now()}.jpg`;
  const targetUri = `${baseDir}${fileName}`;

  try {
    const dirInfo = await FileSystem.getInfoAsync(baseDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
    }

    await FileSystem.copyAsync({
      from: uri,
      to: targetUri,
    });

    return {
      photoUrl: null,
      photoPath: null,
      photoLocalUri: targetUri,
      photoLocalPath: targetUri,
    };
  } catch (error) {
    throw new Error(error?.message || 'Fotoğraf cihaz içine kaydedilemedi.');
  }
}

export async function deleteLocalFileIfExists(fileUriOrPath) {
  if (!fileUriOrPath || typeof fileUriOrPath !== 'string') {
    return;
  }

  // Remote URLs are not local files; ignore silently.
  if (/^https?:\/\//i.test(fileUriOrPath)) {
    return;
  }

  try {
    const info = await FileSystem.getInfoAsync(fileUriOrPath);
    if (info.exists) {
      await FileSystem.deleteAsync(fileUriOrPath, { idempotent: true });
    }
  } catch {
    // Local cleanup should never block the main flow.
  }
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
      throw new Error('Fotoğraf URI bulunamadı.');
    }

    try {
      const response = await fetch(uri);
      blob = await response.blob();
    } catch {
      blob = await uriToBlob(uri);
    }

    const storagesToTry = buildStoragesToTry();
    let lastError = null;

    for (const storageEntry of storagesToTry) {
      const storageRef = ref(storageEntry.instance, path);
      try {
        await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
        const downloadURL = await getDownloadURL(storageRef);
        return { photoUrl: downloadURL, photoPath: path };
      } catch (blobError) {
        lastError = blobError;

        // On some RN/Expo builds uploadBytes fails with generic storage/unknown for valid files.
        if (shouldTryBase64Fallback(blobError)) {
          try {
            const base64 = await FileSystem.readAsStringAsync(uri, {
              encoding: FS_BASE64_ENCODING,
            });
            await uploadString(storageRef, base64, 'base64', { contentType: 'image/jpeg' });
            const downloadURL = await getDownloadURL(storageRef);
            return { photoUrl: downloadURL, photoPath: path };
          } catch (base64Error) {
            lastError = base64Error;
          }
        }
      }
    }

    throw lastError || new Error('Fotoğraf yükleme başarısız.');
  } catch (error) {
    const code = error?.code || '';
    const uriScheme = typeof uri === 'string' && uri.includes(':') ? uri.split(':')[0] : 'unknown';
    const bucketInfo = storageBucketCandidates.filter(Boolean).join(', ') || 'yok';
    const debugContext = `code=${code || 'n/a'} | uriScheme=${uriScheme} | path=${path} | buckets=${bucketInfo}`;

    console.error('Storage upload failed', {
      code,
      message: error?.message,
      serverResponse: error?.serverResponse,
      uriScheme,
      path,
      storageBucketCandidates,
      configuredBucket: firebaseApp.options?.storageBucket,
    });

    if (code === 'storage/unauthorized') {
      throw new Error(
        `Fotoğraf yükleme izni yok (storage/unauthorized). Firebase Storage Rules kontrol edilmeli.\n\n${debugContext}`
      );
    }

    if (code === 'storage/unknown') {
      throw new Error(
        `Fotoğraf yüklenemedi (storage/unknown).\nStorage aktif mi, bucket doğru mu ve rules anonim kullanıcıya izin veriyor mu kontrol edin.\n\n${debugContext}`
      );
    }

    if (error?.serverResponse) {
      const serverResponse = String(error.serverResponse).slice(0, 300);
      throw new Error(`Fotoğraf yüklenemedi. Sunucu yanıtı: ${serverResponse}\n\n${debugContext}`);
    }

    throw new Error(`${error?.message || 'Fotoğraf yüklenemedi.'}\n\n${debugContext}`);
  } finally {
    if (blob?.close instanceof Function) {
      try {
        blob.close();
      } catch {}
    }
  }
}

function buildStoragesToTry() {
  const result = [];
  const seen = new Set();

  const pushStorage = (instance, bucket) => {
    const key = bucket || instance?.app?.options?.storageBucket || 'default';
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ instance, bucket: key });
  };

  pushStorage(storage, firebaseApp.options?.storageBucket || null);

  storageBucketCandidates.forEach((bucketName) => {
    if (!bucketName) return;
    try {
      pushStorage(getStorage(firebaseApp, `gs://${bucketName}`), bucketName);
    } catch {
      // ignore invalid candidate
    }
  });

  return result;
}

function shouldTryBase64Fallback(error) {
  const code = error?.code || '';
  return code === 'storage/unknown' || code === 'storage/retry-limit-exceeded';
}
