import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  collection, 
  getDocs 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBpE5hnCBhqODd0GVNjz9P-LdL1xBfOKmg",
  authDomain: "teledrive-8dfd9.firebaseapp.com",
  projectId: "teledrive-8dfd9",
  storageBucket: "teledrive-8dfd9.firebasestorage.app",
  messagingSenderId: "279166961994",
  appId: "1:279166961994:web:320b6dca9b0f819086d9b3"
};

console.log("==================================================================");
console.log("🔥 Testing Live Firebase for Project: teledrive-8dfd9");
console.log("==================================================================");

async function run() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const testEmail = `teledrive.tester.${Date.now()}@example.com`;
  const testPassword = `TeleDrivePass!2026_${Math.random().toString(36).substring(2, 8)}`;

  console.log("\n1️⃣ Testing Firebase Authentication (Email/Password)...");
  console.log(`   Attempting to create user: ${testEmail}`);

  let userCred;
  try {
    userCred = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
    console.log(`   ✅ User created successfully! UID: ${userCred.user.uid}`);
  } catch (authErr) {
    console.error(`   ❌ Auth user creation failed:`, authErr.code, authErr.message);
    process.exit(1);
  }

  const uid = userCred.user.uid;

  console.log("\n2️⃣ Testing Firestore Write (User-Scoped Folder Document)...");
  const testFolderId = `test_folder_${Date.now()}`;
  const folderPath = `users/${uid}/folders/${testFolderId}`;
  const folderData = {
    id: testFolderId,
    name: "Real Cloud Firestore Test Folder",
    parentId: null,
    color: "#4f46e5",
    favorite: false,
    trashed: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ownerUid: uid
  };

  try {
    const folderRef = doc(db, 'users', uid, 'folders', testFolderId);
    await setDoc(folderRef, folderData);
    console.log(`   ✅ Firestore write successful at: ${folderPath}`);
  } catch (writeErr) {
    console.error(`   ❌ Firestore write failed:`, writeErr.code, writeErr.message);
    if (writeErr.code === 'permission-denied') {
      console.log("\n   ⚠️ Note: 'permission-denied' means Firestore database exists, but rules either need to be published or allow this path.");
    } else if (writeErr.code === 'unavailable' || writeErr.message.includes('NOT_FOUND') || writeErr.message.includes('database')) {
      console.log("\n   ⚠️ Note: The Cloud Firestore database might not be created yet in the Firebase Console (Build > Firestore Database > Create database).");
    }
    process.exit(1);
  }

  console.log("\n3️⃣ Testing Firestore Read (User-Scoped Folder Document)...");
  try {
    const folderRef = doc(db, 'users', uid, 'folders', testFolderId);
    const snap = await getDoc(folderRef);
    if (snap.exists()) {
      console.log(`   ✅ Firestore read successful! Data:`, snap.data().name);
    } else {
      console.error(`   ❌ Document did not exist at ${folderPath}`);
    }
  } catch (readErr) {
    console.error(`   ❌ Firestore read failed:`, readErr.code, readErr.message);
    process.exit(1);
  }

  console.log("\n4️⃣ Testing Firestore Write (User-Scoped File Metadata Record)...");
  const testFileId = `test_file_${Date.now()}`;
  const filePath = `users/${uid}/files/${testFileId}`;
  const fileData = {
    id: testFileId,
    name: "LiveVerification.pdf",
    originalSize: 1024,
    encryptedSize: 1073,
    mimeType: "application/pdf",
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    folderId: testFolderId,
    telegramChatId: "-1003912147144",
    telegramMessageId: 999,
    telegramDocumentId: "6188123128422474999",
    encrypted: true,
    encryptionVersion: 1,
    status: "completed",
    storageProvider: "local_companion",
    favorite: false,
    trashed: false,
    deletedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ownerUid: uid
  };

  try {
    const fileRef = doc(db, 'users', uid, 'files', testFileId);
    await setDoc(fileRef, fileData);
    console.log(`   ✅ File metadata write successful at: ${filePath}`);
  } catch (fileWriteErr) {
    console.error(`   ❌ File metadata write failed:`, fileWriteErr.code, fileWriteErr.message);
    process.exit(1);
  }

  console.log("\n5️⃣ Testing Firestore Read (User-Scoped File Metadata Record)...");
  try {
    const fileRef = doc(db, 'users', uid, 'files', testFileId);
    const snap = await getDoc(fileRef);
    if (snap.exists()) {
      console.log(`   ✅ File metadata read successful! File Name:`, snap.data().name);
      console.log(`      Encrypted: ${snap.data().encrypted}, Telegram Msg ID: ${snap.data().telegramMessageId}`);
    } else {
      console.error(`   ❌ File document did not exist!`);
    }
  } catch (fileReadErr) {
    console.error(`   ❌ File metadata read failed:`, fileReadErr.code, fileReadErr.message);
    process.exit(1);
  }

  console.log("\n6️⃣ Cleaning Up Test Records...");
  try {
    await deleteDoc(doc(db, 'users', uid, 'files', testFileId));
    await deleteDoc(doc(db, 'users', uid, 'folders', testFolderId));
    console.log(`   ✅ Test documents deleted from Firestore.`);
  } catch (delErr) {
    console.warn(`   ⚠️ Cleanup warning:`, delErr.message);
  }

  await signOut(auth);
  console.log("   ✅ Signed out test user.");

  console.log("\n==================================================================");
  console.log("🎉 ALL REAL FIREBASE AUTH & FIRESTORE READ/WRITE TESTS PASSED!");
  console.log("==================================================================");
  process.exit(0);
}

run().catch(err => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
