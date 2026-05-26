import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let adminInitialized = false;

export function getFirebaseAdmin() {
  if (!admin.apps.length) {
    let projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    
    if (!projectId) {
      try {
        const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          projectId = config.projectId;
        }
      } catch (e) {
        console.warn('Failed to parse firebase config from file:', e);
      }
    }

    if (!projectId) {
      projectId = "gen-lang-client-0836251512";
    }

    try {
      if (projectId) {
        admin.initializeApp({ projectId });
      } else {
        admin.initializeApp();
      }
      console.log('Firebase Admin initialized. apps.length:', admin.apps.length);
    } catch (e: any) {
      console.warn('Firebase Admin initialization failed:', e.message || e);
    }
  }
  return admin;
}

let firestoreDb: any = null;

export function getFirestoreDb() {
  if (!firestoreDb) {
    const adminApp = getFirebaseAdmin().app();
    let databaseId: string | undefined;
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        databaseId = config.firestoreDatabaseId;
      }
    } catch (err) {
      console.warn('Failed to parse firebase-applet-config.json:', err);
    }

    if (databaseId) {
      const { getFirestore } = require('firebase-admin/firestore');
      firestoreDb = getFirestore(adminApp, databaseId);
    } else {
      const { getFirestore } = require('firebase-admin/firestore');
      firestoreDb = getFirestore(adminApp);
    }
  }
  return firestoreDb;
}
